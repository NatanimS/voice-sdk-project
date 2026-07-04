"""
Simple API key authentication.

Every protected endpoint requires an "X-API-Key" header matching
BACKEND_API_KEY from our .env file. This is intentionally simple for
now, per our Phase 3 decision - not per-developer keys yet, just one
shared key for local development.
"""

from fastapi import Header, HTTPException, status

from app.core.config import settings


def verify_api_key(x_api_key: str = Header(...)):
    """
    A FastAPI dependency. Any route that includes
    `Depends(verify_api_key)` will automatically reject requests
    that don't send a matching X-API-Key header.
    """
    if x_api_key != settings.backend_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key",
        )