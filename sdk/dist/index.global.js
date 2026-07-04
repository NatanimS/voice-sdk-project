"use strict";
var VoiceSDKBundle = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/index.ts
  var index_exports = {};
  __export(index_exports, {
    VoiceSDK: () => VoiceSDK
  });

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

  // src/core/VoiceSDK.ts
  var VoiceSDK = class {
    constructor(config) {
      this.resultCallback = null;
      this.errorCallback = null;
      this.config = config;
      this.stateMachine = new StateMachine();
      this.webSpeechProvider = new WebSpeechProvider();
    }
    startListening(options) {
      return new Promise((resolve, reject) => {
        this.stateMachine.setState("listening");
        this.webSpeechProvider.listen(
          (text) => {
            this.stateMachine.setState("processing");
            const result = {
              text,
              language: "en"
            };
            if (this.resultCallback) {
              this.resultCallback(result);
            }
            this.stateMachine.setState("idle");
            resolve();
          },
          (errorMessage) => {
            this.stateMachine.setState("error");
            if (this.errorCallback) {
              this.errorCallback({ message: errorMessage, code: "RECOGNITION_ERROR" });
            }
            reject(errorMessage);
          }
        );
      });
    }
    stopListening() {
      this.webSpeechProvider.stop();
      this.stateMachine.setState("idle");
    }
    speak(text, options) {
      return new Promise((resolve) => {
        this.stateMachine.setState("speaking");
        this.webSpeechProvider.speak(text, () => {
          this.stateMachine.setState("idle");
          resolve();
        });
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
  return __toCommonJS(index_exports);
})();
