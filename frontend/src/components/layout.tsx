import { Link, Outlet } from 'react-router-dom'
import { Scale } from 'lucide-react'

export function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="rounded-2xl bg-slate-900 p-2 text-white">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">用户实时陪审团</div>
              <div className="text-xs text-slate-500">圈用户，洞察一键可得</div>
            </div>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
