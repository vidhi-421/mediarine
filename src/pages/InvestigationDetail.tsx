import { useEffect, useState } from 'react'
import EvidencePreview from '../components/EvidencePreview'
import Workflow from '../components/Workflow'
import { exportReportPdf, workflow } from '../lib/report'
import {
  Button,
  Card,
  CardHeader,
  CLASS,
  ClassChip,
  ConfirmDialog,
  EmptyState,
  Field,
  Icon,
  Modal,
  Notice,
  OriginChip,
  PageHeader,
  RetrievalBadge,
  RetrievalChip,
  SampleChip,
  Spinner,
  StatusChip,
  STATUS,
  inputCls,
} from '../components/ui'
import {
  addEvidence,
  archiveInvestigation,
  evidenceStatus,
  fmtDate,
  fmtMoney,
  refreshInvestigation,
  retrievalStatusOf,
  saveReport,
  OUTCOMES,
  type Evidence,
  removeInvestigation,
  runRetrieval,
  startInvestigationPolling,
  stopInvestigationPolling,
  updateInvestigation,
  useInvestigations,
  useSettings,
  useTinyFishStatus,
  type Classification,
  type Investigation,
  type ReviewStatus,
} from '../lib/store'
import { navigate } from '../lib/router'
import { toast } from '../lib/toast'
import { runTinyFishDiagnostics, type TinyFishDiagnosticResult } from '../lib/api'
import { RETRIEVAL_LABEL, type RetrievalStatus } from '../lib/tinyfish'

function getLiveRetrievalMessage(elapsed: number | undefined, customMsg?: string): string {
  if (customMsg && customMsg !== 'Retrieval in progress…') return customMsg
  if (elapsed === undefined) return 'Initiating live source retrieval...'
  if (elapsed < 10) return 'Connecting to TinyFish web crawler session...'
  if (elapsed < 30) return 'Scanning provider domain, CMS policies & fee schedules...'
  if (elapsed < 60) return 'Extracting policy provisions and billing requirements...'
  if (elapsed < 90) return 'Synthesizing evidence and verifying claim details...'
  return 'Finalizing policy extraction and audit determination...'
}

function RetrievalPanel({
  inv,
  elapsedSec,
}: {
  inv: Investigation
  elapsedSec?: number
}) {
  const st = retrievalStatusOf(inv)
  const busy = inv.status === 'retrieving' || st === 'retrieving'
  const isFailed = inv.status === 'failed' || st === 'failed'
  const isDone = st === 'completed' && inv.status !== 'failed'
  const tfStatus = useTinyFishStatus()
  const [showDiag, setShowDiag] = useState(false)
  const [diagLoading, setDiagLoading] = useState(false)
  const [diagResult, setDiagResult] = useState<TinyFishDiagnosticResult | null>(null)

  const order: RetrievalStatus[] = [
    'queued',
    'retrieving',
    st === 'failed' ? 'failed' : st === 'not_configured' ? 'not_configured' : 'completed',
  ]
  const reached = (k: RetrievalStatus) => {
    if (!st) return false
    const idx = { queued: 0, retrieving: 1, completed: 2, failed: 2, not_configured: 2 }
    return idx[k] <= idx[st]
  }

  const fmt = (iso?: string) =>
    iso
      ? new Date(iso).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
        })
      : ''

  const liveMessage = busy
    ? getLiveRetrievalMessage(elapsedSec, inv.retrieval?.message)
    : inv.retrieval?.message ?? (st ? '' : 'Retrieval has not been run for this investigation.')

  return (
    <Card className={busy ? 'border-emerald/60 shadow-md ring-1 ring-emerald/20' : ''}>
      <CardHeader
        title="Evidence Retrieval"
        desc="TinyFish live automated source crawler & policy extractor"
        action={
          !inv.sample && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={isFailed ? 'danger' : 'primary'}
                loading={busy}
                disabled={busy}
                onClick={() => {
                  if (!busy) {
                    toast('info', 'Starting live evidence retrieval...')
                    runRetrieval(inv.id)
                  }
                }}
              >
                <Icon name={st ? 'refresh' : 'play'} size={14} />
                {busy ? 'Retrieving…' : isFailed ? 'Retry Retrieval' : st ? 'Retrieve again' : 'Retrieve Evidence'}
              </Button>
            </div>
          )
        }
      />
      <div className="space-y-4 p-5">
        {/* Real-time TinyFish Service & Diagnostics Status Indicator */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-line bg-sage/60 px-3.5 py-2.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-heading">TinyFish Service:</span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium ${
                tfStatus.status === 'connected'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                  : tfStatus.status === 'checking'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  tfStatus.status === 'connected'
                    ? 'bg-emerald-500 animate-pulse'
                    : tfStatus.status === 'checking'
                      ? 'bg-amber-500 animate-ping'
                      : 'bg-rose-500'
                }`}
              />
              {tfStatus.status === 'connected'
                ? 'Connected & Authenticated'
                : tfStatus.status === 'checking'
                  ? 'Checking Service...'
                  : 'Unavailable'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-muted">
            <span>
              Last retrieval:{' '}
              <strong className="text-fg">{st ? RETRIEVAL_LABEL[st] : 'Not started'}</strong>
            </span>
            <span>·</span>
            <span>
              Sources retrieved:{' '}
              <strong className="text-fg">
                {inv.evidence.filter((e) => e.provider === 'tinyfish' || e.origin === 'live-source').length}
              </strong>
            </span>
            <button
              type="button"
              onClick={() => setShowDiag(!showDiag)}
              className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
            >
              <Icon name="search" size={12} />
              {showDiag ? 'Hide Diagnostics' : 'Integration Diagnostics'}
            </button>
          </div>
        </div>

        {/* Integration Diagnostics Drawer */}
        {showDiag && (
          <div className="space-y-3 rounded-lg border border-line bg-page p-4 text-xs">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <span className="font-semibold text-heading">TinyFish Live Integration Diagnostics</span>
              <span className="text-muted">Safe verification without exposing API keys</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <span className="block text-muted">Endpoint:</span>
                <span className="font-mono text-[11px] text-fg">
                  {tfStatus.endpoint || 'https://agent.tinyfish.ai/v1/automation/run'}
                </span>
              </div>
              <div>
                <span className="block text-muted">API Key:</span>
                <span className="font-medium text-fg">
                  {tfStatus.hasKey ? 'Configured (Server-side secured)' : 'Missing'}
                </span>
              </div>
              <div>
                <span className="block text-muted">Connection Ping:</span>
                <span className="text-fg">
                  {tfStatus.pingMessage || (tfStatus.reachable ? 'API Reachable & Authenticated' : 'Checking…')}
                </span>
              </div>
              <div>
                <span className="block text-muted">Last Crawler Execution:</span>
                <span className="text-fg">
                  {tfStatus.lastRun?.durationSeconds
                    ? `${tfStatus.lastRun.durationSeconds}s (${tfStatus.lastRun.sourceCount} sources)`
                    : 'No recent run recorded'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2.5">
              <span className="text-muted">Verify live crawler against target domain:</span>
              <Button
                size="sm"
                variant="ghost"
                loading={diagLoading}
                disabled={diagLoading}
                onClick={async () => {
                  setDiagLoading(true)
                  try {
                    const testUrl = inv.sourceUrl || 'https://example.com'
                    const r = await runTinyFishDiagnostics(testUrl)
                    setDiagResult(r)
                    toast(
                      'success',
                      `Live crawler test finished in ${r.durationSeconds}s (${r.sourceCount} sources extracted).`,
                    )
                  } catch (err) {
                    toast('error', err instanceof Error ? err.message : 'Diagnostics run failed.')
                  } finally {
                    setDiagLoading(false)
                  }
                }}
              >
                <Icon name="sparkles" size={13} />
                Run Controlled Live Retrieval ({inv.sourceUrl ? new URL(inv.sourceUrl).hostname : 'example.com'})
              </Button>
            </div>

            {diagResult && (
              <div className="space-y-1.5 rounded border border-emerald-300 bg-emerald-50/80 p-3 text-[11px] text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
                <div className="flex items-center justify-between font-mono font-semibold">
                  <span>Status: {diagResult.status.toUpperCase()}</span>
                  <span>Duration: {diagResult.durationSeconds}s</span>
                </div>
                <p className="font-mono">Target: {diagResult.targetUrl}</p>
                <p className="font-mono">Extracted Sources: {diagResult.sourceCount}</p>
                {diagResult.summary && (
                  <p className="mt-1 rounded border border-line bg-card p-2 text-xs text-fg leading-relaxed">
                    {diagResult.summary}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step progress pills */}
        <ol className="flex items-center gap-2">
          {order.map((k, i) => {
            const on = reached(k)
            const bad = on && (k === 'failed' || k === 'not_configured')
            return (
              <li key={k} className="flex flex-1 items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full transition-colors ${
                    bad
                      ? k === 'failed'
                        ? 'bg-crit animate-pulse'
                        : 'bg-warn'
                      : on
                        ? busy && k === 'retrieving'
                          ? 'bg-primary animate-ping'
                          : 'bg-primary'
                        : 'bg-line'
                  }`}
                />
                <span className={`text-xs ${on ? 'font-medium text-fg' : 'text-muted'}`}>
                  {RETRIEVAL_LABEL[k]}
                </span>
                {i < order.length - 1 && (
                  <span
                    className={`h-px flex-1 ${
                      reached(order[i + 1]) ? 'bg-primary' : 'bg-line'
                    }`}
                  />
                )}
              </li>
            )
          })}
        </ol>

        {/* Live status banner */}
        <div
          className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3.5 text-sm transition-colors ${
            busy
              ? 'border-emerald-300 bg-emerald-50/70 text-emerald-950 dark:bg-emerald-950/20 dark:text-emerald-200'
              : isFailed
                ? 'border-rose-200 bg-rose-50 text-rose-900 dark:bg-rose-950/20 dark:text-rose-200'
                : 'border-line bg-sage/50 text-fg'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {busy ? (
              <Spinner size={16} className="text-emerald-700 dark:text-emerald-400" />
            ) : (
              <RetrievalBadge status={st} />
            )}
            <span className="font-medium">{liveMessage}</span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            {busy && elapsedSec !== undefined && (
              <span className="inline-flex items-center gap-1 font-mono font-medium text-emerald-800 dark:text-emerald-300">
                <Icon name="clock" size={12} />
                {elapsedSec}s elapsed
              </span>
            )}
            <span className="tabular text-muted">
              {inv.evidence.length} evidence source{inv.evidence.length === 1 ? '' : 's'} recorded
            </span>
          </div>
        </div>

        {/* Error Callout if failed */}
        {isFailed && (
          <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
            <div className="flex items-start gap-2.5">
              <Icon name="alert" size={16} className="mt-0.5 shrink-0 text-crit" />
              <div className="flex-1 space-y-1">
                <p className="font-semibold">Retrieval encountered an error</p>
                <p className="text-xs text-rose-800 dark:text-rose-300">
                  {inv.retrievalError || inv.retrieval?.message || 'The external retrieval service returned an unhandled error.'}
                </p>
                <p className="pt-1 text-xs text-muted">
                  You can retry the request using the button above or manually attach clinical evidence below.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Timestamps */}
        {(inv.retrieval?.startedAt || inv.retrieval?.completedAt) && (
          <div className="flex flex-wrap items-center justify-between text-xs text-muted">
            <p className="tabular">
              {inv.retrieval.startedAt && `Started: ${fmt(inv.retrieval.startedAt)}`}
              {inv.retrieval.completedAt && ` · Completed: ${fmt(inv.retrieval.completedAt)}`}
            </p>
            {isDone && (
              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                <Icon name="check" size={12} /> Live retrieval finished
              </span>
            )}
          </div>
        )}

        {st === 'not_configured' && (
          <a
            href="#/settings"
            className="inline-flex items-center gap-1 text-sm font-medium text-info hover:underline"
          >
            Configure TinyFish in Settings <Icon name="right" size={14} />
          </a>
        )}
      </div>
    </Card>
  )
}

function verificationStatus(inv: Investigation) {
  const c = (k: Classification) => inv.evidence.filter((e) => e.classification === k).length
  if (!inv.evidence.length)
    return {
      title: 'Not yet assessed',
      text: 'No evidence has been retrieved or added, so no assessment can be made.',
    }
  if (c('conflicting'))
    return {
      title: 'Conflicting evidence identified',
      text: 'Sources disagree on at least one material point. Human review is recommended before any determination.',
    }
  if (c('verified') && !c('unverified') && !c('inconclusive'))
    return {
      title: 'Supporting evidence identified',
      text: 'All classified sources support the claim. A reviewer should confirm before closing.',
    }
  if (c('verified'))
    return {
      title: 'Partially supported',
      text: 'Some sources support the claim; others are unverified or inconclusive.',
    }
  return {
    title: 'Inconclusive',
    text: 'Available evidence does not confirm or contradict the claim.',
  }
}

function AddEvidence({ id, onClose }: { id: string; onClose: () => void }) {
  const [f, setF] = useState({
    title: '',
    url: '',
    publisher: '',
    published: '',
    classification: 'unverified' as Classification,
    summary: '',
  })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<any>) =>
    setF({ ...f, [k]: e.target.value })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (!f.title.trim()) throw new Error('Enter a source title.')
      if (!/^https?:$/.test(new URL(f.url.trim()).protocol)) throw new Error()
    } catch (x) {
      setErr(x instanceof Error && x.message ? x.message : 'Enter a valid http or https URL.')
      return
    }
    setBusy(true)
    try {
      await addEvidence(id, {
        title: f.title.trim(),
        url: f.url.trim(),
        publisher: f.publisher.trim() || new URL(f.url.trim()).hostname,
        published: f.published || undefined,
        classification: f.classification,
        summary: f.summary.trim(),
        retrieval: 'not_attempted',
        origin: 'user-provided',
      })
      toast('success', 'Evidence added.')
      onClose()
    } catch (x) {
      setErr(x instanceof Error ? x.message : 'Failed to add evidence.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Add evidence" onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="Source title" htmlFor="et">
          <input id="et" value={f.title} onChange={set('title')} className={inputCls} />
        </Field>
        <Field label="Source URL" htmlFor="eu">
          <input
            id="eu"
            type="url"
            value={f.url}
            onChange={set('url')}
            className={inputCls}
            placeholder="https://"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Publisher (optional)" htmlFor="ep">
            <input id="ep" value={f.publisher} onChange={set('publisher')} className={inputCls} />
          </Field>
          <Field label="Publication date (optional)" htmlFor="ed">
            <input
              id="ed"
              type="date"
              value={f.published}
              onChange={set('published')}
              className={inputCls}
            />
          </Field>
        </div>
        <Field label="Classification" htmlFor="ec">
          <select
            id="ec"
            value={f.classification}
            onChange={set('classification')}
            className={inputCls}
          >
            {(Object.keys(CLASS) as Classification[]).map((k) => (
              <option key={k} value={k}>
                {CLASS[k].label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Evidence summary" htmlFor="es">
          <textarea
            id="es"
            rows={3}
            value={f.summary}
            onChange={set('summary')}
            className={inputCls}
          />
        </Field>
        {err && (
          <p role="alert" className="text-sm text-crit-fg">
            {err}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={busy}>
            Add evidence
          </Button>
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
  const [savingReport, setSavingReport] = useState(false)
  const settings = useSettings()

  // Track real elapsed time every second while retrieval is active
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (inv?.status !== 'retrieving') return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [inv?.status])

  const elapsedSec =
    inv?.retrieval?.startedAt && inv.status === 'retrieving'
      ? Math.max(0, Math.floor((now - new Date(inv.retrieval.startedAt).getTime()) / 1000))
      : undefined

  // Poll backend every 3 seconds while status is 'retrieving', stop on terminal status
  useEffect(() => {
    if (!inv || inv.sample) return

    if (inv.status === 'retrieving') {
      void refreshInvestigation(id)
      const stop = startInvestigationPolling(id)
      return () => {
        stop()
      }
    } else {
      stopInvestigationPolling(id)
    }
  }, [id, inv?.status, inv?.sample])

  if (!inv)
    return (
      <Card>
        <EmptyState
          title="No Investigations Found"
          desc="This investigation does not exist or has been deleted."
          action={
            <a href="#/investigations">
              <Button>Investigation History</Button>
            </a>
          }
        />
      </Card>
    )

  const hasSavedReport = !!inv.savedReports?.length
  const stages = workflow(inv, hasSavedReport)

  // Identify current stage name for the workflow summary banner
  const activeStage =
    stages.find((s) => s.state === 'in_progress' || s.state === 'queued') ??
    (stages.every((s) => s.state === 'completed')
      ? { label: 'Review Decision Complete' }
      : stages.find((s) => s.state === 'not_started'))

  const counts = (k: Classification) => inv.evidence.filter((e) => e.classification === k).length
  const shown = inv.evidence.filter((e) => filter === 'all' || e.classification === filter)
  const vs = verificationStatus(inv)
  const retrievedN = inv.evidence.filter((e) => e.retrieval === 'retrieved').length

  // Determine analysis engine origin: backend saves 'analysisSource' in retrieval JSONB
  const analysisEngine =
    (inv.retrieval as any)?.analysisSource === 'gemini'
      ? 'gemini'
      : (inv.retrieval as any)?.analysisSource === 'rule-based-fallback'
        ? 'rule-based-fallback'
        : inv.summary?.includes('Offline Fallback')
          ? 'rule-based-fallback'
          : inv.summary
            ? 'gemini'
            : null

  const handleSaveReport = async () => {
    setSavingReport(true)
    try {
      const res = await saveReport(inv.id)
      if (res) toast('success', `Report snapshot saved to Supabase for ${inv.ref}.`)
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Could not save report to Supabase.')
    } finally {
      setSavingReport(false)
    }
  }

  return (
    <>
      <a
        href="#/investigations"
        className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted hover:text-fg"
      >
        <Icon name="left" size={14} />
        Investigation History
      </a>

      <PageHeader
        title={inv.ref}
        desc={inv.claim}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {inv.sample && <SampleChip />}
            {inv.outcome && inv.outcome !== 'Not determined' && (
              <span className="inline-flex items-center rounded-full bg-sky-bg px-2.5 py-0.5 text-xs font-medium text-info">
                {inv.outcome}
              </span>
            )}

            {/* Supabase Persistence Status Badge */}
            {hasSavedReport ? (
              <span
                title={`${inv.savedReports!.length} report snapshot(s) stored in Supabase`}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Saved to Supabase ({inv.savedReports!.length})
              </span>
            ) : (
              <span
                title="Investigation report is in draft mode"
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-sage/60 px-2.5 py-0.5 text-xs font-medium text-muted"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                Draft Report
              </span>
            )}

            <StatusChip status={inv.status} />

            <a href={`#/investigations/${inv.id}/report`}>
              <Button size="sm">
                <Icon name="file" size={14} />
                View Report
              </Button>
            </a>

            {!inv.sample && !hasSavedReport && (
              <Button
                size="sm"
                variant="ghost"
                loading={savingReport}
                onClick={handleSaveReport}
                title="Save current analysis and findings snapshot to Supabase"
              >
                <Icon name="archive" size={14} />
                Save Report
              </Button>
            )}

            <a href={`#/investigations/${inv.id}/report?print=1`}>
              <Button size="sm">
                <Icon name="printer" size={14} />
                Print Report
              </Button>
            </a>

            <Button
              size="sm"
              variant="primary"
              loading={pdfBusy}
              onClick={async () => {
                setPdfBusy(true)
                try {
                  await exportReportPdf(
                    inv,
                    settings.displayName || 'Reviewer',
                    undefined,
                    hasSavedReport,
                  )
                  toast('success', `Medarina-${inv.ref}.pdf downloaded.`)
                } catch {
                  toast('error', 'The PDF could not be generated.')
                } finally {
                  setPdfBusy(false)
                }
              }}
            >
              <Icon name="download" size={14} />
              Export PDF
            </Button>
          </div>
        }
      />

      {inv.status === 'failed' && (
        <div className="mb-6">
          <Notice
            tone="error"
            title="Source Retrieval Failed"
            action={
              !inv.sample && (
                <Button size="sm" onClick={() => runRetrieval(inv.id)}>
                  <Icon name="refresh" size={14} />
                  Retry retrieval
                </Button>
              )
            }
          >
            {inv.retrievalError ?? 'Sources could not be retrieved from the target URL.'}{' '}
            {!inv.sample &&
              !inv.evidence.length &&
              'You can retry retrieval or manually add verified evidence to complete the review.'}
          </Notice>
        </div>
      )}

      {inv.sample && (
        <div className="mb-6">
          <Notice title="Sample Investigation">
            This record contains illustrative example data, not live results. Retrieval and evidence
            editing are disabled; create a new investigation to use the workspace.
          </Notice>
        </div>
      )}

      {/* 7-Stage Workflow Progress Card */}
      <Card className="mb-6 overflow-hidden">
        <CardHeader
          title="Investigation Workflow"
          desc="Complete 7-stage lifecycle tracking from intake to Supabase report archive"
        />
        <div className="p-5">
          <Workflow
            stages={stages}
            currentStageName={activeStage?.label}
            elapsedSeconds={elapsedSec}
          />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Live Evidence Retrieval Card */}
          <RetrievalPanel inv={inv} elapsedSec={elapsedSec} />

          {(inv.billingCodes?.length || inv.clinicalTimeline?.length) ? (
            <Card>
              <CardHeader
                title="Billing and Clinical Context"
                desc={
                  [
                    inv.serviceDateFrom &&
                      `Service: ${fmtDate(inv.serviceDateFrom)}${
                        inv.serviceDateTo && inv.serviceDateTo !== inv.serviceDateFrom
                          ? ` to ${fmtDate(inv.serviceDateTo)}`
                          : ''
                      }`,
                    inv.billedAmount != null && `Billed: ${fmtMoney(inv.billedAmount)}`,
                  ]
                    .filter(Boolean)
                    .join(' · ') || undefined
                }
              />
              {!!inv.billingCodes?.length && (
                <table className="w-full text-sm">
                  <thead className="border-b border-line bg-sage text-xs text-muted">
                    <tr>
                      <th scope="col" className="px-5 py-2 text-left font-medium">
                        Code
                      </th>
                      <th scope="col" className="px-5 py-2 text-left font-medium">
                        Type
                      </th>
                      <th scope="col" className="px-5 py-2 text-left font-medium">
                        Description
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {inv.billingCodes.map((c, k) => (
                      <tr key={k}>
                        <td className="tabular px-5 py-2.5 font-medium">{c.code}</td>
                        <td className="px-5 py-2.5 text-muted">{c.type}</td>
                        <td className="px-5 py-2.5">{c.description || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {!!inv.clinicalTimeline?.length && (
                <ol className="relative space-y-3 border-t border-line p-5">
                  {inv.clinicalTimeline.map((t, k) => (
                    <li key={k} className="flex gap-3 text-sm">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      <span className="tabular w-28 shrink-0 text-muted">{fmtDate(t.date)}</span>
                      <span>{t.event}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          ) : null}

          {/* Evidence Assessment & Synthesis Engine Card */}
          <Card>
            <CardHeader
              title="Evidence Assessment & Policy Synthesis"
              action={
                analysisEngine && (
                  <div className="flex items-center gap-2">
                    {analysisEngine === 'gemini' ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <Icon name="sparkles" size={13} className="text-emerald-600 dark:text-emerald-400" />
                        Gemini AI Clinical Synthesis
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                        <Icon name="alert" size={13} className="text-amber-600 dark:text-amber-400" />
                        Clinical Rule Engine (Offline Fallback)
                      </span>
                    )}
                  </div>
                )
              }
            />
            <div className="space-y-5 p-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  Verification Status
                </p>
                <p className="mt-1 text-lg font-semibold text-heading">{vs.title}</p>
                <p className="mt-1 text-sm text-muted">{vs.text}</p>
              </div>

              {/* Classification metrics */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(Object.keys(CLASS) as Classification[]).map((k) => (
                  <div key={k} className="rounded-lg border border-line bg-sage/50 p-3 transition-colors">
                    <p className="tabular text-2xl font-bold text-heading">{counts(k)}</p>
                    <p className="mt-0.5 text-xs text-muted">{CLASS[k].label}</p>
                  </div>
                ))}
              </div>

              {/* Analysis summary */}
              {inv.summary ? (
                <div className="rounded-lg border border-line bg-card p-4">
                  <div className="flex items-center justify-between pb-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                      Synthesized Findings
                    </p>
                    {analysisEngine === 'gemini' && (
                      <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                        Verified via Google Gemini 2.5 Flash
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed text-fg">{inv.summary}</p>
                </div>
              ) : (
                <div className="rounded-lg border border-line bg-sage/30 p-4 text-sm text-muted">
                  No automated analysis generated yet. Live retrieval or manual assessment is pending.
                </div>
              )}

              <p className="text-xs text-muted">
                Source coverage: {retrievedN} of {inv.evidence.length} sources retrieved. This
                assessment aggregates classified evidence only; clinical decisions are made by human reviewers.
              </p>
            </div>
          </Card>

          {/* Evidence Collection Card */}
          <Card>
            <CardHeader
              title="Collected Evidence & Live Sources"
              desc="Real policy documents, fee schedules, and citations returned by TinyFish"
              action={
                !inv.sample && (
                  <Button size="sm" onClick={() => setAdding(true)}>
                    <Icon name="plus" size={14} />
                    Add Evidence Manually
                  </Button>
                )
              }
            />

            {/* Filter tabs */}
            <div
              role="tablist"
              aria-label="Filter evidence"
              className="flex flex-wrap gap-2 border-b border-line px-5 py-3"
            >
              {(['all', 'verified', 'unverified', 'conflicting', 'inconclusive'] as const).map(
                (k) => (
                  <button
                    key={k}
                    role="tab"
                    aria-selected={filter === k}
                    onClick={() => setFilter(k)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      filter === k
                        ? 'border-primary bg-mint text-mint-fg'
                        : 'border-line text-muted hover:bg-sage'
                    }`}
                  >
                    {k === 'all' ? `All Sources (${inv.evidence.length})` : `${CLASS[k].label} (${counts(k)})`}
                  </button>
                ),
              )}
            </div>

            {/* Live Loading Skeleton while retrieving */}
            {inv.status === 'retrieving' && !inv.evidence.length ? (
              <div className="space-y-4 p-5">
                <div className="flex items-center gap-3 text-sm text-muted">
                  <Spinner size={18} className="text-primary" />
                  <span>
                    Retrieving sources via TinyFish... ({elapsedSec !== undefined ? `${elapsedSec}s elapsed` : 'querying'})
                  </span>
                </div>
                <div className="space-y-3 pt-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="animate-pulse rounded-lg border border-line p-4 space-y-2">
                      <div className="h-4 w-3/4 rounded bg-sage" />
                      <div className="h-3 w-1/2 rounded bg-sage/60" />
                      <div className="h-10 w-full rounded bg-sage/40" />
                    </div>
                  ))}
                </div>
              </div>
            ) : shown.length === 0 ? (
              <EmptyState
                icon="sources"
                title="No Evidence Sources Recorded"
                desc={
                  inv.evidence.length
                    ? 'No evidence matches the selected classification filter.'
                    : 'Evidence sources will appear here automatically when TinyFish retrieval finishes or when added manually.'
                }
              />
            ) : (
              <ul className="divide-y divide-line">
                {shown.map((e) => (
                  <li key={e.id} className="space-y-2 p-5 hover:bg-sage/20 transition-colors">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={e.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-w-0 items-center gap-1.5 font-semibold text-primary hover:underline"
                          title="Open external source URL in new tab"
                        >
                          <span className="truncate">{e.title}</span>
                          <Icon name="external" size={13} className="shrink-0 text-muted" />
                        </a>
                        {(e.provider === 'tinyfish' || e.origin === 'live-source') && (
                          <span className="inline-flex items-center gap-1 rounded bg-mint px-2 py-0.5 text-[11px] font-semibold text-mint-fg">
                            <Icon name="sparkles" size={11} />
                            TinyFish Live Evidence
                          </span>
                        )}
                      </div>
                      <ClassChip value={e.classification} />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 font-medium text-muted">
                        <Icon name="link" size={12} className="text-primary" />
                        <span className="font-semibold text-fg">{e.publisher || 'Target Domain'}</span>
                        <span>·</span>
                        <a
                          href={e.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="break-all font-mono text-[11px] text-info hover:underline"
                        >
                          {e.url}
                        </a>
                      </div>
                      {e.summary && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(e.summary)
                            toast('success', 'Policy excerpt copied to clipboard.')
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted hover:text-fg"
                          title="Copy policy excerpt"
                        >
                          <Icon name="file" size={12} />
                          Copy Excerpt
                        </button>
                      )}
                    </div>

                    {e.summary && (
                      <div className="rounded-lg border border-line bg-card p-3.5 text-xs text-fg leading-relaxed shadow-xs border-l-3 border-l-primary/60">
                        {e.summary}
                      </div>
                    )}

                    {e.verifies && (
                      <p className="text-xs text-muted">
                        <span className="font-semibold text-fg">Verification focus: </span>
                        {e.verifies}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                      <OriginChip origin={e.origin} />
                      <RetrievalChip state={e.retrieval} />
                      <span className="tabular text-muted">
                        Published:{' '}
                        {e.published ? fmtDate(e.published) : 'Date not specified'}
                      </span>
                      {e.retrievedAt && (
                        <span className="tabular text-muted">
                          · Retrieved: {fmt(e.retrievedAt)}
                        </span>
                      )}
                      <button
                        onClick={() => setPreview(e)}
                        className="ml-auto inline-flex items-center gap-1 font-semibold text-info hover:underline"
                      >
                        <Icon name="eye" size={13} />
                        Full Details
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Right column: Claim Details, Risk, Recommendations, Decision */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Claim Details" />
            <dl className="space-y-3 p-5 text-sm">
              {[
                ['Category', inv.category],
                ['Opened', fmtDate(inv.createdAt)],
                ['Evidence Status', evidenceStatus(inv)],
                ['Provider', inv.provider],
                ['Billing Date', inv.billingDate && fmtDate(inv.billingDate)],
                ['Details', inv.details],
                ['Intake Notes', inv.reviewerNotes],
              ].map(([k, v]) =>
                v ? (
                  <div key={k}>
                    <dt className="text-xs font-medium text-muted">{k}</dt>
                    <dd className="mt-0.5 text-fg">{v}</dd>
                  </div>
                ) : null,
              )}
              {inv.sourceUrl && (
                <div>
                  <dt className="text-xs font-medium text-muted">Source URL</dt>
                  <dd className="mt-0.5">
                    <a
                      href={inv.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 break-all text-xs text-primary hover:underline"
                    >
                      {inv.sourceUrl}
                      <Icon name="external" size={11} className="shrink-0" />
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          <Card>
            <CardHeader title="Risk Indicators" />
            <div className="p-5 text-sm">
              {inv.riskIndicators.length ? (
                <ul className="space-y-2.5">
                  {inv.riskIndicators.map((r) => (
                    <li key={r} className="flex items-start gap-2 text-fg">
                      <Icon name="alert" size={16} className="mt-0.5 shrink-0 text-warn" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted">No high-risk indicators flagged for this claim.</p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Recommended Next Steps" />
            <div className="whitespace-pre-line p-5 text-sm leading-relaxed text-fg">
              {inv.recommendation ?? (
                <span className="text-muted">
                  No recommendation available until evidence has been retrieved and assessed.
                </span>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Reviewer Decision" />
            <div className="space-y-4 p-5">
              <Field label="Review Status" htmlFor="rs">
                <select
                  id="rs"
                  value={inv.status === 'retrieving' ? 'pending' : inv.status}
                  disabled={inv.status === 'retrieving'}
                  onChange={(e) =>
                    updateInvestigation(inv.id, { status: e.target.value as ReviewStatus })
                  }
                  className={inputCls}
                >
                  {(['pending', 'review', 'completed', 'failed'] as ReviewStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS[s].label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="Review Outcome"
                htmlFor="ro"
                hint="Outcomes record the reviewer's determination, not a legal finding."
              >
                <select
                  id="ro"
                  value={inv.outcome ?? 'Not determined'}
                  onChange={(e) => updateInvestigation(inv.id, { outcome: e.target.value })}
                  className={inputCls}
                >
                  {OUTCOMES.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </Field>

              <Field label="Reviewer Notes" htmlFor="rn">
                <textarea
                  id="rn"
                  rows={4}
                  value={inv.notes}
                  onChange={(e) => updateInvestigation(inv.id, { notes: e.target.value })}
                  className={inputCls}
                  placeholder="Record your findings, clinical considerations, or audit notes here..."
                />
              </Field>

              <div className="border-t border-line pt-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={async () => {
                      if (inv.archived) {
                        try {
                          await archiveInvestigation(inv.id, false)
                          toast('success', `${inv.ref} restored.`)
                        } catch (err) {
                          toast('error', err instanceof Error ? err.message : 'Restore failed.')
                        }
                      } else {
                        setConfirmArchive(true)
                      }
                    }}
                  >
                    <Icon name="archive" size={14} />
                    {inv.archived ? 'Restore' : 'Archive'}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => setConfirmDel(true)}
                  >
                    <Icon name="trash" size={14} />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {adding && <AddEvidence id={inv.id} onClose={() => setAdding(false)} />}
      {preview && (
        <EvidencePreview
          evidence={preview}
          refLabel={inv.ref}
          onClose={() => setPreview(null)}
        />
      )}
      {confirmArchive && (
        <ConfirmDialog
          title="Archive investigation"
          confirmLabel="Archive"
          body={`${inv.ref} will be hidden from the overview and default history view. You can restore it from the Archived view.`}
          onClose={() => setConfirmArchive(false)}
          onConfirm={async () => {
            try {
              await archiveInvestigation(inv.id, true)
              setConfirmArchive(false)
              toast('success', `${inv.ref} archived.`)
              navigate('/investigations')
            } catch (err) {
              toast('error', err instanceof Error ? err.message : 'Archive failed.')
            }
          }}
        />
      )}
      {confirmDel && (
        <ConfirmDialog
          danger
          title="Delete investigation"
          confirmLabel="Delete"
          body={`${inv.ref} and its evidence will be permanently deleted. This cannot be undone.`}
          onClose={() => setConfirmDel(false)}
          onConfirm={async () => {
            try {
              await removeInvestigation(inv.id)
              toast('success', `${inv.ref} deleted.`)
              navigate('/investigations')
            } catch (err) {
              toast('error', err instanceof Error ? err.message : 'Delete failed.')
            }
          }}
        />
      )}
    </>
  )
}
