# voicesdk.js

A drop-in JavaScript SDK for real-time speech-to-text and text-to-speech, built for English and Amharic (with room to grow to more languages).

No build step, no dependencies. Works with a plain `<script>` tag or as a module import.

---

## Installation

Copy `voice-sdk.js` into your project and include it:

```html
<script src="voice-sdk.js"></script>
```

This makes `VoiceSDK` available as a global in the browser.

If you're using a module bundler:

```js
const VoiceSDK = require('./voice-sdk.js');
```

---

## Quick start

```js
const sdk = new VoiceSDK({
  apiKey: 'your_api_key',
  baseUrl: 'http://127.0.0.1:8000', // your backend URL
});

// Speak text out loud
await sdk.speak('Hello, world', 'en');

// Record from the mic, then get a transcript back
await sdk.startListening('en');
// ... user talks ...
const result = await sdk.stopListening();
console.log(result.text); // "hello world"
```

---

## Setup

```js
new VoiceSDK({ apiKey, baseUrl, defaultLanguage })
```

| Option | Required | Default | Description |
|---|---|---|---|
| `apiKey` | Yes | — | Sent as the `x-api-key` header on every request. Must match your backend's configured key. |
| `baseUrl` | No | `http://127.0.0.1:8000` | Base URL of your backend, no trailing slash. |
| `defaultLanguage` | No | `'en'` | Language code used when a method call doesn't specify one. |

Throws a `VoiceSDKError` immediately if `apiKey` is missing.

---

## Methods

### `sdk.speak(text, language?)`

Converts text to speech and plays it immediately through the browser.

```js
const audio = await sdk.speak('Good morning', 'en');
```

- `text` (string, required) — must be non-empty.
- `language` (string, optional) — defaults to `defaultLanguage`.
- Returns the `HTMLAudioElement` that's playing, in case you want to pause it, listen for `ended`, etc.
- Throws `VoiceSDKError` if the request fails.

### `sdk.transcribe(audioBlob, language?)`

Sends an audio `Blob` you already have (e.g. from a file input) to the backend and returns the transcript. Use this when you're not recording live from the mic — for live mic input, use `startListening`/`stopListening` instead.

```js
const result = await sdk.transcribe(myAudioBlob, 'am');
// { text: '...', language: 'am', confidence: 0.97 }
```

- `audioBlob` (Blob, required)
- `language` (string, optional) — defaults to `defaultLanguage`.
- Returns `{ text, language, confidence }`.

### `sdk.startListening(language?)`

Requests microphone access and starts recording. Triggers the browser's mic permission prompt the first time it's called.

```js
await sdk.startListening('en');
```

- Throws `VoiceSDKError` if already listening — call `stopListening()` first.

### `sdk.stopListening()`

Stops the current recording, releases the microphone, sends the audio to the backend, and returns the transcript. Must be called after `startListening()`.

```js
const result = await sdk.stopListening();
```

- Returns the same shape as `transcribe()`: `{ text, language, confidence }`.
- Throws `VoiceSDKError` if not currently listening.

### `sdk.getActiveStream()`

Returns the raw `MediaStream` currently being recorded, or `null` if not listening. Useful if you want to build your own audio visualization (waveform, volume meter) without requesting microphone access a second time.

```js
const stream = sdk.getActiveStream();
```

---

## Error handling

Every method throws a `VoiceSDKError` on failure — a normal `Error` with an extra `.status` field when the failure came from the backend (matching the HTTP status code).

```js
try {
  await sdk.speak('Hello', 'en');
} catch (err) {
  console.error(err.message);   // human-readable detail
  console.error(err.status);    // e.g. 401, 422, 500 — undefined for client-side errors
}
```

Common causes:

| Status | Likely cause |
|---|---|
| `401` | Missing or incorrect `apiKey` |
| `422` | Missing/invalid `text`, `language`, or `audio` field |
| `500` | Backend-side error — check server logs |
| *(no status)* | Browser-side issue, e.g. mic permission denied, or calling `stopListening()` without `startListening()` first |

---

## Browser support notes

- Requires `MediaRecorder` and `getUserMedia` — supported in current Chrome, Edge, and Firefox. Safari support varies by version.
- Microphone access requires either `https://` or `http://localhost` — it will not work over a plain `http://` connection to a non-localhost address.
- `speak()` calls `audio.play()`, which some browsers block until the user has interacted with the page at least once (autoplay policy). Calling it from a click handler, as in the examples above, avoids this.

---

## License

Internal project SDK — license terms to be finalized before any public release.
