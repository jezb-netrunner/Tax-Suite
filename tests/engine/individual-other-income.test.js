import { describe, it, expect } from 'vitest'
import { estimateIndividual } from '../../src/engine/estimators/individual.js'

// M02: "other non-operating income (not subject to final tax)" counts in the
// ₱3M test for the 8% option and in the 8% base, is NOT part of the OSD or
// percentage-tax base, and is added after OSD / itemized deductions under
// graduated rates (as on the 1701A). Businesses subject to other percentage
// taxes (NIRC Secs 117-127) cannot use 8%. Values from the exact oracle.

const opt = (r, key) => r.options.find(o => o.key === key)
const row = (rows, re) => rows.find(x => re.test(x.label))

describe('₱2,900,000 sales + ₱200,000 other income = ₱3,100,000', () => {
  const r = estimateIndividual({ gross: 2900000, otherIncome: 200000 })
  it('8% is not available (was shown as available and cheapest)', () => {
    expect(opt(r, '8pct').eligible).toBe(false)
    expect(opt(r, '8pct').reason).toBe('Not available: sales plus other non-operating income are over ₱3,000,000.')
  })
  it('sales alone are under ₱3M: no VAT, percentage tax on sales only ₱87,000', () => {
    expect(r.overThreshold).toBe(false)
    expect(r.crossing).toBe(null)
    expect(r.vatNotIncluded).toBe(false)
    expect(opt(r, 'osd').businessTax.amount).toBe(87000)
  })
  it('OSD: 60% × 2,900,000 = 1,740,000 + 200,000 = 1,940,000 -> ₱387,500; total ₱474,500 (best)', () => {
    expect(opt(r, 'osd').incomeTax).toBe(387500)
    expect(opt(r, 'osd').total).toBe(474500)
    expect(r.best.key).toBe('osd')
    expect(r.annualReturn.taxable).toEqual([{ label: 'Taxable income (after the 40% OSD, plus other income)', value: 1940000 }])
    expect(row(r.rows, /^Plus: other non-operating income/).value).toBe(200000)
  })
  it('itemized (no expenses): 3,100,000 -> ₱732,500', () => {
    expect(opt(r, 'itemized').incomeTax).toBe(732500)
  })
})

describe('₱2,000,000 sales + ₱100,000 other income', () => {
  const r = estimateIndividual({ gross: 2000000, otherIncome: 100000 })
  it('8% tax = (2,100,000 − 250,000) × 8% = ₱148,000 (was ₱140,000)', () => {
    const o = opt(r, '8pct')
    expect(o.eligible).toBe(true)
    expect(o.incomeTax).toBe(148000)
    expect(o.total).toBe(148000)
    expect(r.annualReturn.taxable).toEqual([{ label: 'Taxable base (gross sales and other income less ₱250,000)', value: 1850000 }])
  })
  it('OSD ₱227,500 + percentage tax on sales only ₱60,000 = ₱287,500', () => {
    expect(opt(r, 'osd').incomeTax).toBe(227500)
    expect(opt(r, 'osd').businessTax.amount).toBe(60000)
    expect(opt(r, 'osd').total).toBe(287500)
  })
})

describe('edges and mixed income', () => {
  it('sales + other income exactly ₱3,000,000 keeps 8% (₱220,000)', () => {
    const r = estimateIndividual({ gross: 2900000, otherIncome: 100000 })
    expect(opt(r, '8pct').eligible).toBe(true)
    expect(opt(r, '8pct').total).toBe(220000)
  })
  it('mixed: 8% on sales + other income with no ₱250,000 reduction: 62,500 + 450,000 × 8% = ₱98,500', () => {
    const r = estimateIndividual({ gross: 400000, otherIncome: 50000, mixed: true, compensationTaxable: 600000 })
    expect(opt(r, '8pct').total).toBe(98500)
    expect(opt(r, 'osd').incomeTax).toBe(125000) // 600,000 + 240,000 + 50,000 = 890,000
    expect(opt(r, 'osd').businessTax.amount).toBe(12000)
  })
})

describe('business subject to other percentage taxes (NIRC Secs 117-127)', () => {
  it('8% is not available, with the reason', () => {
    const r = estimateIndividual({ gross: 1000000, subjectToOtherPercentageTax: true })
    expect(opt(r, '8pct').eligible).toBe(false)
    expect(opt(r, '8pct').reason).toBe('Not available: the business is subject to other percentage taxes (NIRC Secs 117-127).')
    expect(r.best.key).not.toBe('8pct')
  })
  it('answering no keeps 8%', () => {
    const r = estimateIndividual({ gross: 1000000, subjectToOtherPercentageTax: false })
    expect(opt(r, '8pct').eligible).toBe(true)
  })
})
