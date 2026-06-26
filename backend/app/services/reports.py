from __future__ import annotations

from app.models import AnalysisJob


RISK_EMOJI = {"red": "🔴", "yellow": "🟡", "green": "✅"}
LEVEL_LABEL = {"high": "高分歧", "medium": "中分歧"}
DEFAULT_METRICS = ["CTR", "UV", "PV"]


def selected_metrics(meta: dict) -> list[str]:
    metrics = meta.get("selected_metrics") or DEFAULT_METRICS
    return [str(metric) for metric in metrics if str(metric).strip()] or DEFAULT_METRICS


def item_metric_scores(item: dict, metrics: list[str]) -> dict[str, int | str]:
    selected_scores = item.get("selected_metric_scores")
    if isinstance(selected_scores, dict) and selected_scores:
        return {metric: selected_scores.get(metric, "-") for metric in metrics}
    legacy = item.get("metric_scores", {})
    return {
        "CTR": legacy.get("ctr", "-"),
        "UV": legacy.get("uv", "-"),
        "PV": legacy.get("pv", "-"),
    }


def item_metric_ratings(item: dict, metrics: list[str]) -> dict[str, str]:
    selected_ratings = item.get("selected_metric_ratings")
    if isinstance(selected_ratings, dict) and selected_ratings:
        return {metric: selected_ratings.get(metric, "yellow") for metric in metrics}
    legacy = item.get("risk_ratings", {})
    return {
        "CTR": legacy.get("ctr", "yellow"),
        "UV": legacy.get("uv", "yellow"),
        "PV": legacy.get("pv", "yellow"),
    }


def render_markdown_report(job: AnalysisJob) -> str:
    if not job.result:
        return "# 用户实时陪审团报告\n\n结果暂不可用。"
    result = job.result.result_json
    meta = result["report_meta"]
    metrics = selected_metrics(meta)
    lines = [
        f"# {meta['document_title']}",
        "",
        "> AI 陪审团判断仅用于方向性分析，不代表真实线上结果。",
        "",
        "## 一、分析说明",
        f"- 分析时间：{meta['analyzed_at']}",
        f"- 所选用户群：{'、'.join(meta['audiences'])}",
        f"- 观察指标：{'、'.join(metrics)}",
        f"- 分析范围说明：{meta['scope_note']}",
        "",
        "## 二、分用户群模块分析",
    ]
    for module in result.get("modules", []):
        lines.extend(["", f"### {module['module_title']}", module.get("module_summary", "")])
        for audience in module.get("audience_results", []):
            ratings = item_metric_ratings(audience, metrics)
            scores = item_metric_scores(audience, metrics)
            lines.extend(
                [
                    f"- **{audience['audience_name']}**",
                    f"  - 行为判断：会做什么——{audience['behavior']['will_do']}",
                    f"  - 卡点：{audience['behavior']['get_stuck_at']}",
                    f"  - 不会做什么：{audience['behavior']['wont_do']}",
                    "  - 指标风险："
                    + " / ".join(f"{metric} {RISK_EMOJI[ratings[metric]]}" for metric in ratings),
                    "  - 风险指数："
                    + " / ".join(f"{metric} {scores[metric]}" for metric in scores),
                    f"  - 风险原因：{audience['risk_reason']}",
                ]
            )
    lines.extend(["", "## 三、多用户群对比汇总表", "| 模块 | " + " | ".join(cell["audience_name"] for cell in result["comparison_table"][0]["audiences"]) + " | 分歧结论 |", "|---|" + "---|" * len(result["comparison_table"][0]["audiences"]) + "---|"] if result.get("comparison_table") else ["", "## 三、多用户群对比汇总表"])
    for row in result.get("comparison_table", []):
        risk_cells = " | ".join(RISK_EMOJI[cell["overall_risk"]] for cell in row["audiences"])
        divergence = LEVEL_LABEL.get(row.get("divergence_level"), "-")
        lines.append(f"| {row['module_title']} | {risk_cells} | {divergence} |")
    lines.extend(["", "## 四、结论摘要"])
    conclusion = result.get("conclusion", {})
    lines.append(f"- 高风险模块：{'、'.join(conclusion.get('high_risk_modules', [])) or '无'}")
    lines.append(f"- 高分歧模块：{'、'.join(conclusion.get('high_divergence_modules', [])) or '无'}")
    lines.append(f"- 覆盖用户群：{'、'.join(conclusion.get('covered_audiences', [])) or '无'}")
    if result.get("confidence_notes"):
        lines.extend(["", "## 置信说明"])
        lines.extend([f"- {item}" for item in result["confidence_notes"]])
    return "\n".join(lines)
