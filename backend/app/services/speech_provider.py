"""
The abstract interface every speech provider must implement.

This is the core of our Adapter pattern (Phase 2): the rest of the
app only ever talks to THIS interface, never to a specific provider
directly. Swapping MockSpeechProvider for AzureSpeechProvider later
means writing one new file - nothing else in the app changes.
"""

from abc import ABC, abstractmethod


class SpeechProvider(ABC):
    @abstractmethod
    def transcribe(self, audio_bytes: bytes, language: str) -> dict:
        """
        Takes raw audio bytes, returns a dict like:
        {"text": "...", "language": "am", "confidence": 0.91}
        """
        raise NotImplementedError

    @abstractmethod
    def synthesize(self, text: str, language: str) -> bytes:
        """
        Takes text, returns raw audio bytes (playable audio).
        """
        raise NotImplementedError