import { useState } from 'react'
import { Button, Card, CardHeader, Field, Icon, Notice, PageHeader, inputCls } from '../components/ui'
import { replayOnboarding } from '../lib/onboarding'
import { getConfig, testConnection } from '../lib/tinyfish'
import { clearAll, removeSamples, updateSettings, useInvestigations, useSettings, type ThemePref } from '../lib/store'

export default function SettingsPage() {
  const s = useSettings()
  const list = useInvestigations()
  const [endpoint, setEndpoint] = useState(s.retrievalEndpoint)
  const [apiKey, setApiKey] = useState(s.tinyfishApiKey)
  const [testing, setTesting] = useState(false)
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null)
  const [endpointErr, setEndpointErr] = useState('')
  const [saved, setSaved] = useState(false)
  const [confirm, setConfirm] = useState(false)

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

  return (
    <>
      <PageHeader title="Settings" desc="Appearance, retrieval service, profile, and local data." />
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

        <form onSubmit={saveEndpoint}>
          <Card>
            <CardHeader title="TinyFish evidence retrieval" desc="Endpoint that performs live web retrieval for claims." />
            <div className="space-y-4 p-5">
              <Field label="Service endpoint URL" htmlFor="endpoint" error={endpointErr} hint="Medarina sends a POST request with the claim and expects JSON containing an evidence array. Keep API keys on the server behind this endpoint, not in the browser.">
                <input id="endpoint" type="url" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} className={inputCls} placeholder="https://your-server.example/api/retrieve" />
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
              <Button type="button" loading={testing} disabled={!s.retrievalEndpoint} onClick={async () => { setTesting(true); setTest(await testConnection(getConfig(s))); setTesting(false) }}>Test connection</Button>
              <Button type="submit" variant="primary">Save endpoint</Button>
            </div>
          </Card>
        </form>

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
          <CardHeader title="Local data" desc={`${list.length} investigation${list.length === 1 ? '' : 's'} stored in this browser.`} />
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
