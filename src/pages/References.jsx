import React from 'react'
import meta from '../data/rules/meta.json'
import { AgencyTag } from '../components/ui.jsx'
import { ConfidenceBadge } from '../components/Confidence.jsx'
import { ruleRegister } from '../engine/rulebook.js'

// The register of every rule in the rulebook (src/data/rules/*.json): its
// value, legal basis, notes and confidence. It is generated from the same
// files the calculators and the calendar read (src/engine/rulebook.js), so it
// cannot drift from the app's behaviour. Rules marked needs_review show the
// "Unconfirmed: check with the agency" badge (H07, owner decision 8).

const NUMERIC = /^(−?₱|\d)|%$/

// Amounts and rates in a monospace font; long text gets a minimum width so a
// table scrolls sideways on a phone instead of squeezing a column.
function cellClass(c) {
  if (NUMERIC.test(c)) return 'num'
  return c.length > 40 ? 'long' : undefined
}

// Values with more cells than this start collapsed.
const BIG_VALUE = 100

function cellCount(node) {
  if (!node) return 0
  if (node.kind === 'text') return 1
  if (node.kind === 'table') return node.rows.length * node.columns.length
  if (node.kind === 'list') return node.items.reduce((n, it) => n + (typeof it === 'string' ? 1 : cellCount(it)), 0)
  return node.fields.reduce((n, f) => n + cellCount(f.value), 0)
}

function ValueTable({ node, caption }) {
  return (
    <div className="ref-scroll" role="region" aria-label={caption} tabIndex={0}>
      <table className="ref-tbl">
        <caption className="sr-only">{caption}</caption>
        <thead><tr>{node.columns.map(c => <th key={c} scope="col">{c}</th>)}</tr></thead>
        <tbody>
          {node.rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j} className={cellClass(c)}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RuleValue({ node, caption }) {
  if (!node) return null
  if (node.kind === 'text') return <div className="ref-val">{node.text}</div>
  if (node.kind === 'table') return <ValueTable node={node} caption={caption} />
  if (node.kind === 'list') {
    return (
      <ul className="ref-list">
        {node.items.map((it, i) => <li key={i}>{typeof it === 'string' ? it : <RuleValue node={it} caption={caption} />}</li>)}
      </ul>
    )
  }
  return (
    <dl className="ref-fields">
      {node.fields.map(f => (
        <React.Fragment key={f.label}>
          <dt>{f.label}</dt>
          <dd>{f.value.kind === 'text' ? f.value.text : <RuleValue node={f.value} caption={`${caption}: ${f.label}`} />}</dd>
        </React.Fragment>
      ))}
    </dl>
  )
}

function ShownValue({ node, caption }) {
  if (!node) return null
  if (cellCount(node) <= BIG_VALUE) return <RuleValue node={node} caption={caption} />
  return (
    <details className="dl-details">
      <summary>Show the value<span className="sr-only">{` of ${caption}`}</span></summary>
      <RuleValue node={node} caption={caption} />
    </details>
  )
}

function EntryHead({ title, children, confidence }) {
  return (
    <div style={{ display: 'flex', gap: '8px 10px', alignItems: 'center', flexWrap: 'wrap' }}>
      <h3 style={{ fontWeight: 600, fontSize: '14px' }}>{title}</h3>
      {children}
      <ConfidenceBadge confidence={confidence} />
    </div>
  )
}

function Cite({ basis }) {
  if (!basis || !basis.length) return null
  return <div className="cite" style={{ marginTop: '6px' }}>{basis.join(' · ')}</div>
}

function Notes({ text }) {
  if (!text) return null
  return <div style={{ fontSize: '12.5px', color: 'var(--mut)', marginTop: '4px', lineHeight: 1.5 }}>{text}</div>
}

export default function References() {
  const reg = ruleRegister()
  const shift = reg.holidays.find(e => e.id === 'holidays.json:shiftRule')
  const rollOver = reg.holidays.filter(e => e.kind === 'rollOver')
  const years = reg.holidays.filter(e => e.kind === 'year')
  const notes2027 = reg.holidays.find(e => e.id === 'holidays.json:notes2027')
  const fixed = reg.holidays.find(e => e.kind === 'fixedByLaw')

  return (
    <div className="page wrap" style={{ paddingTop: '26px', paddingBottom: '64px', maxWidth: '900px' }}>
      <h1 className="pg-h1">References &amp; legal basis</h1>
      <p className="pg-sub">
        Every rate, threshold, and deadline in this app maps to the law or issuance it comes from.
        Rules last verified: <b>{meta.verifiedDate}</b>.
      </p>
      <p style={{ fontSize: '13px', color: 'var(--mut)', marginTop: '8px', lineHeight: 1.6, maxWidth: '760px' }}>
        Each rule below shows its value, its legal basis and how sure we are of it. <b>“Verified”</b> means it was
        checked against official sources. An orange <b>“Unconfirmed”</b> badge means the rule is not yet confirmed
        from an official source: check with the agency (BIR, SSS, PhilHealth, Pag-IBIG, SEC, DOLE or your LGU)
        before relying on it. The calendar and checklist show the same badge.
      </p>

      <div className="card pad" style={{ marginTop: '20px' }}>
        <h2 className="sec-h">Primary statutes</h2>
        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13.5px', lineHeight: 1.6, color: 'var(--mut)' }}>
          <div><b style={{ color: 'var(--ink)' }}>NIRC of 1997</b>, the Tax Code, as amended by:</div>
          <div>· RA 10963 (TRAIN, 2017): individual rate tables, 8% option, withholding structure</div>
          <div>· RA 11534 (CREATE, 2021): corporate rates, MCIT reduction window, percentage-tax window</div>
          <div>· RA 11976 (Ease of Paying Taxes Act, 2024): invoicing, classification, penalty reductions, filing venue</div>
          <div>· RA 12066 (CREATE MORE, 2024): RBE enhanced-deduction regime, 20% RBE rate</div>
          <div><b style={{ color: 'var(--ink)' }}>Non-BIR:</b> RA 7160 (Local Government Code) · RA 11199 (SSS) · RA 11223 (UHC/PhilHealth) · RA 9679 (Pag-IBIG) · PD 851 (13th month) · Revised Corporation Code</div>
        </div>
      </div>

      <h2 className="sec-h" style={{ margin: '26px 0 12px' }}>Computation rules ({reg.computation.length})</h2>
      <div className="list-card">
        {reg.computation.map(r => (
          <div key={r.id} className="check-row">
            <div style={{ flex: 1, minWidth: 0 }}>
              <EntryHead title={r.title} confidence={r.confidence}><span className="tag">{r.file}</span></EntryHead>
              <ShownValue node={r.value} caption={r.title} />
              <Cite basis={r.legalBasis} />
              <Notes text={r.notes} />
            </div>
          </div>
        ))}
      </div>

      <h2 className="sec-h" style={{ margin: '26px 0 12px' }}>Deadline rules ({reg.obligations.length})</h2>
      <div className="list-card">
        {reg.obligations.map(ob => (
          <div key={ob.id} className="check-row">
            <div style={{ flex: 1, minWidth: 0 }}>
              <EntryHead title={ob.title} confidence={ob.confidence}>
                {ob.form && <span className="boxcode">{ob.form}</span>}
              </EntryHead>
              <div className="ref-val"><b>When:</b>{` ${ob.when}`}</div>
              <Cite basis={ob.legalBasis} />
              <Notes text={ob.notes} />
            </div>
            <AgencyTag agency={ob.agency} />
          </div>
        ))}
      </div>

      {reg.overrides.length > 0 && (
        <>
          <h2 className="sec-h" style={{ margin: '26px 0 12px' }}>Deadline extensions</h2>
          <div className="card pad">
            <p style={{ fontSize: '13px', color: 'var(--mut)', lineHeight: 1.55 }}>
              Deadlines moved by a later BIR issuance. The calendar shows the new date with the issuance.
            </p>
            <ValueTable caption="Deadline extensions" node={{
              kind: 'table', columns: ['Deadline', 'Form', 'Was due', 'Moved to', 'By'],
              rows: reg.overrides.map(o => [o.title, o.form || '—', o.from, o.to, o.basis]),
            }} />
          </div>
        </>
      )}

      <h2 className="sec-h" style={{ margin: '26px 0 12px' }}>Holiday calendar used for date shifting</h2>
      <div className="card pad">
        <EntryHead title={shift.title} confidence={shift.confidence} />
        <RuleValue node={shift.value} caption={shift.title} />
        <Cite basis={shift.legalBasis} />
        <Notes text={shift.notes} />
        <Notes text={`Never moved later (${shift.noShift.titles.join('; ')}): ${shift.noShift.note}`} />

        <h3 style={{ fontWeight: 600, fontSize: '14px', marginTop: '18px' }}>Weekend and holiday rule by agency</h3>
        <div className="ref-scroll" role="region" aria-label="Weekend and holiday rule by agency" tabIndex={0}>
          <table className="ref-tbl">
            <caption className="sr-only">Weekend and holiday rule by agency</caption>
            <thead><tr><th scope="col">Agency</th><th scope="col">On a weekend or holiday</th><th scope="col">Basis</th><th scope="col">Confidence</th></tr></thead>
            <tbody>
              {rollOver.map(r => (
                <tr key={r.id}>
                  <td>{r.agency}</td>
                  <td>{r.policy}</td>
                  <td className="long">{r.legalBasis.join(' · ')}{r.notes ? ` ${r.notes}` : ''}</td>
                  <td><ConfidenceBadge confidence={r.confidence} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {years.map(y => (
          <div key={y.id} style={{ marginTop: '18px' }}>
            <EntryHead title={y.title} confidence={y.confidence} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: '7px', marginTop: '8px' }}>
              {y.rows.map(h => (
                <div key={h.date + h.name} style={{ fontSize: '12.5px', color: 'var(--mut)' }}>
                  <span className="mono" style={{ color: 'var(--ink)' }}>{h.date}</span> · {h.name}
                  <span> ({h.type === 'regular' ? 'regular' : 'special'})</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        <Notes text={reg.holidayConfidenceNote} />

        <div style={{ marginTop: '18px' }}>
          <EntryHead title={notes2027.title} confidence={notes2027.confidence} />
          <Notes text={notes2027.notes} />
        </div>

        <div style={{ marginTop: '18px' }}>
          <EntryHead title={fixed.title} confidence={fixed.confidence} />
          <RuleValue node={fixed.value} caption={fixed.title} />
          <Cite basis={fixed.legalBasis} />
          <Notes text={fixed.notes} />
        </div>
      </div>

      <p className="cite" style={{ marginTop: '18px', lineHeight: 1.7 }}>
        All of the above lives in editable data files (src/data/rules/) separate from the app's code, so rates and
        dates can be corrected the day an issuance changes them. The calculators and the calendar read their rates,
        thresholds and dates from those same files, and this register is generated from them, so the values shown
        here are the ones the calculators and the calendar use.
      </p>
    </div>
  )
}
