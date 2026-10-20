import { useSyncExternalStore } from 'react'
import { toast } from './toast'
import { getConfig, retrieveEvidence, type RetrievalStatus } from './tinyfish'

export type Classification = 'verified' | 'unverified' | 'conflicting' | 'inconclusive'
export type Origin = 'live-source' | 'ai-summary' | 'user-provided'
export type RetrievalState = 'retrieved' | 'failed' | 'not_attempted'
export type ReviewStatus = 'pending' | 'review' | 'completed' | 'retrieving' | 'failed'

export interface Evidence {
  id: string
  title: string
  url: string
  publisher: string
  published?: string
  retrieval: RetrievalState
  origin: Origin
  classification: Classification
  summary: string
  retrievedAt?: string
  /** Set only when the item was returned by a TinyFish live-web request. */
  provider?: 'tinyfish'
  /** Claim detail this source helps verify, as reported by the retrieval service. */
  verifies?: string
}

export type CodeType = 'CPT' | 'ICD-10' | 'HCPCS'
export interface BillingCode {
  code: string
  type: CodeType
  description: string
}
export interface TimelineEvent {
  date: string
  event: string
}
export interface RetrievalRun {
  status: RetrievalStatus
  startedAt?: string
  completedAt?: string
  message?: string
}

export interface Investigation {
  id: string
  ref: string
  createdAt: string
  claim: string
  category: string
  details: string
  provider?: string
  sourceUrl?: string
  status: ReviewStatus
  sample?: boolean
  summary?: string
  evidence: Evidence[]
  riskIndicators: string[]
  recommendation?: string
  notes: string
  retrievalError?: string
  outcome?: string
  archived?: boolean
  serviceDateFrom?: string
  serviceDateTo?: string
  billingDate?: string
  billedAmount?: number
  billingCodes?: BillingCode[]
  clinicalTimeline?: TimelineEvent[]
  reviewerNotes?: string
  retrieval?: RetrievalRun
  savedReports?: SavedReport[]
}

/** Point-in-time copy of an investigation report, kept in investigation history. */
export interface SavedReport {
  id: string
  generatedAt: string
  reviewStatus: ReviewStatus
  outcome: string
  snapshot: Omit<Investigation, 'savedReports'>
}

export type ThemePref = 'system' | 'light' | 'dark'
export interface Settings {
  theme: ThemePref
  retrievalEndpoint: string
  displayName: string
  organization: string
  role: string
  rowsPerPage: number
  sidebarCollapsed: boolean
  readNotifications: string[]
  tinyfishApiKey: string
  lastRetrievalAt?: string
  lastRetrievalError?: string
}

export const OUTCOMES = ['Not determined', 'Further Review Required', 'No Further Action', 'Escalated for Compliance Review']

export const CATEGORIES = [
  'Billing and Coding',
  'Coverage and Eligibility',
  'Medical Necessity',
  'Provider Credentials',
  'Device and Product Claims',
  'Public Health Statement',
  'Other',
]

const DAY = 86400000
const ago = (d: number) => new Date(Date.now() - d * DAY).toISOString()
const ev = (
  n: number,
  title: string,
  url: string,
  publisher: string,
  classification: Classification,
  summary: string,
  published?: string,
  retrieval: RetrievalState = 'retrieved',
  origin: Origin = 'live-source',
): Evidence => ({
  id: `sample-ev-${n}-${title.length}`,
  title,
  url,
  publisher,
  published,
  retrieval,
  origin,
  classification,
  summary,
})

function extraSamples(): Investigation[] {
  const base = { notes: '', sample: true, evidence: [] as Evidence[], riskIndicators: [] as string[] }
  return [
    {
      ...base,
      id: 'sample-9',
      ref: 'CLM-2026-0421',
      createdAt: ago(0.5),
      claim: 'Identical claims for a knee arthroscopy were submitted twice for the same member and date of service.',
      category: 'Billing and Coding',
      details: 'Second submission arrived 6 days after the first with a different claim number but identical line items.',
      provider: 'Lakeside Orthopedic Associates',
      status: 'review',
      serviceDateFrom: '2026-01-14',
      serviceDateTo: '2026-01-14',
      billingDate: '2026-01-20',
      billedAmount: 4820,
      billingCodes: [
        { code: '29881', type: 'CPT', description: 'Arthroscopy, knee, surgical; with meniscectomy' },
        { code: 'M23.221', type: 'ICD-10', description: 'Derangement of posterior horn of medial meniscus, right knee' },
      ],
      clinicalTimeline: [
        { date: '2026-01-02', event: 'Orthopedic consultation; MRI ordered' },
        { date: '2026-01-14', event: 'Outpatient arthroscopic procedure performed' },
        { date: '2026-01-20', event: 'Second claim submitted with identical line items' },
      ],
      summary: 'Two claims share the same member, date of service, and procedure code. No corrected-claim indicator was located.',
      evidence: [ev(14, 'Duplicate claim submission guidance', 'https://www.cms.gov', 'CMS', 'verified', 'Duplicate submissions for the same service are denied unless marked as corrected or replacement claims.', '2025-05-02')],
      riskIndicators: ['Duplicate line items across two claim numbers', 'No corrected-claim frequency code'],
      recommendation: 'Confirm whether the second submission is a replacement claim before any payment.',
      outcome: 'Further Review Required',
    },
    {
      ...base,
      id: 'sample-10',
      ref: 'CLM-2026-0418',
      createdAt: ago(3),
      claim: 'Highest-complexity office visit (99215) billed for a routine medication refill appointment.',
      category: 'Billing and Coding',
      details: 'Visit note is brief and documents a stable chronic condition with no medication changes.',
      provider: 'Northgate Internal Medicine',
      status: 'pending',
      serviceDateFrom: '2026-02-03',
      serviceDateTo: '2026-02-03',
      billingDate: '2026-02-05',
      billedAmount: 312,
      billingCodes: [
        { code: '99215', type: 'CPT', description: 'Office visit, established patient, high complexity' },
        { code: 'I10', type: 'ICD-10', description: 'Essential (primary) hypertension' },
      ],
      clinicalTimeline: [{ date: '2026-02-03', event: '15-minute follow-up; refill issued, no changes' }],
      reviewerNotes: 'Compare against documented medical decision making.',
    },
    {
      ...base,
      id: 'sample-11',
      ref: 'CLM-2026-0415',
      createdAt: ago(5),
      claim: 'Individual lab tests billed separately when they were performed as part of a comprehensive metabolic panel.',
      category: 'Billing and Coding',
      details: 'Eight component chemistry codes billed on one date instead of the panel code.',
      provider: 'Summit Diagnostic Laboratory',
      status: 'review',
      serviceDateFrom: '2026-01-27',
      serviceDateTo: '2026-01-27',
      billingDate: '2026-01-29',
      billedAmount: 486.5,
      billingCodes: [
        { code: '82947', type: 'CPT', description: 'Glucose; quantitative, blood' },
        { code: '82565', type: 'CPT', description: 'Creatinine; blood' },
        { code: '84295', type: 'CPT', description: 'Sodium; serum, plasma or whole blood' },
        { code: '80053', type: 'CPT', description: 'Comprehensive metabolic panel (expected)' },
      ],
      summary: 'Component tests match the panel definition; bundling guidance indicates the panel code should be reported.',
      evidence: [ev(15, 'Organ or disease-oriented panel coding rules', 'https://www.cms.gov', 'CMS', 'verified', 'When all component tests of a panel are performed, the panel code is reported instead of individual codes.', '2025-01-01')],
      riskIndicators: ['Possible unbundling of panel components'],
      recommendation: 'Request the lab requisition to confirm whether a panel was ordered.',
      outcome: 'Further Review Required',
    },
    {
      ...base,
      id: 'sample-12',
      ref: 'CLM-2026-0402',
      createdAt: ago(8),
      claim: 'Power wheelchair billed without a documented face-to-face mobility evaluation.',
      category: 'Medical Necessity',
      details: 'Durable medical equipment claim; written order present, evaluation note missing from submission.',
      provider: 'Coastal Home Medical Supply',
      status: 'failed',
      serviceDateFrom: '2026-01-08',
      serviceDateTo: '2026-01-08',
      billingDate: '2026-01-12',
      billedAmount: 6150,
      billingCodes: [
        { code: 'K0823', type: 'HCPCS', description: 'Power wheelchair, group 2 standard, captain chair' },
        { code: 'G82.20', type: 'ICD-10', description: 'Paraplegia, unspecified' },
      ],
      retrievalError: 'The TinyFish service did not respond within 20 seconds.',
      retrieval: { status: 'failed', message: 'The TinyFish service did not respond within 20 seconds.' },
    },
  ]
}

function sampleData(): Investigation[] {
  const base = { notes: '', sample: true, evidence: [] as Evidence[], riskIndicators: [] as string[] }
  return [
    {
      ...base,
      id: 'sample-0',
      ref: 'CLM-2026-0001',
      createdAt: ago(1),
      claim: 'Outpatient clinic billed a comprehensive evaluation code and a separate brief follow-up code for the same patient on one date of service.',
      category: 'Billing and Coding',
      details: 'Both codes were submitted by the same practitioner. The claim narrative describes a single visit lasting about 40 minutes. Reviewer is checking whether the two codes may be reported together.',
      provider: 'Harborview Family Clinic',
      sourceUrl: 'https://www.cms.gov',
      status: 'pending',
      outcome: 'Further Review Required',
      summary: 'Retrieved guidance generally restricts reporting two evaluation codes for one encounter, but one payer policy allows it with a modifier. Whether a modifier was submitted is not shown in the available claim details, so the evidence is not sufficient to reach a conclusion.',
      evidence: [
        ev(11, 'Evaluation and management services billing guidance', 'https://www.cms.gov', 'CMS', 'verified', 'Guidance states that services provided during a single encounter are generally reported with one evaluation code unless the services are separately identifiable.', '2025-07-11'),
        ev(12, 'Payer policy: same-day evaluation services', 'https://www.hhs.gov', 'Payer policy library', 'conflicting', 'Policy permits a second evaluation code on the same date when a modifier documents a distinct service.', '2025-10-03'),
        ev(13, 'Clinic service description page', 'https://www.hhs.gov', 'Provider website', 'unverified', 'Page describes same-day follow-up visits but does not state how they are billed.', undefined, 'retrieved', 'ai-summary'),
      ],
      riskIndicators: ['Two evaluation codes reported for one date of service', 'Modifier use not visible in the available claim details'],
      recommendation: '1. Obtain the complete claim line items, including any modifiers.\n2. Confirm which payer policy version applies to the date of service.\n3. Request encounter documentation if the modifier is present.\n4. Record the reviewer determination after the documents are received.',
      notes: 'Sample investigation demonstrating the full review workflow.',
    },
    {
      ...base,
      id: 'sample-1',
      outcome: 'Further Review Required',
      ref: 'CLM-2026-0412',
      createdAt: ago(2),
      claim: 'Provider billed 11 units of therapeutic exercise for one patient on a single date of service.',
      category: 'Billing and Coding',
      details: 'Outpatient rehabilitation claim. Units exceed the range typically seen for a single session.',
      provider: 'Riverside Rehabilitation Group',
      status: 'review',
      summary: 'Unit count appears high relative to published guidance; documentation of timed minutes was not located.',
      evidence: [
        ev(1, 'Medicare billing guidance for timed procedure codes', 'https://www.cms.gov', 'CMS', 'verified', 'Timed codes are reported in 15-minute units based on direct treatment time.', '2025-03-14'),
        ev(2, 'Payer policy bulletin on rehabilitation services', 'https://www.cms.gov', 'Payer policy library', 'conflicting', 'Bulletin permits higher unit counts when treatment is documented across extended sessions.', '2025-09-02'),
        ev(3, 'Provider website service description', 'https://www.hhs.gov', 'Provider website', 'unverified', 'Describes session lengths but does not state billed units.', undefined, 'retrieved', 'ai-summary'),
      ],
      riskIndicators: ['Billed units exceed typical per-session range', 'Timed-minute documentation not located', 'Conflicting payer guidance'],
      recommendation: 'Request treatment time documentation from the provider and confirm the applicable payer policy version.',
    },
    {
      ...base,
      id: 'sample-2',
      outcome: 'No Further Action',
      ref: 'CLM-2026-0409',
      createdAt: ago(4),
      claim: 'Remote patient monitoring is covered for members with chronic hypertension.',
      category: 'Coverage and Eligibility',
      details: 'Coverage question raised during pre-payment review.',
      status: 'completed',
      summary: 'Published coverage criteria support the claim, subject to enrollment and documentation requirements.',
      evidence: [
        ev(4, 'Remote physiologic monitoring coverage overview', 'https://www.cms.gov', 'CMS', 'verified', 'Coverage applies when monitoring is ordered and documented by a billing practitioner.', '2025-11-20'),
        ev(5, 'Plan benefit summary', 'https://www.hhs.gov', 'Health plan', 'verified', 'Benefit summary lists remote monitoring as a covered service with prior authorization.', '2026-01-08'),
      ],
      riskIndicators: [],
      recommendation: 'No further action. Retain evidence with the claim file.',
      notes: 'Confirmed against plan benefit summary.',
    },
    {
      ...base,
      id: 'sample-3',
      ref: 'CLM-2026-0405',
      createdAt: ago(6),
      claim: 'Practitioner is listed as board-certified in cardiology.',
      category: 'Provider Credentials',
      details: 'Credential statement appears on claim cover letter.',
      status: 'pending',
    },
    {
      ...base,
      id: 'sample-4',
      ref: 'CLM-2026-0398',
      createdAt: ago(9),
      claim: 'Manufacturer states the monitoring device holds regulatory clearance for home use.',
      category: 'Device and Product Claims',
      details: 'Statement taken from product marketing material.',
      status: 'failed',
      retrievalError: 'The regulatory database did not respond before the request timed out.',
      evidence: [ev(6, 'Regulatory device database entry', 'https://www.fda.gov', 'FDA', 'inconclusive', 'Source could not be retrieved.', undefined, 'failed')],
    },
    {
      ...base,
      id: 'sample-5',
      ref: 'CLM-2026-0391',
      createdAt: ago(13),
      claim: 'Diagnostic imaging was medically necessary following a routine annual visit.',
      category: 'Medical Necessity',
      details: 'Imaging ordered without a documented symptom in the submitted notes.',
      status: 'completed',
      summary: 'Retrieved guidance neither confirms nor excludes necessity; clinical records were not available.',
      evidence: [ev(7, 'Imaging appropriateness guidance', 'https://www.hhs.gov', 'HHS', 'inconclusive', 'Guidance depends on clinical presentation that is not present in the available documents.', '2024-06-30')],
      riskIndicators: ['Clinical record not available for review'],
      recommendation: 'Request clinical notes from the ordering practitioner.',
      notes: 'Closed as inconclusive pending records.',
    },
    {
      ...base,
      id: 'sample-6',
      outcome: 'Further Review Required',
      ref: 'CLM-2026-0386',
      createdAt: ago(17),
      claim: 'Clinic bills a facility fee for services delivered in a non-facility setting.',
      category: 'Billing and Coding',
      details: 'Place-of-service code differs from the address on file.',
      status: 'review',
      summary: 'Address records and place-of-service code are inconsistent across sources.',
      evidence: [
        ev(8, 'Provider enrollment record', 'https://www.cms.gov', 'CMS', 'conflicting', 'Enrolled practice location differs from the location listed on the claim.', '2025-12-01'),
        ev(9, 'Public clinic directory listing', 'https://www.hhs.gov', 'Clinic directory', 'unverified', 'Listing does not indicate facility status.', undefined),
      ],
      riskIndicators: ['Place-of-service code inconsistent with enrolled location'],
      recommendation: 'Confirm the service location with the provider before payment determination.',
    },
    {
      ...base,
      id: 'sample-7',
      outcome: 'No Further Action',
      ref: 'CLM-2026-0377',
      createdAt: ago(23),
      claim: 'Preventive screening is covered at no cost sharing for the member age group.',
      category: 'Coverage and Eligibility',
      details: 'Member inquiry escalated to review.',
      status: 'completed',
      summary: 'Published preventive services guidance supports the claim.',
      evidence: [ev(10, 'Preventive services coverage guidance', 'https://www.hhs.gov', 'HHS', 'verified', 'Listed screening services are covered without cost sharing when delivered in network.', '2025-08-19')],
      recommendation: 'No further action.',
    },
    {
      ...base,
      id: 'sample-8',
      ref: 'CLM-2026-0370',
      createdAt: ago(31),
      claim: 'Health product label states a measurable reduction in recovery time.',
      category: 'Public Health Statement',
      details: 'Statement from product packaging submitted with reimbursement request.',
      status: 'pending',
    },
    ...extraSamples(),
  ]
}

const defaultSettings: Settings = {
  theme: 'system',
  retrievalEndpoint: '',
  displayName: 'Reviewer',
  organization: '',
  role: 'Claims reviewer',
  rowsPerPage: 5,
  sidebarCollapsed: false,
  readNotifications: [],
  tinyfishApiKey: '',
}

function createStore<T>(key: string, init: () => T) {
  let state: T
  const listeners = new Set<() => void>()
  try {
    const raw = localStorage.getItem(key)
    state = raw ? (JSON.parse(raw) as T) : init()
  } catch {
    state = init()
  }
  if (Array.isArray(state) === false && typeof state === 'object') state = { ...init(), ...state }
  return {
    get: () => state,
    /** Returns false when the value could not be persisted. */
    set(next: T): boolean {
      state = next
      let ok = true
      try {
        localStorage.setItem(key, JSON.stringify(state))
      } catch {
        ok = false
      }
      listeners.forEach((l) => l())
      return ok
    },
    subscribe(l: () => void) {
      listeners.add(l)
      return () => listeners.delete(l)
    },
  }
}

function migrateInvestigations(): Investigation[] {
  let old: Investigation[] = []
  try {
    old = (JSON.parse(localStorage.getItem('medarina.investigations.v1') ?? '[]') as Investigation[]).filter((i) => !i.sample)
  } catch {
    /* ignore */
  }
  return [...old, ...sampleData()]
}
const invStore = createStore<Investigation[]>('medarina.investigations.v2', migrateInvestigations)
// Seed newer sample records into existing workspaces that still contain samples.
{
  const cur = invStore.get()
  if (cur.some((i) => i.sample)) {
    const missing = extraSamples().filter((x) => !cur.some((i) => i.id === x.id))
    if (missing.length) invStore.set([...cur, ...missing])
  }
}
const setStore = createStore<Settings>('medarina.settings.v1', () => defaultSettings)

export const useInvestigations = () => useSyncExternalStore(invStore.subscribe, invStore.get)
export const useSettings = () => useSyncExternalStore(setStore.subscribe, setStore.get)
export const getSettings = setStore.get
export const getInvestigations = invStore.get

export function updateSettings(patch: Partial<Settings>) {
  setStore.set({ ...setStore.get(), ...patch })
}

export function updateInvestigation(id: string, patch: Partial<Investigation>) {
  invStore.set(invStore.get().map((i) => (i.id === id ? { ...i, ...patch } : i)))
}

export function saveReport(id: string): SavedReport | null {
  const inv = invStore.get().find((i) => i.id === id)
  if (!inv) return null
  const { savedReports, ...snapshot } = inv
  const rep: SavedReport = { id: crypto.randomUUID(), generatedAt: new Date().toISOString(), reviewStatus: inv.status, outcome: inv.outcome ?? 'Not determined', snapshot: structuredClone(snapshot) }
  const ok = invStore.set(invStore.get().map((i) => (i.id === id ? { ...i, savedReports: [rep, ...(savedReports ?? [])].slice(0, 20) } : i)))
  if (!ok) {
    invStore.set(invStore.get().map((i) => (i.id === id ? { ...i, savedReports } : i)))
    return null
  }
  return rep
}

export function removeInvestigation(id: string) {
  invStore.set(invStore.get().filter((i) => i.id !== id))
}

export function archiveInvestigation(id: string, archived: boolean) {
  updateInvestigation(id, { archived })
}

export function evidenceStatus(inv: Investigation): string {
  if (inv.status === 'retrieving') return 'Retrieving Sources'
  if (inv.status === 'failed' && !inv.evidence.some((e) => e.retrieval === 'retrieved')) return 'Retrieval Failed'
  if (!inv.evidence.length) return 'No Evidence'
  const r = inv.evidence.filter((e) => e.retrieval === 'retrieved').length
  if (r === inv.evidence.length) return 'Sources Retrieved'
  if (r > 0) return 'Partially Retrieved'
  return inv.evidence.every((e) => e.origin === 'user-provided') ? 'Reviewer-Provided' : 'Retrieval Failed'
}

export function removeSamples() {
  invStore.set(invStore.get().filter((i) => !i.sample))
}

export function clearAll() {
  invStore.set([])
}

export function addEvidence(id: string, e: Omit<Evidence, 'id'>) {
  const inv = invStore.get().find((i) => i.id === id)
  if (!inv) return
  updateInvestigation(id, { evidence: [...inv.evidence, { ...e, id: crypto.randomUUID() }] })
}

export function createInvestigation(input: {
  claim: string
  category: string
  details: string
  provider?: string
  sourceUrl?: string
  ref?: string
  serviceDateFrom?: string
  serviceDateTo?: string
  billingDate?: string
  billedAmount?: number
  billingCodes?: BillingCode[]
  clinicalTimeline?: TimelineEvent[]
  reviewerNotes?: string
}): Investigation {
  const list = invStore.get()
  const year = new Date().getFullYear()
  const n = list.filter((i) => !i.sample).length + 1
  const inv: Investigation = {
    id: crypto.randomUUID(),
    ref: input.ref?.trim() || `INV-${year}-${String(n).padStart(4, '0')}`,
    createdAt: new Date().toISOString(),
    claim: input.claim.trim(),
    category: input.category,
    details: input.details.trim(),
    provider: input.provider?.trim() || undefined,
    sourceUrl: input.sourceUrl?.trim() || undefined,
    status: 'pending',
    evidence: [],
    riskIndicators: [],
    notes: '',
    serviceDateFrom: input.serviceDateFrom || undefined,
    serviceDateTo: input.serviceDateTo || undefined,
    billingDate: input.billingDate || undefined,
    billedAmount: input.billedAmount,
    billingCodes: input.billingCodes,
    clinicalTimeline: input.clinicalTimeline,
    reviewerNotes: input.reviewerNotes?.trim() || undefined,
    retrieval: { status: 'queued' },
  }
  invStore.set([inv, ...list])
  return inv
}

/** Runs TinyFish retrieval for an investigation and records the outcome honestly. */
export async function runRetrieval(id: string) {
  const inv = invStore.get().find((i) => i.id === id)
  if (!inv) return
  const cfg = getConfig(getSettings())
  const startedAt = new Date().toISOString()
  if (!cfg.endpoint) {
    const message = 'No retrieval endpoint configured. Add a TinyFish endpoint in Settings to enable live source retrieval.'
    updateInvestigation(id, { status: 'pending', retrievalError: undefined, retrieval: { status: 'not_configured', startedAt, completedAt: startedAt, message } })
    toast('info', 'TinyFish is not configured. The investigation was saved without retrieval.')
    return
  }
  updateInvestigation(id, { status: 'retrieving', retrievalError: undefined, retrieval: { status: 'retrieving', startedAt } })
  const r = await retrieveEvidence(inv, cfg)
  const completedAt = new Date().toISOString()
  if (r.status === 'completed') {
    const evidence = r.evidence ?? []
    updateInvestigation(id, {
      evidence: [...inv.evidence.filter((e) => e.origin === 'user-provided'), ...evidence],
      summary: r.summary,
      riskIndicators: r.riskIndicators ?? [],
      recommendation: r.recommendation,
      status: evidence.some((e) => e.classification === 'conflicting') ? 'review' : 'pending',
      retrieval: { status: 'completed', startedAt, completedAt, message: `${evidence.length} source${evidence.length === 1 ? '' : 's'} retrieved.` },
    })
    updateSettings({ lastRetrievalAt: completedAt, lastRetrievalError: undefined })
    toast('success', `Sources retrieved for ${inv.ref}.`)
  } else {
    updateInvestigation(id, { status: 'failed', retrievalError: r.message, retrieval: { status: 'failed', startedAt, completedAt, message: r.message } })
    updateSettings({ lastRetrievalAt: completedAt, lastRetrievalError: r.message })
    toast('error', `Source Retrieval Failed. ${r.message}`)
  }
}

export function retrievalStatusOf(inv: Investigation): RetrievalStatus | undefined {
  if (inv.status === 'retrieving') return 'retrieving'
  if (inv.retrieval) return inv.retrieval.status
  if (inv.status === 'failed') return 'failed'
  if (inv.evidence.some((e) => e.retrieval === 'retrieved')) return 'completed'
  return undefined
}

export function dashboardStats(list: Investigation[]) {
  const now = Date.now()
  const open = list.filter((i) => i.status !== 'completed')
  return {
    total: list.length,
    open: open.length,
    flagged: list.filter((i) => i.status === 'review' || i.status === 'failed').length,
    closed: list.filter((i) => i.status === 'completed').length,
    billedUnderReview: open.reduce((s, i) => s + (i.billedAmount ?? 0), 0),
    avgDaysOpen: open.length ? open.reduce((s, i) => s + (now - new Date(i.createdAt).getTime()) / DAY, 0) / open.length : 0,
  }
}

export const fmtMoney = (n?: number) =>
  n === undefined ? '—' : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })

export function resolveTheme(pref: ThemePref): 'light' | 'dark' {
  if (pref === 'system') return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  return pref
}

export function applyTheme(pref: ThemePref) {
  document.documentElement.classList.toggle('dark', resolveTheme(pref) === 'dark')
}

export const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
