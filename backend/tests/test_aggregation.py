from app.services.aggregation import build_comparison_table, summarize_conclusion


def test_build_comparison_table_marks_high_divergence_for_two_grade_gap() -> None:
    modules = [
        {
            "module_key": "entry",
            "module_title": "入口设计",
            "module_summary": "summary",
            "audience_results": [
                {
                    "audience_key": "a",
                    "audience_name": "A",
                    "behavior": {"will_do": "会主动点击", "get_stuck_at": "较少", "wont_do": "不会离开"},
                    "risk_ratings": {"ctr": "green", "uv": "yellow", "pv": "yellow"},
                    "risk_reason": "reason",
                },
                {
                    "audience_key": "b",
                    "audience_name": "B",
                    "behavior": {"will_do": "会快速扫过", "get_stuck_at": "入口语义", "wont_do": "不会继续"},
                    "risk_ratings": {"ctr": "red", "uv": "yellow", "pv": "yellow"},
                    "risk_reason": "reason",
                },
            ],
        }
    ]
    comparison, divergence = build_comparison_table(modules)
    assert comparison[0]["divergence_level"] == "high"
    assert divergence[0]["module_title"] == "入口设计"


def test_summarize_conclusion_collects_high_risk_and_covered_audiences() -> None:
    modules = [
        {
            "module_key": "report",
            "module_title": "报告输出",
            "module_summary": "summary",
            "audience_results": [
                {
                    "audience_key": "a",
                    "audience_name": "高信任需求用户",
                    "behavior": {"will_do": "会验证", "get_stuck_at": "证据不足", "wont_do": "不会直接接受"},
                    "risk_ratings": {"ctr": "yellow", "uv": "red", "pv": "red"},
                    "risk_reason": "reason",
                }
            ],
        }
    ]
    _, divergence = build_comparison_table(modules)
    conclusion = summarize_conclusion(modules, divergence)
    assert conclusion["high_risk_modules"] == ["报告输出"]
    assert conclusion["covered_audiences"] == ["高信任需求用户"]
