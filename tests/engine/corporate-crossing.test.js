import { describe, it, expect } from 'vitest'
import { estimateCorporation } from '../../src/engine/estimators/corporation.js'
import { crossingMonthOptions } from '../../src/engine/estimators/crossing.js'

// H04 (owner decision 6; NIRC Secs 116 and 236(G); RR 8-2018 / RMO 23-2018):
// a non-VAT CORPORATION whose sales pass ₱3,000,000 during the taxable year
// keeps the 3% percentage tax on its sales from the start of the year to the
// end of the month the ₱3M was passed (entered, or the year's sales spread
// evenly by month); VAT applies from the following month and is not computed.
// The same crossing logic as the individual estimator (shared helper).
// Expected values: exact oracle phase4/gap-fixes/py/h04.py (see tdd.md).

const row = (rows, re) => rows.find(x => re.test(x.label))
const W16 = { grossSales: 3200000, costOfSales: 1000000, opex: 1000000, totalAssets: 1000000, registrationYear: 2015, taxYear: 2026 }

describe('TB:W16 (corporate) non-VAT corporation at ₱3,200,000 sales', () => {
  it('month not given: even sales pass ₱3M in December, so 3% × ₱3,200,000 = ₱96,000 (was ₱0)', () => {
    const r = estimateCorporation(W16)
    expect(r.crossing.month).toBe(12)
    expect(r.crossing.assumedEvenSales).toBe(true)
    expect(r.crossing.ptBase).toBe(3200000)
    expect(r.crossing.ptBaseProrated).toBe(true)
    expect(r.crossing.vatFrom).toBe('January 2027')
    expect(r.pct).toBe(96000)
    expect(r.incomeTaxDue).toBe(240000)
  })
  it('crossed in October: 3,200,000 × 10/12 = ₱2,666,667, so percentage tax ₱80,000; VAT from November 2026', () => {
    const r = estimateCorporation({ ...W16, crossedMonth: 10 })
    expect(r.crossing.assumedEvenSales).toBe(false)
    expect(r.crossing.span).toBe('January to October')
    expect(r.crossing.ptBase).toBe(2666667)
    expect(r.pct).toBe(80000)
    expect(r.crossing.vatFrom).toBe('November 2026')
  })
  it('crossed in October with ₱3,050,000 of sales January to October entered: ₱91,500', () => {
    const r = estimateCorporation({ ...W16, crossedMonth: 10, salesThroughCrossMonth: 3050000 })
    expect(r.crossing.ptBase).toBe(3050000)
    expect(r.crossing.ptBaseProrated).toBe(false)
    expect(r.pct).toBe(91500)
  })
  it('breakdown: a percentage-tax row for the months before VAT, and VAT from the next month not included', () => {
    const r = estimateCorporation({ ...W16, crossedMonth: 10 })
    const pt = row(r.rows, /^Percentage tax/)
    expect(pt.label).toBe('Percentage tax (3% of sales January to October)')
    expect(pt.value).toBe(80000)
    expect(pt.sub).toBe('NIRC Sec 116. Paid quarterly on Form 2551Q, not with the annual return. Sales from January to October: ₱2,666,667 (the year\'s sales spread evenly by month).')
    expect(row(r.rows, /^Value-added tax/).sub).toBe('VAT applies from November 2026: not included in this estimate.')
  })
  it('banner text names the percentage tax and the VAT start (no "percentage tax" claim with ₱0)', () => {
    expect(estimateCorporation(W16).businessTaxNote)
      .toBe('Plus ₱96,000 percentage tax on sales from January to December (Form 2551Q). VAT applies from January 2027: not included in this estimate.')
    expect(estimateCorporation({ ...W16, crossedMonth: 10 }).businessTaxNote)
      .toBe('Plus ₱80,000 percentage tax on sales from January to October (Form 2551Q). VAT applies from November 2026: not included in this estimate.')
  })
  it('sales entered for the months are checked like the individual estimator', () => {
    const r = estimateCorporation({ ...W16, crossedMonth: 11, salesThroughCrossMonth: 3500000 })
    expect(r.crossing.ptBase).toBe(3200000)
    expect(r.crossing.warnings).toEqual(['Sales from January to November can\'t be more than the year\'s gross sales (₱3,200,000); ₱3,200,000 is used.'])
  })
})

describe('corporate crossing: other cases', () => {
  it('₱10,000,000 non-VAT, month not given: even sales cross in April, ₱3,333,333 × 3% = ₱100,000', () => {
    const r = estimateCorporation({ grossSales: 10000000, costOfSales: 4000000, opex: 3000000, totalAssets: 50000000, taxYear: 2026 })
    expect(r.crossing.month).toBe(4)
    expect(r.crossing.ptBase).toBe(3333333)
    expect(r.pct).toBe(100000)
    expect(r.crossing.vatFrom).toBe('May 2026')
  })
  it('fiscal year ending June 2027, ₱3,600,000: crosses in May (11th month), July to May = ₱3,300,000, PT ₱99,000, VAT from June 2027', () => {
    const r = estimateCorporation({ grossSales: 3600000, costOfSales: 1000000, opex: 1000000, totalAssets: 1000000, taxYear: 2027, fiscalYearEndMonth: 6 })
    expect(r.crossing.month).toBe(5)
    expect(r.crossing.span).toBe('July to May')
    expect(r.crossing.ptBase).toBe(3300000)
    expect(r.pct).toBe(99000)
    expect(r.crossing.vatFrom).toBe('June 2027')
  })
  it('the month list follows the taxable year (fiscal year from July)', () => {
    expect(crossingMonthOptions(7).map(o => o[1])).toEqual(['July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May', 'June'])
    expect(crossingMonthOptions(7)[0]).toEqual(['7', 'July'])
    expect(crossingMonthOptions(1)[11]).toEqual(['12', 'December'])
  })
  it('VAT-registered corporation: no crossing, no percentage tax, VAT not included', () => {
    const r = estimateCorporation({ ...W16, vatRegistered: true, crossedMonth: 10 })
    expect(r.crossing).toBe(null)
    expect(r.pct).toBe(0)
    expect(row(r.rows, /^Percentage tax/)).toBe(undefined)
    expect(r.businessTaxNote).toBe('Income tax and percentage tax only; VAT not included.')
  })
  it('non-VAT under ₱3M: 3% of all sales, no crossing', () => {
    const r = estimateCorporation({ grossSales: 2000000, costOfSales: 500000, opex: 500000, totalAssets: 5000000, taxYear: 2026 })
    expect(r.crossing).toBe(null)
    expect(r.pct).toBe(60000)
    expect(r.businessTaxNote).toBe('Plus ₱60,000 percentage tax (non-VAT).')
  })
})
