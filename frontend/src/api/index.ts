import { request } from './client'
import type {
  AnalysisJob,
  AudienceDefinition,
  DemoDocument,
  DocumentInput,
  ManualAudienceInput,
} from '../types/api'

export const api = {
  getDemoDocument: () => request<DemoDocument>('/demo/document'),
  listAudiences: () => request<AudienceDefinition[]>('/audiences'),
  runAnalysis: (payload: { document: DocumentInput; selected_audience_keys: string[]; manual_audiences: ManualAudienceInput[] }) =>
    request<AnalysisJob>('/analysis/run', { method: 'POST', body: JSON.stringify(payload) }),
  getAnalysis: (jobId: number) => request<AnalysisJob>(`/analysis/${jobId}`),
  exportMarkdown: (jobId: number) => request<{ markdown: string }>(`/reports/${jobId}/markdown`),
  logEvent: (payload: { event_name: string; payload?: Record<string, unknown> }) =>
    request<{ ok: boolean }>('/events', { method: 'POST', body: JSON.stringify(payload) }),
}
