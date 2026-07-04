"""
The request_logs table, exactly as designed in Phase 4.
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func

from app.db.database import Base


class RequestLog(Base):
    __tablename__ = "request_logs"

    id = Column(Integer, primary_key=True, index=True)
    endpoint = Column(String, nullable=False)
    language = Column(String, nullable=False)
    success = Column(Boolean, nullable=False)
    latency_ms = Column(Integer, nullable=True)
    error_message = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())