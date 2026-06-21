import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Check, LoaderCircle, PanelRightClose, PanelRightOpen, RefreshCcw, Scale } from 'lucide-react'
import { api } from '../api'
import { Badge, Button, Card, GhostButton, Input, Label, SectionTitle, Textarea } from '../components/ui'
import type { ManualAudienceInput } from '../types/api'
import { cn } from '../lib/utils'

const DEFAULT_MANUAL_AUDIENCE: ManualAudienceInput = {
  name: '',
  definition: '',
  conversion_trait: '',
  dwell_trait: '',
  dropoff_points: [''],
  content_preferences: [''],
}

function parseLines(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean)
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
  const [manualMode, setManualMode] = useState(false)
  const [manualAudience, setManualAudience] = useState<ManualAudienceInput>(DEFAULT_MANUAL_AUDIENCE)
  const [documentTitle, setDocumentTitle] = useState('')
  const [documentContent, setDocumentContent] = useState('')

  const documentQuery = useQuery({ queryKey: ['demo-document'], queryFn: api.getDemoDocument })
  const audiencesQuery = useQuery({ queryKey: ['audiences'], queryFn: api.listAudiences })

  useEffect(() => {
    void safeLogEvent('jury_capsule_exposed', { page: 'jury_workbench' })
  }, [])

  useEffect(() => {
    if (documentQuery.data) {
      setDocumentTitle(documentQuery.data.title)
      setDocumentContent(documentQuery.data.content)
    }
  }, [documentQuery.data])

  const runAnalysisMutation = useMutation({
    mutationFn: async () => {
      const manualAudiences = manualMode && manualAudience.name.trim()
        ? [{
            ...manualAudience,
            dropoff_points: parseLines(manualAudience.dropoff_points),
            content_preferences: parseLines(manualAudience.content_preferences),
          }]
        : []
      return api.runAnalysis({
        document: {
          title: documentTitle.trim(),
          content: documentContent.trim(),
          host: documentQuery.data?.host ?? 'mock_feishu',
          source_mode: 'host',
        },
        selected_audience_keys: selectedAudienceKeys,
        manual_audiences: manualAudiences,
      })
    },
    onSuccess: async (job) => {
      await safeLogEvent('jury_report_generated', { job_id: job.id, audience_count: selectedAudienceKeys.length + (manualMode && manualAudience.name.trim() ? 1 : 0) })
      navigate(`/analysis/${job.id}`)
    },
    onError: async (error) => {
      await safeLogEvent('jury_report_failed', { message: error instanceof Error ? error.message : 'unknown_error' })
    },
  })

  const selectedAudiences = useMemo(
    () => (audiencesQuery.data ?? []).filter((item) => selectedAudienceKeys.includes(item.key)),
    [audiencesQuery.data, selectedAudienceKeys],
  )

  const totalAudienceCount = selectedAudienceKeys.length + (manualMode && manualAudience.name.trim() ? 1 : 0)
  const canRun = documentTitle.trim().length > 0 && documentContent.trim().length >= 20 && totalAudienceCount >= 1 && totalAudienceCount <= 5

  const toggleAudience = async (key: string) => {
    setSelectedAudienceKeys((current) => {
      const exists = current.includes(key)
      if (exists) {
        return current.filter((item) => item !== key)
      }
      if (current.length + (manualMode && manualAudience.name.trim() ? 1 : 0) >= 5) {
        return current
      }
      return [...current, key]
    })
    await safeLogEvent('jury_audience_selected', { audience_key: key })
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
              <p className="mt-1 text-sm text-slate-500">选择 2-5 个目标用户群，生成“行为判断 + CTR/UV/PV 风险评级”报告。</p>
            </div>
          </div>

          <Card className="mt-5 border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              <div>只做判断，不给优化建议；只输出风险等级，不输出具体数值预测。</div>
            </div>
          </Card>

          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <SectionTitle title="选择目标用户群" description="默认从种子标签库选择；若标签平台不可用，可切换到手动特征输入。" />
              <GhostButton
                onClick={async () => {
                  const nextValue = !manualMode
                  setManualMode(nextValue)
                  if (nextValue) {
                    await safeLogEvent('jury_manual_audience_opened', { trigger: 'manual_toggle' })
                  }
                }}
              >
                {manualMode ? '关闭手动模式' : '标签平台异常？手动填写'}
              </GhostButton>
            </div>

            <div className="space-y-3">
              {(audiencesQuery.data ?? []).map((audience) => {
                const active = selectedAudienceKeys.includes(audience.key)
                const atLimit = !active && totalAudienceCount >= 5
                return (
                  <button
                    key={audience.key}
                    type="button"
                    disabled={atLimit}
                    onClick={() => void toggleAudience(audience.key)}
                    className={cn(
                      'w-full rounded-2xl border p-4 text-left transition',
                      active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white hover:border-slate-400',
                      atLimit && 'cursor-not-allowed opacity-50',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{audience.name}</div>
                        <div className={cn('mt-1 text-sm', active ? 'text-slate-200' : 'text-slate-500')}>{audience.definition}</div>
                      </div>
                      {active ? <Check className="h-4 w-4 shrink-0" /> : null}
                    </div>
                    <div className={cn('mt-3 text-xs leading-5', active ? 'text-slate-200' : 'text-slate-500')}>
                      转化特征：{audience.behavior_summary.conversion_trait}
                      <br />
                      停留特征：{audience.behavior_summary.dwell_trait}
                    </div>
                  </button>
                )
              })}
            </div>

            {manualMode ? (
              <Card className="p-4">
                <SectionTitle title="手动填写标签特征" description="降级模式下，你可以补充一个临时用户群，参与本次分析。" />
                <div className="mt-4 space-y-3">
                  <div>
                    <Label>用户群名称</Label>
                    <Input value={manualAudience.name} onChange={(event) => setManualAudience((current) => ({ ...current, name: event.target.value }))} placeholder="如：高风险规避新客" />
                  </div>
                  <div>
                    <Label>标签定义</Label>
                    <Textarea rows={2} value={manualAudience.definition} onChange={(event) => setManualAudience((current) => ({ ...current, definition: event.target.value }))} />
                  </div>
                  <div>
                    <Label>转化率特征</Label>
                    <Textarea rows={2} value={manualAudience.conversion_trait} onChange={(event) => setManualAudience((current) => ({ ...current, conversion_trait: event.target.value }))} />
                  </div>
                  <div>
                    <Label>停留时长特征</Label>
                    <Textarea rows={2} value={manualAudience.dwell_trait} onChange={(event) => setManualAudience((current) => ({ ...current, dwell_trait: event.target.value }))} />
                  </div>
                  <div>
                    <Label>典型流失节点（每行一个）</Label>
                    <Textarea rows={3} value={manualAudience.dropoff_points.join('\n')} onChange={(event) => setManualAudience((current) => ({ ...current, dropoff_points: event.target.value.split('\n') }))} />
                  </div>
                  <div>
                    <Label>内容偏好（每行一个）</Label>
                    <Textarea rows={3} value={manualAudience.content_preferences.join('\n')} onChange={(event) => setManualAudience((current) => ({ ...current, content_preferences: event.target.value.split('\n') }))} />
                  </div>
                </div>
              </Card>
            ) : null}
          </div>

          <Card className="mt-6 bg-slate-50 p-4">
            <div className="text-sm font-medium text-slate-900">当前已选用户群</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedAudiences.map((audience) => <Badge key={audience.key}>{audience.name}</Badge>)}
              {manualMode && manualAudience.name.trim() ? <Badge className="bg-violet-100 text-violet-700">{manualAudience.name}（手动）</Badge> : null}
              {!selectedAudiences.length && !(manualMode && manualAudience.name.trim()) ? <span className="text-sm text-slate-500">请至少选择 1 个用户群，建议 2-5 个。</span> : null}
            </div>
            <div className="mt-4 text-xs leading-5 text-slate-500">
              {totalAudienceCount}/5 个用户群 · 报告会按 PRD 模块逐项输出行为判断，并标记高分歧模块。
            </div>
          </Card>

          {runAnalysisMutation.isError ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {runAnalysisMutation.error instanceof Error ? runAnalysisMutation.error.message : '生成失败，请稍后重试。'}
            </div>
          ) : null}

          <div className="mt-6 flex justify-end">
            <Button disabled={!canRun || runAnalysisMutation.isPending} onClick={() => runAnalysisMutation.mutate()}>
              {runAnalysisMutation.isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
              开始审判 / 生成报告
            </Button>
          </div>
        </aside>
      </div>

      <button
        type="button"
        className="absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-full bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg lg:flex lg:items-center lg:gap-2"
        onClick={async () => {
          setPanelOpen((value) => !value)
          await safeLogEvent('jury_capsule_clicked', { action: panelOpen ? 'close' : 'open' })
        }}
      >
        <Scale className="h-4 w-4" />陪审团
      </button>
    </div>
  )
}
