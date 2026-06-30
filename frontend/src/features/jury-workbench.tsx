import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  BarChart3,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Link2,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react'
import { api } from '../api'
import { Badge, Button, Card, GhostButton, Input, Label, SectionTitle, Textarea } from '../components/ui'
import type { AudienceDefinition, ManualAudienceInput } from '../types/api'
import { cn } from '../lib/utils'
import { FALLBACK_AUDIENCES, FALLBACK_DEMO_DOCUMENT } from '../data/fallbacks'
import { useWizardStore } from '../store/wizard'
import { AI_MODEL_OPTIONS } from '../data/model-options'
import type { AIModelProvider } from '../types/api'

type DocumentSource = {
  host: string
  sourceMode: string
}

type CustomAudience = ManualAudienceInput & {
  key: string
  chips: string[]
}

type AudienceDetail =
  | { type: 'default'; audience: AudienceDefinition }
  | { type: 'custom'; audience: CustomAudience }

type TagGroup = {
  name: string
  values: string[]
}

const TAG_GROUPS: TagGroup[] = [
  { name: '年龄', values: ['18-24 岁', '25-34 岁', '35-44 岁', '45-54 岁', '55 岁以上'] },
  { name: '城市', values: ['一线城市', '新一线城市', '二线城市', '三四线城市', '县城/乡镇'] },
  { name: '月购买次数', values: ['0 次购买', '1-2 次购买', '3-5 次购买', '6-10 次购买', '10 次以上购买'] },
  { name: '内容互动', values: ['从不互动', '偶尔点赞', '经常评论', '经常收藏/分享', '深度创作'] },
  { name: '价格敏感度', values: ['价格低敏感', '价格中敏感', '价格高敏感', '极高价格敏感'] },
  { name: '信任需求', values: ['低信任需求', '中信任需求', '高信任需求', '极高信任需求'] },
  { name: '决策速度', values: ['慢决策', '理性比较', '快速决策', '冲动决策'] },
  { name: '耐心程度', values: ['低耐心', '中耐心', '高耐心'] },
  { name: '售后敏感度', values: ['低售后敏感', '中售后敏感', '高售后敏感'] },
  { name: '评价依赖', values: ['不看评价', '参考评价', '重度依赖评价'] },
  { name: '新功能接受度', values: ['保守', '观望', '愿意尝试', '尝鲜驱动'] },
  { name: '隐私敏感度', values: ['低隐私敏感', '中隐私敏感', '高隐私敏感', '极高隐私敏感'] },
]

const AUDIENCE_TAXONOMY: TagGroup[] = [
  { name: '八大人群', values: ['小镇青年', '小镇中老年', 'genz', '精致妈妈', '新锐白领', '资深中产', '都市银发', '都市蓝领', '其他'] },
  { name: '策略人群8分类', values: ['年轻中高消费力男性', '年轻中高消费力女性', '年长中高消费力男性', '年长中高消费力女性', '年轻低消费力男性', '年轻低消费力女性', '年长低消费力男性', '年长低消费力女性'] },
  { name: '电商用户生命周期', values: ['潜客', '纯新客', '准新客当日复购', '准新客当日未复购', '老客低频复购', '老客低频无复购', '老客中频复购', '老客中频无复购', '老客高频复购', '老客高频无复购', '流失用户重新激活', '流失用户'] },
  { name: '用户活跃度', values: ['活跃度 1（低）', '活跃度 2（中低）', '活跃度 3（中高）', '活跃度 4（高）'] },
  { name: '电商用户职业标签', values: ['agriculture', 'blue_collar_industry', 'blue_collar_service', 'building_worker', 'delivery_man', 'driver', 'finance', 'inhouse_student', 'it', 'medical_staff', 'public_servant', 'repair_worker', 'restaurant', 'retail', 'teacher', 'white_collar', 'not_work'] },
  { name: '写评行为', values: ['写评新用户', '30天未写评老用户', '30天写评1次老用户', '30天写评2次老用户', '30天写评3次老用户', '30天写评4次老用户', '30天写评5次及以上老用户'] },
  { name: '写评质量', values: ['高订单-低写评用户', '高写评-高有用用户', '高写评-低有用用户'] },
]

const POPUP_AUDIENCE_TAXONOMY: TagGroup[] = [
  ...AUDIENCE_TAXONOMY,
  { name: '其他标签', values: [] },
]

const ALL_TAG_GROUPS = [...TAG_GROUPS, ...AUDIENCE_TAXONOMY]

const METRIC_GROUPS: TagGroup[] = [
  { name: '核心规模指标', values: ['DAU（日活跃用户数）', 'WAU（周活跃用户数）', 'MAU（月活跃用户数）', 'MAC（月活跃客户数）', 'DAC（日活跃支付用户数）'] },
  { name: '行为活跃指标', values: ['UV（访客数）', 'PV（浏览量）', '跳出率', '平均页面访问时长', '点击率'] },
  { name: '留存率', values: ['次日留存率', '7日留存率', '30日留存率', '7日主动复访率'] },
]

const POPUP_METRICS = METRIC_GROUPS.flatMap((group) => group.values)
const METRICS = POPUP_METRICS
const audienceIcons = ['bg-emerald-100 text-emerald-600', 'bg-blue-100 text-blue-600', 'bg-violet-100 text-violet-600', 'bg-orange-100 text-orange-600']

function parseLines(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean)
}

function buildManualAudience(name: string, chips: string[]): ManualAudienceInput {
  const labelText = chips.join('、')
  const highPrice = chips.some((chip) => chip.includes('价格高') || chip.includes('极高价格'))
  const highTrust = chips.some((chip) => chip.includes('高信任') || chip.includes('极高信任'))
  const lowPatience = chips.some((chip) => chip.includes('低耐心') || chip.includes('快速') || chip.includes('冲动'))
  const reviewHeavy = chips.some((chip) => chip.includes('评价'))
  const afterSales = chips.some((chip) => chip.includes('售后'))
  return {
    name,
    definition: `由标签组合生成的临时用户群：${labelText}。该用户群用于本次陪审团分析，代表这些行为特征叠加后的方向性视角。`,
    conversion_trait: highPrice
      ? '会先判断投入产出比和优惠真实性，价格或权益不清晰时转化意愿下降。'
      : highTrust
        ? '只有在信息可信、来源明确、保障边界清楚时才愿意继续下一步。'
        : lowPatience
          ? '对低步骤、强信号入口更容易产生点击，复杂链路会快速削弱转化。'
          : '会综合判断内容相关性、操作成本和收益明确性后决定是否继续。',
    dwell_trait: lowPatience
      ? '停留时间偏短，优先扫视标题、按钮和核心利益点。'
      : reviewHeavy || highTrust || afterSales
        ? '会停留验证评价、保障、规则和可信依据。'
        : '停留时长中等，会围绕自身目标筛选关键信息。',
    dropoff_points: [
      lowPatience ? '入口或规则需要多步理解' : '价值点与自身需求相关性不足',
      highTrust ? '缺少可信来源和保障说明' : '关键结论不够直接',
      highPrice ? '价格、权益或成本边界不清' : '操作路径增加额外成本',
      afterSales ? '售后、客服或退换路径不明确' : '反馈延迟或状态不可见',
    ],
    content_preferences: [
      highPrice ? '直接价值说明' : '明确利益点',
      highTrust ? '来源说明和真实证据' : '低理解成本表达',
      reviewHeavy ? '评价摘要和用户案例' : '清晰步骤',
      afterSales ? '售后保障和客服入口' : '即时反馈',
    ],
  }
}

async function safeLogEvent(event_name: string, payload: Record<string, unknown> = {}) {
  try {
    await api.logEvent({ event_name, payload })
  } catch {
    // Demo telemetry is best effort.
  }
}

function useDocumentState() {
  const documentQuery = useQuery({ queryKey: ['demo-document'], queryFn: api.getDemoDocument })
  const loadedDocument = documentQuery.data ?? (documentQuery.isError ? FALLBACK_DEMO_DOCUMENT : null)
  const [documentTitle, setDocumentTitle] = useState<string | null>(null)
  const [documentContent, setDocumentContent] = useState<string | null>(null)
  const [documentSource, setDocumentSource] = useState<DocumentSource | null>(null)
  const [prdLink, setPrdLink] = useState('')
  const [documentNotice, setDocumentNotice] = useState('')

  const effectiveDocumentTitle = documentTitle ?? loadedDocument?.title ?? ''
  const effectiveDocumentContent = documentContent ?? loadedDocument?.content ?? ''
  const effectiveDocumentSource = documentSource ?? {
    host: loadedDocument?.host ?? FALLBACK_DEMO_DOCUMENT.host,
    sourceMode: 'host',
  }

  const applyParsedDocument = (title: string, content: string, host: string, sourceMode: string, notice: string) => {
    setDocumentTitle(title)
    setDocumentContent(content)
    setDocumentSource({ host, sourceMode })
    setDocumentNotice(notice)
  }

  const parseLinkMutation = useMutation({
    mutationFn: api.parseDocumentLink,
    onSuccess: (parsed) => {
      if (parsed.needs_manual_content || !parsed.content.trim()) {
        setDocumentNotice('链接无法自动读取正文，请改用上传本地文档或手动粘贴 PRD 内容。')
        return
      }
      applyParsedDocument(parsed.title, parsed.content, parsed.host, parsed.source_mode, '链接解析成功，已填入当前文档上下文。')
    },
    onError: (error) => {
      setDocumentNotice(error instanceof Error ? error.message : '链接解析失败，请改用上传或手动粘贴正文。')
    },
  })

  const parseFileMutation = useMutation({
    mutationFn: api.parseDocumentFile,
    onSuccess: (parsed) => {
      applyParsedDocument(parsed.title, parsed.content, parsed.host, parsed.source_mode, '本地文档解析成功，已填入当前文档上下文。')
    },
    onError: (error) => {
      setDocumentNotice(error instanceof Error ? error.message : '文件解析失败，请确认格式后重试。')
    },
  })

  const parseCurrentLink = () => {
    const url = prdLink.trim()
    if (!url) {
      setDocumentNotice('请先输入 PRD 链接。')
      return
    }
    parseLinkMutation.mutate(url)
  }

  const uploadFile = (file: File | undefined) => {
    if (!file) return
    parseFileMutation.mutate(file)
  }

  return {
    documentQuery,
    loadedDocument,
    effectiveDocumentTitle,
    effectiveDocumentContent,
    effectiveDocumentSource,
    prdLink,
    setPrdLink,
    documentNotice,
    setDocumentNotice,
    setDocumentTitle,
    setDocumentContent,
    setDocumentSource,
    parseCurrentLink,
    uploadFile,
    parseLinkMutation,
    parseFileMutation,
    applyParsedDocument,
  }
}

export type JuryWorkbenchProps = {
  variant?: 'web' | 'popup'
}

export function JuryWorkbench({ variant = 'web' }: JuryWorkbenchProps) {
  const navigate = useNavigate()
  const { draft, setDraft } = useWizardStore()
  const [selectedAudienceKeys, setSelectedAudienceKeys] = useState<string[]>(draft.selectedAudienceKeys)
  const [selectedCustomKeys, setSelectedCustomKeys] = useState<string[]>([])
  const [customAudiences, setCustomAudiences] = useState<CustomAudience[]>([])
  const [composerOpen, setComposerOpen] = useState(false)
  const [juryOpen, setJuryOpen] = useState(false)
  const [draftChips, setDraftChips] = useState<string[]>([])
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(variant === 'popup' ? POPUP_METRICS.slice(0, 4) : METRICS.slice(0, 4))
  const [selectedModelProvider, setSelectedModelProvider] = useState<AIModelProvider>('deepseek')
  const [customMetrics, setCustomMetrics] = useState<string[]>([])
  const [metricComposerOpen, setMetricComposerOpen] = useState(false)
  const [metricDraftName, setMetricDraftName] = useState('')
  const [metricDraftMeaning, setMetricDraftMeaning] = useState('')
  const [audienceSearch, setAudienceSearch] = useState('')
  const [metricSearch, setMetricSearch] = useState('')
  const [webAudienceDropdownOpen, setWebAudienceDropdownOpen] = useState(false)
  const [webMetricDropdownOpen, setWebMetricDropdownOpen] = useState(false)
  const [popupAudienceDropdownOpen, setPopupAudienceDropdownOpen] = useState(false)
  const [popupMetricDropdownOpen, setPopupMetricDropdownOpen] = useState(false)
  const [expandedTagGroups, setExpandedTagGroups] = useState<string[]>(['八大人群', '电商用户生命周期', '年龄'])
  const [editingCustomKey, setEditingCustomKey] = useState<string | null>(null)
  const [detail, setDetail] = useState<AudienceDetail | null>(null)
  const webAudienceDropdownRef = useRef<HTMLDivElement | null>(null)
  const webMetricDropdownRef = useRef<HTMLDivElement | null>(null)
  const popupAudienceDropdownRef = useRef<HTMLDivElement | null>(null)
  const popupMetricDropdownRef = useRef<HTMLDivElement | null>(null)
  const doc = useDocumentState()
  const audiencesQuery = useQuery({ queryKey: ['audiences'], queryFn: api.listAudiences })
  const isPopup = variant === 'popup'

  useEffect(() => {
    void safeLogEvent('jury_capsule_exposed', { page: variant === 'popup' ? 'popup_workbench' : 'jury_workbench' })
  }, [variant])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!webAudienceDropdownRef.current?.contains(target)) {
        setWebAudienceDropdownOpen(false)
      }
      if (!webMetricDropdownRef.current?.contains(target)) {
        setWebMetricDropdownOpen(false)
      }
      if (!popupAudienceDropdownRef.current?.contains(target)) {
        setPopupAudienceDropdownOpen(false)
      }
      if (!popupMetricDropdownRef.current?.contains(target)) {
        setPopupMetricDropdownOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  useEffect(() => {
    setDraft({
      documentTitle: doc.effectiveDocumentTitle,
      documentContent: doc.effectiveDocumentContent,
      selectedAudienceKeys,
      manualMode: variant === 'popup',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.effectiveDocumentTitle, doc.effectiveDocumentContent, selectedAudienceKeys, variant])

  const audienceSource = useMemo(() => {
    const data = audiencesQuery.data ?? []
    return data.length ? data : FALLBACK_AUDIENCES
  }, [audiencesQuery.data])

  const selectedFallbackAudiences = useMemo(
    () => audienceSource.filter((item) => item.source === 'frontend_fallback' && selectedAudienceKeys.includes(item.key)),
    [audienceSource, selectedAudienceKeys],
  )

  const selectedAudiences = useMemo(
    () => audienceSource.filter((item) => selectedAudienceKeys.includes(item.key)),
    [audienceSource, selectedAudienceKeys],
  )

  const selectedTaxonomyLabels = useMemo(
    () => selectedAudienceKeys.filter((key) => key.startsWith('taxonomy_')).map((key) => key.replace(/^taxonomy_/, '')),
    [selectedAudienceKeys],
  )

  const selectedCustomAudiences = useMemo(
    () => customAudiences.filter((audience) => selectedCustomKeys.includes(audience.key)),
    [customAudiences, selectedCustomKeys],
  )

  const visibleAudiences = useMemo(() => {
    const query = audienceSearch.trim()
    if (!query) return audienceSource
    return audienceSource.filter((audience) => `${audience.name} ${audience.definition}`.includes(query))
  }, [audienceSearch, audienceSource])

  const visibleCustomAudiences = useMemo(() => {
    const query = audienceSearch.trim()
    if (!query) return customAudiences
    return customAudiences.filter((audience) => `${audience.name} ${audience.definition} ${audience.chips.join(' ')}`.includes(query))
  }, [audienceSearch, customAudiences])

  const visibleAudienceGroups = useMemo(() => {
    const query = audienceSearch.trim()
    if (!query) return AUDIENCE_TAXONOMY
    return AUDIENCE_TAXONOMY
      .map((group) => {
        const groupMatch = group.name.includes(query)
        const values = groupMatch ? group.values : group.values.filter((value) => value.includes(query))
        return values.length ? { ...group, values } : null
      })
      .filter((group): group is TagGroup => Boolean(group))
  }, [audienceSearch])

  const visibleMetricGroups = useMemo(() => {
    const query = metricSearch.trim()
    if (!query) return METRIC_GROUPS
    return METRIC_GROUPS
      .map((group) => {
        const groupMatch = group.name.includes(query)
        const values = groupMatch ? group.values : group.values.filter((value) => value.includes(query))
        return values.length ? { ...group, values } : null
      })
      .filter((group): group is TagGroup => Boolean(group))
  }, [metricSearch])

  const visibleCustomMetrics = useMemo(() => {
    const query = metricSearch.trim()
    if (!query) return customMetrics
    return customMetrics.filter((metric) => metric.includes(query))
  }, [customMetrics, metricSearch])

  const popupAudienceGroups = useMemo(() => {
    if (!isPopup) return []
    const query = audienceSearch.trim()
    const customValues = customAudiences.map((audience) => audience.name)
    return POPUP_AUDIENCE_TAXONOMY
      .map((group) => {
        const sourceValues = group.name === '其他标签' ? customValues : group.values
        const groupMatch = group.name.includes(query)
        const values = !query || groupMatch ? sourceValues : sourceValues.filter((value) => value.includes(query))
        return values.length ? { ...group, values } : null
      })
      .filter((group): group is TagGroup => Boolean(group))
  }, [audienceSearch, customAudiences, isPopup])

  const parseStatus = doc.parseLinkMutation.isPending || doc.parseFileMutation.isPending
    ? { label: '正在解析文档', width: '65%', tone: 'bg-blue-500' }
    : doc.documentNotice.includes('成功')
      ? { label: '已上传并解析成功', width: '100%', tone: 'bg-emerald-500' }
      : doc.documentNotice
        ? { label: '等待补充正文或重新上传', width: '38%', tone: 'bg-amber-400' }
        : { label: '等待上传或粘贴 PRD 链接', width: '0%', tone: 'bg-slate-300' }

  const totalAudienceCount = selectedAudienceKeys.length + selectedCustomKeys.length
  const canRun = doc.effectiveDocumentTitle.trim().length > 0 && doc.effectiveDocumentContent.trim().length >= 20 && totalAudienceCount >= 1 && totalAudienceCount <= 5 && selectedMetrics.length >= 1
  const disabledReason = !doc.effectiveDocumentTitle.trim() || doc.effectiveDocumentContent.trim().length < 20
    ? '文档未加载完成'
    : totalAudienceCount < 1
      ? '请先选择至少 1 个陪审团标签'
      : totalAudienceCount > 5
        ? '最多选择 5 个用户群'
        : selectedMetrics.length < 1
          ? '请至少选择 1 个观察指标'
          : ''

  const runAnalysisMutation = useMutation({
    mutationFn: async ({ target }: { target: 'quick' | 'full' }) => {
      const manualAudiences = selectedCustomAudiences.map((audience) => ({
        name: audience.name,
        definition: audience.definition,
        conversion_trait: audience.conversion_trait,
        dwell_trait: audience.dwell_trait,
        dropoff_points: parseLines(audience.dropoff_points),
        content_preferences: parseLines(audience.content_preferences),
      }))
      const fallbackManualAudiences = selectedFallbackAudiences.map((audience) => ({
        name: audience.name,
        definition: audience.definition,
        conversion_trait: audience.behavior_summary.conversion_trait,
        dwell_trait: audience.behavior_summary.dwell_trait,
        dropoff_points: audience.behavior_summary.dropoff_points,
        content_preferences: audience.behavior_summary.content_preferences,
      }))
      const popupTaxonomyAudiences = isPopup
        ? selectedAudienceKeys.map((key) => {
            const label = key.replace(/^taxonomy_/, '')
            return {
              ...buildManualAudience(label, [label]),
            }
          })
        : []
      const selectedBackendKeys = isPopup ? [] : selectedAudienceKeys.filter((key) => !selectedFallbackAudiences.some((audience) => audience.key === key))
      const job = await api.runAnalysis({
        document: {
          title: doc.effectiveDocumentTitle.trim(),
          content: doc.effectiveDocumentContent.trim(),
          host: doc.effectiveDocumentSource.host,
          source_mode: doc.effectiveDocumentSource.sourceMode,
        },
        selected_audience_keys: selectedBackendKeys,
        manual_audiences: [...fallbackManualAudiences, ...popupTaxonomyAudiences, ...manualAudiences],
        selected_metrics: selectedMetrics,
        model_reasoning_effort: target === 'quick' ? 'low' : 'medium',
        ai_model_provider: selectedModelProvider,
      })
      return { job, target }
    },
    onSuccess: async ({ job, target }) => {
      await safeLogEvent('jury_report_generated', { job_id: job.id, audience_count: totalAudienceCount, metrics: selectedMetrics, model_provider: selectedModelProvider })
      navigate(target === 'full' ? `/analysis/${job.id}` : `/quick-feedback/${job.id}`)
    },
    onError: async (error) => {
      await safeLogEvent('jury_report_failed', { message: error instanceof Error ? error.message : 'unknown_error' })
    },
  })

  const toggleAudience = async (key: string) => {
    setSelectedAudienceKeys((current) => {
      const exists = current.includes(key)
      if (exists) return current.filter((item) => item !== key)
      if (current.length + selectedCustomKeys.length >= 5) return current
      return [...current, key]
    })
    await safeLogEvent('jury_audience_selected', { audience_key: key })
  }

  const toggleTaxonomyAudience = async (label: string) => {
    const key = `taxonomy_${label}`
    setSelectedAudienceKeys((current) => {
      const exists = current.includes(key)
      if (exists) return current.filter((item) => item !== key)
      if (current.length + selectedCustomKeys.length >= 5) return current
      return [...current, key]
    })
    await safeLogEvent('jury_audience_selected', { audience_key: key, source: 'taxonomy' })
  }

  const toggleCustomAudience = async (key: string) => {
    setSelectedCustomKeys((current) => {
      const exists = current.includes(key)
      if (exists) return current.filter((item) => item !== key)
      if (selectedAudienceKeys.length + current.length >= 5) return current
      return [...current, key]
    })
    await safeLogEvent('jury_audience_selected', { audience_key: key, source: 'custom' })
  }

  const toggleDraftChip = (chip: string) => {
    setDraftChips((current) => current.includes(chip) ? current.filter((item) => item !== chip) : [...current, chip])
  }

  const toggleMetric = (metric: string) => {
    setSelectedMetrics((current) => current.includes(metric) ? current.filter((item) => item !== metric) : [...current, metric])
  }

  const completeCustomMetric = () => {
    const name = metricDraftName.trim()
    const meaning = metricDraftMeaning.trim()
    if (!name || !meaning) return
    const label = `${name}（${meaning}）`
    setCustomMetrics((current) => current.includes(label) ? current : [...current, label])
    setSelectedMetrics((current) => current.includes(label) ? current : [...current, label])
    setMetricDraftName('')
    setMetricDraftMeaning('')
    setMetricComposerOpen(false)
  }

  const completeCustomAudience = async () => {
    if (!draftChips.length) return
    if (editingCustomKey) {
      setCustomAudiences((current) => current.map((audience) => {
        if (audience.key !== editingCustomKey) return audience
        return { ...audience, ...buildManualAudience(audience.name, draftChips), chips: draftChips }
      }))
      setEditingCustomKey(null)
    } else {
      const name = `自定义标签${customAudiences.length + 1}`
      const key = `custom_${Date.now()}`
      setCustomAudiences((current) => [...current, { key, chips: draftChips, ...buildManualAudience(name, draftChips) }])
      setSelectedCustomKeys((current) => current.length + selectedAudienceKeys.length < 5 ? [...current, key] : current)
    }
    setDraftChips([])
    setComposerOpen(false)
    await safeLogEvent('jury_custom_audience_completed', { chip_count: draftChips.length })
  }

  const editCustomAudience = (audience: CustomAudience) => {
    setDraftChips(audience.chips)
    setEditingCustomKey(audience.key)
    setComposerOpen(true)
    setJuryOpen(true)
    setDetail(null)
  }

  const deleteCustomAudience = (key: string) => {
    setCustomAudiences((current) => current.filter((audience) => audience.key !== key))
    setSelectedCustomKeys((current) => current.filter((item) => item !== key))
    setDetail(null)
    if (editingCustomKey === key) {
      setEditingCustomKey(null)
      setDraftChips([])
      setComposerOpen(false)
    }
  }

  const cloneDefaultAudience = (audience: AudienceDefinition) => {
    const name = `自定义标签${customAudiences.length + 1}`
    const key = `custom_${Date.now()}`
    const chips = [audience.name, ...audience.behavior_summary.content_preferences.slice(0, 2)]
    setCustomAudiences((current) => [
      ...current,
      {
        key,
        name,
        definition: audience.definition,
        conversion_trait: audience.behavior_summary.conversion_trait,
        dwell_trait: audience.behavior_summary.dwell_trait,
        dropoff_points: audience.behavior_summary.dropoff_points,
        content_preferences: audience.behavior_summary.content_preferences,
        chips,
      },
    ])
    setDraftChips(chips)
    setEditingCustomKey(key)
    setComposerOpen(true)
    setJuryOpen(true)
    setDetail(null)
  }

  const openPicker = () => {
    setJuryOpen(true)
    setComposerOpen(false)
  }

  const openComposer = () => {
    setJuryOpen(true)
    setComposerOpen(true)
  }

  const openWebAudienceDropdown = () => {
    setWebAudienceDropdownOpen(true)
    setWebMetricDropdownOpen(false)
  }

  const openWebMetricDropdown = () => {
    setWebMetricDropdownOpen(true)
    setWebAudienceDropdownOpen(false)
  }

  const openPopupAudienceDropdown = () => {
    setPopupAudienceDropdownOpen(true)
    setPopupMetricDropdownOpen(false)
  }

  const openPopupMetricDropdown = () => {
    setPopupMetricDropdownOpen(true)
    setPopupAudienceDropdownOpen(false)
  }

  const toggleExpandedTagGroup = (name: string) => {
    setExpandedTagGroups((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name])
  }

  const addTaxonomyAudience = (label: string) => {
    const key = `custom_${Date.now()}_${label}`
    const audience = { key, chips: [label], ...buildManualAudience(label, [label]) }
    setCustomAudiences((current) => current.some((item) => item.name === label) ? current : [...current, audience])
    setSelectedCustomKeys((current) => {
      const existing = customAudiences.find((item) => item.name === label)
      const targetKey = existing?.key ?? key
      if (current.includes(targetKey)) return current
      if (selectedAudienceKeys.length + current.length >= 5) return current
      return [...current, targetKey]
    })
  }

  const shellClass = isPopup
    ? 'min-h-screen bg-[#eef1f6] p-0 text-slate-900'
    : 'relative mx-auto max-w-6xl'
  const panelClass = isPopup
    ? 'relative min-h-screen overflow-hidden bg-[#f2f4f8]'
    : 'relative mx-auto max-w-6xl'

  const renderModelSelector = (compact = false) => (
    <div className={cn('rounded-xl border border-slate-200 bg-white p-2', compact ? 'w-full' : 'min-w-[300px]')}>
      <div className="mb-2 px-1 text-xs font-medium text-slate-500">AI 模型</div>
      <div className="grid grid-cols-3 gap-1">
        {AI_MODEL_OPTIONS.map((option) => {
          const active = selectedModelProvider === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setSelectedModelProvider(option.value)}
              className={cn(
                'rounded-lg px-2 py-2 text-xs font-semibold transition',
                active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100',
              )}
              title={option.description}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className={shellClass}>
      <div className={panelClass}>
        <div className={cn('grid gap-6 transition-all duration-300', !isPopup && juryOpen ? 'xl:grid-cols-[minmax(0,1fr)_360px]' : 'xl:grid-cols-1')}>
          <main className={cn('space-y-5', isPopup && 'min-h-screen bg-[#f2f4f8]')}>
            {isPopup ? (
              <>
                <div className="flex h-12 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#2f6bff] text-white">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{doc.effectiveDocumentTitle || '召集用户陪审团 doc'}</div>
                      <div className="text-xs text-slate-500">云文档 · 最近编辑于 10:24 · 已保存</div>
                    </div>
                  </div>
                  <div className="hidden items-center gap-2 text-xs text-slate-500 md:flex">
                    {['文件', '编辑', '插入', '格式', '工具', '帮助'].map((item) => <span key={item} className="px-1">{item}</span>)}
                    <span className="ml-2 rounded-md bg-slate-100 px-2 py-1">100%</span>
                    <span className="rounded-md bg-blue-600 px-3 py-1 text-white">分享</span>
                  </div>
                </div>
                <div className="flex h-10 items-center gap-1 border-b border-slate-200 bg-white px-20 text-xs text-slate-500 shadow-[0_1px_0_rgba(15,23,42,0.03)] max-md:hidden">
                  {['撤销', '重做', '正文', '14', 'B', 'I', 'U', '链接', '评论', '对齐', '项目符号'].map((item) => <span key={item} className="rounded px-2 py-1 hover:bg-slate-100">{item}</span>)}
                </div>
                <div className="fixed left-0 top-12 z-10 hidden h-[calc(100vh-3rem)] w-14 flex-col items-center gap-3 border-r border-slate-200 bg-white py-4 text-slate-400 md:flex">
                  {['文', '评', '表', '图', '⋯'].map((item) => <span key={item} className="flex h-8 w-8 items-center justify-center rounded-lg text-xs hover:bg-slate-100">{item}</span>)}
                </div>
              </>
            ) : null}

            {false && !isPopup ? (
            <Card className="rounded-2xl p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-5">
                  <div className="flex items-center gap-3">
                    <Link2 className="h-5 w-5 text-blue-600" />
                    <div>
                      <div className="font-semibold text-slate-900">粘贴 PRD 链接</div>
                      <div className="mt-1 text-sm text-slate-500">解析 PRD，智能提取关键信息</div>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Input
                      className="bg-white"
                      value={doc.prdLink}
                      onChange={(event) => doc.setPrdLink(event.target.value)}
                      placeholder="输入公开可访问的 PRD 链接"
                    />
                    <Button className="shrink-0 bg-blue-600 hover:bg-blue-700" disabled={doc.parseLinkMutation.isPending} onClick={doc.parseCurrentLink}>
                      {doc.parseLinkMutation.isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                      解析
                    </Button>
                  </div>
                </div>
                <div
                  className="rounded-xl border border-slate-200 bg-white p-5"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault()
                    doc.uploadFile(event.dataTransfer.files[0])
                  }}
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <div>
                      <div className="font-semibold text-slate-900">上传本地文档</div>
                      <div className="mt-1 text-sm text-slate-500">支持 PDF / DOCX / TXT / MD 格式</div>
                    </div>
                  </div>
                  <label className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                    <Upload className="h-4 w-4" />
                    {doc.parseFileMutation.isPending ? '正在解析...' : '点击或拖拽文件上传'}
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.docx,.txt,.md"
                      onChange={(event) => doc.uploadFile(event.target.files?.[0])}
                    />
                  </label>
                </div>
              </div>
              {doc.documentNotice ? (
                <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-700">
                  {doc.documentNotice}
                </div>
              ) : null}
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>{parseStatus.label}</span>
                  <span>{parseStatus.width}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                  <div className={cn('h-full rounded-full transition-all', parseStatus.tone)} style={{ width: parseStatus.width }} />
                </div>
              </div>
            </Card>
            ) : null}

            <Card className={cn('p-5', !isPopup && 'hidden rounded-2xl', isPopup && 'mx-auto mt-7 min-h-[calc(100vh-9rem)] w-[min(850px,calc(100vw-148px))] rounded-sm border border-slate-100 bg-white px-16 py-12 shadow-[0_10px_34px_rgba(15,23,42,0.10)] max-md:w-[calc(100vw-32px)] max-md:px-6')}>
              <div className={cn('flex flex-wrap items-start justify-between gap-3', isPopup && 'sr-only')}>
                <SectionTitle title="PRD 内容预览 / 编辑" description="确认本次分析范围，必要时可直接修正文档片段。" />
                <GhostButton onClick={() => doc.documentQuery.refetch()} disabled={doc.documentQuery.isFetching}>
                  <RefreshCcw className={cn('mr-2 h-4 w-4', doc.documentQuery.isFetching && 'animate-spin')} />刷新文档
                </GhostButton>
              </div>
              <div className="mt-5 grid gap-4">
                <div>
                  <Label>{isPopup ? '标题' : '文档标题'}</Label>
                  <Input value={doc.effectiveDocumentTitle} onChange={(event) => doc.setDocumentTitle(event.target.value)} placeholder="当前 PRD 标题" className={cn(isPopup && 'border-0 px-0 text-4xl font-semibold tracking-normal focus:border-0 max-md:text-3xl')} />
                </div>
                <div>
                  <Label>{isPopup ? '正文' : '文档内容'}</Label>
                  <Textarea rows={isPopup ? 22 : 13} value={doc.effectiveDocumentContent} onChange={(event) => doc.setDocumentContent(event.target.value)} className={cn('resize-y font-mono text-xs leading-6', isPopup && 'min-h-[560px] resize-none border-0 px-0 text-base leading-8 focus:border-0')} />
                </div>
              </div>
            </Card>

            {variant === 'web' ? (
              <>
                <Card className="rounded-2xl p-5">
                  <SectionTitle title="上传 PRD / 预览编辑" description="链接、文件上传和文档正文统一在这里维护，作为本次分析输入。" />
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-5">
                      <div className="flex items-center gap-3">
                        <Link2 className="h-5 w-5 text-blue-600" />
                        <div>
                          <div className="font-semibold text-slate-900">粘贴 PRD 链接</div>
                          <div className="mt-1 text-sm text-slate-500">解析 PRD，智能提取关键信息</div>
                        </div>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <Input className="bg-white" value={doc.prdLink} onChange={(event) => doc.setPrdLink(event.target.value)} placeholder="输入公开可访问的 PRD 链接" />
                        <Button className="shrink-0 bg-blue-600 hover:bg-blue-700" disabled={doc.parseLinkMutation.isPending} onClick={doc.parseCurrentLink}>
                          {doc.parseLinkMutation.isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                          解析
                        </Button>
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-5" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); doc.uploadFile(event.dataTransfer.files[0]) }}>
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-blue-600" />
                        <div>
                          <div className="font-semibold text-slate-900">上传本地文档</div>
                          <div className="mt-1 text-sm text-slate-500">支持 PDF / DOCX / TXT / MD 格式</div>
                        </div>
                      </div>
                      <label className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                        <Upload className="h-4 w-4" />
                        {doc.parseFileMutation.isPending ? '正在解析...' : '点击或拖拽文件上传'}
                        <input type="file" className="hidden" accept=".pdf,.docx,.txt,.md" onChange={(event) => doc.uploadFile(event.target.files?.[0])} />
                      </label>
                    </div>
                  </div>
                  {doc.documentNotice ? <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-700">{doc.documentNotice}</div> : null}
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between text-xs font-medium text-slate-500"><span>{parseStatus.label}</span><span>{parseStatus.width}</span></div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white"><div className={cn('h-full rounded-full transition-all', parseStatus.tone)} style={{ width: parseStatus.width }} /></div>
                  </div>
                  <div className="mt-5 grid gap-4">
                    <div>
                      <Label>文档标题</Label>
                      <Input value={doc.effectiveDocumentTitle} onChange={(event) => doc.setDocumentTitle(event.target.value)} placeholder="当前 PRD 标题" />
                    </div>
                    <div>
                      <Label>文档内容</Label>
                      <Textarea rows={3} value={doc.effectiveDocumentContent} onChange={(event) => doc.setDocumentContent(event.target.value)} className="max-h-32 resize-y font-mono text-xs leading-6" />
                    </div>
                  </div>
                </Card>

                <Card className="rounded-2xl p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <SectionTitle title="选择用户陪审团" description="先选常用人群，也可以按分类标准或具体标签搜索。" />
                    <GhostButton onClick={openComposer} className="shrink-0 border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100">
                      <Plus className="mr-2 h-4 w-4" />
                      创建自定义用户标签
                    </GhostButton>
                  </div>
                  <div className="mt-5 grid gap-3 md:grid-cols-4">
                    {audienceSource.slice(0, 4).map((audience, index) => {
                      const active = selectedAudienceKeys.includes(audience.key)
                      return (
                        <button
                          key={audience.key}
                          type="button"
                          onClick={() => void toggleAudience(audience.key)}
                          className={cn(
                            'flex min-h-16 items-center gap-3 rounded-xl border p-4 text-left transition',
                            active ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-slate-200 bg-slate-50/70 hover:border-blue-200 hover:bg-white',
                          )}
                        >
                          <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', audienceIcons[index % audienceIcons.length])}>
                            <Users className="h-5 w-5" />
                          </span>
                          <span className="min-w-0">
                            <span className="flex items-center gap-1 font-medium text-slate-900">
                              {audience.name}
                              {active ? <Check className="h-4 w-4 text-blue-600" /> : null}
                            </span>
                            <span className="line-clamp-1 text-xs text-slate-500">{audience.definition}</span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  <div ref={webAudienceDropdownRef} className="relative mt-5">
                    <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2">
                      <Search className="h-4 w-4 text-slate-400" />
                      <input
                        value={audienceSearch}
                        onFocus={openWebAudienceDropdown}
                        onClick={openWebAudienceDropdown}
                        onChange={(event) => setAudienceSearch(event.target.value)}
                        className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-slate-400"
                        placeholder="搜索分类标准或用户标签，例如：八大人群 / 小镇青年 / 写评新用户"
                      />
                      {audienceSearch ? (
                        <button type="button" onClick={() => setAudienceSearch('')} className="text-slate-400 hover:text-slate-700">
                          <X className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                    {webAudienceDropdownOpen ? (
                    <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 grid max-h-80 gap-3 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-xl shadow-slate-900/10 lg:grid-cols-2">
                    {visibleAudienceGroups.map((group) => (
                      <div key={group.name} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <div className="text-sm font-semibold text-slate-800">{group.name}</div>
                          <div className="text-xs text-slate-400">{group.values.length} 个标签</div>
                        </div>
                        <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto">
                          {group.values.map((label) => {
                            const active = selectedCustomAudiences.some((audience) => audience.name === label)
                            return (
                              <button
                                key={label}
                                type="button"
                                onClick={() => addTaxonomyAudience(label)}
                                className={cn('rounded-full px-3 py-1.5 text-xs font-medium transition', active ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-blue-200')}
                              >
                                {label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                    {customAudiences.length ? (
                      <div className="rounded-xl border border-violet-100 bg-violet-50/70 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <div className="text-sm font-semibold text-slate-800">其他标签</div>
                          <div className="text-xs text-slate-400">{customAudiences.length} 个标签</div>
                        </div>
                        <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto">
                          {customAudiences.map((audience) => {
                            const active = selectedCustomKeys.includes(audience.key)
                            return (
                              <button key={audience.key} type="button" onClick={() => void toggleCustomAudience(audience.key)} className={cn('rounded-full px-3 py-1.5 text-xs font-medium transition', active ? 'bg-violet-700 text-white' : 'bg-white text-violet-700 ring-1 ring-violet-100 hover:ring-violet-200')}>
                                {audience.name}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                    ) : null}
                  </div>
                  <div className="mt-5 rounded-xl border border-slate-200 bg-white p-3">
                    <div className="text-sm font-medium text-slate-900">已选标签</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedAudiences.map((audience) => <Badge key={audience.key}>{audience.name}</Badge>)}
                      {selectedTaxonomyLabels.map((label) => <Badge key={label}>{label}</Badge>)}
                      {selectedCustomAudiences.map((audience) => <Badge key={audience.key} className="bg-violet-100 text-violet-700">{audience.name}</Badge>)}
                      {!selectedAudiences.length && !selectedTaxonomyLabels.length && !selectedCustomAudiences.length ? <span className="text-sm text-slate-400">请选择 1-5 个用户标签。</span> : null}
                    </div>
                  </div>
                </Card>

                <Card className="rounded-2xl p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <SectionTitle title="选择观察指标" description="选择本次报告关注的规模、活跃、留存指标。" />
                    <GhostButton className="shrink-0 border-slate-200 text-slate-600" onClick={() => setMetricComposerOpen(true)}>
                      <Upload className="mr-2 h-4 w-4" />
                      导入自定义指标组合
                    </GhostButton>
                  </div>
                  <div ref={webMetricDropdownRef} className="relative mt-5">
                    <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2">
                      <Search className="h-4 w-4 text-slate-400" />
                      <input
                        value={metricSearch}
                        onFocus={openWebMetricDropdown}
                        onClick={openWebMetricDropdown}
                        onChange={(event) => setMetricSearch(event.target.value)}
                        className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-slate-400"
                        placeholder="搜索观察指标，例如：DAU / 跳出率 / 7日留存率"
                      />
                      {metricSearch ? (
                        <button type="button" onClick={() => setMetricSearch('')} className="text-slate-400 hover:text-slate-700">
                          <X className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                    {webMetricDropdownOpen ? (
                    <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 grid max-h-80 gap-3 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-xl shadow-slate-900/10 lg:grid-cols-3">
                    {visibleMetricGroups.map((group) => (
                      <div key={group.name} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                        <div className="mb-2 text-sm font-semibold text-slate-800">{group.name}</div>
                        <div className="flex flex-wrap gap-2">
                          {group.values.map((metric) => {
                            const active = selectedMetrics.includes(metric)
                            return (
                              <button
                                key={metric}
                                type="button"
                                onClick={() => toggleMetric(metric)}
                                className={cn('rounded-full px-3 py-1.5 text-xs font-medium transition', active ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-blue-200')}
                              >
                                {metric}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                    {visibleCustomMetrics.length ? (
                      <div className="rounded-xl border border-violet-100 bg-violet-50/70 p-3">
                        <div className="mb-2 text-sm font-semibold text-slate-800">自定义指标</div>
                        <div className="flex flex-wrap gap-2">
                          {visibleCustomMetrics.map((metric) => {
                            const active = selectedMetrics.includes(metric)
                            return (
                              <button key={metric} type="button" onClick={() => toggleMetric(metric)} className={cn('rounded-full px-3 py-1.5 text-xs font-medium transition', active ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-violet-100 hover:ring-violet-200')}>
                                {metric}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                    ) : null}
                  </div>
                  <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                    <div className="text-sm font-medium text-slate-900">已选观察指标</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedMetrics.map((metric) => (
                        <button key={metric} type="button" onClick={() => toggleMetric(metric)} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100">
                          {metric}
                          <X className="h-3 w-3" />
                        </button>
                      ))}
                      {!selectedMetrics.length ? <span className="text-sm text-slate-400">请选择至少 1 个观察指标。</span> : null}
                    </div>
                  </div>
                </Card>
              </>
            ) : null}

            {!isPopup ? (
            <div className="sticky bottom-0 z-10 -mx-2 border-t border-slate-200 bg-white/90 px-2 py-4 backdrop-blur">
              <div className="flex flex-col gap-3 rounded-2xl bg-white md:flex-row md:items-center md:justify-between">
                <div className="text-sm font-medium text-slate-700">
                  已选择 {totalAudienceCount} 类陪审团，{selectedMetrics.length} 个观察指标，预计 30 秒生成快速反馈。
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {renderModelSelector()}
                  <Button className="bg-blue-600 shadow-lg shadow-blue-600/20 hover:bg-blue-700" disabled={!canRun || runAnalysisMutation.isPending} onClick={() => runAnalysisMutation.mutate({ target: 'full' })} title={!canRun ? disabledReason : '进入完整分析'}>
                    {runAnalysisMutation.isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <BarChart3 className="mr-2 h-4 w-4" />}
                    进入完整分析
                  </Button>
                  <GhostButton disabled={!canRun || runAnalysisMutation.isPending} onClick={() => runAnalysisMutation.mutate({ target: 'quick' })}>
                    <BarChart3 className="mr-2 h-4 w-4" />
                    生成快速反馈
                  </GhostButton>
                </div>
              </div>
            </div>
            ) : null}

            {isPopup && !juryOpen ? (
              <button
                type="button"
                onClick={openPicker}
                className="fixed right-6 top-1/2 z-20 flex -translate-y-1/2 items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 text-left shadow-xl shadow-slate-900/12 backdrop-blur hover:border-blue-200 max-md:right-3 max-md:h-12 max-md:w-12 max-md:justify-center max-md:rounded-full max-md:px-0 max-md:py-0"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 max-md:h-8 max-md:w-8">
                  <Users className="h-5 w-5" />
                </span>
                <span className="max-md:hidden">
                  <span className="block text-sm font-semibold text-slate-900">用户陪审团</span>
                  <span className="mt-1 block text-sm text-slate-500">选择标签或创建自定义用户标签</span>
                </span>
              </button>
            ) : null}
          </main>

          {juryOpen && (isPopup || !composerOpen) ? (
            <aside className={isPopup ? 'fixed inset-0 z-40 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-[2px]' : 'fixed inset-y-0 right-0 z-30 w-full max-w-md overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-2xl shadow-slate-900/15 xl:sticky xl:top-8 xl:max-h-[calc(100vh-4rem)] xl:w-auto xl:rounded-3xl xl:border xl:shadow-sm'}>
              <div className={isPopup ? 'flex max-h-[min(760px,calc(100vh-2rem))] w-full max-w-[520px] flex-col overflow-hidden rounded-lg bg-white shadow-2xl shadow-slate-950/25' : ''}>
                <div className={cn(isPopup && 'bg-[#4f6df5] px-4 py-3 text-white')}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className={cn('text-lg font-semibold', isPopup ? 'text-white' : 'text-slate-900')}>{composerOpen ? '创建自定义用户标签' : '用户陪审团'}</h2>
                    {!isPopup ? <p className="mt-1 text-sm text-slate-500">{composerOpen ? '按需组合标签，精准定义你的陪审团' : '选择 1-5 个目标用户群参与分析'}</p> : null}
                  </div>
                  <button type="button" onClick={() => setJuryOpen(false)} className={cn('rounded-xl p-2', isPopup ? 'text-white/80 hover:bg-white/10 hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700')}>
                    <X className="h-5 w-5" />
                  </button>
                </div>
                </div>

                <div className={cn(isPopup && 'overflow-y-auto px-4 pb-4')}>
                {!isPopup ? <Card className="mt-5 border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-none">
                  <div className="flex gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>只做判断，不给优化建议；风险指数是 0-100 的方向性估算。</div>
                  </div>
                </Card> : null}

                <div className={cn('mt-5 flex rounded-xl bg-slate-100 p-1 text-sm font-medium', isPopup && 'hidden')}>
                  <button type="button" onClick={() => setComposerOpen(false)} className={cn('flex-1 rounded-lg px-3 py-2', !composerOpen ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}>
                    用户群
                  </button>
                  <button type="button" onClick={() => setComposerOpen(true)} className={cn('flex-1 rounded-lg px-3 py-2', composerOpen ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}>
                    自定义
                  </button>
                </div>

                {!composerOpen ? (
                  <div className={cn('mt-5', isPopup ? 'space-y-5' : 'space-y-3')}>
                    <div ref={isPopup ? popupAudienceDropdownRef : undefined} className="relative">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-900">用户标签选择</div>
                        <button type="button" onClick={openComposer} className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700">
                          <Plus className="h-3.5 w-3.5" />
                          创建自定义用户标签
                        </button>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg border border-blue-300 bg-white px-3 py-2 shadow-sm shadow-blue-100">
                        <Search className="h-4 w-4 text-slate-400" />
                        <input
                          value={audienceSearch}
                          onFocus={isPopup ? openPopupAudienceDropdown : undefined}
                          onClick={isPopup ? openPopupAudienceDropdown : undefined}
                          onChange={(event) => setAudienceSearch(event.target.value)}
                          className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-slate-400"
                          placeholder="搜索或选择用户标签..."
                        />
                        {audienceSearch ? (
                          <button type="button" onClick={() => setAudienceSearch('')} className="text-slate-400 hover:text-slate-700">
                            <X className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                      {isPopup && popupAudienceDropdownOpen ? (
                        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-40 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 shadow-xl shadow-slate-900/10">
                          <div className="space-y-3">
                            {popupAudienceGroups.map((group) => (
                              <div key={group.name}>
                                <div className="mb-2 flex items-center justify-between text-xs">
                                  <span className="font-semibold text-slate-700">{group.name}</span>
                                  <span className="text-slate-400">{group.values.length}</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {group.values.map((label) => {
                                    const customAudience = customAudiences.find((audience) => audience.name === label)
                                    const customActive = customAudience ? selectedCustomKeys.includes(customAudience.key) : false
                                    const active = selectedAudienceKeys.includes(`taxonomy_${label}`) || customActive
                                    const atLimit = !active && totalAudienceCount >= 5
                                    return (
                                      <button
                                        key={`${group.name}-${label}`}
                                        type="button"
                                        disabled={atLimit}
                                        onClick={() => customAudience ? void toggleCustomAudience(customAudience.key) : void toggleTaxonomyAudience(label)}
                                        className={cn(
                                          'rounded-full px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed',
                                          active ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300',
                                          atLimit && 'opacity-50',
                                        )}
                                      >
                                        {label}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            ))}
                            {!popupAudienceGroups.length ? <div className="py-6 text-center text-sm text-slate-500">没有匹配的用户标签</div> : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                    {!isPopup ? (
                    <div className="space-y-3">
                      <div className="space-y-3">
                        {visibleAudienceGroups.map((group) => (
                          <div key={group.name} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <div className="mb-2 flex items-center justify-between">
                              <div className="text-sm font-semibold text-slate-800">{group.name}</div>
                              <div className="text-xs text-slate-400">{group.values.length}</div>
                            </div>
                            <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto">
                              {group.values.map((label) => {
                                const active = selectedCustomAudiences.some((audience) => audience.name === label)
                                return (
                                  <button key={label} type="button" onClick={() => addTaxonomyAudience(label)} className={cn('rounded-full px-3 py-1.5 text-xs font-medium transition', active ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-blue-200')}>
                                    {label}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    {!isPopup ? visibleAudiences.map((audience) => {
                      const active = selectedAudienceKeys.includes(audience.key)
                      const atLimit = !active && totalAudienceCount >= 5
                      return isPopup ? (
                        <button
                          key={audience.key}
                          type="button"
                          disabled={atLimit}
                          onClick={() => void toggleAudience(audience.key)}
                          className={cn(
                            'rounded-full px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed',
                            active ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300',
                            atLimit && 'opacity-50',
                          )}
                        >
                          {audience.name}
                        </button>
                      ) : (
                        <div key={audience.key} className={cn('rounded-2xl border p-4 transition', active ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white', atLimit && 'opacity-60')}>
                          <div className="flex items-start gap-3">
                            <button type="button" disabled={atLimit} onClick={() => void toggleAudience(audience.key)} className="min-w-0 flex-1 text-left disabled:cursor-not-allowed">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-900">{audience.name}</span>
                                {active ? <Check className="h-4 w-4 shrink-0 text-blue-600" /> : null}
                              </div>
                              <div className="mt-1 line-clamp-2 text-sm leading-5 text-slate-500">{audience.definition}</div>
                            </button>
                            <GhostButton className="shrink-0 px-3 py-1.5 text-xs" onClick={() => setDetail({ type: 'default', audience })}>
                              详情
                            </GhostButton>
                          </div>
                        </div>
                      )
                    }) : null}

                    {!isPopup ? visibleCustomAudiences.map((audience) => {
                      const active = selectedCustomKeys.includes(audience.key)
                      const atLimit = !active && totalAudienceCount >= 5
                      return isPopup ? (
                        <button
                          key={audience.key}
                          type="button"
                          disabled={atLimit}
                          onClick={() => void toggleCustomAudience(audience.key)}
                          className={cn(
                            'rounded-full px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed',
                            active ? 'bg-violet-700 text-white' : 'bg-violet-100 text-violet-700 hover:bg-violet-200',
                            atLimit && 'opacity-50',
                          )}
                        >
                          {audience.name}
                        </button>
                      ) : (
                        <div key={audience.key} className={cn('rounded-2xl border p-4 transition', active ? 'border-violet-500 bg-violet-50' : 'border-violet-100 bg-white', atLimit && 'opacity-60')}>
                          <div className="flex items-start gap-3">
                            <button type="button" disabled={atLimit} onClick={() => void toggleCustomAudience(audience.key)} className="min-w-0 flex-1 text-left disabled:cursor-not-allowed">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-900">{audience.name}</span>
                                {active ? <Check className="h-4 w-4 shrink-0 text-violet-600" /> : null}
                              </div>
                              <div className="mt-1 line-clamp-2 text-sm leading-5 text-violet-700">{audience.chips.join('、')}</div>
                            </button>
                            <GhostButton className="shrink-0 px-3 py-1.5 text-xs" onClick={() => setDetail({ type: 'custom', audience })}>
                              详情
                            </GhostButton>
                          </div>
                        </div>
                      )
                    }) : null}
                    </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-5 space-y-5">
                    {ALL_TAG_GROUPS.map((group) => {
                      const expanded = isPopup || expandedTagGroups.includes(group.name)
                      return (
                      <div key={group.name} className="border-b border-slate-100 pb-4">
                        <button type="button" onClick={() => toggleExpandedTagGroup(group.name)} className="mb-3 flex w-full items-center justify-between text-left">
                          <div className="text-sm font-semibold text-slate-700">{group.name}</div>
                          {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                        </button>
                        {expanded ? <div className="flex flex-wrap gap-2">
                          {group.values.map((chip) => {
                            const active = draftChips.includes(chip)
                            return (
                              <button
                                key={chip}
                                type="button"
                                onClick={() => toggleDraftChip(chip)}
                                className={cn(
                                  'rounded-full border px-3 py-1.5 text-xs font-medium transition',
                                  active ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400',
                                )}
                              >
                                {chip}
                              </button>
                            )
                          })}
                        </div> : null}
                      </div>
                    )})}
                    <div className={cn('sticky bottom-0 border-t border-slate-200 bg-white py-4', isPopup ? '-mx-4 px-4' : '-mx-6 px-6')}>
                      <div className="text-sm text-slate-600">条件：{draftChips.length ? draftChips.join(' & ') : '请选择标签'}</div>
                      <div className="mt-3 flex justify-end gap-2">
                        <GhostButton onClick={() => { setEditingCustomKey(null); setDraftChips([]); setComposerOpen(false) }}>
                          取消
                        </GhostButton>
                        <Button disabled={!draftChips.length} onClick={() => void completeCustomAudience()}>
                          <Save className="mr-2 h-4 w-4" />
                          保存并应用
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                <Card className={cn('mt-5 bg-slate-50 p-4 shadow-none', isPopup && 'rounded-lg border-slate-200 bg-white p-3')}>
                  <div className="text-sm font-medium text-slate-900">当前已选用户群</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedAudiences.map((audience) => <Badge key={audience.key}>{audience.name}</Badge>)}
                    {selectedTaxonomyLabels.map((label) => <Badge key={label}>{label}</Badge>)}
                    {selectedCustomAudiences.map((audience) => <Badge key={audience.key} className="bg-violet-100 text-violet-700">{audience.name}</Badge>)}
                    {!selectedAudiences.length && !selectedTaxonomyLabels.length && !selectedCustomAudiences.length ? <span className="text-sm text-slate-500">请至少选择 1 个用户群，建议 2-5 个。</span> : null}
                  </div>
                  <div className="mt-4 text-xs leading-5 text-slate-500">{totalAudienceCount}/5 个用户群</div>
                </Card>

                {isPopup ? (
                <Card className={cn('mt-5 bg-slate-50 p-4 shadow-none', isPopup && 'rounded-lg border-0 bg-white p-0')}>
                  <div className="text-sm font-medium text-slate-900">观察指标选择</div>
                  <div ref={popupMetricDropdownRef} className="relative mt-3">
                    <div className="flex items-center gap-2 rounded-lg border border-blue-300 bg-white px-3 py-2 shadow-sm shadow-blue-100">
                      <Search className="h-4 w-4 text-slate-400" />
                      <input
                        value={metricSearch}
                        onFocus={openPopupMetricDropdown}
                        onClick={openPopupMetricDropdown}
                        onChange={(event) => setMetricSearch(event.target.value)}
                        className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-slate-400"
                        placeholder="搜索或选择指标..."
                      />
                      {metricSearch ? (
                        <button type="button" onClick={() => setMetricSearch('')} className="text-slate-400 hover:text-slate-700">
                          <X className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                    {popupMetricDropdownOpen ? (
                      <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-40 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 shadow-xl shadow-slate-900/10">
                        <div className="space-y-3">
                          {visibleMetricGroups.map((group) => (
                            <div key={group.name}>
                              <div className="mb-2 text-xs font-semibold text-slate-700">{group.name}</div>
                              <div className="flex flex-wrap gap-2">
                                {group.values.map((metric) => {
                                  const active = selectedMetrics.includes(metric)
                                  return (
                                    <button
                                      key={metric}
                                      type="button"
                                      onClick={() => toggleMetric(metric)}
                                      className={cn(
                                        'rounded-full px-3 py-1.5 text-xs font-medium transition',
                                        active ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300',
                                      )}
                                    >
                                      {metric}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedMetrics.map((metric) => (
                      <button
                        key={metric}
                        type="button"
                        onClick={() => toggleMetric(metric)}
                        className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                      >
                        {metric}
                        <X className="h-3 w-3" />
                      </button>
                    ))}
                    {!selectedMetrics.length ? <span className="text-sm text-slate-500">请至少选择 1 个观察指标。</span> : null}
                  </div>
                </Card>
                ) : null}

                {detail && !isPopup ? (
                  <Card className="mt-4 p-4 shadow-none">
                    <div className="flex items-start justify-between gap-3">
                      <SectionTitle title={detail.audience.name} description={detail.type === 'default' ? '系统默认人格标签' : '自定义组合标签'} />
                      <button type="button" onClick={() => setDetail(null)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                      <div><span className="font-medium text-slate-900">定义：</span>{detail.audience.definition}</div>
                      {'chips' in detail.audience ? <div><span className="font-medium text-slate-900">组合：</span>{detail.audience.chips.join('、')}</div> : null}
                      <div><span className="font-medium text-slate-900">转化特征：</span>{detail.type === 'default' ? detail.audience.behavior_summary.conversion_trait : detail.audience.conversion_trait}</div>
                      <div><span className="font-medium text-slate-900">停留特征：</span>{detail.type === 'default' ? detail.audience.behavior_summary.dwell_trait : detail.audience.dwell_trait}</div>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                      {detail.type === 'default' ? (
                        <GhostButton onClick={() => cloneDefaultAudience(detail.audience)}>
                          <Pencil className="mr-2 h-4 w-4" />编辑副本
                        </GhostButton>
                      ) : (
                        <>
                          <GhostButton onClick={() => editCustomAudience(detail.audience)}>
                            <Pencil className="mr-2 h-4 w-4" />编辑
                          </GhostButton>
                          <GhostButton className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => deleteCustomAudience(detail.audience.key)}>
                            <Trash2 className="mr-2 h-4 w-4" />删除
                          </GhostButton>
                        </>
                      )}
                    </div>
                  </Card>
                ) : null}
              </div>
              {isPopup ? (
                <div className="border-t border-slate-200 bg-white px-4 py-3">
                  <div className="mb-3 text-xs text-slate-500">
                    已选择 {totalAudienceCount} 类陪审团，{selectedMetrics.length} 个观察指标。
                  </div>
                  <div className="mb-3">
                    {renderModelSelector(true)}
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <GhostButton disabled={!canRun || runAnalysisMutation.isPending} onClick={() => runAnalysisMutation.mutate({ target: 'full' })} className="border-0 px-0 text-blue-700 hover:bg-transparent">
                      进入完整分析
                    </GhostButton>
                    <Button className="bg-blue-600 px-6 hover:bg-blue-700" disabled={!canRun || runAnalysisMutation.isPending} onClick={() => runAnalysisMutation.mutate({ target: 'quick' })} title={!canRun ? disabledReason : '生成快速反馈'}>
                      {runAnalysisMutation.isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                      生成快速反馈
                    </Button>
                  </div>
                  {!canRun ? <div className="mt-2 text-right text-xs text-slate-500">{disabledReason}</div> : null}
                </div>
              ) : null}
              </div>
            </aside>
          ) : null}
          {composerOpen && !isPopup ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm">
              <div className="flex max-h-[calc(100vh-3rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl shadow-slate-950/25">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">创建自定义标签组合</h2>
                    <p className="mt-1 text-sm text-slate-500">按属性组合用户标签，系统会生成本次分析使用的临时用户群。</p>
                  </div>
                  <button type="button" onClick={() => { setEditingCustomKey(null); setDraftChips([]); setComposerOpen(false) }} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="overflow-y-auto px-6 py-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    {ALL_TAG_GROUPS.map((group) => {
                      const expanded = expandedTagGroups.includes(group.name)
                      return (
                        <div key={group.name} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                          <button type="button" onClick={() => toggleExpandedTagGroup(group.name)} className="flex w-full items-center justify-between text-left">
                            <span className="text-sm font-semibold text-slate-800">{group.name}</span>
                            {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                          </button>
                          {expanded ? (
                            <div className="mt-3 flex max-h-32 flex-wrap gap-2 overflow-y-auto">
                              {group.values.map((chip) => {
                                const active = draftChips.includes(chip)
                                return (
                                  <button
                                    key={chip}
                                    type="button"
                                    onClick={() => toggleDraftChip(chip)}
                                    className={cn('rounded-full px-3 py-1.5 text-xs font-medium transition', active ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-blue-200')}
                                  >
                                    {chip}
                                  </button>
                                )
                              })}
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div className="border-t border-slate-200 bg-white px-6 py-4">
                  <div className="text-sm text-slate-600">已选条件：{draftChips.length ? draftChips.join(' / ') : '请选择至少 1 个标签'}</div>
                  <div className="mt-3 flex justify-end gap-2">
                    <GhostButton onClick={() => { setEditingCustomKey(null); setDraftChips([]); setComposerOpen(false) }}>
                      取消
                    </GhostButton>
                    <Button disabled={!draftChips.length} onClick={() => void completeCustomAudience()}>
                      <Save className="mr-2 h-4 w-4" />
                      保存并应用
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          {metricComposerOpen && !isPopup ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl shadow-slate-950/25">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">导入自定义指标组合</h2>
                    <p className="mt-1 text-sm text-slate-500">补充本次分析需要临时关注的指标。</p>
                  </div>
                  <button type="button" onClick={() => setMetricComposerOpen(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="space-y-4 px-6 py-5">
                  <div>
                    <Label>指标名称</Label>
                    <Input value={metricDraftName} onChange={(event) => setMetricDraftName(event.target.value)} placeholder="例如：内容有效阅读率" />
                  </div>
                  <div>
                    <Label>指标含义</Label>
                    <Textarea rows={4} value={metricDraftMeaning} onChange={(event) => setMetricDraftMeaning(event.target.value)} placeholder="说明该指标衡量什么，以及为什么需要关注。" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
                  <GhostButton onClick={() => { setMetricDraftName(''); setMetricDraftMeaning(''); setMetricComposerOpen(false) }}>
                    取消
                  </GhostButton>
                  <Button disabled={!metricDraftName.trim() || !metricDraftMeaning.trim()} onClick={completeCustomMetric}>
                    <Save className="mr-2 h-4 w-4" />
                    保存并应用
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
