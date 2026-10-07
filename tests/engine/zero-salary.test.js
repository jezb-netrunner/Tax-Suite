import { describe, it, expect } from 'vitest'
import { estimateEmployee } from '../../src/engine/estimators/employee.js'
import { estimatePayroll, withholdingCalculator } from '../../src/engine/estimators/payroll.js'
import { sssEmployee, philhealthMonthly, employeeMandatoryDeductions } from '../../src/engine/estimators/contributions.js'

// L09: a ₱0 or blank salary computes no contributions: no −₱250 take-home and
// no ₱260 employer cost (the screens show "Enter a salary" instead).

const zero = { sss: 0, sssMsc: 0, philhealth: 0, pagibig: 0, total: 0 }

describe('L09 ₱0 salary', () => {
  it('Employee: no contributions, take-home ₱0 (not −₱250)', () => {
    const r = estimateEmployee({ monthlyBasic: 0 })
    expect(r.deductions).toEqual(zero)
    expect(r.monthlyTakeHome).toBe(0)
    expect(r.annualTax).toBe(0)
  })
  it('Payroll: employer cost ₱0 (not ₱260: SSS EC ₱10 + PhilHealth ₱250)', () => {
    const r = estimatePayroll({ monthlyBasic: 0 })
    expect(r.employerContributions).toEqual({ sss: 0, philhealth: 0, pagibig: 0, total: 0 })
    expect(r.totalMonthlyCost).toBe(0)
  })
  it('a blank salary (no figure) is the same', () => {
    expect(estimateEmployee({}).monthlyTakeHome).toBe(0)
    expect(estimatePayroll({}).totalMonthlyCost).toBe(0)
  })
  it('a minimum wage earner with no daily rate yet: nothing computed', () => {
    expect(estimatePayroll({ mwe: true, payFactor: 365 }).totalMonthlyCost).toBe(0)
  })
  it('primitives: no EC and no PhilHealth floor without pay', () => {
    expect(sssEmployee(0)).toMatchObject({ msc: 0, employee: 0, employer: 0, ec: 0, total: 0 })
    expect(philhealthMonthly(0)).toEqual({ base: 0, premium: 0, employee: 0, employer: 0 })
    expect(employeeMandatoryDeductions(0)).toEqual(zero)
  })
  it('Tools "start from gross" with ₱0: taxable ₱0, withholding ₱0', () => {
    const c = withholdingCalculator({ amount: 0, mode: 'gross' })
    expect(c.deductionsPerPeriod).toBe(0)
    expect(c.perPeriodWithholding).toBe(0)
  })
  it('floors still apply to any real pay: ₱8,000 basic -> PhilHealth ₱500 premium (WH:WS-13), SSS MSC ₱5,000 at ₱4,000 (WH:WS-11)', () => {
    expect(philhealthMonthly(8000).premium).toBe(500)
    expect(sssEmployee(4000).total).toBe(760)
  })
})
