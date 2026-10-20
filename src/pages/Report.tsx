import { useEffect, useState, type ReactNode } from 'react'
import Workflow from '../components/Workflow'
import { Button, Card, CLASS, ClassChip, EmptyState, Icon, Logo, RetrievalBadge } from '../components/ui'
import { evidenceStatus, fmtDate, fmtMoney, saveReport, useInvestigations, useSettings, type Investigation } from '../lib/store'
import { exportReportPdf, findings, reviewLabel, tinyfishSection, verificationQuestions, workflow, type Finding } from '../lib/report'
import { navigate, useQuery } from '../lib/router'
import { toast } from '../lib/toast'

function Section({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <section className="break-inside-avoid-page">
      <div className="mb-3 border-b border-line pb-1.5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-primary">{title}</h2>
        {desc && <p className="mt-0.5 text-xs text-muted">{desc}</p>}
      </div>
      {children}
    </section>
  )
}

function FindingGroup({ title, tone, items, empty }: { title: string; tone: string; items: Finding[]; empty: string }) {
  return (
    <div className="break-inside-avoid rounded-lg border border-line">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <span className={`h-2 w-2 rounded-full ${tone}`} />
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="tabular ml-auto text-xs text-muted">{items.length}</span>
      </div>
      {items.length ? (
        <ul className="divide-y divide-line">
          {items.map((f, k) => (
            <li key={k} className="px-4 py-3 text-sm">
              <p className="font-medium">{f.title}</p>
              <p className="mt-1 text-muted">{f.detail}</p>
              {f.evidence && <a href={f.evidence.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block break-all text-xs text-info hover:underline">{f.evidence.url}</a>}
            </li>
          ))}
        </ul>
      ) : <p className="px-4 py-3 text-sm text-muted">{empty}</p>}
    </div>
  )
}

export function ReportDocument({ inv, reviewer, generatedAt, saved }: { inv: Investigation; reviewer: string; generatedAt: string; saved: boolean }) {
  const tf = tinyfishSection(inv)
  const fs = findings(inv)
  const other = inv.evidence.filter((e) => e.provider !== 'tinyfish')
  const th = 'px-3 py-2 text-left font-medium'
  const td = 'px-3 py-2 align-top'
  return (
    <article className="report mx-auto max-w-[880px] space-y-8 rounded-xl border border-line bg-card p-8 shadow-card sm:p-12 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-primary pb-5">
        <div className="flex items-center gap-3">
          <Logo size={36} />
          <div><p className="text-xl font-semibold tracking-tight text-heading">Medarina</p><p className="text-xs text-muted">Claim Investigation Report</p></div>
        </div>
        <dl className="tabular text-right text-xs text-muted">
          <div><dt className="inline">Case </dt><dd className="inline font-semibold text-fg">{inv.ref}</dd></div>
          <div><dt className="inline">Generated </dt><dd className="inline">{new Date(generatedAt).toLocaleString('en-US')}</dd></div>
        </dl>
      </header>
      {inv.sample && <p className="rounded-md bg-sky-bg px-3 py-2 text-xs text-info">Sample investigation: contains illustrative example data, not live results.</p>}

      <Section title="Investigation workflow"><Workflow stages={workflow(inv, saved)} compact /></Section>

      <Section title="Claim summary">
        <p className="text-[15px] font-medium text-heading">{inv.claim}</p>
        <dl className="tabular mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
          {[['Category', inv.category], ['Provider', inv.provider ?? '—'], ['Service dates', inv.serviceDateFrom ? `${fmtDate(inv.serviceDateFrom)}${inv.serviceDateTo && inv.serviceDateTo !== inv.serviceDateFrom ? ` – ${fmtDate(inv.serviceDateTo)}` : ''}` : '—'], ['Billed amount', fmtMoney(inv.billedAmount)], ['Billing date', fmtDate(inv.billingDate)], ['Opened', fmtDate(inv.createdAt)], ['Evidence', evidenceStatus(inv)], ['Retrieval', tf.label]].map(([k, v]) => (
            <div key={k}><dt className="text-xs text-muted">{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
        {inv.details && <p className="mt-4 text-sm text-muted">{inv.details}</p>}
      </Section>

      {!!inv.billingCodes?.length && (
        <Section title="Billing codes">
          <table className="w-full border border-line text-sm"><thead className="bg-sage text-xs text-muted"><tr><th className={th}>Code</th><th className={th}>Type</th><th className={th}>Description</th></tr></thead>
            <tbody className="divide-y divide-line">{inv.billingCodes.map((c, k) => <tr key={k}><td className={`${td} tabular font-medium`}>{c.code}</td><td className={td}>{c.type}</td><td className={td}>{c.description || '—'}</td></tr>)}</tbody></table>
        </Section>
      )}

      {!!inv.clinicalTimeline?.length && (
        <Section title="Clinical timeline">
          <ol className="space-y-2 text-sm">{inv.clinicalTimeline.map((t, k) => <li key={k} className="flex gap-4"><span className="tabular w-28 shrink-0 text-muted">{fmtDate(t.date)}</span><span>{t.event}</span></li>)}</ol>
        </Section>
      )}

      <Section title="Verification questions" desc="Derived from the recorded claim fields.">
        <ol className="list-decimal space-y-1 pl-5 text-sm">{verificationQuestions(inv).map((q) => <li key={q}>{q}</li>)}</ol>
      </Section>

      <Section title="TinyFish live-web evidence" desc="Only sources returned by a TinyFish request appear here.">
        <div className="rounded-lg border border-line bg-sage/60 p-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="flex items-center gap-2"><span className="text-xs text-muted">Integration status</span><RetrievalBadge status={tf.status ?? 'not_configured'} /></span>
            <span className="tabular"><span className="text-xs text-muted">Retrieved </span>{tf.retrievedAt ? new Date(tf.retrievedAt).toLocaleString('en-US') : '—'}</span>
          </div>
          <p className={`mt-2 text-sm ${tf.sources.length ? '' : 'font-medium text-heading'}`}>{tf.message}</p>
        </div>
        {tf.sources.length > 0 && (
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
            {tf.sources.map((e) => (
              <li key={e.id} className="break-inside-avoid px-4 py-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium">{e.title}</p>
                  <ClassChip value={e.classification} />
                </div>
                <a href={e.url} target="_blank" rel="noopener noreferrer" className="break-all text-xs text-info hover:underline">{e.url}</a>
                <p className="mt-2">{e.summary || 'No summary returned.'}</p>
                <p className="mt-2 text-xs"><span className="text-muted">Helps verify: </span>{e.verifies ?? 'Not specified by the source response'}</p>
                <p className="tabular mt-0.5 text-xs text-muted">{e.publisher} · retrieved {e.retrievedAt ? new Date(e.retrievedAt).toLocaleString('en-US') : '—'}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {other.length > 0 && (
        <Section title="Other recorded evidence" desc="Not retrieved by TinyFish. Reviewer-provided or previously recorded sources.">
          <table className="w-full border border-line text-sm"><thead className="bg-sage text-xs text-muted"><tr><th className={th}>Source</th><th className={th}>Classification</th><th className={th}>Summary</th></tr></thead>
            <tbody className="divide-y divide-line">{other.map((e) => <tr key={e.id}><td className={td}><p className="font-medium">{e.title}</p><p className="break-all text-xs text-muted">{e.origin === 'user-provided' ? 'Reviewer-provided' : e.publisher} · {e.url}</p></td><td className={`${td} whitespace-nowrap`}>{CLASS[e.classification].label}</td><td className={td}>{e.summary || '—'}</td></tr>)}</tbody></table>
        </Section>
      )}

      <Section title="Findings" desc="Each finding cites the evidence behind it. No fraud determination or risk score is assigned.">
        <div className="grid gap-3 md:grid-cols-2 print:grid-cols-2">
          <FindingGroup title="Supported information" tone="bg-success" items={fs.supported} empty="No information is supported by recorded evidence." />
          <FindingGroup title="Conflicting information" tone="bg-crit" items={fs.conflicting} empty="No conflicting evidence recorded." />
          <FindingGroup title="Unverified details" tone="bg-warn" items={fs.unverified} empty="No unverified or inconclusive evidence recorded." />
          <FindingGroup title="Potential risk indicators" tone="bg-sky" items={fs.risks} empty="No risk indicators recorded." />
        </div>
        {inv.recommendation && <><p className="mt-5 text-sm font-semibold">Recommended next steps</p><p className="mt-1 whitespace-pre-line text-sm">{inv.recommendation}</p></>}
      </Section>

      <Section title="Review status and outcome" desc="Recorded separately by the reviewer.">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div className="rounded-lg border border-line p-3"><dt className="text-xs text-muted">Review status</dt><dd className="font-medium">{reviewLabel(inv)}</dd></div>
          <div className="rounded-lg border border-line p-3"><dt className="text-xs text-muted">Review outcome</dt><dd className="font-medium">{inv.outcome ?? 'Not determined'}</dd></div>
        </dl>
      </Section>

      <Section title="Reviewer notes">
        <p className="whitespace-pre-line text-sm">{[inv.reviewerNotes, inv.notes].filter(Boolean).join('\n\n') || <span className="text-muted">No notes recorded.</span>}</p>
      </Section>

      <footer className="grid grid-cols-2 gap-10 pt-10 text-xs text-muted break-inside-avoid">
        <div><div className="h-8 border-b border-fg/40" /><p className="mt-1.5">Reviewer signature · {reviewer}</p></div>
        <div><div className="h-8 border-b border-fg/40" /><p className="mt-1.5">Date</p></div>
        <p className="col-span-2 text-[11px]">This report summarizes evidence gathered for review. It is not a determination of fraud.</p>
      </footer>
    </article>
  )
}

export default function Report({ id }: { id: string }) {
  const live = useInvestigations().find((i) => i.id === id)
  const settings = useSettings()
  const query = useQuery()
  const snapId = query.get('snapshot')
  const autoPrint = query.get('print') === '1'
  const [busy, setBusy] = useState(false)
  const snap = snapId ? live?.savedReports?.find((r) => r.id === snapId) : undefined

  useEffect(() => {
    if (autoPrint && live) { const t = setTimeout(() => window.print(), 300); return () => clearTimeout(t) }
  }, [autoPrint, live])

  if (!live || (snapId && !snap)) return <Card><EmptyState title={live ? 'Saved report not found' : 'No Investigations Found'} desc={live ? 'This saved report is no longer in the investigation history.' : 'This investigation does not exist or has been deleted.'} action={<a href="#/investigations"><Button>Investigation History</Button></a>} /></Card>

  const inv = (snap?.snapshot as Investigation) ?? live
  const generatedAt = snap?.generatedAt ?? new Date().toISOString()
  const reviewer = settings.displayName || 'Reviewer'
  const saved = !!live.savedReports?.length

  const persist = (silent = false) => {
    if (snap) return
    const r = saveReport(live.id)
    if (r) { if (!silent) toast('success', `Report saved to ${live.ref} history.`) }
    else toast('error', 'The report could not be saved. Browser storage is unavailable or full.')
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <a href={`#/investigations/${live.id}`} className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-fg"><Icon name="left" size={14} />Back to {live.ref}</a>
        <div className="flex flex-wrap gap-2">
          {!snap && <Button onClick={() => persist()}><Icon name="archive" size={16} />Save to history</Button>}
          <Button onClick={() => { persist(true); window.print() }}><Icon name="printer" size={16} />Print Report</Button>
          <Button variant="primary" loading={busy} onClick={async () => {
            setBusy(true)
            try { persist(true); await exportReportPdf(inv, reviewer, generatedAt, true); toast('success', `Medarina-${inv.ref}.pdf downloaded.`) } catch { toast('error', 'The PDF could not be generated.') } finally { setBusy(false) }
          }}><Icon name="download" size={16} />Export PDF</Button>
        </div>
      </div>
      {snap && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-sky-bg px-4 py-3 text-sm text-info print:hidden">
          <span>Saved report from {new Date(snap.generatedAt).toLocaleString('en-US')}. The investigation may have changed since.</span>
          <button onClick={() => navigate(`/investigations/${live.id}/report`)} className="font-medium underline">View current report</button>
        </div>
      )}
      <ReportDocument inv={inv} reviewer={reviewer} generatedAt={generatedAt} saved={saved || !!snap} />
      {!!live.savedReports?.length && (
        <Card className="mx-auto mt-6 max-w-[880px] print:hidden">
          <div className="border-b border-line px-5 py-3"><h2 className="text-sm font-semibold">Saved reports for {live.ref}</h2></div>
          <ul className="divide-y divide-line text-sm">
            {live.savedReports.map((r) => (
              <li key={r.id}><a href={`#/investigations/${live.id}/report?snapshot=${r.id}`} className={`flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 hover:bg-sage ${r.id === snapId ? 'bg-sage' : ''}`}>
                <span className="tabular">{new Date(r.generatedAt).toLocaleString('en-US')}</span>
                <span className="text-xs text-muted">{r.outcome}</span>
              </a></li>
            ))}
          </ul>
        </Card>
      )}
    </>
  )
}
