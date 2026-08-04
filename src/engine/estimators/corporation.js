// Domestic-corporation estimator: RCIT (25% / 20% small-corp) vs 2% MCIT,
// with the 4th-year MCIT rule and a transparent breakdown.

import corp from '../../data/rules/corporate.json'
import businessTax from '../../data/rules/business-tax.json'

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
  const { grossSales = 0, costOfSales = 0, opex = 0, totalAssets = 0, cwt = 0,
    registrationYear = null, taxYear = new Date().getFullYear(), vatRegistered = false } = in_

  const grossIncome = Math.max(0, grossSales - costOfSales)
  const taxableIncome = Math.max(0, grossIncome - opex)

  const smallCorp = taxableIncome <= RCIT.smallCorpTaxableIncomeCeiling && totalAssets <= RCIT.smallCorpAssetCeiling
  const rcitRate = smallCorp ? RCIT.smallCorpRate : RCIT.standardRate
  const rcit = taxableIncome * rcitRate

  // MCIT applies beginning the 4th taxable year immediately following the
  // year operations commenced (e.g. began 2022 → MCIT from TY 2026).
  const mcitApplies = registrationYear != null && taxYear >= registrationYear + 4
  const mcit = mcitApplies ? grossIncome * MCIT.rate : 0
  const usesMcit = mcitApplies && mcit > rcit
  const incomeTaxDue = Math.max(rcit, mcit)

  const overThreshold = grossSales > VAT_THRESHOLD
  const vat = vatRegistered || overThreshold
  const pct = vat ? 0 : grossSales * PCT_RATE

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
      ? '20% rate — net taxable income ≤ ₱5M and total assets ≤ ₱100M excluding land (NIRC Sec 27(A), CREATE).'
      : 'Standard 25% rate (NIRC Sec 27(A), CREATE).',
  })
  if (mcitApplies) {
    r('Minimum corporate income tax @ 2% of gross income', mcit, {
      strong: usesMcit,
      sub: usesMcit
        ? 'MCIT exceeds RCIT this year — you pay the MCIT; the excess credits against RCIT for the next 3 years (NIRC Sec 27(E)).'
        : 'RCIT is higher, so the regular tax applies (NIRC Sec 27(E)).',
    })
  } else if (registrationYear != null) {
    r('Minimum corporate income tax', null, {
      sub: `Not yet applicable — MCIT starts in TY ${registrationYear + 4}, the 4th taxable year after operations began.`,
    })
  } else {
    r('Minimum corporate income tax', null, {
      sub: 'Set "year operations began" on the profile to check the 2% MCIT (applies from the 4th taxable year).',
    })
  }
  r('Income tax due', incomeTaxDue, { strong: true, rule: true })
  if (!vat && pct > 0) r('Percentage tax (3% of gross)', pct, { strong: true, sub: 'Non-VAT corporation under the ₱3M threshold — Form 2551Q.' })
  if (vat) r('Value-added tax', null, { sub: 'VAT (12%) is computed separately on sales less creditable input VAT.' })
  if (cwt > 0) {
    r('Less: creditable tax withheld (2307s)', -cwt)
    const net = incomeTaxDue - cwt
    if (net >= 0) r('Income tax still payable', net, { strong: true })
    else r('Overpayment — refund or carry over', -net, { strong: true, sub: 'The carry-over election, once made on the annual return, is irrevocable (NIRC Sec 76).' })
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
    netPayable: incomeTaxDue - cwt,
    totalAnnualTax: incomeTaxDue + pct,
    rows,
    references: [...corp.rcit.legalBasis, ...corp.mcit.legalBasis],
  }
}
