import { useMemo, useState } from 'react'
import { Button, Card, CardHeader, EmptyState, Icon, Notice, PageHeader, SampleChip, StatusChip } from '../components/ui'
import { dashboardStats, evidenceStatus, fmtDate, fmtMoney, removeSamples, useInvestigations, useSettings, useBackendStatus, useTinyFishStatus } from '../lib/store'
import { getConfig, getStatus } from '../lib/tinyfish'

const WEEK = 7 * 86400000

function Stat({
  label,
  value,
  note,
  icon,
  tone,
  accentColor,
}: {
  label: string
  value: number | string
  note: string
  icon: string
  tone: string
  accentColor?: string
}) {
  return (
    <div className="group relative rounded-xl border border-line bg-card p-5 shadow-card hover:shadow-pop hover:border-emerald-500/40 transition-all duration-200">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-muted tracking-tight">{label}</p>
        <span className={`grid h-9 w-9 place-items-center rounded-lg transition-transform group-hover:scale-105 ${tone}`}>
          <Icon name={icon} size={18} />
        </span>
      </div>
      <p className="tabular mt-3 text-3xl font-bold tracking-tight text-heading">{value}</p>
      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted">
        {accentColor && <span className={`h-1.5 w-1.5 rounded-full ${accentColor}`} />}
        <span>{note}</span>
      </div>
    </div>
  )
}

function WeeklyChart({ counts, labels }: { counts: number[]; labels: string[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...counts)
  const h = 150

  return (
    <div>
      <div className="relative flex items-end gap-2 sm:gap-3" style={{ height: h }} role="img" aria-label={`Investigations opened per week: ${counts.map((c, i) => `${labels[i]} ${c}`).join(', ')}`}>
        {[0.5, 1].map((f) => (
          <div key={f} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line" style={{ bottom: f * (h - 24) }} />
        ))}
        {counts.map((c, i) => (
          <div key={i} className="relative z-10 flex h-full flex-1 flex-col items-center justify-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            {hover === i && (
              <span className="tabular absolute top-0 z-20 whitespace-nowrap rounded-lg border border-line bg-elevated px-2.5 py-1 text-xs font-semibold shadow-pop text-heading">
                {c} cases · week of {labels[i]}
              </span>
            )}
            <div
              className="w-full max-w-10 rounded-t-lg transition-all duration-300"
              style={{
                background: hover === i ? 'var(--primary)' : c > 0 ? 'var(--emerald)' : 'var(--mint)',
                height: Math.max(c ? 6 : 2, (c / max) * (h - 28)),
                opacity: c ? 1 : 0.4,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2 sm:gap-3 border-t border-line/60 pt-2">
        {labels.map((l, i) => (
          <span key={i} className="flex-1 text-center text-[11px] font-medium text-muted truncate">
            {l}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function Overview({ name }: { name: string }) {
  const all = useInvestigations()
  const settings = useSettings()
  const backend = useBackendStatus()
  const tfStatus = useTinyFishStatus()
  const tf = getStatus(getConfig(settings), settings.lastRetrievalError)
  const list = useMemo(() => all.filter((i) => !i.archived), [all])
  const d = useMemo(() => dashboardStats(list), [list])
  const hasSamples = all.some((i) => i.sample)
  const first = name.split(/\s+/)[0]

  const s = useMemo(() => {
    const now = Date.now()
    const counts = Array(8).fill(0)
    list.forEach((i) => {
      const t = i.createdAt ? new Date(i.createdAt).getTime() : NaN
      if (Number.isFinite(t)) {
        const w = Math.floor((now - t) / WEEK)
        if (w >= 0 && w < 8) counts[7 - w]++
      }
    })
    const labels = counts.map((_, k) => new Date(now - (7 - k) * WEEK).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
    const attention = list.flatMap((i) => i.evidence ?? []).filter((e) => e?.classification === 'conflicting' || e?.retrieval === 'failed').length
    return {
      total: list.length,
      pending: list.filter((i) => i.status === 'pending').length,
      review: list.filter((i) => i.status === 'review').length,
      done: list.filter((i) => i.status === 'completed').length,
      failed: list.filter((i) => i.status === 'failed').length,
      attention,
      counts,
      labels,
    }
  }, [list])

  const recent = list.slice().sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 7)
  const savedReports = all.flatMap((inv) => (inv.savedReports ?? []).map((r) => ({ inv, r }))).sort((a, b) => b.r.generatedAt.localeCompare(a.r.generatedAt)).slice(0, 5)
  const needs = list.filter((i) => i.status === 'review' || i.status === 'failed').slice(0, 4)

  return (
    <>
      <PageHeader
        title={`Welcome back${first && first !== 'Sample' ? `, ${first}` : ''}`}
        desc="Claims awaiting review, real-time TinyFish evidence retrieval, and clinical compliance auditing."
        action={
          <div className="flex items-center gap-2">
            <a href="#/investigations">
              <Button variant="secondary" size="md">
                <Icon name="history" size={16} /> History
              </Button>
            </a>
            <a href="#/new">
              <Button variant="primary" size="md">
                <Icon name="plus" size={16} /> New Investigation
              </Button>
            </a>
          </div>
        }
      />

      {hasSamples && (
        <div className="mb-6">
          <Notice title="Sample investigations are included" action={<Button size="sm" onClick={removeSamples}>Remove samples</Button>}>
            Records labelled “Sample” contain illustrative benchmark cases. Real-time investigations created through New Investigation connect directly to live services.
          </Notice>
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Open Investigations"
          value={d.open}
          note={`${d.total} total cases · avg ${d.avgDaysOpen.toFixed(1)} days active`}
          icon="search"
          tone="bg-sage text-primary"
          accentColor="bg-emerald-500"
        />
        <Stat
          label="Flagged for Review"
          value={d.flagged}
          note="Discrepancies found or retrieval failed"
          icon="alert"
          tone="bg-warn-bg text-warn-fg"
          accentColor="bg-amber-500"
        />
        <Stat
          label="Closed Audits"
          value={d.closed}
          note="Determination completed by reviewer"
          icon="check"
          tone="bg-success-bg text-success-fg"
          accentColor="bg-emerald-600"
        />
        <Stat
          label="Billed Under Review"
          value={fmtMoney(d.billedUnderReview)}
          note={`${s.attention} clinical sources need verification`}
          icon="activity"
          tone="bg-sky-bg text-info"
          accentColor="bg-sky-500"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Main Left Column (2 Cols) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Investigation Activity Card */}
          <Card>
            <CardHeader
              title="Investigation Activity & Volume"
              desc="Status breakdown of claims under audit and weekly intake trend over last 8 weeks"
            />
            {s.total > 0 && (
              <div className="border-b border-line px-5 py-4">
                <div className="flex h-2.5 overflow-hidden rounded-full bg-sage" role="img" aria-label={`Pending ${s.pending}, review required ${s.review}, failed ${s.failed}, completed ${s.done}`}>
                  {[[s.pending, 'var(--sky)'], [s.review, 'var(--warn)'], [s.failed, 'var(--crit)'], [s.done, 'var(--primary)']].map(([n, c], k) => (
                    <div key={k} style={{ width: `${((n as number) / s.total) * 100}%`, background: c as string }} className="transition-all duration-300" />
                  ))}
                </div>
                <div className="mt-3.5 flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-muted">
                  {[
                    ['Pending Review', s.pending, 'var(--sky)'],
                    ['Review Required', s.review, 'var(--warn)'],
                    ['Retrieval Failed', s.failed, 'var(--crit)'],
                    ['Review Completed', s.done, 'var(--primary)'],
                  ].map(([l, n, c]) => (
                    <span key={l as string} className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: c as string }} />
                      <span>{l}:</span> <span className="tabular font-semibold text-heading">{n}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="p-5">
              {s.total === 0 ? (
                <EmptyState title="No Investigations Found" desc="Opened investigations will appear here as a weekly trend." />
              ) : (
                <WeeklyChart counts={s.counts} labels={s.labels} />
              )}
            </div>
          </Card>

          {/* Recent Investigations Table */}
          <Card>
            <CardHeader
              title="Recent Clinical Investigations"
              desc="Latest claims submitted for live policy checking and compliance auditing"
              action={
                <a href="#/investigations" className="inline-flex items-center gap-1 text-[13px] font-semibold text-info hover:underline">
                  View full history <Icon name="right" size={14} />
                </a>
              }
            />
            {recent.length === 0 ? (
              <EmptyState
                title="No Investigations Found"
                desc="Start a new investigation to record a claim and retrieve live evidence."
                action={<a href="#/new"><Button variant="primary"><Icon name="plus" size={16} /> New Investigation</Button></a>}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-line bg-sage/60 text-xs font-semibold uppercase tracking-wider text-muted">
                    <tr>
                      <th scope="col" className="px-5 py-3 text-left">Case Ref</th>
                      <th scope="col" className="px-5 py-3 text-left">Claim Description</th>
                      <th scope="col" className="hidden px-5 py-3 text-left sm:table-cell">Evidence Status</th>
                      <th scope="col" className="px-5 py-3 text-left">Review Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {recent.map((i) => (
                      <tr key={i.id} className="group hover:bg-sage/50 transition-colors">
                        <td className="tabular whitespace-nowrap px-5 py-3.5 align-top font-semibold">
                          <a href={`#/investigations/${i.id}`} className="text-primary group-hover:underline flex items-center gap-1.5">
                            <span>{i.ref}</span>
                            <Icon name="right" size={13} className="opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                          </a>
                        </td>
                        <td className="px-5 py-3.5 align-top">
                          <p className="line-clamp-1 font-medium text-heading">{i.claim}</p>
                          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                            <span className="font-medium text-fg">{i.category}</span>
                            <span>•</span>
                            <span className="tabular">{fmtDate(i.createdAt)}</span>
                            {i.billedAmount != null && (
                              <>
                                <span>•</span>
                                <span className="tabular font-medium text-heading">{fmtMoney(i.billedAmount)}</span>
                              </>
                            )}
                            {i.sample && <SampleChip compact />}
                          </p>
                        </td>
                        <td className="hidden whitespace-nowrap px-5 py-3.5 align-top text-xs text-muted sm:table-cell">
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-sage px-2 py-1 text-xs font-medium text-fg">
                            <Icon name="sources" size={13} className="text-muted" />
                            {evidenceStatus(i)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 align-top whitespace-nowrap">
                          <StatusChip status={i.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Right Sidebar Column (1 Col) */}
        <div className="space-y-6">
          {/* Multi-Service Integration Card */}
          <Card className="border-emerald-300 dark:border-emerald-800 shadow-sm">
            <CardHeader
              title="System Integrations"
              desc="Real-time status of backend services & live web automation"
            />
            <div className="space-y-3.5 p-5 text-sm">
              {/* Backend & DB */}
              <div className="flex items-center justify-between rounded-lg border border-line bg-sage/40 p-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-7 w-7 place-items-center rounded-md bg-card shadow-xs">
                    <Icon name="activity" size={15} className="text-primary" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-heading">FastAPI & Supabase</p>
                    <p className="text-[11px] text-muted">Database & API Server</p>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  backend.connected ? 'bg-success-bg text-success-fg' : 'bg-warn-bg text-warn-fg'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${backend.connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  {backend.connected ? 'Connected' : 'Offline'}
                </span>
              </div>

              {/* TinyFish */}
              <div className="flex items-center justify-between rounded-lg border border-line bg-sage/40 p-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-7 w-7 place-items-center rounded-md bg-card shadow-xs">
                    <Icon name="link" size={15} className="text-purple-600 dark:text-purple-400" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-heading">TinyFish Live Web</p>
                    <p className="text-[11px] text-muted">Browser Policy Crawler</p>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  tfStatus.status === 'connected' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300' : 'bg-slate-100 text-slate-700'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${tfStatus.status === 'connected' ? 'bg-purple-500 animate-pulse' : 'bg-slate-400'}`} />
                  {tfStatus.status === 'connected' ? 'Ready' : 'Checking'}
                </span>
              </div>

              {/* Gemini */}
              <div className="flex items-center justify-between rounded-lg border border-line bg-sage/40 p-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-7 w-7 place-items-center rounded-md bg-card shadow-xs">
                    <Icon name="sparkles" size={15} className="text-amber-600 dark:text-amber-400" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-heading">Gemini AI Synthesis</p>
                    <p className="text-[11px] text-muted">Clinical Reasoning & Rules</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-2.5 py-0.5 text-xs font-semibold">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Configured
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-line pt-3 text-xs text-muted">
                <span className="tabular font-medium">
                  Last retrieval: {settings.lastRetrievalAt ? new Date(settings.lastRetrievalAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'None yet'}
                </span>
                <a href="#/settings" className="inline-flex items-center gap-1 font-semibold text-info hover:underline">
                  Diagnostics <Icon name="right" size={12} />
                </a>
              </div>
            </div>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader title="Quick Actions" />
            <div className="grid gap-1.5 p-3">
              {[
                ['/new', 'plus', 'Start a New Investigation', 'Submit a claim for automated review'],
                ['/new?sample=1', 'file', 'Load Sample CMS Claim', 'CPT 99214 Level 4 telemedicine review'],
                ['/investigations', 'history', 'Search Claim History', 'Filter by code, status, or date'],
                ['/sources', 'sources', 'Evidence Management', 'Inspect all retrieved policy sources'],
                ['/settings', 'settings', 'Settings & Diagnostics', 'Test TinyFish crawler connection'],
              ].map(([to, icon, label, sub]) => (
                <a
                  key={to}
                  href={`#${to}`}
                  className="group flex items-start gap-3 rounded-lg p-2.5 hover:bg-sage transition-colors"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-md bg-sage text-primary group-hover:bg-card shadow-xs transition-colors">
                    <Icon name={icon} size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-heading group-hover:text-primary transition-colors">{label}</p>
                    <p className="text-xs text-muted truncate">{sub}</p>
                  </div>
                  <Icon name="right" size={14} className="mt-1 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              ))}
            </div>
          </Card>

          {/* Saved Reports Card */}
          <Card>
            <CardHeader
              title="Saved Reports"
              desc="Recently saved formal audit reports"
            />
            {savedReports.length === 0 ? (
              <div className="p-5 text-center text-xs text-muted">
                <p>No reports saved yet.</p>
                <p className="mt-1">Complete an investigation and click &quot;Save Report&quot; to archive a snapshot.</p>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {savedReports.map(({ inv, r }) => (
                  <li key={r.id}>
                    <a href={`#/investigations/${inv.id}/report?snapshot=${r.id}`} className="group flex items-start gap-3 px-5 py-3 hover:bg-sage transition-colors">
                      <span className="grid h-7 w-7 place-items-center rounded-md bg-sage text-primary mt-0.5">
                        <Icon name="file" size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="tabular text-xs font-bold text-heading group-hover:text-primary">{inv.ref}</span>
                          <span className="tabular text-[11px] text-muted">{fmtDate(r.generatedAt)}</span>
                        </span>
                        <span className="block truncate text-xs text-muted mt-0.5">{r.outcome}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Needs Attention */}
          {needs.length > 0 && (
            <Card className="border-warn-300 dark:border-warn-800">
              <CardHeader title="Needs Attention" desc="Investigations with discrepancies or failed retrieval" />
              <ul className="divide-y divide-line">
                {needs.map((i) => (
                  <li key={i.id}>
                    <a href={`#/investigations/${i.id}`} className="block px-5 py-3 hover:bg-sage transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <span className="tabular text-xs font-bold text-heading">{i.ref}</span>
                        <StatusChip status={i.status} />
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-xs text-muted leading-relaxed">{i.claim}</p>
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
