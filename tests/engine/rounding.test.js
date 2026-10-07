import { describe, it, expect } from 'vitest'
import { estimateIndividual, gradTax } from '../../src/engine/estimators/individual.js'
import { estimateCorporation } from '../../src/engine/estimators/corporation.js'
import { estimateEmployee } from '../../src/engine/estimators/employee.js'
import { estimatePayroll } from '../../src/engine/estimators/payroll.js'
import { estimatePenalty } from '../../src/engine/estimators/penalties.js'
import { philhealthMonthly, employeeMandatoryDeductions, employerContributions } from '../../src/engine/estimators/contributions.js'
import { bracketTax } from '../../src/engine/tax.js'

// M03: money is exact, return figures are whole pesos per BIR form line
// (49 centavos or less drop, 50 or more round up) with totals added from the
// rounded lines, and payslip / withholding / penalty lines are rounded half-up
// to the centavo. Expected values are from REVIEW.md section 3, re-derived with
// Python fractions where the owner's rounding decision applies (see tdd.md).

const opt = (r, key) => r.options.find(o => o.key === key)

describe('TI:WS-21 BIR whole-peso rounding per line', () => {
  it('₱416,761 OSD: OSD ₱166,704, net ₱250,057, income tax ₱9 (not ₱8.49)', () => {
    const r = estimateIndividual({ gross: 416761 })
    const o = opt(r, 'osd')
    expect(o.incomeTax).toBe(9)
    const rows = r.rowsFor(o)
    expect(rows.find(x => x.label.startsWith('Less: Optional Standard Deduction')).value).toBe(-166704)
    expect(rows.find(x => x.label === 'Net taxable business income').value).toBe(250057)
  })
  it('₱416,684 OSD card: ₱2 + ₱12,501 = ₱12,503 (parts add up)', () => {
    const o = opt(estimateIndividual({ gross: 416684 }), 'osd')
    expect(o.incomeTax).toBe(2)
    expect(o.businessTax.amount).toBe(12501)
    expect(o.total).toBe(12503)
  })
})

describe('TI:WS-23 / GAP:GW-2 half-peso total is not rounded down', () => {
  const r = estimateIndividual({ gross: 419165, expenses: 167788 })
  it('itemized is cheapest at ₱12,782 = ₱207 income tax + ₱12,575 percentage tax', () => {
    expect(r.best.key).toBe('itemized')
    expect(r.best.incomeTax).toBe(207)
    expect(r.best.businessTax.amount).toBe(12575)
    expect(r.best.total).toBe(12782)
  })
  it('other options: OSD ₱225 + ₱12,575 = ₱12,800; 8% ₱13,533', () => {
    expect(opt(r, 'osd').total).toBe(12800)
    expect(opt(r, '8pct').total).toBe(13533)
    expect(r.savingsVsNext).toBe(18)
  })
})

describe('GAP:GW-1 itemized card with whole-peso inputs', () => {
  it('₱375,865 gross, ₱125,288 expenses: ₱87 + ₱11,276 = ₱11,363', () => {
    const o = opt(estimateIndividual({ gross: 375865, expenses: 125288 }), 'itemized')
    expect(o.incomeTax).toBe(87)
    expect(o.businessTax.amount).toBe(11276)
    expect(o.total).toBe(11363)
  })
})

describe('BUG:W2 gross typed with centavos (re-derived for whole-peso lines)', () => {
  // Gross line ₱480,000.50 -> ₱480,001. 8%: 230,001 × 8% = 18,400.08 -> ₱18,400.
  // OSD: 192,000.40 -> 192,000; net 288,001; tax 5,700.15 -> 5,700; PT 14,400.03 -> 14,400.
  // Itemized: net 300,001; tax 7,500.15 -> 7,500; + 14,400 = 21,900.
  const r = estimateIndividual({ gross: 480000.5, expenses: 180000 })
  it('8% is cheapest at ₱18,400 and no VAT warning', () => {
    expect(r.overThreshold).toBe(false)
    expect(r.best.key).toBe('8pct')
    expect(r.best.total).toBe(18400)
    expect(opt(r, 'osd').total).toBe(20100)
    expect(opt(r, 'itemized').total).toBe(21900)
  })
})

describe('option cards always foot (sweep of grosses)', () => {
  // Independent whole-peso oracle in integer pesos (TRAIN 2023 table).
  function grad(t) {
    if (t <= 250000) return 0
    if (t <= 400000) return (t - 250000) * 15 // ×100 centavos scale, see below
    if (t <= 800000) return 2250000 + (t - 400000) * 20
    if (t <= 2000000) return 10250000 + (t - 800000) * 25
    if (t <= 8000000) return 40250000 + (t - 2000000) * 30
    return 220250000 + (t - 8000000) * 35
  }
  const peso = c => Math.floor((c + 50) / 100) // centavos -> whole pesos, half-up (c >= 0)
  it('parts add to the total and match per-line rounding for every gross', () => {
    let checked = 0
    for (let gross = 250001; gross <= 3000000; gross += 997) {
      for (const expShare of [0, 0.3, 0.55]) {
        const expenses = Math.floor(gross * expShare)
        const r = estimateIndividual({ gross, expenses })
        for (const o of r.options) {
          const parts = o.incomeTax + (o.businessTax.amount || 0)
          expect(o.total).toBe(parts)
          expect(Number.isInteger(o.total)).toBe(true)
        }
        const osdNet = gross - peso(gross * 40)
        const pt = peso(gross * 3)
        expect(opt(r, 'osd').incomeTax).toBe(peso(grad(osdNet)))
        expect(opt(r, 'osd').businessTax.amount).toBe(pt)
        expect(opt(r, 'itemized').incomeTax).toBe(peso(grad(Math.max(0, gross - expenses))))
        expect(opt(r, '8pct').total).toBe(peso((gross - 250000) * 8))
        checked++
      }
    }
    expect(checked).toBeGreaterThan(8000)
  })
})

describe('mixed income lines are whole pesos', () => {
  it('compensation tax and business tax add up on the 8% card', () => {
    const r = estimateIndividual({
      gross: 416684, mixed: true, compensationTaxable: 300000.5, compensationWithheld: 7500.49,
    })
    const o = opt(r, '8pct')
    // comp line 300,001 -> tax 7,500.15 -> 7,500; business 416,684 × 8% = 33,334.72 -> 33,335
    expect(o.incomeTax).toBe(7500 + 33335)
    expect(o.total).toBe(40835)
    // credits are whole-peso lines too: 7,500.49 -> 7,500
    expect(r.credits).toBe(7500)
  })
})

describe('graduated table helper is exact', () => {
  it('TI:WS-01 zero band edge', () => {
    expect(gradTax(250000)).toBe(0)
    expect(gradTax(250001)).toBe(0.15)
    expect(gradTax(250000.01)).toBe(0) // 0.0015 rounds to ₱0.00
  })
  it('bracketTax rounds once, half-up to the centavo', () => {
    const t = [{ over: 0, base: 0, rate: 0 }, { over: 20833, base: 0, rate: 0.15 }]
    expect(bracketTax(t, 20854.3)).toBe(3.2)
    expect(bracketTax(t, 20835.77)).toBe(0.42)
  })
})

describe('corporate 1702 lines are whole pesos', () => {
  it('25% of ₱5,000,001 = ₱1,250,000.25 -> ₱1,250,000', () => {
    const r = estimateCorporation({
      grossSales: 20000001, costOfSales: 0, opex: 15000000, totalAssets: 50000000, taxYear: 2026,
    })
    expect(r.taxableIncome).toBe(5000001)
    expect(r.rcit).toBe(1250000)
    expect(r.incomeTaxDue).toBe(1250000)
  })
  it('inputs with centavos round per line and MCIT is whole pesos', () => {
    const r = estimateCorporation({
      grossSales: 1234567.5, costOfSales: 234567.49, opex: 999000, totalAssets: 1000000,
      cwt: 100.5, registrationYear: 2000, taxYear: 2026,
    })
    // sales 1,234,568; cost 234,567; gross income 1,000,001; opex 999,000; TI 1,001
    expect(r.grossIncome).toBe(1000001)
    expect(r.taxableIncome).toBe(1001)
    expect(r.rcit).toBe(200)            // 20% × 1,001 = 200.20
    expect(r.mcit).toBe(20000)          // 2% × 1,000,001 = 20,000.02
    expect(r.incomeTaxDue).toBe(20000)
    expect(r.pct).toBe(37037)           // 3% × 1,234,568 = 37,037.04
    expect(r.netPayable).toBe(20000 - 101)
    expect(r.totalAnnualTax).toBe(57037)
  })
})

describe('WH:WS-20 centavo rounding and footing (payslips)', () => {
  it('₱22,748: withholding 21.30 × 15% = 3.195 -> ₱3.20', () => {
    const r = estimateEmployee({ monthlyBasic: 22748 })
    expect(r.deductions.philhealth).toBe(568.7)
    expect(r.monthlyTaxable).toBe(20854.3)
    expect(r.monthlyWithholding).toBe(3.2)
  })
  it('₱22,729: monthly ₱0.42 and the 12-month total is 12 × ₱0.42 = ₱5.04', () => {
    const r = estimateEmployee({ monthlyBasic: 22729 })
    expect(r.deductions.philhealth).toBe(568.23)
    expect(r.monthlyTaxable).toBe(20835.77)
    expect(r.monthlyWithholding).toBe(0.42)
    expect(r.annualRows.find(x => x.label === 'Total withheld over 12 months').value).toBe(5.04)
  })
  it('PhilHealth shares add up to the premium: ₱25,001 and ₱10,241', () => {
    expect(philhealthMonthly(25001)).toEqual({ base: 25001, premium: 1250.05, employee: 625.03, employer: 625.02 })
    expect(philhealthMonthly(10241)).toEqual({ base: 10241, premium: 512.05, employee: 256.03, employer: 256.02 })
  })
  it('payslip foots: ₱22,740 take-home = pay − deductions − ₱2.03 withholding', () => {
    const r = estimateEmployee({ monthlyBasic: 22740 })
    expect(r.monthlyWithholding).toBe(2.03)
    expect(r.monthlyTakeHome).toBe(20844.47)
    expect(r.annualRows.find(x => x.label === 'Total withheld over 12 months').value).toBe(24.36)
  })
})

describe('PhilHealth ₱10,001 (owner default: employee = premium ÷ 2 half-up, employer = the rest)', () => {
  it('premium ₱500.05 = ₱250.03 employee + ₱250.02 employer', () => {
    const p = philhealthMonthly(10001)
    expect(p.premium).toBe(500.05)
    expect(p.employee).toBe(250.03)
    expect(p.employer).toBe(250.02)
    expect(employeeMandatoryDeductions(10001).philhealth).toBe(250.03)
    expect(employerContributions(10001).philhealth).toBe(250.02)
  })
  it('shares foot for every salary from ₱10,001 to ₱11,000 and around the ceiling', () => {
    for (const s of [...Array.from({ length: 1000 }, (_, i) => 10001 + i), 33333, 45555, 99999, 100000]) {
      const p = philhealthMonthly(s)
      expect(Math.round((p.employee + p.employer) * 100)).toBe(Math.round(p.premium * 100))
      expect(p.employee - p.employer).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('payroll lines are centavo-exact', () => {
  it('₱22,748 employee: withholding ₱3.20, employer cost foots', () => {
    const r = estimatePayroll({ monthlyBasic: 22748 })
    expect(r.monthlyWithholding).toBe(3.2)
    expect(r.perPeriodWithholding).toBe(3.2)
    expect(r.employerContributions.philhealth).toBe(568.7)
    expect(r.totalMonthlyCost).toBe(22748 + r.employerContributions.total)
  })
  it('weekly period: per-period taxable and withholding are centavo amounts', () => {
    const r = estimatePayroll({ monthlyBasic: 30000, period: 'weekly' })
    // monthly taxable 27,550 × 12/52 = 6,357.6923… -> 6,357.69; (6,357.69 − 4,808) × 15% = 232.4535 -> 232.45
    expect(r.perPeriodWithholding).toBe(232.45)
    // monthly = 232.45 × 52/12 = 1,007.2833… -> 1,007.28
    expect(r.monthlyWithholding).toBe(1007.28)
  })
})

describe('penalty lines are centavo-exact and the total is their sum', () => {
  it('TB:W17 ₱12,345.67, 30 days, medium/large: total ₱20,553.86', () => {
    const r = estimatePenalty({ taxDue: 12345.67, daysLate: 30, microSmall: false })
    expect(r.surcharge).toBe(3086.42)
    expect(r.interest).toBe(121.77)
    expect(r.compromise).toBe(5000)
    expect(r.total).toBe(20553.86)
  })
  it('TB:W12 ₱33,333, 17 days: total ₱51,852.55', () => {
    const r = estimatePenalty({ taxDue: 33333, daysLate: 17 })
    expect(r.surcharge).toBe(8333.25)
    expect(r.interest).toBe(186.3)
    expect(r.total).toBe(51852.55)
  })
  it('TB:W13 ₱5,000,001, 365 days: total ₱6,900,001.37', () => {
    const r = estimatePenalty({ taxDue: 5000001, daysLate: 365 })
    expect(r.surcharge).toBe(1250000.25)
    expect(r.interest).toBe(600000.12)
    expect(r.compromise).toBe(50000)
    expect(r.total).toBe(6900001.37)
  })
  it('huge amounts stay exact (BigInt): ₱999,999,999,999.99 × 12% × 3,650 days', () => {
    const r = estimatePenalty({ taxDue: 999999999999.99, daysLate: 3650 })
    expect(r.interest).toBe(1199999999999.99)
  })
})
