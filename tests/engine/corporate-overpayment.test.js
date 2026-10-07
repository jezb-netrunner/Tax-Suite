import { describe, it, expect } from 'vitest'
import { estimateCorporation } from '../../src/engine/estimators/corporation.js'
import { OVERPAYMENT_NOTE } from '../../src/engine/estimators/individual.js'

// L02 (owner default): the overpayment text lists all three choices on the
// annual return: refund, tax credit certificate (TCC) or carry over. For a
// corporation NIRC Sec 76 states that the carry-over choice is irrevocable,
// so that sentence stays (unlike the individual text).

describe('corporate overpayment: sales 1,000,000, cost 400,000, opex 300,000, 2307s 200,000', () => {
  const r = estimateCorporation({
    grossSales: 1000000, costOfSales: 400000, opex: 300000, totalAssets: 1000000,
    registrationYear: 2015, taxYear: 2026, cwt: 200000,
  })
  const row = r.rows.find(x => /^Overpayment/.test(x.label))
  it('RCIT ₱60,000 less ₱200,000 withheld: overpayment ₱140,000', () => {
    expect(r.incomeTaxDue).toBe(60000)
    expect(r.netPayable).toBe(-140000)
    expect(row.value).toBe(140000)
  })
  it('offers refund, tax credit certificate or carry over, and keeps the Sec 76 sentence', () => {
    expect(row.label).toBe('Overpayment')
    expect(OVERPAYMENT_NOTE).toBe('On the return, choose one: refund, tax credit certificate, or carry over to next year.')
    expect(row.sub).toBe(`${OVERPAYMENT_NOTE} The carry-over election, once made on the annual return, is irrevocable (NIRC Sec 76).`)
    expect(r.rows.some(x => /refund or carry over/.test(x.label))).toBe(false)
  })
})
