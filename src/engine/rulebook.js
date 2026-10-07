// The rulebook in words: the References register (H07) and plain-language
// descriptions of rule values and deadline schedules.
//
//   ruleRegister()           -> { computation, holidays, obligations, overrides }
//                               every rule with its value, legal basis, notes and
//                               confidence ('verified' | 'needs_review'); each
//                               entry lists the rulebook objects it comes from in
//                               `sources` ('file.json:path')
//   describeValue(value, key) -> display tree for a rule value:
//                               { kind: 'text', text } | { kind: 'list', items }
//                               | { kind: 'table', columns, rows }
//                               | { kind: 'fields', fields: [{ label, value }] }
//   describeSchedule(schedule) -> the deadline rule in words
//   calendarYearDue(schedule, { short }) -> 'January 15' / 'Jan 15': the date of
//                               an annual_fy rule for a calendar-year taxpayer
//   labelize(key)            -> 'graduatedBrackets' -> 'Graduated brackets'
//
// Numbers are shown by what they are: a rate as a percentage (exact, from the
// rate's decimal form), an amount in pesos (to the centavo when the amount or
// its table column has centavos), a count of years or days as is.

import incomeTax from '../data/rules/income-tax.json'
import businessTax from '../data/rules/business-tax.json'
import corporate from '../data/rules/corporate.json'
import wcomp from '../data/rules/withholding-compensation.json'
import penalties from '../data/rules/penalties.json'
import contributions from '../data/rules/contributions.json'
import ewtRates from '../data/rules/ewt-rates.json'
import attachments from '../data/rules/attachments.json'
import holidays from '../data/rules/holidays.json'
import obligationRules from '../data/rules/obligations.json'
import { toCentavos, formatPesos, formatCentavos, rate as exactRate } from '../lib/money.js'
import { fromISO, fmtDate, addDays, mkDate, lastDayOfMonth, makeHolidayCalendar } from './dates.js'

export const RULE_FILES = [
  { file: 'income-tax.json', label: 'Individual income tax', data: incomeTax },
  { file: 'business-tax.json', label: 'VAT & percentage tax', data: businessTax },
  { file: 'corporate.json', label: 'Corporate income tax', data: corporate },
  { file: 'withholding-compensation.json', label: 'Withholding on compensation', data: wcomp },
  { file: 'penalties.json', label: 'Penalties & classification', data: penalties },
  { file: 'contributions.json', label: 'SSS · PhilHealth · Pag-IBIG', data: contributions },
  { file: 'ewt-rates.json', label: 'Expanded withholding rates', data: ewtRates },
  { file: 'attachments.json', label: 'Attachments & eAFS', data: attachments },
]

const LABELS = {
  notOver: 'Not over', base: 'Base tax', semiMonthly: 'Semi-monthly', atc: 'ATC',
  mscBelow: 'MSC below', mscFloor: 'MSC floor', mscCeiling: 'MSC ceiling', mscStep: 'MSC step',
  ec: 'EC premium (employer)', wispThreshold: 'WISP / MPF threshold', taxDueUpTo: 'Tax due up to',
  eafs: 'eAFS', ncr: 'NCR',
}

export function labelize(key) {
  if (LABELS[key]) return LABELS[key]
  const words = String(key).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const IDENTIFIER = /^[a-z]+(?:[A-Z][a-z0-9]*)+$/ // camelCase codes such as 'rolledDueDate'
const PLAIN_NUMBER = /year|days|factor|divisor/i
const RATE_KEY = /rate|share/i

function numberKind(key, v) {
  if (PLAIN_NUMBER.test(key)) return 'plain'
  if (RATE_KEY.test(key) && Math.abs(v) <= 1) return 'percent'
  if (!Number.isInteger(v) && Math.abs(v) < 1) return 'percent'
  return 'money'
}

function percentText(v) {
  const { num, den } = exactRate(v)
  const p = num * 100n
  if (p % den === 0n) return `${p / den}%`
  return `${Number(p * 10000n / den) / 10000}%`
}

function moneyText(v, centavos) {
  const c = toCentavos(v)
  return centavos ? formatCentavos(c) : formatPesos(c)
}

function scalarText(v, key, { centavos = false } = {}) {
  if (v === null || v === undefined) return 'No limit'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'number') {
    const kind = numberKind(key, v)
    if (kind === 'plain') return String(v)
    if (kind === 'percent') return percentText(v)
    return moneyText(v, centavos || !Number.isInteger(v))
  }
  const s = String(v)
  if (ISO_DATE.test(s)) return fmtDate(fromISO(s))
  if (IDENTIFIER.test(s)) return labelize(s)
  return s
}

const isPlain = v => v === null || ['string', 'number', 'boolean'].includes(typeof v)

export function describeValue(value, key = '') {
  if (isPlain(value)) return { kind: 'text', text: scalarText(value, key) }
  if (Array.isArray(value)) {
    if (value.every(v => typeof v === 'number')) return { kind: 'text', text: value.map(v => scalarText(v, key)).join(', ') }
    if (value.every(isPlain)) return { kind: 'list', items: value.map(v => scalarText(v, key)) }
    const flatRows = value.every(v => v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every(isPlain))
    if (flatRows) {
      const keys = []
      for (const row of value) for (const k of Object.keys(row)) if (!keys.includes(k)) keys.push(k)
      // A money column with any centavos is shown to the centavo throughout.
      const centavoCol = Object.fromEntries(keys.map(k => [k, value.some(r => typeof r[k] === 'number' && !Number.isInteger(r[k]) && numberKind(k, r[k]) === 'money')]))
      return {
        kind: 'table',
        columns: keys.map(labelize),
        rows: value.map(r => keys.map(k => (k in r ? scalarText(r[k], k, { centavos: centavoCol[k] }) : '—'))),
      }
    }
    return { kind: 'list', items: value.map(v => describeValue(v, key)) }
  }
  return {
    kind: 'fields',
    fields: Object.entries(value).map(([k, v]) => ({ label: labelize(k), value: describeValue(v, k) })),
  }
}

// ---------------------------------------------------------------------------
// Schedules in words

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function ordinal(n) {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th')
  return `${n}${s}`
}

function monthDay(month, day) {
  return day === 'last' ? `the last day of ${MONTHS[month - 1]}` : `${MONTHS[month - 1]} ${day}`
}

function joinAnd(items) {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

function longDate(d, short) {
  return d.toLocaleDateString('en-US', { month: short ? 'short' : 'long', day: 'numeric' })
}

// Due date of an annual_fy rule for a taxable year ending Dec 31 of `year`.
function fyDue(schedule, year, fyEndMonth = 12) {
  const end = lastDayOfMonth(year, fyEndMonth)
  if (schedule.daysAfterEnd != null) return addDays(end, schedule.daysAfterEnd)
  const m = fyEndMonth + schedule.monthsAfterEnd
  const yy = year + Math.floor((m - 1) / 12)
  const mm = ((m - 1) % 12) + 1
  return schedule.day === 'last' ? lastDayOfMonth(yy, mm) : mkDate(yy, mm, schedule.day)
}

// 'January 15' (or 'Jan 15' with short) for a calendar-year taxpayer; with
// fyEndMonth, for a taxable year ending in that month.
export function calendarYearDue(schedule, { short = false, fyEndMonth = 12 } = {}) {
  return longDate(fyDue(schedule, 2026, fyEndMonth), short)
}

export function describeSchedule(s) {
  let text
  switch (s.kind) {
    case 'quarterly_fixed':
      text = `Each year by ${joinAnd(s.entries.map(e => `${monthDay(e.month, e.day)}${e.label ? ` (${e.label})` : ''}`))}`
      break
    case 'quarterly_offset': {
      const all = !s.quarters || s.quarters.length === 4
      const which = s.calendarBasis
        ? (all ? 'each calendar quarter' : `calendar quarters ${joinAnd(s.quarters.map(String))}`)
        : (all ? 'each quarter of the taxable year'
          : s.quarters.join() === '1,2,3' ? 'each of the first three quarters of the taxable year'
            : `quarters ${joinAnd(s.quarters.map(String))} of the taxable year`)
      if (s.daysAfterEnd != null) text = `${s.daysAfterEnd} days after the end of ${which}`
      else {
        const after = (s.monthAfterEnd || 1) === 1 ? 'the month after' : `the ${ordinal(s.monthAfterEnd)} month after`
        text = `${s.day === 'last' ? 'Last day' : `${ordinal(s.day)} day`} of ${after} ${which}`
      }
      break
    }
    case 'monthly': {
      const offset = s.monthOffset == null ? 1 : s.monthOffset
      const month = offset === 0 ? 'the same month' : offset === 1 ? 'the following month' : `the ${ordinal(offset)} month after`
      text = `${s.day === 'last' ? 'Last day' : ordinal(s.day)} of ${month}`
      if (s.skipQuarterMonths && s.skipQuarterMonths.join() === '3') text += ', for the first two months of each quarter'
      const overrides = Object.entries(s.monthDayOverrides || {})
      if (overrides.length) {
        text += ` (${overrides.map(([m, d]) => `for ${MONTHS[m - 1]}: ${monthDay(((Number(m) + offset - 1) % 12) + 1, d)}`).join('; ')})`
      }
      break
    }
    case 'annual_fixed':
      text = `Each year by ${monthDay(s.month, s.day)}`
      break
    case 'annual_fy': {
      const head = s.daysAfterEnd != null
        ? `${s.daysAfterEnd} days after the taxable year ends`
        : `${s.day === 'last' ? 'Last day' : `${ordinal(s.day)} day`} of the ${ordinal(s.monthsAfterEnd)} month after the taxable year ends`
      const usual = longDate(fyDue(s, 2026))
      const leap = longDate(fyDue(s, 2027)) // the next year, 2028, is a leap year
      text = `${head} (${usual} for calendar-year taxpayers${leap !== usual ? `; ${leap} when the next year is a leap year` : ''})`
      break
    }
    case 'once':
      text = `One time: ${fromISO(s.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
      break
    case 'ongoing':
      return 'Ongoing: no fixed date'
    case 'info':
      return 'For information: no date'
    default:
      return ''
  }
  if (s.noWeekendShift) text += '; never moved later'
  return text
}

// ---------------------------------------------------------------------------
// The register

function strongest(confs) {
  return confs.some(c => c !== 'verified') ? 'needs_review' : 'verified'
}

function computationRules() {
  const out = []
  for (const { file, label, data } of RULE_FILES) {
    for (const [key, v] of Object.entries(data)) {
      if (!v || typeof v !== 'object' || Array.isArray(v) || !('confidence' in v || 'legalBasis' in v)) continue
      out.push({
        id: `${file}:${key}`, sources: [`${file}:${key}`], file: label, key, title: labelize(key),
        value: 'value' in v ? describeValue(v.value, key) : null,
        legalBasis: v.legalBasis || [], notes: v.notes || '', confidence: strongest([v.confidence]),
      })
    }
  }
  return out
}

const POLICY_TEXT = {
  next_working_day: 'Moves to the next working day',
  statutory_date: 'Stays on the date set by law',
}

function holidayRegister() {
  const H = 'holidays.json'
  // L21: the same 'proclaimed years' the deadline engine uses.
  const years = makeHolidayCalendar(holidays.holidays).proclaimedYears
  const out = [{
    id: `${H}:shiftRule`, sources: [`${H}:shiftRule`], title: 'Deadlines on a weekend or holiday',
    value: { kind: 'text', text: holidays.shiftRule.value }, legalBasis: holidays.shiftRule.legalBasis,
    notes: holidays.shiftRule.notes || '',
    noShift: { titles: noShiftTitles(), note: holidays.noShiftNote },
    confidence: strongest([holidays.shiftRule.confidence]),
  }]
  for (const [agency, r] of Object.entries(holidays.rollOverByAgency)) {
    out.push({
      id: `${H}:rollOverByAgency.${agency}`, sources: [`${H}:rollOverByAgency.${agency}`], kind: 'rollOver',
      title: agency, agency, policy: POLICY_TEXT[r.policy] || labelize(r.policy),
      legalBasis: r.legalBasis || [], notes: [r.note, r.notes].filter(Boolean).join(' '), confidence: strongest([r.confidence]),
    })
  }
  for (const y of years) {
    out.push({
      id: `${H}:year.${y}`, sources: [], kind: 'year', year: y, title: `${y} holidays (proclaimed)`,
      rows: holidays.holidays.filter(h => h.date.startsWith(String(y))),
      legalBasis: [], notes: '', confidence: strongest([(holidays.confidenceByYear || {})[String(y)] || holidays.confidence]),
    })
  }
  out.push({
    id: `${H}:notes2027`, sources: [`${H}:notes2027`], title: 'Notes on the 2027 list',
    value: null, legalBasis: [], notes: holidays.notes2027.notes, confidence: strongest([holidays.notes2027.confidence]),
  })
  out.push({
    id: `${H}:fixedByLaw`, sources: [`${H}:fixedByLaw`, `${H}:(top)`], kind: 'fixedByLaw',
    title: 'Other years: holidays fixed by law only',
    value: {
      kind: 'table', columns: ['Holiday', 'Date', 'Type'],
      rows: holidays.fixedByLaw.value.map(r => [r.name, fixedRuleText(r), r.type === 'regular' ? 'Regular' : 'Special non-working']),
    },
    legalBasis: holidays.fixedByLaw.legalBasis, notes: holidays.fixedByLaw.notes,
    confidence: strongest([holidays.fixedByLaw.confidence, holidays.confidence]),
  })
  return out
}

// Deadlines that never move to a later day (13th-month pay, e-invoicing).
function noShiftTitles() {
  return obligationRules.obligations
    .filter(ob => ob.noWeekendShift || (ob.schedule && ob.schedule.noWeekendShift))
    .map(ob => ob.title)
}

function fixedRuleText(r) {
  if (r.rule === 'date') return `${MONTHS[r.month - 1]} ${r.day}`
  if (r.rule === 'easter') return `${Math.abs(r.offsetDays)} days before Easter Sunday`
  if (r.rule === 'lastWeekday') {
    const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][r.weekday]
    return `Last ${day} of ${MONTHS[r.month - 1]}`
  }
  return ''
}

function obligationRegister() {
  return obligationRules.obligations.map(ob => ({
    id: `obligations.json:${ob.id}`, sources: [`obligations.json:obligations[id=${ob.id}]`],
    title: ob.title, form: ob.form && ob.form !== '—' ? ob.form : null, agency: ob.agency,
    when: describeSchedule(ob.schedule), legalBasis: ob.legalBasis || [], notes: ob.notes || '',
    confidence: strongest([ob.confidence]),
  }))
}

function overrideRegister() {
  return (obligationRules.overrides || []).map(o => {
    const ob = obligationRules.obligations.find(x => x.id === o.obligationId) || {}
    return {
      title: ob.title || o.obligationId, form: ob.form || null,
      from: o.rawDate ? fmtDate(fromISO(o.rawDate)) : o.period, to: fmtDate(fromISO(o.newDate)), basis: o.basis,
    }
  })
}

export function ruleRegister() {
  return {
    computation: computationRules(),
    holidays: holidayRegister(),
    obligations: obligationRegister(),
    overrides: overrideRegister(),
    holidayConfidenceNote: holidays.confidenceNote,
  }
}
