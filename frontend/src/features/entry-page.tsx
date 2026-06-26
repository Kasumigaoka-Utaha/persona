import { Link } from 'react-router-dom'
import { Monitor, PanelRightOpen, Scale } from 'lucide-react'
import { Button, Card } from '../components/ui'

export function EntryPage() {
  return (
    <div className="min-h-screen bg-slate-100 px-6 py-10 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl flex-col justify-center">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
            <Scale className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-semibold tracking-tight">用户实时陪审团</div>
            <div className="text-sm text-slate-500">PRD 体验入口</div>
          </div>
        </div>

        <Card className="p-8">
          <div className="max-w-xl space-y-4">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">选择体验模式</h1>
            <p className="text-sm leading-6 text-slate-600">
              进入网页模式查看完整分析流程，或进入弹窗模式体验更接近文档内浮层的操作方式。
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Link to="/popup">
              <Button className="h-14 w-full justify-center gap-2 bg-blue-600 text-base hover:bg-blue-700">
                <PanelRightOpen className="h-5 w-5" />
                弹窗模式体验
              </Button>
            </Link>
            <Link to="/web">
              <Button className="h-14 w-full justify-center gap-2 bg-slate-900 text-base hover:bg-slate-800">
                <Monitor className="h-5 w-5" />
                网页模式体验
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}
