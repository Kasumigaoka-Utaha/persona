import type { AudienceDefinition, DemoDocument } from '../types/api'

export const FALLBACK_DEMO_DOCUMENT: DemoDocument = {
  title: '用户实时陪审团 Demo 文档',
  host: 'frontend_fallback',
  content: `# 用户实时陪审团 Demo 文档

## 背景与目标
本次方案希望在 PM 撰写 PRD 时，直接从文档右侧发起用户陪审团分析，帮助提前识别不同用户群对方案的理解差异和风险。

## 入口设计
在飞书文档右侧提供常驻悬浮胶囊，文案为“陪审团”。点击后展开侧边栏，可直接开始分析。

## 用户群选择
侧边栏中提供系统默认人格标签，也允许 PM 通过单独标签组合生成自定义用户群。

## 报告输出
系统按 PRD 模块输出每个用户群的行为判断，并对 CTR、UV、PV 给出风险评级和风险指数。
`,
}

export const FALLBACK_AUDIENCES: AudienceDefinition[] = [
  {
    id: -1,
    key: 'fallback_new_user_low_patience',
    name: '新客低耐心用户',
    definition: '首次或低频接触该场景，对复杂表达和额外理解成本容忍度低。',
    behavior_summary: {
      conversion_trait: '对直白、低认知成本的入口更容易产生首次点击；遇到复杂说明时转化快速下滑。',
      dwell_trait: '停留时间短，通常只会扫一眼关键利益点。',
      dropoff_points: ['入口语义不直观', '首屏信息过多', '需要多步理解才知道价值'],
      content_preferences: ['短文案', '明确利益点', '一步可达的交互'],
    },
    source: 'frontend_fallback',
    is_active: true,
  },
  {
    id: -2,
    key: 'fallback_active_content_user',
    name: '高活跃内容参与用户',
    definition: '愿意浏览内容、参与评论或互动，对内容丰富度和可探索性更敏感。',
    behavior_summary: {
      conversion_trait: '若内容结构清晰，会主动探索并放大正向点击与浏览。',
      dwell_trait: '停留时长较高，愿意展开看更多上下文。',
      dropoff_points: ['内容层级混乱', '缺少值得继续展开的线索', '互动入口被压缩'],
      content_preferences: ['层级清晰的内容块', '可继续展开的线索', '真实用户反馈'],
    },
    source: 'frontend_fallback',
    is_active: true,
  },
  {
    id: -3,
    key: 'fallback_price_sensitive_low_freq',
    name: '低频价格敏感用户',
    definition: '购买和参与频次低，决策时更关注是否值得、是否有隐藏成本。',
    behavior_summary: {
      conversion_trait: '会先判断投入产出比，对任何额外操作成本都较敏感。',
      dwell_trait: '会短暂停留做价值判断，但不愿深挖复杂内容。',
      dropoff_points: ['价值点不明确', '需要额外学习新规则', '担心被营销引导'],
      content_preferences: ['直接价值说明', '风险提示清晰', '少承诺多证据'],
    },
    source: 'frontend_fallback',
    is_active: true,
  },
  {
    id: -4,
    key: 'fallback_high_trust_need',
    name: '高信任需求用户',
    definition: '对真实性、确定性和可验证性要求高，做决定前会先验证。',
    behavior_summary: {
      conversion_trait: '只有在信息可信、来源明确时才愿意继续下一步。',
      dwell_trait: '愿意停留验证，但如果证据不足会快速转向保守行为。',
      dropoff_points: ['表达过于绝对', '缺少真实依据', '功能意图不透明'],
      content_preferences: ['真实案例', '来源说明', '可验证的细节'],
    },
    source: 'frontend_fallback',
    is_active: true,
  },
  {
    id: -5,
    key: 'fallback_impulsive_fast_decider',
    name: '冲动型快速决策用户',
    definition: '愿意快速响应强信号，但不愿投入过多时间进行复杂理解。',
    behavior_summary: {
      conversion_trait: '醒目的触发点会快速带来点击，但复杂链路容易导致中途流失。',
      dwell_trait: '停留时长短，更依赖即时感知做判断。',
      dropoff_points: ['链路过长', '文案不够抓眼', '价值反馈延迟'],
      content_preferences: ['强视觉提示', '即时反馈', '低步骤操作'],
    },
    source: 'frontend_fallback',
    is_active: true,
  },
  {
    id: -6,
    key: 'fallback_rule_confused_user',
    name: '规则理解困难用户',
    definition: '面对多条件、多门槛、多步骤规则时容易误解或放弃。',
    behavior_summary: {
      conversion_trait: '规则被简化为明确结论时更可能继续。',
      dwell_trait: '停留可能不短，但多用于困惑式阅读。',
      dropoff_points: ['多条件叠加', '术语过多', '跨页面解释', '结果不确定'],
      content_preferences: ['步骤化说明', '明确结论', '示例', '进度提示'],
    },
    source: 'frontend_fallback',
    is_active: true,
  },
  {
    id: -7,
    key: 'fallback_review_dependent_user',
    name: '评价依赖型用户',
    definition: '决策高度依赖他人评价、真实反馈和群体选择信号。',
    behavior_summary: {
      conversion_trait: '真实评价和群体信号会明显增强转化。',
      dwell_trait: '愿意花时间阅读评价和对比反馈。',
      dropoff_points: ['评价缺失', '评价质量低', '反馈不可信', '无法筛选重点'],
      content_preferences: ['评价摘要', '真实反馈', '对比信息', '用户案例'],
    },
    source: 'frontend_fallback',
    is_active: true,
  },
  {
    id: -8,
    key: 'fallback_after_sales_anxious_user',
    name: '售后焦虑型用户',
    definition: '购买或参与前重点关注退换、客服、赔付和问题处理路径。',
    behavior_summary: {
      conversion_trait: '清楚的售后承诺和服务路径会提升行动意愿。',
      dwell_trait: '会停留查看保障、规则和服务入口。',
      dropoff_points: ['售后规则隐藏', '客服入口难找', '退换边界模糊', '责任归属不清'],
      content_preferences: ['售后保障', '客服入口', '退换说明', '赔付规则'],
    },
    source: 'frontend_fallback',
    is_active: true,
  },
]
