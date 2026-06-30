import { useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Download,
  FlaskConical,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Wand2,
} from 'lucide-react'
import { api } from '../api'
import { Badge, Button, Card, GhostButton, SectionTitle } from '../components/ui'
import type { AudienceModuleResult, JuryReportPayload, ModuleReport } from '../types/api'
import { cn } from '../lib/utils'

type RiskValue = 'red' | 'yellow' | 'green'
type AttitudeValue = RiskValue | 'unknown' | 'verify'
const DEFAULT_METRICS = ['CTR', 'UV', 'PV']

const voteMeta: Record<AttitudeValue, { label: string; color: string; bg: string; text: string }> = {
  green: { label: '支持', color: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  yellow: { label: '犹豫', color: 'bg-amber-400', bg: 'bg-amber-50', text: 'text-amber-700' },
  red: { label: '反对', color: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700' },
  unknown: { label: '看不懂', color: 'bg-slate-400', bg: 'bg-slate-50', text: 'text-slate-600' },
  verify: { label: '需验证', color: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700' },
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

function isProductDesignModule(module: ModuleReport) {
  const text = `${module.module_title} ${module.module_summary}`.toLowerCase()
  const excluded = /背景|目标|报告输出|输出报告|里程碑|版本规划|团队协作|附录|文档信息|数据口径|项目计划|排期/u
  if (excluded.test(text)) return false
  const included = /功能|入口|流程|页面|交互|转化|下单|支付|购物车|收藏|搜索|推荐|内容|权益|规则|展示|提示|反馈|按钮|表单|路径|产品|策略|体验/u
  return included.test(text) || !excluded.test(text)
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

function getSortedRisks(result: JuryReportPayload, metrics: string[]) {
  const productModules = result.modules.filter(isProductDesignModule)
  const modules = productModules.length ? productModules : result.modules
  return modules
    .flatMap((module) => module.audience_results.map((item) => ({
      module,
      item,
      score: averageScore(item, metrics),
    })))
    .sort((a, b) => b.score - a.score)
}

function riskAdvice(module: ModuleReport, item?: AudienceModuleResult) {
  if (!item) return '优先检查产品入口、核心流程和关键状态反馈，再进入完整分析确认影响范围。'
  if (item.behavior.get_stuck_at) return `从产品设计上优先降低「${item.behavior.get_stuck_at}」的理解和操作成本。`
  return item.risk_reason || module.module_summary || '优先补充产品价值说明、关键行动入口、状态反馈和可信信息。'
}

function attitudeCounts(result: JuryReportPayload, metrics: string[]) {
  const counts = { green: 0, yellow: 0, red: 0, unknown: 0, verify: 0 }
  result.modules.forEach((module) => {
    module.audience_results.forEach((item) => {
      counts[itemAttitude(item, metrics)] += 1
    })
    const missing = Math.max(0, result.report_meta.audiences.length - module.audience_results.length)
    counts.unknown += missing
  })
  return counts
}

function itemAttitude(item: AudienceModuleResult, metrics: string[]): AttitudeValue {
  const text = `${item.behavior.get_stuck_at} ${item.risk_reason}`
  const score = averageScore(item, metrics)
  if (score >= 45 && /理解|看不懂|不清楚|复杂|规则|门槛/u.test(text)) return 'unknown'
  if (score >= 40 && score < 55) return 'verify'
  return strongestRisk(item, metrics)
}

function confidenceLabel(score: number) {
  if (score >= 75) return '高'
  if (score >= 45) return '中'
  return '低'
}

function priorityLabel(score: number) {
  return score >= 65 ? 'P0' : 'P1'
}

function impactPath(item?: AudienceModuleResult) {
  if (!item) return '用户无法形成明确判断，后续点击与转化承压。'
  return `${item.behavior.will_do}，但在「${item.behavior.get_stuck_at}」处产生阻滞，最终可能${item.behavior.wont_do}。`
}

function ReadableText({ text }: { text: string }) {
  if (text.length <= 150) return <>{text}</>
  const parts = text
    .split(/[。；;]/u)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 4)
  return (
    <span className="block space-y-1">
      <span className="block font-medium text-slate-900">要点：</span>
      {parts.map((part, index) => <span key={part} className="block">{index + 1}. {part}</span>)}
    </span>
  )
}

function userMindset(item?: AudienceModuleResult) {
  if (!item) return '需要更明确的价值判断依据。'
  if (/信任|保障|评价|售后/u.test(item.risk_reason)) return '用户在确认可信度和保障边界前，不愿继续投入行动成本。'
  if (/规则|理解|复杂|门槛/u.test(`${item.behavior.get_stuck_at} ${item.risk_reason}`)) return '用户希望快速得到确定结论，复杂规则会放大犹豫。'
  return '用户会先判断收益是否足够直接，再决定是否继续。'
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
  const navigate = useNavigate()

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

  const suggestionMutation = useMutation({
    mutationFn: () => api.generateModificationSuggestions(jobId),
    onSuccess: (job) => navigate(`/suggestions/${job.id}`),
  })

  useEffect(() => {
    document.title = query.data?.result ? `${query.data.result.report_meta.document_title} - 用户陪审团完整分析报告` : '用户陪审团完整分析报告'
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
              <Link to="/web">
                <GhostButton className="mt-4">返回配置</GhostButton>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-slate-500" />
              <div className="text-lg font-semibold text-slate-900">正在生成完整分析报告</div>
              <div className="text-sm text-slate-500">当前阶段：{job.stage}。页面会自动刷新结果。</div>
            </div>
          )}
        </Card>
      </div>
    )
  }

  const metrics = reportMetrics(result)
  const risks = getSortedRisks(result, metrics)
  const topRisk = risks[0]
  const overallScore = Math.round(result.modules.reduce((sum, module) => sum + moduleAverage(module, metrics), 0) / Math.max(result.modules.length, 1))
  const overallGrade = riskGrade(overallScore)
  const affectedAudiences = getAffectedAudiences(result, metrics)
  const sortedModules = [...result.modules].sort((a, b) => moduleAverage(b, metrics) - moduleAverage(a, metrics))
  const p0Modules = sortedModules.slice(0, 3)
  const p1Modules = sortedModules.slice(3, 5)
  const pendingModules = sortedModules.slice(5, 8)
  const suggestionGroups = [p0Modules, p1Modules, pendingModules]
  const affectedText = affectedAudiences.slice(0, 2).map((item) => item.audience).join('、') || '暂无'
  const priorityModule = topRisk ? moduleTitle(topRisk.module) : '暂无'
  const conclusion = topRisk
    ? `${priorityModule} 对 ${topRisk.item.audience_name} 的影响最高，建议先降低理解门槛并强化关键行动入口。`
    : '当前整体风险可控，建议进入模块级验证。'
  const attitudeLegend: AttitudeValue[] = ['green', 'yellow', 'red', 'unknown', 'verify']
  const topRiskCards = risks.slice(0, 3)
  const indicatorRows = sortedModules.slice(0, 6).map((module) => {
    const item = [...module.audience_results].sort((a, b) => averageScore(b, metrics) - averageScore(a, metrics))[0]
    const score = item ? averageScore(item, metrics) : moduleAverage(module, metrics)
    const direction = metricDirection(score)
    return { module, item, score, direction }
  })

  return (
    <div className="relative -m-6 min-h-screen overflow-hidden bg-slate-100 px-6 py-8">
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute left-8 top-10 h-72 w-56 rotate-[-8deg] rounded-2xl border border-slate-200 bg-white/45 blur-[1px]" />
        <div className="absolute right-10 top-24 h-44 w-72 rotate-6 rounded-2xl border border-blue-100 bg-blue-50/40 blur-[1px]" />
        <div className="absolute bottom-10 left-1/3 h-40 w-80 rounded-2xl border border-slate-200 bg-white/35 blur-[1px]" />
      </div>

      <div className="relative mx-auto w-[min(1180px,100%)] rounded-3xl border border-white/80 bg-white/90 p-6 shadow-2xl shadow-slate-900/10 backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <div className="flex items-center gap-3">
              <Link to="/web">
                <GhostButton className="px-3">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  返回配置
                </GhostButton>
              </Link>
              <Badge className="rounded-md bg-slate-100 text-slate-600">完整报告</Badge>
            </div>
            <h1 className="mt-4 text-2xl font-semibold text-slate-950">用户陪审团完整分析报告</h1>
            <p className="mt-2 text-sm text-slate-500">基于 PRD 内容生成的用户视角风险反馈、指标影响分析与修改建议</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <GhostButton>
              <RotateCcw className="mr-2 h-4 w-4" />
              重新选择
            </GhostButton>
            <Button className="bg-blue-600 hover:bg-blue-700" disabled={suggestionMutation.isPending} onClick={() => suggestionMutation.mutate()}>
              {suggestionMutation.isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              生成修改建议
            </Button>
            <GhostButton>
              <FlaskConical className="mr-2 h-4 w-4" />
              生成实验指标
            </GhostButton>
            <GhostButton onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}>
              <Download className="mr-2 h-4 w-4" />
              导出报告
            </GhostButton>
          </div>
        </div>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="grid gap-4 lg:grid-cols-[1.5fr_0.8fr_0.9fr_0.9fr_0.9fr]">
            <div>
              <div className="text-xs font-semibold text-slate-500">顶部报告结论</div>
              <div className="mt-2 text-xl font-semibold leading-8 text-slate-950">{conclusion}</div>
              <div className="mt-3 text-sm leading-6 text-slate-600">建议动作：优先处理最高风险模块，再用关键指标验证修改收益。</div>
            </div>
            <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
              <div className="text-xs text-slate-500">总风险等级</div>
              <div className="mt-2 flex items-center gap-2">
                <ShieldCheck className="h-6 w-6 text-amber-500" />
                <span className="text-2xl font-semibold text-slate-950">{overallGrade.label}</span>
              </div>
            </div>
            <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
              <div className="text-xs text-slate-500">最大风险模块</div>
              <div className="mt-2 line-clamp-2 font-semibold text-slate-950">{priorityModule}</div>
            </div>
            <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
              <div className="text-xs text-slate-500">主要受影响用户</div>
              <div className="mt-2 line-clamp-2 font-semibold text-slate-950">{affectedText}</div>
            </div>
            <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
              <div className="text-xs text-slate-500">建议动作</div>
              <div className="mt-2 font-semibold text-slate-950">P0 先改入口与说明</div>
            </div>
          </div>
        </section>

        <section className="mt-7">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <SectionTitle title="陪审团模拟投票" description="横向态度条展示不同用户群在各模块上的判断，不展开复杂矩阵细节。" />
            <div className="flex flex-wrap gap-3 text-xs text-slate-500">
              {attitudeLegend.map((key) => <span key={key} className="inline-flex items-center gap-1"><span className={cn('h-2 w-2 rounded-full', voteMeta[key].color)} />{voteMeta[key].label}</span>)}
            </div>
          </div>
          <Card className="overflow-hidden rounded-2xl p-0 shadow-none">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="w-48 border-b border-slate-200 px-4 py-3 text-left font-semibold">用户陪审团</th>
                    {result.modules.map((module) => <th key={module.module_key} className="min-w-48 border-b border-slate-200 px-4 py-3 text-left font-semibold">{moduleTitle(module)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {result.report_meta.audiences.map((audience) => (
                    <tr key={audience} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-4 font-semibold text-slate-900">{audience}</td>
                      {result.modules.map((module) => {
                        const item = module.audience_results.find((candidate) => candidate.audience_name === audience)
                        const attitude = item ? itemAttitude(item, metrics) : 'unknown'
                        const score = item ? averageScore(item, metrics) : 0
                        return (
                          <td key={`${audience}-${module.module_key}`} className="px-4 py-4">
                            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                              <div className={cn('h-full rounded-full', voteMeta[attitude].color)} style={{ width: item ? `${Math.max(18, score)}%` : '100%' }} />
                            </div>
                            <div className={cn('mt-1 text-xs font-medium', voteMeta[attitude].text)}>{voteMeta[attitude].label}{item ? ` · ${score}%` : ''}</div>
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

        <section className="mt-7">
          <SectionTitle title="Top 风险诊断" description="优先处理会影响核心目标和用户理解的模块。" />
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {topRiskCards.map(({ module, item, score }) => (
              <Card key={`${module.module_key}-${item.audience_key}`} className="rounded-2xl p-4 shadow-none">
                <div className="flex items-center justify-between gap-3">
                  <Badge className={score >= 65 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}>{priorityLabel(score)}</Badge>
                  <span className="text-xs text-slate-500">风险分 {score}</span>
                </div>
                <div className="mt-3 font-semibold text-slate-950">{moduleTitle(module)}</div>
                <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                  <div><span className="font-medium text-slate-900">受影响用户：</span>{item.audience_name}</div>
                  <div><span className="font-medium text-slate-900">用户心理：</span><ReadableText text={userMindset(item)} /></div>
                  <div><span className="font-medium text-slate-900">影响路径：</span><ReadableText text={impactPath(item)} /></div>
                  <div><span className="font-medium text-slate-900">关联指标：</span>{metrics.slice(0, 3).join(' / ')}</div>
                  <div><span className="font-medium text-slate-900">建议动作：</span><ReadableText text={riskAdvice(module, item)} /></div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-7">
          <SectionTitle title="观察指标分析" description="将风险映射到指标方向、原因和验证方式。" />
          <Card className="mt-4 overflow-hidden rounded-2xl p-0 shadow-none">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">指标</th>
                    <th className="px-4 py-3 text-left font-semibold">方向</th>
                    <th className="px-4 py-3 text-left font-semibold">影响原因</th>
                    <th className="px-4 py-3 text-left font-semibold">置信度</th>
                    <th className="px-4 py-3 text-left font-semibold">验证方式</th>
                  </tr>
                </thead>
                <tbody>
                  {indicatorRows.map(({ module, item, score, direction }, index) => (
                    <tr key={module.module_key} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-semibold text-slate-900">{metrics[index % metrics.length] ?? '核心指标'}</td>
                      <td className={cn('px-4 py-3 font-medium', direction.className)}>{direction.symbol} {direction.label}</td>
                      <td className="max-w-xl px-4 py-3 text-slate-600"><ReadableText text={item?.risk_reason ?? module.module_summary} /></td>
                      <td className="px-4 py-3 text-slate-600">{confidenceLabel(score)}</td>
                      <td className="px-4 py-3 text-slate-600">A/B 对照 + 分人群漏斗复盘</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>

        <section className="mt-7">
          <SectionTitle title="建议修改方案" description="按处理优先级拆分为本轮必须改、建议优化和待验证项。" />
          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            {suggestionGroups.map((modules, groupIndex) => (
              <div key={priorityMeta[groupIndex].title} className={cn('rounded-2xl border p-4', priorityMeta[groupIndex].className)}>
                <div className="mb-4 flex items-center gap-3">
                  <Badge className={priorityMeta[groupIndex].badge}>{groupIndex === 0 ? 'P0' : groupIndex === 1 ? 'P1' : '验证'}</Badge>
                  <div className="font-semibold">{priorityMeta[groupIndex].title}</div>
                </div>
                <div className="space-y-3">
                  {modules.length ? modules.map((module, index) => {
                    const item = [...module.audience_results].sort((a, b) => averageScore(b, metrics) - averageScore(a, metrics))[0]
                    return <SuggestionCard key={module.module_key} module={module} item={item} index={index} metrics={metrics} />
                  }) : <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">暂无对应模块。</div>}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-6 border-t border-slate-200 pt-4 text-xs text-slate-500">
          报告用于评审前判断优先级，最终结论建议结合实验和真实用户反馈验证。
        </div>
      </div>
    </div>
  )
}
export function QuickFeedbackPage() {
  const params = useParams()
  const jobId = Number(params.jobId)
  const navigate = useNavigate()

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

  useEffect(() => {
    document.title = '用户陪审团快速反馈'
  }, [])

  const enterFullAnalysisMutation = useMutation({
    mutationFn: () => api.rerunAnalysis(jobId, { model_reasoning_effort: 'medium' }),
    onSuccess: (job) => {
      navigate(`/analysis/${job.id}`)
    },
  })

  const suggestionMutation = useMutation({
    mutationFn: () => api.generateModificationSuggestions(jobId),
    onSuccess: (job) => {
      navigate(`/suggestions/${job.id}`)
    },
  })

  if (query.isLoading || !query.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900/20">
        <Card className="rounded-lg p-8">
          <LoaderCircle className="mx-auto h-7 w-7 animate-spin text-slate-500" />
        </Card>
      </div>
    )
  }

  const job = query.data
  const result = job.result
  const backToPrdPath = job.run_config?.client_surface === 'popup' ? '/popup' : '/web'

  if (job.status !== 'succeeded' || !result) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900/20 p-4">
        <Card className="max-w-md rounded-lg p-8 text-center">
          {job.status === 'failed' ? (
            <>
              <div className="text-lg font-semibold text-red-600">生成失败</div>
              <div className="mt-2 text-sm text-slate-500">{job.error_message}</div>
              <Link to={backToPrdPath}>
                <GhostButton className="mt-5">回到 PRD</GhostButton>
              </Link>
            </>
          ) : (
            <>
              <LoaderCircle className="mx-auto h-7 w-7 animate-spin text-slate-500" />
              <div className="mt-4 text-lg font-semibold text-slate-900">正在生成快速反馈</div>
              <div className="mt-1 text-sm text-slate-500">当前阶段：{job.stage}</div>
            </>
          )}
        </Card>
      </div>
    )
  }

  const metrics = reportMetrics(result)
  const risks = getSortedRisks(result, metrics)
  const topRisk = risks[0]
  const topTwoRisks = risks.slice(0, 2)
  const affectedAudiences = getAffectedAudiences(result, metrics)
  const overallScore = Math.round(result.modules.reduce((sum, module) => sum + moduleAverage(module, metrics), 0) / Math.max(result.modules.length, 1))
  const overallGrade = riskGrade(overallScore)
  const counts = attitudeCounts(result, metrics)
  const totalAttitudes = Math.max(1, counts.green + counts.yellow + counts.red + counts.unknown)
  const affectedText = affectedAudiences.slice(0, 2).map((item) => item.audience).join('、') || '暂无'
  const priorityModule = topRisk ? moduleTitle(topRisk.module) : '暂无'
  const conclusion = topRisk
    ? `${priorityModule} 是当前最大风险，主要影响 ${topRisk.item.audience_name}，建议优先处理该模块的理解门槛与行动引导。`
    : '当前未发现明显高风险模块，建议进入完整分析确认细节。'
  const attitudeItems = [
    { key: 'green', label: '支持', count: counts.green, className: 'bg-emerald-500' },
    { key: 'yellow', label: '犹豫', count: counts.yellow, className: 'bg-amber-400' },
    { key: 'red', label: '反对', count: counts.red, className: 'bg-rose-500' },
    { key: 'unknown', label: '看不懂', count: counts.unknown, className: 'bg-slate-400' },
  ].map((item) => ({ ...item, percent: Math.round((item.count / totalAttitudes) * 100) }))

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950/25 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-2xl border border-white/70 bg-white/95 p-6 shadow-2xl shadow-slate-950/20 backdrop-blur max-md:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-950">用户陪审团快速反馈</h1>
            <p className="mt-1 text-sm text-slate-500">{result.report_meta.document_title}</p>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
          <div className="text-xs font-semibold text-slate-500">一句话结论</div>
          <div className="mt-2 text-2xl font-semibold leading-9 text-slate-950 max-md:text-xl max-md:leading-8">{conclusion}</div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-xs text-slate-500">风险等级</div>
            <div className="mt-1 font-semibold text-slate-950">{overallGrade.label}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-xs text-slate-500">影响用户</div>
            <div className="mt-1 truncate font-semibold text-slate-950">{affectedText}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-xs text-slate-500">优先修改模块</div>
            <div className="mt-1 truncate font-semibold text-slate-950">{priorityModule}</div>
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-slate-900">陪审团态度</span>
          </div>
          <div className="flex h-4 overflow-hidden rounded-full bg-slate-100">
            {attitudeItems.map((item) => (
              <div key={item.key} className={item.className} style={{ width: `${Math.max(item.count ? 6 : 0, item.percent)}%` }} />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
            {attitudeItems.map((item) => (
              <span key={item.key} className="inline-flex items-center gap-1">
                <span className={cn('h-2 w-2 rounded-full', item.className)} />
                {item.label} {item.percent}%
              </span>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <div className="text-sm font-medium text-slate-900">Top 2 风险</div>
          <div className="mt-2 grid gap-2">
            {topTwoRisks.length ? topTwoRisks.map(({ module, item }) => (
              <div key={`${module.module_key}-${item.audience_key}`} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="font-semibold text-slate-950">{moduleTitle(module)}</div>
                <div className="mt-1 text-sm leading-6 text-slate-600">{riskAdvice(module, item)}</div>
              </div>
            )) : (
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-500">暂无明显风险。</div>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-4">
          <Link to={backToPrdPath}>
            <GhostButton className="border-0 px-2 text-slate-500 hover:bg-transparent">回到 PRD</GhostButton>
          </Link>
          <GhostButton disabled={suggestionMutation.isPending} onClick={() => suggestionMutation.mutate()}>
            {suggestionMutation.isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
            生成修改建议
          </GhostButton>
          <Button className="bg-blue-600 hover:bg-blue-700" disabled={enterFullAnalysisMutation.isPending} onClick={() => enterFullAnalysisMutation.mutate()}>
            {enterFullAnalysisMutation.isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            进入完整分析
          </Button>
        </div>
      </div>
    </div>
  )
}

export function ModificationSuggestionPage() {
  const params = useParams()
  const jobId = Number(params.jobId)
  const query = useQuery({
    queryKey: ['suggestions', jobId],
    queryFn: () => api.getAnalysis(jobId),
    enabled: Boolean(jobId),
    refetchInterval: (queryState) => {
      const data = queryState.state.data
      if (!data) return 2000
      return data.status === 'succeeded' || data.status === 'failed' ? false : 2000
    },
  })

  useEffect(() => {
    document.title = '用户陪审团修改建议'
  }, [])

  if (query.isLoading || !query.data) {
    return <div className="flex min-h-screen items-center justify-center"><LoaderCircle className="h-8 w-8 animate-spin text-slate-500" /></div>
  }

  const job = query.data
  const result = job.result

  if (job.status !== 'succeeded' || !result) {
    return (
      <div className="mx-auto flex min-h-screen max-w-2xl items-center justify-center p-6">
        <Card className="w-full p-8 text-center">
          {job.status === 'failed' ? (
            <>
              <div className="text-lg font-semibold text-red-600">修改建议生成失败</div>
              <div className="mt-2 text-sm text-slate-500">{job.error_message}</div>
            </>
          ) : (
            <>
              <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-slate-500" />
              <div className="mt-4 text-lg font-semibold text-slate-900">正在生成修改建议</div>
              <div className="mt-1 text-sm text-slate-500">当前阶段：{job.stage}</div>
            </>
          )}
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-5xl rounded-3xl border border-white/80 bg-white/95 p-6 shadow-xl shadow-slate-900/10">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <Badge className="rounded-md bg-blue-50 text-blue-700">修改建议</Badge>
            <h1 className="mt-3 text-2xl font-semibold text-slate-950">用户陪审团修改建议</h1>
            <p className="mt-2 text-sm text-slate-500">{result.report_meta.scope_note}</p>
          </div>
          <Link to="/web">
            <GhostButton>回到 PRD</GhostButton>
          </Link>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {result.modules.map((module, index) => {
            const item = module.audience_results[0]
            return (
              <Card key={module.module_key} className="rounded-2xl p-5 shadow-none">
                <div className="flex items-center justify-between gap-3">
                  <Badge className={index < 2 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}>{index < 2 ? 'P0' : 'P1'}</Badge>
                  <span className="text-xs text-slate-500">{item?.audience_name ?? '目标用户'}</span>
                </div>
                <div className="mt-3 text-lg font-semibold text-slate-950">{module.module_title}</div>
                <div className="mt-3 text-sm leading-6 text-slate-600">{module.module_summary}</div>
                <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                  <span className="font-medium text-slate-900">建议落点：</span>{item?.risk_reason ?? '补充说明与关键行动入口。'}
                </div>
              </Card>
            )
          })}
        </div>
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="font-semibold text-slate-900">执行摘要</div>
          <div className="mt-3 grid gap-2 text-sm leading-6 text-slate-600">
            {result.confidence_notes.map((note) => <div key={note}>- {note}</div>)}
          </div>
        </div>
      </div>
    </div>
  )
}

