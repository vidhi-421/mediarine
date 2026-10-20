import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { dismissToast, useToasts } from '../lib/toast'
import type { Classification, Origin, RetrievalState, ReviewStatus } from '../lib/store'

const P: Record<string, ReactNode> = {
  overview: (<><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>),
  search: (<><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>),
  plus: <path d="M12 5v14M5 12h14" />,
  history: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  link: (<><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></>),
  sources: (<><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>),
  settings: <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />,
  sun: (<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>),
  moon: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  check: <path d="M20 6 9 17l-5-5" />,
  alert: (<><path d="m21.7 18-8-14a2 2 0 0 0-3.5 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z" /><path d="M12 9v4M12 17h.01" /></>),
  help: (<><circle cx="12" cy="12" r="9" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01" /></>),
  minus: <path d="M5 12h14" />,
  external: <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />,
  refresh: (<><path d="M3 12a9 9 0 0 1 9-9 9.8 9.8 0 0 1 6.7 2.7L21 8M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.8 9.8 0 0 1-6.7-2.7L3 16M8 16H3v5" /></>),
  right: <path d="m9 18 6-6-6-6" />,
  left: <path d="m15 18-6-6 6-6" />,
  down: <path d="m6 9 6 6 6-6" />,
  up: <path d="m18 15-6-6-6 6" />,
  trash: <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />,
  info: (<><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></>),
  inbox: (<><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6Z" /></>),
  bell: <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0" />,
  logout: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
  archive: (<><rect x="2" y="3" width="20" height="5" rx="1" /><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4" /></>),
  eye: (<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>),
  panel: (<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /></>),
  book: <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5ZM4 19.5V21h16" />,
  lock: (<><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>),
  file: (<><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" /><path d="M14 3v6h6M8 13h8M8 17h5" /></>),
  printer: (<><path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M6 14h12v7H6Z" /></>),
  download: <path d="M12 3v12M7 10l5 5 5-5M4 21h16" />,
  play: <path d="M7 4v16l13-8Z" />,
  activity: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  user: (<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>),
}

export function Icon({ name, size = 18, className = '' }: { name: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      {P[name]}
    </svg>
  )
}

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <rect width="32" height="32" rx="9" fill="var(--primary)" />
      <path d="M13 7h6v6h6v6h-6v6h-6v-6H7v-6h6Z" fill="var(--primary-fg)" />
      <circle cx="16" cy="16" r="2.6" fill="var(--primary)" />
    </svg>
  )
}

export function Spinner({ size = 16 }: { size?: number }) {
  return <span role="status" aria-label="Loading" className="inline-block rounded-full border-2 border-current border-t-transparent" style={{ width: size, height: size, animation: 'spin 0.8s linear infinite' }} />
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md'; loading?: boolean }
export function Button({ variant = 'secondary', size = 'md', loading, className = '', children, disabled, ...rest }: BtnProps) {
  const v = {
    primary: 'bg-primary text-primary-fg hover:bg-primary-hover border border-transparent',
    secondary: 'bg-card text-fg border border-line hover:bg-sage',
    ghost: 'bg-transparent text-fg hover:bg-sage border border-transparent',
    danger: 'bg-card text-crit-fg border border-line hover:bg-crit-bg',
  }[variant]
  return (
    <button {...rest} disabled={disabled || loading} className={`inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-sm'} ${v} ${className}`}>
      {loading && <Spinner size={14} />}
      {children}
    </button>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-line bg-card shadow-card ${className}`}>{children}</section>
}

export function CardHeader({ title, desc, action }: { title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div>
        <h2 className="text-[15px] font-semibold text-heading">{title}</h2>
        {desc && <p className="mt-0.5 text-[13px] text-muted">{desc}</p>}
      </div>
      {action}
    </div>
  )
}

export function PageHeader({ title, desc, action }: { title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-heading">{title}</h1>
        {desc && <p className="mt-1 max-w-2xl text-sm text-muted">{desc}</p>}
      </div>
      {action}
    </div>
  )
}

const chip = 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium'

export const STATUS: Record<ReviewStatus, { label: string; cls: string; icon: string }> = {
  pending: { label: 'Pending Review', cls: 'bg-sage text-fg border border-line', icon: 'history' },
  review: { label: 'Review Required', cls: 'bg-warn-bg text-warn-fg', icon: 'alert' },
  completed: { label: 'Review Completed', cls: 'bg-success-bg text-success-fg', icon: 'check' },
  retrieving: { label: 'Retrieving Sources', cls: 'bg-sky-bg text-info', icon: 'refresh' },
  failed: { label: 'Source Retrieval Failed', cls: 'bg-crit-bg text-crit-fg', icon: 'x' },
}
export function StatusChip({ status }: { status: ReviewStatus }) {
  const s = STATUS[status]
  return (
    <span className={`${chip} ${s.cls}`}>
      {status === 'retrieving' ? <Spinner size={11} /> : <Icon name={s.icon} size={12} />}
      {s.label}
    </span>
  )
}

export const CLASS: Record<Classification, { label: string; cls: string; icon: string }> = {
  verified: { label: 'Verified fact', cls: 'bg-success-bg text-success-fg', icon: 'check' },
  unverified: { label: 'Unverified claim', cls: 'bg-sage text-muted border border-line', icon: 'help' },
  conflicting: { label: 'Conflicting evidence', cls: 'bg-warn-bg text-warn-fg', icon: 'alert' },
  inconclusive: { label: 'Inconclusive', cls: 'border border-dashed border-line text-muted', icon: 'minus' },
}
export function ClassChip({ value }: { value: Classification }) {
  const c = CLASS[value]
  return (
    <span className={`${chip} ${c.cls}`}>
      <Icon name={c.icon} size={12} />
      {c.label}
    </span>
  )
}

export function OriginChip({ origin }: { origin: Origin }) {
  const m = {
    'live-source': ['Live source retrieval', 'bg-sky-bg text-info', 'link'],
    'ai-summary': ['AI-generated summary', 'bg-sage text-fg border border-line', 'info'],
    'user-provided': ['Reviewer-provided', 'bg-sage text-fg border border-line', 'user'],
  }[origin]
  return (
    <span className={`${chip} ${m[1]}`}>
      <Icon name={m[2]} size={12} />
      {m[0]}
    </span>
  )
}

export function RetrievalChip({ state }: { state: RetrievalState }) {
  const m = {
    retrieved: ['Retrieved', 'bg-success-bg text-success-fg'],
    failed: ['Retrieval failed', 'bg-crit-bg text-crit-fg'],
    not_attempted: ['Not retrieved', 'bg-sage text-muted border border-line'],
  }[state]
  return <span className={`${chip} ${m[1]}`}>{m[0]}</span>
}

export function SampleChip({ compact }: { compact?: boolean }) {
  return <span className={`${chip} border border-line bg-sage text-muted`}>{compact ? 'Sample' : 'Sample Investigation'}</span>
}

export function EmptyState({ icon = 'inbox', title, desc, action }: { icon?: string; title: string; desc: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-mint text-mint-fg"><Icon name={icon} size={20} /></span>
      <h3 className="text-[15px] font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{desc}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Notice({ tone = 'info', title, children, action }: { tone?: 'info' | 'error' | 'warn'; title: string; children?: ReactNode; action?: ReactNode }) {
  const t = { info: 'border-sky/40 bg-sky-bg', error: 'border-crit/40 bg-crit-bg', warn: 'border-warn/40 bg-warn-bg' }[tone]
  const ic = { info: 'info', error: 'alert', warn: 'alert' }[tone]
  const col = { info: 'text-info', error: 'text-crit-fg', warn: 'text-warn-fg' }[tone]
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex flex-wrap items-start gap-3 rounded-xl border px-4 py-3 ${t}`}>
      <Icon name={ic} className={`mt-0.5 ${col}`} />
      <div className="min-w-0 flex-1 text-sm">
        <p className={`font-semibold ${tone === 'info' ? 'text-heading' : col}`}>{title}</p>
        {children && <div className="mt-0.5 text-muted">{children}</div>}
      </div>
      {action}
    </div>
  )
}

export const inputCls =
  'w-full rounded-md border border-line bg-card px-3 py-2 text-sm text-fg placeholder:text-muted/80 transition-colors hover:border-emerald focus:border-primary disabled:opacity-50'

export function Field({ label, hint, error, htmlFor, children }: { label: string; hint?: string; error?: string; htmlFor: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium text-fg">{label}</label>
      {children}
      {error ? <p className="mt-1 text-xs text-crit-fg" role="alert">{error}</p> : hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  )
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>('input,textarea,select,button')?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      prev?.focus()
    }
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-lg rounded-xl border border-line bg-elevated shadow-pop">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close dialog" className="rounded-md p-1 text-muted hover:bg-sage hover:text-fg"><Icon name="x" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function Pagination({ page, pages, total, perPage, onPage }: { page: number; pages: number; total: number; perPage: number; onPage: (p: number) => void }) {
  if (total === 0) return null
  const from = (page - 1) * perPage + 1
  const to = Math.min(total, page * perPage)
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 text-[13px] text-muted">
      <span className="tabular">Showing {from}–{to} of {total}</span>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><Icon name="left" size={14} /></Button>
        <span className="tabular px-2">Page {page} of {pages}</span>
        <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page"><Icon name="right" size={14} /></Button>
      </div>
    </div>
  )
}

export function Popover({ trigger, children, align = 'right', label, className = '' }: { trigger: (p: { open: boolean; toggle: () => void }) => ReactNode; children: (close: () => void) => ReactNode; align?: 'left' | 'right'; label: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousedown', down)
      document.removeEventListener('keydown', key)
    }
  }, [open])
  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div role="dialog" aria-label={label} className={`absolute top-full z-40 mt-2 rounded-xl border border-line bg-elevated shadow-pop ${align === 'right' ? 'right-0' : 'left-0'} ${className}`}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

export function MenuItem({ icon, children, onClick, href, danger }: { icon?: string; children: ReactNode; onClick?: () => void; href?: string; danger?: boolean }) {
  const cls = `flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm hover:bg-sage ${danger ? 'text-crit-fg' : 'text-fg'}`
  const inner = <>{icon && <Icon name={icon} size={16} />}{children}</>
  return href ? <a href={href} onClick={onClick} className={cls}>{inner}</a> : <button onClick={onClick} className={cls}>{inner}</button>
}

export function ConfirmDialog({ title, body, confirmLabel, danger, loading, onConfirm, onClose }: { title: string; body: ReactNode; confirmLabel: string; danger?: boolean; loading?: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="text-sm text-muted">{body}</div>
      <div className="mt-5 flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm} className={danger ? 'border-crit/50' : ''}>{confirmLabel}</Button>
      </div>
    </Modal>
  )
}

export function ToastHost() {
  const toasts = useToasts()
  const tone = {
    success: ['border-success/40', 'check', 'text-success-fg'],
    error: ['border-crit/40', 'alert', 'text-crit-fg'],
    info: ['border-sky/50', 'info', 'text-info'],
  }
  return (
    <div className="print:hidden pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} role={t.tone === 'error' ? 'alert' : 'status'} className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border bg-elevated px-4 py-3 text-sm shadow-pop ${tone[t.tone][0]}`}>
          <Icon name={tone[t.tone][1]} className={`mt-0.5 ${tone[t.tone][2]}`} />
          <p className="flex-1">{t.message}</p>
          <button onClick={() => dismissToast(t.id)} aria-label="Dismiss notification" className="text-muted hover:text-fg"><Icon name="x" size={16} /></button>
        </div>
      ))}
    </div>
  )
}

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Progress">
      {steps.map((label, i) => {
        const state = i < current ? 'done' : i === current ? 'active' : 'todo'
        return (
          <li key={label} className="flex min-w-0 flex-1 items-center gap-2" aria-current={state === 'active' ? 'step' : undefined}>
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${state === 'done' ? 'bg-primary text-primary-fg' : state === 'active' ? 'bg-mint text-mint-fg ring-2 ring-primary' : 'border border-line bg-card text-muted'}`}>
              {state === 'done' ? <Icon name="check" size={14} /> : i + 1}
            </span>
            <span className={`truncate text-sm ${state === 'todo' ? 'text-muted' : 'font-medium text-heading'}`}>{label}</span>
            {i < steps.length - 1 && <span className={`mx-1 h-px flex-1 ${i < current ? 'bg-primary' : 'bg-line'}`} />}
          </li>
        )
      })}
    </ol>
  )
}

const RET: Record<string, { label: string; cls: string }> = {
  not_configured: { label: 'Not configured', cls: 'border border-line bg-card text-muted' },
  queued: { label: 'Queued', cls: 'bg-sky-bg text-info' },
  retrieving: { label: 'Retrieving', cls: 'bg-sky-bg text-info' },
  completed: { label: 'Completed', cls: 'bg-success-bg text-success-fg' },
  failed: { label: 'Failed', cls: 'bg-crit-bg text-crit-fg' },
}
export function RetrievalBadge({ status }: { status?: string }) {
  if (!status) return <span className="text-xs text-muted">—</span>
  const r = RET[status]
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${r.cls}`}>{status === 'retrieving' && <Spinner size={10} />}{r.label}</span>
}
