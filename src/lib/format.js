// Display formatting and amount-box parsing.
//
// Amount boxes (NumField in src/components/ui.jsx) use the pure parsers below:
//   parseMoneyInput(text, { allowShortGroups })
//       -> { ok: true, empty, centavos, value }   value = pesos (Number, ≤ 2 decimals)
//       -> { ok: false, error }                    short plain-language message
//     Accepts digits, thousands commas, one decimal point with up to 2 decimals,
//     an optional leading ₱ and spaces. Rejects letters, minus signs, exponents
//     (1e6) and amounts above ₱999,999,999,999.99. '' is an empty box (= 0).
//   parseIntegerInput(text, { min, max }) -> { ok, empty, value } | { ok: false, error }
//   formatMoneyInput(pesos)  -> '480,000' / '4,800.50' / '' (text shown after the box loses focus)
//   formatIntegerInput(n)    -> '3,650' / ''

export function money(n) {
  const v = Math.round(n)
  const sign = v < 0 ? '−' : ''
  return sign + '₱' + Math.abs(v).toLocaleString('en-US')
}

export function money2(n) {
  const sign = n < 0 ? '−' : ''
  return sign + '₱' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function pct(n, digits = 0) {
  return (n * 100).toFixed(digits) + '%'
}

// ₱999,999,999,999.99 in centavos: twelve peso digits plus two centavo digits.
export const MAX_MONEY_CENTAVOS = 99999999999999
const MAX_PESO_DIGITS = 12

const MSG = {
  minus: 'Enter the amount without a minus sign.',
  digits: 'Use digits only, for example 4,800.50.',
  points: 'Use only one decimal point.',
  decimals: 'Use at most 2 decimals (centavos).',
  comma: 'Use a period for centavos and commas for thousands, for example 4,800.50.',
  tooLarge: 'That amount is too large. The most this box takes is ₱999,999,999,999.99.',
  whole: 'Use a whole number (no decimals).',
}

const MINUS_SIGNS = /[-−‒–—﹣－]/

// Remove spaces (including non-breaking ones) and one leading peso sign.
function clean(raw) {
  let s = String(raw ?? '').replace(/\s+/g, '')
  if (s.startsWith('₱')) s = s.slice(1)
  return s
}

// Commas are read as thousands separators wherever they sit in the peso part,
// so editing the middle of "480,000" (e.g. "4580,000") keeps working. A last
// group of only 1 or 2 digits ("4800,00", "1.234,56") looks like a decimal
// comma, which would make the amount 100 times too big, so it is rejected
// unless the caller says the user is deleting digits (allowShortGroups).
function checkCommas(intPart, allowShortGroups) {
  if (!intPart.includes(',')) return null
  const last = intPart.slice(intPart.lastIndexOf(',') + 1)
  if (!allowShortGroups && (last.length === 1 || last.length === 2)) return MSG.comma
  return null
}

export function parseMoneyInput(raw, { allowShortGroups = false } = {}) {
  const s = clean(raw)
  if (s === '') return { ok: true, empty: true, centavos: 0, value: 0 }
  if (MINUS_SIGNS.test(s)) return { ok: false, error: MSG.minus }
  if (!/^[0-9.,]+$/.test(s)) return { ok: false, error: MSG.digits }
  const parts = s.split('.')
  if (parts.length > 2) return { ok: false, error: MSG.points }
  const [intPart, frac = ''] = parts
  if (frac.includes(',')) return { ok: false, error: MSG.comma }
  const commaError = checkCommas(intPart, allowShortGroups)
  if (commaError) return { ok: false, error: commaError }
  if (frac.length > 2) return { ok: false, error: MSG.decimals }
  const pesoDigits = intPart.replace(/,/g, '').replace(/^0+/, '')
  if (pesoDigits.length > MAX_PESO_DIGITS) return { ok: false, error: MSG.tooLarge }
  // Built from the digit strings, so no floating-point step is involved.
  const centavos = Number(pesoDigits || '0') * 100 + Number(frac.padEnd(2, '0'))
  if (centavos > MAX_MONEY_CENTAVOS) return { ok: false, error: MSG.tooLarge }
  return { ok: true, empty: false, centavos, value: centavos / 100 }
}

export function parseIntegerInput(raw, { min = 0, max = 999999999 } = {}) {
  const s = clean(raw)
  const range = `Enter a number from ${groupDigits(min)} to ${groupDigits(max)}.`
  if (s === '') {
    if (0 < min || 0 > max) return { ok: false, error: range }
    return { ok: true, empty: true, value: 0 }
  }
  if (MINUS_SIGNS.test(s)) return { ok: false, error: 'Enter the number without a minus sign.' }
  if (/^[0-9,]*\.[0-9,]*$/.test(s)) return { ok: false, error: MSG.whole }
  if (!/^[0-9,]+$/.test(s)) return { ok: false, error: 'Use digits only.' }
  const digits = s.replace(/,/g, '').replace(/^0+/, '')
  if (digits.length > 15) return { ok: false, error: range }
  const value = Number(digits || '0')
  if (value < min || value > max) return { ok: false, error: range }
  return { ok: true, empty: false, value }
}

// 1234567 -> '1,234,567' (no locale dependence).
export function groupDigits(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export function formatMoneyInput(value) {
  if (value === null || value === undefined || value === '') return ''
  const n = Number(value)
  if (!Number.isFinite(n)) return ''
  const c = Math.round(Math.abs(n) * 100)
  const pesos = Math.floor(c / 100)
  const cents = c % 100
  return (n < 0 ? '-' : '') + groupDigits(pesos) + (cents ? '.' + String(cents).padStart(2, '0') : '')
}

export function formatIntegerInput(value) {
  if (value === null || value === undefined || value === '') return ''
  const n = Number(value)
  if (!Number.isFinite(n)) return ''
  return groupDigits(Math.trunc(n))
}
