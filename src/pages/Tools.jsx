import React, { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { estimatePenalty, parseISODate } from '../engine/estimators/penalties.js'
import { projectYear, projectorKind, MONTHS_MIN, MONTHS_MAX } from '../engine/estimators/projector.js'
import { withholdingCalculator, PAY_PERIODS, PAY_FACTORS, DEFAULT_PAY_FACTOR } from '../engine/estimators/payroll.js'
import businessTax from '../data/rules/business-tax.json'
import incomeTax from '../data/rules/income-tax.json'
import penaltyRules from '../data/rules/penalties.json'
import { NumField, Seg, Switch, SelectField, Disclaimer } from '../components/ui.jsx'
import { money, money2, pct } from '../lib/format.js'
import { iso, fromISO } from '../engine/dates.js'
import { useManilaToday } from '../lib/useManilaToday.js'
import { HOLIDAY_SET } from '../lib/deadlineData.js'
import { useApp } from '../state/AppState.jsx'

const VAT_RATE = businessTax.vatRate.value
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

function Row({ label, value, text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '8px 0' }}>
      <span style={{ fontSize: '13.5px', color: 'var(--mut)' }}>{label}</span>
      {text
        ? <span style={{ fontSize: '13.5px', fontWeight: 600, textAlign: 'right' }}>{value}</span>
        : <span className="mono" style={{ fontSize: '13.5px', fontWeight: 500, whiteSpace: 'nowrap' }}>{value}</span>}
    </div>
  )
}

function PenaltyCard() {
  const today = useManilaToday()
  const [taxDue, setTaxDue] = useState(50000)
  const [dueDate, setDueDate] = useState('')
  const [paidDate, setPaidDate] = useState(null) // null = today in Manila
  const [microSmall, setMicroSmall] = useState(true)
  const [willful, setWillful] = useState(false)

  const paid = paidDate ?? iso(today)
  const dueErr = dateError(dueDate, 'Enter the original due date of the return or payment.')
  const paidErr = dateError(paid, 'Enter the payment date.')
  const ready = !dueErr && !paidErr

  const pen = useMemo(
    () => (ready ? estimatePenalty({ taxDue, dueDate, paymentDate: paid, microSmall, willful }) : null),
    [ready, taxDue, dueDate, paid, microSmall, willful]
  )

  const reducedFrom = fmtShort(SUR.microSmallFrom)
  const notes = []
  if (pen && pen.dueDateMoved) {
    const holiday = HOLIDAY_SET.get(pen.dueDate)
    const why = pen.movedBecause === 'weekend'
      ? `${fmtShort(pen.dueDate)} is a ${fromISO(pen.dueDate).toLocaleDateString('en-US', { weekday: 'long' })}`
      : `${fmtShort(pen.dueDate)} is a holiday${holiday ? ` (${holiday.name})` : ''}`
    notes.push(<>Due date moved to <b>{fmtDay(pen.rolledDueDate)}</b> (weekend/holiday: {why}). Filing and paying by then is on time.</>)
  }
  if (pen && pen.holidayListMissing) {
    const year = pen.dueDate.slice(0, 4)
    notes.push(<>The app does not have the proclaimed holiday list for {year}, so only weekends and the holidays fixed by law (such as May 1 and June 12) were skipped. If the due date fell on another holiday, enter the next working day as the original due date.</>)
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
      <div style={{ marginTop: '14px' }}>
        <Switch
          on={willful}
          onChange={setWillful}
          title={`Willful neglect / false or fraudulent return (${pct(SUR.willfulNeglect)} surcharge)`}
          desc={`NIRC Sec 248(B): for example, not filing on purpose, or understating sales by more than 30%. The ${pct(SUR.willfulNeglect)} is not reduced for micro and small taxpayers, and the standard compromise schedule does not cover fraud.`}
        />
      </div>

      <div role="status" aria-live="polite">
        {notes.map((n, i) => <div key={i} style={infoNote}>{n}</div>)}
        {pen && microSmall && pen.late && !pen.reducedRates && (
          <div className="mini-warn">
            The reduced micro and small rates apply only to returns due on or after {reducedFrom}. This one was due
            earlier, so the regular rates apply for the whole period: {willful ? '' : `${pct(SUR.standard)} surcharge and `}
            {pct(INT.standardAnnualRate)} interest a year ({pct(INT.priorAnnualRate)} for days
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
              label={pen.willful
                ? `Surcharge (${pct(pen.surRate)}, NIRC Sec 248(B), willful neglect or fraud)`
                : `Surcharge (${pct(pen.surRate)}, NIRC Sec 248${pen.surRate === SUR.microSmall ? ', reduced for micro & small' : ''})`}
              value={money2(pen.surcharge)}
            />
            {pen.interestPeriods.map(p => (
              <Row
                key={p.from}
                label={`Interest · ${p.days} ${p.days === 1 ? 'day' : 'days'} (${fmtShort(p.from)} to ${fmtShort(p.to)}) at ${pct(p.rate)} a year (NIRC Sec 249)`}
                value={money2(p.interest)}
              />
            ))}
            {pen.compromiseOnSchedule
              ? <Row label="Compromise penalty (RMO 7-2015 schedule)" value={money2(pen.compromise)} />
              : <Row label="Compromise penalty" value="Not on the standard schedule" text />}
          </>
        )}
        {pen && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px 0 2px', borderTop: '1px solid var(--line)', marginTop: '4px' }}>
            <span style={{ fontSize: '14px', fontWeight: 700 }}>
              Estimated total to pay{pen.late && !pen.compromiseOnSchedule ? ' (before any compromise)' : ''}
            </span>
            <span className="mono" style={{ fontSize: '20px', fontWeight: 600, color: 'var(--accInk)' }}>{money2(pen.total)}</span>
          </div>
        )}
        {pen && pen.late && !pen.compromiseOnSchedule && (
          <div className="mini-warn">
            The standard compromise schedule (RMO 7-2015) covers only violations that do not involve fraud, so no
            compromise is added here; a fraud case may be referred for prosecution instead. If no fraud is involved
            and the BIR applies the schedule, the compromise would be {money2(pen.scheduleCompromise)}, for a total
            of {money2(pen.totalWithScheduleCompromise)}.
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

const KIND_LABEL = {
  pure: `purely self-employed (${money(EIGHT.allowanceForPureSelfEmployed)} reduction)`,
  mixed: `mixed income (no ${money(EIGHT.allowanceForPureSelfEmployed)} reduction)`,
  vat: 'VAT-registered',
  corporation: 'corporation',
}

function ProjectorCard() {
  const app = useApp()
  const profile = app ? app.active : null
  const profileKind = projectorKind(profile)
  const [askedKind, setAskedKind] = useState(null)
  const [gross, setGross] = useState(240000)
  const [months, setMonths] = useState(6)
  const kind = profileKind ?? askedKind
  const reduction = money(EIGHT.allowanceForPureSelfEmployed)
  const ceiling = wholePesoMillions(EIGHT.grossCeiling)

  const r = useMemo(
    () => projectYear({ grossSoFar: gross, monthsIn: months, kind: kind ?? 'mixed' }),
    [gross, months, kind]
  )
  const estimatorLink = <Link to="/estimator" style={{ color: 'var(--accInk)', fontWeight: 600 }}>Open the Estimator</Link>

  let why = null
  if (kind === 'vat') {
    why = <>The {pct(EIGHT.rate)} option isn't available to VAT-registered individuals: you pay graduated income tax plus {pct(VAT_RATE)} VAT. {estimatorLink} for your tax.</>
  } else if (kind === 'corporation') {
    why = <>The {pct(EIGHT.rate)} option is for individuals only. A corporation pays corporate income tax instead. {estimatorLink} for your tax.</>
  } else if (r.overCeiling) {
    why = <>Projected gross sales pass {ceiling}, so the {pct(EIGHT.rate)} option won't be available and VAT registration kicks in. {estimatorLink} with your full-year figure.</>
  }

  return (
    <div className="card pad">
      <h3 style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '-.01em' }}>Year-to-date projector</h3>
      <p style={{ fontSize: '13.5px', color: 'var(--mut)', marginTop: '3px' }}>Where your gross sales and {pct(EIGHT.rate)} tax are heading.</p>
      {profileKind
        ? (
          <p style={{ fontSize: '12.5px', color: 'var(--mut)', marginTop: '8px', lineHeight: 1.5 }}>
            Following the active profile <b style={{ color: 'var(--ink)' }}>{profile.name}</b>: {KIND_LABEL[profileKind]}.
          </p>
        )
        : (
          <div style={{ marginTop: '14px' }}>
            <span className="lbl" aria-hidden="true">Purely self-employed or mixed income?</span>
            <div style={{ marginTop: '8px' }}>
              <Seg
                options={[['pure', 'Self-employed only'], ['mixed', 'Mixed income']]}
                value={askedKind}
                onChange={setAskedKind}
                ariaLabel="Purely self-employed or mixed income?"
              />
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--dim)', marginTop: '5px' }}>Mixed income: you also earn a salary from an employer.</div>
          </div>
        )}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '12px', marginTop: '18px', alignItems: 'start' }}>
        <NumField label="Gross so far" value={gross} onChange={setGross} prefix="₱" />
        <NumField label="Months in" value={months} onChange={setMonths} kind="integer" min={MONTHS_MIN} max={MONTHS_MAX}
          hint={`${MONTHS_MIN} to ${MONTHS_MAX}`} />
      </div>
      <div style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <span style={{ fontSize: '13.5px', color: 'var(--mut)' }}>Projected gross sales / receipts</span>
          <span className="mono" style={{ fontSize: '14px', fontWeight: 600 }}>{money(r.projectedGross)}</span>
        </div>
        {kind && r.eightPercentAvailable && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <span style={{ fontSize: '13.5px', color: 'var(--mut)' }}>
                Estimated {pct(EIGHT.rate)} tax{kind === 'pure' ? ` (after the ${reduction} reduction)` : ''}
              </span>
              <span className="mono" style={{ fontSize: '14px', fontWeight: 600 }}>{money(r.eightPercentTax)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', borderTop: '1px solid var(--line2)', paddingTop: '9px' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 600 }}>Set aside / month</span>
              <span className="mono" style={{ fontSize: '16px', fontWeight: 600, color: 'var(--accInk)' }}>{money(r.setAsidePerMonth)}</span>
            </div>
          </>
        )}
      </div>
      {!kind && (
        <p style={{ fontSize: '12.5px', color: 'var(--mut)', marginTop: '12px', lineHeight: 1.5 }}>
          Choose "Self-employed only" or "Mixed income" to see the {pct(EIGHT.rate)} tax.
        </p>
      )}
      {kind === 'mixed' && r.eightPercentAvailable && (
        <p style={{ fontSize: '12.5px', color: 'var(--mut)', marginTop: '12px', lineHeight: 1.5 }}>
          With a salary too, there is no {reduction} reduction on the business side (it is already in the tax on your
          salary). Tax on your salary is separate.
        </p>
      )}
      {why && <div className="mini-warn">{why}</div>}
    </div>
  )
}

// Ported from v1; the math now runs through the shared engine + data layer.
export default function ToolsPage() {
  const [whComp, setWhComp] = useState(50000)
  const [whGrossMode, setWhGrossMode] = useState('taxable')
  // L08: pay period (and paid days a year for daily pay).
  const [whPeriod, setWhPeriod] = useState('monthly')
  const [whFactor, setWhFactor] = useState(DEFAULT_PAY_FACTOR)

  const wh = useMemo(
    () => withholdingCalculator({ amount: whComp, mode: whGrossMode, payPeriod: whPeriod, payFactor: whFactor }),
    [whComp, whGrossMode, whPeriod, whFactor],
  )
  const whTaxable = wh.perPeriodTaxable
  const whTax = wh.perPeriodWithholding
  const whRate = whTaxable > 0 ? (whTax / whTaxable * 100) : 0
  const payday = { monthly: 'each month', semiMonthly: 'each payday (twice a month)', weekly: 'each week', daily: 'each paid day' }[whPeriod]
  const perWord = { monthly: 'Monthly', semiMonthly: 'Semi-monthly', weekly: 'Weekly', daily: 'Daily' }[whPeriod]

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
          <p style={{ fontSize: '13.5px', color: 'var(--mut)', marginTop: '3px' }}>Tax to withhold per payday (revised tables effective 2023).</p>
          <div style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <SelectField label="Pay period" value={whPeriod} onChange={setWhPeriod} options={PAY_PERIODS} hint="Uses the matching BIR withholding table (RR 11-2018)." />
            {whPeriod === 'daily' && (
              <SelectField
                label="Paid days a year"
                value={String(whFactor)}
                onChange={x => setWhFactor(Number(x))}
                options={PAY_FACTORS.map(f => [String(f), `${f}${f === 365 ? ' (paid every day)' : f === 313 ? ' (six-day week)' : ' (five-day week)'}`])}
                hint="Used to spread the month's SSS, PhilHealth and Pag-IBIG shares over the paid days."
              />
            )}
            <NumField label={`${perWord} ${whGrossMode === 'taxable' ? 'taxable' : 'gross'} pay`} value={whComp} onChange={setWhComp} prefix="₱" />
            <Seg options={[['taxable', 'I have taxable pay'], ['gross', 'Start from gross']]} value={whGrossMode} onChange={setWhGrossMode} ariaLabel="Input mode" />
          </div>
          <div style={{ marginTop: '18px', background: 'var(--accSoft)', borderRadius: '11px', padding: '16px' }}>
            {whGrossMode === 'gross' && (
              <div style={{ fontSize: '12.5px', color: 'var(--accInk)', marginBottom: '7px' }}>
                Taxable after SSS/PhilHealth/Pag-IBIG employee shares{whPeriod !== 'monthly' && <> ({money2(wh.deductionsPerPeriod)} {payday}, the month's shares spread evenly)</>}: <b className="mono">{money2(whTaxable)}</b>
              </div>
            )}
            <div style={{ fontSize: '12px', color: 'var(--accInk)', fontWeight: 600 }}>Tax to withhold {payday}</div>
            <div className="mono" style={{ fontSize: '24px', fontWeight: 600, color: 'var(--accInk)', marginTop: '5px' }}>{money2(whTax)}</div>
            <div style={{ fontSize: '12.5px', color: 'var(--accInk)', opacity: .8, marginTop: '3px' }}>Effective rate {whRate.toFixed(1)}% of taxable pay</div>
          </div>
        </div>
        <ProjectorCard />
      </div>

      <Disclaimer />
    </div>
  )
}
