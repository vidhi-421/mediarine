import { useEffect, useState, type ReactNode } from 'react'
import Workflow from '../components/Workflow'
import { Button, Card, CLASS, ClassChip, EmptyState, Icon, Logo, RetrievalBadge } from '../components/ui'
import { evidenceStatus, fmtDate, fmtMoney, saveReport, useInvestigations, useSettings, type Investigation } from '../lib/store'
import { exportReportPdf, findings, reviewLabel, tinyfishSection, verificationQuestions, workflow, type Finding } from '../lib/report'
import { navigate, useQuery } from '../lib/router'
import { toast } from '../lib/toast'

function Section({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <section className="break-inside-avoid-page space-y-2.5">
      <div className="border-b-2 border-line pb-1.5 flex items-baseline justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-primary">{title}</h2>
        {desc && <span className="text-[11px] text-muted">{desc}</span>}
      </div>
      {children}
    </section>
  )
}

function FindingGroup({ title, tone, items, empty }: { title: string; tone: string; items: Finding[]; empty: string }) {
  return (
    <div className="break-inside-avoid rounded-xl border border-line bg-card/60 shadow-xs">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5 bg-sage/30">
        <span className={`h-2.5 w-2.5 rounded-full ${tone}`} />
        <h3 className="text-sm font-bold text-heading">{title}</h3>
        <span className="tabular ml-auto rounded-full bg-sage px-2 py-0.5 text-xs font-semibold text-muted">
          {items.length}
        </span>
      </div>
      {items.length ? (
        <ul className="divide-y divide-line text-sm">
          {items.map((f, k) => (
            <li key={k} className="px-4 py-3 space-y-1">
              <p className="font-semibold text-heading">{f.title}</p>
              <p className="text-xs text-muted leading-relaxed">{f.detail}</p>
              {f.evidence && (
                <a
                  href={f.evidence.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 break-all text-xs font-medium text-info hover:underline"
                >
                  <Icon name="link" size={11} /> {f.evidence.url}
                </a>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-4 text-xs text-muted italic">{empty}</p>
      )}
    </div>
  )
}

export function ReportDocument({
  inv,
  reviewer,
  generatedAt,
  saved,
}: {
  inv: Investigation
  reviewer: string
  generatedAt: string
  saved: boolean
}) {
  const tf = tinyfishSection(inv)
  const fs = findings(inv)
  const other = (inv.evidence ?? []).filter((e) => e.provider !== 'tinyfish')
  const th = 'px-3.5 py-2.5 text-left font-bold text-xs uppercase tracking-wider'
  const td = 'px-3.5 py-2.5 align-top text-xs'

  return (
    <article className="report mx-auto max-w-[900px] space-y-8 rounded-2xl border border-line bg-card p-8 shadow-card sm:p-12 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
      {/* Official Audit Document Header */}
      <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-primary pb-6">
        <div className="flex items-center gap-3.5">
          <Logo size={40} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-heading">Medarina</h1>
              <span className="rounded bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-fg">
                Audit Record
              </span>
            </div>
            <p className="text-xs font-medium text-muted mt-0.5">Clinical Claims Investigation & Regulatory Evidence Report</p>
          </div>
        </div>
        <dl className="tabular text-right text-xs space-y-0.5">
          <div>
            <dt className="inline text-muted">Case Reference: </dt>
            <dd className="inline font-bold text-heading text-sm">{inv.ref}</dd>
          </div>
          <div>
            <dt className="inline text-muted">Generated: </dt>
            <dd className="inline text-fg font-medium">{new Date(generatedAt).toLocaleString('en-US')}</dd>
          </div>
          <div>
            <dt className="inline text-muted">Reviewer: </dt>
            <dd className="inline font-medium text-fg">{reviewer}</dd>
          </div>
        </dl>
      </header>

      {inv.sample && (
        <div className="rounded-lg bg-sky-bg border border-sky px-3.5 py-2 text-xs font-medium text-info">
          Sample Investigation Record: Contains illustrative clinical and billing guidelines for demonstration.
        </div>
      )}

      {/* 7-Stage Workflow Progress */}
      <Section title="Investigation Lifecycle & Verification Chain">
        <Workflow stages={workflow(inv, saved)} compact />
      </Section>

      {/* Claim Summary */}
      <Section title="Claim Summary & Billing Metadata">
        <div className="rounded-xl border border-line bg-sage/30 p-5 space-y-4">
          <p className="text-base font-bold text-heading leading-snug">{inv.claim}</p>
          <dl className="tabular grid grid-cols-2 gap-x-6 gap-y-3 text-xs sm:grid-cols-4 pt-1 border-t border-line/60">
            {[
              ['Clinical Category', inv.category],
              ['Billing Provider', inv.provider ?? '—'],
              ['Service Dates', inv.serviceDateFrom ? `${fmtDate(inv.serviceDateFrom)}${inv.serviceDateTo && inv.serviceDateTo !== inv.serviceDateFrom ? ` – ${fmtDate(inv.serviceDateTo)}` : ''}` : '—'],
              ['Billed Amount', fmtMoney(inv.billedAmount)],
              ['Billing Date', fmtDate(inv.billingDate)],
              ['Audit Opened', fmtDate(inv.createdAt)],
              ['Evidence Status', evidenceStatus(inv)],
              ['Retrieval Run', tf.label],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-muted font-medium">{k}</dt>
                <dd className="font-semibold text-heading mt-0.5">{v}</dd>
              </div>
            ))}
          </dl>
          {inv.details && (
            <p className="text-xs text-muted border-t border-line/60 pt-2.5 leading-relaxed">
              <strong className="text-fg">Claim Narrative: </strong>{inv.details}
            </p>
          )}
        </div>
      </Section>

      {/* Billing Codes */}
      {!!inv.billingCodes?.length && (
        <Section title="Procedure & Diagnosis Codes (CPT / ICD-10 / HCPCS)">
          <div className="overflow-hidden rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead className="bg-sage text-muted">
                <tr>
                  <th className={th}>Code</th>
                  <th className={th}>Type</th>
                  <th className={th}>Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {inv.billingCodes.map((c, k) => (
                  <tr key={k}>
                    <td className={`${td} tabular font-bold text-heading`}>{c.code}</td>
                    <td className={`${td} font-medium text-muted`}>{c.type}</td>
                    <td className={`${td} text-fg`}>{c.description || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Clinical Timeline */}
      {!!inv.clinicalTimeline?.length && (
        <Section title="Clinical Event Timeline">
          <ol className="space-y-2 rounded-xl border border-line bg-sage/30 p-4 text-xs">
            {inv.clinicalTimeline.map((t, k) => (
              <li key={k} className="flex gap-4 items-baseline">
                <span className="tabular w-24 shrink-0 font-bold text-primary">{fmtDate(t.date)}</span>
                <span className="text-fg leading-relaxed">{t.event}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {/* Verification Questions */}
      <Section title="Audit Verification Inquiries" desc="Derived from billing codes, medical necessity rules, and payer requirements">
        <ol className="list-decimal space-y-1.5 pl-5 text-xs text-fg leading-relaxed">
          {verificationQuestions(inv).map((q) => (
            <li key={q} className="font-medium">{q}</li>
          ))}
        </ol>
      </Section>

      {/* TinyFish Live Evidence */}
      <Section title="TinyFish Live-Web Regulatory Evidence" desc="Authentic payer coverage policies and CMS guidelines retrieved via cloud crawler">
        <div className="rounded-xl border border-line bg-sage/40 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-2">
              <span className="font-semibold text-muted">TinyFish Integration:</span>
              <RetrievalBadge status={tf.status ?? 'not_configured'} />
            </span>
            <span className="tabular text-muted">
              Retrieved: {tf.retrievedAt ? new Date(tf.retrievedAt).toLocaleString('en-US') : 'Not yet run'}
            </span>
          </div>
          <p className="text-xs font-semibold text-heading">{tf.message}</p>
        </div>

        {tf.sources.length > 0 && (
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-card overflow-hidden">
            {tf.sources.map((e) => (
              <li key={e.id} className="break-inside-avoid p-4 text-xs space-y-1.5 hover:bg-sage/20 transition-colors">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-bold text-sm text-heading">{e.title}</p>
                  <ClassChip value={e.classification} />
                </div>
                <a
                  href={e.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all font-mono text-[11px] text-info hover:underline inline-flex items-center gap-1"
                >
                  <Icon name="link" size={11} /> {e.url}
                </a>
                <div className="rounded-lg border border-line bg-sage/30 p-3 text-fg leading-relaxed">
                  {e.summary || 'No quote returned.'}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted pt-1">
                  <span>Helps verify: <strong className="text-fg">{e.verifies ?? 'Target policy guidelines'}</strong></span>
                  <span className="tabular">{e.publisher} · {e.retrievedAt ? new Date(e.retrievedAt).toLocaleString('en-US') : ''}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Other Evidence */}
      {other.length > 0 && (
        <Section title="Manual & Supplemental Evidence Sources" desc="Sources entered directly by the clinical audit team">
          <div className="overflow-hidden rounded-xl border border-line">
            <table className="w-full text-xs">
              <thead className="bg-sage text-muted">
                <tr>
                  <th className={th}>Source</th>
                  <th className={th}>Classification</th>
                  <th className={th}>Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {other.map((e) => (
                  <tr key={e.id}>
                    <td className={td}>
                      <p className="font-bold text-heading">{e.title}</p>
                      <p className="break-all text-muted mt-0.5">{e.publisher} · {e.url}</p>
                    </td>
                    <td className={`${td} whitespace-nowrap`}>
                      <ClassChip value={e.classification} />
                    </td>
                    <td className={`${td} text-fg leading-relaxed`}>{e.summary || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Findings */}
      <Section title="Synthesized Audit Findings" desc="Categorized evidence statements cross-referenced with policy criteria">
        <div className="grid gap-3.5 md:grid-cols-2 print:grid-cols-2">
          <FindingGroup title="Supported Information" tone="bg-emerald-500" items={fs.supported} empty="No supported evidence items recorded." />
          <FindingGroup title="Conflicting Policy Statements" tone="bg-rose-500" items={fs.conflicting} empty="No conflicting evidence recorded." />
          <FindingGroup title="Unverified Claim Details" tone="bg-amber-500" items={fs.unverified} empty="No unverified details recorded." />
          <FindingGroup title="Compliance Risk Indicators" tone="bg-sky-500" items={fs.risks} empty="No risk indicators identified." />
        </div>
        {inv.recommendation && (
          <div className="mt-4 rounded-xl border border-line bg-sage/30 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">Recommended Audit Actions</p>
            <p className="mt-1 text-xs text-fg whitespace-pre-line leading-relaxed">{inv.recommendation}</p>
          </div>
        )}
      </Section>

      {/* Review Status & Outcome */}
      <Section title="Reviewer Determination & Governance">
        <dl className="grid grid-cols-2 gap-4 text-xs">
          <div className="rounded-xl border border-line bg-sage/30 p-4">
            <dt className="font-semibold text-muted">Audit Review Status</dt>
            <dd className="text-sm font-bold text-heading mt-1">{reviewLabel(inv)}</dd>
          </div>
          <div className="rounded-xl border border-line bg-sage/30 p-4">
            <dt className="font-semibold text-muted">Review Outcome Determination</dt>
            <dd className="text-sm font-bold text-heading mt-1">{inv.outcome ?? 'Not determined'}</dd>
          </div>
        </dl>
      </Section>

      {/* Reviewer Notes */}
      <Section title="Clinical Reviewer Documentation">
        <div className="rounded-xl border border-line bg-card p-4 text-xs leading-relaxed text-fg shadow-xs">
          {[inv.reviewerNotes, inv.notes].filter(Boolean).join('\n\n') || (
            <span className="text-muted italic">No clinical notes recorded for this investigation.</span>
          )}
        </div>
      </Section>

      {/* Sign-off Block */}
      <footer className="grid grid-cols-2 gap-12 pt-8 text-xs text-muted break-inside-avoid border-t border-line">
        <div>
          <div className="h-10 border-b border-fg/30" />
          <p className="mt-2 font-medium text-heading">Clinical Auditor Signature · {reviewer}</p>
        </div>
        <div>
          <div className="h-10 border-b border-fg/30" />
          <p className="mt-2 font-medium text-heading">Date of Determination</p>
        </div>
        <p className="col-span-2 text-[11px] text-muted text-center pt-2">
          Medarina Clinical Evidence Platform · Verified Audit Record · Human Reviewer Governed
        </p>
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
    if (autoPrint && live) {
      const t = setTimeout(() => window.print(), 300)
      return () => clearTimeout(t)
    }
  }, [autoPrint, live])

  if (!live || (snapId && !snap)) {
    return (
      <Card>
        <EmptyState
          title={live ? 'Saved report not found' : 'No Investigations Found'}
          desc={
            live
              ? 'This saved report snapshot is no longer in the investigation history.'
              : 'This investigation does not exist or has been deleted.'
          }
          action={
            <a href="#/investigations">
              <Button>Investigation History</Button>
            </a>
          }
        />
      </Card>
    )
  }

  const inv = (snap?.snapshot as Investigation) ?? live
  const generatedAt = snap?.generatedAt ?? new Date().toISOString()
  const reviewer = settings.displayName || 'Reviewer'
  const saved = !!live.savedReports?.length

  const persist = async (silent = false) => {
    if (snap) return
    try {
      const r = await saveReport(live.id)
      if (r) {
        if (!silent) toast('success', `Report saved to ${live.ref} history in Supabase.`)
      }
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'The report could not be saved.')
    }
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <a
          href={`#/investigations/${live.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-fg transition-colors"
        >
          <Icon name="left" size={14} /> Back to Case {live.ref}
        </a>
        <div className="flex flex-wrap items-center gap-2">
          {!snap && (
            <Button size="sm" onClick={() => void persist()}>
              <Icon name="archive" size={15} /> Save to Supabase History
            </Button>
          )}
          <Button
            size="sm"
            onClick={async () => {
              await persist(true)
              window.print()
            }}
          >
            <Icon name="printer" size={15} /> Print Report
          </Button>
          <Button
            size="sm"
            variant="primary"
            loading={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await persist(true)
                await exportReportPdf(inv, reviewer, generatedAt, true)
                toast('success', `Medarina-${inv.ref}.pdf downloaded.`)
              } catch {
                toast('error', 'The PDF could not be generated.')
              } finally {
                setBusy(false)
              }
            }}
          >
            <Icon name="download" size={15} /> Export PDF
          </Button>
        </div>
      </div>

      {snap && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-300 dark:border-sky-800 bg-sky-bg px-4 py-3 text-xs text-info print:hidden shadow-xs">
          <span>Point-in-time snapshot archived on {new Date(snap.generatedAt).toLocaleString('en-US')}.</span>
          <button
            onClick={() => navigate(`/investigations/${live.id}/report`)}
            className="font-bold underline hover:no-underline"
          >
            View Live Dynamic Report
          </button>
        </div>
      )}

      <ReportDocument
        inv={inv}
        reviewer={reviewer}
        generatedAt={generatedAt}
        saved={saved || !!snap}
      />

      {!!live.savedReports?.length && (
        <Card className="mx-auto mt-8 max-w-[900px] print:hidden">
          <div className="border-b border-line px-5 py-3.5 flex items-center justify-between">
            <h2 className="text-sm font-bold text-heading">Archived Snapshots for {live.ref}</h2>
            <span className="text-xs font-medium text-muted">{live.savedReports.length} snapshot(s) in Supabase</span>
          </div>
          <ul className="divide-y divide-line text-xs">
            {live.savedReports.map((r) => (
              <li key={r.id}>
                <a
                  href={`#/investigations/${live.id}/report?snapshot=${r.id}`}
                  className={`flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-sage transition-colors ${
                    r.id === snapId ? 'bg-sage font-bold' : ''
                  }`}
                >
                  <span className="tabular font-medium text-heading">
                    {new Date(r.generatedAt).toLocaleString('en-US')}
                  </span>
                  <span className="text-muted font-medium">{r.outcome}</span>
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  )
}
