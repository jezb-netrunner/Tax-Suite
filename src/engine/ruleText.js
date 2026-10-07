// H16: the tax numbers that appear in words (labels, banners, help text, the
// form guide and the blog), read from the rulebook (src/data/rules/*.json), so
// a rule change updates the words together with the math. Nothing here
// computes tax.
//
//   percentText(0.08)          '8%'   (exact, from the rate's decimal form)
//   pesoText(3000000)          '₱3,000,000'  (to the centavo when it has centavos)
//   pesoMillions(3000000)      '₱3M'  (whole millions; otherwise pesoText)
//   ordinal(4)                 '4th'
//   countText(3, 'year')       '3 years'
//   RT                         the rule values used in words, already formatted
//   dueDayText(id)             'April 15' for an annual obligation
//   whenText(id)               short "when" text for an obligation's schedule
//
// tests/build/no-typed-tax-numbers.test.js fails when a peso amount or a tax
// percentage is typed into a page or the engine instead of coming from here.

import incomeTax from '../data/rules/income-tax.json'
import businessTax from '../data/rules/business-tax.json'
import corporate from '../data/rules/corporate.json'
import penalties from '../data/rules/penalties.json'
import contributions from '../data/rules/contributions.json'
import wcomp from '../data/rules/withholding-compensation.json'
import ewt from '../data/rules/ewt-rates.json'
import holidays from '../data/rules/holidays.json'
import obligationRules from '../data/rules/obligations.json'
import { toCentavos, formatPesos, formatCentavos, rate as exactRate } from '../lib/money.js'

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function percentText(v) {
  const { num, den } = exactRate(v)
  const p = num * 100n
  if (p % den === 0n) return `${p / den}%`
  return `${Number((p * 10000n) / den) / 10000}%`
}

export function pesoText(v) {
  const c = toCentavos(v)
  return c % 100 === 0 ? formatPesos(c) : formatCentavos(c)
}

export function pesoMillions(v) {
  return Number.isInteger(v) && v >= 1000000 && v % 1000000 === 0 ? `₱${(v / 1000000).toLocaleString('en-US')}M` : pesoText(v)
}

export function ordinal(n) {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th')
  return `${n}${s}`
}

export function countText(n, unit) {
  return `${n} ${unit}${n === 1 ? '' : 's'}`
}

// ---------------------------------------------------------------------------
// Rule values in words

const EIGHT = incomeTax.eightPercent.value
const RCIT = corporate.rcit.value
const MCIT = corporate.mcit.value
const CLASSES = penalties.classification.value
const SSS = contributions.sss.value
const PF_IND = ewt.professionalFeesIndividual.value
const FBT = ewt.fringeBenefitsTax.value

export const RT = {
  // Individual income tax
  zeroBandTop: pesoText(incomeTax.graduatedBrackets.value[0].notOver),
  eightRate: percentText(EIGHT.rate),
  eightAllowance: pesoText(EIGHT.allowanceForPureSelfEmployed),
  eightCeiling: pesoText(EIGHT.grossCeiling),
  eightCeilingShort: pesoMillions(EIGHT.grossCeiling),
  osdRate: percentText(incomeTax.osd.value.rate),
  thirteenthMonthCap: pesoText(incomeTax.thirteenthMonthExclusionCap.value),
  auditedFsAbove: pesoText(incomeTax.afsRequiredAboveGross.value),
  auditedFsAboveShort: pesoMillions(incomeTax.afsRequiredAboveGross.value),
  nolcoYears: countText(incomeTax.netOperatingLossCarryOver.value.carryOverYears, 'year'),
  nolcoPandemicYears: countText(incomeTax.netOperatingLossCarryOver.value.pandemicCarryOverYears, 'year'),
  nolcoPandemicLossYears: incomeTax.netOperatingLossCarryOver.value.pandemicLossYears.join(' and '),
  // VAT and percentage tax
  vatThreshold: pesoText(businessTax.vatThreshold.value),
  vatThresholdShort: pesoMillions(businessTax.vatThreshold.value),
  vatRate: percentText(businessTax.vatRate.value),
  percentageTaxRate: percentText(businessTax.percentageTaxRate.value),
  invoiceThreshold: pesoText(businessTax.invoiceIssuanceThreshold.value),
  // Corporate income tax
  rcitStandard: percentText(RCIT.standardRate),
  rcitSmall: percentText(RCIT.smallCorpRate),
  smallCorpIncomeShort: pesoMillions(RCIT.smallCorpTaxableIncomeCeiling),
  smallCorpAssetsShort: pesoMillions(RCIT.smallCorpAssetCeiling),
  mcitRate: percentText(MCIT.rate),
  mcitStartYear: ordinal(MCIT.startsInTaxableYear),
  mcitCarryYears: countText(MCIT.excessCarryForwardYears, 'year'),
  corpOsdRate: percentText(corporate.osdCorporate.value.rate),
  // EOPT classification (gross sales)
  microBelowShort: pesoMillions(CLASSES.micro.grossSalesBelow),
  smallFromShort: pesoMillions(CLASSES.small.grossSalesFrom),
  smallBelowShort: pesoMillions(CLASSES.small.grossSalesBelow),
  // Contributions
  sssMscCeiling: pesoText(SSS.mscCeiling),
  sssWispThreshold: pesoText(SSS.wispThreshold),
  // Expanded withholding and fringe benefits
  pfIndividualLowerRate: percentText(PF_IND.lowerRate),
  pfIndividualStandardRate: percentText(PF_IND.standardRate),
  fbtRate: percentText(FBT.rate),
  fbtGrossUpDivisor: percentText(FBT.grossUpDivisor),
  // Penalties
  substantialUnderdeclaration: percentText(penalties.surcharge.value.substantialUnderdeclaration),
  // Withholding on compensation
  withholdingTablesFrom: Number(wcomp.tablesEffectiveFrom.value.slice(0, 4)),
}

// Pay factors (days paid a year) with their plain-language description.
export function payFactorText(f) {
  const d = wcomp.mweExempt.value.payFactorLabels[String(f)]
  return d ? `${f} (${d})` : String(f)
}

// Holidays fixed by law, by name, as examples: 'May 1 and June 12'.
export function fixedHolidayExamples(names = ['Labor Day', 'Independence Day']) {
  const rows = holidays.fixedByLaw.value.filter(r => names.includes(r.name) && r.month && r.day)
  return rows.map(r => `${MONTH_NAMES[r.month - 1]} ${r.day}`).join(' and ')
}

// ---------------------------------------------------------------------------
// Deadlines in words, from obligations.json

const OBLIGATIONS = obligationRules.obligations

function schedule(id) {
  const ob = OBLIGATIONS.find(o => o.id === id)
  if (!ob || !ob.schedule) throw new Error(`No schedule for obligation ${id}`)
  return ob.schedule
}

function dayText(month, day, short) {
  const names = short ? MONTH_SHORT : MONTH_NAMES
  return day === 'last' ? `last day of ${names[month - 1]}` : `${names[month - 1]} ${day}`
}

// 'April 15' / 'Apr 15' (annual_fixed rules).
export function dueDayText(id, { short = false } = {}) {
  const s = schedule(id)
  if (s.kind !== 'annual_fixed') throw new Error(`${id} is not a fixed annual date`)
  return dayText(s.month, s.day, short)
}

// 'May 15 · Aug 15 · Nov 15' (quarterly_fixed rules, Q1 to Q3 or Q4).
export function quarterlyDaysText(id, { labels = null } = {}) {
  const s = schedule(id)
  return s.entries.filter(e => !labels || labels.includes(e.label)).map(e => dayText(e.month, e.day, true)).join(' · ')
}

// The number of days after the period for a "N days after" rule.
export function daysAfterEnd(id) {
  return schedule(id).daysAfterEnd
}

// '10th': the day of the month of a monthly rule.
export function dayOfMonthText(id) {
  const s = schedule(id)
  return s.day === 'last' ? 'last day' : ordinal(s.day)
}

// Days from one fixed annual date to another (both annual_fixed), e.g. from
// the April 15 return to the April 30 eAFS deadline: 15.
export function daysBetweenDueDays(fromId, toId) {
  const a = schedule(fromId)
  const b = schedule(toId)
  // A common (non-leap) year; day 0 of the next month is the month's last day.
  const at = s => (s.day === 'last' ? Date.UTC(2026, s.month, 0) : Date.UTC(2026, s.month - 1, s.day))
  return Math.round((at(b) - at(a)) / 86400000)
}

// A short "when" for the form guide and help text.
export function whenText(id) {
  const s = schedule(id)
  if (s.kind === 'annual_fixed') return dayText(s.month, s.day, false)
  if (s.kind === 'quarterly_fixed') return quarterlyDaysText(id)
  if (s.kind === 'quarterly_offset') {
    if (s.daysAfterEnd != null) return `${countText(s.daysAfterEnd, 'day')} after each quarter`
    if (s.day === 'last' && (s.monthAfterEnd || 1) === 1) return 'Last day of the month after each quarter'
    return `${ordinal(s.day)} day of the ${ordinal(s.monthAfterEnd)} month after each quarter`
  }
  if (s.kind === 'annual_fy') {
    if (s.daysAfterEnd != null) return `${countText(s.daysAfterEnd, 'day')} after year-end`
    return `${ordinal(s.day)} day of the ${ordinal(s.monthsAfterEnd)} month after year-end`
  }
  if (s.kind === 'monthly') {
    const day = s.day === 'last' ? 'Last day' : ordinal(s.day)
    let t = `${day} of the following month`
    const dec = s.monthDayOverrides && s.monthDayOverrides['12']
    if (dec) t += ` (Dec: ${MONTH_SHORT[0]} ${dec})`
    if (s.skipQuarterMonths) t += ' (months 1–2 of each quarter)'
    return t
  }
  throw new Error(`No short text for schedule kind ${s.kind}`)
}

// The monthly 1601-C remittance in a sentence: 'by the 10th of the following
// month (Jan 15 for December)'.
export function monthlyRemitText(id) {
  const s = schedule(id)
  const dec = s.monthDayOverrides && s.monthDayOverrides['12']
  return `by the ${ordinal(s.day)} of the following month${dec ? ` (${MONTH_SHORT[0]} ${dec} for December)` : ''}`
}
