import { useSyncExternalStore } from 'react'
import { toast } from './toast'
import { getConfig, retrieveEvidence, type RetrievalStatus } from './tinyfish'
import * as api from './api'

export interface BackendStatus {
  connected: boolean
  loading: boolean
  error?: string | null
  endpoint: string
  lastSyncedAt?: string
}

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
  billedAmount?: number | null
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

const backendStore = createStore<BackendStatus>('medarina.backend.v1', () => ({
  connected: false,
  loading: false,
  error: null,
  endpoint: api.API_BASE_URL,
}))

export const useInvestigations = () => useSyncExternalStore(invStore.subscribe, invStore.get)
export const useSettings = () => useSyncExternalStore(setStore.subscribe, setStore.get)
export const useBackendStatus = () => useSyncExternalStore(backendStore.subscribe, backendStore.get)
export const getSettings = setStore.get
export const getInvestigations = invStore.get
export const getBackendStatus = backendStore.get

export interface TinyFishStoreState {
  status: 'connected' | 'checking' | 'unavailable' | 'not_configured'
  loading: boolean
  reachable: boolean
  hasKey: boolean
  endpoint: string | null
  pingMessage: string
  lastRun?: {
    status?: string | null
    durationSeconds?: number | null
    sourceCount?: number
    completedAt?: string | null
    message?: string | null
    url?: string | null
  }
  checkedAt?: string
}

const tinyfishStore = createStore<TinyFishStoreState>('medarina.tinyfish.v1', () => ({
  status: 'checking',
  loading: true,
  reachable: false,
  hasKey: false,
  endpoint: null,
  pingMessage: '',
}))

export const useTinyFishStatus = () => useSyncExternalStore(tinyfishStore.subscribe, tinyfishStore.get)
export const getTinyFishStore = tinyfishStore.get

export async function refreshTinyFishStatus(): Promise<TinyFishStoreState> {
  tinyfishStore.set({ ...tinyfishStore.get(), loading: true })
  try {
    const s = await api.getTinyFishStatus()
    const state: TinyFishStoreState = {
      status: s.status,
      loading: false,
      reachable: s.reachable,
      hasKey: s.hasKey,
      endpoint: s.endpoint ?? null,
      pingMessage: s.pingMessage,
      lastRun: s.lastRun,
      checkedAt: s.checkedAt,
    }
    tinyfishStore.set(state)
    return state
  } catch (err) {
    const state: TinyFishStoreState = {
      ...tinyfishStore.get(),
      status: 'unavailable',
      loading: false,
      reachable: false,
      pingMessage: err instanceof Error ? err.message : 'Could not reach backend',
    }
    tinyfishStore.set(state)
    return state
  }
}


export function normalizeInvestigation(i: any): Investigation {
  return {
    ...i,
    sample: Boolean(i.sample),
    evidence: Array.isArray(i.evidence) ? i.evidence : [],
    riskIndicators: Array.isArray(i.riskIndicators) ? i.riskIndicators : [],
    billingCodes: Array.isArray(i.billingCodes) ? i.billingCodes : [],
    clinicalTimeline: Array.isArray(i.clinicalTimeline) ? i.clinicalTimeline : [],
    savedReports: Array.isArray(i.savedReports) ? i.savedReports : [],
    notes: i.notes ?? '',
  }
}

/** Fetches real investigations from the FastAPI backend and merges with static samples. */
export async function syncWithBackend(): Promise<boolean> {
  backendStore.set({ ...backendStore.get(), loading: true })
  try {
    const res = await api.listInvestigations({ limit: 500 })
    const backendItems: Investigation[] = (res.items || [])
      .filter((i: any) => !i.sample)
      .map(normalizeInvestigation)
    const samples = sampleData()
    invStore.set([...backendItems, ...samples])
    backendStore.set({
      connected: true,
      loading: false,
      error: null,
      endpoint: api.API_BASE_URL,
      lastSyncedAt: new Date().toISOString(),
    })
    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    backendStore.set({
      connected: false,
      loading: false,
      error: msg,
      endpoint: api.API_BASE_URL,
    })
    return false
  }
}

export const refreshInvestigations = syncWithBackend

// Trigger initial backend synchronization when running in browser
if (typeof window !== 'undefined') {
  void syncWithBackend()
  void refreshTinyFishStatus()
}

export function updateSettings(patch: Partial<Settings>) {
  setStore.set({ ...setStore.get(), ...patch })
}

export async function updateInvestigation(id: string, patch: Partial<Investigation>): Promise<void> {
  const inv = invStore.get().find((i) => i.id === id)
  if (!inv) return

  // Optimistic local update
  invStore.set(invStore.get().map((i) => (i.id === id ? { ...i, ...patch } : i)))

  if (inv.sample) return

  const backend = backendStore.get()
  if (backend.connected || !backend.error) {
    try {
      const updated = await api.updateInvestigation(id, patch)
      invStore.set(invStore.get().map((i) => (i.id === id ? { ...i, ...updated } : i)))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast('error', `Could not save changes to backend: ${msg}`)
      invStore.set(invStore.get().map((i) => (i.id === id ? inv : i)))
      throw err
    }
  }
}

export async function saveReport(id: string): Promise<SavedReport | null> {
  const inv = invStore.get().find((i) => i.id === id)
  if (!inv) return null

  const { savedReports, ...snapshot } = inv
  const localRep: SavedReport = {
    id: crypto.randomUUID(),
    generatedAt: new Date().toISOString(),
    reviewStatus: inv.status,
    outcome: inv.outcome ?? 'Not determined',
    snapshot: structuredClone(snapshot),
  }

  if (inv.sample) {
    invStore.set(invStore.get().map((i) => (i.id === id ? { ...i, savedReports: [localRep, ...(savedReports ?? [])].slice(0, 20) } : i)))
    return localRep
  }

  const backend = backendStore.get()
  if (backend.connected || !backend.error) {
    try {
      const rep = await api.saveReport(id)
      const updatedReports = [rep, ...(savedReports ?? []).filter((r) => r.id !== rep.id)].slice(0, 20)
      invStore.set(invStore.get().map((i) => (i.id === id ? { ...i, savedReports: updatedReports } : i)))
      return rep
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast('error', `Failed to save report to backend: ${msg}`)
      throw err
    }
  }

  invStore.set(invStore.get().map((i) => (i.id === id ? { ...i, savedReports: [localRep, ...(savedReports ?? [])].slice(0, 20) } : i)))
  return localRep
}

export async function removeInvestigation(id: string): Promise<void> {
  const inv = invStore.get().find((i) => i.id === id)
  if (!inv) return

  invStore.set(invStore.get().filter((i) => i.id !== id))

  if (inv.sample) return

  const backend = backendStore.get()
  if (backend.connected || !backend.error) {
    try {
      await api.deleteInvestigation(id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast('error', `Failed to delete from backend: ${msg}`)
      invStore.set([inv, ...invStore.get()])
      throw err
    }
  }
}

export function archiveInvestigation(id: string, archived: boolean): Promise<void> {
  return updateInvestigation(id, { archived })
}

export function evidenceStatus(inv: Investigation): string {
  const ev = inv.evidence ?? []
  if (inv.status === 'retrieving') return 'Retrieving Sources'
  if (inv.status === 'failed' && !ev.some((e) => e.retrieval === 'retrieved')) return 'Retrieval Failed'
  if (!ev.length) return 'No Evidence'
  const r = ev.filter((e) => e.retrieval === 'retrieved').length
  if (r === ev.length) return 'Sources Retrieved'
  if (r > 0) return 'Partially Retrieved'
  return ev.every((e) => e.origin === 'user-provided') ? 'Reviewer-Provided' : 'Retrieval Failed'
}

export function removeSamples() {
  invStore.set(invStore.get().filter((i) => !i.sample))
}

export function clearAll() {
  invStore.set([])
}

export async function addEvidence(id: string, e: Omit<Evidence, 'id'>): Promise<Evidence> {
  const inv = invStore.get().find((i) => i.id === id)
  if (!inv) throw new Error('Investigation not found')

  if (inv.sample) {
    const localEv: Evidence = { ...e, id: crypto.randomUUID() }
    invStore.set(invStore.get().map((i) => (i.id === id ? { ...i, evidence: [...i.evidence, localEv] } : i)))
    return localEv
  }

  const backend = backendStore.get()
  if (backend.connected || !backend.error) {
    try {
      const saved = await api.addEvidence(id, e)
      invStore.set(invStore.get().map((i) => (i.id === id ? { ...i, evidence: [...i.evidence, saved] } : i)))
      return saved
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast('error', `Failed to save evidence to backend: ${msg}`)
      throw err
    }
  }

  const localEv: Evidence = { ...e, id: crypto.randomUUID() }
  invStore.set(invStore.get().map((i) => (i.id === id ? { ...i, evidence: [...i.evidence, localEv] } : i)))
  return localEv
}

export async function createInvestigation(input: {
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
  runNow?: boolean
}): Promise<Investigation> {
  const payload = {
    claim: input.claim.trim(),
    category: input.category,
    details: input.details.trim(),
    provider: input.provider?.trim() || undefined,
    sourceUrl: input.sourceUrl?.trim() || undefined,
    ref: input.ref?.trim() || undefined,
    serviceDateFrom: input.serviceDateFrom || undefined,
    serviceDateTo: input.serviceDateTo || undefined,
    billingDate: input.billingDate || undefined,
    billedAmount: input.billedAmount,
    billingCodes: input.billingCodes,
    clinicalTimeline: input.clinicalTimeline,
    reviewerNotes: input.reviewerNotes?.trim() || undefined,
    runNow: input.runNow ?? false,
  }

  const backend = backendStore.get()
  if (backend.connected || !backend.error) {
    try {
      const created = await api.createInvestigation(payload)
      const inv: Investigation = normalizeInvestigation(created)
      invStore.set([inv, ...invStore.get().filter((i) => i.id !== inv.id)])
      backendStore.set({ ...backendStore.get(), connected: true, error: null })
      return inv
    } catch (err) {
      const isNetwork = err instanceof Error && err.message.includes('Could not connect')
      if (!isNetwork) {
        throw err
      }
      backendStore.set({ ...backendStore.get(), connected: false, error: (err as Error).message })
      toast('info', 'Backend offline. Investigation saved in local demo store.')
    }
  }

  // Local fallback
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

/** Refreshes a single investigation from the backend and updates the reactive store. */
export async function refreshInvestigation(id: string): Promise<Investigation | null> {
  const inv = invStore.get().find((i) => i.id === id || i.ref === id)
  if (inv?.sample) return inv

  try {
    const fresh = await api.getInvestigation(id)
    const normalized: Investigation = normalizeInvestigation(fresh)
    const list = invStore.get()
    const index = list.findIndex((i) => i.id === normalized.id || i.ref === normalized.ref)
    if (index >= 0) {
      const copy = [...list]
      copy[index] = { ...copy[index], ...normalized }
      invStore.set(copy)
    } else {
      invStore.set([normalized, ...list])
    }
    return normalized
  } catch {
    return inv ?? null
  }
}

// Active polling timers keyed by investigation id to avoid duplicate timers
const activePollers = new Map<string, number>()

/**
 * Polls the backend every 3 seconds for an investigation while status is 'retrieving'.
 * Automatically stops when terminal state is reached (completed, review, failed, etc.)
 * or when max timeout is reached. Returns a cleanup function.
 */
export function startInvestigationPolling(
  id: string,
  opts?: {
    intervalMs?: number
    maxDurationMs?: number
    onComplete?: (inv: Investigation) => void
    onError?: (err: Error) => void
  }
): () => void {
  // If already polling this investigation, return cleanup function for existing timer
  if (activePollers.has(id)) {
    return () => stopInvestigationPolling(id)
  }

  const intervalMs = opts?.intervalMs ?? 3000
  const maxDurationMs = opts?.maxDurationMs ?? 200000 // 200s (allows TinyFish live-web crawler to complete)
  const startTime = Date.now()

  const timerId = window.setInterval(async () => {
    try {
      const fresh = await refreshInvestigation(id)

      // Terminal states: status is no longer 'retrieving'
      if (fresh && fresh.status !== 'retrieving') {
        stopInvestigationPolling(id)
        opts?.onComplete?.(fresh)
        return
      }

      const elapsed = Date.now() - startTime
      if (elapsed >= maxDurationMs) {
        // If backend is still actively retrieving, continue polling instead of falsely marking failed
        if (fresh && fresh.status === 'retrieving') {
          return
        }
        stopInvestigationPolling(id)
        opts?.onError?.(new Error('Retrieval timed out waiting for response.'))
        return
      }
    } catch {
      // Ignore transient network errors, keep polling until terminal state or max duration
    }
  }, intervalMs)

  activePollers.set(id, timerId)

  return () => stopInvestigationPolling(id)
}

export function stopInvestigationPolling(id: string) {
  const timerId = activePollers.get(id)
  if (timerId !== undefined) {
    clearInterval(timerId)
    activePollers.delete(id)
  }
}

/** Runs TinyFish retrieval for an investigation and records the outcome honestly. */
export async function runRetrieval(id: string) {
  const inv = invStore.get().find((i) => i.id === id)
  if (!inv) return
  if (inv.sample) return

  const backend = backendStore.get()
  const cfg = getConfig(getSettings())

  if (backend.connected || !backend.error) {
    // Optimistic local state update so UI immediately indicates active retrieval
    invStore.set(
      invStore.get().map((i) =>
        i.id === id
          ? {
              ...i,
              status: 'retrieving',
              retrievalError: undefined,
              retrieval: { status: 'retrieving', startedAt: new Date().toISOString() },
            }
          : i
      )
    )
    try {
      await api.triggerRetrieval(id, {
        tinyfishEndpoint: cfg.endpoint || undefined,
        tinyfishApiKey: cfg.apiKey || undefined,
      })
      // Poll until retrieval completes (or fails / times out client-side)
      startInvestigationPolling(id, {
        onComplete: (fresh) => {
          if (fresh.status === 'failed') {
            toast('error', `Source Retrieval Failed: ${fresh.retrievalError || 'Unknown error'}`)
          } else {
            toast('success', `Sources retrieved for ${fresh.ref}.`)
          }
        },
      })
      return
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const isNetwork = msg.includes('Could not connect')
      if (!isNetwork) {
        toast('error', `Retrieval trigger failed: ${msg}`)
        void updateInvestigation(id, {
          status: 'failed',
          retrievalError: msg,
          retrieval: { status: 'failed', message: msg },
        })
        return
      }
      // Fall through to client-side retrieval if backend is offline
    }
  }

  // Client retrieval fallback
  const startedAt = new Date().toISOString()
  if (!cfg.endpoint) {
    const message = 'No retrieval endpoint configured. Add a TinyFish endpoint in Settings to enable live source retrieval.'
    void updateInvestigation(id, { status: 'pending', retrievalError: undefined, retrieval: { status: 'not_configured', startedAt, completedAt: startedAt, message } })
    toast('info', 'TinyFish is not configured. The investigation was saved without retrieval.')
    return
  }
  void updateInvestigation(id, { status: 'retrieving', retrievalError: undefined, retrieval: { status: 'retrieving', startedAt } })
  const r = await retrieveEvidence(inv, cfg)
  const completedAt = new Date().toISOString()
  if (r.status === 'completed') {
    const evidence = r.evidence ?? []
    void updateInvestigation(id, {
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
    void updateInvestigation(id, { status: 'failed', retrievalError: r.message, retrieval: { status: 'failed', startedAt, completedAt, message: r.message } })
    updateSettings({ lastRetrievalAt: completedAt, lastRetrievalError: r.message })
    toast('error', `Source Retrieval Failed. ${r.message}`)
  }
}


export function retrievalStatusOf(inv: Investigation): RetrievalStatus | undefined {
  if (inv.status === 'retrieving') return 'retrieving'
  if (inv.status === 'failed') return 'failed'
  if (inv.retrieval) {
    if (inv.retrieval.status === 'queued' && inv.status === 'pending') return undefined
    return inv.retrieval.status
  }
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
    billedUnderReview: open.reduce((s, i) => {
      const n = i.billedAmount != null ? Number(i.billedAmount) : NaN
      return s + (Number.isFinite(n) ? n : 0)
    }, 0),
    avgDaysOpen: open.length
      ? open.reduce((s, i) => {
          const t = i.createdAt ? new Date(i.createdAt).getTime() : NaN
          return s + (Number.isFinite(t) ? Math.max(0, (now - t) / DAY) : 0)
        }, 0) / open.length
      : 0,
  }
}

export const fmtMoney = (n?: number | string | null) => {
  if (n === null || n === undefined || n === '') return '—'
  const val = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(val)) return '—'
  return val.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
}

export function resolveTheme(pref: ThemePref): 'light' | 'dark' {
  if (pref === 'system') return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  return pref
}

export function applyTheme(pref: ThemePref) {
  document.documentElement.classList.toggle('dark', resolveTheme(pref) === 'dark')
}

export const fmtDate = (iso?: string | null) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
