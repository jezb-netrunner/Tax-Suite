// M30: two planted errors from the audit's mutation check that no test caught:
// the default paid-days-a-year (313) and the rule that a VAT-registered
// profile cannot stay on the 8% regime.
import { describe, it, expect } from 'vitest'
import { payFactorOf, DEFAULT_PAY_FACTOR, estimatePayroll } from '../../src/engine/estimators/payroll.js'
import { estimateEmployee } from '../../src/engine/estimators/employee.js'
import { profileFlags, defaultProfile } from '../../src/engine/profile.js'

describe('paid days a year: 313 unless the user picks another (decision 9)', () => {
  it('the default is the six-day week, 313', () => {
    expect(DEFAULT_PAY_FACTOR).toBe(313)
    expect(payFactorOf()).toBe(313)
    expect(payFactorOf('')).toBe(313)
    expect(payFactorOf(261)).toBe(261)
    expect(() => payFactorOf(300)).toThrow(RangeError)
  })
  it('minimum wage ₱695 with no factor chosen: ₱695 × 313 ÷ 12 = ₱18,127.92 a month (WH:WS-09 premise); 261 days gives ₱15,116.25', () => {
    expect(estimatePayroll({ mwe: true, mweDailyRate: 695 }).minimumWage).toBe(18127.92)
    expect(estimateEmployee({ mwe: true, mweDailyRate: 695 }).minimumWage).toBe(18127.92)
    expect(estimatePayroll({ mwe: true, mweDailyRate: 695, payFactor: 261 }).minimumWage).toBe(15116.25)
  })
})

describe('profile flags: a VAT-registered individual is never on the 8% regime', () => {
  const flags = o => [...profileFlags({ ...defaultProfile('individual'), name: 'P', ...o })]
  it('non-VAT on 8% keeps the 8% flag', () => {
    expect(flags({ vatRegistered: false, regime: '8pct' })).toContain('regime:8pct')
  })
  it('VAT-registered with 8% saved is treated as graduated + OSD', () => {
    const f = flags({ vatRegistered: true, regime: '8pct' })
    expect(f).not.toContain('regime:8pct')
    expect(f).toContain('regime:graduated')
    expect(f).not.toContain('itemized')
    expect(f).toContain('vat')
  })
  it('itemized stays itemized', () => {
    expect(flags({ vatRegistered: true, regime: 'graduated_itemized' })).toEqual(expect.arrayContaining(['regime:graduated', 'itemized']))
  })
})
