import { confidenceReasons, isUnconfirmed } from '../engine/deadlines.js'
import { formCodeHint } from '../data/glossary.js'

// H07 (owner decision 8): rules the rulebook marks needs_review carry a visible
// badge. The visible text is the label; screen readers also hear why.
export const UNCONFIRMED_LABEL = 'Unconfirmed: check with the agency'

export function UnconfirmedBadge({ reasons, onDark = false, id }) {
  const why = reasons && reasons.length ? reasons.join(' ') : 'This rule is not yet confirmed from an official source.'
  return (
    <span id={id} className={'badge-unconf' + (onDark ? ' on-dark' : '')}>
      <span aria-hidden="true" className="badge-unconf-icon">!</span>
      {UNCONFIRMED_LABEL}
      <span className="sr-only">{`. ${why}`}</span>
    </span>
  )
}

// References: every rule shows its confidence.
export function ConfidenceBadge({ confidence, reasons }) {
  if (confidence === 'verified') return <span className="badge-ok">Verified</span>
  return <UnconfirmedBadge reasons={reasons} />
}

// Badge for a generated deadline or a checklist item, only when unconfirmed.
export function ItemBadge({ item, onDark, id }) {
  if (!isUnconfirmed(item)) return null
  return <UnconfirmedBadge reasons={confidenceReasons(item)} onDark={onDark} id={id} />
}

// "Details" disclosure on a calendar row: why the date is unconfirmed, the
// obligation's notes, any extension note, what the codes on its chip mean
// (L15), and the legal basis.
export function DeadlineDetails({ d }) {
  const ob = d.obligation
  const reasons = confidenceReasons(d)
  const name = `${ob.title}${d.label ? ` · ${d.label}` : ''}`
  const codes = formCodeHint(ob.form)
  return (
    <details className="dl-details">
      <summary>Details<span className="sr-only">{` for ${name}`}</span></summary>
      <div className="dl-details-body">
        {reasons.length > 0 && <p><b>Why unconfirmed:</b> {reasons.join(' ')}</p>}
        {ob.notes && <p>{ob.notes}</p>}
        {d.extended && d.extended.notes && <p>{d.extended.notes}</p>}
        {codes && <p><b>What the codes mean:</b>{` ${codes}`}</p>}
        {ob.legalBasis && ob.legalBasis.length > 0 && <p className="cite">{ob.legalBasis.join(' · ')}</p>}
      </div>
    </details>
  )
}
