import { describe, it, expect } from 'vitest'
import { estimateIndividual } from '../../src/engine/estimators/individual.js'

// M04 (owner decision 16): itemized expenses above gross show the net loss and
// the NOLCO it creates (3 years, itemizing only; not usable on OSD or 8%);
// a business loss never reduces taxable compensation. An optional "NOLCO from
// prior years" applies to the itemized option only, and only against business
// income. Values from the exact oracle (py/oracle.py).

const opt = (r, key) => r.options.find(o => o.key === key)
const row = (rows, re) => rows.find(x => re.test(x.label))

describe('TI:WS-11 itemized loss, pure self-employed', () => {
  const r = estimateIndividual({ gross: 500000, expenses: 700000, taxYear: 2026 })
  it('shows a ₱200,000 net loss (was silently ₱0)', () => {
    expect(r.netLoss).toBe(200000)
    const rows = r.rowsFor(opt(r, 'itemized'))
    expect(row(rows, /^Net loss/).value).toBe(200000)
    expect(row(rows, /^Net taxable business income/).value).toBe(0)
  })
  it('NOLCO note: next 3 years (2027 to 2029), itemizing only', () => {
    expect(r.nolco.createdAmount).toBe(200000)
    expect(r.nolco.usableFrom).toBe(2027)
    expect(r.nolco.usableTo).toBe(2029)
    expect(r.nolco.note).toBe(
      'Net loss ₱200,000. This net operating loss (NOLCO) can be deducted from business income in the next 3 years ' +
      '(2027 to 2029), but only in years you itemize deductions. It cannot be used while on OSD or the 8% option, and ' +
      'those years still count toward the 3.'
    )
    expect(row(r.rowsFor(opt(r, 'itemized')), /^Net loss/).sub)
      .toBe('Becomes NOLCO: deductible from business income in 2027 to 2029, in years you itemize.')
  })
  it('income tax ₱0, 1701 payable ₱0, percentage tax ₱15,000', () => {
    expect(r.best.key).toBe('itemized')
    expect(r.netPayable).toBe(0)
    expect(r.percentageTax).toBe(15000)
  })
})

describe('TI:WS-14 mixed income with a business loss', () => {
  const r = estimateIndividual({
    gross: 300000, expenses: 500000, mixed: true,
    compensationTaxable: 600000, compensationWithheld: 62500, taxYear: 2026,
  })
  it('the loss does not reduce compensation: income tax ₱62,500 on ₱600,000', () => {
    expect(r.netLoss).toBe(200000)
    expect(opt(r, 'itemized').incomeTax).toBe(62500)
    expect(r.nolco.note).toMatch(/A business loss does not reduce taxable compensation\.$/)
  })
})

describe('NOLCO from prior years (itemized option only)', () => {
  it('₱1,000,000 sales, ₱400,000 expenses, ₱250,000 NOLCO: itemized 15,000 + 30,000 = ₱45,000 becomes best (8% ₱60,000)', () => {
    const before = estimateIndividual({ gross: 1000000, expenses: 400000 })
    expect(before.best.key).toBe('8pct')
    const r = estimateIndividual({ gross: 1000000, expenses: 400000, nolcoPrior: 250000 })
    expect(opt(r, 'itemized').incomeTax).toBe(15000)
    expect(opt(r, 'itemized').total).toBe(45000)
    expect(opt(r, 'osd').total).toBe(92500)   // OSD unchanged
    expect(opt(r, '8pct').total).toBe(60000)  // 8% unchanged
    expect(r.best.key).toBe('itemized')
    expect(r.nolco.applied).toBe(250000)
    expect(r.nolco.left).toBe(0)
    expect(row(r.rows, /^Less: NOLCO from prior years/).value).toBe(-250000)
  })
  it('NOLCO larger than business income: ₱200,000 used, ₱100,000 left', () => {
    const r = estimateIndividual({ gross: 500000, expenses: 300000, nolcoPrior: 300000 })
    expect(r.nolco.applied).toBe(200000)
    expect(r.nolco.left).toBe(100000)
    expect(opt(r, 'itemized').incomeTax).toBe(0)
    expect(row(r.rowsFor(opt(r, 'itemized')), /^Less: NOLCO from prior years/).sub)
      .toBe('₱100,000 of NOLCO is left for later years, within its 3-year limit.')
  })
  it('never against compensation: mixed, ₱50,000 business income absorbs ₱50,000 of ₱100,000 NOLCO; tax ₱62,500', () => {
    const r = estimateIndividual({ gross: 300000, expenses: 250000, mixed: true, compensationTaxable: 600000, nolcoPrior: 100000 })
    expect(r.nolco.applied).toBe(50000)
    expect(r.nolco.left).toBe(50000)
    expect(opt(r, 'itemized').incomeTax).toBe(62500)
    expect(opt(r, 'itemized').total).toBe(71500)
  })
  it('not against other non-operating income: break-even business, ₱400,000 other income -> taxable ₱400,000', () => {
    const r = estimateIndividual({ gross: 1000000, expenses: 1000000, otherIncome: 400000, nolcoPrior: 50000 })
    expect(r.nolco.applied).toBe(0)
    expect(r.annualReturnFor(opt(r, 'itemized')).taxable[0].value).toBe(400000)
    expect(opt(r, 'itemized').incomeTax).toBe(22500)
  })
  it('no loss and no NOLCO: no NOLCO note', () => {
    const r = estimateIndividual({ gross: 1000000, expenses: 400000 })
    expect(r.netLoss).toBe(0)
    expect(r.nolco.note).toBe(null)
  })
})
