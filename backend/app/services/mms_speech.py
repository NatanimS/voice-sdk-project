import io
import torch
import scipy.io.wavfile
import uroman as ur
from transformers import VitsModel, AutoTokenizer
from app.services.speech_provider import SpeechProvider
from app.services.mock_speech import MockSpeechProvider


class MmsSpeechProvider(SpeechProvider):
    def __init__(self):
        # TTS: real MMS Amharic model
        self._tts_model = VitsModel.from_pretrained("facebook/mms-tts-amh")
        self._tts_tokenizer = AutoTokenizer.from_pretrained("facebook/mms-tts-amh")
        self._uroman = ur.Uroman()

        # STT: no practical self-hosted Amharic ASR yet (see project notes) -
        # delegate to the mock for now so transcribe() still works end-to-end.
        self._mock_stt = MockSpeechProvider()

    def transcribe(self, audio_bytes: bytes, language: str) -> dict:
        return self._mock_stt.transcribe(audio_bytes, language)

    def synthesize(self, text: str, language: str) -> bytes:
        if language != "am":
            # Fall back to mock behavior for non-Amharic requests
            return self._mock_stt.synthesize(text, language)

        romanized = self._uroman.romanize_string(text, lcode="amh")
        inputs = self._tts_tokenizer(romanized, return_tensors="pt")

        with torch.no_grad():
            output = self._tts_model(**inputs).waveform

        audio_array = output.numpy().squeeze()
        audio_int16 = (audio_array * 32767).astype("int16")

        buffer