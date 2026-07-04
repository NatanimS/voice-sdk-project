"""
POST /api/v1/intent
"""

import time

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import verify_api_key
from app.db.database import get_db
from app.models.request_log import RequestLog
from app.schemas.intent import IntentRequest, IntentResponse
from app.services.intent_engine import recognize_intent

router = APIRouter()


@router.post("/intent", response_model=IntentResponse, dependencies=[Depends(verify_api_key)])
def get_intent(payload: IntentRequest, db: Session = Depends(get_db)):
    start = time.time()
    try:
        result = recognize_intent(payload.text, payload.language)

        latency_ms = int((time.time() - start) * 1000)
        db.add(RequestLog(
            endpoint="intent", language=payload.language, success=True, latency_ms=latency_ms,
        ))
        db.commit()

        return result
    except Exception as e:
        db.add(RequestLog(
            endpoint="intent", language=payload.language, success=False, error_message=str(e),
        ))
        db.commit()
        raise