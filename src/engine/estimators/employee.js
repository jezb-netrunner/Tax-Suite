// Employee-side estimator: annualized income tax, monthly withholding, and
// take-home pay, mirroring the employer's year-end annualization (Sec 79(H)).
//
// Rounding: payslip and withholding lines are rounded half-up to the centavo
// (owner decision; the BIR rule for 1601-C/2316 is unconfirmed, needs_review).
// Everything is computed in whole centavos, so the payslip foots and the
// year's total is exactly the rounded per-payday withholding × paydays a year
// (12 × the monthly figure for monthly pay).

import incomeTax from '../../data/rules/income-tax.json'
import wcomp from '../../data/rules/withholding-compensation.json'
import { bracketTaxCentavos } from '../tax.js'
import { monthlyPay, sssBaseNote, periodWithholding, perPaydayRows, monthLabel } from './payroll.js'
import { toCentavos, fromCentavos } from '../../lib/money.js'
import { RT, pesoText } from '../ruleText.js'

const BR = incomeTax.graduatedBrackets.value
const CAP13 = incomeTax.thirteenthMonthExclusionCap.value

/**
 * @param {Object} in_
 *   monthlyBasic       basic monthly salary
 *   monthlyAllowances  regular TAXABLE allowances / commissions a month (count for SSS; de minimis excluded)
 *   monthlyOtherTaxable one-time or liquidated TAXABLE items a month (do not count for SSS)
 *   bonusesAnnual      13th month + other benefits for the year (cash)
 *   payPeriod          'monthly' (default) | 'semiMonthly' | 'weekly' | 'daily' (L08)
 *   payFactor          paid days a year for daily pay and minimum wage earners (365 / 313 / 261)
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

  // L08: withholding per payday from the table for the pay period; the year's
  // total is per payday × paydays a year (12 × the monthly figure when monthly).
  const pw = periodWithholding(monthlyTaxableC, in_.payPeriod ?? 'monthly', in_.payFactor)
  const monthlyWithholdingC = pw.monthlyWithholdingC
  const withheld12C = pw.withheldYearC

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
  if (pay.allowancesC) r('Regular allowances / commissions', P(pay.allowancesC))
  if (pay.otherTaxableC) r('One-time or liquidated items', P(pay.otherTaxableC))
  r('Less: SSS employee share', -ded.sss, { sub: sssBaseNote(ded.sssMsc) })
  r('Less: PhilHealth employee share', -ded.philhealth)
  r('Less: Pag-IBIG employee share', -ded.pagibig)
  if (pay.mwe) {
    r('Less: tax-free pay, after the shares above', -P(pay.exemptAfterSharesC), {
      sub: 'A minimum wage earner pays no income tax on the minimum wage or on holiday, overtime, night-differential and hazard pay (NIRC Sec 24(A)(2); RR 11-2018). Your SSS, PhilHealth and Pag-IBIG shares come out of that tax-free pay.',
    })
  }
  r('Monthly taxable compensation', monthlyTaxable, { rule: true })
  perPaydayRows(r, pw)
  r(monthLabel(pw) ? 'Withholding tax per month (average)' : 'Withholding tax this month', monthlyWithholding, {
    strong: true,
    sub: monthLabel(pw)
      ? 'The number of paydays in a month varies, so the amount withheld in a month varies; this is the average.'
      : `Revised withholding table effective ${RT.withholdingTablesFrom} (RR 11-2018, as amended).`,
  })
  r('Estimated monthly take-home', monthlyTakeHome, {
    strong: true,
    // Audit Nov 2026 (U12): very low pay is still charged the SSS and
    // PhilHealth minimums (the ₱5,000 salary credit and ₱10,000 income floor).
    ...(monthlyTakeHome < 0 ? { sub: 'Below zero: the SSS and PhilHealth minimum contributions are more than this pay. Check the figures with SSS and PhilHealth.' } : {}),
  })

  // Audit Nov 2026 (U4): more than one employer in the year. Each employer
  // withholds and adjusts only on its own pay, so the year's tax is computed
  // on the total from every 2316 and settled on Form 1700 (no substituted
  // filing). The other employers' figures are optional inputs.
  const multiple = Boolean(in_.multipleEmployers)
  const otherTaxableC = multiple ? Math.max(0, C(in_.otherEmployersTaxable || 0)) : 0
  const otherWithheldC = multiple ? Math.max(0, C(in_.otherEmployersWithheld || 0)) : 0

  const annualRows = []
  const a = (label, value, o = {}) => annualRows.push({ label, value, ...o })
  a('Annualized taxable compensation (×12)', P(monthlyTaxableC * 12))
  a('13th month & other benefits', bonusesAnnual)
  a(`Less: tax-exempt part (up to ${pesoText(CAP13)})`, -P(Math.min(C(bonusesAnnual), C(CAP13))))
  a(multiple ? 'Annual taxable income from this employer' : 'Annual taxable income', annualTaxable, { rule: true })
  a(multiple ? 'Income tax on this employer\'s pay alone (graduated table)' : 'Annual income tax (graduated table)', annualTax, {
    strong: !multiple,
    sub: multiple
      ? 'This employer trues up only its own pay in December (NIRC Sec 79(H)); your tax for the year is on the total below.'
      : 'Your employer trues this up in December: extra tax is withheld or over-withholding refunded (NIRC Sec 79(H)).',
  })
  a(pw.payPeriod === 'monthly' ? 'Total withheld over 12 months' : `Total withheld over the year (${pw.periodsPerYear} paydays)`, P(withheld12C))
  const diff = P(annualTaxC - withheld12C)
  if (Math.abs(diff) >= 1) {
    a(diff > 0 ? `${multiple ? 'This employer\'s y' : 'Y'}ear-end adjustment: extra withholding due` : `${multiple ? 'This employer\'s y' : 'Y'}ear-end adjustment: refund due to you`, Math.abs(diff), { strong: !multiple })
  }
  let combined = null
  if (multiple) {
    const combinedTaxableC = annualTaxableC + otherTaxableC
    const combinedTaxC = bracketTaxCentavos(BR, combinedTaxableC)
    const totalWithheldC = annualTaxC + otherWithheldC // this employer's withholding after its December adjustment, plus the others'
    const balanceC = combinedTaxC - totalWithheldC
    a('Add: taxable compensation from your other employer(s)', P(otherTaxableC), { sub: 'From the 2316 of each other employer this year.' })
    a('Total taxable compensation, all employers', P(combinedTaxableC), { rule: true })
    a('Income tax on the total (graduated table)', P(combinedTaxC), { strong: true })
    a('Less: withheld by this employer (after its December adjustment)', -P(annualTaxC))
    a('Less: withheld by your other employer(s)', -P(otherWithheldC))
    a(balanceC >= 0 ? 'Balance to pay with Form 1700' : 'Overpayment on Form 1700', P(Math.abs(balanceC)), {
      strong: true,
      rule: true,
      sub: 'With more than one employer in the year, substituted filing does not apply: file Form 1700 by April 15 with every 2316.',
    })
    combined = { taxable: P(combinedTaxableC), tax: P(combinedTaxC), withheld: P(totalWithheldC), balance: P(balanceC) }
  }

  return {
    minimumWage: P(pay.minimumWageC),
    exemptPay: P(pay.exemptC),
    payPeriod: pw.payPeriod,
    monthlyTaxable,
    perPeriodTaxable: P(pw.perPeriodTaxableC),
    perPeriodWithholding: P(pw.perPeriodWithholdingC),
    monthlyWithholding,
    withheldYear: P(withheld12C),
    monthlyTakeHome,
    deductions: ded,
    annualTaxable,
    annualTax,
    yearEndDifference: diff,
    combined,
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
