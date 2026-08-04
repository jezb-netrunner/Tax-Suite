import { describe, it, expect } from 'vitest'
import { estimateCorporation } from '../../src/engine/estimators/corporation.js'

// Hand-worked: sales 10M, cost 4M → GI 6M; opex 3M → TI 3M; assets 50M
//   Small corp (TI ≤ 5M, assets ≤ 100M) → 20% → RCIT 600,000
//   Registered 2020, TY 2026 → MCIT era: 2% × 6M = 120,000 < 600,000 → RCIT wins
describe('corporation — small-corp RCIT beats MCIT', () => {
  const r = estimateCorporation({
    grossSales: 10000000, costOfSales: 4000000, opex: 3000000,
    totalAssets: 50000000, registrationYear: 2020, taxYear: 2026,
  })
  it('gross income and taxable income', () => {
    expect(r.grossIncome).toBe(6000000)
    expect(r.taxableIncome).toBe(3000000)
  })
  it('20% small-corp rate applies', () => {
    expect(r.smallCorp).toBe(true)
    expect(r.rcitRate).toBe(0.20)
    expect(r.rcit).toBe(600000)
  })
  it('MCIT computed but not controlling', () => {
    expect(r.mcitApplies).toBe(true)
    expect(r.mcit).toBe(120000)
    expect(r.usesMcit).toBe(false)
    expect(r.incomeTaxDue).toBe(600000)
  })
  it('over ₱3M sales → VAT, no percentage tax', () => {
    expect(r.vat).toBe(true)
    expect(r.pct).toBe(0)
  })
})

describe('corporation — MCIT floor binds in a lean year', () => {
  // TI 100,000 → RCIT 20% = 20,000; MCIT 2% × 6M = 120,000 → MCIT wins
  const r = estimateCorporation({
    grossSales: 10000000, costOfSales: 4000000, opex: 5900000,
    totalAssets: 50000000, registrationYear: 2020, taxYear: 2026,
  })
  it('pays the MCIT', () => {
    expect(r.usesMcit).toBe(true)
    expect(r.incomeTaxDue).toBe(120000)
  })
})

describe('corporation — MCIT 4th-year rule', () => {
  it('no MCIT before the 4th year after registration', () => {
    const r = estimateCorporation({
      grossSales: 10000000, costOfSales: 4000000, opex: 5900000,
      totalAssets: 50000000, registrationYear: 2024, taxYear: 2026,
    })
    expect(r.mcitApplies).toBe(false)
    expect(r.incomeTaxDue).toBe(r.rcit)
  })
  it('MCIT starts exactly in registrationYear + 4', () => {
    const r = estimateCorporation({
      grossSales: 10000000, costOfSales: 4000000, opex: 5900000,
      totalAssets: 50000000, registrationYear: 2022, taxYear: 2026,
    })
    expect(r.mcitApplies).toBe(true)
  })
})

describe('corporation — 25% standard rate cases', () => {
  it('taxable income above ₱5M', () => {
    const r = estimateCorporation({ grossSales: 30000000, costOfSales: 10000000, opex: 12000000, totalAssets: 50000000 })
    expect(r.taxableIncome).toBe(8000000)
    expect(r.smallCorp).toBe(false)
    expect(r.rcit).toBe(2000000)
  })
  it('assets above ₱100M force 25% even with small income', () => {
    const r = estimateCorporation({ grossSales: 8000000, costOfSales: 4000000, opex: 3000000, totalAssets: 150000000 })
    expect(r.smallCorp).toBe(false)
    expect(r.rcitRate).toBe(0.25)
  })
  it('non-VAT small corp pays 3% percentage tax', () => {
    const r = estimateCorporation({ grossSales: 2000000, costOfSales: 500000, opex: 500000, totalAssets: 5000000 })
    expect(r.vat).toBe(false)
    expect(r.pct).toBeCloseTo(60000)
  })
})
