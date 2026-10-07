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
import { toCentavos, fromCentavos, toWholePesos, mulRate, mulFrac, groupThousands } from '../../lib/money.js'
import { manilaToday } from '../dates.js'
import { estimateEmployee } from './employee.js'

const BR = incomeTax.graduatedBrackets.value
const EIGHT = incomeTax.eightPercent.value
const OSD = incomeTax.osd.value
const NOLCO_YEARS = incomeTax.netOperatingLossCarryOver.value.carryOverYears
const VAT_THRESHOLD = businessTax.vatThreshold.value
const PCT_RATE = businessTax.percentageTaxRate.value
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const pesoText = c => '₱' + groupThousands(Math.round(c / 100))
// H05 (owner decision 4): VAT is never computed; every VAT-case total says so.
export const VAT_NOTE = 'Income tax and percentage tax only; VAT not included.'
// M01 (owner decision 1): the rulebook holds the current rates only.
export const RATES_NOTE = 'Earlier years used different rates (the 2018-2022 graduated table, and a 1% percentage tax from July 2020 to June 2023) and are not supported here.'
export const VAT_ROW_NOTE = 'Not included in this estimate. VAT (12% of sales less creditable input VAT) is filed quarterly on Form 2550Q.'

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
 *   crossedMonth     (non-VAT, sales over ₱3M) month 1-12 the ₱3M was passed;
 *                    empty -> the month even monthly sales would pass it
 *   salesThroughCrossMonth  optional sales from January to the end of that month
 *                    (empty -> the year's sales prorated evenly by month)
 *   eightPercentPaid (sales over ₱3M) 8% income tax already paid on 1701Q this year
 *   taxYear          taxable year (default: the current year in Manila)
 *   otherIncome      other non-operating income NOT subject to final tax (M02):
 *                    counts in the 8% ₱3M test and 8% base, added after OSD /
 *                    itemized deductions; not part of the OSD or percentage-tax base
 *   subjectToOtherPercentageTax  business subject to NIRC Secs 117-127 (no 8%)
 *   nolcoPrior       NOLCO from prior years (M04): itemized option only, and
 *                    only against business income (never compensation)
 */
export function estimateIndividual(in_) {
  const { vatRegistered = false, mixed = false } = in_
  const taxYear = in_.taxYear ?? manilaToday().getFullYear()
  // Whole-peso form lines, held in centavos (multiples of 100).
  const line = pesos => toWholePesos(toCentavos(pesos || 0))
  const P = fromCentavos

  const grossC = line(in_.gross)
  const expensesC = line(in_.expenses)
  const compC = mixed ? line(in_.compensationTaxable) : 0
  const gross = P(grossC)
  const expenses = P(expensesC)
  const compensationTaxable = P(compC)
  const otherC = line(in_.otherIncome)
  const other = P(otherC)
  const subjectToOPT = Boolean(in_.subjectToOtherPercentageTax)

  // The ₱3M test uses the actual sales (₱3,000,000.01 is over), not the rounded line.
  const salesC = toCentavos(in_.gross || 0)
  const thresholdC = toCentavos(VAT_THRESHOLD)
  const overThreshold = salesC > thresholdC
  const vat = vatRegistered || overThreshold
  // 8% ceiling (RR 8-2018): sales plus other non-operating income not over ₱3M.
  const over8Ceiling = salesC + toCentavos(in_.otherIncome || 0) > toCentavos(EIGHT.grossCeiling)
  const eligible8Reason = vatRegistered
    ? 'Not available to VAT-registered taxpayers.'
    : overThreshold ? 'Not available: sales are over ₱3,000,000.'
      : over8Ceiling ? 'Not available: sales plus other non-operating income are over ₱3,000,000.'
        : subjectToOPT ? 'Not available: the business is subject to other percentage taxes (NIRC Secs 117-127).'
          : null
  const eligible8 = eligible8Reason === null

  // H04 (RR 8-2018, owner decision 6): a non-VAT taxpayer whose sales pass ₱3M
  // during the year. The whole year is on graduated rates, the 3% percentage
  // tax applies to sales from January to the end of the month the ₱3M was
  // passed, and VAT applies from the following month (not computed here).
  let crossing = null
  let ptBaseC = grossC
  if (!vatRegistered && overThreshold) {
    const given = Number(in_.crossedMonth)
    const validMonth = Number.isInteger(given) && given >= 1 && given <= 12
    // Even monthly sales pass ₱3M in the first month m with sales × m / 12 > ₱3M.
    const evenMonth = Math.min(12, Math.floor((12 * thresholdC) / salesC) + 1)
    const month = validMonth ? given : evenMonth
    const span = month === 1 ? 'January' : `January to ${MONTHS[month - 1]}`
    const warnings = []
    const enteredC = line(in_.salesThroughCrossMonth)
    if (enteredC > 0) {
      ptBaseC = enteredC
      if (enteredC > grossC) {
        ptBaseC = grossC
        warnings.push(`Sales from ${span} can't be more than the year's gross sales (${pesoText(grossC)}); ${pesoText(grossC)} is used.`)
      } else if (enteredC <= thresholdC) {
        warnings.push(`Sales from ${span} should be more than ₱3,000,000, since that is the month the threshold was passed.`)
      }
    } else {
      ptBaseC = toWholePesos(mulFrac(grossC, month, 12))
    }
    crossing = {
      month,
      monthName: MONTHS[month - 1],
      span,
      assumedEvenSales: !validMonth,
      evenMonth,
      ptBase: P(ptBaseC),
      ptBaseProrated: !(enteredC > 0),
      vatFrom: month === 12 ? `January ${taxYear + 1}` : `${MONTHS[month]} ${taxYear}`,
      warnings,
    }
  }

  const gradLine = taxableC => toWholePesos(bracketTaxCentavos(BR, taxableC))

  // Compensation side (mixed): always graduated. The ₱250k zero band lives here.
  const compTaxC = mixed ? gradLine(compC) : 0

  // Business-side income tax per regime.
  const allowance8 = mixed ? EIGHT.allowanceForMixedIncome : EIGHT.allowanceForPureSelfEmployed
  const base8C = Math.max(0, grossC + otherC - toCentavos(allowance8))
  const tax8C = toWholePesos(mulRate(base8C, EIGHT.rate))

  const pctC = vatRegistered ? 0
    : toWholePesos(mulRate(ptBaseC, PCT_RATE))

  const osdDeductionC = toWholePesos(mulRate(grossC, OSD.rate))
  const osdNetC = grossC - osdDeductionC
  // Itemized (M04): a loss is shown and becomes NOLCO; NOLCO from prior years
  // reduces business income only (not compensation, not other income).
  const businessNetC = grossC - expensesC
  const netLossC = Math.max(0, -businessNetC)
  const nolcoPriorC = line(in_.nolcoPrior)
  const nolcoAppliedC = Math.min(nolcoPriorC, Math.max(0, businessNetC))
  const nolcoLeftC = nolcoPriorC - nolcoAppliedC
  const itemNetC = Math.max(0, businessNetC) - nolcoAppliedC

  // Mixed graduated: compensation and business net are AGGREGATED into one
  // graduated computation (single taxable income). Other non-operating income
  // is added after the deductions (compC is 0 for the purely self-employed).
  function gradIncomeTaxOn(businessNetC) {
    return gradLine(compC + Math.max(0, businessNetC) + otherC)
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
  // H04: 8% payments made before the ₱3M was passed are credited in full.
  const eightPaidC = crossing ? line(in_.eightPercentPaid) : 0
  const creditItems = [
    { label: 'Less: tax withheld by clients (2307s)', c: cwtC },
    { label: 'Less: tax withheld by employer', c: compWithheldC },
    { label: 'Less: 8% income tax already paid on 1701Q this year', c: eightPaidC },
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
  const withOther = otherC > 0
  const taxable8 = mixed
    ? [
        { label: 'Taxable compensation (graduated rates)', value: compensationTaxable },
        { label: `Business income taxed at 8% (gross sales${withOther ? ' and other income' : ''})`, value: base8 },
      ]
    : [{ label: `Taxable base (gross sales${withOther ? ' and other income' : ''} less ₱250,000)`, value: base8 }]
  const taxableOsd = [{
    label: mixed
      ? `Taxable income (compensation + business after the 40% OSD${withOther ? ' + other income' : ''})`
      : `Taxable income (after the 40% OSD${withOther ? ', plus other income' : ''})`,
    value: P(compC + osdNetC + otherC),
  }]
  const taxableItem = [{
    label: mixed
      ? `Taxable income (compensation + business after itemized deductions${withOther ? ' + other income' : ''})`
      : `Taxable income (after itemized deductions${withOther ? ', plus other income' : ''})`,
    value: P(compC + itemNetC + otherC),
  }]

  // Business tax under the graduated options: VAT all year when registered;
  // percentage tax (part of the year, then VAT) when the ₱3M is crossed.
  const gradBusinessTax = vatRegistered ? { kind: 'vat', amount: null }
    : crossing ? { kind: 'pct', amount: pct, vatFrom: crossing.vatFrom }
      : { kind: 'pct', amount: pct }
  const businessForms = vatRegistered ? ' + 2550Q' : crossing ? ' + 2551Q + 2550Q' : ' + 2551Q'
  // VAT applies for all (registered) or part (crossing ₱3M) of the year.
  const vatNotIncluded = vatRegistered || crossing != null
  const businessBasis = vatRegistered ? ['NIRC Sec 106/108'] : crossing ? ['NIRC Sec 116', 'NIRC Sec 106/108'] : ['NIRC Sec 116']

  const options = [
    {
      key: '8pct',
      name: mixed ? '8% on business income' : '8% flat tax',
      eligible: eligible8,
      reason: eligible8Reason,
      incomeTax: inc8,
      businessTax: { kind: 'none', amount: 0 },
      vatNotIncluded: false,
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
      businessTax: gradBusinessTax,
      vatNotIncluded,
      total: P(incOsdC + pctC),
      forms: (mixed ? '1701Q + 1701' : '1701Q + 1701A') + businessForms,
      returnForm: mixed ? '1701' : '1701A',
      taxable: taxableOsd,
      basis: ['NIRC Sec 24(A)(2)(a); Sec 34(L)', ...businessBasis],
    },
    {
      key: 'itemized',
      name: 'Graduated + itemized',
      eligible: true,
      incomeTax: incItem,
      businessTax: gradBusinessTax,
      vatNotIncluded,
      total: P(incItemC + pctC),
      forms: '1701Q + 1701' + businessForms,
      returnForm: '1701',
      taxable: taxableItem,
      basis: ['NIRC Sec 24(A)(2)(a); Sec 34(A)', ...businessBasis],
    },
  ]

  const eligibleOptions = options.filter(o => o.eligible)
  const best = eligibleOptions.reduce((a, b) => (b.total < a.total ? b : a), eligibleOptions[0])
  const runnersUp = eligibleOptions.filter(o => o !== best).map(o => o.total).sort((a, b) => a - b)
  // Option totals are whole pesos, so these differences are exact.
  const diff = (a, b) => P(toCentavos(a) - toCentavos(b))

  // L01: options that cost the same as the cheapest (whole pesos) tie. The
  // first in list order stays `best` for the breakdown; the tie is explained
  // by the non-tax differences instead of a "saving ₱0".
  const tied = eligibleOptions.filter(o => toCentavos(o.total) === toCentavos(best.total))
  const tie = tied.length > 1 ? tied.map(o => o.key) : null
  let tieNote = null
  if (tie) {
    const names = tied.map(o => o.name)
    const list = names.length === 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
    const why = []
    if (tie.includes('8pct')) why.push('With 8% you file no quarterly percentage tax returns (2551Q).')
    if (tie.includes('osd') && tie.includes('itemized')) why.push('OSD needs no proof of expenses; itemized deductions must be backed by receipts and books.')
    tieNote = `${list} tie for the lowest tax at ${pesoText(toCentavos(best.total))}. ${why.join(' ')}`
  }

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

  // NOLCO (NIRC Sec 34(D)(3); RR 14-2001; RR 16-2008): usable in the next
  // 3 years when itemizing; not on OSD or 8%, and those years still count.
  const nolco = {
    createdAmount: P(netLossC),
    usableFrom: taxYear + 1,
    usableTo: taxYear + NOLCO_YEARS,
    priorEntered: P(nolcoPriorC),
    applied: P(nolcoAppliedC),
    left: P(nolcoLeftC),
    note: netLossC > 0
      ? `Net loss ${pesoText(netLossC)}. This net operating loss (NOLCO) can be deducted from business income in the next ` +
        `${NOLCO_YEARS} years (${taxYear + 1} to ${taxYear + NOLCO_YEARS}), but only in years you itemize deductions. ` +
        `It cannot be used while on OSD or the 8% option, and those years still count toward the ${NOLCO_YEARS}.` +
        (mixed ? ' A business loss does not reduce taxable compensation.' : '')
      : null,
    shortNote: netLossC > 0
      ? `Becomes NOLCO: deductible from business income in ${taxYear + 1} to ${taxYear + NOLCO_YEARS}, in years you itemize.`
      : null,
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
        if (withOther) r('Plus: other non-operating income', other)
        r('Income tax on business @ 8% of gross', tax8, { strong: true, sub: 'Mixed-income earners get no ₱250,000 reduction on the business side; it is built into the compensation computation.' })
      }
    }
    if (!mixed || opt.key !== '8pct') {
      r('Gross sales / receipts', gross)
    }
    if (opt.key === '8pct' && !mixed) {
      if (withOther) r('Plus: other non-operating income', other)
      r('Less: ₱250,000 annual allowance', -allowance8)
      r('Taxable base', base8, { rule: true })
      r('Income tax @ 8%', tax8, { strong: true, sub: 'In lieu of graduated rates and the 3% percentage tax.' })
    }
    if (opt.key === 'osd') {
      r('Less: Optional Standard Deduction (40% of gross)', -osdDeduction)
      r('Net taxable business income', osdNet, { rule: true })
      if (withOther) r('Plus: other non-operating income', other)
      if (mixed) r('Plus: taxable compensation', compensationTaxable)
      r('Graduated income tax', incOsd, { strong: true })
    }
    if (opt.key === 'itemized') {
      r('Less: itemized expenses', -expenses)
      if (netLossC > 0) {
        r('Net loss', P(netLossC), { rule: true, sub: nolco.shortNote })
      } else if (nolcoAppliedC > 0) {
        r('Net business income', P(businessNetC), { rule: true })
        r('Less: NOLCO from prior years', -P(nolcoAppliedC), nolcoLeftC > 0
          ? { sub: `${pesoText(nolcoLeftC)} of NOLCO is left for later years, within its ${NOLCO_YEARS}-year limit.` }
          : {})
      }
      r('Net taxable business income', itemNet, { rule: netLossC === 0 && nolcoAppliedC === 0 })
      if (withOther) r('Plus: other non-operating income', other)
      if (mixed) r('Plus: taxable compensation', compensationTaxable)
      r('Graduated income tax', incItem, { strong: true })
    }
    if (opt.businessTax.kind === 'pct' && crossing) {
      r(`Percentage tax (3% of sales ${crossing.span})`, opt.businessTax.amount, {
        strong: true,
        sub: `NIRC Sec 116. Paid quarterly on Form 2551Q, not with the annual return. Sales from ${crossing.span}: ${pesoText(ptBaseC)}` +
          (crossing.ptBaseProrated ? ' (the year\'s sales spread evenly by month).' : '.'),
      })
      r('Value-added tax', null, { sub: `VAT applies from ${crossing.vatFrom}: not included in this estimate.` })
    } else if (opt.businessTax.kind === 'pct') {
      r(`Percentage tax (3% of gross)`, opt.businessTax.amount, { strong: true, sub: 'NIRC Sec 116. Percentage tax: paid quarterly on Form 2551Q, not with the annual return.' })
    }
    if (opt.businessTax.kind === 'vat') {
      r('Value-added tax', null, { sub: VAT_ROW_NOTE })
    }
    r('Total annual tax', opt.total, { strong: true, rule: true, ...(opt.vatNotIncluded ? { sub: VAT_NOTE } : {}) })
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
    taxYear,
    ratesLabel: `Rates for taxable year ${taxYear}`,
    ratesNote: RATES_NOTE,
    vat,
    vatRegistered,
    overThreshold,
    crossing,
    vatNotIncluded,
    vatNote: vatNotIncluded ? VAT_NOTE : null,
    netLoss: P(netLossC),
    nolco,
    options,
    best,
    savingsVsNext: runnersUp.length ? diff(runnersUp[0], best.total) : null,
    tie,
    tieNote,
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

/**
 * M05: where a mixed-income earner's compensation figures come from.
 * The Compensation side tab (employee estimator inputs) wins when its monthly
 * salary is filled: annual taxable compensation and the annual tax, which the
 * employer withholds by December after the year-end adjustment. Otherwise the
 * Mixed tab's own boxes are used. `differs` flags own boxes that are filled
 * and disagree with the Compensation side tab.
 *
 * @param {Object} own        Mixed tab inputs { compensationTaxable, compensationWithheld } (blank = null)
 * @param {Object} employee   Compensation side tab inputs, or null
 */
export function compensationForMixed(own = {}, employee = null) {
  const filled = x => x !== null && x !== undefined && x !== '' && Number.isFinite(Number(x))
  const ownTaxable = filled(own.compensationTaxable) ? Number(own.compensationTaxable) : null
  const ownWithheld = filled(own.compensationWithheld) ? Number(own.compensationWithheld) : null
  if (employee && Number(employee.monthlyBasic) > 0) {
    const e = estimateEmployee(employee)
    // Compared as whole-peso return lines, the way the figures are shown and used.
    const differ = (a, b) => a !== null && toWholePesos(toCentavos(a)) !== toWholePesos(toCentavos(b))
    return {
      source: 'compensationTab',
      taxable: e.annualTaxable,
      withheld: e.annualTax,
      ownTaxable,
      ownWithheld,
      differs: differ(ownTaxable, e.annualTaxable) || differ(ownWithheld, e.annualTax),
    }
  }
  return {
    source: ownTaxable !== null || ownWithheld !== null ? 'own' : 'none',
    taxable: ownTaxable ?? 0,
    withheld: ownWithheld ?? 0,
    ownTaxable,
    ownWithheld,
    differs: false,
  }
}
