// Employee-side estimator: annualized income tax, monthly withholding, and
// take-home pay, mirroring the employer's year-end annualization (Sec 79(H)).

import incomeTax from '../../data/rules/income-tax.json'
import wcomp from '../../data/rules/withholding-compensation.json'
import { bracketTax } from '../tax.js'
import { employeeMandatoryDeductions } from './contributions.js'

const BR = incomeTax.graduatedBrackets.value
const CAP13 = incomeTax.thirteenthMonthExclusionCap.value
const TABLES = wcomp.tables.value

/**
 * @param {Object} in_
 *   monthlyBasic       basic monthly salary
 *   monthlyAllowances  other TAXABLE monthly compensation (de minimis excluded)
 *   bonusesAnnual      13th month + other benefits for the year (cash)
 *   payPeriod          'monthly' | 'semiMonthly' | 'weekly' | 'daily'
 */
export function estimateEmployee(in_) {
  const { monthlyBasic = 0, monthlyAllowances = 0, bonusesAnnual = 0 } = in_

  const ded = employeeMandatoryDeductions(monthlyBasic)
  const monthlyTaxable = Math.max(0, monthlyBasic + monthlyAllowances - ded.total)

  const bonusTaxable = Math.max(0, bonusesAnnual - CAP13)
  const annualTaxable = monthlyTaxable * 12 + bonusTaxable
  const annualTax = bracketTax(BR, annualTaxable)

  // Withholding per the monthly table on this month's taxable pay.
  const monthlyWithholding = bracketTax(
    TABLES.monthly.map(b => ({ over: b.over, base: b.base, rate: b.rate })),
    monthlyTaxable
  )

  const monthlyTakeHome = monthlyBasic + monthlyAllowances - ded.total - monthlyWithholding

  const rows = []
  const r = (label, value, o = {}) => rows.push({ label, value, ...o })
  r('Monthly basic pay', monthlyBasic)
  if (monthlyAllowances) r('Taxable allowances / other pay', monthlyAllowances)
  r('Less: SSS employee share', -ded.sss)
  r('Less: PhilHealth employee share', -ded.philhealth)
  r('Less: Pag-IBIG employee share', -ded.pagibig)
  r('Monthly taxable compensation', monthlyTaxable, { rule: true })
  r('Withholding tax this month', monthlyWithholding, { strong: true, sub: 'Revised withholding table effective 2023 (RR 11-2018, as amended).' })
  r('Estimated monthly take-home', monthlyTakeHome, { strong: true })

  const annualRows = []
  const a = (label, value, o = {}) => annualRows.push({ label, value, ...o })
  a('Annualized taxable compensation (×12)', monthlyTaxable * 12)
  a('13th month & other benefits', bonusesAnnual)
  a(`Less: exclusion cap (₱${CAP13.toLocaleString('en-US')})`, -Math.min(bonusesAnnual, CAP13))
  a('Annual taxable income', annualTaxable, { rule: true })
  a('Annual income tax (graduated table)', annualTax, { strong: true, sub: 'Your employer trues this up in December — extra tax is withheld or over-withholding refunded (NIRC Sec 79(H)).' })
  a('Total withheld over 12 months', monthlyWithholding * 12)
  const diff = annualTax - monthlyWithholding * 12
  if (Math.abs(diff) >= 1) {
    a(diff > 0 ? 'Year-end adjustment — extra withholding due' : 'Year-end adjustment — refund due to you', Math.abs(diff), { strong: true })
  }

  return {
    monthlyTaxable,
    monthlyWithholding,
    monthlyTakeHome,
    deductions: ded,
    annualTaxable,
    annualTax,
    yearEndDifference: diff,
    rows,
    annualRows,
    references: [
      ...incomeTax.graduatedBrackets.legalBasis,
      ...wcomp.tables.legalBasis,
      ...incomeTax.thirteenthMonthExclusionCap.legalBasis,
    ],
  }
}
