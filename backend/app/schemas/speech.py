"""
Pydantic schemas defining the exact shape of our STT/TTS requests
and responses, matching the API design from Phase 4.
"""

from pydantic import BaseModel


class STTResponse(BaseModel):
    text: str
    language: str
    confidence: float


class TTSRequest(BaseModel):
    text: str
    language: str