import { describe, it, expect } from 'vitest'
import { estimatePayroll } from '../../src/engine/estimators/payroll.js'

// M12: the Payroll "true cost" includes the mandatory 13th-month pay accrued
// every month: one-twelfth of the basic salary (PD 851).

const row = (rows, re) => rows.find(x => re.test(x.label))

describe('WH:WS-19 payroll true monthly cost including the 13th month', () => {
  const r = estimatePayroll({ monthlyBasic: 25000 })
  it('employer contributions ₱3,355 (SSS 2,530 + PhilHealth 625 + Pag-IBIG 200)', () => {
    expect(r.employerContributions.total).toBe(3355)
  })
  it('13th-month accrual 25,000 ÷ 12 = ₱2,083.33', () => {
    expect(r.thirteenthMonthAccrual).toBe(2083.33)
    expect(row(r.rows, /^Accrued 13th-month pay \(1\/12 of basic\)/).value).toBe(2083.33)
  })
  it('total ₱30,438.33 (not ₱28,355.00)', () => {
    expect(r.totalMonthlyCost).toBe(30438.33)
    expect(row(r.rows, /^Total employer cost this month/).value).toBe(30438.33)
  })
})

describe('13th-month accrual is on basic pay only', () => {
  it('allowances do not raise it: ₱15,000 basic + ₱10,000 allowance -> ₱1,250.00', () => {
    const r = estimatePayroll({ monthlyBasic: 15000, monthlyAllowances: 10000 })
    expect(r.thirteenthMonthAccrual).toBe(1250)
    expect(r.totalMonthlyCost).toBe(25000 + 2530 + 375 + 200 + 1250)
  })
  it('minimum wage earner: 1/12 of the ₱22,964.58 minimum wage = ₱1,913.72', () => {
    const r = estimatePayroll({ mwe: true, mweDailyRate: 755, payFactor: 365 })
    expect(r.thirteenthMonthAccrual).toBe(1913.72)
  })
})
