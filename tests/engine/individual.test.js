import { describe, it, expect } from 'vitest'
import { estimateIndividual } from '../../src/engine/estimators/individual.js'

// Hand-worked example — freelancer, ₱480,000 gross, ₱180,000 expenses:
//   8%:        (480,000 − 250,000) × 8% = 18,400 (no percentage tax)
//   OSD:       net 288,000 → (288,000 − 250,000) × 15% = 5,700 + PT 14,400 = 20,100
//   Itemized:  net 300,000 → 7,500 + PT 14,400 = 21,900
describe('self-employed three-way comparison', () => {
  const r = estimateIndividual({ gross: 480000, expenses: 180000, cwt: 0 })
  it('8% option', () => {
    const o = r.options.find(o => o.key === '8pct')
    expect(o.eligible).toBe(true)
    expect(o.total).toBe(18400)
  })
  it('graduated + OSD', () => {
    const o = r.options.find(o => o.key === 'osd')
    expect(o.incomeTax).toBeCloseTo(5700)
    expect(o.businessTax.amount).toBeCloseTo(14400)
    expect(o.total).toBeCloseTo(20100)
  })
  it('graduated + itemized', () => {
    const o = r.options.find(o => o.key === 'itemized')
    expect(o.total).toBeCloseTo(21900)
  })
  it('picks 8% as best, saving 1,700', () => {
    expect(r.best.key).toBe('8pct')
    expect(r.savingsVsNext).toBeCloseTo(1700)
  })
})

describe('CWT crediting and overpayment', () => {
  it('credits reduce net payable', () => {
    const r = estimateIndividual({ gross: 480000, expenses: 0, cwt: 10000 })
    expect(r.netPayable).toBeCloseTo(8400)
  })
  it('overpayment goes negative', () => {
    const r = estimateIndividual({ gross: 480000, expenses: 0, cwt: 25000 })
    expect(r.netPayable).toBeCloseTo(-6600)
  })
})

describe('VAT threshold guard', () => {
  it('8% unavailable above ₱3M gross', () => {
    const r = estimateIndividual({ gross: 3500000, expenses: 1000000 })
    expect(r.vat).toBe(true)
    expect(r.options.find(o => o.key === '8pct').eligible).toBe(false)
    // no percentage tax when VAT applies
    expect(r.options.find(o => o.key === 'osd').businessTax.kind).toBe('vat')
  })
  it('VAT-registered below threshold also loses 8% and PT', () => {
    const r = estimateIndividual({ gross: 1000000, vatRegistered: true })
    expect(r.options.find(o => o.key === '8pct').eligible).toBe(false)
    expect(r.options.find(o => o.key === 'osd').businessTax.kind).toBe('vat')
  })
})

// Mixed income, hand-worked:
//   comp taxable 600,000 → graduated = 22,500 + 200,000×20% = 62,500
//   8% on business: 400,000 × 8% = 32,000 (NO ₱250k allowance) → total 94,500
//   OSD: aggregate 600,000 + 240,000 = 840,000 → 102,500 + 40,000×25% = 112,500
//        + PT 12,000 → 124,500
describe('mixed-income earner', () => {
  const r = estimateIndividual({
    gross: 400000, expenses: 100000, mixed: true,
    compensationTaxable: 600000, compensationWithheld: 62500,
  })
  it('8% side has no 250k allowance and adds graduated comp tax', () => {
    const o = r.options.find(o => o.key === '8pct')
    expect(o.total).toBeCloseTo(94500)
  })
  it('graduated aggregates compensation and business net', () => {
    const o = r.options.find(o => o.key === 'osd')
    expect(o.incomeTax).toBeCloseTo(112500)
    expect(o.total).toBeCloseTo(124500)
  })
  it('employer withholding credits against the total', () => {
    expect(r.best.key).toBe('8pct')
    expect(r.netPayable).toBeCloseTo(94500 - 62500)
  })
})
