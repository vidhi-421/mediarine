import { useEffect, useRef, useState } from 'react'
import { Button, Icon, Logo } from './ui'
import { navigate } from '../lib/router'

const STEPS = [
  { icon: 'overview', title: 'Welcome to Medarina', body: 'Medarina helps claim reviewers and compliance teams record healthcare claims, organize the evidence behind them, and document a reviewer decision. It supports your judgement; it never decides that a claim is fraudulent.', points: ['Overview shows open, flagged, and closed investigations', 'Records labelled Sample contain illustrative data only', 'Your data stays in this browser'] },
  { icon: 'plus', title: 'Creating investigations', body: 'New Investigation is a two-step form. Claim Details captures the statement, service dates, billed amount, and billing codes. Clinical Context captures the timeline and your intake notes.', points: ['Load Sample Claim fills a realistic example', 'Each step validates before you continue', 'A review summary appears before submission'] },
  { icon: 'sources', title: 'Evidence retrieval with TinyFish', body: 'When a TinyFish endpoint is configured in Settings, Medarina sends the claim for live source retrieval. Without one, retrieval is shown as Not configured and you can add evidence manually. Failures are always shown, never hidden.', points: ['Status moves from Queued to Retrieving to Completed or Failed', 'Each evidence item shows how it was obtained', 'Retry retrieval at any time from the investigation'], link: true },
  { icon: 'file', title: 'Reports and export', body: 'Every investigation has a printable report with the claim summary, codes, timeline, evidence, findings, notes, and signature lines.', points: ['Print uses a clean layout without the app navigation', 'Export PDF downloads Medarina-<case>.pdf', 'Open reports from the investigation or the history list'] },
]

export default function Onboarding({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const s = STEPS[i]
  const last = i === STEPS.length - 1

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[data-primary]')?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [i, onClose])

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/45 p-4 print:hidden">
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="ob-title" className="w-full max-w-xl overflow-hidden rounded-xl border border-line bg-elevated shadow-pop">
        <div className="relative bg-sage px-6 pb-6 pt-5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-semibold text-heading"><Logo size={24} />Medarina</span>
            <button onClick={onClose} className="text-[13px] font-medium text-muted hover:text-fg">Skip</button>
          </div>
          <div className="mt-6 flex items-center gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary text-primary-fg"><Icon name={s.icon} size={22} /></span>
            <div>
              <p className="tabular text-xs font-medium text-muted">Step {i + 1} of {STEPS.length}</p>
              <h2 id="ob-title" className="text-lg font-semibold tracking-tight text-heading">{s.title}</h2>
            </div>
          </div>
        </div>
        <div className="space-y-4 px-6 py-5">
          <p className="text-sm leading-relaxed">{s.body}</p>
          <ul className="space-y-2 text-sm">
            {s.points.map((p) => <li key={p} className="flex gap-2"><Icon name="check" size={16} className="mt-0.5 shrink-0 text-primary" />{p}</li>)}
          </ul>
          {s.link && <button onClick={() => { onClose(); navigate('/settings') }} className="inline-flex items-center gap-1 text-sm font-medium text-info hover:underline">Open TinyFish settings <Icon name="right" size={14} /></button>}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-4">
          <div className="flex gap-1.5" aria-hidden>
            {STEPS.map((_, k) => <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? 'w-6 bg-primary' : k < i ? 'w-1.5 bg-emerald' : 'w-1.5 bg-line'}`} />)}
          </div>
          <div className="flex gap-2">
            {i > 0 && <Button variant="ghost" onClick={() => setI(i - 1)}><Icon name="left" size={16} />Back</Button>}
            <Button data-primary variant="primary" onClick={() => (last ? onClose() : setI(i + 1))}>{last ? 'Finish' : 'Next'}{!last && <Icon name="right" size={16} />}</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
