import React from 'react'
import { parseNum } from '../lib/format.js'

export function Seg({ options, value, onChange, ariaLabel }) {
  return (
    <div className="seg" role="group" aria-label={ariaLabel}>
      {options.map(([k, l]) => (
        <button key={k} className={value === k ? 'active' : ''} aria-pressed={value === k} onClick={() => onChange(k)}>{l}</button>
      ))}
    </div>
  )
}

export function NumField({ label, value, onChange, prefix, lg, hint }) {
  return (
    <div>
      <label className="lbl">{label}</label>
      <div className={'input-w' + (lg ? ' lg' : '')}>
        {prefix && <span className="pre">{prefix}</span>}
        <input
          type="text"
          inputMode="numeric"
          aria-label={label}
          value={value.toLocaleString('en-US')}
          onChange={e => onChange(parseNum(e.target.value))}
        />
      </div>
      {hint && <div style={{ fontSize: '11.5px', color: 'var(--dim)', marginTop: '5px' }}>{hint}</div>}
    </div>
  )
}

export function SelectField({ label, value, onChange, options }) {
  return (
    <div>
      <label className="lbl">{label}</label>
      <div className="input-w">
        <select aria-label={label} value={value} onChange={e => onChange(e.target.value)}>
          {options.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
    </div>
  )
}

export function Switch({ on, onChange, title, desc }) {
  return (
    <div className="switch-row" onClick={() => onChange(!on)} role="presentation">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={title}
        className={'switch' + (on ? ' on' : '')}
        onClick={e => { e.stopPropagation(); onChange(!on) }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="tt">{title}</div>
        {desc && <div className="dd">{desc}</div>}
      </div>
    </div>
  )
}

// Statutory-estimate disclaimer required under every computed figure.
export function Disclaimer({ children }) {
  return (
    <div className="disclaimer" role="note">
      <b>This is an estimate, not tax or legal advice.</b>{' '}
      {children || 'Figures are computed from published rates and schedules and do not account for your complete facts. Have a CPA review your numbers before filing or paying.'}
    </div>
  )
}

export function ConfidenceBadge({ confidence }) {
  if (confidence === 'verified') return <span className="badge-verified">✓ verified</span>
  return <span className="badge-review" title="This rule could not be fully verified against a primary source — confirm with your CPA before relying on it.">needs CPA review</span>
}

export function AgencyTag({ agency }) {
  const key = String(agency || '').toLowerCase().replace(/[^a-z]/g, '')
  return <span className={'agency ' + key}>{agency}</span>
}
