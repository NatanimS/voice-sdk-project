"""
FastAPI application entry point.

Run this with:  uvicorn app.main:app --reload
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.database import Base, engine
from app.api.v1 import health, stt, tts
from app.models import request_log  # noqa: F401

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(stt.router, prefix="/api/v1", tags=["speech"])
app.include_router(tts.router, prefix="/api/v1", tags=["speech"])


@app.get("/")
def root():
    return {"message": f"{settings.app_name} is running. See /docs for API documentation."}