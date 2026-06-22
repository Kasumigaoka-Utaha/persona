import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout'
import { HomePage } from './pages/home'
import { PredictionResultPage } from './pages/prediction-result'
import { WelcomePage } from './pages/welcome'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<WelcomePage />} />
      <Route element={<AppLayout />}>
        <Route path="/app" element={<HomePage />} />
        <Route path="/analysis/:jobId" element={<PredictionResultPage />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Route>
    </Routes>
  )
}
