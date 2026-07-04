"""
POST /api/v1/tts
"""

import time

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.core.auth import verify_api_key
from app.db.database import get_db
from app.models.request_log import RequestLog
from app.schemas.speech import TTSRequest
from app.services.mock_speech import MockSpeechProvider

router = APIRouter()
provider = MockSpeechProvider()


@router.post("/tts", dependencies=[Depends(verify_api_key)])
def text_to_speech(payload: TTSRequest, db: Session = Depends(get_db)):
    start = time.time()
    try:
        audio_bytes = provider.synthesize(payload.text, payload.language)

        latency_ms = int((time.time() - start) * 1000)
        db.add(RequestLog(
            endpoint="tts", language=payload.language, success=True, latency_ms=latency_ms,
        ))
        db.commit()

        return Response(content=audio_bytes, media_type="audio/wav")
    except Exception as e:
        db.add(RequestLog(
            endpoint="tts", language=payload.language, success=False, error_message=str(e),
        ))
        db.commit()
        raise