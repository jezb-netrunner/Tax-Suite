// Domestic-corporation estimator: RCIT (25% / 20% small-corp) vs 2% MCIT,
// with the 4th-year MCIT rule and a transparent breakdown.
//
// Rounding: BIR Form 1702 lines are whole pesos (49 centavos or less drop,
// 50 or more round up); each line is rounded and later lines are computed
// from the rounded ones.

import corp from '../../data/rules/corporate.json'
import businessTax from '../../data/rules/business-tax.json'
import { toCentavos, fromCentavos, toWholePesos, mulRate } from '../../lib/money.js'

const RCIT = corp.rcit.value
const MCIT = corp.mcit.value
const VAT_THRESHOLD = businessTax.vatThreshold.value
const PCT_RATE = businessTax.percentageTaxRate.value

/**
 * @param {Object} in_
 *   grossSales      annual gross sales/revenue
 *   costOfSales     direct costs → gross income = grossSales - costOfSales
 *   opex            deductible operating expenses
 *   totalAssets     total assets excluding land (for the 20% small-corp test)
 *   cwt             creditable withholding (2307s)
 *   registrationYear  year operations began (MCIT from the 4th year after)
 *   taxYear         taxable year being estimated
 *   vatRegistered
 */
export function estimateCorporation(in_) {
  const { totalAssets = 0, registrationYear = null, vatRegistered = false } = in_
  const taxYear = in_.taxYear ?? new Date().getFullYear()
  const line = pesos => toWholePesos(toCentavos(pesos || 0))
  const P = fromCentavos

  const grossSalesC = line(in_.grossSales)
  const costOfSalesC = line(in_.costOfSales)
  const opexC = line(in_.opex)
  const cwtC = line(in_.cwt)
  const grossIncomeC = Math.max(0, grossSalesC - costOfSalesC)
  const taxableIncomeC = Math.max(0, grossIncomeC - opexC)

  const grossSales = P(grossSalesC)
  const costOfSales = P(costOfSalesC)
  const opex = P(opexC)
  const cwt = P(cwtC)
  const grossIncome = P(grossIncomeC)
  const taxableIncome = P(taxableIncomeC)

  const smallCorp = taxableIncome <= RCIT.smallCorpTaxableIncomeCeiling && totalAssets <= RCIT.smallCorpAssetCeiling
  const rcitRate = smallCorp ? RCIT.smallCorpRate : RCIT.standardRate
  const rcitC = toWholePesos(mulRate(taxableIncomeC, rcitRate))

  // MCIT applies beginning the 4th taxable year immediately following the
  // year operations commenced (e.g. began 2022 → MCIT from TY 2026).
  const mcitApplies = registrationYear != null && taxYear >= registrationYear + 4
  const mcitC = mcitApplies ? toWholePesos(mulRate(grossIncomeC, MCIT.rate)) : 0
  const usesMcit = mcitApplies && mcitC > rcitC
  const incomeTaxDueC = Math.max(rcitC, mcitC)

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
  } else if (registrationYear != null) {
    r('Minimum corporate income tax', null, {
      sub: `Not yet applicable: MCIT starts in TY ${registrationYear + 4}, the 4th taxable year after operations began.`,
    })
  } else {
    r('Minimum corporate income tax', null, {
      sub: 'Set "year operations began" on the profile to check the 2% MCIT (applies from the 4th taxable year).',
    })
  }
  r('Income tax due', incomeTaxDue, { strong: true, rule: true })
  if (!vat && pct > 0) r('Percentage tax (3% of gross)', pct, { strong: true, sub: 'Non-VAT corporation under the ₱3M threshold (Form 2551Q).' })
  if (vat) r('Value-added tax', null, { sub: 'VAT (12%) is computed separately on sales less creditable input VAT.' })
  if (cwt > 0) {
    r('Less: creditable tax withheld (2307s)', -cwt)
    const net = P(incomeTaxDueC - cwtC)
    if (net >= 0) r('Income tax still payable', net, { strong: true })
    else r('Overpayment: refund or carry over', -net, { strong: true, sub: 'The carry-over election, once made on the annual return, is irrevocable (NIRC Sec 76).' })
  }

  return {
    grossIncome,
    taxableIncome,
    smallCorp,
    rcitRate,
    rcit,
    mcitApplies,
    mcit,
    usesMcit,
    incomeTaxDue,
    pct,
    vat,
    overThreshold,
    netPayable: P(incomeTaxDueC - cwtC),
    totalAnnualTax: P(incomeTaxDueC + pctC),
    rows,
    references: [...corp.rcit.legalBasis, ...corp.mcit.legalBasis],
  }
}
