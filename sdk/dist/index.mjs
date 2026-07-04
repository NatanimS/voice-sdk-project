// src/core/StateMachine.ts
var StateMachine = class {
  constructor() {
    this.currentState = "idle";
    this.listeners = [];
  }
  getState() {
    return this.currentState;
  }
  setState(newState) {
    this.currentState = newState;
    for (const listener of this.listeners) {
      listener(newState);
    }
  }
  onChange(listener) {
    this.listeners.push(listener);
  }
};

// src/providers/WebSpeechProvider.ts
var WebSpeechProvider = class {
  constructor() {
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      throw new Error("Web Speech API is not supported in this browser.");
    }
    this.recognition = new SpeechRecognitionClass();
    this.recognition.lang = "en-US";
    this.recognition.interimResults = false;
  }
  listen(onResult, onError) {
    this.recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };
    this.recognition.onerror = (event) => {
      onError(event.error);
    };
    this.recognition.start();
  }
  stop() {
    this.recognition.stop();
  }
  speak(text, onDone) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.onend = onDone;
    window.speechSynthesis.speak(utterance);
  }
};

// src/providers/BackendSpeechProvider.ts
var BackendSpeechProvider = class {
  constructor(backendUrl, apiKey) {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.backendUrl = backendUrl;
    this.apiKey = apiKey;
  }
  async listen(onResult, onError) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(stream);
      this.mediaRecorder.ondataavailable = (event) => {
        this.audioChunks.push(event.data);
      };
      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.audioChunks, { type: "audio/webm" });
        try {
          const formData = new FormData();
          formData.append("audio", audioBlob, "recording.webm");
          formData.append("language", "am");
          const response = await fetch(`${this.backendUrl}/api/v1/stt`, {
            method: "POST",
            headers: { "X-API-Key": this.apiKey },
            body: formData
          });
          if (!response.ok) {
            throw new Error(`Backend returned ${response.status}`);
          }
          const data = await response.json();
          onResult(data.text);
        } catch (err) {
          onError(err.message || "Failed to transcribe audio");
        }
      };
      this.mediaRecorder.start();
    } catch (err) {
      onError(err.message || "Microphone access failed");
    }
  }
  stop() {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }
  }
  async speak(text, onDone) {
    const response = await fetch(`${this.backendUrl}/api/v1/tts`, {
      method: "POST",
      headers: {
        "X-API-Key": this.apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text, language: "am" })
    });
    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    audio.onended = onDone;
    audio.play();
  }
};

// src/core/VoiceSDK.ts
var VoiceSDK = class {
  constructor(config) {
    this.resultCallback = null;
    this.errorCallback = null;
    this.commands = [];
    this.assistant = {
      start: (language) => {
        this.startListening({ language }).catch(() => {
        });
      },
      stop: () => {
        this.stopListening();
      }
    };
    this.config = config;
    this.backendUrl = config.backendUrl || "http://127.0.0.1:8000";
    this.stateMachine = new StateMachine();
    this.webSpeechProvider = new WebSpeechProvider();
    this.backendSpeechProvider = new BackendSpeechProvider(this.backendUrl, config.apiKey);
  }
  resolveLanguage(explicit) {
    if (explicit) return explicit;
    if (this.config.defaultLanguage && this.config.defaultLanguage !== "auto") {
      return this.config.defaultLanguage;
    }
    return "en";
  }
  checkCommands(text) {
    const lowerText = text.toLowerCase();
    for (const command of this.commands) {
      if (lowerText.includes(command.phrase.toLowerCase())) {
        command.handler(text);
      }
    }
  }
  /**
   * Calls our backend's intent recognition endpoint. This runs for BOTH
   * English and Amharic - intent recognition is always backend-side,
   * per our Phase 2 decision that it's a separate concern from speech
   * recognition itself. Fails gracefully (returns empty result) if the
   * backend is unreachable, so a developer's transcript still comes
   * through even if intent lookup fails.
   */
  async fetchIntent(text, language) {
    try {
      const response = await fetch(`${this.backendUrl}/api/v1/intent`, {
        method: "POST",
        headers: {
          "X-API-Key": this.config.apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text, language })
      });
      if (!response.ok) return {};
      const data = await response.json();
      return { intent: data.intent, entities: data.entities };
    } catch {
      return {};
    }
  }
  registerCommand(phrase, handler) {
    this.commands.push({ phrase, handler });
  }
  startListening(options) {
    const language = this.resolveLanguage(options?.language);
    return new Promise((resolve, reject) => {
      this.stateMachine.setState("listening");
      const onResult = async (text) => {
        this.stateMachine.setState("processing");
        const { intent, entities } = await this.fetchIntent(text, language);
        const result = { text, language, intent, entities };
        if (this.resultCallback) {
          this.resultCallback(result);
        }
        this.checkCommands(text);
        this.stateMachine.setState("idle");
        resolve();
      };
      const onError = (errorMessage) => {
        this.stateMachine.setState("error");
        if (this.errorCallback) {
          this.errorCallback({ message: errorMessage, code: "RECOGNITION_ERROR" });
        }
        reject(errorMessage);
      };
      if (language === "am") {
        this.backendSpeechProvider.listen(onResult, onError);
      } else {
        this.webSpeechProvider.listen(onResult, onError);
      }
    });
  }
  stopListening() {
    this.webSpeechProvider.stop();
    this.backendSpeechProvider.stop();
    this.stateMachine.setState("idle");
  }
  speak(text, options) {
    const language = this.resolveLanguage(options?.language);
    return new Promise((resolve) => {
      this.stateMachine.setState("speaking");
      const onDone = () => {
        this.stateMachine.setState("idle");
        resolve();
      };
      if (language === "am") {
        this.backendSpeechProvider.speak(text, onDone);
      } else {
        this.webSpeechProvider.speak(text, onDone);
      }
    });
  }
  onResult(callback) {
    this.resultCallback = callback;
  }
  onStateChange(callback) {
    this.stateMachine.onChange(callback);
  }
  onError(callback) {
    this.errorCallback = callback;
  }
};
export {
  VoiceSDK
};
