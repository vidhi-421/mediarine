import { useEffect, useMemo, useState } from 'react'
import { Button, Card, EmptyState, Icon, PageHeader, Pagination, RetrievalBadge, SampleChip, STATUS, StatusChip, inputCls } from '../components/ui'
import { CATEGORIES, evidenceStatus, fmtDate, fmtMoney, retrievalStatusOf, useInvestigations, useSettings, type ReviewStatus } from '../lib/store'
import { useQuery } from '../lib/router'

type SortKey = 'createdAt' | 'ref' | 'status'

export default function History() {
  const list = useInvestigations()
  const { rowsPerPage } = useSettings()
  const urlQ = useQuery().get('q') ?? ''
  const [q, setQ] = useState(urlQ)
  const [status, setStatus] = useState<'all' | ReviewStatus>('all')
  const [cat, setCat] = useState('all')
  const [view, setView] = useState<'active' | 'archived' | 'all'>('active')
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'createdAt', dir: -1 })
  const [page, setPage] = useState(1)

  useEffect(() => {
    setQ(urlQ)
    setPage(1)
  }, [urlQ])

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    return list
      .filter((i) => view === 'all' || (view === 'archived') === !!i.archived)
      .filter((i) => (status === 'all' || i.status === status) && (cat === 'all' || i.category === cat))
      .filter((i) => !t || [i.ref, i.claim, i.summary ?? '', i.provider ?? ''].some((s) => s.toLowerCase().includes(t)))
      .sort((a, b) => {
        const av = a[sort.key], bv = b[sort.key]
        return (av < bv ? -1 : av > bv ? 1 : 0) * sort.dir
      })
  }, [list, q, status, cat, view, sort])

  const pages = Math.max(1, Math.ceil(rows.length / rowsPerPage))
  const cur = Math.min(page, pages)
  const shown = rows.slice((cur - 1) * rowsPerPage, cur * rowsPerPage)
  const filtered = q || status !== 'all' || cat !== 'all' || view !== 'active'

  const th = (key: SortKey, label: string, cls = '') => (
    <th scope="col" aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'} className={`px-5 py-2.5 text-left font-medium ${cls}`}>
      <button onClick={() => setSort({ key, dir: sort.key === key ? (-sort.dir as 1 | -1) : 1 })} className="inline-flex items-center gap-1 hover:text-fg">
        {label}
        <Icon name={sort.key === key && sort.dir === -1 ? 'down' : 'up'} size={12} className={sort.key === key ? 'opacity-100' : 'opacity-30'} />
      </button>
    </th>
  )

  return (
    <>
      <PageHeader title="Investigation History" desc="Search and filter recorded investigations." action={<a href="#/new"><Button variant="primary"><Icon name="plus" size={16} />New Investigation</Button></a>} />
      <Card>
        <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto]">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input aria-label="Search investigations" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} placeholder="Search by reference, claim, or summary" className={`${inputCls} pl-9`} />
          </div>
          <select aria-label="Filter by review status" value={status} onChange={(e) => { setStatus(e.target.value as any); setPage(1) }} className={`${inputCls} lg:w-48`}>
            <option value="all">All statuses</option>
            {(Object.keys(STATUS) as ReviewStatus[]).map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
          </select>
          <select aria-label="Filter by category" value={cat} onChange={(e) => { setCat(e.target.value); setPage(1) }} className={`${inputCls} lg:w-48`}>
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select aria-label="Record view" value={view} onChange={(e) => { setView(e.target.value as any); setPage(1) }} className={`${inputCls} lg:w-36`}>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All records</option>
          </select>
        </div>

        {shown.length === 0 ? (
          <EmptyState
            title="No Investigations Found"
            desc={filtered ? 'No records match the current search and filters.' : 'Recorded investigations will be listed here. Start by submitting a claim for review.'}
            action={filtered ? <Button onClick={() => { setQ(''); setStatus('all'); setCat('all'); setView('active') }}>Clear filters</Button> : <a href="#/new"><Button variant="primary">New Investigation</Button></a>}
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-sage text-xs text-muted">
              <tr>
                {th('ref', 'Reference')}
                <th scope="col" className="px-5 py-2.5 text-left font-medium">Claim summary</th>
                {th('createdAt', 'Date', 'hidden md:table-cell')}
                <th scope="col" className="hidden px-5 py-2.5 text-right font-medium lg:table-cell">Billed</th>
                <th scope="col" className="hidden px-5 py-2.5 text-left font-medium xl:table-cell">Retrieval</th>
                <th scope="col" className="hidden px-5 py-2.5 text-left font-medium xl:table-cell">Evidence status</th>
                {th('status', 'Review status')}
                <th scope="col" className="px-5 py-2.5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((i) => (
                <tr key={i.id} className="hover:bg-sage">
                  <td className="tabular whitespace-nowrap px-5 py-3.5 align-top font-medium"><a href={`#/investigations/${i.id}`} className="text-primary hover:underline">{i.ref}</a></td>
                  <td className="px-5 py-3.5 align-top">
                    <p className="line-clamp-2">{i.claim}</p>
                    <p className="mt-1 text-xs text-muted">{i.category} <span className="md:hidden">· {fmtDate(i.createdAt)}</span></p>
                    <div className="mt-1.5 flex gap-1.5">{i.sample && <SampleChip />}{i.archived && <span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted">Archived</span>}</div>
                  </td>
                  <td className="tabular hidden whitespace-nowrap px-5 py-3.5 align-top text-muted md:table-cell">{fmtDate(i.createdAt)}</td>
                  <td className="tabular hidden whitespace-nowrap px-5 py-3.5 text-right align-top lg:table-cell">{fmtMoney(i.billedAmount)}</td>
                  <td className="hidden px-5 py-3.5 align-top xl:table-cell"><RetrievalBadge status={retrievalStatusOf(i)} /></td>
                  <td className="hidden whitespace-nowrap px-5 py-3.5 align-top text-muted xl:table-cell">{evidenceStatus(i)}</td>
                  <td className="px-5 py-3.5 align-top"><StatusChip status={i.status} /></td>
                  <td className="px-5 py-3.5 text-right align-top"><a href={`#/investigations/${i.id}/report`} title={`View report for ${i.ref}`} aria-label={`View report for ${i.ref}`} className="inline-grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-card hover:text-primary"><Icon name="file" size={16} /></a></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={cur} pages={pages} total={rows.length} perPage={rowsPerPage} onPage={setPage} />
      </Card>
    </>
  )
}
