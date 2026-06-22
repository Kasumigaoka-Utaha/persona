import { useNavigate } from 'react-router-dom'
import { ArrowRight, Scale } from 'lucide-react'
import teaserImage from '../../figures/teaser.jpeg'

export function WelcomePage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="relative min-h-screen overflow-hidden">
        <img
          src={teaserImage}
          alt="Feishu document with user jury entry"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-slate-950/35" />
        <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-6 py-5 lg:px-12">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/95 p-2 text-slate-950 shadow-sm">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">用户实时陪审团</div>
              <div className="text-xs text-white/70">Feishu PRD Jury Demo</div>
            </div>
          </div>
        </div>

        <main className="relative z-10 flex min-h-screen items-center justify-center px-6">
          <div className="mt-44 flex flex-col items-center text-center sm:mt-52 lg:mt-64">
            <button
              type="button"
              onClick={() => navigate('/app')}
              className="group flex h-28 w-28 items-center justify-center rounded-full border border-white/30 bg-white text-slate-950 shadow-2xl shadow-slate-950/30 transition hover:scale-105 hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-white/40 sm:h-32 sm:w-32"
              aria-label="点击体验"
            >
              <span className="flex flex-col items-center gap-1 text-sm font-semibold">
                点击体验
                <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
              </span>
            </button>
          </div>
        </main>
      </div>
    </div>
  )
}
