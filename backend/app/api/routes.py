from __future__ import annotations

import asyncio
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.constants import DEMO_DOCUMENT_FALLBACK
from app.database import SessionLocal, get_db
from app.models import AnalysisJob, AnalysisResult, AudienceDefinition, EventLog
from app.schemas import (
    AnalysisJobRead,
    AnalysisRunRequest,
    AudienceDefinitionRead,
    DemoDocumentResponse,
    EventLogCreate,
    ReportResponse,
)
from app.services.prediction import schedule_analysis_job
from app.services.reports import render_markdown_report

router = APIRouter(prefix="/api")


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/demo/document", response_model=DemoDocumentResponse)
def get_demo_document() -> DemoDocumentResponse:
    doc_path = Path(__file__).resolve().parents[3] / "用户实时陪审团_PRD_副本.md"
    content = DEMO_DOCUMENT_FALLBACK
    if doc_path.exists():
        content = doc_path.read_text(encoding="utf-8", errors="ignore")
    return DemoDocumentResponse(title="用户实时陪审团_PRD_副本", content=content, host="mock_feishu")


@router.get("/audiences", response_model=list[AudienceDefinitionRead])
def get_audiences(db: Session = Depends(get_db)) -> list[AudienceDefinition]:
    stmt = select(AudienceDefinition).where(AudienceDefinition.is_active.is_(True)).order_by(AudienceDefinition.id)
    return list(db.scalars(stmt))


@router.post("/analysis/run", response_model=AnalysisJobRead)
def run_analysis(
    payload: AnalysisRunRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> AnalysisJob:
    selected_keys = list(dict.fromkeys(payload.selected_audience_keys))
    if not selected_keys and not payload.manual_audiences:
        raise HTTPException(status_code=400, detail="请至少选择一个用户群")
    if len(selected_keys) + len(payload.manual_audiences) > 5:
        raise HTTPException(status_code=400, detail="最多支持 5 个用户群")
    if len(payload.document.content.strip()) < 20:
        raise HTTPException(status_code=400, detail="当前文档内容不足，建议补充核心方案后再分析")

    known_keys = {
        row[0]
        for row in db.execute(
            select(AudienceDefinition.key).where(AudienceDefinition.key.in_(selected_keys))
        ).all()
    }
    missing = [key for key in selected_keys if key not in known_keys]
    if missing:
        raise HTTPException(status_code=400, detail=f"未知用户群: {', '.join(missing)}")

    safe_run_config = {"source_mode": payload.document.source_mode, "host": payload.document.host}
    job = AnalysisJob(
        status="queued",
        stage="queued",
        document_title=payload.document.title,
        document_content=payload.document.content,
        host=payload.document.host,
        source_mode=payload.document.source_mode,
        selected_audience_keys=selected_keys,
        manual_audiences_json=[item.model_dump() for item in payload.manual_audiences],
        run_config=safe_run_config,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    background_tasks.add_task(schedule_analysis_job, job.id, SessionLocal)
    return _serialize_job(db, job.id)


@router.get("/analysis/{job_id}", response_model=AnalysisJobRead)
def get_analysis(job_id: int, db: Session = Depends(get_db)) -> AnalysisJobRead:
    return _serialize_job(db, job_id)


@router.get("/reports/{job_id}/markdown", response_model=ReportResponse)
def export_report(job_id: int, db: Session = Depends(get_db)) -> ReportResponse:
    job = _get_job(db, job_id)
    return ReportResponse(markdown=render_markdown_report(job))


@router.post("/events")
def create_event(payload: EventLogCreate, db: Session = Depends(get_db)) -> dict[str, bool]:
    db.add(EventLog(event_name=payload.event_name, payload=payload.payload))
    db.commit()
    return {"ok": True}


async def _noop() -> None:
    await asyncio.sleep(0)


def _get_job(db: Session, job_id: int) -> AnalysisJob:
    stmt = (
        select(AnalysisJob)
        .options(selectinload(AnalysisJob.result))
        .where(AnalysisJob.id == job_id)
    )
    job = db.scalar(stmt)
    if not job:
        raise HTTPException(status_code=404, detail="Analysis job not found")
    return job


def _serialize_job(db: Session, job_id: int) -> AnalysisJobRead:
    job = _get_job(db, job_id)
    result = job.result.result_json if job.result else None
    return AnalysisJobRead(
        id=job.id,
        status=job.status,
        stage=job.stage,
        error_message=job.error_message,
        model_name=job.model_name,
        host=job.host,
        source_mode=job.source_mode,
        document_title=job.document_title,
        started_at=job.started_at,
        finished_at=job.finished_at,
        created_at=job.created_at,
        updated_at=job.updated_at,
        result=result,
    )
