// Employee-side estimator: annualized income tax, monthly withholding, and
// take-home pay, mirroring the employer's year-end annualization (Sec 79(H)).
//
// Rounding: payslip and withholding lines are rounded half-up to the centavo
// (owner decision; the BIR rule for 1601-C/2316 is unconfirmed, needs_review).
// Everything is computed in whole centavos, so the payslip foots and the
// 12-month total is exactly 12 × the rounded monthly withholding.

import incomeTax from '../../data/rules/income-tax.json'
import wcomp from '../../data/rules/withholding-compensation.json'
import { bracketTaxCentavos } from '../tax.js'
import { monthlyPay } from './payroll.js'
import { toCentavos, fromCentavos } from '../../lib/money.js'

const BR = incomeTax.graduatedBrackets.value
const CAP13 = incomeTax.thirteenthMonthExclusionCap.value
const TABLES = wcomp.tables.value

/**
 * @param {Object} in_
 *   monthlyBasic       basic monthly salary
 *   monthlyAllowances  other TAXABLE monthly compensation (de minimis excluded)
 *   bonusesAnnual      13th month + other benefits for the year (cash)
 *   mwe, mweDailyRate, payFactor, mweExtraPay
 *                      minimum wage earner: statutory daily rate × paid days a
 *                      year (365 / 313 / 261) ÷ 12, plus holiday, overtime,
 *                      night-differential and hazard pay, all tax-free (C04)
 */
export function estimateEmployee(in_) {
  const { bonusesAnnual = 0 } = in_
  const C = toCentavos
  const P = fromCentavos

  const pay = monthlyPay(in_)
  const ded = pay.ded
  const payC = pay.grossC
  const monthlyTaxableC = pay.taxableC

  const bonusTaxableC = Math.max(0, C(bonusesAnnual) - C(CAP13))
  const annualTaxableC = monthlyTaxableC * 12 + bonusTaxableC
  const annualTaxC = bracketTaxCentavos(BR, annualTaxableC)

  // Withholding per the monthly table on this month's taxable pay.
  const monthlyWithholdingC = bracketTaxCentavos(TABLES.monthly, monthlyTaxableC)
  const withheld12C = monthlyWithholdingC * 12

  const monthlyTaxable = P(monthlyTaxableC)
  const monthlyWithholding = P(monthlyWithholdingC)
  const monthlyTakeHome = P(payC - pay.dedC - monthlyWithholdingC)
  const annualTaxable = P(annualTaxableC)
  const annualTax = P(annualTaxC)

  const rows = []
  const r = (label, value, o = {}) => rows.push({ label, value, ...o })
  if (pay.mwe) {
    r(`Statutory minimum wage (${pay.minimumWageText}): tax-free`, P(pay.minimumWageC))
    if (pay.extraC) r('Holiday, overtime, night-differential and hazard pay: tax-free', P(pay.extraC))
  } else {
    r('Monthly basic pay', P(pay.basicC))
  }
  if (pay.allowancesC) r('Taxable allowances / other pay', P(pay.allowancesC))
  r('Less: SSS employee share', -ded.sss)
  r('Less: PhilHealth employee share', -ded.philhealth)
  r('Less: Pag-IBIG employee share', -ded.pagibig)
  if (pay.mwe) {
    r('Less: tax-free pay, after the shares above', -P(pay.exemptAfterSharesC), {
      sub: 'A minimum wage earner pays no income tax on the minimum wage or on holiday, overtime, night-differential and hazard pay (NIRC Sec 24(A)(2); RR 11-2018). Your SSS, PhilHealth and Pag-IBIG shares come out of that tax-free pay.',
    })
  }
  r('Monthly taxable compensation', monthlyTaxable, { rule: true })
  r('Withholding tax this month', monthlyWithholding, { strong: true, sub: 'Revised withholding table effective 2023 (RR 11-2018, as amended).' })
  r('Estimated monthly take-home', monthlyTakeHome, { strong: true })

  const annualRows = []
  const a = (label, value, o = {}) => annualRows.push({ label, value, ...o })
  a('Annualized taxable compensation (×12)', P(monthlyTaxableC * 12))
  a('13th month & other benefits', bonusesAnnual)
  a(`Less: exclusion cap (₱${CAP13.toLocaleString('en-US')})`, -P(Math.min(C(bonusesAnnual), C(CAP13))))
  a('Annual taxable income', annualTaxable, { rule: true })
  a('Annual income tax (graduated table)', annualTax, { strong: true, sub: 'Your employer trues this up in December: extra tax is withheld or over-withholding refunded (NIRC Sec 79(H)).' })
  a('Total withheld over 12 months', P(withheld12C))
  const diff = P(annualTaxC - withheld12C)
  if (Math.abs(diff) >= 1) {
    a(diff > 0 ? 'Year-end adjustment: extra withholding due' : 'Year-end adjustment: refund due to you', Math.abs(diff), { strong: true })
  }

  return {
    minimumWage: P(pay.minimumWageC),
    exemptPay: P(pay.exemptC),
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
      ...(pay.mwe ? wcomp.mweExempt.legalBasis : []),
    ],
  }
}
