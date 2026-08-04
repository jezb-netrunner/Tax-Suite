// Individual business-income estimator: 8% vs graduated+OSD vs graduated+itemized,
// for pure self-employed/professionals and for the business side of mixed-income
// earners. Returns option cards plus transparent breakdown rows, every figure
// traceable to the data layer.

import incomeTax from '../../data/rules/income-tax.json'
import businessTax from '../../data/rules/business-tax.json'
import { bracketTax } from '../tax.js'

const BR = incomeTax.graduatedBrackets.value
const EIGHT = incomeTax.eightPercent.value
const OSD = incomeTax.osd.value
const VAT_THRESHOLD = businessTax.vatThreshold.value
const PCT_RATE = businessTax.percentageTaxRate.value

export function gradTax(taxable) {
  return bracketTax(BR, taxable)
}

/**
 * @param {Object} in_
 *   gross            annual gross sales/receipts (business/practice)
 *   expenses         itemized deductible expenses
 *   cwt              creditable withholding (2307s)
 *   vatRegistered    VAT registration removes 8% and percentage tax
 *   mixed            true → business side of a mixed-income earner
 *   compensationTaxable  (mixed only) annual TAXABLE compensation — after
 *                        mandatory contributions and non-taxable benefits
 *   compensationWithheld (mixed only) tax already withheld by the employer
 */
export function estimateIndividual(in_) {
  const { gross = 0, expenses = 0, cwt = 0, vatRegistered = false, mixed = false,
    compensationTaxable = 0, compensationWithheld = 0 } = in_

  const overThreshold = gross > VAT_THRESHOLD
  const vat = vatRegistered || overThreshold
  const eligible8 = !vat

  // Compensation side (mixed): always graduated. The ₱250k zero band lives here.
  const compTax = mixed ? gradTax(compensationTaxable) : 0

  // Business-side income tax per regime.
  const allowance8 = mixed ? EIGHT.allowanceForMixedIncome : EIGHT.allowanceForPureSelfEmployed
  const base8 = Math.max(0, gross - allowance8)
  const tax8 = base8 * EIGHT.rate

  const pct = vat ? 0 : gross * PCT_RATE

  const osdDeduction = gross * OSD.rate
  const osdNet = gross - osdDeduction
  const itemNet = Math.max(0, gross - expenses)

  // Mixed graduated: compensation and business net are AGGREGATED into one
  // graduated computation (single taxable income). Pure SE: business net alone.
  function gradIncomeTaxOn(businessNet) {
    if (!mixed) return gradTax(businessNet)
    return gradTax(compensationTaxable + Math.max(0, businessNet))
  }
  // For mixed 8%: compensation stays graduated; business is flat 8% on gross.
  const inc8 = mixed ? compTax + tax8 : tax8
  const incOsd = gradIncomeTaxOn(osdNet)
  const incItem = gradIncomeTaxOn(itemNet)

  const credits = cwt + (mixed ? compensationWithheld : 0)

  const options = [
    {
      key: '8pct',
      name: mixed ? '8% on business income' : '8% flat tax',
      eligible: eligible8,
      incomeTax: inc8,
      businessTax: { kind: 'none', amount: 0 },
      total: inc8,
      forms: mixed ? '1701Q + 1701' : '1701Q + 1701A',
      basis: ['NIRC Sec 24(A)(2)(b); RR 8-2018'],
    },
    {
      key: 'osd',
      name: 'Graduated + OSD (40%)',
      eligible: true,
      incomeTax: incOsd,
      businessTax: vat ? { kind: 'vat', amount: null } : { kind: 'pct', amount: pct },
      total: incOsd + (vat ? 0 : pct),
      forms: (mixed ? '1701Q + 1701' : '1701Q + 1701A') + (vat ? ' + 2550Q' : ' + 2551Q'),
      basis: ['NIRC Sec 24(A)(2)(a); Sec 34(L)', vat ? 'NIRC Sec 106/108' : 'NIRC Sec 116'],
    },
    {
      key: 'itemized',
      name: 'Graduated + itemized',
      eligible: true,
      incomeTax: incItem,
      businessTax: vat ? { kind: 'vat', amount: null } : { kind: 'pct', amount: pct },
      total: incItem + (vat ? 0 : pct),
      forms: '1701Q + 1701' + (vat ? ' + 2550Q' : ' + 2551Q'),
      basis: ['NIRC Sec 24(A)(2)(a); Sec 34(A)', vat ? 'NIRC Sec 106/108' : 'NIRC Sec 116'],
    },
  ]

  const eligibleOptions = options.filter(o => o.eligible)
  const best = eligibleOptions.reduce((a, b) => (b.total < a.total ? b : a), eligibleOptions[0])
  const runnersUp = eligibleOptions.filter(o => o !== best).map(o => o.total).sort((a, b) => a - b)

  // Transparent breakdown for the chosen option.
  function rowsFor(opt) {
    const rows = []
    const r = (label, value, o = {}) => rows.push({ label, value, ...o })
    if (mixed) {
      r('Taxable compensation (annual)', compensationTaxable)
      if (opt.key === '8pct') {
        r('Income tax on compensation — graduated', compTax, { strong: true })
        r('Business gross sales / receipts', gross)
        r('Income tax on business @ 8% of gross', tax8, { strong: true, sub: 'Mixed-income earners get no ₱250,000 reduction on the business side — it is built into the compensation computation.' })
      }
    }
    if (!mixed || opt.key !== '8pct') {
      r('Gross sales / receipts', gross)
    }
    if (opt.key === '8pct' && !mixed) {
      r('Less: ₱250,000 annual allowance', -allowance8)
      r('Taxable base', base8, { rule: true })
      r('Income tax @ 8%', tax8, { strong: true, sub: 'In lieu of graduated rates and the 3% percentage tax.' })
    }
    if (opt.key === 'osd') {
      r('Less: Optional Standard Deduction (40% of gross)', -osdDeduction)
      r('Net taxable business income', osdNet, { rule: true })
      if (mixed) r('Plus: taxable compensation', compensationTaxable)
      r('Graduated income tax', incOsd, { strong: true })
    }
    if (opt.key === 'itemized') {
      r('Less: itemized expenses', -expenses)
      r('Net taxable business income', itemNet, { rule: true })
      if (mixed) r('Plus: taxable compensation', compensationTaxable)
      r('Graduated income tax', incItem, { strong: true })
    }
    if (opt.businessTax.kind === 'pct') {
      r(`Percentage tax (3% of gross)`, opt.businessTax.amount, { strong: true, sub: 'NIRC Sec 116 — filed quarterly on Form 2551Q.' })
    }
    if (opt.businessTax.kind === 'vat') {
      r('Value-added tax', null, { sub: 'VAT (12%) is computed separately on sales less creditable input VAT — see the VAT panel.' })
    }
    r('Total annual tax', opt.total, { strong: true, rule: true })
    if (credits > 0) {
      r('Less: creditable tax withheld' + (mixed ? ' (2307s + employer withholding)' : ' (2307s)'), -credits)
      const net = opt.total - credits
      if (net >= 0) r('Tax still payable', net, { strong: true })
      else r('Overpayment — refund or carry over', -net, { strong: true, sub: 'Excess credits can be refunded or carried forward to next year\'s returns.' })
    }
    return rows
  }

  return {
    vat,
    overThreshold,
    options,
    best,
    savingsVsNext: runnersUp.length ? runnersUp[0] - best.total : null,
    rows: rowsFor(best),
    rowsFor,
    credits,
    netPayable: best.total - credits,
    references: [
      ...incomeTax.graduatedBrackets.legalBasis,
      ...incomeTax.eightPercent.legalBasis,
      ...businessTax.percentageTaxRate.legalBasis,
    ],
  }
}
