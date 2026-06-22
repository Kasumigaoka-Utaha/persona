from __future__ import annotations

DEFAULT_AUDIENCES = [
    {
        "key": "new_user_low_patience",
        "name": "新客低耐心用户",
        "definition": "首次或低频接触该场景，对复杂表达和额外理解成本容忍度低。",
        "behavior_summary": {
            "conversion_trait": "对直白、低认知成本的入口更容易产生首次点击；遇到复杂说明时转化快速下滑。",
            "dwell_trait": "停留时间短，通常只会扫一眼关键利益点。",
            "dropoff_points": ["入口语义不直观", "首屏信息过多", "需要多步理解才知道价值"],
            "content_preferences": ["短文案", "明确利益点", "一步可达的交互"],
        },
        "source": "seeded",
    },
    {
        "key": "active_content_user",
        "name": "高活跃内容参与用户",
        "definition": "愿意浏览内容、参与评论或互动，对内容丰富度和可探索性更敏感。",
        "behavior_summary": {
            "conversion_trait": "若内容结构清晰，会主动探索并放大正向点击与浏览。",
            "dwell_trait": "停留时长较高，愿意展开看更多上下文。",
            "dropoff_points": ["内容层级混乱", "缺少值得继续展开的线索", "互动入口被压缩"],
            "content_preferences": ["层级清晰的内容块", "可继续展开的线索", "真实用户反馈"],
        },
        "source": "seeded",
    },
    {
        "key": "price_sensitive_low_freq",
        "name": "低频价格敏感用户",
        "definition": "购买和参与频次低，决策时更关注是否值得、是否有隐藏成本。",
        "behavior_summary": {
            "conversion_trait": "会先判断投入产出比，对任何额外操作成本都较敏感。",
            "dwell_trait": "会短暂停留做价值判断，但不愿深挖复杂内容。",
            "dropoff_points": ["价值点不明确", "需要额外学习新规则", "担心被营销引导"],
            "content_preferences": ["直接价值说明", "风险提示清晰", "少承诺多证据"],
        },
        "source": "seeded",
    },
    {
        "key": "high_trust_need",
        "name": "高信任需求用户",
        "definition": "对真实性、确定性和可验证性要求高，做决定前会先验证。",
        "behavior_summary": {
            "conversion_trait": "只有在信息可信、来源明确时才愿意继续下一步。",
            "dwell_trait": "愿意停留验证，但如果证据不足会快速转向保守行为。",
            "dropoff_points": ["表达过于绝对", "缺少真实依据", "功能意图不透明"],
            "content_preferences": ["真实案例", "来源说明", "可验证的细节"],
        },
        "source": "seeded",
    },
    {
        "key": "impulsive_fast_decider",
        "name": "冲动型快速决策用户",
        "definition": "愿意快速响应强信号，但不愿投入过多时间进行复杂理解。",
        "behavior_summary": {
            "conversion_trait": "醒目的触发点会快速带来点击，但复杂链路容易导致中途流失。",
            "dwell_trait": "停留时长短，更依赖即时感知做判断。",
            "dropoff_points": ["链路过长", "文案不够抓眼", "价值反馈延迟"],
            "content_preferences": ["强视觉提示", "即时反馈", "低步骤操作"],
        },
        "source": "seeded",
    },
    {
        "key": "risk_averse_cautious_user",
        "name": "谨慎型风险规避用户",
        "definition": "对试错成本敏感，遇到不确定或不可逆操作时倾向观望。",
        "behavior_summary": {
            "conversion_trait": "只有风险边界清楚、可退出时才可能继续行动。",
            "dwell_trait": "会停留阅读关键规则，但不一定转化。",
            "dropoff_points": ["不可逆操作", "风险说明缺失", "退出路径不清", "催促式文案"],
            "content_preferences": ["风险说明", "取消入口", "保障边界", "确认提示"],
        },
        "source": "seeded",
    },
    {
        "key": "rule_confused_user",
        "name": "规则理解困难用户",
        "definition": "面对多条件、多门槛、多步骤规则时容易误解或放弃。",
        "behavior_summary": {
            "conversion_trait": "规则被简化为明确结论时更可能继续。",
            "dwell_trait": "停留可能不短，但多用于困惑式阅读。",
            "dropoff_points": ["多条件叠加", "术语过多", "跨页面解释", "结果不确定"],
            "content_preferences": ["步骤化说明", "明确结论", "示例", "进度提示"],
        },
        "source": "seeded",
    },
    {
        "key": "review_dependent_user",
        "name": "评价依赖型用户",
        "definition": "决策高度依赖他人评价、真实反馈和群体选择信号。",
        "behavior_summary": {
            "conversion_trait": "真实评价和群体信号会明显增强转化。",
            "dwell_trait": "愿意花时间阅读评价和对比反馈。",
            "dropoff_points": ["评价缺失", "评价质量低", "反馈不可信", "无法筛选重点"],
            "content_preferences": ["评价摘要", "真实反馈", "对比信息", "用户案例"],
        },
        "source": "seeded",
    },
    {
        "key": "after_sales_anxious_user",
        "name": "售后焦虑型用户",
        "definition": "购买或参与前重点关注退换、客服、赔付和问题处理路径。",
        "behavior_summary": {
            "conversion_trait": "清楚的售后承诺和服务路径会提升行动意愿。",
            "dwell_trait": "会停留查看保障、规则和服务入口。",
            "dropoff_points": ["售后规则隐藏", "客服入口难找", "退换边界模糊", "责任归属不清"],
            "content_preferences": ["售后保障", "客服入口", "退换说明", "赔付规则"],
        },
        "source": "seeded",
    },
    {
        "key": "promotion_sensitive_user",
        "name": "促销敏感薅羊毛用户",
        "definition": "对优惠、红包、满减和限时利益高度敏感，愿意为明确收益行动。",
        "behavior_summary": {
            "conversion_trait": "明确优惠力度和可领取权益能强力驱动点击。",
            "dwell_trait": "愿意停留计算利益，但对虚假优惠很敏感。",
            "dropoff_points": ["优惠门槛高", "权益解释不清", "领取失败", "价格前后不一致"],
            "content_preferences": ["优惠明细", "倒计时", "领取状态", "可用范围"],
        },
        "source": "seeded",
    },
    {
        "key": "quality_rational_user",
        "name": "品质理性决策用户",
        "definition": "重视品质、参数、口碑和长期价值，不轻易被低价驱动。",
        "behavior_summary": {
            "conversion_trait": "品质证据、参数对比和口碑信息能提升转化。",
            "dwell_trait": "停留较长，倾向深度阅读。",
            "dropoff_points": ["信息浅", "参数缺失", "证据不足", "只强调低价"],
            "content_preferences": ["品质说明", "参数对比", "长评", "专业背书"],
        },
        "source": "seeded",
    },
    {
        "key": "old_path_habit_user",
        "name": "老客习惯路径用户",
        "definition": "熟悉旧流程，对路径变化、新入口和新规则有惯性抵触。",
        "behavior_summary": {
            "conversion_trait": "与原有习惯兼容时更容易接受新能力。",
            "dwell_trait": "遇到变化会短暂停留确认，但耐心有限。",
            "dropoff_points": ["入口迁移", "命名变化", "路径重组", "旧能力被隐藏"],
            "content_preferences": ["熟悉位置", "延续性提示", "状态保留", "轻量变化"],
        },
        "source": "seeded",
    },
    {
        "key": "privacy_sensitive_user",
        "name": "隐私敏感用户",
        "definition": "对授权、个人信息、位置、通讯录和数据用途高度敏感。",
        "behavior_summary": {
            "conversion_trait": "权限用途明确、可拒绝、可撤回时更可能继续。",
            "dwell_trait": "会停留查看隐私说明，但容易中断。",
            "dropoff_points": ["强制授权", "用途不清", "默认勾选", "隐私入口难找"],
            "content_preferences": ["权限解释", "隐私说明", "可选授权", "撤回路径"],
        },
        "source": "seeded",
    },
    {
        "key": "low_activity_observer",
        "name": "低活跃沉默观望用户",
        "definition": "很少互动或购买，对大多数入口无感，需要强相关信号才会行动。",
        "behavior_summary": {
            "conversion_trait": "强相关需求和低门槛入口才可能触发行动。",
            "dwell_trait": "停留短，容易跳过非刚需信息。",
            "dropoff_points": ["相关性弱", "入口普通", "价值不明确", "需要主动探索"],
            "content_preferences": ["强相关推荐", "低干扰提示", "明确收益", "轻量操作"],
        },
        "source": "seeded",
    },
]

DEMO_DOCUMENT_FALLBACK = """# 用户实时陪审团 Demo 文档

## 背景与目标
本次方案希望在 PM 撰写 PRD 时，直接从文档右侧发起用户陪审团分析，帮助提前识别不同用户群对方案的理解差异和风险。

## 入口设计
在飞书文档右侧提供常驻悬浮胶囊，文案为“陪审团”。点击后展开侧边栏，可直接开始分析。

## 用户群选择
侧边栏中提供 3-5 个可选用户群。每个用户群展示标签定义、行为特征、典型流失点和内容偏好。若标签平台异常，则允许 PM 手动填写特征。

## 报告输出
系统按 PRD 模块输出每个用户群的行为判断，并对 CTR、UV、PV 给出风险评级。报告支持多用户群对比，并标记分歧最大的模块。

## 风险说明
输出仅用于判断和答辩辅助，不提供优化建议；风险指数是方向性估算，不代表真实线上百分比。
"""
