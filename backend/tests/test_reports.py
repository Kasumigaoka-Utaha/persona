from types import SimpleNamespace

from app.services.reports import render_markdown_report


def test_render_markdown_report() -> None:
    job = SimpleNamespace(
        result=SimpleNamespace(
            result_json={
                "report_meta": {
                    "document_title": "用户实时陪审团_PRD_副本",
                    "analyzed_at": "2026-06-21T12:00:00Z",
                    "audiences": ["新客低耐心用户", "高信任需求用户"],
                    "scope_note": "基于当前文档模块与所选用户群进行方向性判断。",
                },
                "modules": [
                    {
                        "module_title": "入口设计",
                        "module_summary": "summary",
                        "audience_results": [
                            {
                                "audience_name": "新客低耐心用户",
                                "behavior": {
                                    "will_do": "会先扫一眼",
                                    "get_stuck_at": "标题不直观",
                                    "wont_do": "不会细读",
                                },
                                "risk_ratings": {"ctr": "red", "uv": "yellow", "pv": "yellow"},
                                "risk_reason": "认知成本偏高",
                            }
                        ],
                    }
                ],
                "comparison_table": [
                    {
                        "module_title": "入口设计",
                        "audiences": [
                            {"audience_name": "新客低耐心用户", "overall_risk": "red"},
                            {"audience_name": "高信任需求用户", "overall_risk": "yellow"},
                        ],
                        "divergence_level": "high",
                    }
                ],
                "conclusion": {
                    "high_risk_modules": ["入口设计"],
                    "high_divergence_modules": ["入口设计"],
                    "covered_audiences": ["新客低耐心用户", "高信任需求用户"],
                },
                "confidence_notes": ["该报告仅用于评审与答辩辅助。"],
            }
        )
    )
    markdown = render_markdown_report(job)
    assert "AI 陪审团判断" in markdown
    assert "入口设计" in markdown
    assert "🔴" in markdown
    assert "高分歧" in markdown
