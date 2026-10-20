import { useMemo, useState } from 'react'
import { Button, Card, ClassChip, EmptyState, Icon, Notice, OriginChip, PageHeader, Pagination, RetrievalChip, SampleChip, inputCls } from '../components/ui'
import EvidencePreview from '../components/EvidencePreview'
import { fmtDate, runRetrieval, useInvestigations, useSettings, type Evidence, type Origin, type RetrievalState } from '../lib/store'

export default function Sources() {
  const list = useInvestigations()
  const { retrievalEndpoint, rowsPerPage } = useSettings()
  const [q, setQ] = useState('')
  const [origin, setOrigin] = useState<'all' | Origin>('all')
  const [ret, setRet] = useState<'all' | RetrievalState>('all')
  const [page, setPage] = useState(1)

  const [preview, setPreview] = useState<{ e: Evidence; ref: string } | null>(null)
  const all = useMemo(() => list.flatMap((inv) => inv.evidence.map((e) => ({ ...e, inv }))), [list])
  const failedInv = list.filter((i) => i.status === 'failed')
  const rows = all.filter((e) => (origin === 'all' || e.origin === origin) && (ret === 'all' || e.retrieval === ret) && (!q.trim() || (e.title + e.publisher + e.url + e.summary).toLowerCase().includes(q.trim().toLowerCase())))
  const pages = Math.max(1, Math.ceil(rows.length / rowsPerPage))
  const cur = Math.min(page, pages)
  const view = rows.slice((cur - 1) * rowsPerPage, cur * rowsPerPage)
  const reset = () => setPage(1)

  return (
    <>
      <PageHeader title="Evidence Management" desc="Source verification: provenance, retrieval status, and summaries for every source cited across investigations." />

      <div className="mb-6 space-y-3">
        {!retrievalEndpoint && (
          <Notice tone="warn" title="Retrieval service not connected" action={<a href="#/settings"><Button size="sm">Open Settings</Button></a>}>
            Live source retrieval is unavailable. Sources below were added manually or come from illustrative samples.
          </Notice>
        )}
        {failedInv.length > 0 && (
          <Notice tone="error" title={`Source Retrieval Failed for ${failedInv.length} investigation${failedInv.length > 1 ? 's' : ''}`}>
            {failedInv.slice(0, 3).map((i) => (
              <span key={i.id} className="mt-1 flex flex-wrap items-center gap-2">
                <a href={`#/investigations/${i.id}`} className="tabular font-medium text-fg hover:underline">{i.ref}</a>
                <span className="min-w-0 flex-1 basis-60">{i.retrievalError}</span>
                {!i.sample && <Button size="sm" onClick={() => runRetrieval(i.id)}><Icon name="refresh" size={14} />Retry</Button>}
              </span>
            ))}
          </Notice>
        )}
      </div>

      <Card>
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input aria-label="Search sources" value={q} onChange={(e) => { setQ(e.target.value); reset() }} placeholder="Search sources" className={`${inputCls} pl-9`} />
          </div>
          <select aria-label="Filter by origin" value={origin} onChange={(e) => { setOrigin(e.target.value as any); reset() }} className={`${inputCls} sm:w-52`}>
            <option value="all">All origins</option>
            <option value="live-source">Live source retrieval</option>
            <option value="ai-summary">AI-generated summary</option>
            <option value="user-provided">Reviewer-provided</option>
          </select>
          <select aria-label="Filter by retrieval status" value={ret} onChange={(e) => { setRet(e.target.value as any); reset() }} className={`${inputCls} sm:w-48`}>
            <option value="all">All retrieval states</option>
            <option value="retrieved">Retrieved</option>
            <option value="failed">Retrieval failed</option>
            <option value="not_attempted">Not retrieved</option>
          </select>
        </div>

        {view.length === 0 ? (
          <EmptyState icon="sources" title="No Sources Found" desc={all.length ? 'No sources match the current filters.' : 'Sources appear here once evidence is retrieved or added to an investigation.'} />
        ) : (
          <ul className="divide-y divide-line">
            {view.map((e) => (
              <li key={e.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <a href={e.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-medium text-info hover:underline">
                      {e.title}<Icon name="external" size={13} />
                    </a>
                    <p className="tabular mt-0.5 break-all text-xs text-muted">{e.publisher} · {e.url}</p>
                  </div>
                  <RetrievalChip state={e.retrieval} />
                </div>
                <p className="mt-2 text-sm text-muted">{e.summary || 'No summary available.'}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <OriginChip origin={e.origin} />
                  <ClassChip value={e.classification} />
                  <span className="tabular text-xs text-muted">Published: {e.published ? fmtDate(e.published) : 'not available'}</span>
                  <span className="text-xs text-muted">·</span>
                  <a href={`#/investigations/${e.inv.id}`} className="tabular text-xs font-medium hover:underline">{e.inv.ref}</a>
                  {e.inv.sample && <SampleChip compact />}
                  <button onClick={() => setPreview({ e, ref: e.inv.ref })} className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-info hover:underline"><Icon name="eye" size={13} />Preview</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Pagination page={cur} pages={pages} total={rows.length} perPage={rowsPerPage} onPage={setPage} />
      </Card>
      {preview && <EvidencePreview evidence={preview.e} refLabel={preview.ref} onClose={() => setPreview(null)} />}
    </>
  )
}
