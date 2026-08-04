import { describe, it, expect } from 'vitest'
import { estimateEmployee } from '../../src/engine/estimators/employee.js'
import { employeeMandatoryDeductions, sssEmployee, philhealthMonthly, pagibigMonthly } from '../../src/engine/estimators/contributions.js'

// Hand-worked: ₱30,000/month employee, 13th month ₱30,000 (fully excluded, < ₱90k cap)
//   SSS EE:        MSC 30,000 × 5%  = 1,500
//   PhilHealth EE:  30,000 × 5% / 2 =   750
//   Pag-IBIG EE:    10,000 × 2%     =   200      → deductions 2,450
//   Monthly taxable = 27,550
//   Monthly WH (2023 table): (27,550 − 20,833) × 15% = 1,007.55
//   Annual taxable = 330,600 → tax = (330,600 − 250,000) × 15% = 12,090
describe('employee estimator — ₱30k/month hand-worked', () => {
  const r = estimateEmployee({ monthlyBasic: 30000, monthlyAllowances: 0, bonusesAnnual: 30000 })
  it('mandatory deductions', () => {
    expect(r.deductions.sss).toBeCloseTo(1500)
    expect(r.deductions.philhealth).toBeCloseTo(750)
    expect(r.deductions.pagibig).toBeCloseTo(200)
    expect(r.deductions.total).toBeCloseTo(2450)
  })
  it('monthly taxable and withholding', () => {
    expect(r.monthlyTaxable).toBeCloseTo(27550)
    expect(r.monthlyWithholding).toBeCloseTo(1007.55, 1)
  })
  it('annualization matches the graduated table', () => {
    expect(r.annualTaxable).toBeCloseTo(330600)
    expect(r.annualTax).toBeCloseTo(12090)
    // withholding tracks annual tax to within a peso × 12 rounding
    expect(Math.abs(r.yearEndDifference)).toBeLessThan(5)
  })
  it('bonus above the ₱90k cap becomes taxable', () => {
    const r2 = estimateEmployee({ monthlyBasic: 100000, bonusesAnnual: 150000 })
    // taxable bonus = 60,000
    expect(r2.annualTaxable).toBeCloseTo(r2.monthlyTaxable * 12 + 60000)
  })
  it('minimum-wage-level pay withholds nothing', () => {
    const r3 = estimateEmployee({ monthlyBasic: 15000 })
    expect(r3.monthlyWithholding).toBe(0)
  })
})

describe('contribution primitives', () => {
  it('SSS MSC clamps to floor and ceiling', () => {
    expect(sssEmployee(3000).msc).toBe(5000)
    expect(sssEmployee(100000).msc).toBe(35000)
  })
  it('SSS employer share includes EC', () => {
    const s = sssEmployee(30000)
    expect(s.employer).toBeCloseTo(3000 + 30)
    const low = sssEmployee(10000)
    expect(low.ec).toBe(10)
  })
  it('PhilHealth clamps to ₱10k–₱100k income band', () => {
    expect(philhealthMonthly(5000).premium).toBeCloseTo(500)
    expect(philhealthMonthly(200000).premium).toBeCloseTo(5000)
  })
  it('Pag-IBIG caps fund salary at ₱10,000', () => {
    expect(pagibigMonthly(30000).employee).toBeCloseTo(200)
    expect(pagibigMonthly(30000).employer).toBeCloseTo(200)
    expect(pagibigMonthly(1200).employee).toBeCloseTo(12) // 1% below ₱1,500
  })
  it('aggregate deductions', () => {
    expect(employeeMandatoryDeductions(30000).total).toBeCloseTo(2450)
  })
})
