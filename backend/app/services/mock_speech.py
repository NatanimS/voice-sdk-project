"""
A fake speech provider used until we have real Azure (or another)
credentials. Lets us build and test the entire rest of the system
without being blocked.

transcribe() always returns the same placeholder Amharic phrase.
synthesize() generates a real, short, playable audio tone (a beep) -
not actual speech, but genuinely valid audio, so the full pipeline
(request -> processing -> playable response) is truly proven to work.
"""

import io
import math
import struct
import wave

from app.services.speech_provider import SpeechProvider


class MockSpeechProvider(SpeechProvider):
    def transcribe(self, audio_bytes: bytes, language: str) -> dict:
        return {
            "text": "[MOCK] ሰላም እንደምን ነህ",
            "language": language,
            "confidence": 0.99,
        }

    def synthesize(self, text: str, language: str) -> bytes:
        # Generates a short 440Hz beep tone as a valid .wav file,
        # entirely using Python's standard library.
        sample_rate = 16000
        duration_seconds = 1
        frequency = 440

        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sample_rate)

            num_samples = sample_rate * duration_seconds
            for i in range(num_samples):
                value = int(
                    32767 * math.sin(2 * math.pi * frequency * i / sample_rate)
                )
                wav_file.writeframes(struct.pack("<h", value))

        return buffer.getvalue()