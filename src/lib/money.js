// Money: whole centavos, exact rates, one rounding rule.
//
// Every amount inside the engine is an integer number of CENTAVOS (₱1 = 100).
// Integers are exact in JavaScript up to 2^53 (about ₱90 trillion); products
// that could pass that (amount × rate × days) are computed with BigInt here,
// so callers never multiply money by a decimal themselves.
//
// Rounding: one rule, half-up on the size of the amount (half away from zero):
//   ₱0.005 -> ₱0.01, ₱2.50 -> ₱3, and −₱2.50 -> −₱3.
//
// API
//   toCentavos(pesos)       peso Number with up to 2 decimals -> integer centavos (exact)
//   fromCentavos(c)         integer centavos -> peso Number (3.2, never 3.1999…)
//   rate(r)                 0.15 | '0.035' | [num, den] -> exact fraction { num, den } (BigInt)
//   mulRate(c, r)           c × r, rounded half-up to the centavo
//   mulFrac(c, num, den)    c × num / den, rounded half-up to the centavo
//   divRoundHalfUp(n, d)    integer division n / d rounded half-up (Number or BigInt in, Number out)
//   roundHalfUp(c, unit)    round centavos to a multiple of `unit` centavos (default 1)
//   toWholePesos(c)         BIR return-line rule: 49 centavos or less drop, 50 or more round up
//                           (returns centavos, a multiple of 100)
//   pesoLine(pesos)         shortcut: peso Number -> whole-peso peso Number (BIR line)
//   centavoLine(pesos)      shortcut: peso Number -> peso Number rounded half-up to the centavo
//   sumCentavos(...cs)      exact sum of integer centavos
//   formatPesos(c)          '₱12,782'   whole pesos (return figures)
//   formatCentavos(c)       '₱3.20'     to the centavo (payslips, withholding, penalties)
//   groupThousands(n)       1234567 -> '1,234,567'

const B0 = 0n
const B2 = 2n
const B10 = 10n

function big(n) {
  if (typeof n === 'bigint') return n
  if (!Number.isInteger(n)) throw new RangeError(`Not a whole number of centavos: ${n}`)
  return BigInt(n)
}

// Results stay exact up to 2^53 centavos (about ₱90 trillion). The amount
// boxes stop at ₱999,999,999,999.99, so real inputs never get near that.
function toSafeNumber(b) {
  return Number(b)
}

// n / d rounded half away from zero, all in BigInt.
function divHalfUpBig(n, d) {
  if (d === B0) throw new RangeError('Division by zero')
  if (d < B0) { n = -n; d = -d }
  const neg = n < B0
  const a = neg ? -n : n
  const q = (a * B2 + d) / (B2 * d) // floor((2a + d) / 2d) = round half up of a/d
  return neg ? -q : q
}

export function divRoundHalfUp(n, d) {
  return toSafeNumber(divHalfUpBig(big(n), big(d)))
}

// Peso amount (as typed or as stored: up to 2 decimals) -> integer centavos.
// Math.round(|x| × 100) is exact for such values up to ₱1 trillion and beyond:
// the product's binary error is far below half a centavo.
export function toCentavos(pesos) {
  const x = Number(pesos)
  if (!Number.isFinite(x)) return 0
  const c = Math.round(Math.abs(x) * 100)
  return x < 0 ? -c : c
}

export function fromCentavos(c) {
  return c / 100 // the nearest double to the decimal amount, e.g. 320 -> 3.2
}

// Exact fraction for a rate. A Number is read through its shortest decimal
// form (0.15 -> '0.15' -> 15/100), so rulebook rates become exact.
export function rate(r) {
  if (Array.isArray(r)) return { num: big(r[0]), den: big(r[1]) }
  if (r && typeof r === 'object' && 'num' in r) return { num: big(r.num), den: big(r.den) }
  const s = String(r)
  const m = /^(-?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(s)
  if (!m) throw new RangeError(`Not a rate: ${r}`)
  const [, sign, int, frac = '', exp = '0'] = m
  let num = BigInt((int || '0') + frac)
  let den = B10 ** BigInt(frac.length)
  const e = Number(exp)
  if (e > 0) num *= B10 ** BigInt(e)
  if (e < 0) den *= B10 ** BigInt(-e)
  return { num: sign ? -num : num, den }
}

export function mulRate(c, r) {
  const { num, den } = rate(r)
  return toSafeNumber(divHalfUpBig(big(c) * num, den))
}

export function mulFrac(c, num, den) {
  return toSafeNumber(divHalfUpBig(big(c) * big(num), big(den)))
}

export function roundHalfUp(c, unit = 1) {
  return toSafeNumber(divHalfUpBig(big(c), big(unit)) * big(unit))
}

export function toWholePesos(c) {
  return roundHalfUp(c, 100)
}

export function pesoLine(pesos) {
  return fromCentavos(toWholePesos(toCentavos(pesos)))
}

export function centavoLine(pesos) {
  return fromCentavos(toCentavos(pesos))
}

export function sumCentavos(...cs) {
  let t = 0
  for (const c of cs.flat()) t += c
  return t
}

export function groupThousands(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export function formatPesos(c) {
  const p = toWholePesos(c) / 100
  return (p < 0 ? '−' : '') + '₱' + groupThousands(Math.abs(p))
}

export function formatCentavos(c) {
  const a = Math.abs(c)
  const pesos = Math.floor(a / 100)
  const cents = a % 100
  return (c < 0 ? '−' : '') + '₱' + groupThousands(pesos) + '.' + String(cents).padStart(2, '0')
}
