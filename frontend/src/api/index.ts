import { request } from './client'
import type {
  AnalysisJob,
  AIModelProvider,
  AudienceDefinition,
  DemoDocument,
  DocumentInput,
  ManualAudienceInput,
  ModelReasoningEffort,
  ParsedDocument,
} from '../types/api'

export const api = {
  getDemoDocument: () => request<DemoDocument>('/demo/document'),
  parseDocumentLink: (url: string) =>
    request<ParsedDocument>('/documents/parse-link', { method: 'POST', body: JSON.stringify({ url }) }),
  parseDocumentFile: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return request<ParsedDocument>('/documents/parse-file', { method: 'POST', body: formData })
  },
  listAudiences: () => request<AudienceDefinition[]>('/audiences'),
  runAnalysis: (payload: { document: DocumentInput; selected_audience_keys: string[]; manual_audiences: ManualAudienceInput[]; selected_metrics: string[]; model_reasoning_effort?: ModelReasoningEffort; ai_model_provider?: AIModelProvider }) =>
    request<AnalysisJob>('/analysis/run', { method: 'POST', body: JSON.stringify(payload) }),
  rerunAnalysis: (jobId: number, payload: { model_reasoning_effort: ModelReasoningEffort; ai_model_provider?: AIModelProvider }) =>
    request<AnalysisJob>(`/analysis/${jobId}/rerun`, { method: 'POST', body: JSON.stringify(payload) }),
  generateModificationSuggestions: (jobId: number) =>
    request<AnalysisJob>(`/analysis/${jobId}/modification-suggestions`, { method: 'POST' }),
  getAnalysis: (jobId: number) => request<AnalysisJob>(`/analysis/${jobId}`),
  exportMarkdown: (jobId: number) => request<{ markdown: string }>(`/reports/${jobId}/markdown`),
  logEvent: (payload: { event_name: string; payload?: Record<string, unknown> }) =>
    request<{ ok: boolean }>('/events', { method: 'POST', body: JSON.stringify(payload) }),
}
