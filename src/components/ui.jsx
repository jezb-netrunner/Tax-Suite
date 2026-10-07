import React from 'react'
import { parseMoneyInput, parseIntegerInput, formatMoneyInput, formatIntegerInput } from '../lib/format.js'

export function Seg({ options, value, onChange, ariaLabel }) {
  return (
    <div className="seg" role="group" aria-label={ariaLabel}>
      {options.map(([k, l]) => (
        <button key={k} className={value === k ? 'active' : ''} aria-pressed={value === k} onClick={() => onChange(k)}>{l}</button>
      ))}
    </div>
  )
}

/**
 * Amount or whole-number box.
 *
 * Props
 *   label, hint, prefix ('₱'), lg       as before
 *   value        current value: pesos (Number, up to 2 decimals) for kind 'money',
 *                a whole Number for kind 'integer'; null/undefined shows an empty box
 *   onChange(v)  called only with VALID values (pesos for money). An empty box
 *                sends `emptyValue` (default 0). Invalid text shows a message and
 *                keeps the last valid value.
 *   kind         'money' (default) or 'integer'
 *   min, max     integer kind only: allowed range (a message, never silent clamping)
 *   emptyValue   value sent when the box is cleared (default 0)
 *
 * The text is left exactly as typed while the box has focus (so the cursor
 * never jumps); thousands separators are added when the box loses focus.
 */
export function NumField({ label, value, onChange, prefix, lg, hint, kind = 'money', min = 0, max, emptyValue = 0 }) {
  // Real label/input association, so tapping the label focuses the field and
  // any hint text is announced with it.
  const id = React.useId()
  const hintId = hint ? id + '-hint' : null
  const errId = id + '-err'
  const isMoney = kind !== 'integer'
  const format = isMoney ? formatMoneyInput : formatIntegerInput
  const parse = (text, opts) => isMoney
    ? parseMoneyInput(text, opts)
    : parseIntegerInput(text, { min, max: max ?? 999999999 })

  const [text, setText] = React.useState(() => format(value))
  const [error, setError] = React.useState(null)
  const focused = React.useRef(false)
  // The last value this box sent (or was given), to tell our own updates from
  // outside changes such as switching client.
  const last = React.useRef(value)

  React.useEffect(() => {
    if (focused.current || sameValue(value, last.current)) return
    last.current = value
    setText(isMoney ? formatMoneyInput(value) : formatIntegerInput(value))
    setError(null)
  }, [value, isMoney])

  function handleChange(e) {
    const next = e.target.value
    // Deleting digits from "4,800" passes through "4,80"; only typed or pasted
    // text is held to the strict comma check.
    const inputType = e.nativeEvent && e.nativeEvent.inputType
    const deleting = typeof inputType === 'string' ? inputType.startsWith('delete') : next.length < text.length
    setText(next)
    const r = parse(next, { allowShortGroups: deleting })
    if (!r.ok) {
      setError(r.error)
      return
    }
    setError(null)
    const v = r.empty ? emptyValue : r.value
    if (!sameValue(v, last.current)) {
      last.current = v
      onChange(v)
    }
  }

  function handleBlur() {
    focused.current = false
    const r = parse(text, { allowShortGroups: true })
    if (r.ok && !r.empty) setText(format(r.value))
  }

  const still = last.current == null || last.current === ''
    ? ''
    : ' Still using ' + (isMoney ? '₱' : '') + (format(last.current) || '0') + '.'
  const describedBy = [hintId, error ? errId : null].filter(Boolean).join(' ') || undefined

  return (
    <div>
      <label className="lbl" htmlFor={id}>{label}</label>
      <div className={'input-w' + (lg ? ' lg' : '')} style={error ? { borderColor: 'var(--bad)' } : undefined}>
        {prefix && <span className="pre" aria-hidden="true">{prefix}</span>}
        <input
          id={id}
          type="text"
          inputMode={isMoney ? 'decimal' : 'numeric'}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          value={text}
          onFocus={() => { focused.current = true }}
          onChange={handleChange}
          onBlur={handleBlur}
        />
      </div>
      {hint && <div id={hintId} style={{ fontSize: '11.5px', color: 'var(--dim)', marginTop: '5px' }}>{hint}</div>}
      <div id={errId} aria-live="polite" style={error ? { fontSize: '12.5px', color: 'var(--bad)', marginTop: '5px', lineHeight: 1.45 } : undefined}>
        {error ? error + still : ''}
      </div>
    </div>
  )
}

function sameValue(a, b) {
  return a === b || (a == null && b == null)
}

export function SelectField({ label, value, onChange, options }) {
  const id = React.useId()
  return (
    <div>
      <label className="lbl" htmlFor={id}>{label}</label>
      <div className="input-w">
        <select id={id} value={value} onChange={e => onChange(e.target.value)}>
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
export function Disclaimer({ children, lead }) {
  return (
    <div className="disclaimer" role="note">
      <b>{lead || 'This is an estimate, not tax or legal advice.'}</b>{' '}
      {children || 'Figures are computed from published rates and schedules and do not account for your complete facts. Have a CPA review your numbers before filing or paying.'}
    </div>
  )
}

export function AgencyTag({ agency }) {
  const key = String(agency || '').toLowerCase().replace(/[^a-z]/g, '')
  return <span className={'agency ' + key}>{agency}</span>
}
