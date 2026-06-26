import { useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clipboard,
  Download,
  FileText,
  FlaskConical,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'
import { api } from '../api'
import { Badge, Button, Card, GhostButton, SectionTitle } from '../components/ui'
import type { AudienceModuleResult, JuryReportPayload, ModuleReport } from '../types/api'
import { cn, riskLabel } from '../lib/utils'

type RiskValue = 'red' | 'yellow' | 'green'
const DEFAULT_METRICS = ['CTR', 'UV', 'PV']

const voteMeta: Record<RiskValue, { label: string; color: string; bg: string; text: string }> = {
  green: { label: '支持', color: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  yellow: { label: '犹豫', color: 'bg-amber-400', bg: 'bg-amber-50', text: 'text-amber-700' },
  red: { label: '反对', color: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700' },
}

const priorityMeta = [
  { title: 'P0 本轮必须改', className: 'border-red-100 bg-red-50/70 text-red-700', badge: 'bg-red-500 text-white' },
  { title: 'P1 建议优化', className: 'border-amber-100 bg-amber-50/70 text-amber-700', badge: 'bg-amber-400 text-amber-950' },
  { title: '待验证项', className: 'border-slate-200 bg-slate-50 text-slate-700', badge: 'bg-slate-400 text-white' },
]

function reportMetrics(result: JuryReportPayload) {
  return result.report_meta.selected_metrics?.length ? result.report_meta.selected_metrics : DEFAULT_METRICS
}

function itemMetricScores(item: AudienceModuleResult, metrics: string[]) {
  if (item.selected_metric_scores && Object.keys(item.selected_metric_scores).length) {
    return metrics.map((metric) => item.selected_metric_scores?.[metric] ?? 0)
  }
  const scores = item.metric_scores
  return [scores?.ctr ?? 0, scores?.uv ?? 0, scores?.pv ?? 0]
}

function itemMetricRatings(item: AudienceModuleResult, metrics: string[]) {
  if (item.selected_metric_ratings && Object.keys(item.selected_metric_ratings).length) {
    return metrics.map((metric) => item.selected_metric_ratings?.[metric] ?? 'yellow')
  }
  return [item.risk_ratings.ctr, item.risk_ratings.uv, item.risk_ratings.pv]
}

function averageScore(item: AudienceModuleResult, metrics: string[]) {
  const scores = itemMetricScores(item, metrics)
  if (!scores.length) return 0
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
}

function moduleAverage(module: ModuleReport, metrics: string[]) {
  if (!module.audience_results.length) return 0
  return Math.round(module.audience_results.reduce((sum, item) => sum + averageScore(item, metrics), 0) / module.audience_results.length)
}

function strongestRisk(item: AudienceModuleResult, metrics: string[]): RiskValue {
  const scores = itemMetricScores(item, metrics)
  const ratings = itemMetricRatings(item, metrics)
  const index = scores.map((score, itemIndex) => ({ score, itemIndex })).sort((a, b) => b.score - a.score)[0]?.itemIndex ?? 0
  return ratings[index] ?? 'yellow'
}

function riskGrade(score: number) {
  if (score >= 75) return { label: '高', badge: 'bg-red-100 text-red-700', bar: 'bg-red-500' }
  if (score >= 55) return { label: '中高', badge: 'bg-amber-100 text-amber-700', bar: 'bg-amber-400' }
  if (score >= 35) return { label: '中', badge: 'bg-blue-100 text-blue-700', bar: 'bg-blue-500' }
  return { label: '低', badge: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500' }
}

function metricDirection(value: number) {
  if (value >= 70) return { symbol: '↓', label: '降低', className: 'text-red-600' }
  if (value >= 45) return { symbol: '→', label: '承压', className: 'text-slate-500' }
  return { symbol: '↑', label: '提升', className: 'text-emerald-600' }
}

function moduleTitle(module: ModuleReport) {
  if (!/^模块\s*\d+$/u.test(module.module_title.trim())) {
    return module.module_title
  }
  const summary = module.module_summary
    .split(/\r?\n/)
    .map((line) => line.replace(/^#{1,6}\s*/, '').replace(/^[-*+]\s*/, '').replace(/^\d+[.)、)]\s*/, '').trim())
    .find(Boolean)
  const topic = (summary ?? '内容概览').split(/[：:。；;，,]/)[0].trim().slice(0, 18)
  return `${module.module_title.replace(/\s+/g, '')}：${topic || '内容概览'}`
}

function getTopRisk(result: JuryReportPayload, metrics: string[]) {
  return result.modules
    .flatMap((module) => module.audience_results.map((item) => ({
      module,
      item,
      score: averageScore(item, metrics),
    })))
    .sort((a, b) => b.score - a.score)[0]
}

function getAffectedAudiences(result: JuryReportPayload, metrics: string[]) {
  return result.report_meta.audiences
    .map((audience) => {
      const scores = result.modules.flatMap((module) => module.audience_results.filter((item) => item.audience_name === audience).map((item) => averageScore(item, metrics)))
      const score = scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0
      return { audience, score }
    })
    .sort((a, b) => b.score - a.score)
}

function VoteBar({ item, metrics }: { item: AudienceModuleResult; metrics: string[] }) {
  const risk = strongestRisk(item, metrics)
  const supportWidth = Math.max(8, 100 - averageScore(item, metrics))
  const riskWidth = 100 - supportWidth
  return (
    <div className="flex h-8 overflow-hidden rounded-full bg-slate-100 text-xs font-semibold text-white">
      <div className={cn('flex items-center justify-center', voteMeta.green.color)} style={{ width: `${supportWidth}%` }}>
        {supportWidth > 24 ? '支持' : ''}
      </div>
      <div className={cn('flex items-center justify-center', voteMeta[risk].color)} style={{ width: `${riskWidth}%` }}>
        {riskWidth > 18 ? voteMeta[risk].label : ''}
      </div>
    </div>
  )
}

function IndicatorCard({ module, metrics }: { module: ModuleReport; metrics: string[] }) {
  const topItem = [...module.audience_results].sort((a, b) => averageScore(b, metrics) - averageScore(a, metrics))[0]
  const score = moduleAverage(module, metrics)
  const grade = riskGrade(score)
  const displayMetrics = metrics.slice(0, 3)
  const metricScores = topItem ? itemMetricScores(topItem, metrics) : []
  const primaryDirection = metricDirection(metricScores[0] ?? score)

  return (
    <Card className="p-4 shadow-none">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <FileText className="h-5 w-5" />
          </span>
          <div>
            <div className="font-semibold text-slate-900">{moduleTitle(module)}</div>
            <div className={cn('mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold', grade.badge)}>风险 {grade.label}</div>
          </div>
        </div>
      </div>
      <div className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
        <div><span className="font-medium text-slate-900">方向假设</span> <span className={primaryDirection.className}>{primaryDirection.symbol}</span> {primaryDirection.label}</div>
        <div><span className="font-medium text-slate-900">影响强度</span> <span className={grade.label === '高' ? 'text-red-600' : 'text-amber-600'}>{grade.label}</span></div>
        <div><span className="font-medium text-slate-900">置信度</span> 中</div>
        <div><span className="font-medium text-slate-900">关联用户</span> {topItem?.audience_name ?? '暂无'}</div>
        <div><span className="font-medium text-slate-900">风险原因</span> {topItem?.risk_reason ?? module.module_summary}</div>
        <div><span className="font-medium text-slate-900">行为链路</span> {topItem ? `${topItem.behavior.will_do} → ${topItem.behavior.get_stuck_at}` : module.module_summary}</div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3 text-center text-xs">
        {displayMetrics.map((metric, index) => {
          const direction = metricDirection(metricScores[index] ?? score)
          return <div key={metric} className={direction.className}>{metric} {direction.symbol}</div>
        })}
      </div>
    </Card>
  )
}

function SuggestionCard({ module, item, index, metrics }: { module: ModuleReport; item?: AudienceModuleResult; index: number; metrics: string[] }) {
  const score = item ? averageScore(item, metrics) : moduleAverage(module, metrics)
  const grade = riskGrade(score)
  return (
    <div className="rounded-2xl border border-white/70 bg-white p-4 shadow-sm">
      <div className="font-semibold text-slate-900">{index + 1}. {moduleTitle(module)}</div>
      <div className="mt-3 grid gap-2 text-sm leading-6 text-slate-600">
        <div><span className="font-medium text-slate-900">为什么改</span> {item?.risk_reason ?? module.module_summary}</div>
        <div><span className="font-medium text-slate-900">怎么改</span> 降低理解门槛，强化入口说明、状态反馈和可信信息露出。</div>
        <div><span className="font-medium text-slate-900">影响指标</span> {metrics.join(' / ')}</div>
        <div><span className="font-medium text-slate-900">验证成本</span> {grade.label === '高' ? '低（A/B 测试 1-2 天）' : '中（设计 + 开发 2-3 天）'}</div>
      </div>
    </div>
  )
}

export function PredictionResultPage() {
  const params = useParams()
  const jobId = Number(params.jobId)

  const query = useQuery({
    queryKey: ['analysis', jobId],
    queryFn: () => api.getAnalysis(jobId),
    enabled: Boolean(jobId),
    refetchInterval: (queryState) => {
      const data = queryState.state.data
      if (!data) return 2000
      return data.status === 'succeeded' || data.status === 'failed' ? false : 2000
    },
  })

  const exportMutation = useMutation({
    mutationFn: () => api.exportMarkdown(jobId),
    onSuccess: ({ markdown }) => {
      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `jury-report-${jobId}.md`
      link.click()
      URL.revokeObjectURL(url)
    },
  })

  useEffect(() => {
    document.title = query.data?.result ? `${query.data.result.report_meta.document_title} - 用户实时陪审团` : '用户实时陪审团报告'
  }, [query.data])

  if (query.isLoading || !query.data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoaderCircle className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    )
  }

  const job = query.data
  const result = job.result

  if (job.status !== 'succeeded' || !result) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="p-10 text-center">
          {job.status === 'failed' ? (
            <div className="space-y-3">
              <div className="text-lg font-semibold text-red-600">生成失败</div>
              <div className="text-sm text-slate-500">{job.error_message}</div>
              <Link to="/">
                <GhostButton className="mt-4">返回配置</GhostButton>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-slate-500" />
              <div className="text-lg font-semibold text-slate-900">AI 正在审判中</div>
              <div className="text-sm text-slate-500">当前阶段：{job.stage}。页面会自动刷新结果。</div>
            </div>
          )}
        </Card>
      </div>
    )
  }

  const metrics = reportMetrics(result)
  const topRisk = getTopRisk(result, metrics)
  const overallScore = Math.round(result.modules.reduce((sum, module) => sum + moduleAverage(module, metrics), 0) / Math.max(result.modules.length, 1))
  const overallGrade = riskGrade(overallScore)
  const affectedAudiences = getAffectedAudiences(result, metrics)
  const sortedModules = [...result.modules].sort((a, b) => moduleAverage(b, metrics) - moduleAverage(a, metrics))
  const p0Modules = sortedModules.slice(0, 3)
  const p1Modules = sortedModules.slice(3, 5)
  const pendingModules = sortedModules.slice(5, 8)
  const suggestionGroups = [p0Modules, p1Modules, pendingModules]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <Link to="/">
            <GhostButton className="px-3">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回配置
            </GhostButton>
          </Link>
          <h1 className="text-2xl font-semibold text-slate-900">用户实时陪审团｜完整分析报告</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <GhostButton>
            <RotateCcw className="mr-2 h-4 w-4" />
            重新选择陪审团 / 指标
          </GhostButton>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Sparkles className="mr-2 h-4 w-4" />
            生成修改建议
          </Button>
          <GhostButton onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}>
            <Download className="mr-2 h-4 w-4" />
            复制摘要
          </GhostButton>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="grid divide-y divide-slate-200 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_0.8fr] lg:divide-x lg:divide-y-0">
          <div className="flex gap-4 p-6">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-7 w-7" />
            </span>
            <div>
              <div className="text-sm font-semibold text-slate-500">一句话结论</div>
              <div className="mt-2 text-xl font-semibold leading-8 text-slate-900">
                {topRisk ? `${moduleTitle(topRisk.module)} 对 ${topRisk.item.audience_name} 风险最高。` : '整体风险可控。'}
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="text-sm font-semibold text-slate-500">总风险等级</div>
            <div className="mt-3 flex items-center gap-3">
              <ShieldCheck className="h-8 w-8 text-amber-500" />
              <span className="text-3xl font-bold text-amber-600">{overallGrade.label}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className={overallGrade.bar} style={{ width: `${overallScore}%`, height: '100%' }} />
            </div>
          </div>
          <div className="p-6">
            <div className="text-sm font-semibold text-slate-500">最高风险模块</div>
            <div className="mt-3 flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-red-500" />
              <div>
                <div className="font-semibold text-slate-900">{topRisk ? moduleTitle(topRisk.module) : '暂无'}</div>
                <div className="mt-1 text-sm text-red-600">风险等级：{topRisk ? riskLabel(strongestRisk(topRisk.item, metrics)) : '-'}</div>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="text-sm font-semibold text-slate-500">主要受影响用户</div>
            <div className="mt-3 flex items-center gap-3">
              <Users className="h-8 w-8 text-blue-600" />
              <div className="text-sm font-semibold leading-6 text-slate-900">
                {affectedAudiences.slice(0, 2).map((item) => item.audience).join('、') || '暂无'}
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="text-sm font-semibold text-slate-500">优先修改项</div>
            <div className="mt-3 flex items-center gap-3">
              <Badge className="bg-red-500 text-white">P0</Badge>
              <div className="text-sm font-semibold leading-6 text-slate-900">{topRisk ? moduleTitle(topRisk.module) : '暂无'}</div>
            </div>
          </div>
        </div>
      </Card>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <SectionTitle title="2. 陪审团模拟投票" description="按用户群与 PRD 模块展示支持、犹豫、反对分布。" />
          <div className="flex gap-4 text-xs font-medium">
            {Object.entries(voteMeta).map(([key, meta]) => (
              <span key={key} className="flex items-center gap-1 text-slate-500">
                <span className={cn('h-2 w-2 rounded-full', meta.color)} />
                {meta.label}
              </span>
            ))}
          </div>
        </div>
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500">
                  <th className="w-44 border-b border-r border-slate-200 px-4 py-3 text-left font-semibold">用户陪审团</th>
                  {result.modules.map((module) => (
                    <th key={module.module_key} className="min-w-44 border-b border-r border-slate-200 px-4 py-3 text-center font-semibold">{moduleTitle(module)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.report_meta.audiences.map((audience, index) => (
                  <tr key={audience}>
                    <td className="border-r border-slate-200 px-4 py-4 font-semibold text-slate-900">
                      <div className="flex items-center gap-3">
                        <span className={cn('flex h-8 w-8 items-center justify-center rounded-full text-xs', index % 2 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700')}>
                          {audience.slice(0, 1)}
                        </span>
                        {audience}
                      </div>
                    </td>
                    {result.modules.map((module) => {
                      const item = module.audience_results.find((candidate) => candidate.audience_name === audience)
                      return (
                        <td key={`${audience}-${module.module_key}`} className="border-r border-slate-100 px-4 py-4">
                          {item ? <VoteBar item={item} metrics={metrics} /> : <div className="h-8 rounded-full bg-slate-100" />}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <section>
        <SectionTitle title={`3. 观察指标分析（已选 ${metrics.length} 项）`} description={`当前观察指标：${metrics.join('、')}`} />
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sortedModules.slice(0, 6).map((module) => (
            <IndicatorCard key={module.module_key} module={module} metrics={metrics} />
          ))}
        </div>
      </section>

      <section>
        <SectionTitle title="4. 建议修改方案" description="按优先级拆分为本轮必须改、建议优化和待验证事项。" />
        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          {suggestionGroups.map((modules, groupIndex) => (
            <div key={priorityMeta[groupIndex].title} className={cn('rounded-3xl border p-4', priorityMeta[groupIndex].className)}>
              <div className="mb-4 flex items-center gap-3">
                <Badge className={priorityMeta[groupIndex].badge}>{groupIndex === 0 ? 'P0' : groupIndex === 1 ? 'P1' : '实验'}</Badge>
                <div className="font-semibold">{priorityMeta[groupIndex].title}</div>
              </div>
              <div className="space-y-3">
                {modules.length ? modules.map((module, index) => {
                  const item = [...module.audience_results].sort((a, b) => averageScore(b, metrics) - averageScore(a, metrics))[0]
                  return <SuggestionCard key={module.module_key} module={module} item={item} index={index} metrics={metrics} />
                }) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">暂无对应模块。</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            说明：风险等级定义为 高（严重影响核心目标）/ 中高（较大影响，需优先处理）/ 中（中等影响，计划优化）/ 低（影响较小，可跟踪验证）。
          </div>
          <div className="flex flex-wrap gap-2">
            <GhostButton className="px-3 py-1.5 text-xs">
              <Clipboard className="mr-2 h-3.5 w-3.5" />
              复制到 PRD
            </GhostButton>
            <GhostButton className="px-3 py-1.5 text-xs">
              <FlaskConical className="mr-2 h-3.5 w-3.5" />
              生成实验指标
            </GhostButton>
            <GhostButton className="px-3 py-1.5 text-xs">
              标记已采纳
              <ArrowRight className="ml-2 h-3.5 w-3.5" />
            </GhostButton>
          </div>
        </div>
      </Card>
    </div>
  )
}
