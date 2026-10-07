// Domestic-corporation estimator: RCIT (25% / 20% small-corp) vs 2% MCIT,
// with the 4th-year MCIT rule and a transparent breakdown.
//
// Rounding: BIR Form 1702 lines are whole pesos (49 centavos or less drop,
// 50 or more round up); each line is rounded and later lines are computed
// from the rounded ones.

import corp from '../../data/rules/corporate.json'
import businessTax from '../../data/rules/business-tax.json'
import { toCentavos, fromCentavos, toWholePesos, mulRate, formatPesos } from '../../lib/money.js'
import { manilaToday, mkDate, lastDayOfMonth, shiftToBusinessDay, iso } from '../dates.js'
import { HOLIDAY_SET } from '../../lib/deadlineData.js'

const RCIT = corp.rcit.value
const MCIT = corp.mcit.value
const VAT_THRESHOLD = businessTax.vatThreshold.value
const PCT_RATE = businessTax.percentageTaxRate.value
// C06: the 2% MCIT and 3% percentage tax apply to periods from this date. Earlier
// periods used 1% (Jul 2020 to Jun 2023) and are not supported (owner decision 1).
const RATES_FROM = MCIT.currentRatesFrom

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
  const due = shiftToBusinessDay(mkDate(year, m + 4, 15), holidays)
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

/**
 * @param {Object} in_
 *   grossSales      annual gross sales/revenue
 *   costOfSales     direct costs → gross income = grossSales - costOfSales
 *   opex            deductible operating expenses
 *   totalAssets     total assets excluding land (for the 20% small-corp test)
 *   cwt             creditable withholding (2307s)
 *   quarterlyPaid   income tax already paid on this year's 1702Q returns
 *   priorYearCredits excess credits carried over from last year's annual return
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
  const line = pesos => toWholePesos(toCentavos(pesos || 0))
  const P = fromCentavos

  const grossSalesC = line(in_.grossSales)
  const costOfSalesC = line(in_.costOfSales)
  const opexC = line(in_.opex)
  const cwtC = line(in_.cwt)
  // H06: credits against the annual 1702-RT. Quarterly 1702Q amounts are
  // entered by the user; this estimator does not compute them.
  const quarterlyPaidC = line(in_.quarterlyPaid)
  const priorYearCreditsC = line(in_.priorYearCredits)
  const creditItems = [
    { label: 'Less: creditable tax withheld (2307s)', c: cwtC },
    { label: 'Less: income tax paid on this year\'s quarterly returns (1702Q)', c: quarterlyPaidC },
    { label: 'Less: excess credits carried over from last year', c: priorYearCreditsC },
  ].filter(x => x.c > 0)
  const creditsC = creditItems.reduce((t, x) => t + x.c, 0)
  const grossIncomeC = Math.max(0, grossSalesC - costOfSalesC)
  const taxableIncomeC = Math.max(0, grossIncomeC - opexC)

  const grossSales = P(grossSalesC)
  const costOfSales = P(costOfSalesC)
  const opex = P(opexC)
  const grossIncome = P(grossIncomeC)
  const taxableIncome = P(taxableIncomeC)

  const smallCorp = taxableIncome <= RCIT.smallCorpTaxableIncomeCeiling && totalAssets <= RCIT.smallCorpAssetCeiling
  const rcitRate = smallCorp ? RCIT.smallCorpRate : RCIT.standardRate
  const rcitC = toWholePesos(mulRate(taxableIncomeC, rcitRate))

  // H13: MCIT applies beginning the 4th taxable year immediately following the
  // year of BIR registration (RR 9-98; e.g. registered 2022 → MCIT from TY 2026).
  // When the year is not set, MCIT is still computed and shown next to RCIT,
  // and the tax due assumes it applies (owner default: never show less).
  const mcitStatus = registrationYear == null ? 'unknown' : taxYear >= registrationYear + 4 ? 'applies' : 'notYet'
  const mcitApplies = mcitStatus === 'applies'
  const mcitCounts = mcitStatus !== 'notYet'
  const mcitC = mcitCounts ? toWholePesos(mulRate(grossIncomeC, MCIT.rate)) : 0
  const usesMcit = mcitCounts && mcitC > rcitC
  const incomeTaxDueC = Math.max(rcitC, mcitC)
  const mcitWarning = mcitStatus !== 'unknown'
    ? null
    : usesMcit
      ? `The year registered with the BIR is not set on the profile. If the corporation is in its 4th taxable year after that year or later, MCIT applies and income tax due is ${formatPesos(mcitC)} (2% MCIT); if not, it is ${formatPesos(rcitC)} (regular rate). Set the year on the profile (RR 9-98).`
      : `The year registered with the BIR is not set on the profile, but the regular tax (${formatPesos(rcitC)}) is higher than the 2% MCIT (${formatPesos(mcitC)}), so the tax due is the same either way.`

  // The ₱3M test uses the actual sales, not the rounded line.
  const overThreshold = toCentavos(in_.grossSales || 0) > toCentavos(VAT_THRESHOLD)
  const vat = vatRegistered || overThreshold
  const pctC = vat ? 0 : toWholePesos(mulRate(grossSalesC, PCT_RATE))

  const rcit = P(rcitC)
  const mcit = P(mcitC)
  const incomeTaxDue = P(incomeTaxDueC)
  const pct = P(pctC)

  const rows = []
  const r = (label, value, o = {}) => rows.push({ label, value, ...o })
  r('Gross sales / revenue', grossSales)
  r('Less: cost of sales / services', -costOfSales)
  r('Gross income', grossIncome, { rule: true })
  r('Less: operating expenses', -opex)
  r('Net taxable income', taxableIncome, { rule: true })
  r(`Regular corporate income tax @ ${Math.round(rcitRate * 100)}%`, rcit, {
    strong: !usesMcit,
    sub: smallCorp
      ? '20% rate: net taxable income ≤ ₱5M and total assets ≤ ₱100M excluding land (NIRC Sec 27(A), CREATE).'
      : 'Standard 25% rate (NIRC Sec 27(A), CREATE).',
  })
  if (mcitApplies) {
    r('Minimum corporate income tax @ 2% of gross income', mcit, {
      strong: usesMcit,
      sub: usesMcit
        ? 'MCIT exceeds RCIT this year, so you pay the MCIT; the excess credits against RCIT for the next 3 years (NIRC Sec 27(E)).'
        : 'RCIT is higher, so the regular tax applies (NIRC Sec 27(E)).',
    })
  } else if (mcitStatus === 'notYet') {
    r('Minimum corporate income tax', null, {
      sub: `Not yet applicable: MCIT starts with ${taxablePeriod(registrationYear + 4, fiscalYearEndMonth).name}, the 4th taxable year after the year of BIR registration (RR 9-98).`,
    })
  } else {
    r('Minimum corporate income tax @ 2% of gross income, if it applies', mcit, {
      strong: usesMcit,
      sub: 'The year registered with the BIR is not set on the profile. MCIT applies from the 4th taxable year after that year (RR 9-98), so it is shown in case it applies.',
    })
  }
  r(mcitStatus === 'unknown' && usesMcit ? 'Income tax due, if MCIT applies' : 'Income tax due', incomeTaxDue, {
    strong: true,
    rule: true,
    sub: mcitStatus === 'unknown' && usesMcit ? `If MCIT does not apply yet, income tax due is the regular tax of ${formatPesos(rcitC)}.` : undefined,
  })
  if (!vat && pct > 0) r('Percentage tax (3% of gross)', pct, { strong: true, sub: 'Non-VAT corporation under the ₱3M threshold (Form 2551Q).' })
  // H05 (owner decision 4): VAT is not computed here.
  if (vat) r('Value-added tax', null, { sub: 'Not included in this estimate. VAT (12% of sales less creditable input VAT) is filed quarterly on Form 2550Q.' })
  if (creditsC > 0) {
    for (const x of creditItems) r(x.label, -P(x.c))
    const net = P(incomeTaxDueC - creditsC)
    if (net >= 0) r('Income tax still payable', net, { strong: true })
    else r('Overpayment: refund or carry over', -net, { strong: true, sub: 'The carry-over election, once made on the annual return, is irrevocable (NIRC Sec 76).' })
  }

  return {
    supported: true,
    taxYear,
    period,
    grossIncome,
    taxableIncome,
    smallCorp,
    rcitRate,
    rcit,
    mcitStatus,
    mcitApplies,
    mcit,
    usesMcit,
    mcitWarning,
    incomeTaxDue,
    pct,
    vat,
    overThreshold,
    vatNotIncluded: vat,
    vatNote: vat ? 'Income tax and percentage tax only; VAT not included.' : null,
    credits: P(creditsC),
    netPayable: P(incomeTaxDueC - creditsC),
    totalAnnualTax: P(incomeTaxDueC + pctC),
    rows,
    references: [...corp.rcit.legalBasis, ...corp.mcit.legalBasis],
  }
}
