/**
 * TinyFish evidence retrieval service layer.
 * Frontend-only: calls the endpoint configured in Settings. Never fabricates results.
 */
import type { Classification, Evidence, Investigation } from './store'

export type TinyfishStatus = 'not_configured' | 'ready' | 'error'
export type RetrievalStatus = 'not_configured' | 'queued' | 'retrieving' | 'completed' | 'failed'

export interface TinyfishConfig {
  endpoint: string
  apiKey: string
}

export interface RetrievalResult {
  status: 'completed' | 'failed' | 'not_configured'
  message?: string
  evidence?: Evidence[]
  summary?: string
  riskIndicators?: string[]
  recommendation?: string
}

export const RETRIEVAL_LABEL: Record<RetrievalStatus, string> = {
  not_configured: 'Not configured',
  queued: 'Queued',
  retrieving: 'Retrieving',
  completed: 'Completed',
  failed: 'Failed',
}

const TIMEOUT = 20000
const CLASSES: Classification[] = ['verified', 'unverified', 'conflicting', 'inconclusive']
const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d)

export function getConfig(s: { retrievalEndpoint: string; tinyfishApiKey?: string }): TinyfishConfig {
  return { endpoint: s.retrievalEndpoint.trim(), apiKey: (s.tinyfishApiKey ?? '').trim() }
}

export function getStatus(cfg: TinyfishConfig, lastError?: string): TinyfishStatus {
  if (!cfg.endpoint) return 'not_configured'
  return lastError ? 'error' : 'ready'
}

function headers(cfg: TinyfishConfig) {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cfg.apiKey) h['X-API-Key'] = cfg.apiKey
  return h
}

async function call(cfg: TinyfishConfig, body: unknown) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), TIMEOUT)
  try {
    return await fetch(cfg.endpoint, { method: 'POST', headers: headers(cfg), body: JSON.stringify(body), signal: ctl.signal })
  } catch (err) {
    if (ctl.signal.aborted) throw new Error('The TinyFish service did not respond within 20 seconds.')
    throw new Error(err instanceof Error && err.message ? `Could not reach the TinyFish service (${err.message}).` : 'Could not reach the TinyFish service.')
  } finally {
    clearTimeout(t)
  }
}

/** Sends a lightweight ping to confirm the endpoint responds. */
export async function testConnection(cfg: TinyfishConfig): Promise<{ ok: boolean; message: string }> {
  if (!cfg.endpoint) return { ok: false, message: 'No retrieval endpoint configured.' }
  const isTinyFish = /agent\.tinyfish\.ai|tinyfish\.ai/i.test(cfg.endpoint)

  // If endpoint is TinyFish Agent and no API key is provided in browser,
  // try the backend test endpoint so server-side credentials can be used.
  if (isTinyFish && !cfg.apiKey) {
    try {
      const backendBase =
        typeof window !== 'undefined' && (window.location.port === '8443' || window.location.port === '5173')
          ? 'http://127.0.0.1:8000'
          : ''
      const bRes = await fetch(`${backendBase}/api/tinyfish/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: cfg.endpoint, apiKey: '' }),
      })
      if (bRes.ok) {
        const bData = await bRes.json().catch(() => null)
        if (bData && typeof bData.ok === 'boolean') {
          return bData
        }
      }
    } catch {
      // Backend unreachable; proceed to direct ping
    }
  }

  try {
    const res = await call(cfg, { ping: true })
    if (res.ok) {
      return { ok: true, message: isTinyFish ? 'TinyFish Agent API connected and authenticated.' : `Endpoint responded with HTTP ${res.status}.` }
    }
    const data = await res.json().catch(() => null)
    if (isTinyFish && res.status === 400) {
      // TinyFish Agent API returns 400 INVALID_INPUT for {"ping": true} because it validates schema,
      // but returns 401 Unauthorized if the API key is invalid or missing.
      return { ok: true, message: 'TinyFish Agent API connected and authenticated.' }
    }
    if (res.status === 401) {
      const detail = data?.error?.message || 'TinyFish API key rejected (HTTP 401 Unauthorized).'
      return { ok: false, message: detail }
    }
    const errMsg = data?.error?.message || data?.message || `Endpoint responded with HTTP ${res.status}.`
    return { ok: false, message: errMsg }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Connection failed.' }
  }
}

export async function retrieveEvidence(inv: Investigation, cfg: TinyfishConfig): Promise<RetrievalResult> {
  if (!cfg.endpoint) return { status: 'not_configured', message: 'No retrieval endpoint configured. Add a TinyFish endpoint in Settings to enable live source retrieval.' }
  try {
    const res = await call(cfg, {
      claim: inv.claim,
      category: inv.category,
      details: inv.details,
      provider: inv.provider,
      sourceUrl: inv.sourceUrl,
      billingCodes: inv.billingCodes,
      serviceDateFrom: inv.serviceDateFrom,
      serviceDateTo: inv.serviceDateTo,
      billedAmount: inv.billedAmount,
    })
    if (!res.ok) throw new Error(`The TinyFish service responded with HTTP ${res.status}.`)
    const data = await res.json().catch(() => null)
    if (!data || !Array.isArray(data.evidence)) throw new Error('The TinyFish service returned an unrecognized response format.')
    const now = new Date().toISOString()
    const evidence: Evidence[] = data.evidence
      .filter((e: any) => e && typeof e.title === 'string' && typeof e.url === 'string')
      .map((e: any) => ({
        id: crypto.randomUUID(),
        title: e.title,
        url: e.url,
        publisher: str(e.publisher, new URL(e.url, 'https://invalid.local').hostname),
        published: str(e.published) || undefined,
        retrieval: e.retrieval === 'failed' ? 'failed' : 'retrieved',
        origin: e.origin === 'live-source' ? 'live-source' : 'ai-summary',
        classification: CLASSES.includes(e.classification) ? e.classification : 'inconclusive',
        summary: str(e.summary),
        retrievedAt: now,
        provider: 'tinyfish' as const,
        verifies: str(e.verifies) || str(e.claimDetail) || undefined,
      }))
    return {
      status: 'completed',
      evidence,
      summary: str(data.summary) || undefined,
      riskIndicators: Array.isArray(data.riskIndicators) ? data.riskIndicators.filter((r: unknown) => typeof r === 'string') : [],
      recommendation: str(data.recommendation) || undefined,
    }
  } catch (err) {
    return { status: 'failed', message: err instanceof Error ? err.message : 'Retrieval failed.' }
  }
}
