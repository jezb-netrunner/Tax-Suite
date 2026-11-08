// H04 (NIRC Secs 116 and 236(G); RR 8-2018; RMO 23-2018; owner decision 6):
// a non-VAT taxpayer, individual or corporation, whose sales pass the VAT
// threshold during the taxable year. The percentage tax applies to sales
// from the start of the taxable year to the end of the month the threshold
// was passed; VAT applies from the following month (not computed here).
// Shared by the individual and corporate estimators.
//
// Months are calendar months (1 = January). A calendar taxable year starts in
// January; a fiscal year starts in the month after its year-end month.

import businessTax from '../../data/rules/business-tax.json'
import { toCentavos, fromCentavos, toWholePesos, mulFrac, groupThousands } from '../../lib/money.js'
import { RT, MONTH_NAMES } from '../ruleText.js'

const VAT_THRESHOLD_C = toCentavos(businessTax.vatThreshold.value)
const pesoText = c => '₱' + groupThousands(Math.round(c / 100))
const line = pesos => toWholePesos(toCentavos(pesos || 0))

// Calendar month (1-12) of the n-th month (1-12) of a taxable year starting in firstMonth.
const monthAt = (firstMonth, n) => ((firstMonth - 1 + n - 1) % 12) + 1

/** Sales (pesos, exact) over the VAT threshold. */
export function overVatThreshold(sales) {
  return toCentavos(sales || 0) > VAT_THRESHOLD_C
}

/** [calendar month as text, month name] for the 12 months of a taxable year starting in firstMonth. */
export function crossingMonthOptions(firstMonth = 1) {
  return Array.from({ length: 12 }, (_, i) => {
    const m = monthAt(firstMonth, i + 1)
    return [String(m), MONTH_NAMES[m - 1]]
  })
}

/**
 * @param {Object} in_
 *   salesC          the year's sales in centavos, exact (for the even-month test)
 *   grossC          the year's sales as a whole-peso return line, in centavos
 *   crossedMonth    calendar month (1-12) the threshold was passed; anything
 *                   else -> the month even monthly sales would pass it
 *   salesThroughCrossMonth  optional sales (pesos) from the start of the year
 *                   to the end of that month; blank -> the year's sales
 *                   spread evenly by month
 *   firstMonth      calendar month the taxable year starts in (1 for a calendar year)
 *   firstYear       calendar year of that first month
 * @returns {Object|null} null when the sales are not over the threshold
 */
export function thresholdCrossing({ salesC, grossC, crossedMonth, salesThroughCrossMonth, firstMonth = 1, firstYear }) {
  if (!(salesC > VAT_THRESHOLD_C)) return null
  const given = Number(crossedMonth)
  const validMonth = Number.isInteger(given) && given >= 1 && given <= 12
  // Even monthly sales pass the threshold in the first n with sales × n / 12 > threshold.
  const evenN = Math.min(12, Math.floor((12 * VAT_THRESHOLD_C) / salesC) + 1)
  // n: how many months of the taxable year, up to and including the crossing month.
  const n = validMonth ? ((given - firstMonth + 12) % 12) + 1 : evenN
  const month = monthAt(firstMonth, n)
  const firstName = MONTH_NAMES[firstMonth - 1]
  const span = n === 1 ? firstName : `${firstName} to ${MONTH_NAMES[month - 1]}`
  const warnings = []
  const enteredC = line(salesThroughCrossMonth)
  let ptBaseC
  let ptBaseFloored = false
  if (enteredC > 0) {
    ptBaseC = enteredC
    if (enteredC > grossC) {
      ptBaseC = grossC
      warnings.push(`Sales from ${span} can't be more than the year's gross sales (${pesoText(grossC)}); ${pesoText(grossC)} is used.`)
    } else if (toCentavos(salesThroughCrossMonth || 0) <= VAT_THRESHOLD_C) {
      // The exact amount typed is compared, not the whole-peso line, so
      // ₱3,000,000.01 counts as over the threshold (as everywhere else).
      warnings.push(`Sales from ${span} should be more than ${RT.vatThreshold}, since that is the month the threshold was passed.`)
    }
  } else {
    ptBaseC = toWholePesos(mulFrac(grossC, n, 12))
    // Sales spread evenly by month can't reach the threshold before the
    // even-sales month, yet the threshold was passed in the month chosen, so
    // sales to the end of that month were more than the threshold. The
    // threshold itself is used as the least they can be (never above the
    // year's sales), and the warning asks for the actual figure.
    if (validMonth && n < evenN && ptBaseC <= VAT_THRESHOLD_C) {
      const evenC = ptBaseC
      ptBaseC = Math.min(grossC, VAT_THRESHOLD_C)
      ptBaseFloored = true
      warnings.push(`Spread evenly by month, the year's sales would put only ${pesoText(evenC)} in ${span}, but the threshold was passed in ${MONTH_NAMES[month - 1]}, so sales to the end of ${MONTH_NAMES[month - 1]} were more than ${RT.vatThreshold}. The estimate uses ${RT.vatThreshold}, the least they can be: enter the actual sales from ${span} for an exact figure.`)
    }
  }
  // VAT from the month after the crossing month.
  const next = firstMonth - 1 + n // 0-based months from January of firstYear
  const evenMonth = monthAt(firstMonth, evenN)
  return {
    month,
    monthName: MONTH_NAMES[month - 1],
    monthsIn: n,
    span,
    assumedEvenSales: !validMonth,
    evenMonth,
    evenMonthName: MONTH_NAMES[evenMonth - 1],
    ptBaseC,
    ptBase: fromCentavos(ptBaseC),
    ptBaseProrated: !(enteredC > 0) && !ptBaseFloored,
    ptBaseFloored,
    vatFrom: `${MONTH_NAMES[next % 12]} ${firstYear + Math.floor(next / 12)}`,
    warnings,
  }
}

/** Breakdown rows for a crossing: percentage tax up to the crossing month, then VAT (not computed). */
export function crossingRows(r, crossing, pct) {
  r(`Percentage tax (${RT.percentageTaxRate} of sales ${crossing.span})`, pct, {
    strong: true,
    sub: `NIRC Sec 116. Paid quarterly on Form 2551Q, not with the annual return. Sales from ${crossing.span}: ${pesoText(crossing.ptBaseC)}` +
      (crossing.ptBaseProrated ? ' (the year\'s sales spread evenly by month).'
        : crossing.ptBaseFloored ? ` at least (the threshold was passed in ${crossing.monthName}; enter the actual sales for an exact figure).` : '.'),
  })
  r('Value-added tax', null, { sub: `VAT applies from ${crossing.vatFrom}: not included in this estimate.` })
}
