import { useEffect, useState, type ReactNode } from 'react'
import { Button, Card, CardHeader, ConfirmDialog, Field, Icon, Notice, PageHeader, Stepper, inputCls } from '../components/ui'
import { CATEGORIES, createInvestigation, fmtMoney, useSettings, type BillingCode, type CodeType, type TimelineEvent } from '../lib/store'
import { navigate, useQuery } from '../lib/router'
import { toast } from '../lib/toast'

interface Form {
  claim: string
  category: string
  ref: string
  provider: string
  sourceUrl: string
  details: string
  serviceDateFrom: string
  serviceDateTo: string
  billingDate: string
  billedAmount: string
  codes: BillingCode[]
  timeline: TimelineEvent[]
  reviewerNotes: string
  runNow: boolean
}

const empty = (): Form => ({
  claim: '', category: CATEGORIES[0], ref: '', provider: '', sourceUrl: '', details: '',
  serviceDateFrom: '', serviceDateTo: '', billingDate: '', billedAmount: '',
  codes: [{ code: '', type: 'CPT', description: '' }],
  timeline: [{ date: '', event: '' }],
  reviewerNotes: '', runNow: true,
})

const sample = (): Form => ({
  claim: 'Provider billed a level 5 established-patient visit and a separate same-day minor procedure for a routine follow-up.',
  category: 'Billing and Coding',
  ref: '',
  provider: 'Westbrook Family Medicine',
  sourceUrl: 'https://www.cms.gov',
  details: 'Visit lasted approximately 20 minutes per the encounter summary. Modifier 25 was appended to the evaluation code.',
  serviceDateFrom: '2026-02-10',
  serviceDateTo: '2026-02-10',
  billingDate: '2026-02-12',
  billedAmount: '428.00',
  codes: [
    { code: '99215', type: 'CPT', description: 'Office visit, established patient, high complexity' },
    { code: '11200', type: 'CPT', description: 'Removal of skin tags, up to 15 lesions' },
    { code: 'L91.8', type: 'ICD-10', description: 'Other hypertrophic disorders of the skin' },
  ],
  timeline: [
    { date: '2026-01-20', event: 'Prior visit; skin tags noted, removal discussed' },
    { date: '2026-02-10', event: 'Follow-up visit; skin tag removal performed' },
    { date: '2026-02-12', event: 'Claim submitted with modifier 25' },
  ],
  reviewerNotes: 'Check whether the evaluation was significant and separately identifiable from the procedure.',
  runNow: true,
})

function Section({ title, desc, children }: { title: string; desc: string; children: ReactNode }) {
  return (
    <div className="border-b border-line last:border-b-0">
      <div className="bg-sage px-5 py-3">
        <h3 className="text-sm font-semibold text-heading">{title}</h3>
        <p className="text-xs text-muted">{desc}</p>
      </div>
      <div className="space-y-5 p-5">{children}</div>
    </div>
  )
}

const isUrl = (v: string) => { try { return /^https?:$/.test(new URL(v).protocol) } catch { return false } }

function validateStep(step: number, f: Form) {
  const e: Record<string, string> = {}
  if (step === 0) {
    if (f.claim.trim().length < 15) e.claim = 'Enter the claim statement to investigate (at least 15 characters).'
    if (f.sourceUrl.trim() && !isUrl(f.sourceUrl.trim())) e.sourceUrl = 'Enter a valid http or https URL.'
    if (!f.serviceDateFrom) e.serviceDateFrom = 'Enter the first date of service.'
    if (!f.serviceDateTo) e.serviceDateTo = 'Enter the last date of service.'
    else if (f.serviceDateFrom && f.serviceDateTo < f.serviceDateFrom) e.serviceDateTo = 'End date must be on or after the start date.'
    if (!f.billingDate) e.billingDate = 'Enter the billing date.'
    const amt = Number(f.billedAmount)
    if (!f.billedAmount.trim() || !Number.isFinite(amt) || amt <= 0) e.billedAmount = 'Enter a billed amount greater than 0.'
    if (!f.codes.some((c) => c.code.trim())) e.codes = 'Add at least one billing code.'
  } else {
    if (f.timeline.some((t) => (t.date && !t.event.trim()) || (!t.date && t.event.trim()))) e.timeline = 'Each timeline entry needs both a date and an event, or leave the row empty.'
  }
  return e
}

export default function NewInvestigation() {
  const { retrievalEndpoint } = useSettings()
  const query = useQuery()
  const [f, setF] = useState<Form>(empty)
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirm, setConfirm] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })

  useEffect(() => {
    if (query.get('sample') === '1') { setF(sample()); toast('info', 'Sample claim loaded. Review the fields before submitting.') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setCode = (i: number, patch: Partial<BillingCode>) => setF({ ...f, codes: f.codes.map((c, k) => (k === i ? { ...c, ...patch } : c)) })
  const setEvent = (i: number, patch: Partial<TimelineEvent>) => setF({ ...f, timeline: f.timeline.map((t, k) => (k === i ? { ...t, ...patch } : t)) })

  function next() {
    const e = validateStep(0, f)
    setErrors(e)
    if (Object.keys(e).length) { toast('error', 'Review the highlighted fields before continuing.'); return }
    setStep(1)
    window.scrollTo(0, 0)
  }

  function review(ev: React.FormEvent) {
    ev.preventDefault()
    if (step === 0) return next()
    const e = { ...validateStep(0, f), ...validateStep(1, f) }
    setErrors(e)
    if (Object.keys(e).length) {
      if (Object.keys(validateStep(0, f)).length) setStep(0)
      toast('error', 'Review the highlighted fields before submitting.')
      return
    }
    setConfirm(true)
  }

  async function submit() {
    setBusy(true)
    try {
      const inv = await createInvestigation({
        ...f,
        billedAmount: Number(f.billedAmount),
        billingCodes: f.codes.filter((c) => c.code.trim()).map((c) => ({ ...c, code: c.code.trim().toUpperCase(), description: c.description.trim() })),
        clinicalTimeline: f.timeline.filter((t) => t.date && t.event.trim()).sort((a, b) => a.date.localeCompare(b.date)),
        runNow: f.runNow,
      })
      setConfirm(false)
      toast('success', `Investigation ${inv.ref} submitted.`)
      navigate(`/investigations/${inv.id}`)
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Failed to submit investigation.')
    } finally {
      setBusy(false)
    }
  }

  const codesValid = f.codes.filter((c) => c.code.trim())

  return (
    <>
      <PageHeader
        title="New Investigation"
        desc="Record the claim, billing details, and clinical context. Evidence retrieval can start after submission."
        action={
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => { setF(sample()); setErrors({}); toast('info', 'Sample claim loaded.') }}><Icon name="file" size={16} />Load Sample Claim</Button>
            <Button type="button" variant="ghost" onClick={() => setConfirmClear(true)}><Icon name="x" size={16} />Clear Form</Button>
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <form onSubmit={review} noValidate className="lg:col-span-2">
          <Card className="overflow-hidden">
            <div className="border-b border-line px-5 py-4"><Stepper steps={['Claim Details', 'Clinical Context']} current={step} /></div>

            {step === 0 ? (
              <>
                <Section title="Claim" desc="What is being investigated.">
                  <Field label="Claim statement" htmlFor="claim" error={errors.claim} hint="State the claim as it was submitted, without interpretation.">
                    <textarea id="claim" rows={3} value={f.claim} onChange={set('claim')} aria-invalid={!!errors.claim} className={inputCls} placeholder="e.g. Provider billed 11 units of a timed therapy code for one patient on a single date of service." />
                  </Field>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Claim category" htmlFor="category">
                      <select id="category" value={f.category} onChange={set('category')} className={inputCls}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
                    </Field>
                    <Field label="Claim reference (optional)" htmlFor="ref" hint="Generated automatically if left blank.">
                      <input id="ref" value={f.ref} onChange={set('ref')} className={inputCls} placeholder="CLM-2026-0000" />
                    </Field>
                    <Field label="Provider or organization (optional)" htmlFor="provider"><input id="provider" value={f.provider} onChange={set('provider')} className={inputCls} /></Field>
                    <Field label="Source URL (optional)" htmlFor="sourceUrl" error={errors.sourceUrl}>
                      <input id="sourceUrl" type="url" inputMode="url" value={f.sourceUrl} onChange={set('sourceUrl')} aria-invalid={!!errors.sourceUrl} className={inputCls} placeholder="https://" />
                    </Field>
                  </div>
                </Section>
                <Section title="Billing" desc="Service dates, amount, and submitted codes.">
                  <div className="grid gap-5 sm:grid-cols-3">
                    <Field label="Service date from" htmlFor="sdf" error={errors.serviceDateFrom}><input id="sdf" type="date" value={f.serviceDateFrom} onChange={set('serviceDateFrom')} aria-invalid={!!errors.serviceDateFrom} className={inputCls} /></Field>
                    <Field label="Service date to" htmlFor="sdt" error={errors.serviceDateTo}><input id="sdt" type="date" min={f.serviceDateFrom || undefined} value={f.serviceDateTo} onChange={set('serviceDateTo')} aria-invalid={!!errors.serviceDateTo} className={inputCls} /></Field>
                    <Field label="Billing date" htmlFor="bd" error={errors.billingDate}><input id="bd" type="date" value={f.billingDate} onChange={set('billingDate')} aria-invalid={!!errors.billingDate} className={inputCls} /></Field>
                  </div>
                  <Field label="Billed amount (USD)" htmlFor="amt" error={errors.billedAmount}>
                    <div className="relative sm:max-w-xs">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
                      <input id="amt" inputMode="decimal" value={f.billedAmount} onChange={(e) => setF({ ...f, billedAmount: e.target.value.replace(/[^0-9.]/g, '') })} aria-invalid={!!errors.billedAmount} className={`${inputCls} tabular pl-7`} placeholder="0.00" />
                    </div>
                  </Field>
                  <div>
                    <p className="mb-1.5 text-[13px] font-medium">Billing codes</p>
                    <div className="space-y-2">
                      {f.codes.map((c, i) => (
                        <div key={i} className="grid grid-cols-[6.5rem_1fr_auto] gap-2 sm:grid-cols-[6.5rem_8rem_1fr_auto]">
                          <select aria-label={`Code ${i + 1} type`} value={c.type} onChange={(e) => setCode(i, { type: e.target.value as CodeType })} className={inputCls}>
                            {(['CPT', 'ICD-10', 'HCPCS'] as CodeType[]).map((t) => <option key={t}>{t}</option>)}
                          </select>
                          <input aria-label={`Code ${i + 1}`} value={c.code} onChange={(e) => setCode(i, { code: e.target.value })} className={`${inputCls} tabular`} placeholder="99213" />
                          <input aria-label={`Code ${i + 1} description`} value={c.description} onChange={(e) => setCode(i, { description: e.target.value })} className={`${inputCls} col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto`} placeholder="Description" />
                          <button type="button" aria-label={`Remove code ${i + 1}`} disabled={f.codes.length === 1} onClick={() => setF({ ...f, codes: f.codes.filter((_, k) => k !== i) })} className="grid h-[38px] w-9 place-items-center rounded-md text-muted hover:bg-sage hover:text-crit-fg disabled:opacity-40 col-start-3 row-start-1 sm:col-start-auto"><Icon name="trash" size={16} /></button>
                        </div>
                      ))}
                    </div>
                    {errors.codes && <p role="alert" className="mt-1 text-xs text-crit-fg">{errors.codes}</p>}
                    <Button type="button" size="sm" className="mt-2" onClick={() => setF({ ...f, codes: [...f.codes, { code: '', type: 'CPT', description: '' }] })}><Icon name="plus" size={14} />Add code</Button>
                  </div>
                </Section>
              </>
            ) : (
              <>
                <Section title="Clinical timeline" desc="Encounters, orders, and submissions in date order.">
                  <div className="space-y-2">
                    {f.timeline.map((t, i) => (
                      <div key={i} className="grid grid-cols-[9.5rem_1fr_auto] gap-2">
                        <input type="date" aria-label={`Event ${i + 1} date`} value={t.date} onChange={(e) => setEvent(i, { date: e.target.value })} className={inputCls} />
                        <input aria-label={`Event ${i + 1} description`} value={t.event} onChange={(e) => setEvent(i, { event: e.target.value })} className={inputCls} placeholder="e.g. Initial consultation, imaging ordered" />
                        <button type="button" aria-label={`Remove event ${i + 1}`} disabled={f.timeline.length === 1} onClick={() => setF({ ...f, timeline: f.timeline.filter((_, k) => k !== i) })} className="grid h-[38px] w-9 place-items-center rounded-md text-muted hover:bg-sage hover:text-crit-fg disabled:opacity-40"><Icon name="trash" size={16} /></button>
                      </div>
                    ))}
                  </div>
                  {errors.timeline && <p role="alert" className="text-xs text-crit-fg">{errors.timeline}</p>}
                  <Button type="button" size="sm" onClick={() => setF({ ...f, timeline: [...f.timeline, { date: '', event: '' }] })}><Icon name="plus" size={14} />Add event</Button>
                </Section>
                <Section title="Context and notes" desc="Information that affects how the claim is evaluated.">
                  <Field label="Relevant details (optional)" htmlFor="details" hint="Locations, modifiers, documentation gaps, or other context.">
                    <textarea id="details" rows={3} value={f.details} onChange={set('details')} className={inputCls} />
                  </Field>
                  <Field label="Reviewer notes (optional)" htmlFor="rnotes"><textarea id="rnotes" rows={3} value={f.reviewerNotes} onChange={set('reviewerNotes')} className={inputCls} /></Field>
                  <label className="flex items-start gap-3 text-sm">
                    <input type="checkbox" checked={f.runNow} onChange={(e) => setF({ ...f, runNow: e.target.checked })} className="mt-0.5 h-4 w-4 accent-[var(--primary)]" />
                    <span><span className="font-medium">Start evidence retrieval after submission</span><span className="block text-xs text-muted">{retrievalEndpoint ? 'Sends the claim to the configured TinyFish endpoint.' : 'TinyFish is not configured, so retrieval will be recorded as Not configured.'}</span></span>
                  </label>
                </Section>
                <Section title="Review summary" desc="Confirm before submitting.">
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    {[['Claim', f.claim], ['Category', f.category], ['Provider', f.provider || '—'], ['Service dates', `${f.serviceDateFrom} to ${f.serviceDateTo}`], ['Billed amount', fmtMoney(Number(f.billedAmount))], ['Codes', codesValid.map((c) => c.code).join(', ') || '—']].map(([k, v]) => (
                      <div key={k} className={k === 'Claim' ? 'sm:col-span-2' : ''}><dt className="text-xs text-muted">{k}</dt><dd className="tabular">{v}</dd></div>
                    ))}
                  </dl>
                </Section>
              </>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4">
              {step === 0 ? <a href="#/"><Button type="button" variant="ghost">Cancel</Button></a> : <Button type="button" variant="ghost" onClick={() => setStep(0)}><Icon name="left" size={16} />Back</Button>}
              {step === 0 ? (
                <Button type="submit" variant="primary">Next: Clinical Context<Icon name="right" size={16} /></Button>
              ) : (
                <Button type="submit" variant="primary"><Icon name="check" size={16} />Submit Investigation</Button>
              )}
            </div>
          </Card>
        </form>

        <div className="space-y-4">
          <Notice tone={retrievalEndpoint ? 'info' : 'warn'} title={retrievalEndpoint ? 'TinyFish endpoint configured' : 'TinyFish not configured'}>
            {retrievalEndpoint ? 'The claim and billing details will be sent to the endpoint saved in Settings.' : 'The investigation will be recorded, but live evidence retrieval cannot run. You can add evidence manually.'}
          </Notice>
          <Card>
            <CardHeader title="How findings are classified" />
            <ul className="space-y-3 p-5 text-sm">
              {[['Verified fact', 'Confirmed by a retrieved, citable source.'], ['Unverified claim', 'Stated by a source but not independently confirmed.'], ['Conflicting evidence', 'Sources disagree on a material point.'], ['Inconclusive', 'Available information is insufficient.']].map(([t, d]) => (
                <li key={t}><p className="font-medium">{t}</p><p className="text-muted">{d}</p></li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      {confirmClear && (
        <ConfirmDialog danger title="Clear form" confirmLabel="Clear Form" body="All entered claim details, codes, and timeline entries will be removed." onClose={() => setConfirmClear(false)}
          onConfirm={() => { setF(empty()); setErrors({}); setStep(0); setConfirmClear(false) }} />
      )}
      {confirm && (
        <ConfirmDialog title="Submit investigation" confirmLabel="Submit Investigation" loading={busy} onClose={() => setConfirm(false)} onConfirm={submit}
          body={<div className="space-y-3"><p>The following claim will be recorded{f.runNow && retrievalEndpoint ? ' and sent to the configured TinyFish endpoint' : ''}.</p><p className="rounded-md border border-line bg-sage p-3 text-fg">{f.claim.trim()}</p><p className="tabular text-xs">{f.category} · {fmtMoney(Number(f.billedAmount))} · {codesValid.length} code{codesValid.length === 1 ? '' : 's'}</p></div>} />
      )}
    </>
  )
}
