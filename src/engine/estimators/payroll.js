// Employer-side payroll estimator: per-employee withholding for the chosen pay
// period (per payday and per month), plus the employer's true monthly cost of
// employment. Also the shared pay helpers used by the Employee tab and the
// Tools withholding calculator.
//
// Rounding: every payslip / withholding line is rounded half-up to the centavo
// and computed in whole centavos (src/lib/money.js). Per-period taxable pay is
// the monthly figure ÷ periods per month, rounded to the centavo; the monthly
// withholding is the per-period amount × periods per month, rounded once.

import wcomp from '../../data/rules/withholding-compensation.json'
import { bracketTaxCentavos } from '../tax.js'
import { employeeMandatoryDeductions, employerContributions, sssEmployee } from './contributions.js'
import { toCentavos, fromCentavos, mulFrac, formatCentavos } from '../../lib/money.js'
import { RT, pesoText, monthlyRemitText } from '../ruleText.js'

const TABLES = wcomp.tables.value

// C04: paid days a year for a minimum wage earner (owner decision 9):
// 365 (paid every day, e.g. monthly-paid), 313 (six-day week), 261 (five-day week).
// L08: daily-paid staff use the same factor.
export const PAY_FACTORS = wcomp.mweExempt.value.payFactors
export const DEFAULT_PAY_FACTOR = wcomp.mweExempt.value.defaultPayFactor

export function payFactorOf(f) {
  if (f === undefined || f === null || f === '') return DEFAULT_PAY_FACTOR
  const n = Number(f)
  if (!PAY_FACTORS.includes(n)) throw new RangeError(`Paid days a year must be ${PAY_FACTORS.join(', ')}; got ${f}`)
  return n
}

// L08: pay periods, in display order, with the RR 11-2018 table each uses.
export const PAY_PERIODS = [
  ['monthly', 'Monthly'],
  ['semiMonthly', 'Semi-monthly (twice a month)'],
  ['weekly', 'Weekly'],
  ['daily', 'Daily'],
]
const PERIOD_NAMES = { monthly: 'monthly', semiMonthly: 'semi-monthly', weekly: 'weekly', daily: 'daily' }

// Pay periods per month as exact fractions [numerator, denominator]; daily
// uses the paid days a year (365 / 313 / 261) ÷ 12.
function periodsPerMonth(payPeriod, factor) {
  switch (payPeriod) {
    case 'monthly': return [1, 1]
    case 'semiMonthly': return [2, 1]
    case 'weekly': return [52, 12]
    case 'daily': return [factor, 12]
    default: throw new Error(`Unknown pay period: ${payPeriod}`)
  }
}

/**
 * L08: withholding per payday from the matching table. Per-period taxable pay
 * is the monthly figure ÷ paydays a month (rounded to the centavo); the
 * month's figure is the per-period withholding × paydays a month (rounded
 * once, an average for weekly and daily pay); the year's is per-period ×
 * paydays a year (12, 24, 52, or the paid days).
 */
export function periodWithholding(monthlyTaxableC, payPeriod = 'monthly', payFactor) {
  const factor = payFactorOf(payFactor)
  const [num, den] = periodsPerMonth(payPeriod, factor)
  const perPeriodTaxableC = mulFrac(monthlyTaxableC, den, num)
  const perPeriodWithholdingC = bracketTaxCentavos(TABLES[payPeriod], perPeriodTaxableC)
  const monthlyWithholdingC = mulFrac(perPeriodWithholdingC, num, den)
  const periodsPerYear = (num * 12) / den
  return {
    payPeriod,
    periodName: PERIOD_NAMES[payPeriod],
    factor,
    periodsPerYear,
    perPeriodTaxableC,
    perPeriodWithholdingC,
    monthlyWithholdingC,
    withheldYearC: perPeriodWithholdingC * periodsPerYear,
  }
}

/**
 * L08: the Tools withholding calculator.
 *   amount     pay for ONE payday (taxable pay, or gross pay in 'gross' mode)
 *   mode       'taxable' | 'gross' (gross: the employee's SSS / PhilHealth /
 *              Pag-IBIG shares for the month, on the month's gross, are spread
 *              evenly over the month's paydays and subtracted)
 *   payPeriod  'monthly' | 'semiMonthly' | 'weekly' | 'daily'
 *   payFactor  paid days a year for daily pay (365 / 313 / 261)
 */
export function withholdingCalculator({ amount = 0, mode = 'taxable', payPeriod = 'monthly', payFactor } = {}) {
  const P = fromCentavos
  const factor = payFactorOf(payFactor)
  const [num, den] = periodsPerMonth(payPeriod, factor)
  const amountC = toCentavos(amount || 0)
  let perPeriodTaxableC = amountC
  let deductionsPerPeriodC = 0
  let monthlyGrossC = null
  if (mode === 'gross') {
    monthlyGrossC = mulFrac(amountC, num, den)
    const ded = employeeMandatoryDeductions(P(monthlyGrossC))
    deductionsPerPeriodC = mulFrac(toCentavos(ded.total), den, num)
    perPeriodTaxableC = Math.max(0, amountC - deductionsPerPeriodC)
  }
  const perPeriodWithholdingC = bracketTaxCentavos(TABLES[payPeriod], perPeriodTaxableC)
  return {
    payPeriod,
    periodName: PERIOD_NAMES[payPeriod],
    monthlyGross: monthlyGrossC == null ? null : P(monthlyGrossC),
    deductionsPerPeriod: P(deductionsPerPeriodC),
    perPeriodTaxable: P(perPeriodTaxableC),
    perPeriodWithholding: P(perPeriodWithholdingC),
  }
}

// H10: the NCR rates quoted under the minimum wage earner's daily-rate box.
export function minimumWageReferenceNote() {
  const m = wcomp.minimumWageReference.value
  const [y, mo, d] = m.effective.split('-').map(Number)
  const from = new Date(y, mo - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${m.region} (${m.order}, from ${from}): ${pesoText(m.dailyNonAgriculture)} a day for non-agriculture; ${pesoText(m.dailyAgricultureAndSmall)} for ${m.agricultureAndSmallCovers}. Other regions have their own wage orders.`
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

// Shown under the SSS line on both tabs. L21: also says how much of the SSS
// contributions on this credit goes to the Mandatory Provident Fund (the
// part of the credit above the WISP threshold).
export function sssBaseNote(msc) {
  const peso = c => formatCentavos(c).replace(/\.00$/, '')
  let note = `Monthly salary credit ${peso(toCentavos(msc))}: basic pay plus regular allowances and commissions, up to ${RT.sssMscCeiling} (RA 11199). One-time or liquidated items do not count.`
  const mpf = sssEmployee(msc).wispPortionOfTotal
  if (mpf > 0) {
    note += ` Of the SSS contributions on this credit, ${peso(toCentavos(mpf))} (on the part above ${RT.sssWispThreshold}) goes to the Mandatory Provident Fund (MPF).`
  }
  return note
}

// L08: the per-payday lines shown when pay is not monthly.
export function perPaydayRows(r, pw) {
  if (pw.payPeriod === 'monthly') return
  r(`Taxable pay per payday (${pw.periodName})`, fromCentavos(pw.perPeriodTaxableC), {
    sub: `Monthly taxable pay spread over ${pw.periodsPerYear} ${pw.payPeriod === 'daily' ? 'paid days' : 'paydays'} a year.`,
  })
  r(`Withholding per payday (${pw.periodName} table)`, fromCentavos(pw.perPeriodWithholdingC), {
    strong: true,
    sub: `RR 11-2018 ${pw.periodName} withholding table (effective ${RT.withholdingTablesFrom}).`,
  })
}

// 'average month' for weekly and daily pay, where the paydays in a month vary.
export function monthLabel(pw) {
  return pw.payPeriod === 'weekly' || pw.payPeriod === 'daily' ? ', average month' : ''
}

/**
 * Full monthly picture for one employee.
 * @param {Object} in_ { monthlyBasic, monthlyAllowances, monthlyOtherTaxable, payPeriod (or period),
 *                       payFactor, mwe, mweDailyRate, mweExtraPay }
 */
export function estimatePayroll(in_) {
  const payPeriod = in_.payPeriod ?? in_.period ?? 'monthly'
  const C = toCentavos
  const P = fromCentavos
  const pay = monthlyPay(in_)
  const ded = pay.ded
  const payC = pay.grossC
  const monthlyTaxableC = pay.taxableC

  const pw = periodWithholding(monthlyTaxableC, payPeriod, in_.payFactor)
  const perPeriodTaxableC = pw.perPeriodTaxableC
  const perPeriodWithholdingC = pw.perPeriodWithholdingC
  const monthlyWithholdingC = pw.monthlyWithholdingC

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
  perPaydayRows(r, pw)
  r(`Withholding tax to remit (1601-C)${monthLabel(pw)}`, monthlyWithholding, { strong: true, sub: `Revised withholding table effective ${RT.withholdingTablesFrom}; remit ${monthlyRemitText('bir-1601c')}.` })
  r('Employer SSS share (incl. EC)', er.sss, { sub: sssBaseNote(ded.sssMsc) })
  r('Employer PhilHealth share', er.philhealth)
  r('Employer Pag-IBIG share', er.pagibig)
  r('Accrued 13th-month pay (1/12 of basic)', P(thirteenthC), { sub: 'PD 851: the 13th-month pay is one-twelfth of the basic salary earned in the year, so set this aside every month.' })
  r('Total employer cost this month', P(totalCostC), { strong: true, rule: true, sub: 'Pay, employer contributions and the 13th-month accrual. Other benefits (leave, bonuses, benefits in kind) are not included.' })

  return {
    minimumWage: P(pay.minimumWageC),
    exemptPay: P(pay.exemptC),
    payPeriod,
    monthlyTaxable,
    perPeriodTaxable: P(perPeriodTaxableC),
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
