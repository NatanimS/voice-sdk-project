# Voice SDK — English & Amharic Voice for the Web

A lightweight JavaScript SDK that adds speech-to-text, text-to-speech, voice
commands, and basic intent recognition to any website — with first-class
support for **English** and **Amharic**. Drop it in as a `<script>` tag or
install it from npm; no build step required to get started.

**Live demo:** run `demo/index.html` locally (see [Quick Start](#quick-start)) — it's wired to the live backend and CDN below.
**Backend (live):** https://voice-sdk-project.onrender.com
**Package (live):** [`@natanims/voice-sdk`](https://www.npmjs.com/package/@natanims/voice-sdk) on npm / jsDelivr

---

## Features

- 🎙️ **Speech-to-text** — English via the browser's native Web Speech API (free, zero backend), Amharic via a backend endpoint
- 🔊 **Text-to-speech** — English via the browser, Amharic via a self-hosted [Meta MMS](https://huggingface.co/facebook/mms-tts-amh) model
- 🗣️ **Voice commands** — register a phrase and a handler, no extra setup
- 🧠 **Basic intent recognition** — rule-based keyword matching on transcribed text
- 🤖 **Assistant mode** — a convenience wrapper around listen/speak for simple "always-on" voice interactions
- 📦 **Two ways to install** — npm package (ESM) or a single `<script>` tag (UMD/IIFE), same API either way
- 🌍 **Built to extend** — new languages plug in via a provider interface; Afaan Oromo is planned next (see [Roadmap](#roadmap))

---

## Quick Start

### Option A — Script tag (fastest)

```html
<script src="https://cdn.jsdelivr.net/npm/@natanims/voice-sdk/dist/index.global.js"></script>
<script>
  const sdk = new VoiceSDK({
    apiKey: "YOUR_API_KEY",
    backendUrl: "https://voice-sdk-project.onrender.com",
    defaultLanguage: "en",
  });

  sdk.onResult((result) => console.log("Heard:", result.text));
  sdk.onStateChange((state) => console.log("State:", state));

  sdk.startListening();       // start listening (mic permission prompt)
  sdk.speak("Hello there!");  // speak text back
</script>
```

### Option B — npm

```bash
npm install @natanims/voice-sdk
```

```javascript
import { VoiceSDK } from "@natanims/voice-sdk";

const sdk = new VoiceSDK({
  apiKey: "YOUR_API_KEY",
  backendUrl: "https://voice-sdk-project.onrender.com",
});

sdk.registerCommand("stop", () => sdk.stopListening());
sdk.assistant.start();
```

### Running the demo locally

```bash
cd demo
python -m http.server 5500
# open http://localhost:5500
```

The demo page already points at the live Render backend and jsDelivr CDN
build, so no local backend setup is required just to try it out.

> **Note on Render free tier:** the backend spins down after inactivity.
> The first request after a period of idleness can take 30–90+ seconds
> ("cold start") — this is expected, not a bug.

---

## SDK API

```typescript
interface VoiceSDKConfig {
  apiKey: string;
  backendUrl?: string;               // defaults to http://localhost:8000
  defaultLanguage?: "en" | "am" | "auto";
}

class VoiceSDK {
  constructor(config: VoiceSDKConfig);
  startListening(options?: { language?: "en" | "am" }): Promise<void>;
  stopListening(): void;
  speak(text: string, options?: { language?: "en" | "am" }): Promise<void>;
  onResult(callback: (result: RecognitionResult) => void): void;
  onStateChange(callback: (state: SDKState) => void): void;
  onError(callback: (error: { message: string; code: string }) => void): void;
  registerCommand(phrase: string, handler: (matchedText: string) => void): void;
  assistant: { start(language?: "en" | "am"): void; stop(): void };
}

type SDKState = "idle" | "listening" | "processing" | "speaking" | "error";

interface RecognitionResult {
  text: string;
  language: "en" | "am";
  intent?: string;
  entities?: Record<string, string>;
}
```

**Design notes:**
- English requests never touch the backend — they use the browser's native
  Web Speech API directly (free, lowest latency).
- Amharic requests go through the backend, since no reliable browser-native
  option exists for it yet.
- `registerCommand` does a simple case-insensitive substring match against
  transcribed text; all matching handlers fire.
- `assistant` is a thin convenience wrapper over `startListening`/`stopListening`
  — not a separate engine.

---

## Backend API

All routes are prefixed `/api/v1/` and require an `X-API-Key` header.

| Method | Route | Body | Response |
|---|---|---|---|
| POST | `/stt` | `multipart/form-data: { audio, language }` | `{ text, language, confidence }` |
| POST | `/tts` | `JSON: { text, language }` | audio binary stream |
| POST | `/intent` | `JSON: { text, language }` | `{ intent, entities, confidence }` |
| GET | `/health` | — | `{ status: "ok" }` |

Backend is built with **FastAPI**, logs request metadata (endpoint, language,
success, latency) to SQLite for observability, and **never stores raw audio**
— privacy by design.

---

## Architecture

```
Browser (SDK)
   ├── English → Web Speech API (native, free, no backend call)
   └── Amharic → FastAPI backend → speech provider
                                      ├── STT: MockSpeechProvider (see Known Limitations)
                                      └── TTS: self-hosted Meta MMS model
```

Speech providers implement a common `SpeechProvider` interface
(`transcribe()`, `synthesize()`), so providers can be swapped — mock, MMS,
Azure, or any future provider — without touching routes, the SDK, or any
other part of the system. This was proven in practice: the MMS TTS
integration required exactly one new file and a one-line change to wire it in.

---

## Known Limitations

- **Amharic speech-to-text is currently mocked**, not real ASR. Azure Speech
  Services (the original plan) requires a non-prepaid card for signup, which
  wasn't available. A self-hostable Amharic ASR model was evaluated (Meta
  MMS `mms-1b-all`) but ruled out as impractical (~29GB download, 1B
  parameters). [WhisperAPI.com](https://whisperapi.com) claims a free,
  no-card Amharic STT tier — untested here, worth evaluating next.
- **Amharic text-to-speech is real** (self-hosted Meta MMS), confirmed
  working end-to-end in production.
- **Afaan Oromo is not yet supported.** The architecture supports adding it
  via the same provider pattern used for Amharic, but it hasn't been built.
- **Auth is a single shared API key**, not per-developer keys — sufficient
  for this stage, not production-multi-tenant-ready.
- **Render free tier cold starts** add 30–90+ seconds of latency to the
  first request after inactivity.

---

## Tech Stack

| Layer | Choice |
|---|---|
| SDK | TypeScript, bundled with `tsup` (ESM + UMD/IIFE) |
| Audio capture | Browser `MediaRecorder` API |
| Backend | Python, FastAPI, SQLAlchemy, SQLite |
| Amharic TTS | Self-hosted `facebook/mms-tts-amh` (Meta MMS, via `transformers`/`torch`) |
| Hosting | Backend on Render (free tier); SDK on npm + jsDelivr CDN |

---

## Roadmap

- [ ] Real Amharic speech-to-text (evaluate WhisperAPI.com or an alternative provider)
- [ ] Afaan Oromo support (Phase 2 — architecture ready, not built)
- [ ] Per-developer API keys
- [ ] Automatic language detection endpoint
- [ ] Pin exact versions for `torch`/`transformers`/`scipy`/`uroman` before any further production hardening

---

## License

MIT
