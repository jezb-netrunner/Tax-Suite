import { describe, it, expect } from 'vitest'
import { estimateEmployee } from '../../src/engine/estimators/employee.js'
import { estimatePayroll, withholdingCalculator } from '../../src/engine/estimators/payroll.js'

// L08 (owner default): a pay-period choice (monthly, semi-monthly, weekly,
// daily) on the Employee and Payroll tabs and the Tools withholding
// calculator, showing the per-payday withholding from the matching
// RR 11-2018 table. Daily-paid staff use the paid days a year (365/313/261).

const row = (rows, re) => rows.find(x => re.test(x.label))

describe('Tools calculator, "I have taxable pay": the matching table at the worksheet edges', () => {
  const wh = (amount, payPeriod, payFactor) => withholdingCalculator({ amount, mode: 'taxable', payPeriod, payFactor }).perPeriodWithholding
  it('WH:WS-01 monthly: ₱20,833 -> 0; ₱66,667 -> 8,541.80; ₱1,000,000 -> 300,208.35', () => {
    expect(wh(20833, 'monthly')).toBe(0)
    expect(wh(66667, 'monthly')).toBe(8541.8)
    expect(wh(1000000, 'monthly')).toBe(300208.35)
  })
  it('WH:WS-02 semi-monthly: ₱16,667 -> 937.50; ₱33,333 -> 4,270.70; ₱400,000 -> 115,104.15', () => {
    expect(wh(16667, 'semiMonthly')).toBe(937.5)
    expect(wh(33333, 'semiMonthly')).toBe(4270.7)
    expect(wh(400000, 'semiMonthly')).toBe(115104.15)
  })
  it('WH:WS-03 weekly: ₱7,692 -> 432.60; ₱15,385 -> 1,971.20; ₱200,000 -> 58,509.55', () => {
    expect(wh(7692, 'weekly')).toBe(432.6)
    expect(wh(15385, 'weekly')).toBe(1971.2)
    expect(wh(200000, 'weekly')).toBe(58509.55)
  })
  it('WH:WS-04 daily: ₱685 -> 0; ₱1,096 -> 61.65; ₱2,192 -> 280.85; ₱30,000 -> 8,863.00', () => {
    expect(wh(685, 'daily', 313)).toBe(0)
    expect(wh(1096, 'daily', 313)).toBe(61.65)
    expect(wh(2192, 'daily', 261)).toBe(280.85)
    expect(wh(30000, 'daily', 365)).toBe(8863)
  })
})

describe('Tools calculator, "start from gross": employee shares spread over the paydays', () => {
  it('monthly ₱50,000 gross: shares ₱3,200, taxable ₱46,800, withholding ₱4,568.40 (unchanged)', () => {
    const c = withholdingCalculator({ amount: 50000, mode: 'gross', payPeriod: 'monthly' })
    expect(c.deductionsPerPeriod).toBe(3200)
    expect(c.perPeriodTaxable).toBe(46800)
    expect(c.perPeriodWithholding).toBe(4568.4)
  })
  it('semi-monthly ₱25,000 a payday: month ₱50,000, shares ₱1,600 a payday, taxable ₱23,400, withholding ₱2,284.10', () => {
    const c = withholdingCalculator({ amount: 25000, mode: 'gross', payPeriod: 'semiMonthly' })
    expect(c.monthlyGross).toBe(50000)
    expect(c.deductionsPerPeriod).toBe(1600)
    expect(c.perPeriodTaxable).toBe(23400)
    expect(c.perPeriodWithholding).toBe(2284.1)
  })
  it('daily ₱1,000 a day, 313 days: month ₱26,083.33, shares ₱2,152.09 -> ₱82.51 a day, taxable ₱917.49, withholding ₱34.87', () => {
    const c = withholdingCalculator({ amount: 1000, mode: 'gross', payPeriod: 'daily', payFactor: 313 })
    expect(c.monthlyGross).toBe(26083.33)
    expect(c.deductionsPerPeriod).toBe(82.51)
    expect(c.perPeriodTaxable).toBe(917.49)
    expect(c.perPeriodWithholding).toBe(34.87)
  })
})

describe('Employee tab: ₱25,000 a month (WH:WS-05) by pay period', () => {
  it('monthly: ₱313.80 a payday, 12 × 313.80 = ₱3,765.60 a year (unchanged)', () => {
    const r = estimateEmployee({ monthlyBasic: 25000 })
    expect(r.perPeriodWithholding).toBe(313.8)
    expect(r.monthlyWithholding).toBe(313.8)
    expect(r.withheldYear).toBe(3765.6)
  })
  it('semi-monthly: taxable ₱11,462.50 a payday -> ₱156.83; ₱313.66 a month; 24 paydays ₱3,763.92; December extra ₱1.08', () => {
    const r = estimateEmployee({ monthlyBasic: 25000, payPeriod: 'semiMonthly' })
    expect(r.perPeriodTaxable).toBe(11462.5)
    expect(r.perPeriodWithholding).toBe(156.83)
    expect(r.monthlyWithholding).toBe(313.66)
    expect(r.withheldYear).toBe(3763.92)
    expect(r.yearEndDifference).toBe(1.08)
    expect(row(r.rows, /^Withholding per payday/).label).toBe('Withholding per payday (semi-monthly table)')
    expect(row(r.annualRows, /^Total withheld over the year/).label).toBe('Total withheld over the year (24 paydays)')
  })
  it('weekly: ₱5,290.38 a week -> ₱72.36; 52 weeks ₱3,762.72', () => {
    const r = estimateEmployee({ monthlyBasic: 25000, payPeriod: 'weekly' })
    expect(r.perPeriodTaxable).toBe(5290.38)
    expect(r.perPeriodWithholding).toBe(72.36)
    expect(r.monthlyWithholding).toBe(313.56)
    expect(r.withheldYear).toBe(3762.72)
  })
  it('daily, 313 paid days: ₱878.91 a day -> ₱29.09; 313 days ₱9,105.17 (refund ₱5,340.17 in December)', () => {
    const r = estimateEmployee({ monthlyBasic: 25000, payPeriod: 'daily', payFactor: 313 })
    expect(r.perPeriodTaxable).toBe(878.91)
    expect(r.perPeriodWithholding).toBe(29.09)
    expect(r.monthlyWithholding).toBe(758.76)
    expect(r.withheldYear).toBe(9105.17)
    expect(r.yearEndDifference).toBe(-5340.17)
  })
  it('daily, 261 paid days: ₱1,054.02 a day -> ₱55.35', () => {
    const r = estimateEmployee({ monthlyBasic: 25000, payPeriod: 'daily', payFactor: 261 })
    expect(r.perPeriodTaxable).toBe(1054.02)
    expect(r.perPeriodWithholding).toBe(55.35)
  })
})

describe('Payroll tab uses the same per-payday figures', () => {
  it('semi-monthly ₱25,000: ₱156.83 a payday, ₱313.66 to remit for the month', () => {
    const r = estimatePayroll({ monthlyBasic: 25000, payPeriod: 'semiMonthly' })
    expect(r.perPeriodTaxable).toBe(11462.5)
    expect(r.perPeriodWithholding).toBe(156.83)
    expect(r.monthlyWithholding).toBe(313.66)
    expect(row(r.rows, /^Withholding per payday/).value).toBe(156.83)
  })
  it('daily-paid with 261 days uses the factor (not a fixed 313)', () => {
    const r = estimatePayroll({ monthlyBasic: 25000, payPeriod: 'daily', payFactor: 261 })
    expect(r.perPeriodWithholding).toBe(55.35)
  })
  it('the old "period" input name still works', () => {
    expect(estimatePayroll({ monthlyBasic: 25000, period: 'semiMonthly' }).perPeriodWithholding).toBe(156.83)
  })
})
