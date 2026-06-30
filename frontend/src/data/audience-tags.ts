import type { AudienceDefinition } from '../types/api'

export type TagGroup = {
  name: string
  values: string[]
}

export const CUSTOM_AUDIENCE_TAG_GROUPS: TagGroup[] = [
  { name: '性别', values: ['男', '女'] },
  { name: '年龄', values: ['18岁以下', '18-23岁', '24-30岁', '31-35岁', '36-40岁', '41-50岁', '51岁以上', '未知'] },
  { name: '学历', values: ['初中及以下', '高中/中专', '大专', '本科', '硕士及以上', '未知'] },
  { name: '工作时间类型', values: ['白班', '夜班', '轮班/倒班', '弹性工作', '无固定工作时间', '未知'] },
  { name: '手机品牌', values: ['华为', '苹果', '小米', 'OPPO', 'vivo', '荣耀', '三星', '其他'] },
  { name: '手机系统', values: ['安卓', '苹果', '鸿蒙', '其他'] },
  { name: '手机价格', values: ['1000元以下', '1000-1999元', '2000-2999元', '3000-4999元', '5000元以上', '未知'] },
  { name: '常驻城市等级', values: ['一线城市', '新一线城市', '二线城市', '三线城市', '四线城市', '五线及以下城市', '未知'] },
  { name: '活跃时段', values: ['凌晨', '早间', '上午', '中午', '下午', '晚间', '深夜'] },
  { name: '用户活跃度', values: ['活跃度1', '活跃度2', '活跃度3', '活跃度4'] },
  { name: '抖音投稿活跃度', values: ['高', '中', '低', '无投稿', '未知'] },
  { name: '1/7/30日购物车点击次数', values: ['0次', '1-2次', '3-5次', '6-10次', '10次以上'] },
  { name: '1/7/30日看播次数', values: ['0次', '1-2次', '3-5次', '6-10次', '10次以上'] },
  { name: '1/7/30日视频分享', values: ['无分享', '低频分享', '中频分享', '高频分享'] },
  { name: '1/7/30日购物车点击', values: ['无点击', '低频点击', '中频点击', '高频点击'] },
  { name: '1/7/30日商品收藏', values: ['无收藏', '低频收藏', '中频收藏', '高频收藏'] },
  { name: '广告品牌偏好', values: ['高', '中', '低', '无明显偏好'] },
  { name: '游戏偏好', values: ['高', '中', '低', '无明显偏好'] },
  { name: 'TOP20达人直播间转化概率', values: ['高', '中', '低', '未知'] },
  { name: '综合消费能力', values: ['高', '中', '低', '未知'] },
  { name: '行业偏好', values: ['玩具乐器', '服饰内衣', '个护家清', '智能家居', '生鲜', '美妆', '母婴宠物', '鲜花园艺', '本地生活', '食品饮料', '3C 数码家电', '图书教育', '鞋靴箱包', '虚拟充值', '运动户外', '钟表配饰', '珠宝文玩', '医疗健康', '滋补保健', '酒类', '原料包装', '餐饮外卖'] },
]

export const QUICK_AUDIENCE_NAMES = [
  '年轻中高消费力男性',
  '年轻中高消费力女性',
  '年长中高消费力男性',
  '年长中高消费力女性',
]

export function buildQuickAudience(name: string, index: number): AudienceDefinition {
  const isYoung = name.includes('年轻')
  const isMale = name.includes('男性')
  return {
    id: -100 - index,
    key: `quick_${index + 1}_${isYoung ? 'young' : 'senior'}_${isMale ? 'male' : 'female'}`,
    name,
    definition: `${name}，具备中高消费能力，关注产品价值、使用门槛、信任信息和转化路径是否清晰。`,
    behavior_summary: {
      conversion_trait: isYoung
        ? '对强利益点、低操作成本和即时反馈更敏感，若入口清晰会更快进入下一步。'
        : '更重视信息可信度、规则边界和实际收益，确认清楚后才会继续行动。',
      dwell_trait: isMale
        ? '倾向快速筛选核心信息，停留在功能价值、价格权益和操作效率相关内容。'
        : '会更细致比较权益、保障、评价和服务信息，停留时间相对更长。',
      dropoff_points: ['核心价值表达不直接', '操作步骤或规则成本过高', '信任依据和保障说明不足'],
      content_preferences: ['直接价值说明', '清晰行动入口', '可信依据', '关键权益说明'],
    },
    source: 'frontend_fallback',
    is_active: true,
  }
}

