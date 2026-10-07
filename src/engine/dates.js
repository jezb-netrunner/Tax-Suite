// Pure date helpers. Calendar dates are handled as local-midnight Date objects
// or ISO 'YYYY-MM-DD' strings. Only the meaning of "today" involves a time
// zone: BIR, SSS, PhilHealth and Pag-IBIG deadlines are Philippine calendar
// dates, so "today" is always the calendar date in Asia/Manila, whatever the
// device's own time zone.
//
//   manilaToday(now = new Date())       -> Date at local midnight of the Manila
//                                          calendar date (same type as fromISO)
//   today()                             -> manilaToday()
//   msUntilManilaMidnight(now = new Date()) -> ms until the next Manila midnight
//   daysLeftLabel(n)                    -> 'Due today' | '1 day left' | 'n days left'

export function fromISO(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function iso(d) {
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const MANILA_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila',
  year: 'numeric', month: 'numeric', day: 'numeric',
  hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23',
})

function manilaParts(now) {
  const out = {}
  for (const p of MANILA_PARTS.formatToParts(now)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value)
  }
  return out
}

// The calendar date in Manila at the instant `now`, as a local-midnight Date.
export function manilaToday(now = new Date()) {
  const { year, month, day } = manilaParts(now)
  return new Date(year, month - 1, day)
}

export function today() {
  return manilaToday()
}

// Milliseconds from `now` until the next midnight in Manila (UTC+8, no daylight
// saving), for refreshing "today" on screens left open overnight.
export function msUntilManilaMidnight(now = new Date()) {
  const { hour, minute, second } = manilaParts(now)
  const ms = now.getTime() % 1000
  const elapsed = ((hour * 60 + minute) * 60 + second) * 1000 + (ms < 0 ? ms + 1000 : ms)
  return 86400000 - elapsed
}

export function daysLeftLabel(n) {
  if (n === 0) return 'Due today'
  return n === 1 ? '1 day left' : `${n} days left`
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
// the next working day. `holidays` is anything with has(isoString): a Set of
// ISO strings or a holiday calendar from makeHolidayCalendar.
export function shiftToBusinessDay(d, holidays) {
  let out = d
  let guard = 0
  while ((isWeekend(out) || (holidays && holidays.has(iso(out)))) && guard < 14) {
    out = addDays(out, 1)
    guard++
  }
  return out
}

// ---------------------------------------------------------------------------
// Holidays.
//
// A year's holidays come from its proclamation when the rulebook has one
// (holidays.json "holidays"); for any other year they are computed from the
// holidays fixed by law (holidays.json "fixedByLaw"). A proclaimed list wins
// for its whole year: it already contains the dates fixed by law, and it can
// add special days or move a holiday.

// Easter Sunday in the Gregorian calendar (anonymous Gregorian algorithm,
// Meeus/Jones/Butcher).
export function easterSunday(year) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

// The last given weekday (0 = Sunday ... 6 = Saturday) of a month (1-based).
export function lastWeekdayOfMonth(year, month, weekday) {
  const last = lastDayOfMonth(year, month)
  return addDays(last, -((last.getDay() - weekday + 7) % 7))
}

// One fixedByLaw rule -> its date in `year`.
//   { rule: 'date', month, day } | { rule: 'easter', offsetDays }
//   | { rule: 'lastWeekday', month, weekday }
function holidayRuleDate(rule, year) {
  if (rule.rule === 'easter') return addDays(easterSunday(year), rule.offsetDays || 0)
  if (rule.rule === 'lastWeekday') return lastWeekdayOfMonth(year, rule.month, rule.weekday)
  return mkDate(year, rule.month, rule.day)
}

function byDateThenName(a, b) {
  return a.date < b.date ? -1 : a.date > b.date ? 1 : a.name.localeCompare(b.name)
}

/**
 * Holiday calendar for any year.
 * @param proclaimed  rows { date: 'YYYY-MM-DD', name, type } (holidays.json "holidays")
 * @param rules       holidays fixed by law (holidays.json "fixedByLaw.value")
 * @returns {
 *   has(iso)          true when the date is a non-working holiday
 *   get(iso)          the holiday row { date, name, type, source } or undefined
 *   forYear(year)     that year's rows in date order
 *   isProclaimed(year) true when the year's list comes from a proclamation
 *   proclaimedYears   years with a proclaimed list, ascending
 * }
 * source is 'proclaimed' or 'fixed_by_law'. Works with shiftToBusinessDay.
 */
export function makeHolidayCalendar(proclaimed = [], rules = []) {
  const listed = new Map() // year -> rows
  for (const h of proclaimed) {
    const y = Number(h.date.slice(0, 4))
    if (!listed.has(y)) listed.set(y, [])
    listed.get(y).push({ ...h, source: 'proclaimed' })
  }
  const cache = new Map() // year -> Map(iso -> row)
  function yearMap(y) {
    if (!cache.has(y)) {
      const rows = listed.has(y)
        ? listed.get(y)
        : rules.map(r => ({ date: iso(holidayRuleDate(r, y)), name: r.name, type: r.type, source: 'fixed_by_law' }))
      cache.set(y, new Map([...rows].sort(byDateThenName).map(r => [r.date, r])))
    }
    return cache.get(y)
  }
  const key = d => (typeof d === 'string' ? d : iso(d))
  return {
    has(d) { const s = key(d); return yearMap(Number(s.slice(0, 4))).has(s) },
    get(d) { const s = key(d); return yearMap(Number(s.slice(0, 4))).get(s) },
    forYear(year) { return [...yearMap(year).values()] },
    isProclaimed(year) { return listed.has(Number(year)) },
    proclaimedYears: [...listed.keys()].sort((a, b) => a - b),
  }
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
