import React, { useState, useMemo } from 'react'
import { estimatePenalty, parseISODate } from '../engine/estimators/penalties.js'
import { withholdingForPeriod } from '../engine/estimators/payroll.js'
import { employeeMandatoryDeductions } from '../engine/estimators/contributions.js'
import businessTax from '../data/rules/business-tax.json'
import incomeTax from '../data/rules/income-tax.json'
import penaltyRules from '../data/rules/penalties.json'
import { NumField, Seg, Disclaimer } from '../components/ui.jsx'
import { money, money2, pct } from '../lib/format.js'
import { toCentavos, fromCentavos } from '../lib/money.js'
import { iso, fromISO } from '../engine/dates.js'
import { useManilaToday } from '../lib/useManilaToday.js'
import { HOLIDAYS } from '../lib/deadlineData.js'

const VAT_THRESHOLD = businessTax.vatThreshold.value
const EIGHT = incomeTax.eightPercent.value
const SUR = penaltyRules.surcharge.value
const INT = penaltyRules.interest.value
const SMALL_BELOW = penaltyRules.classification.value.small.grossSalesBelow

// Dates the penalty calculator accepts (a sanity range for typed dates).
const DATE_MIN = '2000-01-01'
const DATE_MAX = '2099-12-31'

// 'Mon, Jul 27, 2026'
function fmtDay(isoDate) {
  return fromISO(isoDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

// 'Jan 22, 2024'
function fmtShort(isoDate) {
  return fromISO(isoDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function wholePesoMillions(n) {
  return '₱' + (n / 1000000).toLocaleString('en-US') + 'M'
}

function dateError(value, emptyMessage) {
  if (!value) return { empty: true, message: emptyMessage }
  if (!parseISODate(value)) return { message: 'Enter a real calendar date.' }
  if (value < DATE_MIN || value > DATE_MAX) return { message: 'Enter a date from 2000 to 2099.' }
  return null
}

function DateField({ label, value, onChange, hint, error }) {
  const id = React.useId()
  const hintId = hint ? id + '-hint' : null
  const errId = id + '-err'
  const describedBy = [hintId, error ? errId : null].filter(Boolean).join(' ') || undefined
  return (
    <div>
      <label className="lbl" htmlFor={id}>{label}</label>
      <div className="input-w" style={error ? { borderColor: 'var(--bad)' } : undefined}>
        <input
          id={id}
          type="date"
          min={DATE_MIN}
          max={DATE_MAX}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={e => onChange(e.target.value)}
        />
      </div>
      {hint && <div id={hintId} style={{ fontSize: '11.5px', color: 'var(--dim)', marginTop: '5px' }}>{hint}</div>}
      <div id={errId} aria-live="polite" style={error ? { fontSize: '12.5px', color: 'var(--bad)', marginTop: '5px', lineHeight: 1.45 } : undefined}>
        {error || ''}
      </div>
    </div>
  )
}

const infoNote = {
  marginTop: '12px', fontSize: '12.5px', lineHeight: 1.5, borderRadius: '9px', padding: '10px 13px',
  background: 'var(--accSoft)', color: 'var(--accInk)',
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '8px 0' }}>
      <span style={{ fontSize: '13.5px', color: 'var(--mut)' }}>{label}</span>
      <span className="mono" style={{ fontSize: '13.5px', fontWeight: 500, whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  )
}

function PenaltyCard() {
  const today = useManilaToday()
  const [taxDue, setTaxDue] = useState(50000)
  const [dueDate, setDueDate] = useState('')
  const [paidDate, setPaidDate] = useState(null) // null = today in Manila
  const [microSmall, setMicroSmall] = useState(true)

  const paid = paidDate ?? iso(today)
  const dueErr = dateError(dueDate, 'Enter the original due date of the return or payment.')
  const paidErr = dateError(paid, 'Enter the payment date.')
  const ready = !dueErr && !paidErr

  const pen = useMemo(
    () => (ready ? estimatePenalty({ taxDue, dueDate, paymentDate: paid, microSmall }) : null),
    [ready, taxDue, dueDate, paid, microSmall]
  )

  const reducedFrom = fmtShort(SUR.microSmallFrom)
  const notes = []
  if (pen && pen.dueDateMoved) {
    const holiday = HOLIDAYS.find(h => h.date === pen.dueDate)
    const why = pen.movedBecause === 'weekend'
      ? `${fmtShort(pen.dueDate)} is a ${fromISO(pen.dueDate).toLocaleDateString('en-US', { weekday: 'long' })}`
      : `${fmtShort(pen.dueDate)} is a holiday${holiday ? ` (${holiday.name})` : ''}`
    notes.push(<>Due date moved to <b>{fmtDay(pen.rolledDueDate)}</b> (weekend/holiday: {why}). Filing and paying by then is on time.</>)
  }
  if (pen && pen.holidayListMissing) {
    const year = pen.dueDate.slice(0, 4)
    notes.push(<>The app has no holiday list for {year}, so only weekends were skipped. If the due date fell on a holiday, enter the next working day as the original due date.</>)
  }

  return (
    <div className="card pad" style={{ marginBottom: '16px' }}>
      <h3 style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '-.01em' }}>Late-filing penalty estimator</h3>
      <p style={{ fontSize: '13.5px', color: 'var(--mut)', marginTop: '3px', lineHeight: 1.55 }}>
        Surcharge, interest and compromise penalty when a return is filed or paid late. Micro and small
        taxpayers (gross sales under {wholePesoMillions(SMALL_BELOW)}) pay a {pct(SUR.microSmall)} surcharge
        and {pct(INT.microSmallAnnualRate)} interest instead of {pct(SUR.standard)} and {pct(INT.standardAnnualRate)} on
        returns due on or after {reducedFrom}.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '16px', marginTop: '18px', alignItems: 'start' }}>
        <NumField label="Basic tax due" value={taxDue} onChange={setTaxDue} prefix="₱" />
        <DateField label="Original due date" value={dueDate} onChange={setDueDate}
          error={dueErr && !dueErr.empty ? dueErr.message : null} />
        <DateField label="Payment date" value={paid} onChange={setPaidDate}
          hint="Today, or the day you plan to pay."
          error={paidErr && !paidErr.empty ? paidErr.message : null} />
        <div>
          <span className="lbl" aria-hidden="true">Taxpayer size</span>
          <div style={{ marginTop: '8px' }}>
            <Seg options={[['eopt', 'Micro / Small'], ['reg', 'Medium / Large']]} value={microSmall ? 'eopt' : 'reg'} onChange={k => setMicroSmall(k === 'eopt')} ariaLabel="Taxpayer size" />
          </div>
        </div>
      </div>

      <div role="status" aria-live="polite">
        {notes.map((n, i) => <div key={i} style={infoNote}>{n}</div>)}
        {pen && microSmall && pen.late && !pen.reducedRates && (
          <div className="mini-warn">
            The reduced micro and small rates apply only to returns due on or after {reducedFrom}. This one was due
            earlier, so the regular rates apply for the whole period: {pct(SUR.standard)} surcharge
            and {pct(INT.standardAnnualRate)} interest a year ({pct(INT.priorAnnualRate)} for days
            before {fmtShort(INT.standardFrom)}).
          </div>
        )}
      </div>

      <div style={{ marginTop: '18px', borderTop: '1px solid var(--line2)', paddingTop: '6px' }}>
        {!pen && (
          <p style={{ fontSize: '13.5px', color: 'var(--mut)', padding: '10px 0' }}>
            {dueErr ? dueErr.message : paidErr.message} The estimate appears here.
          </p>
        )}
        {pen && !pen.late && (
          <>
            <div style={{ marginTop: '10px', background: 'var(--goodSoft)', color: 'var(--ink)', borderRadius: '9px', padding: '10px 13px', fontSize: '13.5px', lineHeight: 1.5 }}>
              <b>Not late: no surcharge, interest or compromise.</b> Paid on or before the due date
              {pen.dueDateMoved ? ` (moved to ${fmtShort(pen.rolledDueDate)})` : ''}.
            </div>
            <Row label="Basic tax due" value={money2(taxDue)} />
          </>
        )}
        {pen && pen.late && (
          <>
            <Row label="Basic tax due" value={money2(taxDue)} />
            <Row
              label={`Surcharge (${pct(pen.surRate)}, NIRC Sec 248${pen.surRate === SUR.microSmall ? ', reduced for micro & small' : ''})`}
              value={money2(pen.surcharge)}
            />
            {pen.interestPeriods.map(p => (
              <Row
                key={p.from}
                label={`Interest · ${p.days} ${p.days === 1 ? 'day' : 'days'} (${fmtShort(p.from)} to ${fmtShort(p.to)}) at ${pct(p.rate)} a year (NIRC Sec 249)`}
                value={money2(p.interest)}
              />
            ))}
            <Row label="Compromise penalty (RMO 7-2015 schedule)" value={money2(pen.compromise)} />
          </>
        )}
        {pen && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px 0 2px', borderTop: '1px solid var(--line)', marginTop: '4px' }}>
            <span style={{ fontSize: '14px', fontWeight: 700 }}>Estimated total to pay</span>
            <span className="mono" style={{ fontSize: '20px', fontWeight: 600, color: 'var(--accInk)' }}>{money2(pen.total)}</span>
          </div>
        )}
        {pen && pen.late && (
          <p style={{ fontSize: '12.5px', color: 'var(--mut)', marginTop: '6px' }}>
            {pen.daysLate} {pen.daysLate === 1 ? 'day' : 'days'} late, counted from the day after {fmtShort(pen.rolledDueDate)} through {fmtShort(pen.paymentDate)}.
          </p>
        )}
        <p className="cite" style={{ marginTop: '10px' }}>
          Compromise penalties are the BIR's standard settlement amounts and are technically negotiable; interest
          accrues until actually paid. Interest counts actual days ÷ 365; the BIR's method for leap years is not yet
          confirmed.
        </p>
      </div>
    </div>
  )
}

// Ported from v1; the math now runs through the shared engine + data layer.
export default function ToolsPage() {
  const [whComp, setWhComp] = useState(50000)
  const [whGrossMode, setWhGrossMode] = useState('taxable')
  const [ytdGross, setYtdGross] = useState(240000)
  const [ytdMonths, setYtdMonths] = useState(6)

  const whTaxable = useMemo(() => {
    if (whGrossMode === 'taxable') return whComp
    const ded = employeeMandatoryDeductions(whComp)
    return fromCentavos(Math.max(0, toCentavos(whComp) - toCentavos(ded.total)))
  }, [whComp, whGrossMode])
  const whTax = useMemo(() => withholdingForPeriod(whTaxable, 'monthly'), [whTaxable])
  const whRate = whTaxable > 0 ? (whTax / whTaxable * 100) : 0

  const mIn = Math.min(12, Math.max(0, ytdMonths))
  const projAnnual = mIn > 0 ? ytdGross / mIn * 12 : 0
  const proj8 = Math.max(0, projAnnual - EIGHT.allowanceForPureSelfEmployed) * EIGHT.rate
  const perMonth = proj8 / 12
  const projVat = projAnnual > VAT_THRESHOLD

  return (
    <div className="page wrap" style={{ paddingTop: '26px', paddingBottom: '64px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 className="pg-h1">Tools &amp; calculators</h1>
        <p className="pg-sub">Quick utilities for the in-between moments: estimate a penalty, figure out withholding, or project where your year is heading.</p>
      </div>

      <PenaltyCard />

      {/* withholding + ytd */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '16px' }}>
        <div className="card pad">
          <h3 style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '-.01em' }}>Compensation withholding</h3>
          <p style={{ fontSize: '13.5px', color: 'var(--mut)', marginTop: '3px' }}>Monthly tax to withhold (revised table effective 2023).</p>
          <div style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <NumField label={whGrossMode === 'taxable' ? 'Monthly taxable pay' : 'Monthly gross pay'} value={whComp} onChange={setWhComp} prefix="₱" />
            <Seg options={[['taxable', 'I have taxable pay'], ['gross', 'Start from gross']]} value={whGrossMode} onChange={setWhGrossMode} ariaLabel="Input mode" />
          </div>
          <div style={{ marginTop: '18px', background: 'var(--accSoft)', borderRadius: '11px', padding: '16px' }}>
            {whGrossMode === 'gross' && (
              <div style={{ fontSize: '12.5px', color: 'var(--accInk)', marginBottom: '7px' }}>
                Taxable after SSS/PhilHealth/Pag-IBIG employee shares: <b className="mono">{money2(whTaxable)}</b>
              </div>
            )}
            <div style={{ fontSize: '12px', color: 'var(--accInk)', fontWeight: 600 }}>Tax to withhold each month</div>
            <div className="mono" style={{ fontSize: '24px', fontWeight: 600, color: 'var(--accInk)', marginTop: '5px' }}>{money2(whTax)}</div>
            <div style={{ fontSize: '12.5px', color: 'var(--accInk)', opacity: .8, marginTop: '3px' }}>Effective rate {whRate.toFixed(1)}% of taxable pay</div>
          </div>
        </div>
        <div className="card pad">
          <h3 style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '-.01em' }}>Year-to-date projector</h3>
          <p style={{ fontSize: '13.5px', color: 'var(--mut)', marginTop: '3px' }}>Where your annual income and 8% tax are heading.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '12px', marginTop: '18px' }}>
            <NumField label="Gross so far" value={ytdGross} onChange={setYtdGross} prefix="₱" />
            <NumField label="Months in" value={ytdMonths} onChange={setYtdMonths} kind="integer" />
          </div>
          <div style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13.5px', color: 'var(--mut)' }}>Projected annual income</span>
              <span className="mono" style={{ fontSize: '14px', fontWeight: 600 }}>{money(projAnnual)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13.5px', color: 'var(--mut)' }}>Estimated 8% tax</span>
              <span className="mono" style={{ fontSize: '14px', fontWeight: 600 }}>{money(proj8)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--line2)', paddingTop: '9px' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 600 }}>Set aside / month</span>
              <span className="mono" style={{ fontSize: '16px', fontWeight: 600, color: 'var(--accInk)' }}>{money(perMonth)}</span>
            </div>
          </div>
          {projVat && <div className="mini-warn">You're projected to pass the ₱3M VAT threshold. The 8% option won't be available at that level, and VAT registration kicks in. Run the estimator with your full-year figure.</div>}
        </div>
      </div>

      <Disclaimer />
    </div>
  )
}
