import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../state/AppState.jsx'
import { estimateIndividual } from '../engine/estimators/individual.js'
import { estimateEmployee } from '../engine/estimators/employee.js'
import { estimateCorporation } from '../engine/estimators/corporation.js'
import { estimatePayroll } from '../engine/estimators/payroll.js'
import { selfEmployedMonthlyContributions } from '../engine/estimators/contributions.js'
import { NumField, Disclaimer } from '../components/ui.jsx'
import { money, money2 } from '../lib/format.js'

function Rows({ rows }) {
  return (
    <div style={{ marginTop: '8px' }}>
      {rows.map((x, i) => (
        <div key={i}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '16px', padding: '9px 0', borderTop: x.rule ? '1px solid var(--line)' : undefined, marginTop: x.rule ? '2px' : undefined }}>
            <span style={{ fontSize: '13.5px', color: x.strong ? 'var(--ink)' : 'var(--mut)', fontWeight: x.strong ? 600 : 400 }}>{x.label}</span>
            <span className="mono" style={{ fontSize: '14px', fontWeight: x.strong ? 700 : 500 }}>
              {x.value == null ? '—' : x.value < 0 ? `(${money2(-x.value)})` : money2(x.value)}
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
      Legal basis: {Array.from(new Set(refs)).join(' · ')} — details and verification dates on the References page.
    </p>
  )
}

// Per-profile input memory so returning users see their numbers.
// Persists 900ms after the last keystroke to avoid write storms.
function useInputs(app, key, defaults) {
  const saved = app.active?.inputs?.[key]
  const [vals, setVals] = useState({ ...defaults, ...(saved || {}) })
  const timer = React.useRef(null)
  function update(k, v) {
    const next = { ...vals, [k]: v }
    setVals(next)
    if (app.active) {
      clearTimeout(timer.current)
      const snapshot = { ...app.active, inputs: { ...(app.active.inputs || {}), [key]: next } }
      timer.current = setTimeout(() => { app.save(snapshot).catch(() => {}) }, 900)
    }
  }
  React.useEffect(() => () => clearTimeout(timer.current), [])
  return [vals, update]
}

function IndividualEstimator({ app, mixed }) {
  const p = app.active
  const [v, set] = useInputs(app, mixed ? 'mixed' : 'individual', {
    gross: 480000, expenses: 180000, cwt: 0, compensationTaxable: 600000, compensationWithheld: 62500,
  })
  const r = useMemo(() => estimateIndividual({
    gross: v.gross, expenses: v.expenses, cwt: v.cwt,
    vatRegistered: p.vatRegistered, mixed,
    compensationTaxable: mixed ? v.compensationTaxable : 0,
    compensationWithheld: mixed ? v.compensationWithheld : 0,
  }), [v, p.vatRegistered, mixed])

  return (
    <>
      <div className="card pad">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: '18px' }}>
          <NumField label="Business gross sales / receipts · year" value={v.gross} onChange={x => set('gross', x)} prefix="₱" lg />
          <NumField label="Itemized expenses" value={v.expenses} onChange={x => set('expenses', x)} prefix="₱" />
          <NumField label="Tax withheld by clients (2307s)" value={v.cwt} onChange={x => set('cwt', x)} prefix="₱" />
          {mixed && <NumField label="Taxable compensation · year" value={v.compensationTaxable} onChange={x => set('compensationTaxable', x)} prefix="₱" hint="After mandatory contributions and non-taxable benefits — see box 21 of your 2316." />}
          {mixed && <NumField label="Tax withheld by employer" value={v.compensationWithheld} onChange={x => set('compensationWithheld', x)} prefix="₱" />}
        </div>
      </div>

      {r.overThreshold && (
        <div style={{ marginTop: '16px' }} className="mini-warn">
          You're above the <b>₱3,000,000 VAT threshold</b> — the 8% option and the 3% percentage tax no longer apply,
          and VAT registration is mandatory (register before the end of the month after the month you crossed it).
          Income-tax figures below exclude VAT, which is computed separately on sales less input VAT.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '14px', marginTop: '16px' }}>
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
              <div style={{ fontSize: '12px', color: 'var(--mut)', marginTop: '3px' }}>{c.eligible ? 'estimated annual tax' : 'Over ₱3M / VAT — not available'}</div>
              <div style={{ marginTop: '14px', paddingTop: '13px', borderTop: '1px solid var(--line2)', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12.5px', color: 'var(--mut)' }}>Income tax</span>
                  <span className="mono" style={{ fontSize: '12.5px', fontWeight: 600 }}>{c.eligible ? money(c.incomeTax) : '—'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12.5px', color: 'var(--mut)' }}>Business tax</span>
                  <span className="mono" style={{ fontSize: '12.5px', fontWeight: 600 }}>
                    {!c.eligible ? '—' : c.businessTax.kind === 'vat' ? 'VAT 12%' : c.businessTax.kind === 'pct' ? money(c.businessTax.amount) : '₱0'}
                  </span>
                </div>
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
          {r.savingsVsNext > 0 ? ` — saving ${money(r.savingsVsNext)} versus the next best.` : '.'}
          {' '}Note: the regime on this profile is {p.regime === '8pct' ? 'the 8% option' : 'graduated rates'}, and the election locks for the year on the Q1 filing.
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: '20px', marginTop: '20px', alignItems: 'start' }}>
        <div className="card pad">
          <h3 className="sec-h">How we got there — {r.best.name}</h3>
          <Rows rows={r.rows} />
          <BasisNote refs={r.references} />
        </div>
        <FormPreview r={r} mixed={mixed} />
      </div>
      <SelfContributionsCard monthly={Math.round(v.gross / 12)} />
    </>
  )
}

// How the winning option lands on the annual return — the v1 "form preview".
function FormPreview({ r, mixed }) {
  const best = r.best
  const formTitle = (mixed || best.key === 'itemized') ? 'BIR Form 1701' : 'BIR Form 1701A'
  const taxableLabel = best.key === '8pct' ? 'Taxable base (gross less allowance)' : 'Net taxable income'
  const rows = [
    { label: taxableLabel, value: null },
    { label: 'Income tax due', value: money(best.incomeTax) },
    { label: best.businessTax.kind === 'vat' ? 'Business tax (VAT — separate 2550Q)' : 'Percentage tax (separate 2551Q)', value: best.businessTax.kind === 'vat' ? 'VAT 12%' : best.businessTax.kind === 'pct' ? money(best.businessTax.amount) : '—' },
    { label: 'Less: creditable withholding', value: r.credits > 0 ? `(${money(r.credits)})` : '—' },
    { label: r.netPayable >= 0 ? 'Tax payable with the annual return' : 'Overpayment (refund / carry-over)', value: money(Math.abs(r.netPayable)) },
  ]
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ background: '#f3f7fb', borderBottom: '1px solid var(--line)', padding: '15px 18px' }}>
        <div className="mono" style={{ fontSize: '11px', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--mut)' }}>Where it lands on the return</div>
        <div style={{ fontWeight: 700, fontSize: '14.5px', marginTop: '3px' }}>{formTitle}</div>
      </div>
      <div style={{ padding: '6px 18px 16px' }}>
        {rows.filter(x => x.value != null).map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 0', borderTop: i ? '1px solid var(--line2)' : 'none' }}>
            <span style={{ flex: 1, fontSize: '13px', color: 'var(--mut)' }}>{f.label}</span>
            <span className="mono" style={{ fontSize: '13.5px', fontWeight: 600 }}>{f.value}</span>
          </div>
        ))}
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
        Based on average monthly income of {money(monthly)} — SSS, PhilHealth, and Pag-IBIG are separate from your taxes.
      </p>
      <Rows rows={[
        { label: 'SSS (self-employed, incl. EC)', value: c.sss },
        { label: 'PhilHealth (direct contributor)', value: c.philhealth },
        { label: 'Pag-IBIG savings', value: c.pagibig },
        { label: 'Total per month', value: c.total, strong: true, rule: true },
      ]} />
      <p className="cite" style={{ marginTop: '10px' }}>
        Contribution schedules carry a "needs CPA review" flag until re-verified — see References.
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
          <NumField label="Taxable allowances · month" value={v.monthlyAllowances} onChange={x => set('monthlyAllowances', x)} prefix="₱" hint="Regular taxable extras — exclude de minimis benefits." />
          <NumField label="13th month & bonuses · year" value={v.bonusesAnnual} onChange={x => set('bonusesAnnual', x)} prefix="₱" hint="First ₱90,000 is tax-exempt." />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: '20px', marginTop: '20px', alignItems: 'start' }}>
        <div className="card pad">
          <h3 className="sec-h">Your monthly payslip</h3>
          <Rows rows={r.rows} />
        </div>
        <div className="card pad">
          <h3 className="sec-h">Your year, annualized</h3>
          <Rows rows={r.annualRows} />
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
  const r = useMemo(() => estimateCorporation({
    ...v,
    registrationYear: p.registrationYear,
    taxYear: new Date().getFullYear(),
    vatRegistered: p.vatRegistered,
  }), [v, p])
  return (
    <>
      <div className="card pad">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: '18px' }}>
          <NumField label="Gross sales / revenue · year" value={v.grossSales} onChange={x => set('grossSales', x)} prefix="₱" lg />
          <NumField label="Cost of sales / services" value={v.costOfSales} onChange={x => set('costOfSales', x)} prefix="₱" />
          <NumField label="Operating expenses" value={v.opex} onChange={x => set('opex', x)} prefix="₱" />
          <NumField label="Total assets (excl. land)" value={v.totalAssets} onChange={x => set('totalAssets', x)} prefix="₱" hint="For the 20% small-corporation test." />
          <NumField label="Creditable tax withheld (2307s)" value={v.cwt} onChange={x => set('cwt', x)} prefix="₱" />
        </div>
      </div>
      <div style={{ marginTop: '16px', background: 'var(--brand)', color: '#fff', borderRadius: '13px', padding: '17px 20px' }}>
        <span style={{ fontSize: '15px', fontWeight: 600, lineHeight: 1.4 }}>
          {r.usesMcit
            ? <>The 2% MCIT binds this year: {money(r.incomeTaxDue)} (RCIT would be {money(r.rcit)}).</>
            : <>Income tax due: {money(r.incomeTaxDue)} at the {Math.round(r.rcitRate * 100)}% {r.smallCorp ? 'small-corporation' : 'standard'} rate{r.mcitApplies ? ` — above the ${money(r.mcit)} MCIT floor` : ''}.</>}
          {!r.vat && r.pct > 0 && <> Plus {money(r.pct)} percentage tax (non-VAT).</>}
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
        <Rows rows={r.rows} />
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
          Set up a taxpayer profile first — the estimator adapts to the profile's regime and registrations.
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
    corporation: 'RCIT or MCIT — what will you owe?',
    payroll: 'What withholding an employee costs',
  }

  return (
    <div className="page wrap" style={{ paddingTop: '26px', paddingBottom: '64px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div>
          <h1 className="pg-h1">{titles[active]}</h1>
          <p className="pg-sub">Estimating for <b>{p.name}</b> — every line shows its math, every rate shows its source.</p>
        </div>
        {tabs.length > 1 && (
          <div className="seg" role="group" aria-label="Estimator">
            {tabs.map(([k, l]) => (
              <button key={k} className={active === k ? 'active' : ''} aria-pressed={active === k} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>
        )}
      </div>

      {active === 'individual' && <IndividualEstimator app={app} mixed={false} />}
      {active === 'mixed' && <IndividualEstimator app={app} mixed={true} />}
      {active === 'employee' && <EmployeeEstimator app={app} />}
      {active === 'corporation' && <CorporationEstimator app={app} />}
      {active === 'payroll' && <PayrollEstimator app={app} />}

      <Disclaimer>
        These figures are estimates computed from published rates and schedules; they don't account for your
        complete facts (special deductions, incentives, prior-year credits, local specifics) and are not tax or
        legal advice. Have a CPA review your numbers before you rely on them for filing or payment.
      </Disclaimer>
    </div>
  )
}
