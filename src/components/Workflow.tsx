import { Icon, Spinner } from './ui'
import type { Stage, StageState } from '../lib/report'

const DEFAULT_STATUS: Record<string, string> = {
  completed: 'Completed',
  done: 'Completed',
  in_progress: 'In Progress',
  active: 'In Progress',
  queued: 'Queued',
  failed: 'Failed',
  error: 'Failed',
  not_started: 'Pending',
  waiting: 'Pending',
}

function normalizeState(s: StageState): 'completed' | 'in_progress' | 'queued' | 'failed' | 'not_started' {
  if (s === 'completed' || s === 'done') return 'completed'
  if (s === 'in_progress' || s === 'active') return 'in_progress'
  if (s === 'queued') return 'queued'
  if (s === 'failed' || s === 'error') return 'failed'
  return 'not_started'
}

const STAGE_ICONS: Record<string, string> = {
  intake: 'file',
  retrieval: 'link',
  timeline: 'clock',
  analysis: 'search',
  risk: 'alert',
  report: 'file',
  review: 'check',
}

/** Connected 7-stage investigation chain with real-time progress, 5 distinct states, and live timers. */
export default function Workflow({
  stages,
  compact,
  currentStageName,
  elapsedSeconds,
}: {
  stages: Stage[]
  compact?: boolean
  currentStageName?: string
  elapsedSeconds?: number
}) {
  const completedCount = stages.filter((s) => normalizeState(s.state) === 'completed').length
  const total = stages.length || 7
  const percent = Math.min(100, Math.round((completedCount / total) * 100))
  const activeStage = stages.find((s) => normalizeState(s.state) === 'in_progress' || normalizeState(s.state) === 'queued')

  return (
    <div className="space-y-4">
      {!compact && (
        <div className="rounded-xl border border-line bg-sage/40 p-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <span className="font-bold text-heading tracking-tight">Audit Chain Progress</span>
              <span className="tabular rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                {completedCount} of {total} Stages Verified ({percent}%)
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted">
              {activeStage ? (
                <span className="inline-flex items-center gap-1.5 font-semibold text-heading">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
                  </span>
                  Active: {currentStageName || activeStage.label}
                  {elapsedSeconds !== undefined && elapsedSeconds > 0 && (
                    <span className="tabular font-bold text-primary">({elapsedSeconds}s)</span>
                  )}
                </span>
              ) : completedCount === total ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold">
                  <Icon name="check" size={14} /> Full Investigation Chain Complete
                </span>
              ) : (
                <span className="font-medium">Awaiting human reviewer action</span>
              )}
            </div>
          </div>

          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-line/80">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
              style={{ width: `${percent}%` }}
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      )}

      <ol className={`grid gap-3 ${compact ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7'} print:grid-cols-4`}>
        {stages.map((s, i) => {
          const norm = normalizeState(s.state)
          const isLiveWeb = s.key === 'retrieval'
          const iconName = STAGE_ICONS[s.key] || 'activity'

          const dot = {
            completed: 'bg-emerald-600 text-white border-emerald-600 shadow-xs',
            in_progress: 'bg-card text-heading border-primary border-2 ring-3 ring-primary/20 shadow-xs',
            queued: 'bg-amber-50 text-amber-700 border-amber-400 border-2',
            failed: 'bg-rose-50 text-rose-700 border-rose-500 border-2',
            not_started: 'bg-card text-muted border-line',
          }[norm]

          const pill = {
            completed: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
            in_progress: 'bg-sky-50 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800 font-semibold',
            queued: 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
            failed: 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800 font-semibold',
            not_started: 'bg-slate-100 text-slate-600 dark:bg-slate-800/80 dark:text-slate-400 border-line',
          }[norm]

          const cardBorder = {
            completed: 'border-line/90 bg-card hover:border-emerald-400/60',
            in_progress: 'border-primary shadow-sm bg-mint/30 dark:bg-mint/10 ring-1 ring-primary/30',
            queued: 'border-amber-300 bg-amber-50/40 dark:bg-amber-950/20',
            failed: 'border-rose-300 bg-rose-50/40 dark:bg-rose-950/20',
            not_started: 'border-line/70 bg-card/60',
          }[norm]

          const next = stages[i + 1]
          const nextNorm = next ? normalizeState(next.state) : null

          return (
            <li
              key={s.key}
              className={`relative flex flex-col justify-between break-inside-avoid rounded-xl border p-3.5 transition-all duration-200 ${cardBorder}`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-bold ${dot}`}>
                    {norm === 'completed' ? (
                      <Icon name="check" size={13} />
                    ) : norm === 'failed' ? (
                      <Icon name="x" size={12} />
                    ) : norm === 'in_progress' ? (
                      <Spinner size={12} />
                    ) : (
                      i + 1
                    )}
                  </span>
                  {next && (
                    <span
                      aria-hidden
                      className={`h-0.5 flex-1 rounded-full ${
                        norm === 'completed' && nextNorm === 'completed'
                          ? 'bg-emerald-500'
                          : norm === 'completed'
                          ? 'bg-emerald-200 dark:bg-emerald-900'
                          : 'bg-line/60'
                      }`}
                    />
                  )}
                </div>

                <div className="mt-2.5 flex items-center justify-between gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                    Stage {i + 1}
                  </span>
                  {isLiveWeb && (
                    <span className="inline-flex items-center gap-1 rounded bg-purple-100 dark:bg-purple-950/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-purple-800 dark:text-purple-300">
                      <Icon name="link" size={9} /> TinyFish
                    </span>
                  )}
                </div>

                <p className="mt-1 text-sm font-semibold leading-snug text-heading">
                  {s.label}
                </p>

                <div className="mt-2">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${pill}`}>
                    {norm === 'in_progress' && <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />}
                    {s.status ?? DEFAULT_STATUS[s.state]}
                  </span>
                </div>
              </div>

              <p className={`mt-2.5 text-xs leading-relaxed ${norm === 'failed' ? 'text-rose-700 dark:text-rose-300 font-semibold' : 'text-muted'}`}>
                {s.note}
              </p>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
