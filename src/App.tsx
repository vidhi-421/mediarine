import { useEffect, useMemo, useState } from 'react'
import { ConfirmDialog, Icon, Logo, MenuItem, Popover, ToastHost } from './components/ui'
import { applyTheme, resolveTheme, updateSettings, useInvestigations, useSettings, useBackendStatus, useTinyFishStatus, syncWithBackend, type ThemePref } from './lib/store'
import { navigate, useRoute } from './lib/router'
import { signOut, useSession } from './lib/auth'
import { toast } from './lib/toast'
import Overview from './pages/Overview'
import NewInvestigation from './pages/NewInvestigation'
import InvestigationDetail from './pages/InvestigationDetail'
import History from './pages/History'
import Sources from './pages/Sources'
import SettingsPage from './pages/Settings'
import Help from './pages/Help'
import Auth from './pages/Auth'
import Report from './pages/Report'
import Onboarding from './components/Onboarding'
import { useOnboarding } from './lib/onboarding'

const NAV = [
  { to: '/', label: 'Overview', icon: 'overview' },
  { to: '/new', label: 'New Investigation', icon: 'plus' },
  { to: '/investigations', label: 'Investigation History', icon: 'history' },
  { to: '/sources', label: 'Evidence Management', icon: 'sources' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
  { to: '/help', label: 'Help & Support', icon: 'help' },
]

function isActive(route: string, to: string) {
  if (to === '/') return route === '/'
  if (to === '/investigations') return route.startsWith('/investigations')
  return route === to
}

function useThemeEffect() {
  const { theme } = useSettings()
  const [dark, setDark] = useState(() => resolveTheme(theme) === 'dark')
  useEffect(() => {
    applyTheme(theme)
    setDark(resolveTheme(theme) === 'dark')
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const on = () => {
      applyTheme('system')
      setDark(mq.matches)
    }
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [theme])
  return dark
}

function Notifications() {
  const list = useInvestigations()
  const { readNotifications } = useSettings()
  const items = useMemo(
    () =>
      list
        .filter((i) => !i.archived && ['failed', 'review', 'pending'].includes(i.status))
        .slice(0, 8)
        .map((i) => ({
          key: `${i.id}:${i.status}`,
          id: i.id,
          sample: i.sample,
          icon: i.status === 'failed' ? 'alert' : i.status === 'review' ? 'alert' : 'history',
          tone: i.status === 'failed' ? 'text-crit-fg' : i.status === 'review' ? 'text-warn-fg' : 'text-info',
          title: i.status === 'failed' ? 'Source Retrieval Failed' : i.status === 'review' ? 'Review Required' : 'Pending Review',
          text: `${i.ref} · ${i.claim}`,
        })),
    [list],
  )
  const unread = items.filter((n) => !readNotifications.includes(n.key))
  return (
    <Popover
      label="Notifications"
      className="w-[min(22rem,calc(100vw-2rem))]"
      trigger={({ open, toggle }) => (
        <button onClick={toggle} aria-label={`Notifications${unread.length ? `, ${unread.length} unread` : ''}`} aria-expanded={open} title="Notifications" className="relative grid h-9 w-9 place-items-center rounded-md border border-line bg-card hover:bg-sage">
          <Icon name="bell" />
          {unread.length > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-fg">{unread.length}</span>}
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold text-heading">Notifications</h2>
            <button disabled={!unread.length} onClick={() => updateSettings({ readNotifications: [...readNotifications, ...unread.map((n) => n.key)] })} className="text-xs font-medium text-info hover:underline disabled:opacity-50 disabled:no-underline">Mark all as read</button>
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">No notifications. Items requiring attention will appear here.</p>
          ) : (
            <ul className="max-h-80 divide-y divide-line overflow-y-auto">
              {items.map((n) => (
                <li key={n.key}>
                  <a href={`#/investigations/${n.id}`} onClick={() => { updateSettings({ readNotifications: [...new Set([...readNotifications, n.key])] }); close() }} className="flex gap-3 px-4 py-3 hover:bg-sage">
                    <Icon name={n.icon} className={`mt-0.5 ${n.tone}`} size={16} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-sm font-medium">{n.title}{!readNotifications.includes(n.key) && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-label="Unread" />}{n.sample && <span className="text-[11px] font-normal text-muted">Sample</span>}</span>
                      <span className="line-clamp-2 text-xs text-muted">{n.text}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Popover>
  )
}

function Shell({ route }: { route: string }) {
  const settings = useSettings()
  const backend = useBackendStatus()
  const tfStatus = useTinyFishStatus()
  const session = useSession()!
  const dark = useThemeEffect()
  const collapsed = settings.sidebarCollapsed
  const [open, setOpen] = useState(false)
  const [confirmOut, setConfirmOut] = useState(false)
  const [q, setQ] = useState('')

  useEffect(() => {
    setOpen(false)
    window.scrollTo(0, 0)
  }, [route])

  const name = session.guest ? settings.displayName || 'Reviewer' : session.name
  const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  const detail = route.match(/^\/investigations\/([^/]+)$/)
  const report = route.match(/^\/investigations\/([^/]+)\/report$/)
  const onboarding = useOnboarding(session.guest ? 'guest' : session.email)

  let page
  if (route === '/new') page = <NewInvestigation />
  else if (report) page = <Report id={report[1]} />
  else if (detail) page = <InvestigationDetail id={detail[1]} />
  else if (route === '/investigations') page = <History />
  else if (route === '/sources') page = <Sources />
  else if (route === '/settings') page = <SettingsPage />
  else if (route === '/help') page = <Help />
  else page = <Overview name={name} />

  const nav = (compact: boolean) => (
    <div className="flex h-full flex-col">
      <a href="#/" className={`flex items-center gap-2.5 py-5 ${compact ? 'justify-center' : 'px-5'}`} aria-label="Medarina home">
        <Logo />
        {!compact && (
          <div className="flex flex-col">
            <span className="text-[17px] font-semibold tracking-tight text-heading">Medarina</span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted">Clinical Audit</span>
          </div>
        )}
      </a>
      <nav aria-label="Primary" className="flex-1 space-y-1 px-3">
        {NAV.map((n) => {
          const active = isActive(route, n.to)
          return (
            <a key={n.to} href={`#${n.to}`} title={compact ? n.label : undefined} aria-label={compact ? n.label : undefined} aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-all ${compact ? 'justify-center px-0' : 'px-3.5'} ${
                active
                  ? 'bg-primary text-primary-fg shadow-sm font-semibold'
                  : 'text-fg hover:bg-sage/70 hover:translate-x-0.5'
              }`}>
              <Icon name={n.icon} size={18} />
              {!compact && <span>{n.label}</span>}
            </a>
          )
        })}
      </nav>
      <div className="space-y-2 p-3">
        {session.guest && !compact && <p className="rounded-md bg-sky-bg px-3 py-2 text-xs text-info">Sample workspace session. <a href="#/signup" className="font-medium underline">Create an account</a></p>}
        <button onClick={() => updateSettings({ sidebarCollapsed: !collapsed })} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className={`hidden w-full items-center gap-3 rounded-md py-2 text-sm text-muted hover:bg-sage hover:text-fg lg:flex ${compact ? 'justify-center' : 'px-3'}`}>
          <Icon name="panel" />{!compact && (collapsed ? 'Expand' : 'Collapse Sidebar')}
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-page text-fg">
      <aside className={`fixed inset-y-0 left-0 z-30 hidden print:!hidden border-r border-line bg-sidebar sidebar-scope transition-[width] duration-200 lg:block ${collapsed ? 'w-[72px]' : 'w-64'}`}>{nav(collapsed)}</aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-line bg-sidebar sidebar-scope shadow-pop" aria-label="Navigation menu">
            <button onClick={() => setOpen(false)} aria-label="Close navigation" className="absolute right-3 top-4 rounded-md p-1.5 text-muted hover:bg-sage"><Icon name="x" /></button>
            {nav(false)}
          </aside>
        </div>
      )}

      <div className={`transition-[padding] duration-200 print:!pl-0 ${collapsed ? 'lg:pl-[72px]' : 'lg:pl-64'}`}>
        <header className="sticky top-0 z-20 flex print:hidden h-14 items-center gap-3 border-b border-line bg-card/95 backdrop-blur-sm px-4 sm:px-8">
          <button onClick={() => setOpen(true)} aria-label="Open navigation" aria-expanded={open} className="rounded-md p-1.5 hover:bg-sage lg:hidden"><Icon name="menu" /></button>
          
          <form role="search" className="relative max-w-md flex-1" onSubmit={(e) => { e.preventDefault(); if (q.trim()) navigate(`/investigations?q=${encodeURIComponent(q.trim())}`) }}>
            <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input aria-label="Search investigations" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search investigations, claims, CPT codes..." className="h-9 w-full rounded-lg border border-line bg-page/70 pl-9 pr-12 text-sm placeholder:text-muted hover:border-emerald focus:border-primary focus:bg-card transition-colors" />
            <kbd className="hidden sm:inline-flex absolute right-2.5 top-1/2 -translate-y-1/2 items-center rounded border border-line bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted">↵</kbd>
          </form>

          <div className="ml-auto flex items-center gap-2">
            {/* Live Backend Connection Indicator */}
            <div
              className={`hidden sm:inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                backend.connected
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : backend.loading
                    ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                    : 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
              }`}
              title={`API: ${backend.endpoint} · Supabase Connected`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  backend.connected
                    ? 'bg-emerald-500 animate-pulse'
                    : backend.loading
                      ? 'bg-amber-400 animate-ping'
                      : 'bg-rose-500'
                }`}
              />
              <span>
                {backend.connected
                  ? 'FastAPI + Supabase Live'
                  : backend.loading
                    ? 'Connecting to Backend...'
                    : 'Backend Offline'}
              </span>
            </div>

            {/* Live TinyFish Service Indicator */}
            <div
              className={`hidden md:inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                tfStatus.status === 'connected'
                  ? 'border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300'
                  : tfStatus.status === 'checking'
                    ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                    : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
              }`}
              title={tfStatus.pingMessage || 'TinyFish Live Web Crawler'}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  tfStatus.status === 'connected'
                    ? 'bg-purple-500 animate-pulse'
                    : tfStatus.status === 'checking'
                      ? 'bg-amber-400 animate-ping'
                      : 'bg-slate-400'
                }`}
              />
              <span>
                TinyFish: {tfStatus.status === 'connected' ? 'Connected' : tfStatus.status === 'checking' ? 'Checking' : 'Unavailable'}
              </span>
            </div>

            <Notifications />
            <button onClick={() => updateSettings({ theme: dark ? 'light' : 'dark' })} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} title={dark ? 'Switch to light theme' : 'Switch to dark theme'} className="grid h-9 w-9 place-items-center rounded-md border border-line bg-card hover:bg-sage">
              <Icon name={dark ? 'sun' : 'moon'} />
            </button>
            <Popover
              label="Account menu"
              className="w-64"
              trigger={({ open, toggle }) => (
                <button onClick={toggle} aria-expanded={open} aria-label="Account menu" className="flex h-9 items-center gap-2 rounded-md border border-line bg-card pl-1 pr-2 hover:bg-sage">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-mint text-xs font-semibold text-mint-fg">{initials}</span>
                  <Icon name="down" size={14} className="text-muted" />
                </button>
              )}
            >
              {(close) => (
                <div className="p-1.5">
                  <div className="px-3 py-2">
                    <p className="truncate text-sm font-semibold text-heading">{name}</p>
                    <p className="truncate text-xs text-muted">{session.guest ? 'Sample workspace session' : session.email}</p>
                  </div>
                  <div className="my-1 border-t border-line" />
                  <p className="px-3 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">Theme</p>
                  <div role="radiogroup" aria-label="Theme" className="flex gap-1 px-2 pb-2">
                    {(['light', 'dark', 'system'] as ThemePref[]).map((t) => (
                      <button key={t} role="radio" aria-checked={settings.theme === t} onClick={() => updateSettings({ theme: t })} className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium capitalize ${settings.theme === t ? 'bg-mint text-mint-fg' : 'text-muted hover:bg-sage'}`}>{t}</button>
                    ))}
                  </div>
                  <div className="border-t border-line pt-1">
                    <MenuItem icon="settings" href="#/settings" onClick={close}>Settings</MenuItem>
                    <MenuItem icon="help" href="#/help" onClick={close}>Help & Support</MenuItem>
                    <MenuItem icon="logout" danger onClick={() => { close(); setConfirmOut(true) }}>Sign out</MenuItem>
                  </div>
                </div>
              )}
            </Popover>
          </div>
        </header>
        {!backend.connected && !backend.loading && (
          <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-8 print:hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-warn-bg px-4 py-2.5 text-xs text-warn-fg shadow-sm">
              <div className="flex items-center gap-2">
                <Icon name="alert" size={15} className="shrink-0" />
                <span>
                  <strong>Demo Fallback Mode:</strong> FastAPI backend at <code className="font-mono">{backend.endpoint}</code> is not connected. Local browser storage is active.
                </span>
              </div>
              <button
                type="button"
                onClick={() => void syncWithBackend()}
                className="font-medium underline hover:no-underline shrink-0"
              >
                Retry connection
              </button>
            </div>
          </div>
        )}
        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 print:max-w-none print:p-0">{page}</main>
      </div>

      {onboarding.open && <Onboarding onClose={onboarding.finish} />}
      {confirmOut && (
        <ConfirmDialog title="Sign out" confirmLabel="Sign out" onClose={() => setConfirmOut(false)}
          body="You will be returned to the sign-in screen. Investigations stored in this browser are kept."
          onConfirm={() => { signOut(); setConfirmOut(false); navigate('/signin'); toast('info', 'You have been signed out.') }} />
      )}
    </div>
  )
}

export default function App() {
  const route = useRoute()
  const session = useSession()
  useThemeEffect()

  useEffect(() => {
    if (!session && route !== '/signin' && route !== '/signup') navigate('/signin')
    if (session && (route === '/signin' || route === '/signup')) navigate('/')
  }, [session, route])

  let content = null
  if (!session) content = <Auth key={route} mode={route === '/signup' ? 'signup' : 'signin'} />
  else if (route !== '/signin' && route !== '/signup') content = <Shell route={route} />

  return (
    <>
      {content}
      <ToastHost />
    </>
  )
}
