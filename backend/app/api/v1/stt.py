"""
POST /api/v1/stt
"""

import time

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.core.auth import verify_api_key
from app.db.database import get_db
from app.models.request_log import RequestLog
from app.schemas.speech import STTResponse
from app.services.mock_speech import MockSpeechProvider

router = APIRouter()
provider = MockSpeechProvider()


@router.post("/stt", response_model=STTResponse, dependencies=[Depends(verify_api_key)])
async def speech_to_text(
    audio: UploadFile = File(...),
    language: str = Form(...),
    db: Session = Depends(get_db),
):
    start = time.time()
    try:
        audio_bytes = await audio.read()
        result = provider.transcribe(audio_bytes, language)

        latency_ms = int((time.time() - start) * 1000)
        db.add(RequestLog(
            endpoint="stt", language=language, success=True, latency_ms=latency_ms,
        ))
        db.commit()

        return result
    except Exception as e:
        db.add(RequestLog(
            endpoint="stt", language=language, success=False, error_message=str(e),
        ))
        db.commit()
        raise