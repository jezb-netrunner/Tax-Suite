import { describe, it, expect } from 'vitest'
import { estimateIndividual } from '../../src/engine/estimators/individual.js'

// H04 (owner decision 6): a non-VAT taxpayer whose sales pass ₱3,000,000
// during the year. The whole year is on graduated rates (8% unavailable, 8%
// payments already made are credited); the 3% percentage tax applies to sales
// from January through the end of the month the ₱3M was crossed (entered, or
// gross prorated evenly by month); VAT applies from the following month and is
// not computed. Expected values re-derived under decision 6 with the exact
// oracle (see tdd.md); REVIEW.md TI:WS-16 and TB:W16 assumed slightly
// different month splits.

const opt = (r, key) => r.options.find(o => o.key === key)
const row = (rows, re) => rows.find(x => re.test(x.label))

describe('TI:WS-16 just above ₱3,000,000', () => {
  it('₱3,000,000.01, month not given: even sales cross in December; PT ₱90,000; OSD ₱352,500', () => {
    const r = estimateIndividual({ gross: 3000000.01, taxYear: 2026 })
    expect(opt(r, '8pct').eligible).toBe(false)
    expect(r.crossing.month).toBe(12)
    expect(r.crossing.assumedEvenSales).toBe(true)
    expect(r.crossing.ptBase).toBe(3000000)
    expect(r.crossing.ptBaseProrated).toBe(true)
    expect(r.crossing.vatFrom).toBe('January 2027')
    const o = opt(r, 'osd')
    expect(o.incomeTax).toBe(352500)
    expect(o.businessTax).toEqual({ kind: 'pct', amount: 90000, vatFrom: 'January 2027' })
    expect(o.total).toBe(442500)
    expect(r.best.key).toBe('osd')
  })
  it('₱3,000,001 crossed in December: PT 3% × 3,000,001 = 90,000.03 -> ₱90,000; itemized ₱702,500', () => {
    const r = estimateIndividual({ gross: 3000001, crossedMonth: 12, taxYear: 2026 })
    expect(r.crossing.assumedEvenSales).toBe(false)
    expect(r.crossing.ptBase).toBe(3000001)
    expect(r.percentageTax).toBe(90000)
    expect(opt(r, 'osd').incomeTax).toBe(352500)
    expect(opt(r, 'itemized').incomeTax).toBe(702500)
    expect(opt(r, 'itemized').total).toBe(792500)
  })
})

describe('TB:W16 non-VAT individual at ₱3,200,000 gross, ₱2,000,000 expenses', () => {
  it('month not given: even sales cross in December, so PT on all ₱3,200,000 = ₱96,000 (not ₱0)', () => {
    const r = estimateIndividual({ gross: 3200000, expenses: 2000000, taxYear: 2026 })
    expect(r.crossing.month).toBe(12)
    expect(r.crossing.ptBase).toBe(3200000)
    expect(r.best.key).toBe('itemized')
    expect(r.best.incomeTax).toBe(202500)
    expect(r.best.businessTax.amount).toBe(96000)
    expect(r.best.total).toBe(298500)
    expect(r.crossing.vatFrom).toBe('January 2027')
  })
  it('crossed in November, sales not entered: prorated 3,200,000 × 11/12 = ₱2,933,333 -> PT ₱88,000; VAT from December', () => {
    const r = estimateIndividual({ gross: 3200000, expenses: 2000000, crossedMonth: 11, taxYear: 2026 })
    expect(r.crossing.ptBase).toBe(2933333)
    expect(r.crossing.ptBaseProrated).toBe(true)
    expect(r.best.businessTax.amount).toBe(88000)
    expect(r.best.total).toBe(290500)
    expect(r.crossing.vatFrom).toBe('December 2026')
  })
  it('crossed in November with ₱3,050,000 sales Jan-Nov and ₱150,000 of 8% paid: PT ₱91,500, payable ₱52,500', () => {
    const r = estimateIndividual({
      gross: 3200000, expenses: 2000000, crossedMonth: 11, salesThroughCrossMonth: 3050000,
      eightPercentPaid: 150000, taxYear: 2026,
    })
    expect(r.crossing.ptBase).toBe(3050000)
    expect(r.crossing.ptBaseProrated).toBe(false)
    expect(r.best.key).toBe('itemized')
    expect(r.best.total).toBe(294000)
    expect(r.percentageTax).toBe(91500)
    expect(r.netPayable).toBe(52500)
    expect(r.annualReturn.creditLines).toEqual([
      { label: 'Less: 8% income tax already paid on 1701Q this year', value: 150000 },
    ])
  })
  it('breakdown names the months and says VAT is not included', () => {
    const r = estimateIndividual({ gross: 3200000, expenses: 2000000, crossedMonth: 11, taxYear: 2026 })
    const pt = row(r.rows, /^Percentage tax/)
    expect(pt.label).toBe('Percentage tax (3% of sales January to November)')
    expect(pt.value).toBe(88000)
    expect(row(r.rows, /^Value-added tax/).sub).toBe('VAT applies from December 2026: not included in this estimate.')
    expect(r.rows.some(x => /no longer appl/i.test(x.label + ' ' + (x.sub || '')))).toBe(false)
  })
})

describe('sales entered for January to the crossing month are checked', () => {
  it('more than the year\'s sales: capped at the year\'s sales with a warning', () => {
    const r = estimateIndividual({ gross: 3200000, crossedMonth: 11, salesThroughCrossMonth: 3500000, taxYear: 2026 })
    expect(r.crossing.ptBase).toBe(3200000)
    expect(r.crossing.warnings).toEqual(['Sales from January to November can\'t be more than the year\'s gross sales (₱3,200,000); ₱3,200,000 is used.'])
  })
  it('not over ₱3,000,000: used as entered, with a warning', () => {
    const r = estimateIndividual({ gross: 3200000, crossedMonth: 11, salesThroughCrossMonth: 2900000, taxYear: 2026 })
    expect(r.crossing.ptBase).toBe(2900000)
    expect(r.percentageTax).toBe(87000)
    expect(r.crossing.warnings).toEqual(['Sales from January to November should be more than ₱3,000,000, since that is the month the threshold was passed.'])
  })
  it('8% payments are credited only when the ₱3M is crossed', () => {
    const r = estimateIndividual({ gross: 1200000, eightPercentPaid: 50000 })
    expect(r.crossing).toBe(null)
    expect(r.netPayable).toBe(76000)
  })
  it('VAT-registered over ₱3M: no crossing split (VAT all year, not computed)', () => {
    const r = estimateIndividual({ gross: 3200000, vatRegistered: true, crossedMonth: 11 })
    expect(r.crossing).toBe(null)
    expect(opt(r, 'osd').businessTax.kind).toBe('vat')
  })
})
