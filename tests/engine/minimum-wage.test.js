import { describe, it, expect } from 'vitest'
import { estimateEmployee } from '../../src/engine/estimators/employee.js'
import { estimatePayroll } from '../../src/engine/estimators/payroll.js'
import { compensationForMixed } from '../../src/engine/estimators/individual.js'
import wcomp from '../../src/data/rules/withholding-compensation.json'

// C04 (owner decision 9): a statutory minimum wage earner (MWE) enters the
// statutory daily rate and the paid days a year (365 / 313 / 261). The minimum
// wage (daily rate × days ÷ 12 a month) plus holiday, overtime, night-shift
// differential and hazard pay are exempt (NIRC Sec 24(A)(2), RA 9504;
// RR 11-2018; Soriano v. Secretary of Finance). Other pay stays taxable, and
// 13th-month pay and other benefits above ₱90,000.

const row = (rows, re) => rows.find(x => re.test(x.label))

describe('WH:WS-08 NCR minimum wage earner, ₱755 × 365 days (monthly-paid)', () => {
  // The ₱22,965 basic typed before the switch was turned on is ignored while it is on.
  const r = estimateEmployee({ monthlyBasic: 22965, mwe: true, mweDailyRate: 755, payFactor: 365 })
  it('statutory minimum wage = 755 × 365 ÷ 12 = ₱22,964.58 a month, all exempt', () => {
    expect(r.minimumWage).toBe(22964.58)
    expect(r.exemptPay).toBe(22964.58)
  })
  it('withholding ₱0.00 a month and ₱0.00 a year (not ₱31.18 / ₱373.57)', () => {
    expect(r.monthlyTaxable).toBe(0)
    expect(r.monthlyWithholding).toBe(0)
    expect(r.annualTaxable).toBe(0)
    expect(r.annualTax).toBe(0)
  })
  it('the payslip says the minimum wage is tax-free', () => {
    const w = row(r.rows, /^Statutory minimum wage/)
    expect(w.value).toBe(22964.58)
    expect(w.label).toMatch(/755 × 365 days ÷ 12/)
    expect(w.label).toMatch(/tax-free/)
  })
  it('Payroll tab: ₱0.00 to remit on the 1601-C', () => {
    const p = estimatePayroll({ monthlyBasic: 22965, mwe: true, mweDailyRate: 755, payFactor: 365 })
    expect(p.monthlyWithholding).toBe(0)
    expect(row(p.rows, /1601-C/).value).toBe(0)
  })
})

describe('WH:WS-09 ₱695 × 313 days (six-day week) with ₱6,000 a month in commissions', () => {
  const r = estimateEmployee({ mwe: true, mweDailyRate: 695, payFactor: 313, monthlyAllowances: 6000 })
  it('minimum wage 695 × 313 ÷ 12 = ₱18,127.92 is exempt; only the ₱6,000 is taxable', () => {
    expect(r.minimumWage).toBe(18127.92)
    expect(r.exemptPay).toBe(18127.92)
    expect(r.monthlyTaxable).toBe(6000)
  })
  it('withholding ₱0.00 (not ₱261.27); annual taxable ₱72,000, tax ₱0.00 (not ₱3,134.64)', () => {
    expect(r.monthlyWithholding).toBe(0)
    expect(r.annualTaxable).toBe(72000)
    expect(r.annualTax).toBe(0)
  })
  it('Payroll tab: ₱0.00 to remit (not ₱261.27)', () => {
    const p = estimatePayroll({ mwe: true, mweDailyRate: 695, payFactor: 313, monthlyAllowances: 6000 })
    expect(p.monthlyTaxable).toBe(6000)
    expect(p.monthlyWithholding).toBe(0)
  })
})

describe('WH:WS-22 ₱695 × 365 days (monthly-paid) with ₱3,000 a month in commissions', () => {
  const r = estimateEmployee({ mwe: true, mweDailyRate: 695, payFactor: 365, monthlyAllowances: 3000 })
  it('minimum wage ₱21,139.58 exempt; ₱3,000 taxable; ₱0.00 a month and a year (not ₱229.28 / ₱2,750.70)', () => {
    expect(r.minimumWage).toBe(21139.58)
    expect(r.monthlyTaxable).toBe(3000)
    expect(r.monthlyWithholding).toBe(0)
    expect(r.annualTaxable).toBe(36000)
    expect(r.annualTax).toBe(0)
  })
})

describe('MWE: holiday, overtime, night-differential and hazard pay are exempt; other pay is taxed', () => {
  // ₱755 × 365 ÷ 12 = 22,964.58 exempt + ₱4,000 OT/holiday pay exempt; ₱30,000 commissions taxable.
  //   Monthly: (30,000 − 20,833) × 15% = 1,375.05
  //   Annual: 30,000 × 12 = 360,000 + (100,000 − 90,000) bonus = 370,000 -> (370,000 − 250,000) × 15% = 18,000.00
  //   Withheld 12 × 1,375.05 = 16,500.60 -> December extra 1,499.40
  const r = estimateEmployee({
    mwe: true, mweDailyRate: 755, payFactor: 365, mweExtraPay: 4000, monthlyAllowances: 30000, bonusesAnnual: 100000,
  })
  it('exempt pay = minimum wage + extra pay', () => {
    expect(r.exemptPay).toBe(26964.58)
    expect(row(r.rows, /^Holiday, overtime/).value).toBe(4000)
  })
  it('only the commissions and the bonus above ₱90,000 are taxed', () => {
    expect(r.monthlyTaxable).toBe(30000)
    expect(r.monthlyWithholding).toBe(1375.05)
    expect(r.annualTaxable).toBe(370000)
    expect(r.annualTax).toBe(18000)
    expect(r.yearEndDifference).toBe(1499.4)
  })
  it('extra pay is ignored when the switch is off (not a minimum wage earner)', () => {
    const off = estimateEmployee({ monthlyBasic: 25000, mweExtraPay: 4000 })
    expect(off.exemptPay).toBe(0)
    expect(off.monthlyTaxable).toBe(22925)
  })
})

describe('mixed-income profiles do not apply a saved minimum-wage switch', () => {
  it('compensationForMixed taxes the ₱25,000 basic even if mwe was saved on', () => {
    const c = compensationForMixed({}, { monthlyBasic: 25000, mwe: true, mweDailyRate: 755, payFactor: 365 })
    // WH:WS-05: monthly taxable 22,925 × 12 = 275,100; tax 3,765
    expect(c.taxable).toBe(275100)
    expect(c.withheld).toBe(3765)
  })
})

describe('paid days a year: only 365, 313 and 261 are accepted', () => {
  it('261 days (five-day week): ₱755 × 261 ÷ 12 = ₱16,421.25', () => {
    expect(estimateEmployee({ mwe: true, mweDailyRate: 755, payFactor: 261 }).minimumWage).toBe(16421.25)
  })
  it('any other number throws', () => {
    expect(() => estimateEmployee({ mwe: true, mweDailyRate: 755, payFactor: 300 })).toThrow(RangeError)
  })
})

describe('rulebook: mweExempt is wired and cites RR 11-2018 and Soriano', () => {
  const rule = wcomp.mweExempt
  it('pay factors come from the rule', () => {
    expect(rule.value.payFactors).toEqual([365, 313, 261])
  })
  it('legal basis: RR 11-2018 and Soriano (G.R. No. 184450), not RR 10-2008', () => {
    const basis = rule.legalBasis.join(' | ')
    expect(basis).toMatch(/RR 11-2018/)
    expect(basis).toMatch(/Soriano v\. Secretary of Finance, G\.R\. No\. 184450, Jan(uary)? 24, 2017/)
    expect(basis).not.toMatch(/RR 10-2008/)
  })
  it('the employee estimator lists the MWE rule in its legal basis when the switch is on', () => {
    const r = estimateEmployee({ mwe: true, mweDailyRate: 755, payFactor: 365 })
    expect(r.references.join(' | ')).toMatch(/Soriano/)
  })
})
