/**
 * @jest-environment jsdom
 *
 * Unit tests for VoiceSDK.
 *
 * These tests mock the global fetch() function, so they run without a real
 * backend — they check that the SDK builds the right requests and handles
 * responses/errors correctly, not that any particular server works.
 *
 * Run with: npx jest voice-sdk.test.js
 * (requires: npm install --save-dev jest jest-environment-jsdom)
 *
 * jsdom is needed because these tests touch browser APIs (fetch, Blob,
 * FormData, Audio, MediaRecorder) that don't exist in plain Node.
 * IMPORTANT: the @jest-environment pragma above must stay in the very
 * first comment block in this file — Jest only reads pragmas from the
 * first docblock, so a second comment block containing it is ignored.
 */

const VoiceSDK = require('./voice-sdk.js');

// --- Test helpers -----------------------------------------------------

/** Builds a fake successful fetch Response for JSON endpoints (e.g. /stt). */
function mockJsonResponse(body, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    json: () => Promise.resolve(body),
    blob: () => Promise.resolve(new Blob([JSON.stringify(body)])),
  });
}

/** Builds a fake successful fetch Response for binary endpoints (e.g. /tts). */
function mockBlobResponse(status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    blob: () => Promise.resolve(new Blob(['fake-audio-bytes'], { type: 'audio/wav' })),
    json: () => Promise.reject(new Error('not json')),
  });
}

/** Builds a fake failed fetch Response with a JSON error body, like FastAPI returns. */
function mockErrorResponse(status, detail) {
  return Promise.resolve({
    ok: false,
    status,
    statusText: 'Error',
    json: () => Promise.resolve({ detail }),
    blob: () => Promise.resolve(new Blob([])),
  });
}

describe('VoiceSDK constructor', () => {
  test('throws if apiKey is missing', () => {
    expect(() => new VoiceSDK({})).toThrow('apiKey');
  });

  test('applies default baseUrl and defaultLanguage', () => {
    const sdk = new VoiceSDK({ apiKey: 'key123' });
    expect(sdk.baseUrl).toBe('http://127.0.0.1:8000');
    expect(sdk.defaultLanguage).toBe('en');
  });

  test('strips a trailing slash from a custom baseUrl', () => {
    const sdk = new VoiceSDK({ apiKey: 'key123', baseUrl: 'http://example.com/' });
    expect(sdk.baseUrl).toBe('http://example.com');
  });
});

describe('speak()', () => {
  let sdk;

  beforeEach(() => {
    sdk = new VoiceSDK({ apiKey: 'key123' });
    // Audio.play() isn't implemented in jsdom — stub it so tests don't crash.
    window.HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined);
    global.URL.createObjectURL = jest.fn(() => 'blob:fake-url');
    global.URL.revokeObjectURL = jest.fn();
  });

  test('throws on empty text without making a request', async () => {
    global.fetch = jest.fn();
    await expect(sdk.speak('')).rejects.toThrow('non-empty text');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('sends the correct request shape', async () => {
    global.fetch = jest.fn(() => mockBlobResponse());
    await sdk.speak('Hello', 'en');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/api/v1/tts',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-api-key': 'key123',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ text: 'Hello', language: 'en' }),
      })
    );
  });

  test('falls back to defaultLanguage when none is given', async () => {
    global.fetch = jest.fn(() => mockBlobResponse());
    await sdk.speak('Hello');

    const call = global.fetch.mock.calls[0];
    const sentBody = JSON.parse(call[1].body);
    expect(sentBody.language).toBe('en');
  });

  test('throws VoiceSDKError with backend detail on failure', async () => {
    global.fetch = jest.fn(() => mockErrorResponse(401, 'Invalid API key'));
    await expect(sdk.speak('Hello', 'en')).rejects.toMatchObject({
      name: 'VoiceSDKError',
      status: 401,
      message: expect.stringContaining('Invalid API key'),
    });
  });
});

describe('transcribe()', () => {
  let sdk;

  beforeEach(() => {
    sdk = new VoiceSDK({ apiKey: 'key123' });
  });

  test('throws if given something other than a Blob', async () => {
    await expect(sdk.transcribe('not-a-blob')).rejects.toThrow('Blob');
  });

  test('sends a multipart request without manually setting Content-Type', async () => {
    global.fetch = jest.fn(() => mockJsonResponse({ text: 'hi', language: 'en', confidence: 0.9 }));
    const blob = new Blob(['fake-audio']);

    await sdk.transcribe(blob, 'en');

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:8000/api/v1/stt');
    expect(options.body).toBeInstanceOf(FormData);
    // Content-Type must NOT be set manually for FormData — the browser
    // needs to add its own multipart boundary automatically.
    expect(options.headers['Content-Type']).toBeUndefined();
    expect(options.headers['x-api-key']).toBe('key123');
  });

  test('returns the parsed transcript on success', async () => {
    global.fetch = jest.fn(() =>
      mockJsonResponse({ text: 'ሰላም', language: 'am', confidence: 0.97 })
    );
    const result = await sdk.transcribe(new Blob(['audio']), 'am');
    expect(result).toEqual({ text: 'ሰላም', language: 'am', confidence: 0.97 });
  });

  test('throws VoiceSDKError on a validation failure', async () => {
    global.fetch = jest.fn(() => mockErrorResponse(422, 'language field required'));
    await expect(sdk.transcribe(new Blob(['audio']))).rejects.toMatchObject({
      status: 422,
    });
  });
});

describe('startListening() / stopListening()', () => {
  let sdk, fakeTrack, fakeStream, fakeRecorder;

  beforeEach(() => {
    sdk = new VoiceSDK({ apiKey: 'key123' });

    fakeTrack = { stop: jest.fn() };
    fakeStream = { getTracks: () => [fakeTrack] };

    // Minimal fake MediaRecorder so we don't depend on real browser recording.
    fakeRecorder = {
      state: 'inactive',
      stream: fakeStream,
      listeners: {},
      addEventListener(event, cb) {
        this.listeners[event] = cb;
      },
      start() {
        this.state = 'recording';
      },
      stop() {
        this.state = 'inactive';
        this.listeners['stop'] && this.listeners['stop']();
      },
    };

    global.navigator.mediaDevices = {
      getUserMedia: jest.fn().mockResolvedValue(fakeStream),
    };
    global.MediaRecorder = jest.fn(() => fakeRecorder);
  });

  test('startListening requests the microphone and begins recording', async () => {
    await sdk.startListening('en');
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(fakeRecorder.state).toBe('recording');
  });

  test('startListening throws if already recording', async () => {
    await sdk.startListening('en');
    await expect(sdk.startListening('en')).rejects.toThrow('Already listening');
  });

  test('stopListening throws if not currently recording', async () => {
    await expect(sdk.stopListening()).rejects.toThrow('Not currently listening');
  });

  test('stopListening stops the mic track and returns a transcript', async () => {
    global.fetch = jest.fn(() =>
      mockJsonResponse({ text: 'hello', language: 'en', confidence: 0.95 })
    );

    await sdk.startListening('en');
    const result = await sdk.stopListening();

    expect(fakeTrack.stop).toHaveBeenCalled();
    expect(result).toEqual({ text: 'hello', language: 'en', confidence: 0.95 });
  });

  test('getActiveStream returns null when not listening', () => {
    expect(sdk.getActiveStream()).toBeNull();
  });

  test('getActiveStream returns the stream while recording', async () => {
    await sdk.startListening('en');
    expect(sdk.getActiveStream()).toBe(fakeStream);
  });
});

describe('registerCommand() / matchCommand()', () => {
  let sdk;

  beforeEach(() => {
    sdk = new VoiceSDK({ apiKey: 'key123' });
  });

  test('registerCommand throws on an empty pattern', () => {
    expect(() => sdk.registerCommand('', () => {})).toThrow('non-empty pattern');
  });

  test('registerCommand throws if handler is not a function', () => {
    expect(() => sdk.registerCommand('next', 'not-a-function')).toThrow('handler function');
  });

  test('matchCommand throws if given a non-string', () => {
    expect(() => sdk.matchCommand(123)).toThrow('requires a string');
  });

  test('matches an exact phrase and calls the handler', () => {
    const handler = jest.fn();
    sdk.registerCommand('next', handler);

    const result = sdk.matchCommand('next');

    expect(handler).toHaveBeenCalledWith({});
    expect(result).toEqual({ pattern: 'next', params: {} });
  });

  test('matching is case-insensitive and ignores extra whitespace', () => {
    const handler = jest.fn();
    sdk.registerCommand('go back', handler);

    sdk.matchCommand('  GO   BACK  ');

    expect(handler).toHaveBeenCalledWith({});
  });

  test('captures a {placeholder} value and passes it to the handler', () => {
    const handler = jest.fn();
    sdk.registerCommand('search for {query}', handler);

    const result = sdk.matchCommand('search for pizza');

    expect(handler).toHaveBeenCalledWith({ query: 'pizza' });
    expect(result).toEqual({ pattern: 'search for {query}', params: { query: 'pizza' } });
  });

  test('returns null and calls no handler when nothing matches', () => {
    const handler = jest.fn();
    sdk.registerCommand('next', handler);

    const result = sdk.matchCommand('something unrelated');

    expect(handler).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  test('checks commands in registration order and stops at the first match', () => {
    const first = jest.fn();
    const second = jest.fn();
    sdk.registerCommand('{anything}', first);
    sdk.registerCommand('next', second);

    sdk.matchCommand('next');

    expect(first).toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
  });

  test('the unregister function returned by registerCommand removes only that command', () => {
    const handler = jest.fn();
    const unregister = sdk.registerCommand('next', handler);

    unregister();
    sdk.matchCommand('next');

    expect(handler).not.toHaveBeenCalled();
  });

  test('unregisterCommand removes a command by pattern string', () => {
    const handler = jest.fn();
    sdk.registerCommand('next', handler);

    sdk.unregisterCommand('next');
    sdk.matchCommand('next');

    expect(handler).not.toHaveBeenCalled();
  });
});
