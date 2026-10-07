// Individual business-income estimator: 8% vs graduated+OSD vs graduated+itemized,
// for pure self-employed/professionals and for the business side of mixed-income
// earners. Returns option cards plus transparent breakdown rows, every figure
// traceable to the data layer.
//
// Rounding (BIR Forms 1701/1701A/1701Q: "DO NOT enter centavos; 49 centavos or
// less drop down; 50 or more round up"): every return figure is computed in
// whole centavos and rounded to whole pesos per form line, and totals are added
// from the rounded lines, so a card's parts always add up to its total.

import incomeTax from '../../data/rules/income-tax.json'
import businessTax from '../../data/rules/business-tax.json'
import { bracketTax, bracketTaxCentavos } from '../tax.js'
import { toCentavos, fromCentavos, toWholePesos, mulRate } from '../../lib/money.js'

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
 *   quarterlyPaid    income tax already paid on this year's 1701Q returns
 *   priorYearCredits excess credits carried over from last year's annual return
 */
export function estimateIndividual(in_) {
  const { vatRegistered = false, mixed = false } = in_
  // Whole-peso form lines, held in centavos (multiples of 100).
  const line = pesos => toWholePesos(toCentavos(pesos || 0))
  const P = fromCentavos

  const grossC = line(in_.gross)
  const expensesC = line(in_.expenses)
  const compC = mixed ? line(in_.compensationTaxable) : 0
  const gross = P(grossC)
  const expenses = P(expensesC)
  const compensationTaxable = P(compC)

  // The ₱3M test uses the actual sales (₱3,000,000.01 is over), not the rounded line.
  const overThreshold = toCentavos(in_.gross || 0) > toCentavos(VAT_THRESHOLD)
  const vat = vatRegistered || overThreshold
  const eligible8 = !vat

  const gradLine = taxableC => toWholePesos(bracketTaxCentavos(BR, taxableC))

  // Compensation side (mixed): always graduated. The ₱250k zero band lives here.
  const compTaxC = mixed ? gradLine(compC) : 0

  // Business-side income tax per regime.
  const allowance8 = mixed ? EIGHT.allowanceForMixedIncome : EIGHT.allowanceForPureSelfEmployed
  const base8C = Math.max(0, grossC - toCentavos(allowance8))
  const tax8C = toWholePesos(mulRate(base8C, EIGHT.rate))

  const pctC = vat ? 0 : toWholePesos(mulRate(grossC, PCT_RATE))

  const osdDeductionC = toWholePesos(mulRate(grossC, OSD.rate))
  const osdNetC = grossC - osdDeductionC
  const itemNetC = Math.max(0, grossC - expensesC)

  // Mixed graduated: compensation and business net are AGGREGATED into one
  // graduated computation (single taxable income). Pure SE: business net alone.
  function gradIncomeTaxOn(businessNetC) {
    if (!mixed) return gradLine(businessNetC)
    return gradLine(compC + Math.max(0, businessNetC))
  }
  // For mixed 8%: compensation stays graduated; business is flat 8% on gross.
  const inc8C = mixed ? compTaxC + tax8C : tax8C
  const incOsdC = gradIncomeTaxOn(osdNetC)
  const incItemC = gradIncomeTaxOn(itemNetC)

  // Income-tax credits (C02): only these reduce the annual return (1701/1701A).
  // Percentage tax is paid quarterly on Form 2551Q and never netted against them.
  const cwtC = line(in_.cwt)
  const compWithheldC = mixed ? line(in_.compensationWithheld) : 0
  // H06: what was already paid this year on the quarterly 1701Q returns, and
  // excess credits carried over from last year's annual return. The quarterly
  // amounts are entered by the user; this estimator does not compute them.
  const quarterlyPaidC = line(in_.quarterlyPaid)
  const priorYearCreditsC = line(in_.priorYearCredits)
  const creditItems = [
    { label: 'Less: tax withheld by clients (2307s)', c: cwtC },
    { label: 'Less: tax withheld by employer', c: compWithheldC },
    { label: 'Less: income tax paid on this year\'s quarterly returns (1701Q)', c: quarterlyPaidC },
    { label: 'Less: excess credits carried over from last year', c: priorYearCreditsC },
  ].filter(x => x.c > 0)
  const creditsC = creditItems.reduce((t, x) => t + x.c, 0)
  const creditLines = creditItems.map(x => ({ label: x.label, value: P(x.c) }))

  const compTax = P(compTaxC)
  const base8 = P(base8C)
  const tax8 = P(tax8C)
  const pct = P(pctC)
  const osdDeduction = P(osdDeductionC)
  const osdNet = P(osdNetC)
  const itemNet = P(itemNetC)
  const inc8 = P(inc8C)
  const incOsd = P(incOsdC)
  const incItem = P(incItemC)
  const credits = P(creditsC)

  // Taxable-income lines as they appear on the annual return.
  const taxable8 = mixed
    ? [
        { label: 'Taxable compensation (graduated rates)', value: compensationTaxable },
        { label: 'Business income taxed at 8% (gross sales)', value: base8 },
      ]
    : [{ label: 'Taxable base (gross sales less ₱250,000)', value: base8 }]
  const taxableOsd = [{
    label: mixed ? 'Taxable income (compensation + business after the 40% OSD)' : 'Taxable income (after the 40% OSD)',
    value: P(compC + osdNetC),
  }]
  const taxableItem = [{
    label: mixed ? 'Taxable income (compensation + business after itemized deductions)' : 'Taxable income (after itemized deductions)',
    value: P(compC + itemNetC),
  }]

  const options = [
    {
      key: '8pct',
      name: mixed ? '8% on business income' : '8% flat tax',
      eligible: eligible8,
      incomeTax: inc8,
      businessTax: { kind: 'none', amount: 0 },
      total: inc8,
      forms: mixed ? '1701Q + 1701' : '1701Q + 1701A',
      returnForm: mixed ? '1701' : '1701A',
      taxable: taxable8,
      basis: ['NIRC Sec 24(A)(2)(b); RR 8-2018'],
    },
    {
      key: 'osd',
      name: 'Graduated + OSD (40%)',
      eligible: true,
      incomeTax: incOsd,
      businessTax: vat ? { kind: 'vat', amount: null } : { kind: 'pct', amount: pct },
      total: P(incOsdC + (vat ? 0 : pctC)),
      forms: (mixed ? '1701Q + 1701' : '1701Q + 1701A') + (vat ? ' + 2550Q' : ' + 2551Q'),
      returnForm: mixed ? '1701' : '1701A',
      taxable: taxableOsd,
      basis: ['NIRC Sec 24(A)(2)(a); Sec 34(L)', vat ? 'NIRC Sec 106/108' : 'NIRC Sec 116'],
    },
    {
      key: 'itemized',
      name: 'Graduated + itemized',
      eligible: true,
      incomeTax: incItem,
      businessTax: vat ? { kind: 'vat', amount: null } : { kind: 'pct', amount: pct },
      total: P(incItemC + (vat ? 0 : pctC)),
      forms: '1701Q + 1701' + (vat ? ' + 2550Q' : ' + 2551Q'),
      returnForm: '1701',
      taxable: taxableItem,
      basis: ['NIRC Sec 24(A)(2)(a); Sec 34(A)', vat ? 'NIRC Sec 106/108' : 'NIRC Sec 116'],
    },
  ]

  const eligibleOptions = options.filter(o => o.eligible)
  const best = eligibleOptions.reduce((a, b) => (b.total < a.total ? b : a), eligibleOptions[0])
  const runnersUp = eligibleOptions.filter(o => o !== best).map(o => o.total).sort((a, b) => a - b)
  // Option totals are whole pesos, so these differences are exact.
  const diff = (a, b) => P(toCentavos(a) - toCentavos(b))

  // What goes on the annual income tax return (1701 / 1701A) for an option:
  // income tax due less income-tax credits. Percentage tax is reported
  // alongside for information only; it is paid on the quarterly 2551Q.
  function annualReturnFor(opt) {
    const percentageTax = opt.businessTax.kind === 'pct' ? opt.businessTax.amount : 0
    return {
      form: opt.returnForm,
      taxable: opt.taxable,
      incomeTaxDue: opt.incomeTax,
      creditLines,
      credits,
      netPayable: diff(opt.incomeTax, credits),
      percentageTax,
    }
  }

  // Transparent breakdown for the chosen option.
  function rowsFor(opt) {
    const rows = []
    const r = (label, value, o = {}) => rows.push({ label, value, ...o })
    if (mixed) {
      r('Taxable compensation (annual)', compensationTaxable)
      if (opt.key === '8pct') {
        r('Income tax on compensation (graduated)', compTax, { strong: true })
        r('Business gross sales / receipts', gross)
        r('Income tax on business @ 8% of gross', tax8, { strong: true, sub: 'Mixed-income earners get no ₱250,000 reduction on the business side; it is built into the compensation computation.' })
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
      r(`Percentage tax (3% of gross)`, opt.businessTax.amount, { strong: true, sub: 'NIRC Sec 116. Percentage tax: paid quarterly on Form 2551Q, not with the annual return.' })
    }
    if (opt.businessTax.kind === 'vat') {
      r('Value-added tax', null, { sub: 'VAT (12%) is computed separately on sales less creditable input VAT; see the VAT panel.' })
    }
    r('Total annual tax', opt.total, { strong: true, rule: true })
    const ar = annualReturnFor(opt)
    if (ar.credits > 0 || ar.percentageTax > 0) {
      r(`Income tax due on the annual return (${ar.form})`, ar.incomeTaxDue, { rule: true })
      for (const c of ar.creditLines) r(c.label, -c.value)
      if (ar.netPayable >= 0) r('Income tax payable with the annual return', ar.netPayable, { strong: true })
      else r('Overpayment: refund or carry over', -ar.netPayable, { strong: true, sub: 'Excess credits can be refunded or carried forward to next year\'s returns.' })
    }
    return rows
  }

  const annualReturn = annualReturnFor(best)
  return {
    vat,
    overThreshold,
    options,
    best,
    savingsVsNext: runnersUp.length ? diff(runnersUp[0], best.total) : null,
    rows: rowsFor(best),
    rowsFor,
    annualReturn,
    annualReturnFor,
    credits,
    creditLines,
    // Annual return (1701/1701A): income tax due less income-tax credits.
    // Negative = overpayment.
    netPayable: annualReturn.netPayable,
    // Paid quarterly on 2551Q, separately from the annual return.
    percentageTax: annualReturn.percentageTax,
    references: [
      ...incomeTax.graduatedBrackets.legalBasis,
      ...incomeTax.eightPercent.legalBasis,
      ...businessTax.percentageTaxRate.legalBasis,
    ],
  }
}
