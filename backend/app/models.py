from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class AudienceDefinition(Base):
    __tablename__ = "audience_definition"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    definition: Mapped[str] = mapped_column(Text, nullable=False)
    behavior_summary: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    source: Mapped[str] = mapped_column(String(32), default="seeded")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class AnalysisJob(Base, TimestampMixin):
    __tablename__ = "analysis_job"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    status: Mapped[str] = mapped_column(String(32), default="queued")
    stage: Mapped[str] = mapped_column(String(64), default="queued")
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    model_name: Mapped[Optional[str]] = mapped_column(String(255))
    host: Mapped[str] = mapped_column(String(64), default="mock_feishu")
    document_title: Mapped[str] = mapped_column(String(255), nullable=False)
    document_content: Mapped[str] = mapped_column(Text, nullable=False)
    source_mode: Mapped[str] = mapped_column(String(32), default="host")
    selected_audience_keys: Mapped[list[str]] = mapped_column(JSON, default=list)
    manual_audiences_json: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    run_config: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    result = relationship(
        "AnalysisResult", back_populates="job", uselist=False, cascade="all, delete-orphan"
    )


class AnalysisResult(Base, TimestampMixin):
    __tablename__ = "analysis_result"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    analysis_job_id: Mapped[int] = mapped_column(
        ForeignKey("analysis_job.id"), nullable=False, unique=True
    )
    result_json: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)

    job = relationship("AnalysisJob", back_populates="result")


class EventLog(Base):
    __tablename__ = "event_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_name: Mapped[str] = mapped_column(String(128), nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
