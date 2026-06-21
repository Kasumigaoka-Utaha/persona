import { cn } from '../lib/utils'

const labels = ['任务与输入', 'Persona 构建', '指标选择', '运行预测']

export function Stepper({ currentStep }: { currentStep: number }) {
  return (
    <div className="grid gap-3 md:grid-cols-4">
      {labels.map((label, index) => (
        <div
          key={label}
          className={cn(
            'rounded-2xl border px-4 py-3 text-sm',
            currentStep === index
              ? 'border-blue-600 bg-blue-50 text-blue-700'
              : currentStep > index
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-white text-slate-500',
          )}
        >
          <div className="text-xs font-medium">STEP {index + 1}</div>
          <div className="mt-1 font-semibold">{label}</div>
        </div>
      ))}
    </div>
  )
}
