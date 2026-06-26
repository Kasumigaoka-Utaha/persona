import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout'
import { HomePage } from './pages/home'
import { PredictionResultPage } from './pages/prediction-result'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/app" element={<Navigate to="/" replace />} />
        <Route path="/analysis/:jobId" element={<PredictionResultPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
