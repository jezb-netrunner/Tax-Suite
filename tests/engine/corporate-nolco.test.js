import { describe, it, expect } from 'vitest'
import { estimateCorporation } from '../../src/engine/estimators/corporation.js'

// M04 (corporations; NIRC Sec 34(D)(3); RR 14-2001; RR 16-2008): operating
// costs above gross income show the net loss and the NOLCO it creates
// (usable in the next 3 taxable years, only in years the corporation
// itemizes; OSD years still count; it never reduces the MCIT, which is on
// gross income). An optional "NOLCO from prior years" applies only with
// itemized deductions, against taxable income only. The rule is
// income-tax.json netOperatingLossCarryOver (needs_review). Mirrors
// tests/engine/individual-nolco.test.js; values from py/m04.py (tdd.md).

const row = (rows, re) => rows.find(x => re.test(x.label))
const base = { totalAssets: 1000000, registrationYear: 2015, taxYear: 2026 }

describe('corporate net loss: sales 500,000, cost of sales 400,000, operating expenses 300,000', () => {
  const r = estimateCorporation({ ...base, grossSales: 500000, costOfSales: 400000, opex: 300000 })
  it('shows a ₱200,000 net loss (was silently ₱0 net taxable income)', () => {
    expect(r.netLoss).toBe(200000)
    expect(row(r.rows, /^Net loss/).value).toBe(200000)
    expect(row(r.rows, /^Net taxable income/).value).toBe(0)
    expect(r.taxableIncome).toBe(0)
  })
  it('NOLCO usable in TY 2027 to TY 2029, itemized years only, never against the MCIT', () => {
    expect(r.nolco.createdAmount).toBe(200000)
    expect(r.nolco.usableFrom).toBe(2027)
    expect(r.nolco.usableTo).toBe(2029)
    expect(r.nolco.note).toBe(
      'Net loss ₱200,000. This net operating loss (NOLCO) can be deducted from taxable income in the next 3 taxable years ' +
      '(TY 2027 to TY 2029), but only in years the corporation itemizes deductions. It cannot be used in a year on the 40% OSD, ' +
      'and those years still count toward the 3. It never reduces the MCIT, which is on gross income.'
    )
    expect(row(r.rows, /^Net loss/).sub).toBe('Becomes NOLCO: deductible from taxable income in TY 2027 to TY 2029, in years the corporation itemizes.')
  })
  it('the MCIT still applies on gross income: 2% × 100,000 = ₱2,000 due', () => {
    expect(r.rcit).toBe(0)
    expect(r.mcit).toBe(2000)
    expect(r.incomeTaxDue).toBe(2000)
  })
  it('the NOLCO rule is cited', () => {
    expect(r.references).toContain('NIRC Sec 34(D)(3)')
  })
})

describe('corporate NOLCO from prior years (itemized only, against taxable income only)', () => {
  const figures = { ...base, grossSales: 1000000, costOfSales: 400000, opex: 300000 }
  it('₱250,000 NOLCO: taxable income 300,000 -> 50,000, RCIT ₱10,000, but the MCIT ₱12,000 still binds', () => {
    expect(estimateCorporation(figures).incomeTaxDue).toBe(60000)
    const r = estimateCorporation({ ...figures, nolcoPrior: 250000 })
    expect(r.nolco.applied).toBe(250000)
    expect(r.nolco.left).toBe(0)
    expect(r.taxableIncome).toBe(50000)
    expect(r.rcit).toBe(10000)
    expect(r.mcit).toBe(12000)
    expect(r.incomeTaxDue).toBe(12000)
    expect(row(r.rows, /^Net income before NOLCO/).value).toBe(300000)
    expect(row(r.rows, /^Less: NOLCO from prior years/).value).toBe(-250000)
  })
  it('MCIT not yet applicable: RCIT ₱10,000 is the tax due', () => {
    const r = estimateCorporation({ ...figures, registrationYear: 2024, nolcoPrior: 250000 })
    expect(r.incomeTaxDue).toBe(10000)
  })
  it('NOLCO larger than the income: ₱300,000 used, ₱100,000 left', () => {
    const r = estimateCorporation({ ...figures, nolcoPrior: 400000 })
    expect(r.nolco.applied).toBe(300000)
    expect(r.nolco.left).toBe(100000)
    expect(r.taxableIncome).toBe(0)
    expect(row(r.rows, /^Less: NOLCO from prior years/).sub).toBe('₱100,000 of NOLCO is left for later years, within its 3-year limit.')
  })
  it('OSD year: not used (taxable income 360,000, RCIT ₱72,000), with a note', () => {
    const r = estimateCorporation({ ...figures, deduction: 'osd', nolcoPrior: 250000 })
    expect(r.nolco.applied).toBe(0)
    expect(r.taxableIncome).toBe(360000)
    expect(r.incomeTaxDue).toBe(72000)
    expect(r.nolco.osdNote).toBe('NOLCO from prior years can\'t be used in a year on the 40% OSD, and this year still counts toward its 3 years.')
    expect(row(r.rows, /NOLCO/)).toBe(undefined)
  })
  it('no loss and no NOLCO: no note, rows unchanged', () => {
    const r = estimateCorporation(figures)
    expect(r.netLoss).toBe(0)
    expect(r.nolco.note).toBe(null)
    expect(row(r.rows, /NOLCO|Net loss/)).toBe(undefined)
  })
})
