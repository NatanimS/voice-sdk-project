# Multilingual Voice SDK

A reusable JavaScript SDK that adds voice capabilities — Speech-to-Text,
Text-to-Speech, voice commands, and intent recognition — to any website,
with first-class support for **English and Amharic**.

Works as both a `<script>` tag and an npm package. English uses the
browser's native Web Speech API (free, zero backend cost); Amharic is
powered by a Python/FastAPI backend.

## Features

- Real-time speech-to-text and text-to-speech
- English + Amharic language support
- Voice command registration (`sdk.registerCommand()`)
- Basic intent recognition (rule-based)
- Built-in "assistant" mode
- Visual state feedback hooks (idle / listening / processing / speaking)

## Quick Start

```javascript
const sdk = new VoiceSDKBundle.VoiceSDK({ apiKey: "your-api-key" });

sdk.onResult((result) => console.log(result.text));
sdk.startListening();
```

## Amharic Speech Support — Current Status

- **Text-to-Speech (TTS):** Uses a self-hosted, open-source model
  ([Meta's MMS](https://huggingface.co/facebook/mms-tts-amh)) rather than a
  commercial cloud provider. This was chosen as a free, no-signup alternative
  while Azure Speech Services access is pending (see Known Limitations
  below). Quality is solid for common, tested phrases, but can vary for
  longer or less common sentences — a known limitation of small models for
  low-resource languages like Amharic.
- **Speech-to-Text (STT):** Currently uses a mock provider that returns a
  fixed sample response, since self-hosting a comparable Amharic ASR model
  (~29GB, 1B parameters) isn't practical for this project's scale. Real
  Amharic STT is planned once Azure Speech Services access is available.
- **Architecture note:** Both STT and TTS are built behind a swappable
  `SpeechProvider` interface, so upgrading either to a production-grade
  provider (e.g. Azure) requires no changes to the API routes, SDK, or any
  other part of the system — just a new provider implementation.

## Project Structure

## Tech Stack

- **SDK:** TypeScript, bundled with tsup (ESM + IIFE)
- **Backend:** Python, FastAPI, SQLAlchemy (SQLite for dev)
- **Speech:** Meta MMS (self-hosted, Amharic TTS), mock provider (STT)

## Known Limitations

- Amharic STT is mocked, not live (see above)
- Amharic TTS quality varies by phrase — see the status note above
- No per-developer API keys yet (single shared key for now)
- CORS is intentionally open (`*`) since this SDK is meant to be embeddable
  on any website; the API key is the actual access control

## License

TBD