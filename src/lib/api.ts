/**
 * Medarina backend API client.
 *
 * All functions return the parsed JSON body on success.
 * They throw an Error with a human-readable message on failure.
 *
 * The base URL is read from the VITE_API_URL env variable.
 * If not set it falls back to http://localhost:8000 (local dev).
 */

import type { Investigation, Evidence, SavedReport } from './store'

function resolveApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL
  if (typeof envUrl === 'string' && envUrl.trim() !== '') {
    return envUrl.trim().replace(/\/$/, '')
  }
  if (typeof window !== 'undefined') {
    // If running on local Vite dev server port 8443 or 5173, target local backend
    if (window.location.port === '8443' || window.location.port === '5173') {
      return 'http://127.0.0.1:8000'
    }
    // In production or unified full-stack server, use relative path (same origin)
    return ''
  }
  return 'http://127.0.0.1:8000'
}

export const API_BASE_URL = resolveApiBaseUrl()

async function request<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body !== undefined) opts.body = JSON.stringify(body)

  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}${path}`, opts)
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    const target = API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : 'the server')
    throw new Error(`Could not connect to Medarina backend at ${target}. (${detail})`)
  }

  if (!res.ok) {
    let msg = `API error ${res.status}`
    try {
      const data = await res.json()
      if (typeof data.detail === 'string') {
        msg = data.detail
      } else if (Array.isArray(data.detail) && data.detail.length) {
        msg = data.detail.map((d: any) => d.msg ?? d.message ?? JSON.stringify(d)).join('; ')
      } else if (data.message) {
        msg = data.message
      }
    } catch {
      // ignore
    }
    throw new Error(msg)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Health & Liveness
// ---------------------------------------------------------------------------

export interface HealthData {
  status: string
  version: string
  timestamp: string
  database?: {
    connected: boolean
    mode: string
    configured: boolean
    projectUrl?: string | null
  }
  gemini?: {
    configured: boolean
    model: string
    ready: boolean
  }
  tinyfish?: {
    configured: boolean
    endpoint?: string | null
    hasKey: boolean
  }
}

export const getHealth = () =>
  request<HealthData>('GET', '/health')

export async function isBackendReachable(): Promise<boolean> {
  try {
    const h = await getHealth()
    return h.status === 'ok'
  } catch {
    return false
  }
}

export async function checkBackendHealth(): Promise<{
  ok: boolean
  status?: string
  version?: string
  timestamp?: string
  database?: HealthData['database']
  gemini?: HealthData['gemini']
  tinyfish?: HealthData['tinyfish']
  error?: string
}> {
  try {
    const h = await getHealth()
    return {
      ok: h.status === 'ok',
      status: h.status,
      version: h.version,
      timestamp: h.timestamp,
      database: h.database,
      gemini: h.gemini,
      tinyfish: h.tinyfish,
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unreachable' }
  }
}

// ---------------------------------------------------------------------------
// Investigations
// ---------------------------------------------------------------------------

export interface InvestigationListParams {
  archived?: boolean
  status?: string
  category?: string
  q?: string
  limit?: number
  offset?: number
}

export const listInvestigations = (params: InvestigationListParams = {}) => {
  const sp = new URLSearchParams()
  if (params.archived !== undefined) sp.set('archived', String(params.archived))
  if (params.status) sp.set('status', params.status)
  if (params.category) sp.set('category', params.category)
  if (params.q) sp.set('q', params.q)
  if (params.limit !== undefined) sp.set('limit', String(params.limit))
  if (params.offset !== undefined) sp.set('offset', String(params.offset))
  const qs = sp.toString()
  return request<{ items: Investigation[]; total: number }>('GET', `/api/investigations${qs ? `?${qs}` : ''}`)
}

export const getInvestigation = (id: string) =>
  request<Investigation>('GET', `/api/investigations/${id}`)

export const createInvestigation = (body: unknown) =>
  request<Investigation>('POST', '/api/investigations', body)

export const updateInvestigation = (id: string, patch: unknown) =>
  request<Investigation>('PATCH', `/api/investigations/${id}`, patch)

export const deleteInvestigation = (id: string) =>
  request<void>('DELETE', `/api/investigations/${id}`)

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

export const addEvidence = (invId: string, body: unknown) =>
  request<Evidence>('POST', `/api/investigations/${invId}/evidence`, body)

// ---------------------------------------------------------------------------
// Retrieval
// ---------------------------------------------------------------------------

export const triggerRetrieval = (invId: string, opts?: { tinyfishEndpoint?: string; tinyfishApiKey?: string }) =>
  request<{ message: string; investigationId: string }>('POST', `/api/investigations/${invId}/retrieve`, opts ?? {})

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

export const analyseInvestigation = (invId: string) =>
  request<{
    verificationQuestions: string[]
    summary?: string
    riskIndicators: string[]
    recommendation?: string
  }>('POST', `/api/investigations/${invId}/analyse`)

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export const saveReport = (invId: string) =>
  request<SavedReport>('POST', `/api/investigations/${invId}/reports`)

export const listReports = (invId: string) =>
  request<{ items: SavedReport[] }>('GET', `/api/investigations/${invId}/reports`)

export const listAllReports = () =>
  request<{ items: SavedReport[] }>('GET', '/api/reports')

export const getReport = (reportId: string) =>
  request<SavedReport>('GET', `/api/reports/${reportId}`)

// ---------------------------------------------------------------------------
// TinyFish proxy test & diagnostics
// ---------------------------------------------------------------------------

export interface TinyFishStatusData {
  configured: boolean
  hasKey: boolean
  endpoint?: string | null
  status: 'connected' | 'unavailable' | 'not_configured'
  reachable: boolean
  pingMessage: string
  lastRun?: {
    status?: string | null
    durationSeconds?: number | null
    sourceCount?: number
    completedAt?: string | null
    message?: string | null
    url?: string | null
  }
  checkedAt: string
}

export interface TinyFishDiagnosticResult {
  ok: boolean
  status: string
  targetUrl: string
  startedAt: string
  completedAt: string
  durationSeconds: number
  sourceCount: number
  evidence: Evidence[]
  summary?: string
  message: string
}

export const testTinyfishConnection = (endpoint: string, apiKey = '') =>
  request<{ ok: boolean; message: string }>('POST', '/api/tinyfish/test', {
    endpoint,
    apiKey,
  })

export const getTinyFishStatus = () =>
  request<TinyFishStatusData>('GET', '/api/tinyfish/status')

export const runTinyFishDiagnostics = (url?: string) =>
  request<TinyFishDiagnosticResult>('POST', '/api/tinyfish/diagnostics/run', { url })

