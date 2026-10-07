// Domestic-corporation estimator: RCIT (25% / 20% small-corp) vs 2% MCIT,
// with the 4th-year MCIT rule and a transparent breakdown; itemized or 40%
// OSD deductions, excess MCIT carried over from earlier years, and a 1702Q
// quarter view on cumulative figures.
//
// Rounding: BIR Form 1702 lines are whole pesos (49 centavos or less drop,
// 50 or more round up); each line is rounded and later lines are computed
// from the rounded ones.

import corp from '../../data/rules/corporate.json'
import businessTax from '../../data/rules/business-tax.json'
import incomeTax from '../../data/rules/income-tax.json'
import { toCentavos, fromCentavos, toWholePesos, mulRate, formatPesos } from '../../lib/money.js'
import { manilaToday, mkDate, lastDayOfMonth, shiftToBusinessDay, iso, addDays, taxableYearQuarters } from '../dates.js'
import { HOLIDAY_SET, OBLIGATIONS } from '../../lib/deadlineData.js'
import { fyDue } from '../rulebook.js'
import { RT, percentText } from '../ruleText.js'
import { thresholdCrossing, crossingRows, overVatThreshold } from './crossing.js'
import { VAT_NOTE, OVERPAYMENT_NOTE } from './individual.js'

const RCIT = corp.rcit.value
const MCIT = corp.mcit.value
const PCT_RATE = businessTax.percentageTaxRate.value
// C06: the 2% MCIT and 3% percentage tax apply to periods from this date. Earlier
// periods used 1% (Jul 2020 to Jun 2023) and are not supported (owner decision 1).
const RATES_FROM = MCIT.currentRatesFrom
// H16: due dates from the deadline rules (obligations.json).
const ANNUAL_RULE = OBLIGATIONS.find(o => o.id === 'bir-1702-annual').schedule
const QUARTER_RULE = OBLIGATIONS.find(o => o.id === 'bir-1702q').schedule
// MCIT starts in this taxable year after the year of BIR registration (RR 9-98).
const MCIT_START = MCIT.startsInTaxableYear

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export const EARLIER_YEARS_NOTE = 'Not supported: MCIT and percentage-tax rates differed (1% from Jul 2020 to Jun 2023). This estimator covers the current and the previous taxable year only.'

/**
 * A corporation's taxable year, named by the calendar year in which it ends.
 * The annual return (1702-RT) is due on the 15th day of the 4th month after
 * year-end, moved to the next working day (weekends and listed holidays).
 */
export function taxablePeriod(year, fiscalYearEndMonth = 12, holidays = HOLIDAY_SET) {
  const m = Number(fiscalYearEndMonth) || 12
  const calendar = m === 12
  const start = calendar ? mkDate(year, 1, 1) : mkDate(year - 1, m + 1, 1)
  const end = lastDayOfMonth(year, m)
  const due = shiftToBusinessDay(fyDue(ANNUAL_RULE, year, m), holidays)
  const short = d => `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`
  return {
    year,
    fiscalYearEndMonth: m,
    calendar,
    start: iso(start),
    end: iso(end),
    annualDue: iso(due),
    label: calendar
      ? `Taxable year ${year} (January to December ${year})`
      : `Fiscal year ${MONTH_NAMES[start.getMonth()]} ${start.getFullYear()} to ${MONTH_NAMES[m - 1]} ${year}`,
    option: calendar ? String(year) : `${short(start)} to ${short(end)}`,
    name: calendar ? `TY ${year}` : `the fiscal year ending ${MONTH_NAMES[m - 1]} ${year}`,
    supported: iso(start) >= RATES_FROM,
  }
}

// H13: choices for the profile's "Year registered with the BIR (for MCIT)":
// every year from the current Manila year down to 1998, plus "1997 or earlier"
// (stored as 1997). Any earlier saved year (1900-1997) shows as that option;
// for MCIT purposes they are all the same (MCIT applied long ago).
export const EARLIEST_LISTED_YEAR = 1998

export function registrationYearOptions(currentYear) {
  const years = []
  for (let y = currentYear; y >= EARLIEST_LISTED_YEAR; y--) years.push([String(y), String(y)])
  return [['', 'Not sure'], ...years, [String(EARLIEST_LISTED_YEAR - 1), `${EARLIEST_LISTED_YEAR - 1} or earlier`]]
}

export function registrationYearChoice(saved) {
  if (saved === null || saved === undefined || saved === '' || !Number.isFinite(Number(saved))) return ''
  const y = Number(saved)
  return y < EARLIEST_LISTED_YEAR ? String(EARLIEST_LISTED_YEAR - 1) : String(y)
}

/**
 * C06: the taxable years the corporate estimator offers: the current one
 * (containing `today`, a Manila calendar date) and the previous one. The
 * default is the year whose annual return is due next: the previous year
 * until its (rolled-over) due date has passed, then the current year.
 */
export function corporateTaxYears({ today = manilaToday(), fiscalYearEndMonth = 12, holidays = HOLIDAY_SET } = {}) {
  const m = Number(fiscalYearEndMonth) || 12
  const y = today.getFullYear()
  const current = m === 12 || today.getMonth() + 1 <= m ? y : y + 1
  const previous = current - 1
  const cur = taxablePeriod(current, m, holidays)
  const prev = taxablePeriod(previous, m, holidays)
  const defaultYear = iso(today) <= prev.annualDue ? previous : current
  return {
    current,
    previous,
    defaultYear,
    options: [cur, prev].map(p => ({ ...p, dueDate: p.annualDue })),
  }
}

const OSD_RATE = corp.osdCorporate.value.rate
const CARRY_YEARS = MCIT.excessCarryForwardYears
// M04: net operating loss carry-over (income-tax.json, needs_review).
const NOLCO_RULE = incomeTax.netOperatingLossCarryOver
const NOLCO_YEARS = NOLCO_RULE.value.carryOverYears

// Whole-peso return line from a peso input (49 centavos down, 50 up).
const line = pesos => toWholePesos(toCentavos(pesos || 0))

// H13: MCIT from the 4th taxable year after the year of BIR registration (RR 9-98).
function mcitStatusFor(registrationYear, taxYear) {
  if (registrationYear == null) return 'unknown'
  return taxYear >= registrationYear + MCIT_START ? 'applies' : 'notYet'
}

// RCIT vs MCIT on one set of figures: a full year, or the year to date for a
// 1702Q (RR 12-2007: the quarterly MCIT uses cumulative gross income).
// M11: deduction 'osd' takes 40% of gross income (sales less cost of sales)
// instead of the operating expenses (NIRC Sec 34(L); RR 16-2008).
// M04: with itemized deductions, costs above sales are a net operating loss
// (NOLCO, NIRC Sec 34(D)(3)), and NOLCO from prior years (nolcoPriorC)
// reduces taxable income only: never the MCIT, which is on gross income, and
// never in an OSD year (RR 16-2008).
function taxCore({ grossSalesC, costOfSalesC, opexC, deduction, totalAssets, mcitStatus, nolcoPriorC = 0 }) {
  const grossResultC = grossSalesC - costOfSalesC
  const grossIncomeC = Math.max(0, grossResultC)
  const osd = deduction === 'osd'
  const deductionC = osd ? toWholePesos(mulRate(grossIncomeC, OSD_RATE)) : opexC
  const netC = (osd ? grossIncomeC : grossResultC) - deductionC
  const netLossC = osd ? 0 : Math.max(0, -netC)
  const nolcoAppliedC = osd ? 0 : Math.min(nolcoPriorC, Math.max(0, netC))
  const taxableIncomeC = Math.max(0, netC) - nolcoAppliedC
  const smallCorp = taxableIncomeC <= toCentavos(RCIT.smallCorpTaxableIncomeCeiling) && totalAssets <= RCIT.smallCorpAssetCeiling
  const rcitRate = smallCorp ? RCIT.smallCorpRate : RCIT.standardRate
  const rcitC = toWholePesos(mulRate(taxableIncomeC, rcitRate))
  const mcitCounts = mcitStatus !== 'notYet'
  const mcitC = mcitCounts ? toWholePesos(mulRate(grossIncomeC, MCIT.rate)) : 0
  const usesMcit = mcitCounts && mcitC > rcitC
  return {
    grossSalesC, costOfSalesC, grossResultC, grossIncomeC, osd, deductionC, netC, netLossC, nolcoPriorC, nolcoAppliedC,
    taxableIncomeC, smallCorp, rcitRate, rcitC, mcitC, usesMcit, dueC: Math.max(rcitC, mcitC),
  }
}

/**
 * M11: excess MCIT from earlier years (NIRC Sec 27(E)(2)).
 * items: [{ year, amount }], the excess of MCIT over RCIT of that taxable year.
 * Each is usable in the 3 taxable years after its year, oldest first, only in
 * a year when the regular tax is the tax due, and never for more than the
 * regular tax (corporate.json excessMcitCredit, needs_review).
 */
function applyExcessMcit(items, taxYear, core) {
  const usable = []
  let expiredC = 0
  for (const it of items || []) {
    const year = Number(it && it.year)
    const c = line(it && it.amount)
    if (c <= 0 || !Number.isInteger(year) || year >= taxYear) continue
    if (year < taxYear - CARRY_YEARS) expiredC += c
    else usable.push({ year, c })
  }
  usable.sort((a, b) => a.year - b.year)
  let roomC = core.usesMcit ? 0 : core.rcitC
  let appliedC = 0
  const left = []
  for (const u of usable) {
    const useC = Math.min(roomC, u.c)
    roomC -= useC
    appliedC += useC
    if (u.c > useC) left.push({ year: u.year, amount: fromCentavos(u.c - useC), usableTo: u.year + CARRY_YEARS })
  }
  const availableC = usable.reduce((t, u) => t + u.c, 0)
  return { availableC, appliedC, expiredC, left }
}

const EXCESS_MCIT_LABEL = 'Less: excess MCIT from earlier years (against the regular tax only)'

function excessMcitNotes(ex, core) {
  const notes = []
  if (ex.availableC > 0 && core.usesMcit) {
    notes.push('Excess MCIT from earlier years is credited only against the regular tax, and this year the MCIT is the tax due, so none is used; it stays available until it expires.')
  }
  if (ex.expiredC > 0) {
    notes.push(`${formatPesos(ex.expiredC)} of the excess MCIT you entered is more than ${CARRY_YEARS} years old and has expired.`)
  }
  return notes.length ? notes.join(' ') : null
}

function rcitRow(r, core, toDate = '') {
  r(`Regular corporate income tax @ ${percentText(core.rcitRate)}${toDate}`, fromCentavos(core.rcitC), {
    strong: !core.usesMcit,
    sub: core.smallCorp
      ? `${RT.rcitSmall} rate: net taxable income${toDate} ≤ ${RT.smallCorpIncomeShort} and total assets ≤ ${RT.smallCorpAssetsShort} excluding land (NIRC Sec 27(A), CREATE).`
      : `Standard ${RT.rcitStandard} rate (NIRC Sec 27(A), CREATE).`,
  })
}

function incomeRows(r, core, toDate = '', lossSub) {
  const P = fromCentavos
  r(`Gross sales / revenue${toDate}`, P(core.grossSalesC))
  r('Less: cost of sales / services', -P(core.costOfSalesC))
  r(`Gross income${toDate}`, P(core.osd ? core.grossIncomeC : core.grossResultC), { rule: true })
  if (core.osd) {
    r(`Less: optional standard deduction (${RT.corpOsdRate} of gross income)`, -P(core.deductionC), {
      sub: 'NIRC Sec 34(L); RR 16-2008. Chosen on the first quarterly return and kept for the whole year; the financial statements still go with the annual return.',
    })
  } else {
    r('Less: operating expenses', -P(core.deductionC))
  }
  const leftC = core.nolcoPriorC - core.nolcoAppliedC
  if (core.netLossC > 0) {
    r(`Net loss${toDate}`, P(core.netLossC), { rule: true, ...(lossSub ? { sub: lossSub } : {}) })
  } else if (core.nolcoAppliedC > 0) {
    r('Net income before NOLCO', P(core.netC), { rule: true })
    r('Less: NOLCO from prior years', -P(core.nolcoAppliedC), leftC > 0
      ? { sub: `${formatPesos(leftC)} of NOLCO is left for later years, within its ${NOLCO_YEARS}-year limit.` }
      : {})
  }
  r(`Net taxable income${toDate}`, P(core.taxableIncomeC), { rule: core.netLossC === 0 && core.nolcoAppliedC === 0 })
}

/**
 * @param {Object} in_
 *   grossSales      annual gross sales/revenue
 *   costOfSales     direct costs → gross income = grossSales - costOfSales
 *   opex            deductible operating expenses (itemized)
 *   deduction       'itemized' (default) | 'osd' (40% of gross income)
 *   totalAssets     total assets excluding land (for the 20% small-corp test)
 *   cwt             creditable withholding (2307s)
 *   quarterlyPaid   income tax already paid on this year's 1702Q returns
 *   priorYearCredits excess credits carried over from last year's annual return
 *   excessMcit      [{ year, amount }] excess MCIT of earlier years not yet credited
 *   registrationYear  year registered with the BIR (MCIT from the 4th taxable year
 *                   after it, RR 9-98); null = not set: MCIT is shown in case it applies
 *   taxYear         taxable year being estimated, named by the calendar year it
 *                   ends in (default: the year whose annual return is due next,
 *                   by the Manila date; see corporateTaxYears)
 *   fiscalYearEndMonth  12 for a calendar year
 *   vatRegistered
 */
export function estimateCorporation(in_) {
  const { totalAssets = 0, registrationYear = null, vatRegistered = false } = in_
  const fiscalYearEndMonth = Number(in_.fiscalYearEndMonth) || 12
  const taxYear = in_.taxYear ?? corporateTaxYears({ fiscalYearEndMonth }).defaultYear
  const period = taxablePeriod(taxYear, fiscalYearEndMonth)
  if (!period.supported) {
    // Owner decision 1: no dated rate tables before Jul 2023, so no figures.
    return {
      supported: false,
      taxYear,
      period,
      message: EARLIER_YEARS_NOTE,
      rcit: null,
      mcit: null,
      incomeTaxDue: null,
      netPayable: null,
      rows: [],
      references: [...corp.mcit.legalBasis],
    }
  }
  const P = fromCentavos
  const deduction = in_.deduction === 'osd' ? 'osd' : 'itemized'
  const mcitStatus = mcitStatusFor(registrationYear, taxYear)
  const core = taxCore({
    grossSalesC: line(in_.grossSales), costOfSalesC: line(in_.costOfSales), opexC: line(in_.opex),
    deduction, totalAssets, mcitStatus, nolcoPriorC: line(in_.nolcoPrior),
  })
  const { grossSalesC, rcitC, mcitC, usesMcit } = core
  // M04: the net loss becomes NOLCO for the next 3 taxable years.
  const yearName = y => taxablePeriod(y, fiscalYearEndMonth).name
  const nolcoYears = `${yearName(taxYear + 1)} to ${yearName(taxYear + NOLCO_YEARS)}`
  const nolco = {
    createdAmount: P(core.netLossC),
    usableFrom: taxYear + 1,
    usableTo: taxYear + NOLCO_YEARS,
    priorEntered: P(core.nolcoPriorC),
    applied: P(core.nolcoAppliedC),
    left: P(core.nolcoPriorC - core.nolcoAppliedC),
    note: core.netLossC > 0
      ? `Net loss ${formatPesos(core.netLossC)}. This net operating loss (NOLCO) can be deducted from taxable income in the next ` +
        `${NOLCO_YEARS} taxable years (${nolcoYears}), but only in years the corporation itemizes deductions. It cannot be used ` +
        `in a year on the ${RT.corpOsdRate} OSD, and those years still count toward the ${NOLCO_YEARS}. It never reduces the MCIT, which is on gross income.`
      : null,
    shortNote: core.netLossC > 0 ? `Becomes NOLCO: deductible from taxable income in ${nolcoYears}, in years the corporation itemizes.` : null,
    osdNote: core.osd && core.nolcoPriorC > 0
      ? `NOLCO from prior years can't be used in a year on the ${RT.corpOsdRate} OSD, and this year still counts toward its ${NOLCO_YEARS} years.`
      : null,
  }
  const mcitApplies = mcitStatus === 'applies'
  const incomeTaxDueC = core.dueC
  const mcitWarning = mcitStatus !== 'unknown'
    ? null
    : usesMcit
      ? `The year registered with the BIR is not set on the profile. If the corporation is in its ${RT.mcitStartYear} taxable year after that year or later, MCIT applies and income tax due is ${formatPesos(mcitC)} (${RT.mcitRate} MCIT); if not, it is ${formatPesos(rcitC)} (regular rate). Set the year on the profile (RR 9-98).`
      : `The year registered with the BIR is not set on the profile, but the regular tax (${formatPesos(rcitC)}) is higher than the ${RT.mcitRate} MCIT (${formatPesos(mcitC)}), so the tax due is the same either way.`

  // M11: excess MCIT of earlier years, against the regular tax only.
  const ex = applyExcessMcit(in_.excessMcit, taxYear, core)
  const excessMcitNote = excessMcitNotes(ex, core)
  // This year's excess MCIT carries forward 3 taxable years.
  const carryC = usesMcit ? mcitC - rcitC : 0
  const excessMcitCarryForward = carryC > 0 ? { amount: P(carryC), usableFrom: taxYear + 1, usableTo: taxYear + CARRY_YEARS } : null

  // H06: credits against the annual 1702-RT. Quarterly 1702Q amounts are
  // entered by the user (the quarter view below estimates one 1702Q).
  const creditItems = [
    { label: EXCESS_MCIT_LABEL, c: ex.appliedC },
    { label: 'Less: creditable tax withheld (2307s)', c: line(in_.cwt) },
    { label: 'Less: income tax paid on this year\'s quarterly returns (1702Q)', c: line(in_.quarterlyPaid) },
    { label: 'Less: excess credits carried over from last year', c: line(in_.priorYearCredits) },
  ].filter(x => x.c > 0)
  const creditsC = creditItems.reduce((t, x) => t + x.c, 0)

  // The ₱3M test uses the actual sales, not the rounded line.
  const overThreshold = overVatThreshold(in_.grossSales)
  const vat = vatRegistered || overThreshold
  // H04 (owner decision 6): a non-VAT corporation whose sales pass ₱3M during
  // the year pays percentage tax on its sales from the start of the taxable
  // year to the end of the month the ₱3M was passed; VAT applies from the
  // following month (not computed). Same rule as for individuals.
  const crossing = vatRegistered ? null : thresholdCrossing({
    salesC: toCentavos(in_.grossSales || 0), grossC: grossSalesC,
    crossedMonth: in_.crossedMonth, salesThroughCrossMonth: in_.salesThroughCrossMonth,
    firstMonth: Number(period.start.slice(5, 7)), firstYear: Number(period.start.slice(0, 4)),
  })
  const pctC = vatRegistered ? 0 : toWholePesos(mulRate(crossing ? crossing.ptBaseC : grossSalesC, PCT_RATE))

  const rcit = P(rcitC)
  const mcit = P(mcitC)
  const incomeTaxDue = P(incomeTaxDueC)
  const pct = P(pctC)

  const rows = []
  const r = (label, value, o = {}) => rows.push({ label, value, ...o })
  incomeRows(r, core, '', nolco.shortNote)
  rcitRow(r, core)
  if (mcitApplies) {
    r(`Minimum corporate income tax @ ${RT.mcitRate} of gross income`, mcit, {
      strong: usesMcit,
      sub: usesMcit
        ? `MCIT exceeds RCIT this year, so you pay the MCIT; the excess credits against RCIT for the next ${RT.mcitCarryYears} (NIRC Sec 27(E)).`
        : 'RCIT is higher, so the regular tax applies (NIRC Sec 27(E)).',
    })
  } else if (mcitStatus === 'notYet') {
    r('Minimum corporate income tax', null, {
      sub: `Not yet applicable: MCIT starts with ${taxablePeriod(registrationYear + MCIT_START, fiscalYearEndMonth).name}, the ${RT.mcitStartYear} taxable year after the year of BIR registration (RR 9-98).`,
    })
  } else {
    r(`Minimum corporate income tax @ ${RT.mcitRate} of gross income, if it applies`, mcit, {
      strong: usesMcit,
      sub: `The year registered with the BIR is not set on the profile. MCIT applies from the ${RT.mcitStartYear} taxable year after that year (RR 9-98), so it is shown in case it applies.`,
    })
  }
  r(mcitStatus === 'unknown' && usesMcit ? 'Income tax due, if MCIT applies' : 'Income tax due', incomeTaxDue, {
    strong: true,
    rule: true,
    sub: mcitStatus === 'unknown' && usesMcit ? `If MCIT does not apply yet, income tax due is the regular tax of ${formatPesos(rcitC)}.` : undefined,
  })
  if (excessMcitCarryForward) {
    const name = y => taxablePeriod(y, fiscalYearEndMonth).name
    r(mcitStatus === 'unknown' ? 'Excess MCIT to carry forward, if MCIT applies' : 'Excess MCIT to carry forward', excessMcitCarryForward.amount, {
      sub: `MCIT less RCIT. Credited against the regular tax of ${name(taxYear + 1)} to ${name(taxYear + CARRY_YEARS)}, never against the MCIT (NIRC Sec 27(E)(2)).`,
    })
  }
  if (excessMcitNote) r('Excess MCIT from earlier years', null, { sub: excessMcitNote })
  if (crossing) crossingRows(r, crossing, pct)
  else if (!vat && pct > 0) r(`Percentage tax (${RT.percentageTaxRate} of gross)`, pct, { strong: true, sub: `Non-VAT corporation under the ${RT.vatThresholdShort} threshold (Form 2551Q).` })
  // H05 (owner decision 4): VAT is not computed here.
  if (vatRegistered) r('Value-added tax', null, { sub: `Not included in this estimate. VAT (${RT.vatRate} of sales less creditable input VAT) is filed quarterly on Form 2550Q.` })
  if (creditsC > 0) {
    for (const x of creditItems) r(x.label, -P(x.c))
    const net = P(incomeTaxDueC - creditsC)
    if (net >= 0) r('Income tax still payable', net, { strong: true })
    // L02: refund, tax credit certificate or carry over; for a corporation the
    // carry-over choice is irrevocable (NIRC Sec 76).
    else r('Overpayment', -net, { strong: true, sub: `${OVERPAYMENT_NOTE} The carry-over election, once made on the annual return, is irrevocable (NIRC Sec 76).` })
  }

  return {
    supported: true,
    taxYear,
    period,
    deduction,
    osd: core.osd ? P(core.deductionC) : null,
    grossIncome: P(core.grossIncomeC),
    taxableIncome: P(core.taxableIncomeC),
    netLoss: P(core.netLossC),
    nolco,
    smallCorp: core.smallCorp,
    rcitRate: core.rcitRate,
    rcit,
    mcitStatus,
    mcitApplies,
    mcit,
    usesMcit,
    mcitWarning,
    incomeTaxDue,
    excessMcitApplied: P(ex.appliedC),
    excessMcitLeft: ex.left,
    excessMcitExpired: P(ex.expiredC),
    excessMcitNote,
    excessMcitCarryForward,
    pct,
    vat,
    overThreshold,
    crossing,
    vatNotIncluded: vat,
    vatNote: vat ? VAT_NOTE : null,
    // The summary banner's business-tax sentence.
    businessTaxNote: crossing
      ? `Plus ${formatPesos(pctC)} percentage tax on sales from ${crossing.span} (Form 2551Q). VAT applies from ${crossing.vatFrom}: not included in this estimate.`
      : vat ? VAT_NOTE
        : pctC > 0 ? `Plus ${formatPesos(pctC)} percentage tax (non-VAT).` : null,
    credits: P(creditsC),
    netPayable: P(incomeTaxDueC - creditsC),
    rows,
    references: [
      ...corp.rcit.legalBasis, ...corp.mcit.legalBasis, ...(core.osd ? corp.osdCorporate.legalBasis : []),
      ...(core.netLossC > 0 || core.nolcoAppliedC > 0 ? NOLCO_RULE.legalBasis : []),
    ],
  }
}

function dayText(d, withYear) {
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}${withYear ? `, ${d.getFullYear()}` : ''}`
}

/**
 * M11: one quarterly return (1702Q), on figures from the start of the
 * taxable year to the end of the quarter (RR 12-2007): RCIT vs MCIT to date,
 * less excess MCIT (regular tax only), last year's excess credits, income tax
 * paid in earlier quarters of the year and 2307s to date.
 *
 * @param {Object} in_
 *   quarter               1 | 2 | 3 (the 4th quarter goes on the annual return)
 *   grossSales, costOfSales, opex   cumulative to the end of the quarter
 *   deduction, totalAssets, registrationYear, taxYear, fiscalYearEndMonth,
 *   priorYearCredits, excessMcit     as for estimateCorporation
 *   paidEarlierQuarters   income tax paid on this year's earlier 1702Q returns
 *   cwt                   2307s withheld from the start of the year to the end of the quarter
 */
export function estimateCorporateQuarter(in_, holidays = HOLIDAY_SET) {
  const quarter = Number(in_.quarter)
  if (![1, 2, 3].includes(quarter)) {
    throw new RangeError('The 1702Q covers quarters 1 to 3; the 4th quarter is on the annual return (1702-RT).')
  }
  const { totalAssets = 0, registrationYear = null } = in_
  const fiscalYearEndMonth = Number(in_.fiscalYearEndMonth) || 12
  const taxYear = in_.taxYear ?? corporateTaxYears({ fiscalYearEndMonth }).defaultYear
  const period = taxablePeriod(taxYear, fiscalYearEndMonth)
  if (!period.supported) return { supported: false, quarter, taxYear, message: EARLIER_YEARS_NOTE, rows: [] }

  const P = fromCentavos
  const q = taxableYearQuarters(taxYear, fiscalYearEndMonth)[quarter - 1]
  const dueDate = iso(shiftToBusinessDay(addDays(q.end, QUARTER_RULE.daysAfterEnd), holidays))
  const sameYear = q.start.getFullYear() === q.end.getFullYear()
  const quarterLabel = `Q${quarter}: ${dayText(q.start, !sameYear)} to ${dayText(q.end, true)}`

  const deduction = in_.deduction === 'osd' ? 'osd' : 'itemized'
  const mcitStatus = mcitStatusFor(registrationYear, taxYear)
  const core = taxCore({
    grossSalesC: line(in_.grossSales), costOfSalesC: line(in_.costOfSales), opexC: line(in_.opex),
    deduction, totalAssets, mcitStatus,
  })
  const ex = applyExcessMcit(in_.excessMcit, taxYear, core)
  const creditItems = [
    { label: EXCESS_MCIT_LABEL, c: ex.appliedC },
    { label: 'Less: excess credits carried over from last year', c: line(in_.priorYearCredits) },
    { label: 'Less: income tax paid in earlier quarters of this year', c: line(in_.paidEarlierQuarters) },
    { label: 'Less: creditable tax withheld to date (2307s)', c: line(in_.cwt) },
  ].filter(x => x.c > 0)
  const creditsC = creditItems.reduce((t, x) => t + x.c, 0)
  const payableC = core.dueC - creditsC

  const rows = []
  const r = (label, value, o = {}) => rows.push({ label, value, ...o })
  const toDate = ' to date'
  incomeRows(r, core, toDate)
  rcitRow(r, core, toDate)
  if (mcitStatus === 'notYet') {
    r('Minimum corporate income tax', null, { sub: `Not yet applicable: MCIT starts with ${taxablePeriod(registrationYear + MCIT_START, fiscalYearEndMonth).name}.` })
  } else {
    r(`Minimum corporate income tax @ ${RT.mcitRate} of gross income to date${mcitStatus === 'unknown' ? ', if it applies' : ''}`, P(core.mcitC), {
      strong: core.usesMcit,
      sub: 'Compared every quarter on the figures from the start of the year (RR 12-2007).',
    })
  }
  r('Income tax due to date', P(core.dueC), { strong: true, rule: true })
  for (const x of creditItems) r(x.label, -P(x.c))
  if (payableC >= 0) r('Income tax payable with this 1702Q', P(payableC), { strong: true, rule: true })
  else r('Overpayment to date', P(-payableC), { strong: true, rule: true, sub: 'Nothing to pay this quarter; the excess is credited in the next quarter or on the annual return.' })

  return {
    supported: true,
    quarter,
    quarterLabel,
    dueDate,
    deduction,
    osd: core.osd ? P(core.deductionC) : null,
    grossIncome: P(core.grossIncomeC),
    taxableIncome: P(core.taxableIncomeC),
    rcit: P(core.rcitC),
    mcit: P(core.mcitC),
    mcitStatus,
    usesMcit: core.usesMcit,
    taxDue: P(core.dueC),
    excessMcitApplied: P(ex.appliedC),
    credits: P(creditsC),
    payable: P(payableC),
    rows,
  }
}
