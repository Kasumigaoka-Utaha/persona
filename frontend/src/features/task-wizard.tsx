import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Check, LoaderCircle, PanelRightClose, PanelRightOpen, Pencil, RefreshCcw, Scale, Trash2, X } from 'lucide-react'
import { api } from '../api'
import { Badge, Button, Card, GhostButton, Input, Label, SectionTitle, Textarea } from '../components/ui'
import type { AudienceDefinition, ManualAudienceInput } from '../types/api'
import { cn } from '../lib/utils'
import { FALLBACK_AUDIENCES, FALLBACK_DEMO_DOCUMENT } from '../data/fallbacks'

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
  const [panelOpen, setPanelOpen] = useState(true)
  const [selectedAudienceKeys, setSelectedAudienceKeys] = useState<string[]>([])
  const [selectedCustomKeys, setSelectedCustomKeys] = useState<string[]>([])
  const [customAudiences, setCustomAudiences] = useState<CustomAudience[]>([])
  const [composerOpen, setComposerOpen] = useState(false)
  const [juryOpen, setJuryOpen] = useState(true)
  const [draftChips, setDraftChips] = useState<string[]>([])
  const [editingCustomKey, setEditingCustomKey] = useState<string | null>(null)
  const [detail, setDetail] = useState<AudienceDetail | null>(null)
  const [documentTitle, setDocumentTitle] = useState('')
  const [documentContent, setDocumentContent] = useState('')

  const documentQuery = useQuery({ queryKey: ['demo-document'], queryFn: api.getDemoDocument })
  const audiencesQuery = useQuery({ queryKey: ['audiences'], queryFn: api.listAudiences })

  useEffect(() => {
    void safeLogEvent('jury_capsule_exposed', { page: 'jury_workbench' })
  }, [])

  useEffect(() => {
    const document = documentQuery.data ?? (documentQuery.isError ? FALLBACK_DEMO_DOCUMENT : null)
    if (document) {
      setDocumentTitle(document.title)
      setDocumentContent(document.content)
    }
  }, [documentQuery.data, documentQuery.isError])

  const audienceSource = useMemo(() => {
    const data = audiencesQuery.data ?? []
    return data.length ? data : FALLBACK_AUDIENCES
  }, [audiencesQuery.data])

  const selectedFallbackAudiences = useMemo(
    () => audienceSource.filter((item) => item.source === 'frontend_fallback' && selectedAudienceKeys.includes(item.key)),
    [audienceSource, selectedAudienceKeys],
  )

  const runAnalysisMutation = useMutation({
    mutationFn: async () => {
      const manualAudiences = customAudiences
        .filter((audience) => selectedCustomKeys.includes(audience.key))
        .map((audience) => ({
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
          title: documentTitle.trim(),
          content: documentContent.trim(),
          host: documentQuery.data?.host ?? FALLBACK_DEMO_DOCUMENT.host,
          source_mode: 'host',
        },
        selected_audience_keys: selectedBackendKeys,
        manual_audiences: [...fallbackManualAudiences, ...manualAudiences],
      })
    },
    onSuccess: async (job) => {
      await safeLogEvent('jury_report_generated', { job_id: job.id, audience_count: selectedAudienceKeys.length + selectedCustomKeys.length })
      navigate(`/analysis/${job.id}`)
    },
    onError: async (error) => {
      await safeLogEvent('jury_report_failed', { message: error instanceof Error ? error.message : 'unknown_error' })
    },
  })

  const selectedAudiences = useMemo(
    () => audienceSource.filter((item) => selectedAudienceKeys.includes(item.key)),
    [audienceSource, selectedAudienceKeys],
  )

  const totalAudienceCount = selectedAudienceKeys.length + selectedCustomKeys.length
  const canRun = documentTitle.trim().length > 0 && documentContent.trim().length >= 20 && totalAudienceCount >= 1 && totalAudienceCount <= 5
  const disabledReason = !documentTitle.trim() || documentContent.trim().length < 20
    ? '文档未加载完成'
    : totalAudienceCount < 1
      ? '请先选择至少 1 个陪审团标签'
      : totalAudienceCount > 5
        ? '最多选择 5 个用户群'
        : ''

  const toggleAudience = async (key: string) => {
    setSelectedAudienceKeys((current) => {
      const exists = current.includes(key)
      if (exists) {
        return current.filter((item) => item !== key)
      }
      if (current.length + selectedCustomKeys.length >= 5) {
        return current
      }
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
    }
    setDraftChips([])
    setComposerOpen(false)
    await safeLogEvent('jury_custom_audience_completed', { chip_count: draftChips.length })
  }

  const editCustomAudience = (audience: CustomAudience) => {
    setDraftChips(audience.chips)
    setEditingCustomKey(audience.key)
    setComposerOpen(true)
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
    setDetail(null)
  }

  return (
    <div className="relative min-h-[78vh] overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
      <div className="grid min-h-[78vh] lg:grid-cols-[1.2fr_0.8fr]">
        <section className="border-r border-slate-200 bg-[#f5f7fb] p-6 lg:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Badge className="bg-blue-100 text-blue-700">Mock Feishu Document</Badge>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">用户实时陪审团</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                模拟 PM 在飞书文档内写 PRD 时，点击右侧“陪审团”胶囊，直接选择目标用户群并生成模块级风险判断报告。
              </p>
            </div>
            <GhostButton onClick={() => setPanelOpen((value) => !value)}>
              {panelOpen ? <PanelRightClose className="mr-2 h-4 w-4" /> : <PanelRightOpen className="mr-2 h-4 w-4" />}
              {panelOpen ? '收起侧边栏' : '展开侧边栏'}
            </GhostButton>
          </div>

          <Card className="mt-6 p-5">
            <div className="flex items-center justify-between gap-3">
              <SectionTitle title="当前文档上下文" description="Demo 通过 mock host 读取当前文档内容，可直接修改以模拟 PRD 实时变化。" />
              <GhostButton onClick={() => documentQuery.refetch()} disabled={documentQuery.isFetching}>
                <RefreshCcw className={cn('mr-2 h-4 w-4', documentQuery.isFetching && 'animate-spin')} />刷新文档
              </GhostButton>
            </div>
            <div className="mt-5 grid gap-4">
              <div>
                <Label>文档标题</Label>
                <Input value={documentTitle} onChange={(event) => setDocumentTitle(event.target.value)} placeholder="当前 PRD 标题" />
              </div>
              <div>
                <Label>文档内容</Label>
                <Textarea rows={20} value={documentContent} onChange={(event) => setDocumentContent(event.target.value)} className="font-mono text-xs leading-6" />
              </div>
            </div>
          </Card>
        </section>

        <aside className={cn('relative bg-white p-6 lg:p-8', !panelOpen && 'hidden lg:block')}>
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-slate-900 p-2 text-white">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-semibold text-slate-900">陪审团</div>
              <p className="mt-1 text-sm text-slate-500">选择 2-5 个目标用户群，生成“行为判断 + CTR/UV/PV 风险评级 + 风险指数”报告。</p>
            </div>
          </div>

          <Card className="mt-5 border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              <div>只做判断，不给优化建议；风险指数是 0-100 的方向性估算，不代表真实线上百分比。</div>
            </div>
          </Card>

          <div className="mt-6 space-y-5">
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <SectionTitle title={editingCustomKey ? '编辑自定义标签组合' : '自定义标签组合'} description="平常默认收起，需要时点击创建或编辑。" />
                <GhostButton
                  onClick={() => setComposerOpen((value) => !value)}
                  className="shrink-0"
                >
                  {composerOpen ? '收起' : '创建自定义标签'}
                </GhostButton>
              </div>
              {!composerOpen ? (
                <div className="mt-3 text-sm text-slate-500">
                  已创建 {customAudiences.length} 个自定义标签；点击上方按钮展开组合器。
                </div>
              ) : (
                <>
                  <div className="mt-4 space-y-4">
                    {TAG_GROUPS.map((group) => (
                      <div key={group.name}>
                        <div className="mb-2 text-xs font-medium text-slate-500">{group.name}</div>
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
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="text-xs text-slate-500">已组合 {draftChips.length} 个标签</div>
                    <div className="flex gap-2">
                      {editingCustomKey ? (
                        <GhostButton onClick={() => { setEditingCustomKey(null); setDraftChips([]); setComposerOpen(false) }}>
                          取消编辑
                        </GhostButton>
                      ) : null}
                      <Button disabled={!draftChips.length} onClick={() => void completeCustomAudience()}>
                        完成组合
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </Card>

            <div>
              <div className="flex items-start justify-between gap-3">
                <SectionTitle title="选择陪审团" description="点击标签卡片选择参与陪审；点击详情可查看、编辑或删除标签。" />
                <GhostButton onClick={() => setJuryOpen((value) => !value)} className="shrink-0">
                  {juryOpen ? '收起' : '展开'}
                </GhostButton>
              </div>
              {!juryOpen ? (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  已收起陪审团选择区；当前已选 {totalAudienceCount}/5 个用户群。
                </div>
              ) : (
                <div className="mt-3 grid gap-3">
                  {audienceSource.map((audience) => {
                    const active = selectedAudienceKeys.includes(audience.key)
                    const atLimit = !active && totalAudienceCount >= 5
                    return (
                      <div
                        key={audience.key}
                        className={cn(
                          'rounded-2xl border p-4 transition',
                          active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white',
                          atLimit && 'opacity-60',
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button type="button" disabled={atLimit} onClick={() => void toggleAudience(audience.key)} className="min-w-0 flex-1 text-left disabled:cursor-not-allowed">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{audience.name}</span>
                              {active ? <Check className="h-4 w-4 shrink-0" /> : null}
                            </div>
                            <div className={cn('mt-1 max-h-10 overflow-hidden text-sm', active ? 'text-slate-200' : 'text-slate-500')}>{audience.definition}</div>
                          </button>
                          <GhostButton
                            className={cn('shrink-0 px-3 py-1.5 text-xs', active && 'border-slate-500 bg-slate-800 text-white hover:bg-slate-700')}
                            onClick={() => setDetail({ type: 'default', audience })}
                          >
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
                      <div
                        key={audience.key}
                        className={cn(
                          'rounded-2xl border p-4 transition',
                          active ? 'border-violet-700 bg-violet-700 text-white' : 'border-violet-200 bg-violet-50',
                          atLimit && 'opacity-60',
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button type="button" disabled={atLimit} onClick={() => void toggleCustomAudience(audience.key)} className="min-w-0 flex-1 text-left disabled:cursor-not-allowed">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{audience.name}</span>
                              {active ? <Check className="h-4 w-4 shrink-0" /> : null}
                            </div>
                            <div className={cn('mt-1 max-h-10 overflow-hidden text-sm', active ? 'text-violet-100' : 'text-violet-700')}>{audience.chips.join('、')}</div>
                          </button>
                          <GhostButton
                            className={cn('shrink-0 px-3 py-1.5 text-xs', active && 'border-violet-300 bg-violet-800 text-white hover:bg-violet-700')}
                            onClick={() => setDetail({ type: 'custom', audience })}
                          >
                            详情
                          </GhostButton>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <Card className="mt-6 bg-slate-50 p-4">
            <div className="text-sm font-medium text-slate-900">当前已选用户群</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedAudiences.map((audience) => <Badge key={audience.key}>{audience.name}</Badge>)}
              {customAudiences.filter((audience) => selectedCustomKeys.includes(audience.key)).map((audience) => (
                <Badge key={audience.key} className="bg-violet-100 text-violet-700">{audience.name}</Badge>
              ))}
              {!selectedAudiences.length && !selectedCustomKeys.length ? <span className="text-sm text-slate-500">请至少选择 1 个用户群，建议 2-5 个。</span> : null}
            </div>
            <div className="mt-4 text-xs leading-5 text-slate-500">
              {totalAudienceCount}/5 个用户群 · 报告会按 PRD 模块逐项输出定性判断、风险等级和风险指数。
            </div>
          </Card>

          {detail ? (
            <Card className="mt-4 p-4">
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
                <div><span className="font-medium text-slate-900">流失节点：</span>{(detail.type === 'default' ? detail.audience.behavior_summary.dropoff_points : detail.audience.dropoff_points).join('、')}</div>
                <div><span className="font-medium text-slate-900">内容偏好：</span>{(detail.type === 'default' ? detail.audience.behavior_summary.content_preferences : detail.audience.content_preferences).join('、')}</div>
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

          {runAnalysisMutation.isError ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {runAnalysisMutation.error instanceof Error ? runAnalysisMutation.error.message : '生成失败，请稍后重试。'}
            </div>
          ) : null}

          <div className="mt-6 flex justify-end">
            <div className="flex flex-col items-end gap-2">
              <Button
                className={cn(canRun && !runAnalysisMutation.isPending && 'cursor-pointer shadow-lg shadow-slate-900/15 hover:-translate-y-0.5 hover:bg-blue-700')}
                disabled={!canRun || runAnalysisMutation.isPending}
                onClick={() => runAnalysisMutation.mutate()}
                title={!canRun ? disabledReason : '开始生成陪审团报告'}
              >
                {runAnalysisMutation.isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                开始审判 / 生成报告
              </Button>
              {!canRun ? <div className="text-xs text-slate-500">{disabledReason}</div> : null}
            </div>
          </div>
        </aside>
      </div>

    </div>
  )
}
