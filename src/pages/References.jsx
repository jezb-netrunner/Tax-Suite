import React from 'react'
import meta from '../data/rules/meta.json'
import incomeTax from '../data/rules/income-tax.json'
import businessTax from '../data/rules/business-tax.json'
import corporate from '../data/rules/corporate.json'
import wcomp from '../data/rules/withholding-compensation.json'
import penalties from '../data/rules/penalties.json'
import contributions from '../data/rules/contributions.json'
import ewtRates from '../data/rules/ewt-rates.json'
import holidays from '../data/rules/holidays.json'
import obligations from '../data/rules/obligations.json'
import { ConfidenceBadge, AgencyTag } from '../components/ui.jsx'

// Flatten every rule in the data layer into an auditable register:
// value → legal basis → confidence. This page is generated from the same
// files the engine computes from, so it can't drift from the app's behavior.
function ruleEntries(file, fileLabel) {
  return Object.entries(file)
    .filter(([k, v]) => v && typeof v === 'object' && v.legalBasis)
    .map(([k, v]) => ({
      file: fileLabel,
      key: k,
      legalBasis: v.legalBasis,
      confidence: v.confidence || 'needs_review',
      notes: v.notes || '',
    }))
}

const RULE_FILES = [
  [incomeTax, 'Individual income tax'],
  [businessTax, 'VAT & percentage tax'],
  [corporate, 'Corporate income tax'],
  [wcomp, 'Withholding on compensation'],
  [penalties, 'Penalties & classification'],
  [contributions, 'SSS · PhilHealth · Pag-IBIG'],
  [ewtRates, 'Expanded withholding rates'],
]

function labelize(key) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())
}

export default function References() {
  const rules = RULE_FILES.flatMap(([f, label]) => ruleEntries(f, label))
  const obs = obligations.obligations
  const reviewCount = rules.filter(r => r.confidence !== 'verified').length +
    obs.filter(o => o.confidence !== 'verified').length

  return (
    <div className="page wrap" style={{ paddingTop: '26px', paddingBottom: '64px', maxWidth: '900px' }}>
      <h1 className="pg-h1">References &amp; legal basis</h1>
      <p className="pg-sub">
        Every rate, threshold, and deadline in this app maps to the law or issuance it comes from.
        Rules last verified: <b>{meta.verifiedDate}</b>.
        {reviewCount > 0 && <> Items marked <span className="badge-review">needs CPA review</span> could not be fully confirmed against a primary source — treat them as provisional.</>}
      </p>

      <div className="card pad" style={{ marginTop: '20px' }}>
        <h3 className="sec-h">Primary statutes</h3>
        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13.5px', lineHeight: 1.6, color: 'var(--mut)' }}>
          <div><b style={{ color: 'var(--ink)' }}>NIRC of 1997</b> — the Tax Code, as amended by:</div>
          <div>· RA 10963 (TRAIN, 2017) — individual rate tables, 8% option, withholding structure</div>
          <div>· RA 11534 (CREATE, 2021) — corporate rates, MCIT reduction window, percentage-tax window</div>
          <div>· RA 11976 (Ease of Paying Taxes Act, 2024) — invoicing, classification, penalty reductions, filing venue</div>
          <div>· RA 12066 (CREATE MORE, 2024) — RBE enhanced-deduction regime, 20% RBE rate</div>
          <div><b style={{ color: 'var(--ink)' }}>Non-BIR:</b> RA 7160 (Local Government Code) · RA 11199 (SSS) · RA 11223 (UHC/PhilHealth) · RA 9679 (Pag-IBIG) · PD 851 (13th month) · Revised Corporation Code</div>
        </div>
      </div>

      <h3 className="sec-h" style={{ margin: '26px 0 12px' }}>Computation rules</h3>
      <div className="list-card">
        {rules.map((r, i) => (
          <div key={i} className="check-row">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '14px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                {labelize(r.key)} <span className="tag">{r.file}</span> <ConfidenceBadge confidence={r.confidence} />
              </div>
              <div className="cite" style={{ marginTop: '5px' }}>{r.legalBasis.join(' · ')}</div>
              {r.notes && <div style={{ fontSize: '12.5px', color: 'var(--mut)', marginTop: '4px', lineHeight: 1.5 }}>{r.notes}</div>}
            </div>
          </div>
        ))}
      </div>

      <h3 className="sec-h" style={{ margin: '26px 0 12px' }}>Deadline rules ({obs.length})</h3>
      <div className="list-card">
        {obs.map(ob => (
          <div key={ob.id} className="check-row">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '14px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                {ob.title}
                {ob.form && ob.form !== '—' && <span className="boxcode">{ob.form}</span>}
                <ConfidenceBadge confidence={ob.confidence} />
              </div>
              <div className="cite" style={{ marginTop: '5px' }}>{(ob.legalBasis || []).join(' · ')}</div>
              {ob.notes && <div style={{ fontSize: '12.5px', color: 'var(--mut)', marginTop: '4px', lineHeight: 1.5 }}>{ob.notes}</div>}
            </div>
            <AgencyTag agency={ob.agency} />
          </div>
        ))}
      </div>

      <h3 className="sec-h" style={{ margin: '26px 0 12px' }}>Holiday calendar used for date shifting</h3>
      <div className="card pad">
        <div className="cite" style={{ marginBottom: '10px' }}>
          {holidays.shiftRule.value}. {holidays.confidence !== 'verified' && 'Holiday list pending verification against the official proclamations.'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: '7px' }}>
          {holidays.holidays.map(h => (
            <div key={h.date + h.name} style={{ fontSize: '12.5px', color: 'var(--mut)' }}>
              <span className="mono" style={{ color: 'var(--ink)' }}>{h.date}</span> — {h.name}
              <span style={{ color: 'var(--dim)' }}> ({h.type === 'regular' ? 'regular' : 'special'})</span>
            </div>
          ))}
        </div>
      </div>

      <p className="cite" style={{ marginTop: '18px', lineHeight: 1.7 }}>
        All of the above lives in editable data files (src/data/rules/) separate from the app's code, so rates and
        dates can be corrected the day an issuance changes them. This register is generated from those same files —
        what you see here is exactly what the calculators and calendar use.
      </p>
    </div>
  )
}
