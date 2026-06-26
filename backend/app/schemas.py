from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


RiskGrade = Literal["red", "yellow", "green"]
DivergenceLevel = Literal["high", "medium"]


class BehaviorSummary(BaseModel):
    conversion_trait: str
    dwell_trait: str
    dropoff_points: list[str]
    content_preferences: list[str]


class AudienceDefinitionRead(BaseModel):
    id: int
    key: str
    name: str
    definition: str
    behavior_summary: BehaviorSummary
    source: str
    is_active: bool

    model_config = {"from_attributes": True}


class ManualAudienceInput(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    definition: str = Field(min_length=1)
    conversion_trait: str = Field(min_length=1)
    dwell_trait: str = Field(min_length=1)
    dropoff_points: list[str] = Field(min_length=1)
    content_preferences: list[str] = Field(min_length=1)


class DocumentInput(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=20)
    host: str = "mock_feishu"
    source_mode: str = "host"


class DemoDocumentResponse(BaseModel):
    title: str
    content: str
    host: str


class ParsedDocumentResponse(BaseModel):
    title: str
    content: str
    host: str
    source_mode: str
    parse_status: str
    needs_manual_content: bool


class LinkParseRequest(BaseModel):
    url: str = Field(min_length=1, max_length=2048)


class AnalysisRunRequest(BaseModel):
    document: DocumentInput
    selected_audience_keys: list[str] = Field(default_factory=list)
    manual_audiences: list[ManualAudienceInput] = Field(default_factory=list)
    selected_metrics: list[str] = Field(default_factory=list)


class BehaviorPrediction(BaseModel):
    will_do: str
    get_stuck_at: str
    wont_do: str


class RiskRatings(BaseModel):
    ctr: RiskGrade
    uv: RiskGrade
    pv: RiskGrade


class MetricScores(BaseModel):
    ctr: int = Field(ge=0, le=100)
    uv: int = Field(ge=0, le=100)
    pv: int = Field(ge=0, le=100)


class AudienceModuleResult(BaseModel):
    audience_key: str
    audience_name: str
    behavior: BehaviorPrediction
    risk_ratings: RiskRatings
    metric_scores: MetricScores = Field(default_factory=lambda: MetricScores(ctr=0, uv=0, pv=0))
    selected_metric_ratings: dict[str, RiskGrade] = Field(default_factory=dict)
    selected_metric_scores: dict[str, int] = Field(default_factory=dict)
    risk_reason: str


class ModuleReport(BaseModel):
    module_key: str
    module_title: str
    module_summary: str
    audience_results: list[AudienceModuleResult]


class ComparisonAudienceCell(BaseModel):
    audience_key: str
    audience_name: str
    overall_risk: RiskGrade


class ComparisonRow(BaseModel):
    module_key: str
    module_title: str
    audiences: list[ComparisonAudienceCell]
    divergence_level: DivergenceLevel | None = None


class DivergenceItem(BaseModel):
    module_key: str
    module_title: str
    divergence_level: DivergenceLevel
    reason: str


class ConclusionSummary(BaseModel):
    high_risk_modules: list[str]
    high_divergence_modules: list[str]
    covered_audiences: list[str]


class ReportMeta(BaseModel):
    document_title: str
    analyzed_at: datetime
    audiences: list[str]
    scope_note: str
    selected_metrics: list[str] = Field(default_factory=list)


class JuryReportPayload(BaseModel):
    report_meta: ReportMeta
    modules: list[ModuleReport]
    comparison_table: list[ComparisonRow]
    high_divergence_modules: list[DivergenceItem]
    conclusion: ConclusionSummary
    confidence_notes: list[str]


class AnalysisJobRead(BaseModel):
    id: int
    status: str
    stage: str
    error_message: str | None
    model_name: str | None
    host: str
    source_mode: str
    document_title: str
    started_at: datetime | None
    finished_at: datetime | None
    created_at: datetime
    updated_at: datetime
    result: JuryReportPayload | None = None


class EventLogCreate(BaseModel):
    event_name: str = Field(min_length=1, max_length=128)
    payload: dict[str, Any] = Field(default_factory=dict)


class ReportResponse(BaseModel):
    markdown: str
