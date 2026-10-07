import { describe, it, expect } from 'vitest'
import { estimateEmployee } from '../../src/engine/estimators/employee.js'
import { estimatePayroll } from '../../src/engine/estimators/payroll.js'
import { employeeMandatoryDeductions, employerContributions } from '../../src/engine/estimators/contributions.js'
import contrib from '../../src/data/rules/contributions.json'

// C05: each agency on its own base.
//   SSS:        basic pay + regular allowances / commissions / other regular pay
//               (RA 11199 Sec 8(f): all actual remuneration), MSC capped at ₱35,000
//   PhilHealth: basic salary
//   Pag-IBIG:   monthly compensation (basic + regular pay), fund salary capped at ₱10,000 (needs_review)
// One-time or liquidated items are taxable but do not count for SSS.

const row = (rows, re) => rows.find(x => re.test(x.label))

describe('WH:WS-10 ₱15,000 basic + ₱10,000 regular allowance', () => {
  const r = estimateEmployee({ monthlyBasic: 15000, monthlyAllowances: 10000 })
  it('SSS on MSC ₱25,000: employee ₱1,250 (not ₱750)', () => {
    expect(r.deductions.sss).toBe(1250)
    expect(r.deductions.sssMsc).toBe(25000)
  })
  it('PhilHealth on basic only: ₱375; Pag-IBIG ₱200; total ₱1,825', () => {
    expect(r.deductions.philhealth).toBe(375)
    expect(r.deductions.pagibig).toBe(200)
    expect(r.deductions.total).toBe(1825)
  })
  it('taxable ₱23,175; withholding ₱351.30 (not ₱426.30); annual tax ₱4,215 (not ₱5,115)', () => {
    expect(r.monthlyTaxable).toBe(23175)
    expect(r.monthlyWithholding).toBe(351.3)
    expect(r.annualTax).toBe(4215)
  })
  it('Payroll: employer SSS ₱2,500 + EC ₱30 = ₱2,530 (not ₱1,530)', () => {
    const p = estimatePayroll({ monthlyBasic: 15000, monthlyAllowances: 10000 })
    expect(p.employerContributions.sss).toBe(2530)
    expect(p.employerContributions.philhealth).toBe(375)
    expect(p.employerContributions.pagibig).toBe(200)
    expect(p.monthlyWithholding).toBe(351.3)
    expect(row(p.rows, /^Employer SSS share/).sub).toMatch(/₱25,000/)
  })
})

describe('one-time or liquidated items are taxed but do not count for SSS', () => {
  const r = estimateEmployee({ monthlyBasic: 15000, monthlyOtherTaxable: 10000 })
  it('SSS stays on ₱15,000: ₱750; taxable 25,000 − 1,325 = ₱23,675; withholding ₱426.30', () => {
    expect(r.deductions.sss).toBe(750)
    expect(r.deductions.total).toBe(1325)
    expect(r.monthlyTaxable).toBe(23675)
    expect(r.monthlyWithholding).toBe(426.3)
  })
  it('the payslip lists both boxes', () => {
    expect(row(r.rows, /^One-time or liquidated items/).value).toBe(10000)
    const both = estimateEmployee({ monthlyBasic: 15000, monthlyAllowances: 2000, monthlyOtherTaxable: 1000 })
    expect(row(both.rows, /^Regular allowances \/ commissions/).value).toBe(2000)
    expect(both.monthlyTaxable).toBe(18000 - both.deductions.total)
  })
})

describe('SSS cap and PhilHealth base', () => {
  it('₱30,000 basic + ₱20,000 commissions: MSC capped at ₱35,000 (₱1,750); PhilHealth on ₱30,000 (₱750)', () => {
    const d = employeeMandatoryDeductions(30000, { sssCompensation: 50000, pagibigCompensation: 50000 })
    expect(d.sss).toBe(1750)
    expect(d.sssMsc).toBe(35000)
    expect(d.philhealth).toBe(750)
    expect(d.pagibig).toBe(200)
  })
  it('without a separate base every agency uses the one figure (Tools "start from gross")', () => {
    expect(employeeMandatoryDeductions(25000)).toEqual({ sss: 1250, sssMsc: 25000, philhealth: 625, pagibig: 200, total: 2075 })
    expect(employerContributions(25000).total).toBe(2530 + 625 + 200)
  })
})

describe('Pag-IBIG on monthly compensation (basic + regular pay), needs_review', () => {
  it('₱1,000 basic + ₱1,000 regular allowance: compensation ₱2,000 > ₱1,500, so 2% = ₱40 (not 1% of basic = ₱10)', () => {
    const r = estimateEmployee({ monthlyBasic: 1000, monthlyAllowances: 1000 })
    expect(r.deductions.pagibig).toBe(40)
    expect(estimatePayroll({ monthlyBasic: 1000, monthlyAllowances: 1000 }).employerContributions.pagibig).toBe(40)
  })
  it('the rulebook flags the Pag-IBIG base as needs_review', () => {
    expect(contrib.pagibigCompensationBase.confidence).toBe('needs_review')
    expect(contrib.sss.value.compensationBase).toMatch(/regular allowances/)
  })
})

describe('minimum wage earners: SSS counts the commissions and the holiday/overtime pay', () => {
  it('WH:WS-09 ₱18,127.92 + ₱6,000: MSC ₱24,000 -> SSS ₱1,200; total ₱1,853.20; take-home ₱22,274.72; still ₱0 withheld', () => {
    const r = estimateEmployee({ mwe: true, mweDailyRate: 695, payFactor: 313, monthlyAllowances: 6000 })
    expect(r.deductions.sss).toBe(1200)
    expect(r.deductions.philhealth).toBe(453.2)
    expect(r.deductions.total).toBe(1853.2)
    expect(r.monthlyTaxable).toBe(6000)
    expect(r.monthlyWithholding).toBe(0)
    expect(r.monthlyTakeHome).toBe(22274.72)
  })
  it('₱22,964.58 + ₱4,000 overtime: MSC ₱27,000 -> SSS ₱1,350; PhilHealth on the minimum wage only', () => {
    const r = estimateEmployee({ mwe: true, mweDailyRate: 755, payFactor: 365, mweExtraPay: 4000 })
    expect(r.deductions.sss).toBe(1350)
    expect(r.deductions.philhealth).toBe(574.12) // 22,964.58 × 5% = 1,148.229 -> 1,148.23; half 574.115 -> 574.12
  })
})
