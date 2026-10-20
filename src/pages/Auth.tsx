import { useState } from 'react'
import { Button, Field, Icon, Logo, Modal, Notice, inputCls } from '../components/ui'
import { accountExists, continueAsGuest, resetPassword, signIn, signUp } from '../lib/auth'
import { navigate } from '../lib/router'
import { toast } from '../lib/toast'

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())

function PasswordInput({ id, value, onChange, invalid, autoComplete }: { id: string; value: string; onChange: (v: string) => void; invalid?: boolean; autoComplete: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input id={id} type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid} autoComplete={autoComplete} className={`${inputCls} pr-10`} />
      <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-muted hover:bg-sage hover:text-fg">
        <Icon name="eye" size={16} />
      </button>
    </div>
  )
}

function ForgotPassword({ onClose, initialEmail }: { onClose: () => void; initialEmail: string }) {
  const [step, setStep] = useState<'email' | 'reset' | 'done'>('email')
  const [email, setEmail] = useState(initialEmail)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  function next(e: React.FormEvent) {
    e.preventDefault()
    if (!emailOk(email)) return setErr('Enter a valid email address.')
    if (!accountExists(email)) return setErr('No account with this email was found on this device.')
    setErr('')
    setStep('reset')
  }
  async function reset(e: React.FormEvent) {
    e.preventDefault()
    if (pw.length < 8) return setErr('Use at least 8 characters.')
    if (pw !== pw2) return setErr('Passwords do not match.')
    setBusy(true)
    try {
      await resetPassword(email, pw)
      setStep('done')
    } catch (x) {
      setErr(x instanceof Error ? x.message : 'Password could not be reset.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={step === 'done' ? 'Password updated' : 'Reset password'} onClose={onClose}>
      {step === 'email' && (
        <form onSubmit={next} noValidate className="space-y-4">
          <p className="text-sm text-muted">Enter the email for your account. Email delivery is not connected, so a reset link cannot be sent; accounts on this device can be reset directly.</p>
          <Field label="Email address" htmlFor="fp-email" error={err}>
            <input id="fp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} autoComplete="email" />
          </Field>
          <div className="flex justify-end gap-3"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" variant="primary">Continue</Button></div>
        </form>
      )}
      {step === 'reset' && (
        <form onSubmit={reset} noValidate className="space-y-4">
          <p className="text-sm text-muted">Set a new password for <span className="font-medium text-fg">{email}</span>.</p>
          <Field label="New password" htmlFor="fp-pw" hint="At least 8 characters."><PasswordInput id="fp-pw" value={pw} onChange={setPw} autoComplete="new-password" /></Field>
          <Field label="Confirm new password" htmlFor="fp-pw2" error={err}><PasswordInput id="fp-pw2" value={pw2} onChange={setPw2} autoComplete="new-password" /></Field>
          <div className="flex justify-end gap-3"><Button type="button" variant="ghost" onClick={() => { setStep('email'); setErr('') }}>Back</Button><Button type="submit" variant="primary" loading={busy}>Update password</Button></div>
        </form>
      )}
      {step === 'done' && (
        <div className="space-y-4">
          <Notice title="Password reset complete">You can now sign in with your new password.</Notice>
          <div className="flex justify-end"><Button variant="primary" onClick={onClose}>Return to sign in</Button></div>
        </div>
      )}
    </Modal>
  )
}

function Visual() {
  return (
    <div className="relative hidden flex-1 overflow-hidden border-l border-line bg-sage lg:flex lg:flex-col lg:justify-between lg:p-12">
      <svg className="pointer-events-none absolute inset-0 h-full w-full text-primary opacity-[0.07]" aria-hidden="true">
        <defs><pattern id="g" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="currentColor" strokeWidth="1" /></pattern></defs>
        <rect width="100%" height="100%" fill="url(#g)" />
      </svg>
      <div className="relative">
        <h2 className="max-w-md text-2xl font-semibold tracking-tight text-heading">Evidence review with a clear audit trail</h2>
        <p className="mt-3 max-w-md text-sm text-muted">Medarina helps claim reviewers record claims, organize source evidence, and keep every finding traceable for human decision-making.</p>
      </div>
      <svg viewBox="0 0 440 240" className="relative my-8 w-full max-w-lg self-center" role="img" aria-label="Illustration of a claim record with evidence check marks and a heart-rate trace">
        <rect x="40" y="20" width="250" height="190" rx="12" fill="var(--card)" stroke="var(--line)" />
        <rect x="60" y="42" width="90" height="8" rx="4" fill="var(--mint)" />
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(0 ${i * 40})`}>
            <rect x="60" y="72" width="22" height="22" rx="6" fill={i === 1 ? 'var(--sky-bg)' : 'var(--mint)'} />
            <path d={i === 1 ? 'M67 83h8' : 'm66 83 4 4 7-8'} stroke={i === 1 ? 'var(--info)' : 'var(--primary)'} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="94" y="76" width={150 - i * 22} height="6" rx="3" fill="var(--line)" />
            <rect x="94" y="88" width={100 - i * 14} height="5" rx="2.5" fill="var(--line)" opacity="0.6" />
          </g>
        ))}
        <rect x="250" y="130" width="170" height="86" rx="12" fill="var(--card)" stroke="var(--line)" />
        <path d="M266 176h24l10-22 14 40 12-30 8 12h40" fill="none" stroke="var(--sky)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="388" cy="158" r="4" fill="var(--primary)" />
      </svg>
      <ul className="relative space-y-2.5 text-sm">
        {['Source provenance recorded for every finding', 'Verified, unverified, and conflicting evidence kept separate', 'Human review required before any determination'].map((t) => (
          <li key={t} className="flex items-center gap-2.5"><span className="grid h-5 w-5 place-items-center rounded-full bg-mint text-mint-fg"><Icon name="check" size={12} /></span>{t}</li>
        ))}
      </ul>
    </div>
  )
}

export default function Auth({ mode }: { mode: 'signin' | 'signup' }) {
  const signup = mode === 'signup'
  const [f, setF] = useState({ name: '', organization: '', email: '', password: '', confirm: '' })
  const [remember, setRemember] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [forgot, setForgot] = useState(false)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const err: Record<string, string> = {}
    if (signup && f.name.trim().length < 2) err.name = 'Enter your full name.'
    if (!emailOk(f.email)) err.email = 'Enter a valid email address.'
    if (!f.password) err.password = 'Enter your password.'
    else if (signup && f.password.length < 8) err.password = 'Use at least 8 characters.'
    if (signup && f.confirm !== f.password) err.confirm = 'Passwords do not match.'
    setErrors(err)
    setFormError('')
    if (Object.keys(err).length) return
    setBusy(true)
    try {
      if (signup) {
        await signUp({ name: f.name, email: f.email, password: f.password, organization: f.organization })
        toast('success', 'Account created on this device.')
      } else {
        await signIn(f.email, f.password, remember)
        toast('success', 'Signed in.')
      }
      navigate('/')
    } catch (x) {
      setFormError(x instanceof Error ? x.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-page text-fg">
      <div className="flex w-full flex-col justify-center px-6 py-10 sm:px-12 lg:w-[480px] lg:shrink-0">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5"><Logo size={34} /><span className="text-xl font-semibold tracking-tight text-heading">Medarina</span></div>
          <h1 className="text-2xl font-semibold tracking-tight text-heading">{signup ? 'Create your account' : 'Sign in'}</h1>
          <p className="mt-1.5 text-sm text-muted">{signup ? 'Set up access to the claim investigation workspace.' : 'Access your claim investigation workspace.'}</p>

          <form onSubmit={submit} noValidate className="mt-6 space-y-4">
            {formError && <Notice tone="error" title={signup ? 'Account could not be created' : 'Sign-in failed'}>{formError}</Notice>}
            {signup && (
              <>
                <Field label="Full name" htmlFor="name" error={errors.name}><input id="name" value={f.name} onChange={set('name')} autoComplete="name" aria-invalid={!!errors.name} className={inputCls} /></Field>
                <Field label="Organization (optional)" htmlFor="org"><input id="org" value={f.organization} onChange={set('organization')} autoComplete="organization" className={inputCls} /></Field>
              </>
            )}
            <Field label="Email address" htmlFor="email" error={errors.email}><input id="email" type="email" value={f.email} onChange={set('email')} autoComplete="email" aria-invalid={!!errors.email} className={inputCls} /></Field>
            <Field label="Password" htmlFor="password" error={errors.password} hint={signup && !errors.password ? 'At least 8 characters.' : undefined}>
              <PasswordInput id="password" value={f.password} onChange={(v) => setF({ ...f, password: v })} invalid={!!errors.password} autoComplete={signup ? 'new-password' : 'current-password'} />
            </Field>
            {signup && <Field label="Confirm password" htmlFor="confirm" error={errors.confirm}><PasswordInput id="confirm" value={f.confirm} onChange={(v) => setF({ ...f, confirm: v })} invalid={!!errors.confirm} autoComplete="new-password" /></Field>}
            {!signup && (
              <div className="flex items-center justify-between text-sm">
                <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />Remember me</label>
                <button type="button" onClick={() => setForgot(true)} className="font-medium text-info hover:underline">Forgot password?</button>
              </div>
            )}
            <Button type="submit" variant="primary" loading={busy} className="w-full">{signup ? 'Create account' : 'Sign in'}</Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted">
            {signup ? 'Already have an account? ' : 'New to Medarina? '}
            <a href={signup ? '#/signin' : '#/signup'} className="font-medium text-info hover:underline">{signup ? 'Sign in' : 'Create an account'}</a>
          </p>

          <div className="my-6 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
          <Button variant="secondary" className="w-full" onClick={() => { continueAsGuest(); navigate('/') }}>Explore sample workspace</Button>
          <p className="mt-4 flex gap-2 text-xs text-muted"><Icon name="lock" size={14} className="mt-0.5" />Accounts are stored in this browser only. Server-side authentication is not connected, so do not use credentials from another system.</p>
        </div>
      </div>
      <Visual />
      {forgot && <ForgotPassword initialEmail={f.email} onClose={() => setForgot(false)} />}
    </div>
  )
}
