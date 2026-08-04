// Employer-side payroll estimator: per-employee monthly withholding across all
// pay periods, plus the employer's true monthly cost of employment.

import wcomp from '../../data/rules/withholding-compensation.json'
import { bracketTax } from '../tax.js'
import { employeeMandatoryDeductions, employerContributions } from './contributions.js'

const TABLES = wcomp.tables.value
const PERIODS_PER_MONTH = { monthly: 1, semiMonthly: 2, weekly: 52 / 12, daily: 313 / 12 }

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
  const ded = employeeMandatoryDeductions(monthlyBasic)
  const monthlyTaxable = Math.max(0, monthlyBasic + monthlyAllowances - ded.total)

  const perMonth = PERIODS_PER_MONTH[period]
  const perPeriodTaxable = monthlyTaxable / perMonth
  const perPeriodWithholding = withholdingForPeriod(perPeriodTaxable, period)
  const monthlyWithholding = perPeriodWithholding * perMonth

  const er = employerContributions(monthlyBasic)

  const rows = []
  const r = (label, value, o = {}) => rows.push({ label, value, ...o })
  r('Monthly gross compensation', monthlyBasic + monthlyAllowances)
  r('Less: employee shares (SSS + PhilHealth + Pag-IBIG)', -ded.total)
  r('Monthly taxable compensation', monthlyTaxable, { rule: true })
  r('Withholding tax to remit (1601-C)', monthlyWithholding, { strong: true, sub: 'Revised withholding table effective 2023; remit by the 10th of the following month (Jan 15 for December).' })
  r('Employer SSS share (incl. EC)', er.sss)
  r('Employer PhilHealth share', er.philhealth)
  r('Employer Pag-IBIG share', er.pagibig)
  r('Total employer cost this month', monthlyBasic + monthlyAllowances + er.total, { strong: true, rule: true })

  return {
    monthlyTaxable,
    perPeriodWithholding,
    monthlyWithholding,
    employeeDeductions: ded,
    employerContributions: er,
    totalMonthlyCost: monthlyBasic + monthlyAllowances + er.total,
    rows,
    references: [...wcomp.tables.legalBasis],
  }
}
