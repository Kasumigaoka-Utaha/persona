import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout'
import { HomePage } from './pages/home'
import { JuryWorkbench } from './features/jury-workbench'
import { PredictionResultPage } from './pages/prediction-result'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/popup" element={<JuryWorkbench variant="popup" />} />
      <Route element={<AppLayout />}>
        <Route path="/web" element={<JuryWorkbench variant="web" />} />
        <Route path="/analysis/:jobId" element={<PredictionResultPage />} />
      </Route>
      <Route path="/app" element={<Navigate to="/web" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
