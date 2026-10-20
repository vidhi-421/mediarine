import { useState } from 'react'
import EvidencePreview from '../components/EvidencePreview'
import Workflow from '../components/Workflow'
import { exportReportPdf, workflow } from '../lib/report'
import { Button, Card, CardHeader, CLASS, ClassChip, ConfirmDialog, EmptyState, Field, Icon, Modal, Notice, OriginChip, PageHeader, RetrievalBadge, RetrievalChip, SampleChip, Spinner, StatusChip, STATUS, inputCls } from '../components/ui'
import { addEvidence, archiveInvestigation, evidenceStatus, fmtDate, fmtMoney, retrievalStatusOf, OUTCOMES, type Evidence, removeInvestigation, runRetrieval, updateInvestigation, useInvestigations, useSettings, type Classification, type Investigation, type ReviewStatus } from '../lib/store'
import { navigate } from '../lib/router'
import { toast } from '../lib/toast'
import { RETRIEVAL_LABEL, type RetrievalStatus } from '../lib/tinyfish'

function RetrievalPanel({ inv }: { inv: Investigation }) {
  const st = retrievalStatusOf(inv)
  const busy = st === 'retrieving' || st === 'queued' && inv.status === 'retrieving'
  const order: RetrievalStatus[] = ['queued', 'retrieving', st === 'failed' ? 'failed' : st === 'not_configured' ? 'not_configured' : 'completed']
  const reached = (k: RetrievalStatus) => {
    if (!st) return false
    const idx = { queued: 0, retrieving: 1, completed: 2, failed: 2, not_configured: 2 }
    return idx[k] <= idx[st]
  }
  const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '')
  return (
    <Card>
      <CardHeader title="Evidence retrieval" desc="TinyFish live source retrieval" action={!inv.sample && <Button size="sm" variant="primary" loading={busy} onClick={() => runRetrieval(inv.id)}><Icon name={st ? 'refresh' : 'play'} size={14} />{st ? 'Retrieve again' : 'Retrieve evidence'}</Button>} />
      <div className="space-y-4 p-5">
        <ol className="flex items-center gap-2">
          {order.map((k, i) => {
            const on = reached(k)
            const bad = on && (k === 'failed' || k === 'not_configured')
            return (
              <li key={k} className="flex flex-1 items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${bad ? (k === 'failed' ? 'bg-crit' : 'bg-warn') : on ? 'bg-primary' : 'bg-line'}`} />
                <span className={`text-xs ${on ? 'font-medium text-fg' : 'text-muted'}`}>{RETRIEVAL_LABEL[k]}</span>
                {i < order.length - 1 && <span className={`h-px flex-1 ${reached(order[i + 1]) ? 'bg-primary' : 'bg-line'}`} />}
              </li>
            )
          })}
        </ol>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <RetrievalBadge status={st} />
          <span className="text-muted">{inv.retrieval?.message ?? (st ? '' : 'Retrieval has not been run for this investigation.')}</span>
        </div>
        {(inv.retrieval?.startedAt || inv.retrieval?.completedAt) && (
          <p className="tabular text-xs text-muted">{inv.retrieval.startedAt && `Started ${fmt(inv.retrieval.startedAt)}`}{inv.retrieval.completedAt && ` · Finished ${fmt(inv.retrieval.completedAt)}`}</p>
        )}
        {st === 'not_configured' && <a href="#/settings" className="inline-flex items-center gap-1 text-sm font-medium text-info hover:underline">Configure TinyFish in Settings <Icon name="right" size={14} /></a>}
      </div>
    </Card>
  )
}

function verificationStatus(inv: Investigation) {
  const c = (k: Classification) => inv.evidence.filter((e) => e.classification === k).length
  if (!inv.evidence.length) return { title: 'Not yet assessed', text: 'No evidence has been retrieved or added, so no assessment can be made.' }
  if (c('conflicting')) return { title: 'Conflicting evidence identified', text: 'Sources disagree on at least one material point. Human review is recommended before any determination.' }
  if (c('verified') && !c('unverified') && !c('inconclusive')) return { title: 'Supporting evidence identified', text: 'All classified sources support the claim. A reviewer should confirm before closing.' }
  if (c('verified')) return { title: 'Partially supported', text: 'Some sources support the claim; others are unverified or inconclusive.' }
  return { title: 'Inconclusive', text: 'Available evidence does not confirm or contradict the claim.' }
}

function AddEvidence({ id, onClose }: { id: string; onClose: () => void }) {
  const [f, setF] = useState({ title: '', url: '', publisher: '', published: '', classification: 'unverified' as Classification, summary: '' })
  const [err, setErr] = useState('')
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<any>) => setF({ ...f, [k]: e.target.value })
  function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (!f.title.trim()) throw new Error('Enter a source title.')
      if (!/^https?:$/.test(new URL(f.url.trim()).protocol)) throw new Error()
    } catch (x) {
      setErr(x instanceof Error && x.message ? x.message : 'Enter a valid http or https URL.')
      return
    }
    addEvidence(id, { title: f.title.trim(), url: f.url.trim(), publisher: f.publisher.trim() || new URL(f.url.trim()).hostname, published: f.published || undefined, classification: f.classification, summary: f.summary.trim(), retrieval: 'not_attempted', origin: 'user-provided' })
    onClose()
  }
  return (
    <Modal title="Add evidence" onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="Source title" htmlFor="et"><input id="et" value={f.title} onChange={set('title')} className={inputCls} /></Field>
        <Field label="Source URL" htmlFor="eu"><input id="eu" type="url" value={f.url} onChange={set('url')} className={inputCls} placeholder="https://" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Publisher (optional)" htmlFor="ep"><input id="ep" value={f.publisher} onChange={set('publisher')} className={inputCls} /></Field>
          <Field label="Publication date (optional)" htmlFor="ed"><input id="ed" type="date" value={f.published} onChange={set('published')} className={inputCls} /></Field>
        </div>
        <Field label="Classification" htmlFor="ec">
          <select id="ec" value={f.classification} onChange={set('classification')} className={inputCls}>
            {(Object.keys(CLASS) as Classification[]).map((k) => <option key={k} value={k}>{CLASS[k].label}</option>)}
          </select>
        </Field>
        <Field label="Evidence summary" htmlFor="es"><textarea id="es" rows={3} value={f.summary} onChange={set('summary')} className={inputCls} /></Field>
        {err && <p role="alert" className="text-sm text-crit-fg">{err}</p>}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">Add evidence</Button>
        </div>
      </form>
    </Modal>
  )
}

export default function InvestigationDetail({ id }: { id: string }) {
  const inv = useInvestigations().find((i) => i.id === id)
  const [filter, setFilter] = useState<'all' | Classification>('all')
  const [adding, setAdding] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [preview, setPreview] = useState<Evidence | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  const settings = useSettings()

  if (!inv)
    return (
      <Card><EmptyState title="No Investigations Found" desc="This investigation does not exist or has been deleted." action={<a href="#/investigations"><Button>Investigation History</Button></a>} /></Card>
    )

  const counts = (k: Classification) => inv.evidence.filter((e) => e.classification === k).length
  const shown = inv.evidence.filter((e) => filter === 'all' || e.classification === filter)
  const vs = verificationStatus(inv)
  const retrievedN = inv.evidence.filter((e) => e.retrieval === 'retrieved').length

  return (
    <>
      <a href="#/investigations" className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted hover:text-fg"><Icon name="left" size={14} />Investigation History</a>
      <PageHeader
        title={inv.ref}
        desc={inv.claim}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {inv.sample && <SampleChip />}
            {inv.outcome && inv.outcome !== 'Not determined' && <span className="inline-flex items-center rounded-full bg-sky-bg px-2.5 py-0.5 text-xs font-medium text-info">{inv.outcome}</span>}
            <StatusChip status={inv.status} />
            <a href={`#/investigations/${inv.id}/report`}><Button size="sm"><Icon name="file" size={14} />View Report</Button></a>
            <a href={`#/investigations/${inv.id}/report?print=1`}><Button size="sm"><Icon name="printer" size={14} />Print Report</Button></a>
            <Button size="sm" variant="primary" loading={pdfBusy} onClick={async () => { setPdfBusy(true); try { await exportReportPdf(inv, settings.displayName || 'Reviewer', undefined, !!inv.savedReports?.length); toast('success', `Medarina-${inv.ref}.pdf downloaded.`) } catch { toast('error', 'The PDF could not be generated.') } finally { setPdfBusy(false) } }}><Icon name="download" size={14} />Export PDF</Button>
          </div>
        }
      />

      {inv.status === 'failed' && (
        <div className="mb-6">
          <Notice tone="error" title="Source Retrieval Failed" action={!inv.sample && <Button size="sm" onClick={() => runRetrieval(inv.id)}><Icon name="refresh" size={14} />Retry retrieval</Button>}>
            {inv.retrievalError ?? 'Sources could not be retrieved.'} {!inv.sample && !inv.evidence.length && 'You can also add evidence manually and complete a review.'}
          </Notice>
        </div>
      )}
      {inv.sample && (
        <div className="mb-6"><Notice title="Sample Investigation">This record contains illustrative example data, not live results. Retrieval and evidence editing are disabled; create a new investigation to use the workspace.</Notice></div>
      )}

      <Card className="mb-6">
        <CardHeader title="Investigation workflow" desc="Each stage reflects the recorded state of this investigation." />
        <div className="p-5"><Workflow stages={workflow(inv, !!inv.savedReports?.length)} /></div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <RetrievalPanel inv={inv} />

          {(inv.billingCodes?.length || inv.clinicalTimeline?.length) ? (
            <Card>
              <CardHeader title="Billing and clinical context" desc={[inv.serviceDateFrom && `Service ${fmtDate(inv.serviceDateFrom)}${inv.serviceDateTo && inv.serviceDateTo !== inv.serviceDateFrom ? ` to ${fmtDate(inv.serviceDateTo)}` : ''}`, inv.billedAmount !== undefined && `Billed ${fmtMoney(inv.billedAmount)}`].filter(Boolean).join(' · ') || undefined} />
              {!!inv.billingCodes?.length && (
                <table className="w-full text-sm">
                  <thead className="border-b border-line bg-sage text-xs text-muted"><tr><th scope="col" className="px-5 py-2 text-left font-medium">Code</th><th scope="col" className="px-5 py-2 text-left font-medium">Type</th><th scope="col" className="px-5 py-2 text-left font-medium">Description</th></tr></thead>
                  <tbody className="divide-y divide-line">
                    {inv.billingCodes.map((c, k) => <tr key={k}><td className="tabular px-5 py-2.5 font-medium">{c.code}</td><td className="px-5 py-2.5 text-muted">{c.type}</td><td className="px-5 py-2.5">{c.description || '—'}</td></tr>)}
                  </tbody>
                </table>
              )}
              {!!inv.clinicalTimeline?.length && (
                <ol className="relative space-y-3 border-t border-line p-5">
                  {inv.clinicalTimeline.map((t, k) => (
                    <li key={k} className="flex gap-3 text-sm"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" /><span className="tabular w-28 shrink-0 text-muted">{fmtDate(t.date)}</span><span>{t.event}</span></li>
                  ))}
                </ol>
              )}
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Evidence assessment" />
            <div className="space-y-4 p-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Verification status</p>
                <p className="mt-1 text-lg font-semibold">{vs.title}</p>
                <p className="mt-1 text-sm text-muted">{vs.text}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(Object.keys(CLASS) as Classification[]).map((k) => (
                  <div key={k} className="rounded-md border border-line bg-sage p-3">
                    <p className="tabular text-2xl font-semibold">{counts(k)}</p>
                    <p className="text-xs text-muted">{CLASS[k].label}</p>
                  </div>
                ))}
              </div>
              {inv.summary && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">Investigation Summary</p>
                  <p className="mt-1 text-sm">{inv.summary}</p>
                </div>
              )}
              <p className="text-xs text-muted">Source coverage: {retrievedN} of {inv.evidence.length} sources retrieved. This assessment counts classified evidence only; it is not a determination of fraud or a probability score.</p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Supporting and conflicting evidence" desc="Each item shows how it was obtained." action={!inv.sample && <Button size="sm" onClick={() => setAdding(true)}><Icon name="plus" size={14} />Add evidence</Button>} />
            <div role="tablist" aria-label="Filter evidence" className="flex flex-wrap gap-2 border-b border-line px-5 py-3">
              {(['all', 'verified', 'unverified', 'conflicting', 'inconclusive'] as const).map((k) => (
                <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${filter === k ? 'border-primary bg-mint text-mint-fg' : 'border-line text-muted hover:bg-sage'}`}>
                  {k === 'all' ? `All (${inv.evidence.length})` : `${CLASS[k].label} (${counts(k)})`}
                </button>
              ))}
            </div>
            {inv.status === 'retrieving' && !inv.evidence.length ? (
              <div className="flex items-center gap-3 px-5 py-10 text-sm text-muted"><Spinner size={18} />Retrieving sources…</div>
            ) : shown.length === 0 ? (
              <EmptyState icon="sources" title="No evidence recorded" desc={inv.evidence.length ? 'No evidence in this classification.' : 'Evidence will appear here once sources are retrieved or added by a reviewer.'} />
            ) : (
              <ul className="divide-y divide-line">
                {shown.map((e) => (
                  <li key={e.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <a href={e.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-1.5 font-medium text-info hover:underline">{e.title}<Icon name="external" size={13} /></a>
                      <ClassChip value={e.classification} />
                    </div>
                    <p className="tabular mt-0.5 break-all text-xs text-muted">{e.publisher} · {e.url}</p>
                    <p className="mt-2 text-sm">{e.summary || 'No summary available.'}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <OriginChip origin={e.origin} />
                      <RetrievalChip state={e.retrieval} />
                      <span className="tabular text-xs text-muted">Published: {e.published ? fmtDate(e.published) : 'not available'}</span>
                      <button onClick={() => setPreview(e)} className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-info hover:underline"><Icon name="eye" size={13} />Preview</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Claim details" />
            <dl className="space-y-3 p-5 text-sm">
              {[['Category', inv.category], ['Opened', fmtDate(inv.createdAt)], ['Evidence status', evidenceStatus(inv)], ['Provider', inv.provider], ['Billing date', inv.billingDate && fmtDate(inv.billingDate)], ['Details', inv.details], ['Intake notes', inv.reviewerNotes]].map(([k, v]) => v ? (
                <div key={k}><dt className="text-xs text-muted">{k}</dt><dd>{v}</dd></div>
              ) : null)}
              {inv.sourceUrl && <div><dt className="text-xs text-muted">Source URL</dt><dd><a href={inv.sourceUrl} target="_blank" rel="noopener noreferrer" className="break-all text-primary hover:underline">{inv.sourceUrl}</a></dd></div>}
            </dl>
          </Card>

          <Card>
            <CardHeader title="Risk indicators" />
            <div className="p-5 text-sm">
              {inv.riskIndicators.length ? (
                <ul className="space-y-2">{inv.riskIndicators.map((r) => <li key={r} className="flex gap-2"><Icon name="alert" size={16} className="mt-0.5 text-warn" />{r}</li>)}</ul>
              ) : <p className="text-muted">No risk indicators recorded.</p>}
            </div>
          </Card>

          <Card>
            <CardHeader title="Recommended next steps" />
            <div className="whitespace-pre-line p-5 text-sm">{inv.recommendation ?? <span className="text-muted">No recommendation available until evidence has been assessed.</span>}</div>
          </Card>

          <Card>
            <CardHeader title="Reviewer decision" />
            <div className="space-y-4 p-5">
              <Field label="Review status" htmlFor="rs">
                <select id="rs" value={inv.status === 'retrieving' ? 'pending' : inv.status} disabled={inv.status === 'retrieving'} onChange={(e) => updateInvestigation(inv.id, { status: e.target.value as ReviewStatus })} className={inputCls}>
                  {(['pending', 'review', 'completed', 'failed'] as ReviewStatus[]).map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
                </select>
              </Field>
              <Field label="Review outcome" htmlFor="ro" hint="Outcomes record the next action, not a finding of fraud.">
                <select id="ro" value={inv.outcome ?? 'Not determined'} onChange={(e) => updateInvestigation(inv.id, { outcome: e.target.value })} className={inputCls}>
                  {OUTCOMES.map((o) => <option key={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Reviewer notes" htmlFor="rn">
                <textarea id="rn" rows={4} value={inv.notes} onChange={(e) => updateInvestigation(inv.id, { notes: e.target.value })} className={inputCls} />
              </Field>
              <div className="border-t border-line pt-4">
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => (inv.archived ? (archiveInvestigation(inv.id, false), toast('success', `${inv.ref} restored.`)) : setConfirmArchive(true))}><Icon name="archive" size={14} />{inv.archived ? 'Restore' : 'Archive'}</Button>
                  <Button size="sm" variant="danger" onClick={() => setConfirmDel(true)}><Icon name="trash" size={14} />Delete</Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
      {adding && <AddEvidence id={inv.id} onClose={() => setAdding(false)} />}
      {preview && <EvidencePreview evidence={preview} refLabel={inv.ref} onClose={() => setPreview(null)} />}
      {confirmArchive && <ConfirmDialog title="Archive investigation" confirmLabel="Archive" body={`${inv.ref} will be hidden from the overview and default history view. You can restore it from the Archived view.`} onClose={() => setConfirmArchive(false)} onConfirm={() => { archiveInvestigation(inv.id, true); setConfirmArchive(false); toast('success', `${inv.ref} archived.`); navigate('/investigations') }} />}
      {confirmDel && <ConfirmDialog danger title="Delete investigation" confirmLabel="Delete" body={`${inv.ref} and its evidence will be permanently removed from this browser. This cannot be undone.`} onClose={() => setConfirmDel(false)} onConfirm={() => { removeInvestigation(inv.id); toast('success', `${inv.ref} deleted.`); navigate('/investigations') }} />}
    </>
  )
}
