import { Icon, Spinner } from './ui'
import type { Stage, StageState } from '../lib/report'

const DEFAULT_STATUS: Record<StageState, string> = { done: 'Completed', active: 'In Progress', error: 'Needs Attention', waiting: 'Pending' }

/** Connected investigation chain. Each stage carries a text status so state is never conveyed by colour alone. */
export default function Workflow({ stages, compact }: { stages: Stage[]; compact?: boolean }) {
  return (
    <ol className={`grid gap-2 ${compact ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7'} print:grid-cols-4`}>
      {stages.map((s, i) => {
        const tf = s.key === 'retrieval'
        const dot = {
          done: 'bg-emerald text-[#2e3d28] border-emerald',
          active: 'bg-card text-heading border-emerald border-2',
          error: 'bg-crit-bg text-crit-fg border-crit',
          waiting: 'bg-card text-muted border-line',
        }[s.state]
        const pill = {
          done: 'bg-success-bg text-success-fg',
          active: 'bg-mint text-mint-fg',
          error: 'bg-crit-bg text-crit-fg',
          waiting: 'bg-sage text-muted',
        }[s.state]
        const next = stages[i + 1]
        return (
          <li key={s.key} className={`relative break-inside-avoid rounded-lg p-3 ${tf ? 'border border-emerald bg-sage' : ''}`}>
            <div className="flex items-center gap-2">
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-semibold ${dot}`}>
                {s.state === 'done' ? <Icon name="check" size={12} /> : s.state === 'error' ? <Icon name="x" size={12} /> : s.state === 'active' && tf ? <Spinner size={11} /> : i + 1}
              </span>
              {next && <span aria-hidden className={`h-px flex-1 ${s.state === 'done' ? 'bg-emerald' : 'bg-line'}`} />}
            </div>
            {tf && <p className="mt-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted">Live-web stage</p>}
            <p className={`${tf ? 'mt-0.5 font-semibold text-heading' : 'mt-2.5 font-medium'} text-sm leading-snug`}>{s.label}</p>
            <span className={`mt-1.5 inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${pill}`}>{s.status ?? DEFAULT_STATUS[s.state]}</span>
            <p className={`mt-1 text-xs ${s.state === 'error' ? 'text-crit-fg' : 'text-muted'}`}>{s.note}</p>
          </li>
        )
      })}
    </ol>
  )
}
