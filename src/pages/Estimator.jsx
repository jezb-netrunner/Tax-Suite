import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../state/AppState.jsx'
import { estimateIndividual, MONTHS } from '../engine/estimators/individual.js'
import { estimateEmployee } from '../engine/estimators/employee.js'
import { estimateCorporation } from '../engine/estimators/corporation.js'
import { estimatePayroll } from '../engine/estimators/payroll.js'
import { selfEmployedMonthlyContributions } from '../engine/estimators/contributions.js'
import { NumField, SelectField, Disclaimer } from '../components/ui.jsx'
import { money, money2 } from '../lib/format.js'
import { useManilaToday } from '../lib/useManilaToday.js'

// fmt 'peso': return figures in whole pesos (BIR form lines);
// fmt 'centavo': payslip and contribution figures to the centavo.
function Rows({ rows, fmt = 'peso' }) {
  const f = fmt === 'centavo' ? money2 : money
  return (
    <div style={{ marginTop: '8px' }}>
      {rows.map((x, i) => (
        <div key={i}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '16px', padding: '9px 0', borderTop: x.rule ? '1px solid var(--line)' : undefined, marginTop: x.rule ? '2px' : undefined }}>
            <span style={{ fontSize: '13.5px', color: x.strong ? 'var(--ink)' : 'var(--mut)', fontWeight: x.strong ? 600 : 400 }}>{x.label}</span>
            <span className="mono" style={{ fontSize: '14px', fontWeight: x.strong ? 700 : 500 }}>
              {x.value == null ? '—' : x.value < 0 ? `(${f(-x.value)})` : f(x.value)}
            </span>
          </div>
          {x.sub && <div style={{ fontSize: '12px', color: 'var(--mut)', marginTop: '-3px', paddingBottom: '6px', fontStyle: 'italic' }}>{x.sub}</div>}
        </div>
      ))}
    </div>
  )
}

function BasisNote({ refs }) {
  return (
    <p className="cite" style={{ marginTop: '14px' }}>
      Legal basis: {Array.from(new Set(refs)).join(' · ')}. Details and verification dates are on the References page.
    </p>
  )
}

// Per-profile input memory so returning users see their numbers.
// Persists 900ms after the last keystroke to avoid write storms.
//
// Three things this has to get right, because one account holds many clients:
//  - Seed from the profile these inputs belong to. The estimator subtree is
//    keyed by profile id (see Estimator below), so switching clients remounts
//    and re-seeds rather than showing the previous client's figures.
//  - Merge into the LATEST profile at flush time, not the copy captured on the
//    keystroke, so a debounced write can't revert edits made meanwhile.
//  - Flush a pending write on unmount instead of dropping it.
function useInputs(app, key, defaults) {
  const profileId = app.active?.id ?? null
  const saved = app.active?.inputs?.[key]
  const [vals, setVals] = useState({ ...defaults, ...(saved || {}) })
  const timer = React.useRef(null)
  const pending = React.useRef(null)

  // Always read the newest profile when the timer fires.
  const activeRef = React.useRef(app.active)
  activeRef.current = app.active

  const flush = React.useCallback(() => {
    const inputs = pending.current
    pending.current = null
    const current = activeRef.current
    if (!inputs || !current || current.id !== profileId) return
    app.save({ ...current, inputs: { ...(current.inputs || {}), [key]: inputs } }).catch(() => {})
  }, [app, key, profileId])

  function update(k, v) {
    const next = { ...vals, [k]: v }
    setVals(next)
    if (!app.active) return
    pending.current = next
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, 900)
  }

  React.useEffect(() => () => { clearTimeout(timer.current); flush() }, [flush])
  return [vals, update]
}

function IndividualEstimator({ app, mixed }) {
  const p = app.active
  const [v, set] = useInputs(app, mixed ? 'mixed' : 'individual', {
    gross: 480000, expenses: 180000, cwt: 0, compensationTaxable: 600000, compensationWithheld: 62500,
  })
  const taxYear = useManilaToday().getFullYear()
  const r = useMemo(() => estimateIndividual({
    gross: v.gross, expenses: v.expenses, cwt: v.cwt,
    vatRegistered: p.vatRegistered, mixed,
    compensationTaxable: mixed ? v.compensationTaxable : 0,
    compensationWithheld: mixed ? v.compensationWithheld : 0,
    quarterlyPaid: v.quarterlyPaid, priorYearCredits: v.priorYearCredits,
    crossedMonth: v.crossedMonth, salesThroughCrossMonth: v.salesThroughCrossMonth,
    eightPercentPaid: v.eightPercentPaid, taxYear,
  }), [v, p.vatRegistered, mixed, taxYear])

  // The profile's regime, unless the figures override it.
  const regimeNote = p.regime === '8pct' && r.crossing
    ? 'Your profile says the 8% option, but because sales passed ₱3,000,000 the whole year is taxed at graduated rates.'
    : p.regime === '8pct' && p.vatRegistered
      ? 'Your profile says the 8% option, but it is not available to VAT-registered taxpayers.'
      : `Note: the regime on this profile is ${p.regime === '8pct' ? 'the 8% option' : 'graduated rates'}, and the election locks for the year on the Q1 filing.`

  return (
    <>
      <div className="card pad">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: '18px' }}>
          <NumField label="Business gross sales / receipts · year" value={v.gross} onChange={x => set('gross', x)} prefix="₱" lg />
          <NumField label="Itemized expenses" value={v.expenses} onChange={x => set('expenses', x)} prefix="₱" />
          <NumField label="Tax withheld by clients (2307s)" value={v.cwt} onChange={x => set('cwt', x)} prefix="₱" />
          {mixed && <NumField label="Taxable compensation · year" value={v.compensationTaxable} onChange={x => set('compensationTaxable', x)} prefix="₱" hint="After mandatory contributions and non-taxable benefits; see box 21 of your 2316." />}
          {mixed && <NumField label="Tax withheld by employer" value={v.compensationWithheld} onChange={x => set('compensationWithheld', x)} prefix="₱" />}
          <NumField label="Income tax already paid on this year's quarterly returns (1701Q)" value={v.quarterlyPaid} onChange={x => set('quarterlyPaid', x)} prefix="₱" />
          <NumField label="Excess credits carried over from last year" value={v.priorYearCredits} onChange={x => set('priorYearCredits', x)} prefix="₱" hint="Only if last year's annual return carried an overpayment over to this year." />
        </div>
        <p className="cite" style={{ marginTop: '14px' }}>
          Quarterly amounts are not computed here. Enter the income tax you have already paid on this year's 1701Q returns, and it is subtracted from what you pay with the annual return.
        </p>
      </div>

      {p.vatRegistered && (
        <div className="mini-warn" role="note" style={{ marginTop: '16px' }}>
          <b>VAT not included.</b> As a VAT-registered taxpayer you file VAT every quarter on Form 2550Q
          (12% of sales less creditable input VAT). This estimate does not compute VAT: every total below is
          income tax and percentage tax only.
        </div>
      )}

      {r.crossing && (
        <div className="card pad" style={{ marginTop: '16px' }}>
          <h3 className="sec-h">Your sales passed ₱3,000,000 this year</h3>
          <div className="mini-warn" role="note">
            The whole year moves to graduated rates: the 8% option is not available this year, and any 8% income tax
            already paid on your 1701Q is credited. The 3% percentage tax still applies to your sales from {r.crossing.span}.
            {' '}<b>VAT applies from {r.crossing.vatFrom}: not included in this estimate.</b> Register for VAT (update your
            registration) before the end of the month after the month your sales passed ₱3,000,000.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: '18px', marginTop: '16px' }}>
            <SelectField
              label="Month your sales passed ₱3,000,000"
              value={v.crossedMonth ? String(v.crossedMonth) : ''}
              onChange={x => set('crossedMonth', x ? Number(x) : null)}
              options={[
                ['', `Not sure: assume even monthly sales (${MONTHS[r.crossing.evenMonth - 1]})`],
                ...MONTHS.map((m, i) => [String(i + 1), m]),
              ]}
            />
            <NumField label={`Sales from ${r.crossing.span}`} value={v.salesThroughCrossMonth} emptyValue={null} onChange={x => set('salesThroughCrossMonth', x)} prefix="₱" hint="Optional. If blank, the year's sales are spread evenly by month." />
            <NumField label="8% income tax already paid on 1701Q this year" value={v.eightPercentPaid} onChange={x => set('eightPercentPaid', x)} prefix="₱" hint="Credited against this year's graduated income tax. Don't count it again in the quarterly-payments box above." />
          </div>
          {r.crossing.warnings.map(w => <div key={w} className="mini-warn" role="alert">{w}</div>)}
        </div>
      )}

      <p style={{ marginTop: '16px', fontSize: '13px', color: 'var(--mut)', lineHeight: 1.5 }}>
        <b style={{ color: 'var(--ink)' }}>{r.ratesLabel}.</b> {r.ratesNote}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '14px', marginTop: '12px' }}>
        {r.options.map(c => {
          const isBest = c.eligible && c === r.best
          return (
            <div key={c.key} style={{
              borderRadius: '13px', padding: '18px',
              border: isBest ? '1.5px solid var(--acc)' : '1.5px solid var(--line)',
              background: isBest ? 'var(--accSoft)' : 'var(--sf)',
              opacity: c.eligible ? 1 : 0.6,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ fontWeight: 700, fontSize: '14.5px' }}>{c.name}</span>
                {isBest && <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', padding: '3px 8px', borderRadius: '100px', background: 'var(--good)', color: '#fff' }}>Lowest</span>}
                {!c.eligible && <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', padding: '3px 8px', borderRadius: '100px', background: '#eef3f8', color: 'var(--mut)' }}>N/A</span>}
              </div>
              <div className="mono" style={{ fontSize: '26px', fontWeight: 600, letterSpacing: '-.01em', marginTop: '10px', color: isBest ? 'var(--accInk)' : 'var(--ink)' }}>{c.eligible ? money(c.total) : '—'}</div>
              <div style={{ fontSize: '12px', color: 'var(--mut)', marginTop: '3px' }}>{!c.eligible ? c.reason : c.vatNotIncluded ? r.vatNote : 'estimated annual tax'}</div>
              <div style={{ marginTop: '14px', paddingTop: '13px', borderTop: '1px solid var(--line2)', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12.5px', color: 'var(--mut)' }}>Income tax</span>
                  <span className="mono" style={{ fontSize: '12.5px', fontWeight: 600 }}>{c.eligible ? money(c.incomeTax) : '—'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12.5px', color: 'var(--mut)' }}>Business tax</span>
                  <span className="mono" style={{ fontSize: '12.5px', fontWeight: 600 }}>
                    {!c.eligible || c.businessTax.kind === 'vat' ? '—' : c.businessTax.kind === 'pct' ? money(c.businessTax.amount) : '₱0'}
                  </span>
                </div>
                {c.eligible && c.businessTax.kind === 'vat' && (
                  <div style={{ fontSize: '11.5px', color: 'var(--mut)' }}>VAT (2550Q) not included.</div>
                )}
                {c.eligible && c.businessTax.vatFrom && (
                  <div style={{ fontSize: '11.5px', color: 'var(--mut)' }}>Percentage tax to {r.crossing.monthName}; VAT from {c.businessTax.vatFrom} not included.</div>
                )}
              </div>
              <div style={{ marginTop: '12px', fontSize: '11.5px', color: 'var(--dim)' }}>Files: {c.forms}</div>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: '16px', background: 'var(--brand)', color: '#fff', borderRadius: '13px', padding: '17px 20px', display: 'flex', alignItems: 'center', gap: '13px' }}>
        <span style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'var(--good)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>✓</span>
        <span style={{ fontSize: '15px', fontWeight: 600, lineHeight: 1.4 }}>
          {r.best.name} is the cheapest eligible option at {money(r.best.total)}
          {r.savingsVsNext > 0 ? `, saving ${money(r.savingsVsNext)} versus the next best.` : '.'}
          {r.vatNotIncluded && <>{' '}{r.vatNote}</>}
          {' '}{regimeNote}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: '20px', marginTop: '20px', alignItems: 'start' }}>
        <div className="card pad">
          <h3 className="sec-h">How we got there: {r.best.name}</h3>
          <Rows rows={r.rows} />
          <BasisNote refs={r.references} />
        </div>
        <FormPreview r={r} />
      </div>
      <SelfContributionsCard monthly={Math.round(v.gross / 12)} />
    </>
  )
}

// How the winning option lands on the annual return — the v1 "form preview".
// The annual return (1701 / 1701A) carries income tax only: income tax due
// less income-tax credits. Percentage tax is paid on the quarterly 2551Q and
// is shown below the return lines, never netted against the credits.
function FormPreview({ r }) {
  const best = r.best
  const ar = r.annualReturn
  const rows = [
    ...ar.taxable.map(t => ({ label: t.label, value: money(t.value) })),
    { label: 'Income tax due', value: money(ar.incomeTaxDue) },
    ...(ar.creditLines.length
      ? ar.creditLines.map(c => ({ label: c.label, value: `(${money(c.value)})` }))
      : [{ label: 'Less: tax credits', value: '—' }]),
    {
      label: ar.netPayable >= 0 ? 'Income tax payable with the annual return' : 'Overpayment (refund / carry-over)',
      value: money(Math.abs(ar.netPayable)),
      strong: true,
    },
  ]
  const separate = []
  if (best.businessTax.kind === 'pct') separate.push({ label: 'Percentage tax: paid quarterly on 2551Q, not with the annual return', value: money(ar.percentageTax) })
  if (best.businessTax.vatFrom) separate.push({ label: `VAT from ${best.businessTax.vatFrom} (2550Q): not included in this estimate`, value: '—' })
  if (best.businessTax.kind === 'vat') separate.push({ label: 'VAT (2550Q): not included in this estimate', value: '—' })
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ background: '#f3f7fb', borderBottom: '1px solid var(--line)', padding: '15px 18px' }}>
        <div className="mono" style={{ fontSize: '11px', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--mut)' }}>Where it lands on the return</div>
        <div style={{ fontWeight: 700, fontSize: '14.5px', marginTop: '3px' }}>BIR Form {ar.form}</div>
      </div>
      <div style={{ padding: '6px 18px 16px' }}>
        {rows.map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 0', borderTop: i ? '1px solid var(--line2)' : 'none' }}>
            <span style={{ flex: 1, fontSize: '13px', color: f.strong ? 'var(--ink)' : 'var(--mut)', fontWeight: f.strong ? 600 : 400 }}>{f.label}</span>
            <span className="mono" style={{ fontSize: '13.5px', fontWeight: f.strong ? 700 : 600 }}>{f.value}</span>
          </div>
        ))}
        {separate.map((f, i) => (
          <div key={'s' + i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 0', marginTop: i ? 0 : '6px', borderTop: i ? '1px solid var(--line2)' : '1px dashed var(--line)' }}>
            <span style={{ flex: 1, fontSize: '13px', color: 'var(--mut)' }}>{f.label}</span>
            <span className="mono" style={{ fontSize: '13.5px', fontWeight: 600 }}>{f.value}</span>
          </div>
        ))}
        {!ar.creditLines.some(c => c.label.includes('1701Q')) && (
          <p className="cite" style={{ marginTop: '10px' }}>This is before any income tax paid on this year's 1701Q returns. Quarterly amounts are not computed here; enter what you paid above.</p>
        )}
        <p className="cite" style={{ marginTop: '10px' }}>Line numbering varies by form revision, so amounts are labeled by meaning rather than box number.</p>
      </div>
    </div>
  )
}

function SelfContributionsCard({ monthly }) {
  const c = useMemo(() => selfEmployedMonthlyContributions(monthly), [monthly])
  return (
    <div className="card pad" style={{ marginTop: '16px' }}>
      <h3 className="sec-h">Monthly contributions on top (self-employed)</h3>
      <p style={{ fontSize: '13px', color: 'var(--mut)', marginTop: '4px' }}>
        Based on average monthly income of {money(monthly)}. SSS, PhilHealth, and Pag-IBIG are separate from your taxes.
      </p>
      <Rows fmt="centavo" rows={[
        { label: 'SSS (self-employed, incl. EC)', value: c.sss },
        { label: 'PhilHealth (direct contributor)', value: c.philhealth },
        { label: 'Pag-IBIG savings', value: c.pagibig },
        { label: 'Total per month', value: c.total, strong: true, rule: true },
      ]} />
      <p className="cite" style={{ marginTop: '10px' }}>
        Contribution schedules change by agency circular; confirm the current tables before paying.
      </p>
    </div>
  )
}

function EmployeeEstimator({ app }) {
  const [v, set] = useInputs(app, 'employee', { monthlyBasic: 30000, monthlyAllowances: 0, bonusesAnnual: 30000 })
  const r = useMemo(() => estimateEmployee(v), [v])
  return (
    <>
      <div className="card pad">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: '18px' }}>
          <NumField label="Monthly basic salary" value={v.monthlyBasic} onChange={x => set('monthlyBasic', x)} prefix="₱" lg />
          <NumField label="Taxable allowances · month" value={v.monthlyAllowances} onChange={x => set('monthlyAllowances', x)} prefix="₱" hint="Regular taxable extras, excluding de minimis benefits." />
          <NumField label="13th month & bonuses · year" value={v.bonusesAnnual} onChange={x => set('bonusesAnnual', x)} prefix="₱" hint="First ₱90,000 is tax-exempt." />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: '20px', marginTop: '20px', alignItems: 'start' }}>
        <div className="card pad">
          <h3 className="sec-h">Your monthly payslip</h3>
          <Rows fmt="centavo" rows={r.rows} />
        </div>
        <div className="card pad">
          <h3 className="sec-h">Your year, annualized</h3>
          <Rows fmt="centavo" rows={r.annualRows} />
          <BasisNote refs={r.references} />
        </div>
      </div>
    </>
  )
}

function CorporationEstimator({ app }) {
  const p = app.active
  const [v, set] = useInputs(app, 'corporation', {
    grossSales: 10000000, costOfSales: 4000000, opex: 3000000, totalAssets: 50000000, cwt: 0,
  })
  const taxYear = useManilaToday().getFullYear()
  const r = useMemo(() => estimateCorporation({
    ...v,
    registrationYear: p.registrationYear,
    taxYear,
    vatRegistered: p.vatRegistered,
  }), [v, p, taxYear])
  return (
    <>
      <div className="card pad">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: '18px' }}>
          <NumField label="Gross sales / revenue · year" value={v.grossSales} onChange={x => set('grossSales', x)} prefix="₱" lg />
          <NumField label="Cost of sales / services" value={v.costOfSales} onChange={x => set('costOfSales', x)} prefix="₱" />
          <NumField label="Operating expenses" value={v.opex} onChange={x => set('opex', x)} prefix="₱" />
          <NumField label="Total assets (excl. land)" value={v.totalAssets} onChange={x => set('totalAssets', x)} prefix="₱" hint="For the 20% small-corporation test." />
          <NumField label="Creditable tax withheld (2307s)" value={v.cwt} onChange={x => set('cwt', x)} prefix="₱" />
          <NumField label="Income tax already paid on this year's quarterly returns (1702Q)" value={v.quarterlyPaid} onChange={x => set('quarterlyPaid', x)} prefix="₱" />
          <NumField label="Excess credits carried over from last year" value={v.priorYearCredits} onChange={x => set('priorYearCredits', x)} prefix="₱" hint="Only if last year's annual return carried an overpayment over to this year." />
        </div>
        <p className="cite" style={{ marginTop: '14px' }}>
          Quarterly amounts are not computed here. Enter the income tax already paid on this year's 1702Q returns, and it is subtracted from what you pay with the annual return (1702-RT).
        </p>
      </div>
      <div style={{ marginTop: '16px', background: 'var(--brand)', color: '#fff', borderRadius: '13px', padding: '17px 20px' }}>
        <span style={{ fontSize: '15px', fontWeight: 600, lineHeight: 1.4 }}>
          {r.usesMcit
            ? <>The 2% MCIT binds this year: {money(r.incomeTaxDue)} (RCIT would be {money(r.rcit)}).</>
            : <>Income tax due: {money(r.incomeTaxDue)} at the {Math.round(r.rcitRate * 100)}% {r.smallCorp ? 'small-corporation' : 'standard'} rate{r.mcitApplies ? `, above the ${money(r.mcit)} MCIT floor` : ''}.</>}
          {!r.vat && r.pct > 0 && <> Plus {money(r.pct)} percentage tax (non-VAT).</>}
          {r.vatNotIncluded && <> {r.vatNote}</>}
        </span>
      </div>
      <div className="card pad" style={{ marginTop: '20px' }}>
        <h3 className="sec-h">How we got there</h3>
        <Rows rows={r.rows} />
        <BasisNote refs={r.references} />
      </div>
    </>
  )
}

function PayrollEstimator({ app }) {
  const [v, set] = useInputs(app, 'payroll', { monthlyBasic: 25000, monthlyAllowances: 0 })
  const r = useMemo(() => estimatePayroll(v), [v])
  return (
    <>
      <div className="card pad">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: '18px' }}>
          <NumField label="Employee monthly basic pay" value={v.monthlyBasic} onChange={x => set('monthlyBasic', x)} prefix="₱" lg />
          <NumField label="Taxable allowances · month" value={v.monthlyAllowances} onChange={x => set('monthlyAllowances', x)} prefix="₱" />
        </div>
      </div>
      <div className="card pad" style={{ marginTop: '20px' }}>
        <h3 className="sec-h">Withholding &amp; true cost for this employee</h3>
        <Rows fmt="centavo" rows={r.rows} />
        <BasisNote refs={r.references} />
      </div>
    </>
  )
}

export default function Estimator() {
  const app = useApp()
  const nav = useNavigate()
  const p = app.active
  const [tab, setTab] = useState(null)

  if (!app.profilesReady) return null
  if (!p) {
    return (
      <div className="page wrap" style={{ paddingTop: '40px', paddingBottom: '64px' }}>
        <div className="card pad empty-note">
          Set up a taxpayer profile first. The estimator adapts to the profile's regime and registrations.
          <div style={{ marginTop: '14px' }}><button className="btn" onClick={() => nav('/profiles/new')}>Create a profile</button></div>
        </div>
      </div>
    )
  }

  // Tabs relevant to this profile.
  const tabs = []
  if (p.type === 'individual') tabs.push(['individual', 'Business income'])
  if (p.type === 'mixed') tabs.push(['mixed', 'Mixed income'])
  if (p.type === 'employee') tabs.push(['employee', 'Take-home & annual tax'])
  if (p.type === 'corporation') tabs.push(['corporation', 'Corporate income tax'])
  if (p.hasEmployees || p.type === 'corporation') tabs.push(['payroll', 'Payroll withholding'])
  if (p.type === 'mixed') tabs.push(['employee', 'Compensation side'])
  const active = tab && tabs.some(([k]) => k === tab) ? tab : tabs[0][0]

  const titles = {
    individual: 'Which regime saves you the most?',
    mixed: 'Your combined tax picture',
    employee: 'Your pay, your tax, your take-home',
    corporation: 'RCIT or MCIT: what will you owe?',
    payroll: 'What withholding an employee costs',
  }

  return (
    <div className="page wrap" style={{ paddingTop: '26px', paddingBottom: '64px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div>
          <h1 className="pg-h1">{titles[active]}</h1>
          <p className="pg-sub">Estimating for <b>{p.name}</b>. Every line shows its math, every rate shows its source.</p>
        </div>
        {tabs.length > 1 && (
          <div className="seg" role="group" aria-label="Estimator">
            {tabs.map(([k, l]) => (
              <button key={k} className={active === k ? 'active' : ''} aria-pressed={active === k} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>
        )}
      </div>

      {/* Keyed by profile and tab so switching either remounts the inputs —
          otherwise one client's saved figures would linger under another's. */}
      <React.Fragment key={`${p.id || 'local'}:${active}`}>
        {active === 'individual' && <IndividualEstimator app={app} mixed={false} />}
        {active === 'mixed' && <IndividualEstimator app={app} mixed={true} />}
        {active === 'employee' && <EmployeeEstimator app={app} />}
        {active === 'corporation' && <CorporationEstimator app={app} />}
        {active === 'payroll' && <PayrollEstimator app={app} />}
      </React.Fragment>

      <Disclaimer>
        These figures are estimates computed from published rates and schedules; they don't account for your
        complete facts (special deductions, incentives, local specifics) and are not tax or
        legal advice. Have a CPA review your numbers before you rely on them for filing or payment.
      </Disclaimer>
    </div>
  )
}
