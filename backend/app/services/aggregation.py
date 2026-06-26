from __future__ import annotations

from collections import Counter
from typing import Any


RISK_SCORE = {"green": 0, "yellow": 1, "red": 2}
SCORE_RISK = {0: "green", 1: "yellow", 2: "red"}
POSITIVE_HINTS = ("主动", "愿意", "会点击", "会停留", "会继续", "更容易参与")
NEGATIVE_HINTS = ("不会", "跳过", "离开", "流失", "卡住", "犹豫")


def overall_risk(ratings: dict[str, str]) -> str:
    return max(ratings.values(), key=lambda value: RISK_SCORE[value])


def result_ratings(result: dict[str, Any]) -> dict[str, str]:
    selected = result.get("selected_metric_ratings")
    if isinstance(selected, dict) and selected:
        return selected
    return result["risk_ratings"]


def has_behavior_conflict(audience_results: list[dict[str, Any]]) -> bool:
    positives = 0
    negatives = 0
    for result in audience_results:
        behavior = result["behavior"]
        text = " ".join([behavior["will_do"], behavior["get_stuck_at"], behavior["wont_do"]])
        if any(hint in text for hint in POSITIVE_HINTS):
            positives += 1
        if any(hint in text for hint in NEGATIVE_HINTS):
            negatives += 1
    return positives > 0 and negatives > 0


def divergence_for_module(module: dict[str, Any]) -> tuple[str | None, str | None]:
    audience_results = module["audience_results"]
    metric_names = sorted({metric for result in audience_results for metric in result_ratings(result)})
    for metric in metric_names:
        scores = [RISK_SCORE[result_ratings(result)[metric]] for result in audience_results if metric in result_ratings(result)]
        if scores and max(scores) - min(scores) >= 2:
            return "high", f"{metric} 风险等级在不同用户群之间跨度达到 2 档。"
    if has_behavior_conflict(audience_results):
        return "high", "不同用户群对该模块的行为判断出现明显相反倾向。"
    spreads = []
    for metric in metric_names:
        scores = [RISK_SCORE[result_ratings(result)[metric]] for result in audience_results if metric in result_ratings(result)]
        if scores:
            spreads.append(max(scores) - min(scores))
    if spreads and max(spreads) >= 1:
        return "medium", "不同用户群在该模块上的风险判断存在明显差异。"
    return None, None


def build_comparison_table(modules: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    comparison_rows: list[dict[str, Any]] = []
    divergence_items: list[dict[str, Any]] = []
    for module in modules:
        divergence_level, reason = divergence_for_module(module)
        comparison_rows.append(
            {
                "module_key": module["module_key"],
                "module_title": module["module_title"],
                "audiences": [
                    {
                        "audience_key": result["audience_key"],
                        "audience_name": result["audience_name"],
                        "overall_risk": overall_risk(result_ratings(result)),
                    }
                    for result in module["audience_results"]
                ],
                "divergence_level": divergence_level,
            }
        )
        if divergence_level and reason:
            divergence_items.append(
                {
                    "module_key": module["module_key"],
                    "module_title": module["module_title"],
                    "divergence_level": divergence_level,
                    "reason": reason,
                }
            )
    divergence_items.sort(key=lambda item: (0 if item["divergence_level"] == "high" else 1, item["module_title"]))
    return comparison_rows, divergence_items


def summarize_conclusion(modules: list[dict[str, Any]], divergence_items: list[dict[str, Any]]) -> dict[str, Any]:
    high_risk_modules: list[str] = []
    audience_names: Counter[str] = Counter()
    for module in modules:
        risky = False
        for result in module["audience_results"]:
            audience_names[result["audience_name"]] += 1
            if overall_risk(result_ratings(result)) == "red":
                risky = True
        if risky:
            high_risk_modules.append(module["module_title"])
    return {
        "high_risk_modules": high_risk_modules,
        "high_divergence_modules": [item["module_title"] for item in divergence_items if item["divergence_level"] == "high"],
        "covered_audiences": list(audience_names.keys()),
    }
