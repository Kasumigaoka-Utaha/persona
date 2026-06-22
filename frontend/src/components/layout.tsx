import { Link, NavLink, Outlet } from 'react-router-dom'
import { PanelRightDashed, Scale } from 'lucide-react'

export function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/app" className="flex items-center gap-3">
            <div className="rounded-2xl bg-slate-900 p-2 text-white">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">用户实时陪审团</div>
              <div className="text-xs text-slate-500">Feishu PRD 陪审团 Demo</div>
            </div>
          </Link>
          <nav className="flex items-center gap-2">
            <NavLink to="/app" className={({ isActive }) => `rounded-xl px-3 py-2 text-sm ${isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              <span className="inline-flex items-center gap-2"><PanelRightDashed className="h-4 w-4" />陪审团面板</span>
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
