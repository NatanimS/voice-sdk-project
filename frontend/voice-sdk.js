/**
 * VoiceSDK — a minimal client SDK for the Voice SDK backend.
 *
 * Wraps two backend endpoints:
 *   POST /api/v1/stt  -> speech to text
 *   POST /api/v1/tts  -> text to speech
 *
 * Usage:
 *   const sdk = new VoiceSDK({ apiKey: 'dev_local_key_123', baseUrl: 'http://127.0.0.1:8000' });
 *
 *   // Text to speech
 *   await sdk.speak('Hello world', 'en');
 *
 *   // Speech to text, from a Blob you already have
 *   const result = await sdk.transcribe(audioBlob, 'am');
 *
 *   // Speech to text, straight from the microphone
 *   await sdk.startListening('en');
 *   // ... user talks ...
 *   const result = await sdk.stopListening();
 *
 *   // Voice commands
 *   sdk.registerCommand('next', () => showNextSlide());
 *   sdk.registerCommand('search for {query}', ({ query }) => runSearch(query));
 *   sdk.matchCommand(result.text); // checks text against registered commands, fires the match
 */

class VoiceSDKError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'VoiceSDKError';
    this.status = status; // HTTP status code, if the error came from the backend
  }
}

class VoiceSDK {
  /**
   * @param {Object} config
   * @param {string} config.apiKey - Matches BACKEND_API_KEY on the server (x-api-key header)
   * @param {string} [config.baseUrl] - Backend base URL, no trailing slash
   * @param {string} [config.defaultLanguage] - Language code used when none is passed to a method
   */
  constructor({ apiKey, baseUrl = 'http://127.0.0.1:8000', defaultLanguage = 'en' }) {
    if (!apiKey) {
      throw new VoiceSDKError('VoiceSDK requires an apiKey.');
    }
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.defaultLanguage = defaultLanguage;

    // Internal state used while recording from the microphone
    this._mediaRecorder = null;
    this._recordedChunks = [];

    // Registered voice commands, in registration order
    this._commands = [];
  }

  /**
   * Converts text into speech and plays it immediately.
   *
   * @param {string} text
   * @param {string} [language] - Defaults to this.defaultLanguage
   * @returns {Promise<HTMLAudioElement>} the audio element that is playing, in case the caller wants to control it
   */
  async speak(text, language = this.defaultLanguage) {
    if (!text || !text.trim()) {
      throw new VoiceSDKError('speak() requires non-empty text.');
    }

    const response = await fetch(`${this.baseUrl}/api/v1/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      },
      body: JSON.stringify({ text, language }),
    });

    if (!response.ok) {
      throw await this._toError(response);
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);

    // Release the object URL once playback finishes, so we don't leak memory
    audio.addEventListener('ended', () => URL.revokeObjectURL(audioUrl));

    await audio.play();
    return audio;
  }

  /**
   * Sends a pre-recorded audio Blob to the backend and returns the transcript.
   *
   * @param {Blob} audioBlob
   * @param {string} [language] - Defaults to this.defaultLanguage
   * @returns {Promise<{text: string, language: string, confidence: number}>}
   */
  async transcribe(audioBlob, language = this.defaultLanguage) {
    if (!(audioBlob instanceof Blob)) {
      throw new VoiceSDKError('transcribe() requires a Blob (e.g. from MediaRecorder or a file input).');
    }

    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio.webm');
    formData.append('language', language);

    const response = await fetch(`${this.baseUrl}/api/v1/stt`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        // Note: no Content-Type header here — the browser sets the correct
        // multipart/form-data boundary automatically when you pass FormData.
      },
      body: formData,
    });

    if (!response.ok) {
      throw await this._toError(response);
    }

    return response.json();
  }

  /**
   * Starts recording microphone audio. Call stopListening() to finish and
   * get the transcript back. This is the "live voice input" path.
   *
   * @param {string} [language] - Language to transcribe once stopListening() is called
   */
  async startListening(language = this.defaultLanguage) {
    if (this._mediaRecorder && this._mediaRecorder.state === 'recording') {
      throw new VoiceSDKError('Already listening. Call stopListening() first.');
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this._recordedChunks = [];
    this._listeningLanguage = language;

    this._mediaRecorder = new MediaRecorder(stream);
    this._mediaRecorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) {
        this._recordedChunks.push(event.data);
      }
    });

    this._mediaRecorder.start();
  }

  /**
   * Stops the current recording, sends it to the backend, and returns the transcript.
   * Also stops the microphone track so the browser's "recording" indicator turns off.
   *
   * @returns {Promise<{text: string, language: string, confidence: number}>}
   */
  async stopListening() {
    if (!this._mediaRecorder || this._mediaRecorder.state !== 'recording') {
      throw new VoiceSDKError('Not currently listening. Call startListening() first.');
    }

    const recordingStopped = new Promise((resolve) => {
      this._mediaRecorder.addEventListener('stop', resolve, { once: true });
    });

    this._mediaRecorder.stop();
    // Stop every audio track so the mic indicator/light turns off
    this._mediaRecorder.stream.getTracks().forEach((track) => track.stop());

    await recordingStopped;

    const audioBlob = new Blob(this._recordedChunks, { type: 'audio/webm' });
    this._recordedChunks = [];

    return this.transcribe(audioBlob, this._listeningLanguage);
  }

  /**
   * Returns the raw MediaStream currently being recorded, or null if not listening.
   * Useful for hooking up a live waveform visualizer without requesting
   * microphone access a second time.
   *
   * @returns {MediaStream|null}
   */
  getActiveStream() {
    if (this._mediaRecorder && this._mediaRecorder.state === 'recording') {
      return this._mediaRecorder.stream;
    }
    return null;
  }

  /**
   * Registers a voice command. When matchCommand() is later called with
   * text that matches this pattern, the handler runs automatically.
   *
   * Patterns are matched whole-phrase, case-insensitively, ignoring extra
   * whitespace. Use {name} inside a pattern to capture part of the
   * phrase — e.g. 'search for {query}' matches "search for pizza" and
   * calls handler({ query: 'pizza' }).
   *
   * @param {string} pattern - e.g. 'next', 'search for {query}'
   * @param {(params: Object) => void} handler - called with captured params on match
   * @returns {() => void} an unregister function — call it to remove this command later
   */
  registerCommand(pattern, handler) {
    if (typeof pattern !== 'string' || !pattern.trim()) {
      throw new VoiceSDKError('registerCommand() requires a non-empty pattern string.');
    }
    if (typeof handler !== 'function') {
      throw new VoiceSDKError('registerCommand() requires a handler function.');
    }

    const compiled = this._compilePattern(pattern);
    const entry = { pattern, handler, ...compiled };
    this._commands.push(entry);

    return () => {
      this._commands = this._commands.filter((c) => c !== entry);
    };
  }

  /**
   * Removes every registered command matching this exact pattern string.
   * Prefer using the unregister function returned by registerCommand()
   * when you only want to remove one specific registration.
   *
   * @param {string} pattern
   */
  unregisterCommand(pattern) {
    this._commands = this._commands.filter((c) => c.pattern !== pattern);
  }

  /**
   * Checks text against every registered command. On the first match,
   * calls that command's handler with any captured params and returns
   * details about the match. Returns null if nothing matched.
   *
   * @param {string} text - typically a transcript from transcribe()/stopListening()
   * @returns {{pattern: string, params: Object}|null}
   */
  matchCommand(text) {
    if (typeof text !== 'string') {
      throw new VoiceSDKError('matchCommand() requires a string.');
    }
    const normalized = text.trim();

    for (const command of this._commands) {
      const match = normalized.match(command.regex);
      if (match) {
        const params = {};
        command.paramNames.forEach((name, i) => {
          params[name] = match[i + 1];
        });
        command.handler(params);
        return { pattern: command.pattern, params };
      }
    }
    return null;
  }

  /**
   * Turns a pattern like 'search for {query}' into a case-insensitive
   * whole-phrase regex, plus the ordered list of param names it captures.
   * @private
   */
  _compilePattern(pattern) {
    const paramNames = [];
    const regexBody = pattern
      .trim()
      .split(/\s+/)
      .map((token) => {
        const placeholder = token.match(/^\{(\w+)\}$/);
        if (placeholder) {
          paramNames.push(placeholder[1]);
          return '(.+)';
        }
        // Escape regex special characters in literal words
        return token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join('\\s+');

    return { regex: new RegExp(`^${regexBody}$`, 'i'), paramNames };
  }

  /**
   * Converts a failed fetch Response into a VoiceSDKError with useful detail.
   * @private
   */
  async _toError(response) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      // Response wasn't JSON — fall back to statusText
    }
    return new VoiceSDKError(`Request failed (${response.status}): ${detail}`, response.status);
  }
}

// Support both <script src="voice-sdk.js"> (global VoiceSDK) and ES module imports
if (typeof window !== 'undefined') {
  window.VoiceSDK = VoiceSDK;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VoiceSDK;
}
