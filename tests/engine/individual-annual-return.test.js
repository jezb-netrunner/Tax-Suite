import { describe, it, expect } from 'vitest'
import { estimateIndividual } from '../../src/engine/estimators/individual.js'

// C02: the annual income tax return (1701 / 1701A) payable is income tax due
// minus income-tax credits only (2307s, employer withholding). The 3%
// percentage tax is paid quarterly on Form 2551Q and is never netted against
// those credits. Expected values: REVIEW.md section 3.1 worksheets, re-checked
// with the exact Python oracle (scratchpad phase4/individual/py/oracle.py).

const row = (rows, re) => rows.find(x => re.test(x.label))

describe('TI:WS-08 pure self-employed, OSD best, 2307 credits exceed income tax', () => {
  const r = estimateIndividual({ gross: 420000, expenses: 0, cwt: 21000 })
  it('OSD is cheapest at ₱12,900 (₱300 income tax + ₱12,600 percentage tax)', () => {
    expect(r.best.key).toBe('osd')
    expect(r.best.incomeTax).toBe(300)
    expect(r.best.total).toBe(12900)
  })
  it('1701A: ₱300 − ₱21,000 = overpayment ₱20,700 (not ₱8,100)', () => {
    expect(r.netPayable).toBe(-20700)
    expect(r.annualReturn.form).toBe('1701A')
    expect(r.annualReturn.incomeTaxDue).toBe(300)
    expect(r.annualReturn.credits).toBe(21000)
    expect(r.annualReturn.netPayable).toBe(-20700)
  })
  it('percentage tax ₱12,600 stays separate (2551Q)', () => {
    expect(r.percentageTax).toBe(12600)
    expect(r.annualReturn.percentageTax).toBe(12600)
  })
  it('the return shows the taxable-income line: ₱252,000 after OSD', () => {
    expect(r.annualReturn.taxable).toEqual([{ label: 'Taxable income (after the 40% OSD)', value: 252000 }])
  })
  it('breakdown: percentage tax says 2551Q, and the overpayment is ₱20,700', () => {
    const pt = row(r.rows, /^Percentage tax/)
    expect(pt.value).toBe(12600)
    expect(pt.sub).toMatch(/paid quarterly on Form 2551Q, not with the annual return/)
    expect(row(r.rows, /^Income tax due on the annual return/).value).toBe(300)
    expect(row(r.rows, /2307/).value).toBe(-21000)
    expect(row(r.rows, /^Overpayment/).value).toBe(20700)
    expect(row(r.rows, /payable with the annual return/)).toBeUndefined()
  })
})

describe('TI:WS-10 itemized best, credits exceed income tax', () => {
  const r = estimateIndividual({ gross: 1000000, expenses: 900000, cwt: 100000 })
  it('itemized ₱30,000 is cheapest; 1701 overpayment ₱100,000 (not ₱70,000)', () => {
    expect(r.best.key).toBe('itemized')
    expect(r.best.total).toBe(30000)
    expect(r.annualReturn.form).toBe('1701')
    expect(r.netPayable).toBe(-100000)
    expect(r.percentageTax).toBe(30000)
  })
  it('taxable income line ₱100,000', () => {
    expect(r.annualReturn.taxable).toEqual([{ label: 'Taxable income (after itemized deductions)', value: 100000 }])
  })
})

describe('TI:WS-11 itemized loss, no credits', () => {
  const r = estimateIndividual({ gross: 500000, expenses: 700000 })
  it('itemized ₱15,000 (all percentage tax) is cheapest; 1701 payable ₱0 (not ₱15,000)', () => {
    expect(r.best.key).toBe('itemized')
    expect(r.best.incomeTax).toBe(0)
    expect(r.best.total).toBe(15000)
    expect(r.netPayable).toBe(0)
    expect(r.percentageTax).toBe(15000)
    expect(row(r.rows, /payable with the annual return/).value).toBe(0)
  })
})

describe('TI:WS-13 mixed income, OSD best, with 2307', () => {
  const r = estimateIndividual({
    gross: 300000, expenses: 100000, cwt: 15000, mixed: true,
    compensationTaxable: 150000, compensationWithheld: 0,
  })
  it('OSD ₱21,000 is cheapest; 1701 overpayment ₱3,000 (not ₱6,000 payable)', () => {
    expect(r.best.key).toBe('osd')
    expect(r.best.incomeTax).toBe(12000)
    expect(r.best.total).toBe(21000)
    expect(r.annualReturn.form).toBe('1701')
    expect(r.netPayable).toBe(-3000)
    expect(r.percentageTax).toBe(9000)
  })
  it('taxable income line: compensation ₱150,000 + business ₱180,000 = ₱330,000', () => {
    expect(r.annualReturn.taxable).toEqual([{ label: 'Taxable income (compensation + business after the 40% OSD)', value: 330000 }])
  })
})

describe('TI:WS-14 mixed income with a business loss', () => {
  const r = estimateIndividual({
    gross: 300000, expenses: 500000, mixed: true,
    compensationTaxable: 600000, compensationWithheld: 62500,
  })
  it('itemized ₱71,500 is cheapest; income tax ₱62,500; 1701 payable ₱0 (not ₱9,000)', () => {
    expect(r.best.key).toBe('itemized')
    expect(r.best.incomeTax).toBe(62500)
    expect(r.best.total).toBe(71500)
    expect(r.netPayable).toBe(0)
    expect(r.percentageTax).toBe(9000)
  })
  it('employer withholding is its own credit line', () => {
    expect(r.annualReturn.creditLines).toEqual([{ label: 'Less: tax withheld by employer', value: 62500 }])
  })
})

describe('TI:WS-07 / TI:WS-12 8% cases keep their payable (no percentage tax)', () => {
  it('pure 8%: taxable base ₱950,000, payable ₱76,000', () => {
    const r = estimateIndividual({ gross: 1200000, expenses: 300000 })
    expect(r.best.key).toBe('8pct')
    expect(r.netPayable).toBe(76000)
    expect(r.percentageTax).toBe(0)
    expect(r.annualReturn.taxable).toEqual([{ label: 'Taxable base (gross sales less ₱250,000)', value: 950000 }])
  })
  it('mixed 8%: compensation ₱600,000 and business base ₱400,000; payable ₱32,000', () => {
    const r = estimateIndividual({
      gross: 400000, expenses: 100000, mixed: true,
      compensationTaxable: 600000, compensationWithheld: 62500,
    })
    expect(r.best.key).toBe('8pct')
    expect(r.netPayable).toBe(32000)
    expect(r.annualReturn.taxable).toEqual([
      { label: 'Taxable compensation (graduated rates)', value: 600000 },
      { label: 'Business income taxed at 8% (gross sales)', value: 400000 },
    ])
  })
})
