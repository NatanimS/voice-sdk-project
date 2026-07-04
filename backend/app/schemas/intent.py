"""
Pydantic schemas for the /api/v1/intent endpoint.
"""

from typing import Dict, Optional
from pydantic import BaseModel


class IntentRequest(BaseModel):
    text: str
    language: str


class IntentResponse(BaseModel):
    intent: str
    entities: Dict[str, str]
    confidence: float