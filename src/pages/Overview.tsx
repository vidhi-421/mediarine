import { useMemo, useState } from 'react'
import { Button, Card, CardHeader, EmptyState, Icon, Notice, PageHeader, SampleChip, StatusChip } from '../components/ui'
import { dashboardStats, evidenceStatus, fmtDate, fmtMoney, removeSamples, useInvestigations, useSettings } from '../lib/store'
import { getConfig, getStatus } from '../lib/tinyfish'

const WEEK = 7 * 86400000

function Stat({ label, value, note, icon }: { label: string; value: number | string; note: string; icon: string; tone: string }) {
  return (
    <div className="rounded-xl border border-line bg-card p-4 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        <Icon name={icon} size={16} className="text-muted" />
      </div>
      <p className="tabular mt-2 text-2xl font-semibold tracking-tight text-heading">{value}</p>
      <p className="mt-0.5 text-xs text-muted">{note}</p>
    </div>
  )
}

function WeeklyChart({ counts, labels }: { counts: number[]; labels: string[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...counts)
  const h = 148
  return (
    <div>
      <div className="relative flex items-end gap-2 sm:gap-3" style={{ height: h }} role="img" aria-label={`Investigations opened per week: ${counts.map((c, i) => `${labels[i]} ${c}`).join(', ')}`}>
        {[0.5, 1].map((f) => (
          <div key={f} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line" style={{ bottom: f * (h - 24) }} />
        ))}
        {counts.map((c, i) => (
          <div key={i} className="relative z-10 flex h-full flex-1 flex-col items-center justify-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            {hover === i && <span className="tabular absolute top-0 z-20 whitespace-nowrap rounded-md border border-line bg-elevated px-2 py-1 text-xs shadow-pop">{c} opened · week of {labels[i]}</span>}
            <div className="w-full max-w-9 rounded-t-md transition-colors" style={{ background: hover === i ? 'var(--info)' : 'var(--sky)', height: Math.max(c ? 4 : 2, (c / max) * (h - 24)), opacity: c ? 1 : 0.3 }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2 sm:gap-3">{labels.map((l, i) => <span key={i} className="flex-1 text-center text-[11px] text-muted">{l}</span>)}</div>
    </div>
  )
}

export default function Overview({ name }: { name: string }) {
  const all = useInvestigations()
  const settings = useSettings()
  const tf = getStatus(getConfig(settings), settings.lastRetrievalError)
  const list = useMemo(() => all.filter((i) => !i.archived), [all])
  const d = useMemo(() => dashboardStats(list), [list])
  const hasSamples = all.some((i) => i.sample)
  const first = name.split(/\s+/)[0]

  const s = useMemo(() => {
    const now = Date.now()
    const counts = Array(8).fill(0)
    list.forEach((i) => {
      const w = Math.floor((now - new Date(i.createdAt).getTime()) / WEEK)
      if (w >= 0 && w < 8) counts[7 - w]++
    })
    const labels = counts.map((_, k) => new Date(now - (7 - k) * WEEK).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
    const attention = list.flatMap((i) => i.evidence).filter((e) => e.classification === 'conflicting' || e.retrieval === 'failed').length
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

  const recent = list.slice().sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 6)
  const savedReports = all.flatMap((inv) => (inv.savedReports ?? []).map((r) => ({ inv, r }))).sort((a, b) => b.r.generatedAt.localeCompare(a.r.generatedAt)).slice(0, 5)
  const needs = list.filter((i) => i.status === 'review' || i.status === 'failed').slice(0, 4)

  return (
    <>
      <PageHeader
        title={`Welcome back${first && first !== 'Sample' ? `, ${first}` : ''}`}
        desc="Claims awaiting review, recent investigation activity, and evidence that needs attention."
        action={<a href="#/new"><Button variant="primary"><Icon name="plus" size={16} />New Investigation</Button></a>}
      />

      {hasSamples && (
        <div className="mb-6">
          <Notice title="Sample investigations are included" action={<Button size="sm" onClick={removeSamples}>Remove samples</Button>}>
            Records labelled “Sample” contain illustrative content. Figures below include them and do not represent live results.
          </Notice>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Open Investigations" value={d.open} note={`${d.total} total · avg ${d.avgDaysOpen.toFixed(1)} days open`} icon="search" tone="bg-sage text-mint-fg" />
        <Stat label="Flagged for Review" value={d.flagged} note="Review required or retrieval failed" icon="alert" tone="bg-warn-bg text-warn-fg" />
        <Stat label="Closed Reviews" value={d.closed} note="Completed by a reviewer" icon="check" tone="bg-success-bg text-success-fg" />
        <Stat label="Billed Under Review" value={fmtMoney(d.billedUnderReview)} note={`${s.attention} evidence items need attention`} icon="activity" tone="bg-sky-bg text-info" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Investigation activity" desc="Status of active investigations and weekly volume, last 8 weeks" />
            {s.total > 0 && (
              <div className="border-b border-line px-5 py-4">
            <div className="flex h-2 overflow-hidden rounded-full bg-sage" role="img" aria-label={`Pending ${s.pending}, review required ${s.review}, failed ${s.failed}, completed ${s.done}`}>
              {[[s.pending, 'var(--sky)'], [s.review, 'var(--warn)'], [s.failed, 'var(--crit)'], [s.done, 'var(--primary)']].map(([n, c], k) => (
                <div key={k} style={{ width: `${((n as number) / s.total) * 100}%`, background: c as string }} />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
              {[['Pending', s.pending, 'var(--sky)'], ['Review required', s.review, 'var(--warn)'], ['Retrieval failed', s.failed, 'var(--crit)'], ['Completed', s.done, 'var(--primary)']].map(([l, n, c]) => (
                <span key={l as string} className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: c as string }} />{l} <span className="tabular font-medium text-fg">{n}</span></span>
              ))}
            </div>
              </div>
            )}
            <div className="p-5">{s.total === 0 ? <EmptyState title="No Investigations Found" desc="Opened investigations will appear here as a weekly trend." /> : <WeeklyChart counts={s.counts} labels={s.labels} />}</div>
          </Card>

          <Card>
            <CardHeader title="Recent investigations" action={<a href="#/investigations" className="text-[13px] font-medium text-info hover:underline">View all</a>} />
            {recent.length === 0 ? (
              <EmptyState title="No Investigations Found" desc="Start a new investigation to record a claim and its evidence." action={<a href="#/new"><Button variant="primary">New Investigation</Button></a>} />
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-line bg-sage text-xs text-muted">
                  <tr>
                    <th scope="col" className="px-5 py-2.5 text-left font-medium">Reference</th>
                    <th scope="col" className="px-5 py-2.5 text-left font-medium">Claim</th>
                    <th scope="col" className="hidden px-5 py-2.5 text-left font-medium md:table-cell">Evidence</th>
                    <th scope="col" className="px-5 py-2.5 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {recent.map((i) => (
                    <tr key={i.id} className="hover:bg-sage">
                      <td className="tabular whitespace-nowrap px-5 py-3 align-top font-medium"><a href={`#/investigations/${i.id}`} className="text-primary hover:underline">{i.ref}</a></td>
                      <td className="px-5 py-3 align-top">
                        <p className="line-clamp-1">{i.claim}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">{i.category} · {fmtDate(i.createdAt)} {i.sample && <SampleChip compact />}</p>
                      </td>
                      <td className="hidden whitespace-nowrap px-5 py-3 align-top text-muted md:table-cell">{evidenceStatus(i)}</td>
                      <td className="px-5 py-3 align-top"><StatusChip status={i.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-emerald">
            <CardHeader title="TinyFish live-web investigation" desc="Retrieval service status for this workspace" />
            <div className="space-y-3 p-5 text-sm">
              <div className="flex items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${tf === 'ready' ? 'bg-success-bg text-success-fg' : tf === 'error' ? 'bg-crit-bg text-crit-fg' : 'bg-warn-bg text-warn-fg'}`}>{tf === 'ready' ? 'Endpoint Configured' : tf === 'error' ? 'Retrieval Failed' : 'Awaiting Configuration'}</span>
              </div>
              <p className="text-muted">{tf === 'not_configured' ? 'No retrieval endpoint configured. Evidence can still be added manually.' : tf === 'error' ? settings.lastRetrievalError : 'New investigations can send claims to your TinyFish endpoint.'}</p>
              <p className="tabular text-xs text-muted">Last retrieval: {settings.lastRetrievalAt ? new Date(settings.lastRetrievalAt).toLocaleString('en-US') : 'never'}</p>
              <a href="#/settings" className="inline-flex items-center gap-1 font-medium text-info hover:underline">Configure in Settings <Icon name="right" size={14} /></a>
            </div>
          </Card>
          <Card>
            <CardHeader title="Quick actions" />
            <div className="grid gap-1 p-2">
              {[['/new', 'plus', 'Start a new investigation'], ['/new?sample=1', 'file', 'Load sample claim'], ['/investigations', 'history', 'Search investigation history'], ['/sources', 'sources', 'Review evidence sources'], ['/help', 'book', 'Review terminology and workflow']].map(([to, icon, label]) => (
                <a key={to} href={`#${to}`} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-sage"><Icon name={icon} size={16} className="text-muted" />{label}</a>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Saved reports" desc="Reopen reports saved to investigation history" />
            {savedReports.length === 0 ? (
              <p className="p-5 text-sm text-muted">No reports saved yet. Open an investigation report and choose Save to history, Print Report, or Export PDF.</p>
            ) : (
              <ul className="divide-y divide-line">
                {savedReports.map(({ inv, r }) => (
                  <li key={r.id}>
                    <a href={`#/investigations/${inv.id}/report?snapshot=${r.id}`} className="flex items-start gap-3 px-5 py-3 hover:bg-sage">
                      <Icon name="file" size={16} className="mt-0.5 text-primary" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2"><span className="tabular text-[13px] font-medium">{inv.ref}</span><span className="tabular text-xs text-muted">{fmtDate(r.generatedAt)}</span></span>
                        <span className="block truncate text-xs text-muted">{r.outcome}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Needs attention" />
            {needs.length === 0 ? (
              <p className="p-5 text-sm text-muted">No investigations currently require review.</p>
            ) : (
              <ul className="divide-y divide-line">
                {needs.map((i) => (
                  <li key={i.id}>
                    <a href={`#/investigations/${i.id}`} className="block px-5 py-3 hover:bg-sage">
                      <span className="flex items-center justify-between gap-2"><span className="tabular text-[13px] font-medium">{i.ref}</span><StatusChip status={i.status} /></span>
                      <span className="mt-1 line-clamp-2 block text-xs text-muted">{i.claim}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Card>

        </div>
      </div>
    </>
  )
}
