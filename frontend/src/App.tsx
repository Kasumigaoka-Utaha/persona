import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout'
import { HomePage } from './pages/home'
import { JuryWorkbench } from './features/jury-workbench'
import { ModificationSuggestionPage, PredictionResultPage, QuickFeedbackPage } from './pages/prediction-result'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/popup" element={<JuryWorkbench variant="popup" />} />
      <Route path="/quick-feedback/:jobId" element={<QuickFeedbackPage />} />
      <Route path="/suggestions/:jobId" element={<ModificationSuggestionPage />} />
      <Route element={<AppLayout />}>
        <Route path="/web" element={<JuryWorkbench variant="web" />} />
        <Route path="/analysis/:jobId" element={<PredictionResultPage />} />
      </Route>
      <Route path="/app" element={<Navigate to="/web" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
