// Pure date helpers. All dates are handled as local-midnight Date objects or
// ISO 'YYYY-MM-DD' strings; no timezone math beyond the user's local clock.

export function fromISO(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function iso(d) {
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function today() {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), n.getDate())
}

export function addDays(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

export function daysBetween(a, b) {
  return Math.round((b - a) / 86400000)
}

// month is 1-based; day may exceed the month's length and rolls over,
// except lastDayOfMonth which clamps.
export function mkDate(year, month, day) {
  return new Date(year, month - 1, day)
}

export function lastDayOfMonth(year, month) {
  return new Date(year, month, 0) // day 0 of next month
}

export function isWeekend(d) {
  const w = d.getDay()
  return w === 0 || w === 6
}

// BIR practice: a deadline falling on a Saturday, Sunday, or holiday moves to
// the next working day. `holidays` is a Set of ISO strings.
export function shiftToBusinessDay(d, holidays) {
  let out = d
  let guard = 0
  while ((isWeekend(out) || (holidays && holidays.has(iso(out)))) && guard < 14) {
    out = addDays(out, 1)
    guard++
  }
  return out
}

// Quarters of a taxable year. For calendar-year taxpayers fyEndMonth = 12.
// A fiscal year "ending in month M" has Q1 = the 3 months starting after M.
// Returns [{ q, start, end }] for the taxable year whose END falls in `fyEndYear`.
export function taxableYearQuarters(fyEndYear, fyEndMonth = 12) {
  const quarters = []
  // Q4 ends at fyEnd; walk backwards.
  for (let q = 4; q >= 1; q--) {
    const endMonthAbs = fyEndMonth - (4 - q) * 3 // may be <= 0 → previous year
    let endYear = fyEndYear
    let endMonth = endMonthAbs
    while (endMonth <= 0) { endMonth += 12; endYear -= 1 }
    const end = lastDayOfMonth(endYear, endMonth)
    const start = new Date(end.getFullYear(), end.getMonth() - 2, 1)
    quarters[q - 1] = { q, start, end }
  }
  return quarters
}

export function fmtDate(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function fmtMonthShort(d) {
  return d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
}
