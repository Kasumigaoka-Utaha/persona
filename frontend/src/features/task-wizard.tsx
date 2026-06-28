import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  BarChart3,
  Check,
  ChevronRight,
  ChevronUp,
  FileText,
  Gauge,
  Link2,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Sparkles,
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

const TAG_GROUPS = [
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

const METRICS = ['入口点击率', '发布完成率', '二跳流失率', '互动率', '留存意愿', '信任感']

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

export function TaskWizardPage() {
  const navigate = useNavigate()
  const [selectedAudienceKeys, setSelectedAudienceKeys] = useState<string[]>([])
  const [selectedCustomKeys, setSelectedCustomKeys] = useState<string[]>([])
  const [customAudiences, setCustomAudiences] = useState<CustomAudience[]>([])
  const [composerOpen, setComposerOpen] = useState(false)
  const [juryOpen, setJuryOpen] = useState(false)
  const [draftChips, setDraftChips] = useState<string[]>([])
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(METRICS.slice(0, 4))
  const [editingCustomKey, setEditingCustomKey] = useState<string | null>(null)
  const [detail, setDetail] = useState<AudienceDetail | null>(null)
  const [documentTitle, setDocumentTitle] = useState<string | null>(null)
  const [documentContent, setDocumentContent] = useState<string | null>(null)
  const [documentSource, setDocumentSource] = useState<DocumentSource | null>(null)
  const [prdLink, setPrdLink] = useState('')
  const [documentNotice, setDocumentNotice] = useState('')

  const documentQuery = useQuery({ queryKey: ['demo-document'], queryFn: api.getDemoDocument })
  const audiencesQuery = useQuery({ queryKey: ['audiences'], queryFn: api.listAudiences })

  useEffect(() => {
    void safeLogEvent('jury_capsule_exposed', { page: 'jury_workbench' })
  }, [])

  const audienceSource = useMemo(() => {
    const data = audiencesQuery.data ?? []
    return data.length ? data : FALLBACK_AUDIENCES
  }, [audiencesQuery.data])

  const loadedDocument = documentQuery.data ?? (documentQuery.isError ? FALLBACK_DEMO_DOCUMENT : null)
  const effectiveDocumentTitle = documentTitle ?? loadedDocument?.title ?? ''
  const effectiveDocumentContent = documentContent ?? loadedDocument?.content ?? ''
  const effectiveDocumentSource = documentSource ?? {
    host: loadedDocument?.host ?? FALLBACK_DEMO_DOCUMENT.host,
    sourceMode: 'host',
  }

  const selectedFallbackAudiences = useMemo(
    () => audienceSource.filter((item) => item.source === 'frontend_fallback' && selectedAudienceKeys.includes(item.key)),
    [audienceSource, selectedAudienceKeys],
  )

  const selectedAudiences = useMemo(
    () => audienceSource.filter((item) => selectedAudienceKeys.includes(item.key)),
    [audienceSource, selectedAudienceKeys],
  )

  const selectedCustomAudiences = useMemo(
    () => customAudiences.filter((audience) => selectedCustomKeys.includes(audience.key)),
    [customAudiences, selectedCustomKeys],
  )

  const totalAudienceCount = selectedAudienceKeys.length + selectedCustomKeys.length
  const canRun = effectiveDocumentTitle.trim().length > 0 && effectiveDocumentContent.trim().length >= 20 && totalAudienceCount >= 1 && totalAudienceCount <= 5 && selectedMetrics.length >= 1
  const disabledReason = !effectiveDocumentTitle.trim() || effectiveDocumentContent.trim().length < 20
    ? '文档未加载完成'
    : totalAudienceCount < 1
      ? '请先选择至少 1 个陪审团标签'
      : totalAudienceCount > 5
        ? '最多选择 5 个用户群'
        : selectedMetrics.length < 1
          ? '请至少选择 1 个观察指标'
          : ''

  const runAnalysisMutation = useMutation({
    mutationFn: async () => {
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
      const selectedBackendKeys = selectedAudienceKeys.filter((key) => !selectedFallbackAudiences.some((audience) => audience.key === key))
      return api.runAnalysis({
        document: {
          title: effectiveDocumentTitle.trim(),
          content: effectiveDocumentContent.trim(),
          host: effectiveDocumentSource.host,
          source_mode: effectiveDocumentSource.sourceMode,
        },
        selected_audience_keys: selectedBackendKeys,
        manual_audiences: [...fallbackManualAudiences, ...manualAudiences],
        selected_metrics: selectedMetrics,
        model_reasoning_effort: 'medium',
      })
    },
    onSuccess: async (job) => {
      await safeLogEvent('jury_report_generated', { job_id: job.id, audience_count: totalAudienceCount, metrics: selectedMetrics })
      navigate(`/analysis/${job.id}`)
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

  return (
    <div className="relative mx-auto max-w-6xl">
      <div className={cn('grid gap-6 transition-all duration-300', juryOpen ? 'xl:grid-cols-[minmax(0,1fr)_360px]' : 'xl:grid-cols-1')}>
        <main className="space-y-5">
          <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="absolute inset-y-0 right-0 hidden w-60 bg-gradient-to-l from-blue-100 via-blue-50 to-transparent lg:block" />
            <div className="relative flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-950">用户实时陪审团</h1>
                <p className="mt-3 text-base font-medium text-slate-800">帮 PM 在评审前快速发现不同用户视角下的方案风险</p>
                <p className="mt-1 text-sm text-slate-500">输出为用户视角风险假设，不替代真实实验或用户调研。</p>
              </div>
            </div>
          </section>

          <Card className="p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
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
                    value={prdLink}
                    onChange={(event) => setPrdLink(event.target.value)}
                    placeholder="输入公开可访问的 PRD 链接"
                  />
                  <Button
                    className="shrink-0 bg-blue-600 hover:bg-blue-700"
                    disabled={parseLinkMutation.isPending}
                    onClick={parseCurrentLink}
                  >
                    {parseLinkMutation.isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                    解析
                  </Button>
                </div>
              </div>
              <div
                className="rounded-2xl border border-slate-200 bg-white p-5"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  uploadFile(event.dataTransfer.files[0])
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
                  {parseFileMutation.isPending ? '正在解析...' : '点击或拖拽文件上传'}
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.docx,.txt,.md"
                    onChange={(event) => uploadFile(event.target.files?.[0])}
                  />
                </label>
              </div>
            </div>
            {documentNotice ? (
              <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-700">
                {documentNotice}
              </div>
            ) : null}
          </Card>

          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <SectionTitle title="当前文档上下文" description="Demo 通过 mock host 读取当前文档内容，可直接修改以模拟 PRD 实时变化。" />
              <GhostButton onClick={() => documentQuery.refetch()} disabled={documentQuery.isFetching}>
                <RefreshCcw className={cn('mr-2 h-4 w-4', documentQuery.isFetching && 'animate-spin')} />刷新文档
              </GhostButton>
            </div>
            <div className="mt-5 grid gap-4">
              <div>
                <Label>文档标题</Label>
                <Input value={effectiveDocumentTitle} onChange={(event) => setDocumentTitle(event.target.value)} placeholder="当前 PRD 标题" />
              </div>
              <div>
                <Label>文档内容</Label>
                <Textarea rows={13} value={effectiveDocumentContent} onChange={(event) => setDocumentContent(event.target.value)} className="resize-y font-mono text-xs leading-6" />
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SectionTitle title="选择用户陪审团" description="从预设人群标签中选择，快速匹配多元视角" />
              <button
                type="button"
                onClick={openPicker}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:border-blue-200 hover:text-blue-600"
                aria-label="展开用户陪审团选择"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
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
                      'flex min-h-16 items-center gap-3 rounded-2xl border p-4 text-left transition',
                      active ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-slate-200 bg-white hover:border-blue-200',
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

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-900">自定义标签组合 <span className="text-sm font-normal text-slate-400">（选填）</span></div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedCustomAudiences.map((audience) => (
                      <Badge key={audience.key} className="bg-violet-100 text-violet-700">{audience.name}</Badge>
                    ))}
                    {!selectedCustomAudiences.length ? <span className="text-sm text-slate-400">添加你的自定义标签，按回车确认</span> : null}
                  </div>
                </div>
                <GhostButton onClick={openComposer} className="shrink-0 border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100">
                  <Plus className="mr-2 h-4 w-4" />
                  创建自定义标签组合
                </GhostButton>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle title="选择观察指标" description="搜索或选择你希望重点关注的指标" />
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-blue-300 bg-white px-3 py-2 shadow-sm shadow-blue-100">
              <Search className="h-4 w-4 text-slate-400" />
              <input className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-slate-400" placeholder="搜索观察指标，例如：入口点击率" />
            </div>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-sm font-medium text-slate-900">当前已选观察指标</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedMetrics.map((metric) => (
                  <button
                    key={metric}
                    type="button"
                    onClick={() => toggleMetric(metric)}
                    className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200"
                  >
                    {metric}
                    <X className="h-3 w-3" />
                  </button>
                ))}
                {!selectedMetrics.length ? <span className="text-sm text-slate-500">请选择至少 1 个观察指标，默认建议 3-5 个。</span> : null}
              </div>
            </div>
            <div className="mt-4 grid gap-4 rounded-2xl border border-slate-100 bg-white p-4 md:grid-cols-2">
              <div>
                <div className="text-xs font-medium text-slate-500">热门搜索</div>
                <div className="mt-2 space-y-2 text-sm text-slate-600">
                  {METRICS.slice(0, 5).map((metric) => {
                    const active = selectedMetrics.includes(metric)
                    return (
                      <button
                        key={metric}
                        type="button"
                        onClick={() => toggleMetric(metric)}
                        className={cn('block rounded-lg px-2 py-1 text-left hover:text-blue-600', active && 'bg-blue-50 font-medium text-blue-700')}
                      >
                        {active ? '✓' : '◆'} {metric}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500">最近使用</div>
                <div className="mt-2 space-y-2 text-sm text-slate-600">
                  {METRICS.slice(1, 5).map((metric) => {
                    const active = selectedMetrics.includes(metric)
                    return (
                      <button
                        key={metric}
                        type="button"
                        onClick={() => toggleMetric(metric)}
                        className={cn('block rounded-lg px-2 py-1 text-left hover:text-blue-600', active && 'bg-blue-50 font-medium text-blue-700')}
                      >
                        {active ? '✓' : '◆'} {metric}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </Card>

          <div className="sticky bottom-0 z-10 -mx-2 border-t border-slate-200 bg-white/90 px-2 py-4 backdrop-blur">
            <div className="flex flex-col gap-3 rounded-2xl bg-white md:flex-row md:items-center md:justify-between">
              <div className="text-sm font-medium text-slate-700">
                已选择 {totalAudienceCount} 类陪审团，{selectedMetrics.length} 个观察指标，预计 30 秒生成快速反馈。
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  className="bg-blue-600 shadow-lg shadow-blue-600/20 hover:bg-blue-700"
                  disabled={!canRun || runAnalysisMutation.isPending}
                  onClick={() => runAnalysisMutation.mutate()}
                  title={!canRun ? disabledReason : '生成快速反馈'}
                >
                  {runAnalysisMutation.isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  生成快速反馈
                </Button>
                <GhostButton disabled={!canRun || runAnalysisMutation.isPending} onClick={() => runAnalysisMutation.mutate()}>
                  <BarChart3 className="mr-2 h-4 w-4" />
                  进入完整分析
                </GhostButton>
              </div>
            </div>
            {!canRun ? <div className="mt-2 text-right text-xs text-slate-500">{disabledReason}</div> : null}
            {runAnalysisMutation.isError ? (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {runAnalysisMutation.error instanceof Error ? runAnalysisMutation.error.message : '生成失败，请稍后重试。'}
              </div>
            ) : null}
          </div>
        </main>

        {juryOpen ? (
          <aside className="fixed inset-y-0 right-0 z-30 w-full max-w-md overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-2xl shadow-slate-900/15 xl:sticky xl:top-8 xl:max-h-[calc(100vh-4rem)] xl:w-auto xl:rounded-3xl xl:border xl:shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{composerOpen ? '自定义标签组合' : '选择用户陪审团'}</h2>
                <p className="mt-1 text-sm text-slate-500">{composerOpen ? '按需组合标签，精准定义你的陪审团' : '选择 1-5 个目标用户群参与分析'}</p>
              </div>
              <button type="button" onClick={() => setJuryOpen(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <Card className="mt-5 border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-none">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>只做判断，不给优化建议；风险指数是 0-100 的方向性估算。</div>
              </div>
            </Card>

            <div className="mt-5 flex rounded-xl bg-slate-100 p-1 text-sm font-medium">
              <button type="button" onClick={() => setComposerOpen(false)} className={cn('flex-1 rounded-lg px-3 py-2', !composerOpen ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}>
                用户群
              </button>
              <button type="button" onClick={() => setComposerOpen(true)} className={cn('flex-1 rounded-lg px-3 py-2', composerOpen ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}>
                自定义
              </button>
            </div>

            {!composerOpen ? (
              <div className="mt-5 space-y-3">
                {audienceSource.map((audience) => {
                  const active = selectedAudienceKeys.includes(audience.key)
                  const atLimit = !active && totalAudienceCount >= 5
                  return (
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
                })}

                {customAudiences.map((audience) => {
                  const active = selectedCustomKeys.includes(audience.key)
                  const atLimit = !active && totalAudienceCount >= 5
                  return (
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
                })}
              </div>
            ) : (
              <div className="mt-5 space-y-5">
                {TAG_GROUPS.map((group) => (
                  <div key={group.name} className="border-b border-slate-100 pb-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-sm font-semibold text-slate-700">{group.name}</div>
                      <ChevronUp className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className="flex flex-wrap gap-2">
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
                    </div>
                  </div>
                ))}
                <div className="sticky bottom-0 -mx-6 border-t border-slate-200 bg-white px-6 py-4">
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

            <Card className="mt-5 bg-slate-50 p-4 shadow-none">
              <div className="text-sm font-medium text-slate-900">当前已选用户群</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedAudiences.map((audience) => <Badge key={audience.key}>{audience.name}</Badge>)}
                {selectedCustomAudiences.map((audience) => <Badge key={audience.key} className="bg-violet-100 text-violet-700">{audience.name}</Badge>)}
                {!selectedAudiences.length && !selectedCustomAudiences.length ? <span className="text-sm text-slate-500">请至少选择 1 个用户群，建议 2-5 个。</span> : null}
              </div>
              <div className="mt-4 text-xs leading-5 text-slate-500">{totalAudienceCount}/5 个用户群</div>
            </Card>

            {detail ? (
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
          </aside>
        ) : null}
      </div>

      {!juryOpen ? (
        <button
          type="button"
          onClick={openPicker}
          className="fixed bottom-8 right-8 z-20 hidden items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-xl shadow-slate-900/15 ring-1 ring-slate-200 hover:text-blue-600 xl:flex"
        >
          <Gauge className="h-5 w-5 text-blue-600" />
          陪审团
        </button>
      ) : null}
    </div>
  )
}
