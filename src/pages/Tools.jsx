import React, { useState, useMemo } from 'react'
import { estimatePenalty } from '../engine/estimators/penalties.js'
import { withholdingForPeriod } from '../engine/estimators/payroll.js'
import { employeeMandatoryDeductions } from '../engine/estimators/contributions.js'
import businessTax from '../data/rules/business-tax.json'
import incomeTax from '../data/rules/income-tax.json'
import { NumField, Seg, Disclaimer } from '../components/ui.jsx'
import { money, money2 } from '../lib/format.js'

const VAT_THRESHOLD = businessTax.vatThreshold.value
const EIGHT = incomeTax.eightPercent.value

// Ported from v1; the math now runs through the shared engine + data layer.
export default function ToolsPage() {
  const [penDue, setPenDue] = useState(50000)
  const [penDays, setPenDays] = useState(60)
  const [penEopt, setPenEopt] = useState(true)
  const [whComp, setWhComp] = useState(50000)
  const [whGrossMode, setWhGrossMode] = useState('taxable')
  const [ytdGross, setYtdGross] = useState(240000)
  const [ytdMonths, setYtdMonths] = useState(6)

  const pen = useMemo(() => estimatePenalty({ taxDue: penDue, daysLate: penDays, microSmall: penEopt }), [penDue, penDays, penEopt])

  const whTaxable = useMemo(() => {
    if (whGrossMode === 'taxable') return whComp
    const ded = employeeMandatoryDeductions(whComp)
    return Math.max(0, whComp - ded.total)
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
        <p className="pg-sub">Quick utilities for the in-between moments — estimate a penalty, figure out withholding, or project where your year is heading.</p>
      </div>

      {/* penalty */}
      <div className="card pad" style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '-.01em' }}>Late-filing penalty estimator</h3>
        <p style={{ fontSize: '13.5px', color: 'var(--mut)', marginTop: '3px' }}>
          Surcharge, interest and compromise penalty if you miss a deadline. The EOPT Act gives micro &amp; small
          taxpayers (gross sales under ₱20M) reduced rates.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '16px', marginTop: '18px', alignItems: 'end' }}>
          <NumField label="Basic tax due" value={penDue} onChange={setPenDue} prefix="₱" />
          <NumField label="Days late" value={penDays} onChange={setPenDays} />
          <div>
            <label className="lbl" style={{ marginBottom: '8px' }}>Taxpayer size</label>
            <Seg options={[['eopt', 'Micro / Small'], ['reg', 'Medium / Large']]} value={penEopt ? 'eopt' : 'reg'} onChange={k => setPenEopt(k === 'eopt')} ariaLabel="Taxpayer size" />
          </div>
        </div>
        <div style={{ marginTop: '18px', borderTop: '1px solid var(--line2)', paddingTop: '6px' }}>
          {[
            { label: 'Basic tax due', value: money(penDue) },
            { label: `Surcharge (${Math.round(pen.surRate * 100)}% — NIRC Sec 248${penEopt ? ', reduced by EOPT' : ''})`, value: money2(pen.surcharge) },
            { label: `Interest · ${penDays} days @ ${Math.round(pen.intRate * 100)}%/yr (NIRC Sec 249)`, value: money2(pen.interest) },
            { label: `Compromise penalty (RMO 7-2015 schedule${penEopt ? ', 50% off' : ''})`, value: money2(pen.compromise) },
          ].map((row, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
              <span style={{ fontSize: '13.5px', color: 'var(--mut)' }}>{row.label}</span>
              <span className="mono" style={{ fontSize: '13.5px', fontWeight: 500 }}>{row.value}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0 2px', borderTop: '1px solid var(--line)', marginTop: '4px' }}>
            <span style={{ fontSize: '14px', fontWeight: 700 }}>Estimated total to pay</span>
            <span className="mono" style={{ fontSize: '20px', fontWeight: 600, color: 'var(--accInk)' }}>{money2(pen.total)}</span>
          </div>
          <p className="cite" style={{ marginTop: '10px' }}>
            Compromise penalties are the BIR's standard settlement amounts and are technically negotiable; interest
            accrues until actually paid.
          </p>
        </div>
      </div>

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
            <NumField label="Months in" value={ytdMonths} onChange={setYtdMonths} />
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
          {projVat && <div className="mini-warn">You're projected to pass the ₱3M VAT threshold — the 8% option won't be available at that level, and VAT registration kicks in. Run the estimator with your full-year figure.</div>}
        </div>
      </div>

      <Disclaimer />
    </div>
  )
}
