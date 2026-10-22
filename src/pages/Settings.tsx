import { useState } from 'react'
import { Button, Card, CardHeader, Field, Icon, Notice, PageHeader, inputCls } from '../components/ui'
import { replayOnboarding } from '../lib/onboarding'
import { getConfig, testConnection } from '../lib/tinyfish'
import { clearAll, removeSamples, updateSettings, useInvestigations, useSettings, useBackendStatus, useTinyFishStatus, refreshTinyFishStatus, syncWithBackend, type ThemePref } from '../lib/store'
import { API_BASE_URL, checkBackendHealth, runTinyFishDiagnostics, type TinyFishDiagnosticResult } from '../lib/api'

export default function SettingsPage() {
  const s = useSettings()
  const list = useInvestigations()
  const backend = useBackendStatus()
  const tfStatus = useTinyFishStatus()
  const [endpoint, setEndpoint] = useState(s.retrievalEndpoint)
  const [apiKey, setApiKey] = useState(s.tinyfishApiKey)
  const [testing, setTesting] = useState(false)
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null)
  const [testingBackend, setTestingBackend] = useState(false)
  const [backendHealth, setBackendHealth] = useState<{ ok: boolean; message: string } | null>(null)
  const [healthInfo, setHealthInfo] = useState<Awaited<ReturnType<typeof checkBackendHealth>> | null>(null)
  const [diagUrl, setDiagUrl] = useState('https://example.com')
  const [diagLoading, setDiagLoading] = useState(false)
  const [diagResult, setDiagResult] = useState<TinyFishDiagnosticResult | null>(null)
  const [endpointErr, setEndpointErr] = useState('')
  const [saved, setSaved] = useState(false)
  const [confirm, setConfirm] = useState(false)

  async function testBackend() {
    setTestingBackend(true)
    const h = await checkBackendHealth()
    setHealthInfo(h)
    if (h.ok) {
      setBackendHealth({ ok: true, message: `FastAPI responded at ${API_BASE_URL} (v${h.version}, status: ${h.status}).` })
      void syncWithBackend()
    } else {
      setBackendHealth({ ok: false, message: h.error || 'Connection failed.' })
    }
    setTestingBackend(false)
  }

  function saveEndpoint(e: React.FormEvent) {
    e.preventDefault()
    const v = endpoint.trim()
    if (v) {
      try {
        if (!/^https?:$/.test(new URL(v).protocol)) throw new Error()
      } catch {
        setEndpointErr('Enter a valid http or https URL.')
        return
      }
    }
    setEndpointErr('')
    updateSettings({ retrievalEndpoint: v, tinyfishApiKey: apiKey.trim(), lastRetrievalError: undefined })
    setTest(null)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const themes: { v: ThemePref; label: string; icon: string }[] = [
    { v: 'light', label: 'Light', icon: 'sun' },
    { v: 'dark', label: 'Dark', icon: 'moon' },
    { v: 'system', label: 'System', icon: 'settings' },
  ]

  const realCount = list.filter((i) => !i.sample).length
  const sampleCount = list.filter((i) => i.sample).length

  return (
    <>
      <PageHeader title="Settings" desc="Appearance, backend connection, retrieval service, and workspace data." />
      <div className="max-w-3xl space-y-6">
        <Card>
          <CardHeader title="Appearance" desc="System follows your device setting. Your choice is saved in this browser." />
          <div role="radiogroup" aria-label="Theme" className="grid gap-3 p-5 sm:grid-cols-3">
            {themes.map((t) => {
              const on = s.theme === t.v
              return (
                <button key={t.v} role="radio" aria-checked={on} onClick={() => updateSettings({ theme: t.v })}
                  className={`flex items-center gap-3 rounded-md border px-4 py-3 text-left text-sm font-medium transition-colors ${on ? 'border-primary bg-mint text-mint-fg' : 'border-line bg-card hover:bg-sage'}`}>
                  <Icon name={t.icon} />
                  {t.label}
                  {on && <Icon name="check" size={16} className="ml-auto" />}
                </button>
              )
            })}
          </div>
        </Card>

        <Card>
          <CardHeader title="FastAPI Backend Service" desc="Server providing database persistence, AI analysis, and evidence retrieval." />
          <div className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-muted">Backend API Endpoint</p>
                <p className="tabular mt-1 font-mono text-sm">{API_BASE_URL}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted">Connection Status</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${backend.connected ? 'bg-success-fg' : 'bg-warn-fg'}`} />
                  <span className="text-sm font-medium">{backend.connected ? 'Connected to FastAPI' : 'Offline (Demo Fallback)'}</span>
                </div>
              </div>
            </div>
            {backendHealth ? (
              <Notice tone={backendHealth.ok ? 'info' : 'error'} title={backendHealth.ok ? 'Backend reachable' : 'Backend unreachable'}>
                {backendHealth.message}
              </Notice>
            ) : backend.error ? (
              <Notice tone="warn" title="Backend connection issue">
                {backend.error}
              </Notice>
            ) : (
              <Notice tone="info" title="Backend connected">
                FastAPI server is connected and synchronizing investigations.
              </Notice>
            )}

            {healthInfo?.ok && (
              <div className="grid gap-3 pt-2 text-xs border-t border-line sm:grid-cols-3">
                <div className="rounded-md border border-line bg-card p-3">
                  <span className="font-semibold text-heading block">Database</span>
                  <span className="text-muted block mt-0.5 truncate">{healthInfo.database?.mode || 'In-memory fallback'}</span>
                  <span className={`inline-block mt-1.5 font-medium ${healthInfo.database?.connected ? 'text-success-fg' : 'text-warn-fg'}`}>
                    {healthInfo.database?.connected ? 'Supabase active' : 'Fallback active'}
                  </span>
                </div>
                <div className="rounded-md border border-line bg-card p-3">
                  <span className="font-semibold text-heading block">Gemini AI</span>
                  <span className="text-muted block mt-0.5">{healthInfo.gemini?.configured ? healthInfo.gemini.model : 'Rule-based fallback'}</span>
                  <span className={`inline-block mt-1.5 font-medium ${healthInfo.gemini?.configured ? 'text-success-fg' : 'text-warn-fg'}`}>
                    {healthInfo.gemini?.configured ? 'Live API ready' : 'Not configured'}
                  </span>
                </div>
                <div className="rounded-md border border-line bg-card p-3">
                  <span className="font-semibold text-heading block">TinyFish Retrieval</span>
                  <span className="text-muted block mt-0.5">{healthInfo.tinyfish?.configured ? 'Endpoint configured' : 'Not configured'}</span>
                  <span className={`inline-block mt-1.5 font-medium ${healthInfo.tinyfish?.configured ? 'text-success-fg' : 'text-warn-fg'}`}>
                    {healthInfo.tinyfish?.configured ? 'Proxy active' : 'Not configured'}
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-line px-5 py-4">
            <Button type="button" loading={testingBackend || backend.loading} onClick={testBackend}>
              <Icon name="refresh" size={14} />Check connection & sync
            </Button>
          </div>
        </Card>

        <form onSubmit={saveEndpoint}>
          <Card>
            <CardHeader title="TinyFish evidence retrieval" desc="Endpoint that performs live web retrieval for claims." />
            <div className="space-y-4 p-5">
              <Field label="Service endpoint URL" htmlFor="endpoint" error={endpointErr} hint="Medarina sends a POST request with the claim and expects JSON containing an evidence array. Recommended backend proxy: http://localhost:8000/api/tinyfish/retrieve">
                <input id="endpoint" type="url" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} className={inputCls} placeholder="http://localhost:8000/api/tinyfish/retrieve" />
              </Field>
              <Field label="API key (optional)" htmlFor="apikey" hint="Sent as an X-API-Key header. Stored in this browser only; prefer a server-side proxy that holds the key.">
                <input id="apikey" type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className={inputCls} />
              </Field>
              {test ? (
                <Notice tone={test.ok ? 'info' : 'error'} title={test.ok ? 'Connection succeeded' : 'Connection failed'}>{test.message}</Notice>
              ) : (
                <Notice tone={s.retrievalEndpoint ? 'info' : 'warn'} title={s.retrievalEndpoint ? 'Configured' : 'Not configured'}>{s.retrievalEndpoint ? (s.lastRetrievalError ? `Last retrieval failed: ${s.lastRetrievalError}` : 'An endpoint is saved. Use Test connection to check that it responds.') : 'No retrieval endpoint configured. Live retrieval is not active.'}</Notice>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-line px-5 py-4">
              {saved && <span role="status" className="text-sm text-success-fg">Saved</span>}
              <Button type="button" loading={testing} disabled={!s.retrievalEndpoint && !endpoint.trim()} onClick={async () => {
                setTesting(true)
                const targetCfg = getConfig({
                  retrievalEndpoint: endpoint.trim() || s.retrievalEndpoint,
                  tinyfishApiKey: apiKey.trim() || s.tinyfishApiKey,
                })
                setTest(await testConnection(targetCfg))
                setTesting(false)
              }}>Test connection</Button>
              <Button type="submit" variant="primary">Save endpoint</Button>
            </div>
          </Card>
        </form>

        <Card className="border-emerald/60">
          <CardHeader
            title="TinyFish Integration Diagnostics"
            desc="Safe live verification of endpoint reachability and automated browser extraction"
            action={
              <Button size="sm" variant="ghost" onClick={() => void refreshTinyFishStatus()}>
                <Icon name="refresh" size={14} /> Refresh Status
              </Button>
            }
          />
          <div className="space-y-4 p-5 text-sm">
            {/* Status overview */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-line bg-card p-3.5">
                <span className="text-xs text-muted block">Connection Status</span>
                <span className={`inline-flex items-center gap-1.5 mt-1 text-sm font-semibold ${
                  tfStatus.status === 'connected' ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
                }`}>
                  <span className={`h-2 w-2 rounded-full ${
                    tfStatus.status === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`} />
                  {tfStatus.status === 'connected' ? 'Connected & Authenticated' : tfStatus.status === 'checking' ? 'Checking...' : 'Unavailable'}
                </span>
                <span className="text-[11px] text-muted block mt-1">{tfStatus.pingMessage || 'API ping check passed'}</span>
              </div>

              <div className="rounded-lg border border-line bg-card p-3.5">
                <span className="text-xs text-muted block">Service Mode</span>
                <span className="text-sm font-semibold text-heading block mt-1">Autonomous Web Agent</span>
                <span className="text-[11px] font-mono text-muted block mt-1 truncate">{tfStatus.endpoint || 'https://agent.tinyfish.ai/v1/automation/run'}</span>
              </div>

              <div className="rounded-lg border border-line bg-card p-3.5">
                <span className="text-xs text-muted block">Last Crawler Run</span>
                <span className="text-sm font-semibold text-heading block mt-1">
                  {tfStatus.lastRun?.status ? `${tfStatus.lastRun.status.toUpperCase()} (${tfStatus.lastRun.sourceCount} sources)` : 'No recent run'}
                </span>
                <span className="text-[11px] text-muted block mt-1">
                  {tfStatus.lastRun?.durationSeconds ? `Execution time: ${tfStatus.lastRun.durationSeconds}s` : 'Awaiting live trigger'}
                </span>
              </div>
            </div>

            {/* Distinction explanation */}
            <div className="rounded-md border border-line bg-sage/40 p-3.5 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-medium text-heading">
                <Icon name="sparkles" size={14} className="text-primary" />
                <span>Diagnostics Distinction: API Ping vs. Live Crawler Execution</span>
              </div>
              <p className="text-muted leading-relaxed">
                <strong>API Ping (Fast):</strong> Checks whether the TinyFish Agent API endpoint is reachable and the server-side API key is valid.<br />
                <strong>Live Crawler Test (Real):</strong> Spawns an automated TinyFish browser worker, loads the target URL, extracts public policy guidelines, and returns structured citable evidence with timestamps and publisher information.
              </p>
            </div>

            {/* Controlled Live Test */}
            <div className="rounded-lg border border-line bg-card p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-semibold text-heading text-xs uppercase tracking-wide block">Run Controlled Live Test</span>
                  <span className="text-xs text-muted">Test live extraction against any stable public URL</span>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  loading={diagLoading}
                  disabled={diagLoading}
                  onClick={async () => {
                    setDiagLoading(true)
                    try {
                      const res = await runTinyFishDiagnostics(diagUrl.trim() || 'https://example.com')
                      setDiagResult(res)
                      void refreshTinyFishStatus()
                    } catch (err) {
                      setDiagResult({
                        ok: false,
                        status: 'failed',
                        targetUrl: diagUrl,
                        startedAt: new Date().toISOString(),
                        completedAt: new Date().toISOString(),
                        durationSeconds: 0,
                        sourceCount: 0,
                        evidence: [],
                        message: err instanceof Error ? err.message : 'Diagnostics run failed',
                      })
                    } finally {
                      setDiagLoading(false)
                    }
                  }}
                >
                  <Icon name="play" size={14} />
                  {diagLoading ? 'Crawling Page…' : 'Execute Live Test Retrieval'}
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted shrink-0">Test URL:</span>
                <input
                  type="url"
                  value={diagUrl}
                  onChange={(e) => setDiagUrl(e.target.value)}
                  className={`${inputCls} font-mono text-xs`}
                  placeholder="https://example.com"
                />
              </div>

              {diagResult && (
                <div className={`rounded-lg border p-4 space-y-2 text-xs ${
                  diagResult.ok
                    ? 'border-emerald-300 bg-emerald-50/70 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200'
                    : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200'
                }`}>
                  <div className="flex flex-wrap items-center justify-between gap-2 font-mono font-semibold">
                    <span>STATUS: {diagResult.status.toUpperCase()}</span>
                    <span>DURATION: {diagResult.durationSeconds}s</span>
                    <span>SOURCES: {diagResult.sourceCount}</span>
                  </div>
                  <p className="font-mono text-[11px] break-all">URL: {diagResult.targetUrl}</p>
                  <p className="font-medium text-fg">{diagResult.message}</p>
                  {diagResult.summary && (
                    <div className="rounded border border-line bg-card p-3 text-fg text-xs leading-relaxed">
                      <span className="font-semibold block mb-1 text-primary">Extracted Policy Summary:</span>
                      {diagResult.summary}
                    </div>
                  )}
                  {diagResult.evidence && diagResult.evidence.length > 0 && (
                    <div className="pt-2 border-t border-line/60">
                      <span className="font-semibold block mb-1">Returned Evidence Item:</span>
                      <p className="font-semibold text-fg">{diagResult.evidence[0].title}</p>
                      <p className="font-mono text-[11px] text-muted">{diagResult.evidence[0].publisher} · {diagResult.evidence[0].url}</p>
                      {diagResult.evidence[0].retrievedAt && (
                        <p className="text-[10px] text-muted mt-0.5">Retrieved at: {new Date(diagResult.evidence[0].retrievedAt).toLocaleString('en-US')}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Profile and preferences" desc="Stored on this device only. Sign-in is not connected." />
          <div className="grid gap-5 p-5 sm:grid-cols-2">
            <Field label="Display name" htmlFor="name"><input id="name" value={s.displayName} onChange={(e) => updateSettings({ displayName: e.target.value })} className={inputCls} /></Field>
            <Field label="Role" htmlFor="role"><input id="role" value={s.role} onChange={(e) => updateSettings({ role: e.target.value })} className={inputCls} /></Field>
            <Field label="Organization" htmlFor="org"><input id="org" value={s.organization} onChange={(e) => updateSettings({ organization: e.target.value })} className={inputCls} /></Field>
            <Field label="Rows per page" htmlFor="rows">
              <select id="rows" value={s.rowsPerPage} onChange={(e) => updateSettings({ rowsPerPage: +e.target.value })} className={inputCls}>
                {[5, 10, 25].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Onboarding" desc="Revisit the four-step introduction to Medarina." />
          <div className="p-5"><Button onClick={replayOnboarding}><Icon name="play" size={16} />Replay onboarding</Button></div>
        </Card>

        <Card>
          <CardHeader title="Workspace data" desc={`${realCount} active backend record${realCount === 1 ? '' : 's'} · ${sampleCount} demonstration sample${sampleCount === 1 ? '' : 's'}.`} />
          <div className="flex flex-wrap items-center gap-3 p-5">
            <Button onClick={removeSamples} disabled={!list.some((i) => i.sample)}>Remove sample investigations</Button>
            {confirm ? (
              <>
                <span className="text-sm text-muted">Delete all investigations?</span>
                <Button variant="danger" onClick={() => { clearAll(); setConfirm(false) }}>Delete all</Button>
                <Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
              </>
            ) : (
              <Button variant="danger" onClick={() => setConfirm(true)} disabled={!list.length}><Icon name="trash" size={16} />Delete all investigations</Button>
            )}
          </div>
        </Card>
      </div>
    </>
  )
}
