import { fmtDate, fmtMoney, retrievalStatusOf, type Evidence, type Investigation } from './store'
import { RETRIEVAL_LABEL, type RetrievalStatus } from './tinyfish'

export type StageState =
  | 'not_started'
  | 'queued'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'done'
  | 'active'
  | 'error'
  | 'waiting'

export interface Stage {
  key: string
  label: string
  note: string
  state: StageState
  status?: string
}

const CLASS_LABEL = { verified: 'Verified fact', unverified: 'Unverified claim', conflicting: 'Conflicting evidence', inconclusive: 'Inconclusive' }
const REVIEW_LABEL = { pending: 'Pending review', review: 'Review required', completed: 'Completed', retrieving: 'Retrieving sources', failed: 'Retrieval failed' }

/** Questions derived only from the fields recorded on the claim. */
export function verificationQuestions(inv: Investigation): string[] {
  const q: string[] = []
  if (inv.provider) q.push(`Is ${inv.provider} enrolled and eligible to bill for the services claimed?`)
  for (const c of inv.billingCodes ?? []) {
    if (c.type === 'ICD-10') q.push(`Does diagnosis ${c.code} support the services billed?`)
    else q.push(`Does published guidance support billing ${c.type} ${c.code}${c.description ? ` (${c.description})` : ''} in this context?`)
  }
  if (inv.serviceDateFrom) q.push(`Are the services consistent with the dates of service ${fmtDate(inv.serviceDateFrom)}${inv.serviceDateTo && inv.serviceDateTo !== inv.serviceDateFrom ? ` to ${fmtDate(inv.serviceDateTo)}` : ''}?`)
  if (inv.billedAmount != null) q.push(`Is the billed amount of ${fmtMoney(inv.billedAmount)} consistent with the services documented?`)
  if (!q.length) q.push(`Is the claim statement supported by a citable public source?`)
  return q
}

export const tinyfishEvidence = (inv: Investigation) => (inv.evidence ?? []).filter((e) => e.provider === 'tinyfish')

export function workflow(inv: Investigation, hasSavedReport: boolean): Stage[] {
  const rs = retrievalStatusOf(inv)
  const tf = tinyfishEvidence(inv)
  const evidence = inv.evidence ?? []
  const classified = evidence.filter((e) => e.retrieval !== 'failed')
  const decided = Boolean((inv.outcome && inv.outcome !== 'Not determined') || inv.status === 'completed')

  // Stage 3: Retrieval State
  let retrievalState: StageState = 'not_started'
  let retrievalStatus = 'Not Started'
  let retrievalNote = 'Not started — click Retrieve Evidence to start live search'

  if (rs === 'completed') {
    retrievalState = 'completed'
    retrievalStatus = 'Completed'
    retrievalNote = `${tf.length} live source${tf.length === 1 ? '' : 's'} retrieved`
  } else if (rs === 'retrieving') {
    retrievalState = 'in_progress'
    retrievalStatus = 'In Progress'
    retrievalNote = inv.retrieval?.message || 'Connecting to TinyFish live-web research agent...'
  } else if (rs === 'queued') {
    retrievalState = 'queued'
    retrievalStatus = 'Queued'
    retrievalNote = 'Queued in retrieval pipeline'
  } else if (rs === 'failed' || rs === 'not_configured') {
    retrievalState = 'failed'
    retrievalStatus = 'Failed'
    retrievalNote = inv.retrieval?.message || inv.retrievalError || 'Source retrieval failed. Click Retry to run again.'
  }

  // Stage 4: Collection State
  const collectionState: StageState = evidence.length > 0 ? 'completed' : rs === 'retrieving' ? 'in_progress' : 'not_started'
  const collectionStatus = evidence.length > 0 ? 'Completed' : rs === 'retrieving' ? 'In Progress' : 'Not Started'
  const collectionNote = evidence.length > 0
    ? `${evidence.length} source${evidence.length === 1 ? '' : 's'} on record`
    : rs === 'retrieving' ? 'Collecting live sources...' : 'No sources recorded'

  // Stage 5: Comparison / Evidence Analysis State
  const comparisonState: StageState = (classified.length > 0 || Boolean(inv.summary)) ? 'completed' : rs === 'retrieving' ? 'in_progress' : 'not_started'
  const comparisonStatus = (classified.length > 0 || Boolean(inv.summary)) ? 'Completed' : rs === 'retrieving' ? 'In Progress' : 'Not Started'
  const comparisonNote = classified.length > 0
    ? `${classified.length} source${classified.length === 1 ? '' : 's'} classified and analyzed`
    : inv.summary ? 'Clinical summary generated' : rs === 'retrieving' ? 'Analyzing retrieved sources...' : 'No evidence to analyse'

  // Stage 6: Risk Assessment State
  const riskState: StageState = decided ? 'completed' : classified.length > 0 ? 'in_progress' : 'not_started'
  const riskStatus = decided ? 'Completed' : classified.length > 0 ? 'In Progress' : 'Not Started'
  const riskNote = decided
    ? `Reviewer outcome: ${inv.outcome}`
    : classified.length > 0 ? 'Awaiting reviewer determination' : 'Awaiting evidence analysis'

  // Stage 7: Investigation Report State
  const reportState: StageState = hasSavedReport ? 'completed' : decided ? 'in_progress' : 'not_started'
  const reportStatus = hasSavedReport ? 'Completed' : decided ? 'In Progress' : 'Not Started'
  const reportNote = hasSavedReport
    ? 'Report saved to Supabase'
    : decided ? 'Draft report ready — click Save Report' : 'Not yet saved'

  const questionsCount = verificationQuestions(inv).length

  return [
    { key: 'intake', label: 'Claim Submitted', note: `Recorded ${fmtDate(inv.createdAt)}`, state: 'completed', status: 'Completed' },
    { key: 'questions', label: 'Verification Questions', note: `${questionsCount} derived from claim fields`, state: 'completed', status: 'Completed' },
    { key: 'retrieval', label: 'TinyFish Live-Web Investigation', note: retrievalNote, state: retrievalState, status: retrievalStatus },
    { key: 'collection', label: 'Evidence Collection', note: collectionNote, state: collectionState, status: collectionStatus },
    { key: 'comparison', label: 'Evidence Analysis', note: comparisonNote, state: comparisonState, status: comparisonStatus },
    { key: 'risk', label: 'Risk Assessment', note: riskNote, state: riskState, status: riskStatus },
    { key: 'report', label: 'Investigation Report', note: reportNote, state: reportState, status: reportStatus },
  ]
}

export interface TinyfishSection { status?: RetrievalStatus; label: string; message: string; retrievedAt?: string; sources: Evidence[] }

export function tinyfishSection(inv: Investigation): TinyfishSection {
  const status = retrievalStatusOf(inv)
  const sources = tinyfishEvidence(inv)
  const retrievedAt = inv.retrieval?.completedAt ?? sources[0]?.retrievedAt
  let message: string
  if (sources.length) message = `${sources.length} source${sources.length === 1 ? '' : 's'} returned by a TinyFish live-web request.`
  else if (status === 'retrieving' || status === 'queued') message = 'Evidence retrieval pending.'
  else if (status === 'not_configured') message = 'No evidence retrieved. TinyFish is not configured for this workspace.'
  else if (status === 'failed') message = `No evidence retrieved. ${inv.retrieval?.message ?? inv.retrievalError ?? 'The retrieval request failed.'}`
  else if (status === 'completed') message = 'No evidence retrieved. The TinyFish request completed but returned no sources.'
  else message = 'Evidence retrieval pending. TinyFish retrieval has not been run for this investigation.'
  return { status, label: status ? RETRIEVAL_LABEL[status] : 'Not run', message, retrievedAt, sources }
}

export interface Finding { title: string; detail: string; evidence?: Evidence }
export interface Findings { supported: Finding[]; conflicting: Finding[]; unverified: Finding[]; risks: Finding[] }

const basis = (e: Evidence) => `${e.provider === 'tinyfish' ? 'TinyFish live-web source' : e.origin === 'user-provided' ? 'Reviewer-provided source' : 'Recorded source'}: ${e.title} (${e.publisher}).`

export function findings(inv: Investigation): Findings {
  const f = (e: Evidence): Finding => ({ title: e.verifies ? `${e.verifies}` : e.title, detail: `${e.summary || 'No summary recorded.'} ${basis(e)}`, evidence: e })
  const evidence = inv.evidence ?? []
  const riskIndicators = inv.riskIndicators ?? []
  const by = (k: Evidence['classification'][]) => evidence.filter((e) => k.includes(e.classification) && e.retrieval !== 'failed').map(f)
  const conflicting = evidence.filter((e) => e.classification === 'conflicting')
  return {
    supported: by(['verified']),
    conflicting: by(['conflicting']),
    unverified: by(['unverified', 'inconclusive']),
    risks: riskIndicators.map((r) => ({
      title: r,
      detail: conflicting.length ? `Recorded on the investigation. Related conflicting evidence: ${conflicting.map((e) => e.title).join('; ')}.` : 'Recorded on the investigation; not linked to a specific source.',
    })),
  }
}

export const reviewLabel = (inv: Investigation) => REVIEW_LABEL[inv.status]
export const classLabel = (e: Evidence) => CLASS_LABEL[e.classification]

const STAGE_MARK = { done: 'Complete', active: 'In progress', error: 'Stopped', waiting: 'Not started' }

/** Builds the complete report as a text-based PDF (not a screenshot). */
export async function exportReportPdf(inv: Investigation, reviewer: string, generatedAt = new Date().toISOString(), hasSavedReport = false) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 48
  const green: [number, number, number] = [46, 61, 40]
  const ink: [number, number, number] = [46, 61, 40]
  const muted: [number, number, number] = [101, 112, 91]
  let y = M

  const ensure = (h: number) => { if (y + h > H - M) { doc.addPage(); y = M } }
  const heading = (t: string) => {
    ensure(44); y += 12
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...green).text(t.toUpperCase(), M, y)
    y += 6; doc.setDrawColor(214, 220, 203).line(M, y, W - M, y); y += 14
  }
  const sub = (t: string) => { ensure(20); doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...ink).text(t, M, y); y += 14 }
  const para = (t: string, size = 10, color = ink, indent = 0) => {
    doc.setFont('helvetica', 'normal').setFontSize(size).setTextColor(...color)
    ;(doc.splitTextToSize(t, W - M * 2 - indent) as string[]).forEach((l) => { ensure(14); doc.text(l, M + indent, y); y += size + 4 })
  }
  const table = (head: string[], body: string[][], widths?: Record<number, number>) => {
    autoTable(doc, {
      startY: y, head: [head], body, margin: { left: M, right: M },
      styles: { fontSize: 8.5, cellPadding: 5, textColor: ink, overflow: 'linebreak' },
      headStyles: { fillColor: green, textColor: 255 }, alternateRowStyles: { fillColor: [241, 242, 233] },
      columnStyles: Object.fromEntries(Object.entries(widths ?? {}).map(([k, v]) => [k, { cellWidth: v }])),
    })
    y = (doc as any).lastAutoTable.finalY + 10
  }

  doc.setFillColor(...green).rect(0, 0, W, 6, 'F')
  doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(...green).text('Medarina', M, y + 10)
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...muted).text('Claim Investigation Report', M, y + 24)
  doc.text([`Case ${inv.ref}`, `Generated ${new Date(generatedAt).toLocaleString('en-US')}`], W - M, y + 10, { align: 'right' })
  y += 44
  if (inv.sample) para('Sample investigation: contains illustrative example data, not live results.', 9, muted)

  heading('Investigation workflow')
  table(['Stage', 'Status', 'Detail'], workflow(inv, hasSavedReport).map((s) => [s.label, STAGE_MARK[s.state], s.note]))

  heading('Claim summary')
  para(inv.claim, 11); y += 4
  table(['Field', 'Value'], [
    ['Category', inv.category], ['Provider', inv.provider ?? '—'], ['Opened', fmtDate(inv.createdAt)],
    ['Service dates', inv.serviceDateFrom ? `${fmtDate(inv.serviceDateFrom)} to ${fmtDate(inv.serviceDateTo)}` : '—'],
    ['Billing date', fmtDate(inv.billingDate)], ['Billed amount', fmtMoney(inv.billedAmount)],
    ['Review status', reviewLabel(inv)], ['Review outcome', inv.outcome ?? 'Not determined'],
  ], { 0: 120 })
  if (inv.details) para(inv.details)

  if (inv.billingCodes?.length) { heading('Billing codes'); table(['Code', 'Type', 'Description'], inv.billingCodes.map((c) => [c.code, c.type, c.description || '—']), { 0: 70, 1: 60 }) }
  if (inv.clinicalTimeline?.length) { heading('Clinical timeline'); table(['Date', 'Event'], inv.clinicalTimeline.map((t) => [fmtDate(t.date), t.event]), { 0: 90 }) }

  heading('Verification questions')
  verificationQuestions(inv).forEach((q, i) => para(`${i + 1}. ${q}`))

  const tf = tinyfishSection(inv)
  heading('TinyFish live-web evidence')
  table(['Integration status', 'Retrieved'], [[tf.label, tf.retrievedAt ? new Date(tf.retrievedAt).toLocaleString('en-US') : '—']])
  para(tf.message)
  if (tf.sources.length) { y += 4; table(['Source', 'Evidence summary', 'Helps verify'], tf.sources.map((e) => [`${e.title}\n${e.url}`, e.summary || '—', e.verifies || 'Not specified by source']), { 0: 170, 2: 110 }) }

  const other = inv.evidence.filter((e) => e.provider !== 'tinyfish')
  if (other.length) {
    heading('Other recorded evidence')
    para('Not retrieved by TinyFish. Includes reviewer-provided and previously recorded sources.', 9, muted)
    table(['Source', 'Origin', 'Classification', 'Summary'], other.map((e) => [`${e.title}\n${e.url}`, e.origin === 'user-provided' ? 'Reviewer-provided' : e.origin === 'ai-summary' ? 'AI summary' : 'Recorded source', classLabel(e), e.summary || '—']), { 0: 150 })
  }

  heading('Findings')
  const fs = findings(inv)
  const group = (title: string, list: Finding[], empty: string) => {
    sub(`${title} (${list.length})`)
    if (!list.length) para(empty, 9, muted, 10)
    list.forEach((f) => { para(`- ${f.title}`, 10, ink, 10); para(f.detail, 9, muted, 20); y += 2 })
    y += 4
  }
  group('Supported information', fs.supported, 'No information is supported by recorded evidence.')
  group('Conflicting information', fs.conflicting, 'No conflicting evidence recorded.')
  group('Unverified details', fs.unverified, 'No unverified or inconclusive evidence recorded.')
  group('Potential risk indicators', fs.risks, 'No risk indicators recorded.')
  para('Findings summarize recorded evidence only. No fraud determination or risk score is assigned by Medarina.', 8.5, muted)
  if (inv.recommendation) { sub('Recommended next steps'); para(inv.recommendation) }

  heading('Review status and outcome')
  table(['Review status', 'Review outcome'], [[reviewLabel(inv), inv.outcome ?? 'Not determined']])

  heading('Reviewer notes')
  para([inv.reviewerNotes, inv.notes].filter(Boolean).join('\n\n') || 'No notes recorded.')

  ensure(90); y += 50
  doc.setDrawColor(150).line(M, y, M + 200, y).line(W - M - 200, y, W - M, y)
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...muted).text(`Reviewer: ${reviewer}`, M, y + 14).text('Date', W - M - 200, y + 14)
  y += 34
  para('This report summarizes evidence gathered for review. It is not a determination of fraud.', 8, muted)

  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...muted).text(`Medarina · ${inv.ref} · Page ${p} of ${pages}`, W / 2, H - 24, { align: 'center' })
  }
  doc.save(`Medarina-${inv.ref}.pdf`)
}
