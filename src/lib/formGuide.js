// L10: which Forms-page guide belongs to a deadline's form chip.
import { FORMS_DATA } from '../data/forms.js'

const CODES = FORMS_DATA.map(f => f.code)

// '1601-C' -> '1601-C'; '1601-FQ' -> '0619-F / 1601-FQ / 1604-F' (one guide
// covers the final-withholding series); '1701Q / 1905' -> '1701Q';
// a chip with no guide ('SSS R-5/PRN', '2306', '—') -> null.
export function formGuideCode(form) {
  if (!form) return null
  const f = String(form).trim()
  if (CODES.includes(f)) return f
  for (const part of f.split(/\s+\/\s+/)) {
    if (CODES.includes(part)) return part
    const combined = CODES.find(c => c.split(/\s+\/\s+/).includes(part))
    if (combined) return combined
  }
  return null
}

// '/forms?open=1601-C', or null when there is no guide.
export function formGuidePath(form) {
  const code = formGuideCode(form)
  return code ? `/forms?open=${encodeURIComponent(code)}` : null
}
