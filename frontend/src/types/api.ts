export type BehaviorSummary = {
  conversion_trait: string
  dwell_trait: string
  dropoff_points: string[]
  content_preferences: string[]
}

export type AudienceDefinition = {
  id: number
  key: string
  name: string
  definition: string
  behavior_summary: BehaviorSummary
  source: string
  is_active: boolean
}

export type ManualAudienceInput = {
  name: string
  definition: string
  conversion_trait: string
  dwell_trait: string
  dropoff_points: string[]
  content_preferences: string[]
}

export type DocumentInput = {
  title: string
  content: string
  host: string
  source_mode: string
}

export type DemoDocument = {
  title: string
  content: string
  host: string
}

export type BehaviorPrediction = {
  will_do: string
  get_stuck_at: string
  wont_do: string
}

export type RiskRatings = {
  ctr: 'red' | 'yellow' | 'green'
  uv: 'red' | 'yellow' | 'green'
  pv: 'red' | 'yellow' | 'green'
}

export type MetricScores = {
  ctr: number
  uv: number
  pv: number
}

export type AudienceModuleResult = {
  audience_key: string
  audience_name: string
  behavior: BehaviorPrediction
  risk_ratings: RiskRatings
  metric_scores: MetricScores
  risk_reason: string
}

export type ModuleReport = {
  module_key: string
  module_title: string
  module_summary: string
  audience_results: AudienceModuleResult[]
}

export type ComparisonAudienceCell = {
  audience_key: string
  audience_name: string
  overall_risk: 'red' | 'yellow' | 'green'
}

export type ComparisonRow = {
  module_key: string
  module_title: string
  audiences: ComparisonAudienceCell[]
  divergence_level?: 'high' | 'medium' | null
}

export type DivergenceItem = {
  module_key: string
  module_title: string
  divergence_level: 'high' | 'medium'
  reason: string
}

export type ConclusionSummary = {
  high_risk_modules: string[]
  high_divergence_modules: string[]
  covered_audiences: string[]
}

export type ReportMeta = {
  document_title: string
  analyzed_at: string
  audiences: string[]
  scope_note: string
}

export type JuryReportPayload = {
  report_meta: ReportMeta
  modules: ModuleReport[]
  comparison_table: ComparisonRow[]
  high_divergence_modules: DivergenceItem[]
  conclusion: ConclusionSummary
  confidence_notes: string[]
}

export type AnalysisJob = {
  id: number
  status: string
  stage: string
  error_message?: string | null
  model_name?: string | null
  host: string
  source_mode: string
  document_title: string
  started_at?: string | null
  finished_at?: string | null
  created_at: string
  updated_at: string
  result?: JuryReportPayload | null
}
