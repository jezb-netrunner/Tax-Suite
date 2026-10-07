// Employer-side payroll estimator: per-employee monthly withholding across all
// pay periods, plus the employer's true monthly cost of employment.
//
// Rounding: every payslip / withholding line is rounded half-up to the centavo
// and computed in whole centavos (src/lib/money.js). Per-period taxable pay is
// the monthly figure ÷ periods per month, rounded to the centavo; the monthly
// withholding is the per-period amount × periods per month, rounded once.

import wcomp from '../../data/rules/withholding-compensation.json'
import { bracketTax, bracketTaxCentavos } from '../tax.js'
import { employeeMandatoryDeductions, employerContributions } from './contributions.js'
import { toCentavos, fromCentavos, mulFrac, formatCentavos } from '../../lib/money.js'

const TABLES = wcomp.tables.value
// Pay periods per month as exact fractions [numerator, denominator].
const PERIODS_PER_MONTH = { monthly: [1, 1], semiMonthly: [2, 1], weekly: [52, 12], daily: [313, 12] }

// C04: paid days a year for a minimum wage earner (owner decision 9):
// 365 (paid every day, e.g. monthly-paid), 313 (six-day week), 261 (five-day week).
export const PAY_FACTORS = wcomp.mweExempt.value.payFactors
export const DEFAULT_PAY_FACTOR = 313

export function payFactorOf(f) {
  if (f === undefined || f === null || f === '') return DEFAULT_PAY_FACTOR
  const n = Number(f)
  if (!PAY_FACTORS.includes(n)) throw new RangeError(`Paid days a year must be ${PAY_FACTORS.join(', ')}; got ${f}`)
  return n
}

// H10: the NCR rates quoted under the minimum wage earner's daily-rate box.
export function minimumWageReferenceNote() {
  const m = wcomp.minimumWageReference.value
  const [y, mo, d] = m.effective.split('-').map(Number)
  const from = new Date(y, mo - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${m.region} (${m.order}, from ${from}): ₱${m.dailyNonAgriculture} a day for non-agriculture; ₱${m.dailyAgricultureAndSmall} for ${m.agricultureAndSmallCovers}. Other regions have their own wage orders.`
}

// '₱755' or '₱755.50' (no '.00' on a whole-peso daily rate).
function dailyRateText(pesos) {
  return formatCentavos(toCentavos(pesos)).replace(/\.00$/, '')
}

/**
 * One month's pay, split into tax-free and taxable parts, in centavos.
 * Shared by the Employee and Payroll estimators.
 *
 *   mwe                statutory minimum wage earner (NIRC Sec 24(A)(2); RR 11-2018)
 *   mweDailyRate       statutory daily minimum wage (MWE only)
 *   payFactor          paid days a year: 365 | 313 | 261
 *   mweExtraPay        holiday, overtime, night-differential and hazard pay a month (MWE only; tax-free)
 *   monthlyBasic       basic monthly salary (ignored for an MWE: the minimum wage replaces it)
 *   monthlyAllowances  regular allowances, commissions and other regular taxable pay a month
 *                      (counts for SSS and Pag-IBIG: C05)
 *   monthlyOtherTaxable one-time or liquidated taxable items a month (taxed; not counted for SSS)
 *
 * Contribution bases (C05): SSS on basic + regular pay (+ an MWE's holiday,
 * overtime, night-differential and hazard pay: all actual remuneration under
 * RA 11199 Sec 8(f)); PhilHealth on basic; Pag-IBIG on the same monthly
 * compensation as SSS before the caps (needs_review).
 *
 * Taxable pay: everything except the tax-free pay, less the employee's
 * mandatory contributions to the extent the tax-free pay does not already
 * absorb them (an MWE's shares come out of the tax-free minimum wage:
 * withholding-compensation.json mweContributions, needs_review).
 */
export function monthlyPay(in_) {
  const C = toCentavos
  const mwe = Boolean(in_.mwe)
  const factor = payFactorOf(in_.payFactor)
  const dailyRate = Number(in_.mweDailyRate) || 0
  const minimumWageC = mwe ? mulFrac(C(dailyRate), factor, 12) : 0
  const basicC = mwe ? minimumWageC : C(in_.monthlyBasic || 0)
  const extraC = mwe ? C(in_.mweExtraPay || 0) : 0
  const allowancesC = C(in_.monthlyAllowances || 0)
  const otherTaxableC = C(in_.monthlyOtherTaxable || 0)
  const grossC = basicC + extraC + allowancesC + otherTaxableC
  const exemptC = minimumWageC + extraC

  const regularPayC = basicC + extraC + allowancesC
  const bases = { sssCompensation: fromCentavos(regularPayC), pagibigCompensation: fromCentavos(regularPayC) }
  const ded = employeeMandatoryDeductions(fromCentavos(basicC), bases)
  const dedC = C(ded.total)
  const dedFromTaxableC = Math.max(0, dedC - exemptC)
  const taxableC = Math.max(0, grossC - exemptC - dedFromTaxableC)
  return {
    mwe, factor, dailyRate, minimumWageC, basicC, extraC, allowancesC, otherTaxableC, grossC, exemptC,
    bases, ded, dedC, exemptAfterSharesC: exemptC - Math.min(dedC, exemptC), taxableC,
    minimumWageText: `${dailyRateText(dailyRate)} × ${factor} days ÷ 12`,
  }
}

// Shown under the SSS line on both tabs.
export function sssBaseNote(msc) {
  return `Monthly salary credit ${formatCentavos(toCentavos(msc)).replace(/\.00$/, '')}: basic pay plus regular allowances and commissions, up to ₱35,000 (RA 11199). One-time or liquidated items do not count.`
}

/**
 * Withholding on one pay period's TAXABLE compensation.
 */
export function withholdingForPeriod(taxable, period = 'monthly') {
  const table = TABLES[period]
  if (!table) throw new Error(`Unknown pay period: ${period}`)
  return bracketTax(table, taxable)
}

/**
 * Full monthly picture for one employee.
 * @param {Object} in_ { monthlyBasic, monthlyAllowances, period, mwe, mweDailyRate, payFactor, mweExtraPay }
 */
export function estimatePayroll(in_) {
  const { period = 'monthly' } = in_
  const C = toCentavos
  const P = fromCentavos
  const pay = monthlyPay(in_)
  const ded = pay.ded
  const payC = pay.grossC
  const monthlyTaxableC = pay.taxableC

  const table = TABLES[period]
  if (!table) throw new Error(`Unknown pay period: ${period}`)
  const [num, den] = PERIODS_PER_MONTH[period]
  const perPeriodTaxableC = mulFrac(monthlyTaxableC, den, num)
  const perPeriodWithholdingC = bracketTaxCentavos(table, perPeriodTaxableC)
  const monthlyWithholdingC = mulFrac(perPeriodWithholdingC, num, den)

  const er = employerContributions(P(pay.basicC), pay.bases)
  // M12: the mandatory 13th-month pay accrues every month: 1/12 of basic (PD 851).
  const thirteenthC = mulFrac(pay.basicC, 1, 12)
  const totalCostC = payC + C(er.total) + thirteenthC
  const monthlyTaxable = P(monthlyTaxableC)
  const perPeriodWithholding = P(perPeriodWithholdingC)
  const monthlyWithholding = P(monthlyWithholdingC)

  const rows = []
  const r = (label, value, o = {}) => rows.push({ label, value, ...o })
  r('Monthly gross compensation', P(payC))
  r('Less: employee shares (SSS + PhilHealth + Pag-IBIG)', -ded.total)
  if (pay.mwe) {
    r('Less: tax-free pay of a minimum wage earner, after the employee shares', -P(pay.exemptAfterSharesC), {
      sub: `Statutory minimum wage ${pay.minimumWageText} = ${formatCentavos(pay.minimumWageC)}`
        + (pay.extraC ? `, plus ${formatCentavos(pay.extraC)} holiday, overtime, night-differential and hazard pay` : '')
        + '. Tax-free for a minimum wage earner (NIRC Sec 24(A)(2); RR 11-2018).',
    })
  }
  r('Monthly taxable compensation', monthlyTaxable, { rule: true })
  r('Withholding tax to remit (1601-C)', monthlyWithholding, { strong: true, sub: 'Revised withholding table effective 2023; remit by the 10th of the following month (Jan 15 for December).' })
  r('Employer SSS share (incl. EC)', er.sss, { sub: sssBaseNote(ded.sssMsc) })
  r('Employer PhilHealth share', er.philhealth)
  r('Employer Pag-IBIG share', er.pagibig)
  r('Accrued 13th-month pay (1/12 of basic)', P(thirteenthC), { sub: 'PD 851: the 13th-month pay is one-twelfth of the basic salary earned in the year, so set this aside every month.' })
  r('Total employer cost this month', P(totalCostC), { strong: true, rule: true, sub: 'Pay, employer contributions and the 13th-month accrual. Other benefits (leave, bonuses, benefits in kind) are not included.' })

  return {
    minimumWage: P(pay.minimumWageC),
    exemptPay: P(pay.exemptC),
    monthlyTaxable,
    perPeriodWithholding,
    monthlyWithholding,
    employeeDeductions: ded,
    employerContributions: er,
    thirteenthMonthAccrual: P(thirteenthC),
    totalMonthlyCost: P(totalCostC),
    rows,
    references: [...wcomp.tables.legalBasis, ...(pay.mwe ? wcomp.mweExempt.legalBasis : [])],
  }
}
