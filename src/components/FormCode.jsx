import React from 'react'
import { formCodeHint } from '../data/glossary.js'

// A form or channel chip ('SSS R-5/PRN', 'via ORUS', '1701Q'). Codes with a
// glossary entry (L15) get a tooltip for mouse users and the meaning for
// screen readers; the calendar row "Details" and the Forms page glossary show
// the same text to everyone. The chip is positioned so its screen-reader text
// stays inside it (and inside any clipped or scrolling row) instead of
// widening the page.
export function FormCode({ form, className = 'boxcode', style }) {
  const hint = formCodeHint(form)
  if (!hint) return <span className={className} style={style}>{form}</span>
  return (
    <span className={className} style={{ position: 'relative', ...style }}>
      <abbr title={hint} className="code-abbr">{form}</abbr>
      <span className="sr-only">{` (${hint})`}</span>
    </span>
  )
}
