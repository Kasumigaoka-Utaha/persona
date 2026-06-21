from __future__ import annotations

import asyncio
import json
import re
from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import AnalysisJob, AnalysisResult, AudienceDefinition
from app.schemas import JuryReportPayload
from app.services.aggregation import build_comparison_table, summarize_conclusion


class PredictionError(RuntimeError):
    pass


SYSTEM_PROMPT = """
你是“用户实时陪审团”的 AI 分析器。你只能基于给定文档模块和用户群行为特征做方向性判断。
必须遵守：
1. 先写行为判断，再写风险评级。
2. 风险只允许输出 red / yellow / green，对应 CTR / UV / PV。
3. 不允许输出任何优化建议、行动建议、实验建议、具体数值、百分比或 baseline。
4. 语言必须具体，使用“可能/倾向于/更容易/较难”等表述。
5. 所有输出必须是合法 JSON，且字段完整。
""".strip()


class PredictionService:
    def __init__(self, db: Session):
        self.db = db
        self.settings = get_settings()

    async def run_analysis_job(self, job_id: int) -> None:
        job = self.db.get(AnalysisJob, job_id)
        if not job:
            return
        job.status = "running"
        job.stage = "document_parsing"
        job.started_at = datetime.utcnow()
        job.error_message = None
        job.model_name = self.settings.default_model
        self.db.commit()

        try:
            payload = self._build_payload(job)
            job.stage = "module_analysis"
            self.db.commit()
            module_reports = await self._analyze_modules(payload)
            comparison_table, divergence_items = build_comparison_table(module_reports)
            conclusion = summarize_conclusion(module_reports, divergence_items)
            result_payload = JuryReportPayload(
                report_meta={
                    "document_title": job.document_title,
                    "analyzed_at": datetime.now(timezone.utc),
                    "audiences": [audience["name"] for audience in payload["audiences"]],
                    "scope_note": "基于当前文档模块与所选用户群进行方向性判断，不代表真实线上结果。",
                },
                modules=module_reports,
                comparison_table=comparison_table,
                high_divergence_modules=divergence_items,
                conclusion=conclusion,
                confidence_notes=[
                    "该报告仅用于评审与答辩辅助，不代表真实用户反馈。",
                    "如文档对关键交互描述不足，相关模块的判断置信度会下降。",
                ],
            )
            if job.result:
                job.result.result_json = result_payload.model_dump(mode="json")
            else:
                self.db.add(AnalysisResult(analysis_job_id=job.id, result_json=result_payload.model_dump(mode="json")))
            job.status = "succeeded"
            job.stage = "completed"
            job.finished_at = datetime.utcnow()
            self.db.commit()
        except Exception as exc:
            job.status = "failed"
            job.stage = "failed"
            job.error_message = str(exc)
            job.finished_at = datetime.utcnow()
            self.db.commit()

    def _build_payload(self, job: AnalysisJob) -> dict[str, Any]:
        modules = self._split_modules(job.document_content)
        audiences = self._load_audiences(job.selected_audience_keys, job.manual_audiences_json)
        return {
            "job": {
                "id": job.id,
                "document_title": job.document_title,
                "host": job.host,
                "source_mode": job.source_mode,
            },
            "modules": modules,
            "audiences": audiences,
        }

    def _load_audiences(self, keys: list[str], manual_items: list[dict[str, Any]]) -> list[dict[str, Any]]:
        audiences: list[dict[str, Any]] = []
        if keys:
            stmt = select(AudienceDefinition).where(AudienceDefinition.key.in_(keys)).order_by(AudienceDefinition.id)
            audience_rows = list(self.db.scalars(stmt))
            row_lookup = {row.key: row for row in audience_rows}
            for key in keys:
                row = row_lookup.get(key)
                if not row:
                    continue
                audiences.append(
                    {
                        "key": row.key,
                        "name": row.name,
                        "definition": row.definition,
                        "behavior_summary": row.behavior_summary,
                        "source": row.source,
                    }
                )
        for index, item in enumerate(manual_items):
            audiences.append(
                {
                    "key": f"manual_{index + 1}",
                    "name": item["name"],
                    "definition": item["definition"],
                    "behavior_summary": {
                        "conversion_trait": item["conversion_trait"],
                        "dwell_trait": item["dwell_trait"],
                        "dropoff_points": item["dropoff_points"],
                        "content_preferences": item["content_preferences"],
                    },
                    "source": "manual",
                }
            )
        if not audiences:
            raise PredictionError("No audiences available")
        return audiences

    def _split_modules(self, content: str) -> list[dict[str, str]]:
        lines = content.splitlines()
        modules: list[dict[str, str]] = []
        current_title: str | None = None
        current_body: list[str] = []
        excluded_titles = ("文档信息", "附录", "里程碑计划", "版本规划", "跨团队协作需求")

        def flush() -> None:
            nonlocal current_title, current_body
            text = "\n".join(line for line in current_body if line.strip()).strip()
            if current_title and text and not any(excluded in current_title for excluded in excluded_titles):
                modules.append(
                    {
                        "module_key": self._slugify(current_title),
                        "module_title": current_title,
                        "module_summary": text[:300],
                        "module_text": text[:3000],
                    }
                )
            current_title = None
            current_body = []

        for line in lines:
            stripped = line.strip()
            if re.match(r"^#{2,3}\s+", stripped):
                flush()
                current_title = re.sub(r"^#{2,3}\s+", "", stripped)
            elif stripped:
                current_body.append(stripped)
        flush()

        if not modules:
            paragraphs = [part.strip() for part in re.split(r"\n\s*\n", content) if part.strip()]
            for idx, paragraph in enumerate(paragraphs[:6], start=1):
                modules.append(
                    {
                        "module_key": f"module_{idx}",
                        "module_title": f"模块 {idx}",
                        "module_summary": paragraph[:300],
                        "module_text": paragraph[:3000],
                    }
                )
        return modules[:8]

    def _slugify(self, text: str) -> str:
        normalized = re.sub(r"[^\w\u4e00-\u9fff]+", "_", text).strip("_").lower()
        return normalized or "module"

    async def _analyze_modules(self, payload: dict[str, Any]) -> list[dict[str, Any]]:
        module_reports: list[dict[str, Any]] = []
        for module in payload["modules"]:
            audience_results = []
            for audience in payload["audiences"]:
                result = await self._analyze_module_audience(payload["job"], module, audience)
                audience_results.append(result)
            module_reports.append(
                {
                    "module_key": module["module_key"],
                    "module_title": module["module_title"],
                    "module_summary": module["module_summary"],
                    "audience_results": audience_results,
                }
            )
        return module_reports

    async def _analyze_module_audience(
        self,
        job_meta: dict[str, Any],
        module: dict[str, str],
        audience: dict[str, Any],
    ) -> dict[str, Any]:
        prompt = {
            "document": job_meta,
            "module": module,
            "audience": audience,
            "goal": "输出该用户群在当前模块上的行为判断与 CTR/UV/PV 风险等级，不要给建议或数字。",
            "schema": {
                "audience_key": "string",
                "audience_name": "string",
                "behavior": {
                    "will_do": "string",
                    "get_stuck_at": "string",
                    "wont_do": "string",
                },
                "risk_ratings": {
                    "ctr": "red|yellow|green",
                    "uv": "red|yellow|green",
                    "pv": "red|yellow|green",
                },
                "risk_reason": "string",
            },
        }
        fallback = self._fallback_module_audience(module, audience)
        result = await self._generate_json(prompt, fallback)
        return self._sanitize_result(result, fallback)

    async def _generate_json(self, prompt: dict[str, Any], fallback: dict[str, Any]) -> dict[str, Any]:
        try:
            return await self._call_model(prompt)
        except Exception:
            return fallback

    async def _call_model(self, prompt: dict[str, Any]) -> dict[str, Any]:
        api_key = self.settings.openai_api_key
        if not api_key:
            raise PredictionError("Missing API key for model request")
        base_url = self.settings.openai_base_url.rstrip("/")
        payload = {
            "model": self.settings.default_model,
            "temperature": 0.2,
            "max_tokens": 900,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": json.dumps(prompt, ensure_ascii=False)},
            ],
        }
        async with httpx.AsyncClient(timeout=self.settings.request_timeout_seconds) as client:
            response = await client.post(
                f"{base_url}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
        content = data["choices"][0]["message"]["content"]
        return json.loads(content)

    def _sanitize_result(self, result: dict[str, Any], fallback: dict[str, Any]) -> dict[str, Any]:
        if any(key in result for key in ("recommendations", "experiment_hypotheses", "metric_predictions")):
            return fallback
        risk_ratings = result.get("risk_ratings") or {}
        allowed = {"red", "yellow", "green"}
        if {risk_ratings.get("ctr"), risk_ratings.get("uv"), risk_ratings.get("pv")} - allowed:
            return fallback
        text_blob = json.dumps(result, ensure_ascii=False)
        if re.search(r"\d+\s*%", text_blob):
            return fallback
        return result

    def _fallback_module_audience(self, module: dict[str, str], audience: dict[str, Any]) -> dict[str, Any]:
        text = module["module_text"]
        low_patience = "耐心" in audience["name"] or "快速" in audience["name"]
        high_trust = "信任" in audience["name"]
        report_focus = any(keyword in text for keyword in ("风险", "说明", "依据", "真实"))
        ctr = "yellow"
        uv = "yellow"
        pv = "yellow"
        will_do = f"{audience['name']} 可能会先快速扫过该模块，优先寻找是否存在与自己决策直接相关的价值点。"
        stuck = "如果模块表达层级不清晰，用户会在理解价值前停下来犹豫。"
        wont = "不会主动投入较长时间去自行补全功能逻辑。"
        reason = "该模块需要用户先理解结构和价值，认知成本会直接影响点击与继续浏览。"

        if low_patience:
            ctr = "red"
            will_do = f"{audience['name']} 倾向于只看第一屏最强信号，若入口或标题足够直白，才可能继续点击。"
            stuck = "一旦首屏信息稍显复杂，就容易在尚未理解价值前离开。"
            wont = "不会逐段阅读来理解复杂逻辑。"
            reason = "该用户群对理解成本极其敏感，首屏语义是否直达会显著影响 CTR。"
        if high_trust:
            uv = "red" if not report_focus else "yellow"
            pv = "yellow" if report_focus else "red"
            will_do = f"{audience['name']} 会先验证该模块的信息是否可信、是否有依据，再决定是否继续深入浏览。"
            stuck = "若模块只给结论不给依据，用户会在信任建立前停住。"
            wont = "不会在缺少真实依据时直接接受结论。"
            reason = "该用户群更关注可信度与可验证性，信任不足时 UV/PV 会受到影响。"
        if any(keyword in text for keyword in ("对比", "多用户群", "模块")):
            uv = "green" if not low_patience else uv
            pv = "green" if report_focus and not low_patience else pv
            will_do = f"{audience['name']} 更容易沿着模块化结构继续看下去，尤其会关注与自己相关的对比信息。"
            reason = "模块结构较清晰时，用户更容易理解分析范围并继续浏览更多内容。"
        return {
            "audience_key": audience["key"],
            "audience_name": audience["name"],
            "behavior": {
                "will_do": will_do,
                "get_stuck_at": stuck,
                "wont_do": wont,
            },
            "risk_ratings": {"ctr": ctr, "uv": uv, "pv": pv},
            "risk_reason": reason,
        }


async def schedule_analysis_job(job_id: int, session_factory) -> None:
    await asyncio.sleep(0.1)
    db = session_factory()
    try:
        service = PredictionService(db)
        await service.run_analysis_job(job_id)
    finally:
        db.close()
