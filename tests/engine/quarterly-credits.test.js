import { describe, it, expect } from 'vitest'
import { estimateIndividual } from '../../src/engine/estimators/individual.js'
import { estimateCorporation } from '../../src/engine/estimators/corporation.js'

// H06: income tax already paid on this year's quarterly returns (1701Q / 1702Q)
// and excess credits carried over from last year are subtracted in the annual
// payable. Quarterly amounts themselves are not computed (the user enters them).

const row = (rows, re) => rows.find(x => re.test(x.label))

describe('TI:WS-07 8% filer who paid every quarter', () => {
  // 1701Q on even sales of ₱100,000 a month (cumulative, ₱250,000 reduction):
  //   Q1 (300,000 − 250,000) × 8% = 4,000; Q2 cumulative 28,000; Q3 cumulative 52,000.
  //   Paid Q1-Q3 = ₱52,000. Annual 8% tax ₱76,000 → 1701A payable 76,000 − 52,000 = ₱24,000.
  it('1701A payable ₱24,000 after ₱52,000 of 1701Q payments (not ₱76,000)', () => {
    const r = estimateIndividual({ gross: 1200000, expenses: 300000, quarterlyPaid: 52000 })
    expect(r.best.key).toBe('8pct')
    expect(r.best.total).toBe(76000)
    expect(r.netPayable).toBe(24000)
    expect(r.annualReturn.creditLines).toEqual([
      { label: 'Less: income tax paid on this year\'s quarterly returns (1701Q)', value: 52000 },
    ])
  })
  it('prior-year excess credits of ₱5,000 bring it to ₱19,000', () => {
    const r = estimateIndividual({ gross: 1200000, expenses: 300000, quarterlyPaid: 52000, priorYearCredits: 5000 })
    expect(r.netPayable).toBe(19000)
    expect(r.credits).toBe(57000)
    expect(row(r.rows, /carried over from last year/).value).toBe(-5000)
    expect(row(r.rows, /payable with the annual return/).value).toBe(19000)
  })
})

describe('TI:WS-12 mixed income, 8% best, with 1701Q payments', () => {
  // Business 1701Q at 8% (no ₱250,000 reduction for mixed income): Q1-Q3 on
  // ₱300,000 cumulative sales = ₱24,000. 1701: 94,500 − 62,500 − 24,000 = ₱8,000.
  it('1701 payable ₱8,000', () => {
    const r = estimateIndividual({
      gross: 400000, expenses: 100000, mixed: true,
      compensationTaxable: 600000, compensationWithheld: 62500, quarterlyPaid: 24000,
    })
    expect(r.netPayable).toBe(8000)
    expect(r.annualReturn.creditLines.map(c => c.value)).toEqual([62500, 24000])
  })
})

describe('WH:WS-23 corporate annual payable after quarterly payments', () => {
  const base = {
    grossSales: 10000000, costOfSales: 4000000, opex: 3000000, totalAssets: 50000000,
    cwt: 100000, registrationYear: 2015, taxYear: 2026,
  }
  it('1702-RT payable: 600,000 − 450,000 (1702Q) − 100,000 (2307s) = ₱50,000 (not ₱500,000)', () => {
    const r = estimateCorporation({ ...base, quarterlyPaid: 450000 })
    expect(r.incomeTaxDue).toBe(600000)
    expect(r.netPayable).toBe(50000)
    expect(row(r.rows, /1702Q/).value).toBe(-450000)
    expect(row(r.rows, /^Income tax still payable/).value).toBe(50000)
  })
  it('₱60,000 of prior-year excess credits turns it into a ₱10,000 overpayment', () => {
    const r = estimateCorporation({ ...base, quarterlyPaid: 450000, priorYearCredits: 60000 })
    expect(r.netPayable).toBe(-10000)
    expect(row(r.rows, /carried over from last year/).value).toBe(-60000)
    expect(row(r.rows, /^Overpayment/).value).toBe(10000)
  })
  it('quarterly payments alone (no 2307s) still show the credit rows', () => {
    const r = estimateCorporation({ ...base, cwt: 0, quarterlyPaid: 450000 })
    expect(r.netPayable).toBe(150000)
    expect(row(r.rows, /^Income tax still payable/).value).toBe(150000)
  })
})
