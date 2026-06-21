import { useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { Download, LoaderCircle } from 'lucide-react'
import { api } from '../api'
import { Badge, Button, Card, SectionTitle } from '../components/ui'
import { divergenceLabel, riskEmoji, riskLabel } from '../lib/utils'

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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">陪审团分析报告</h1>
          <p className="mt-2 text-sm text-slate-500">行为判断在前，风险评级在后；仅用于方向性分析，不代表真实线上结果。</p>
        </div>
        <div className="flex gap-3">
          <Badge className="bg-slate-900 text-white">{job.status}</Badge>
          <Button onClick={() => exportMutation.mutate()} disabled={job.status !== 'succeeded' || exportMutation.isPending}>
            <Download className="mr-2 h-4 w-4" />导出 Markdown
          </Button>
        </div>
      </div>

      <Card className="p-6">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400">Document</div>
            <div className="mt-1 font-medium text-slate-900">{job.document_title}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400">Host</div>
            <div className="mt-1 font-medium text-slate-900">{job.host}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400">Stage</div>
            <div className="mt-1 font-medium text-slate-900">{job.stage}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400">Started</div>
            <div className="mt-1 font-medium text-slate-900">{job.started_at ? new Date(job.started_at).toLocaleString() : '--'}</div>
          </div>
        </div>
      </Card>

      {job.status !== 'succeeded' ? (
        <Card className="p-10 text-center">
          {job.status === 'failed' ? (
            <div className="space-y-3">
              <div className="text-lg font-semibold text-red-600">生成失败</div>
              <div className="text-sm text-slate-500">{job.error_message}</div>
            </div>
          ) : (
            <div className="space-y-3">
              <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-slate-500" />
              <div className="text-lg font-semibold text-slate-900">AI 正在审判中</div>
              <div className="text-sm text-slate-500">当前阶段：{job.stage}。页面会自动刷新结果。</div>
            </div>
          )}
        </Card>
      ) : result ? (
        <>
          <Card className="p-6">
            <SectionTitle title="一、分析说明" description="当前文档、分析范围与覆盖用户群。" />
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                <div className="font-medium text-slate-900">文档标题</div>
                <div className="mt-2">{result.report_meta.document_title}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                <div className="font-medium text-slate-900">分析时间</div>
                <div className="mt-2">{new Date(result.report_meta.analyzed_at).toLocaleString()}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 md:col-span-2">
                <div className="font-medium text-slate-900">所选用户群</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {result.report_meta.audiences.map((audience) => <Badge key={audience}>{audience}</Badge>)}
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 md:col-span-2">
                <div className="font-medium text-slate-900">分析范围说明</div>
                <div className="mt-2">{result.report_meta.scope_note}</div>
              </div>
            </div>
          </Card>

          <section className="space-y-4">
            <SectionTitle title="二、分用户群模块分析" description="按 PRD 模块逐项输出行为判断与 CTR/UV/PV 风险。" />
            <div className="space-y-4">
              {result.modules.map((module) => (
                <Card key={module.module_key} className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-lg font-semibold text-slate-900">{module.module_title}</div>
                      <div className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{module.module_summary}</div>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-4 xl:grid-cols-2">
                    {module.audience_results.map((item) => (
                      <div key={`${module.module_key}-${item.audience_key}`} className="rounded-2xl border border-slate-200 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-slate-900">{item.audience_name}</div>
                          <div className="flex gap-2 text-base">
                            <span title={`CTR ${riskLabel(item.risk_ratings.ctr)}`}>{riskEmoji(item.risk_ratings.ctr)}</span>
                            <span title={`UV ${riskLabel(item.risk_ratings.uv)}`}>{riskEmoji(item.risk_ratings.uv)}</span>
                            <span title={`PV ${riskLabel(item.risk_ratings.pv)}`}>{riskEmoji(item.risk_ratings.pv)}</span>
                          </div>
                        </div>
                        <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                          <div><span className="font-medium text-slate-900">会做什么：</span>{item.behavior.will_do}</div>
                          <div><span className="font-medium text-slate-900">会卡在哪：</span>{item.behavior.get_stuck_at}</div>
                          <div><span className="font-medium text-slate-900">不会做什么：</span>{item.behavior.wont_do}</div>
                          <div className="rounded-2xl bg-slate-50 p-3">
                            <div className="font-medium text-slate-900">风险评级</div>
                            <div className="mt-2">CTR {riskEmoji(item.risk_ratings.ctr)} · UV {riskEmoji(item.risk_ratings.uv)} · PV {riskEmoji(item.risk_ratings.pv)}</div>
                            <div className="mt-2 text-slate-500">原因：{item.risk_reason}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <Card className="p-6">
              <SectionTitle title="三、多用户群对比汇总表" description="帮助快速识别不同用户群之间的高分歧模块。" />
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-2 text-sm">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="px-3 py-2">模块</th>
                      {result.report_meta.audiences.map((audience) => (
                        <th key={audience} className="px-3 py-2">{audience}</th>
                      ))}
                      <th className="px-3 py-2">分歧结论</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.comparison_table.map((row) => (
                      <tr key={row.module_key} className="rounded-2xl bg-slate-50 text-slate-700">
                        <td className="rounded-l-2xl px-3 py-3 font-medium text-slate-900">{row.module_title}</td>
                        {row.audiences.map((cell) => (
                          <td key={`${row.module_key}-${cell.audience_key}`} className="px-3 py-3">{riskEmoji(cell.overall_risk)}</td>
                        ))}
                        <td className="rounded-r-2xl px-3 py-3">{divergenceLabel(row.divergence_level)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="space-y-6">
              <Card className="p-6">
                <SectionTitle title="高分歧模块" description="优先关注不同用户群判断最不一致的模块。" />
                <div className="mt-4 space-y-3">
                  {result.high_divergence_modules.length ? result.high_divergence_modules.map((item) => (
                    <div key={item.module_key} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium text-slate-900">{item.module_title}</div>
                        <Badge className={item.divergence_level === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}>
                          {divergenceLabel(item.divergence_level)}
                        </Badge>
                      </div>
                      <div className="mt-2 text-sm leading-6 text-slate-600">{item.reason}</div>
                    </div>
                  )) : <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">当前未识别出高分歧模块。</div>}
                </div>
              </Card>

              <Card className="p-6">
                <SectionTitle title="四、结论摘要" description="只做汇总，不提供该怎么改的建议。" />
                <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                  <div><span className="font-medium text-slate-900">高风险模块：</span>{result.conclusion.high_risk_modules.join('、') || '无'}</div>
                  <div><span className="font-medium text-slate-900">高分歧模块：</span>{result.conclusion.high_divergence_modules.join('、') || '无'}</div>
                  <div><span className="font-medium text-slate-900">覆盖用户群：</span>{result.conclusion.covered_audiences.join('、') || '无'}</div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {result.confidence_notes.map((note) => <Badge key={note} className="bg-amber-100 text-amber-800">{note}</Badge>)}
                </div>
              </Card>
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
