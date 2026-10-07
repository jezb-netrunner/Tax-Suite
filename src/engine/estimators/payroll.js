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
import { toCentavos, fromCentavos, mulFrac } from '../../lib/money.js'

const TABLES = wcomp.tables.value
// Pay periods per month as exact fractions [numerator, denominator].
const PERIODS_PER_MONTH = { monthly: [1, 1], semiMonthly: [2, 1], weekly: [52, 12], daily: [313, 12] }

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
 * @param {Object} in_ { monthlyBasic, monthlyAllowances, period }
 */
export function estimatePayroll(in_) {
  const { monthlyBasic = 0, monthlyAllowances = 0, period = 'monthly' } = in_
  const C = toCentavos
  const P = fromCentavos
  const ded = employeeMandatoryDeductions(monthlyBasic)
  const payC = C(monthlyBasic) + C(monthlyAllowances)
  const monthlyTaxableC = Math.max(0, payC - C(ded.total))

  const table = TABLES[period]
  if (!table) throw new Error(`Unknown pay period: ${period}`)
  const [num, den] = PERIODS_PER_MONTH[period]
  const perPeriodTaxableC = mulFrac(monthlyTaxableC, den, num)
  const perPeriodWithholdingC = bracketTaxCentavos(table, perPeriodTaxableC)
  const monthlyWithholdingC = mulFrac(perPeriodWithholdingC, num, den)

  const er = employerContributions(monthlyBasic)
  const totalCostC = payC + C(er.total)
  const monthlyTaxable = P(monthlyTaxableC)
  const perPeriodWithholding = P(perPeriodWithholdingC)
  const monthlyWithholding = P(monthlyWithholdingC)

  const rows = []
  const r = (label, value, o = {}) => rows.push({ label, value, ...o })
  r('Monthly gross compensation', P(payC))
  r('Less: employee shares (SSS + PhilHealth + Pag-IBIG)', -ded.total)
  r('Monthly taxable compensation', monthlyTaxable, { rule: true })
  r('Withholding tax to remit (1601-C)', monthlyWithholding, { strong: true, sub: 'Revised withholding table effective 2023; remit by the 10th of the following month (Jan 15 for December).' })
  r('Employer SSS share (incl. EC)', er.sss)
  r('Employer PhilHealth share', er.philhealth)
  r('Employer Pag-IBIG share', er.pagibig)
  r('Total employer cost this month', P(totalCostC), { strong: true, rule: true })

  return {
    monthlyTaxable,
    perPeriodWithholding,
    monthlyWithholding,
    employeeDeductions: ded,
    employerContributions: er,
    totalMonthlyCost: P(totalCostC),
    rows,
    references: [...wcomp.tables.legalBasis],
  }
}
