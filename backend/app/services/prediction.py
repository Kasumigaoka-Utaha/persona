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
3. 允许输出 metric_scores 和 selected_metric_scores，表示 0-100 的风险指数；它不是线上真实百分比，也不是 baseline。
4. 不允许输出任何优化建议、行动建议或实验建议。
5. 语言必须具体，使用“可能/倾向于/更容易/较难”等表述。
6. 所有输出必须是合法 JSON，且字段完整。
""".strip()

DEFAULT_METRICS = ["CTR", "UV", "PV"]


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
            if (job.run_config or {}).get("job_type") == "modification_suggestions":
                await self._run_modification_suggestion_job(job)
                return
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
                    "selected_metrics": payload["selected_metrics"],
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

    async def _run_modification_suggestion_job(self, job: AnalysisJob) -> None:
        job.stage = "suggestion_generation"
        self.db.commit()
        source_job_id = (job.run_config or {}).get("source_analysis_job_id")
        source_job = self.db.get(AnalysisJob, source_job_id) if source_job_id else None
        source_result = source_job.result.result_json if source_job and source_job.result else None
        payload = self._build_payload(job)
        suggestions = await self._generate_modification_suggestions(job, source_result, payload["selected_metrics"])
        fallback_suggestions = self._fallback_modification_suggestions(job, source_result, payload["selected_metrics"])
        audiences = source_result["report_meta"]["audiences"] if source_result else [audience["name"] for audience in payload["audiences"]]
        try:
            modules = suggestions["modules"]
            notes = suggestions["notes"]
            high_risk_modules = suggestions["high_risk_modules"]
            if not modules or not notes:
                raise ValueError("empty modification suggestions")
            result_payload = JuryReportPayload(
                report_meta={
                    "document_title": job.document_title,
                    "analyzed_at": datetime.now(timezone.utc),
                    "audiences": audiences,
                    "selected_metrics": payload["selected_metrics"],
                    "scope_note": "基于快速反馈结果与原始 PRD 内容生成的修改建议。",
                },
                modules=modules,
                comparison_table=[],
                high_divergence_modules=[],
                conclusion={
                    "high_risk_modules": high_risk_modules,
                    "high_divergence_modules": [],
                    "covered_audiences": audiences,
                },
                confidence_notes=notes,
            )
        except Exception:
            result_payload = JuryReportPayload(
                report_meta={
                    "document_title": job.document_title,
                    "analyzed_at": datetime.now(timezone.utc),
                    "audiences": audiences,
                    "selected_metrics": payload["selected_metrics"],
                    "scope_note": "基于快速反馈结果与原始 PRD 内容生成的修改建议。",
                },
                modules=fallback_suggestions["modules"],
                comparison_table=[],
                high_divergence_modules=[],
                conclusion={
                    "high_risk_modules": fallback_suggestions["high_risk_modules"],
                    "high_divergence_modules": [],
                    "covered_audiences": audiences,
                },
                confidence_notes=fallback_suggestions["notes"],
            )
        if job.result:
            job.result.result_json = result_payload.model_dump(mode="json")
        else:
            self.db.add(AnalysisResult(analysis_job_id=job.id, result_json=result_payload.model_dump(mode="json")))
        job.status = "succeeded"
        job.stage = "completed"
        job.finished_at = datetime.utcnow()
        self.db.commit()

    def _build_payload(self, job: AnalysisJob) -> dict[str, Any]:
        modules = self._split_modules(job.document_content)
        audiences = self._load_audiences(job.selected_audience_keys, job.manual_audiences_json)
        selected_metrics = self._load_selected_metrics(job.run_config)
        model_reasoning_effort = self._load_reasoning_effort(job.run_config)
        return {
            "job": {
                "id": job.id,
                "document_title": job.document_title,
                "host": job.host,
                "source_mode": job.source_mode,
            },
            "modules": modules,
            "audiences": audiences,
            "selected_metrics": selected_metrics,
            "model_reasoning_effort": model_reasoning_effort,
        }

    def _load_selected_metrics(self, run_config: dict[str, Any] | None) -> list[str]:
        values = (run_config or {}).get("selected_metrics") or DEFAULT_METRICS
        metrics: list[str] = []
        for value in values:
            text = str(value).strip()
            if text and text not in metrics:
                metrics.append(text[:40])
        return metrics or DEFAULT_METRICS

    def _load_reasoning_effort(self, run_config: dict[str, Any] | None) -> str:
        value = str((run_config or {}).get("model_reasoning_effort") or "medium").strip().lower()
        return value if value in {"low", "medium", "high"} else "medium"

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
                        "module_title": f"模块{idx}：{self._module_topic(paragraph)}",
                        "module_summary": paragraph[:300],
                        "module_text": paragraph[:3000],
                    }
                )
        return modules[:8]

    def _module_topic(self, text: str) -> str:
        for line in text.splitlines():
            candidate = line.strip()
            if not candidate:
                continue
            candidate = re.sub(r"^#{1,6}\s*", "", candidate)
            candidate = re.sub(r"^[-*+]\s*", "", candidate)
            candidate = re.sub(r"^\d+[\.\)、)]\s*", "", candidate)
            candidate = re.sub(r"[*_`>|#]", "", candidate).strip()
            if not candidate:
                continue
            candidate = re.split(r"[：:。；;，,\n]", candidate, maxsplit=1)[0].strip()
            if candidate:
                return candidate[:18]
        compact = re.sub(r"\s+", "", text)
        return compact[:18] or "内容概览"

    def _slugify(self, text: str) -> str:
        normalized = re.sub(r"[^\w\u4e00-\u9fff]+", "_", text).strip("_").lower()
        return normalized or "module"

    async def _analyze_modules(self, payload: dict[str, Any]) -> list[dict[str, Any]]:
        module_reports: list[dict[str, Any]] = []
        for module in payload["modules"]:
            audience_results = []
            for audience in payload["audiences"]:
                result = await self._analyze_module_audience(payload["job"], module, audience, payload["selected_metrics"], payload["model_reasoning_effort"])
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
        selected_metrics: list[str],
        model_reasoning_effort: str,
    ) -> dict[str, Any]:
        prompt = {
            "document": job_meta,
            "module": module,
            "audience": audience,
            "selected_metrics": selected_metrics,
            "goal": "输出该用户群在当前模块上的行为判断、CTR/UV/PV 兼容风险，以及所选观察指标的风险等级和 0-100 风险指数，不要给建议。",
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
                "metric_scores": {
                    "ctr": "0-100 integer risk index, not real CTR percentage",
                    "uv": "0-100 integer risk index, not real UV percentage",
                    "pv": "0-100 integer risk index, not real PV percentage",
                },
                "selected_metric_ratings": "object keyed by selected_metrics, each value red|yellow|green",
                "selected_metric_scores": "object keyed by selected_metrics, each value 0-100 integer risk index",
                "risk_reason": "string",
            },
        }
        fallback = self._fallback_module_audience(module, audience, selected_metrics)
        result = await self._generate_json(prompt, fallback, model_reasoning_effort)
        return self._sanitize_result(result, fallback, selected_metrics)

    async def _generate_json(self, prompt: dict[str, Any], fallback: dict[str, Any], model_reasoning_effort: str) -> dict[str, Any]:
        try:
            return await self._call_model(prompt, model_reasoning_effort)
        except Exception:
            return fallback

    async def _call_model(self, prompt: dict[str, Any], model_reasoning_effort: str) -> dict[str, Any]:
        api_key = self.settings.openai_api_key
        if not api_key:
            raise PredictionError("Missing API key for model request")
        base_url = self.settings.openai_base_url.rstrip("/")
        payload = {
            "model": self.settings.default_model,
            "temperature": 0.2,
            "max_tokens": 900,
            "model_reasoning_effort": model_reasoning_effort,
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

    async def _generate_modification_suggestions(self, job: AnalysisJob, source_result: dict[str, Any] | None, selected_metrics: list[str]) -> dict[str, Any]:
        fallback = self._fallback_modification_suggestions(job, source_result, selected_metrics)
        prompt = {
            "document": {
                "title": job.document_title,
                "content": job.document_content[:5000],
            },
            "quick_feedback_result": source_result,
            "selected_metrics": selected_metrics,
            "goal": "基于快速反馈结果和原始 PRD 内容，生成面向 PM 的修改建议。输出 JSON，不要复述完整报告。",
            "schema": {
                "modules": "array of modules, each with module_key/module_title/module_summary/audience_results",
                "high_risk_modules": "array of module titles",
                "notes": "array of concise PM-facing action suggestions",
            },
        }
        try:
            result = await self._call_model(prompt, "medium")
            if not isinstance(result.get("modules"), list) or not isinstance(result.get("notes"), list):
                return fallback
            return {
                "modules": result["modules"][:5],
                "high_risk_modules": [str(item)[:80] for item in result.get("high_risk_modules", [])[:5]],
                "notes": [str(item)[:240] for item in result["notes"][:8]],
            }
        except Exception:
            return fallback

    def _fallback_modification_suggestions(self, job: AnalysisJob, source_result: dict[str, Any] | None, selected_metrics: list[str]) -> dict[str, Any]:
        modules = (source_result or {}).get("modules") or []
        candidates: list[dict[str, Any]] = []
        for module in modules:
            for item in module.get("audience_results", []):
                scores = item.get("selected_metric_scores") or item.get("metric_scores") or {}
                score_values = [value for value in scores.values() if isinstance(value, int)]
                score = max(score_values) if score_values else 50
                candidates.append({"module": module, "item": item, "score": score})
        candidates.sort(key=lambda value: value["score"], reverse=True)
        if not candidates:
            candidates = [{
                "module": {"module_key": "document", "module_title": job.document_title, "module_summary": job.document_content[:200]},
                "item": {
                    "audience_key": "all",
                    "audience_name": "目标用户",
                    "behavior": {"will_do": "会先判断页面价值是否明确", "get_stuck_at": "核心说明不够直接", "wont_do": "不会继续深入理解复杂方案"},
                    "risk_reason": "当前 PRD 需要进一步明确入口价值、用户路径和验证指标。",
                },
                "score": 60,
            }]
        suggestion_modules = []
        notes = []
        high_risk_modules = []
        for index, candidate in enumerate(candidates[:5], start=1):
            module = candidate["module"]
            item = candidate["item"]
            title = module.get("module_title", f"建议项 {index}")
            high_risk_modules.append(title)
            action = f"建议优先调整「{title}」：围绕 {item.get('audience_name', '目标用户')} 的卡点，补充直接价值说明、关键状态反馈和下一步行动入口。"
            notes.append(action)
            suggestion_modules.append({
                "module_key": module.get("module_key", f"suggestion_{index}"),
                "module_title": title,
                "module_summary": action,
                "audience_results": [{
                    "audience_key": item.get("audience_key", "all"),
                    "audience_name": item.get("audience_name", "目标用户"),
                    "behavior": {
                        "will_do": "修改后应能更快判断价值并完成下一步动作。",
                        "get_stuck_at": item.get("behavior", {}).get("get_stuck_at", "核心说明不够直接"),
                        "wont_do": "如果不调整，仍可能跳过或延后决策。",
                    },
                    "risk_ratings": {"ctr": "yellow", "uv": "yellow", "pv": "yellow"},
                    "metric_scores": {"ctr": min(100, candidate["score"]), "uv": min(100, candidate["score"]), "pv": min(100, candidate["score"])},
                    "selected_metric_ratings": {metric: "yellow" for metric in selected_metrics},
                    "selected_metric_scores": {metric: min(100, candidate["score"]) for metric in selected_metrics},
                    "risk_reason": action,
                }],
            })
        return {"modules": suggestion_modules, "high_risk_modules": high_risk_modules, "notes": notes}

    def _sanitize_result(self, result: dict[str, Any], fallback: dict[str, Any], selected_metrics: list[str]) -> dict[str, Any]:
        if any(key in result for key in ("recommendations", "experiment_hypotheses", "metric_predictions")):
            return fallback
        risk_ratings = result.get("risk_ratings") or {}
        allowed = {"red", "yellow", "green"}
        if {risk_ratings.get("ctr"), risk_ratings.get("uv"), risk_ratings.get("pv")} - allowed:
            return fallback
        metric_scores = result.get("metric_scores")
        if not isinstance(metric_scores, dict):
            result["metric_scores"] = fallback["metric_scores"]
        else:
            clean_scores: dict[str, int] = {}
            for metric in ("ctr", "uv", "pv"):
                value = metric_scores.get(metric)
                if not isinstance(value, int) or value < 0 or value > 100:
                    return fallback
                clean_scores[metric] = value
            result["metric_scores"] = clean_scores
        selected_ratings = result.get("selected_metric_ratings")
        if not isinstance(selected_ratings, dict):
            result["selected_metric_ratings"] = fallback["selected_metric_ratings"]
        else:
            clean_ratings: dict[str, str] = {}
            for metric in selected_metrics:
                value = selected_ratings.get(metric)
                clean_ratings[metric] = value if value in allowed else fallback["selected_metric_ratings"][metric]
            result["selected_metric_ratings"] = clean_ratings
        selected_scores = result.get("selected_metric_scores")
        if not isinstance(selected_scores, dict):
            result["selected_metric_scores"] = fallback["selected_metric_scores"]
        else:
            clean_selected_scores: dict[str, int] = {}
            for metric in selected_metrics:
                value = selected_scores.get(metric)
                if not isinstance(value, int) or value < 0 or value > 100:
                    clean_selected_scores[metric] = fallback["selected_metric_scores"][metric]
                else:
                    clean_selected_scores[metric] = value
            result["selected_metric_scores"] = clean_selected_scores
        text_blob = json.dumps(
            {key: value for key, value in result.items() if key not in ("metric_scores", "selected_metric_scores")},
            ensure_ascii=False,
        )
        if re.search(r"\d+\s*%", text_blob):
            return fallback
        return result

    def _score_from_risk(self, risk: str, audience_name: str, module_text: str) -> int:
        base = {"green": 20, "yellow": 55, "red": 85}[risk]
        if any(keyword in audience_name for keyword in ("低耐心", "快速", "冲动", "沉默")):
            base += 6
        if any(keyword in audience_name for keyword in ("信任", "谨慎", "隐私", "售后")):
            base += 4
        if any(keyword in module_text for keyword in ("规则", "授权", "支付", "隐私", "售后")):
            base += 5
        return max(0, min(100, base))

    def _selected_metric_risk(self, metric: str, audience_name: str, module_text: str, base_risks: dict[str, str]) -> str:
        text = f"{metric}{module_text}{audience_name}"
        if any(keyword in text for keyword in ("入口", "点击", "触达")):
            return base_risks["ctr"]
        if any(keyword in text for keyword in ("发布", "完成", "配置", "转化")):
            return base_risks["uv"]
        if any(keyword in text for keyword in ("二跳", "流失", "留存", "停留")):
            return base_risks["pv"]
        if any(keyword in text for keyword in ("信任", "隐私", "评价", "售后")):
            return "red" if any(keyword in audience_name for keyword in ("信任", "隐私", "售后")) else base_risks["pv"]
        if any(keyword in text for keyword in ("互动", "评论", "收藏", "分享")):
            return base_risks["uv"]
        return max(base_risks.values(), key=lambda value: {"green": 0, "yellow": 1, "red": 2}[value])

    def _fallback_module_audience(self, module: dict[str, str], audience: dict[str, Any], selected_metrics: list[str]) -> dict[str, Any]:
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
        risk_ratings = {"ctr": ctr, "uv": uv, "pv": pv}
        selected_metric_ratings = {
            metric: self._selected_metric_risk(metric, audience["name"], text, risk_ratings)
            for metric in selected_metrics
        }
        selected_metric_scores = {
            metric: self._score_from_risk(risk, audience["name"], text)
            for metric, risk in selected_metric_ratings.items()
        }
        return {
            "audience_key": audience["key"],
            "audience_name": audience["name"],
            "behavior": {
                "will_do": will_do,
                "get_stuck_at": stuck,
                "wont_do": wont,
            },
            "risk_ratings": risk_ratings,
            "metric_scores": {
                "ctr": self._score_from_risk(ctr, audience["name"], text),
                "uv": self._score_from_risk(uv, audience["name"], text),
                "pv": self._score_from_risk(pv, audience["name"], text),
            },
            "selected_metric_ratings": selected_metric_ratings,
            "selected_metric_scores": selected_metric_scores,
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
