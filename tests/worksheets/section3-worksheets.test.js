// M30: REVIEW.md section 3 worksheets that no other test file named. Each
// test is titled with the worksheet ID and checks the hand-computed result
// exactly (centavos as exact Numbers, never toBeCloseTo), as adjusted by the
// owner's decisions (section 4.3): current-year rates only (1), whole-peso
// return lines and centavo payslips (3).
import { describe, it, expect } from 'vitest'
import incomeTax from '../../src/data/rules/income-tax.json'
import obligationsData from '../../src/data/rules/obligations.json'
import { bracketTax } from '../../src/engine/tax.js'
import { toCentavos, toWholePesos, fromCentavos } from '../../src/lib/money.js'
import { parseMoneyInput } from '../../src/lib/format.js'
import { estimateIndividual, RATES_NOTE } from '../../src/engine/estimators/individual.js'
import { estimateEmployee } from '../../src/engine/estimators/employee.js'
import { estimateCorporation } from '../../src/engine/estimators/corporation.js'
import { withholdingCalculator } from '../../src/engine/estimators/payroll.js'
import { pagibigMonthly } from '../../src/engine/estimators/contributions.js'
import { projectYear } from '../../src/engine/estimators/projector.js'
import { generateDeadlines } from '../../src/engine/deadlines.js'
import { defaultProfile } from '../../src/engine/profile.js'
import { HOLIDAY_SET } from '../../src/lib/deadlineData.js'
import { fromISO, iso } from '../../src/engine/dates.js'

const BR = incomeTax.graduatedBrackets.value
const OB = obligationsData.obligations
// Graduated tax to the centavo, and as a whole-peso return line.
const tax = t => bracketTax(BR, t)
const line = t => fromCentavos(toWholePesos(toCentavos(tax(t))))

function due(profile, id, fromS, toS, rawS) {
  const list = generateDeadlines(OB, profile, { from: fromISO(fromS), to: fromISO(toS), holidays: HOLIDAY_SET, refDate: fromISO(fromS) })
  const d = list.find(x => x.obligation.id === id && iso(x.rawDate) === rawS)
  return d ? iso(d.date) : null
}
const individual = o => ({ ...defaultProfile('individual'), name: 'T', ...o })
const corporation = o => ({ ...defaultProfile('corporation'), name: 'C', ...o })

describe('3.1 Individual income tax', () => {
  it('TI:WS-02 ₱400,000 bracket edge: ₱22,500; ₱400,000.01 gives ₱22,500.002, so ₱22,500.00 to the centavo and on the return', () => {
    expect(tax(400000)).toBe(22500)
    expect(tax(400000.01)).toBe(22500)
    expect(line(400000.01)).toBe(22500)
  })
  it('TI:WS-03 ₱800,000 edge: ₱102,500; ₱800,000.01 gives ₱102,500.0025 -> ₱102,500.00', () => {
    expect(tax(800000)).toBe(102500)
    expect(tax(800000.01)).toBe(102500)
  })
  it('TI:WS-04 ₱2,000,000 edge: ₱402,500; ₱2,000,000.01 gives ₱402,500.003 -> ₱402,500.00', () => {
    expect(tax(2000000)).toBe(402500)
    expect(tax(2000000.01)).toBe(402500)
  })
  it('TI:WS-05 ₱8,000,000 edge: ₱2,202,500; ₱8,000,000.01 gives ₱2,202,500.0035 -> ₱2,202,500.00', () => {
    expect(tax(8000000)).toBe(2202500)
    expect(tax(8000000.01)).toBe(2202500)
  })
  it('TI:WS-06 a loss is ₱0; ₱1,000,000,000,000 gives ₱349,999,402,500; ₱9,000,000,000,000,000 cannot be entered (decision 2)', () => {
    expect(tax(-100000)).toBe(0)
    expect(tax(1000000000000)).toBe(349999402500)
    const r = parseMoneyInput('9,000,000,000,000,000')
    expect(r.ok).toBe(false)
    expect(r.error).toBe('That amount is too large. The most this box takes is ₱999,999,999,999.99.')
  })
  it('TI:WS-15 exactly ₱3,000,000 gross: 8% is available and best at ₱220,000', () => {
    const r = estimateIndividual({ gross: 3000000, expenses: 0, taxYear: 2026 })
    expect(r.overThreshold).toBe(false)
    expect(r.options[0].eligible).toBe(true)
    expect(r.options[0].total).toBe(220000)
    expect(r.best.key).toBe('8pct')
  })
  it('TI:WS-17 / TI:WS-18 / TI:WS-19 earlier years are not computed (decision 1): results are labelled with the year and say why', () => {
    const r = estimateIndividual({ gross: 500000, expenses: 0, taxYear: 2026 })
    expect(r.ratesLabel).toBe('Rates for taxable year 2026')
    expect(r.ratesNote).toBe(RATES_NOTE)
    expect(RATES_NOTE).toBe('Earlier years used different rates (the 2018-2022 graduated table, and a 1% percentage tax from July 2020 to June 2023) and are not supported here.')
    // The TY2023+ table the app uses: ₱1,000,000 -> ₱102,500 + 25% × 200,000 = ₱152,500 (not the 2018-2022 ₱190,000).
    expect(tax(1000000)).toBe(152500)
  })
  it('TI:WS-22 compensation side: ₱50,000 a month and ₱100,000 bonuses: annual tax ₱56,820, withholding ₱4,568.40 a month, year-end extra ₱1,999.20', () => {
    const e = estimateEmployee({ monthlyBasic: 50000, bonusesAnnual: 100000 })
    expect(e.annualTax).toBe(56820)
    expect(e.monthlyWithholding).toBe(4568.4)
    expect(e.yearEndDifference).toBe(1999.2)
  })
})

describe('3.2 Percentage tax', () => {
  it('TB:W14 ₱600,000 sales a quarter (₱2,400,000 a year), graduated: percentage tax ₱72,000 at the current 3%; 2022 and 2023 are not supported (decision 1)', () => {
    const r = estimateIndividual({ gross: 2400000, expenses: 0, taxYear: 2026 })
    expect(r.options[1].businessTax).toEqual({ kind: 'pct', amount: 72000 })
    expect(RATES_NOTE).toContain('1% percentage tax from July 2020 to June 2023')
  })
})

describe('3.3 Deadlines', () => {
  it('DL:WS-02 2550Q Q3 2026 (VAT sole prop): due Mon Oct 26, 2026 (Oct 25 is a Sunday)', () => {
    expect(due(individual({ vatRegistered: true, regime: 'graduated_osd' }), 'bir-2550q', '2026-07-01', '2026-12-31', '2026-10-25')).toBe('2026-10-26')
  })
  it('DL:WS-06 1601-C December 2026: due Fri Jan 15, 2027', () => {
    expect(due(individual({ hasEmployees: true }), 'bir-1601c', '2026-12-01', '2027-02-28', '2027-01-15')).toBe('2027-01-15')
  })
  it('DL:WS-09 SSS employer, July 2026: Aug 31 is National Heroes Day, so due Tue Sep 1, 2026', () => {
    expect(due(individual({ hasEmployees: true }), 'sss-employer', '2026-08-01', '2026-10-31', '2026-08-31')).toBe('2026-09-01')
  })
  it('DL:WS-11 2551Q, fiscal year ending May, Q3 Dec 2026-Feb 2027: Mar 25, 2027 is Maundy Thursday, so due Mon Mar 29, 2027', () => {
    const p = corporation({ fiscalYearEndMonth: 5, vatRegistered: false })
    expect(due(p, 'bir-2551q', '2027-01-01', '2027-06-30', '2027-03-25')).toBe('2027-03-29')
  })
  it('DL:WS-12 1702-RT, fiscal year ending Jun 30, 2026: due Thu Oct 15, 2026', () => {
    expect(due(corporation({ fiscalYearEndMonth: 6 }), 'bir-1702-annual', '2026-07-01', '2026-12-31', '2026-10-15')).toBe('2026-10-15')
  })
})

describe('3.4 Withholding, contributions and corporate tax', () => {
  it('WH:WS-06 employee ₱50,000 a month: withholding ₱4,568.40 a month, ₱54,820.00 a year', () => {
    const e = estimateEmployee({ monthlyBasic: 50000 })
    expect(e.monthlyWithholding).toBe(4568.4)
    expect(e.annualTax).toBe(54820)
    expect(e.withheldYear).toBe(54820.8)
  })
  it('WH:WS-07 ₱100,000 a month with ₱100,000 13th month: ₱15,762.55 a month, ₱191,650.00 a year, December extra ₱2,499.40', () => {
    const e = estimateEmployee({ monthlyBasic: 100000, bonusesAnnual: 100000 })
    expect(e.monthlyWithholding).toBe(15762.55)
    expect(e.annualTax).toBe(191650)
    expect(e.yearEndDifference).toBe(2499.4)
  })
  it('WH:WS-14 Pag-IBIG: ₱1,500 -> 15/30; ₱1,500.01 -> 30.00/30.00; ₱1,501 -> 30.02/30.02; ₱30,000 -> 200/200', () => {
    expect(pagibigMonthly(1500)).toEqual({ base: 1500, employee: 15, employer: 30 })
    expect(pagibigMonthly(1500.01)).toEqual({ base: 1500.01, employee: 30, employer: 30 })
    expect(pagibigMonthly(1501)).toEqual({ base: 1501, employee: 30.02, employer: 30.02 })
    expect(pagibigMonthly(30000)).toEqual({ base: 10000, employee: 200, employer: 200 })
  })
  it('WH:WS-15 ₱5M income / ₱100M asset edges: A ₱1,000,000 (20%); B ₱1,250,000 on the return (25% of ₱5,000,001); C ₱1,250,000 (assets ₱100,000,001)', () => {
    const base = { grossSales: 20000000, costOfSales: 8000000, opex: 7000000, totalAssets: 100000000, registrationYear: 2015, taxYear: 2026 }
    const a = estimateCorporation(base)
    const b = estimateCorporation({ ...base, opex: 6999999 })
    const c = estimateCorporation({ ...base, totalAssets: 100000001 })
    expect([a.taxableIncome, a.rcit, a.incomeTaxDue]).toEqual([5000000, 1000000, 1000000])
    expect([b.taxableIncome, b.rcit, b.incomeTaxDue]).toEqual([5000001, 1250000, 1250000])
    expect([c.taxableIncome, c.rcit, c.incomeTaxDue]).toEqual([5000000, 1250000, 1250000])
  })
})

describe('3.5 Gap checks: year-to-date projector', () => {
  it('GAP:GW-3 mixed income, ₱240,000 in 6 months: 8% tax ₱38,400 (no ₱250,000 reduction); set aside ₱3,200 a month', () => {
    const r = projectYear({ grossSoFar: 240000, monthsIn: 6, kind: 'mixed' })
    expect([r.projectedGross, r.reduction, r.eightPercentTax, r.setAsidePerMonth]).toEqual([480000, 0, 38400, 3200])
  })
  it('GAP:GW-4 mixed income, ₱1,200,000 in 6 months: ₱192,000; ₱16,000 a month', () => {
    const r = projectYear({ grossSoFar: 1200000, monthsIn: 6, kind: 'mixed' })
    expect([r.eightPercentTax, r.setAsidePerMonth]).toEqual([192000, 16000])
  })
  it('GAP:GW-5 purely self-employed, ₱240,000 in 6 months: ₱18,400; ₱1,533.33 a month', () => {
    const r = projectYear({ grossSoFar: 240000, monthsIn: 6, kind: 'pure' })
    expect([r.reduction, r.eightPercentTax, r.setAsidePerMonth]).toEqual([250000, 18400, 1533.33])
  })
  it('GAP:GW-6 VAT-registered individual and corporation: no 8% figure, with the reason', () => {
    for (const kind of ['vat', 'corporation']) {
      const r = projectYear({ grossSoFar: 240000, monthsIn: 6, kind })
      expect(r.eightPercentAvailable).toBe(false)
      expect(r.notAvailableBecause).toBe(kind)
      expect([r.eightPercentTax, r.setAsidePerMonth]).toEqual([null, null])
    }
  })
})

describe('3.6 Posted information', () => {
  // Blog rule of thumb: graduated + itemized (plus 3% percentage tax) ties with
  // 8% at these expenses. With whole-peso return lines (decision 3) the tie
  // holds at the worksheet amount and itemized wins a few pesos later.
  const total = (gross, expenses, key) => estimateIndividual({ gross, expenses, taxYear: 2026 }).options.find(o => o.key === key).total
  it.each([
    [500000, 216667, 20000, 216677],
    [1000000, 562500, 60000, 562510],
    [2000000, 1312500, 140000, 1312510],
    [3000000, 2090000, 220000, 2090010],
  ])('INF:W-INF-1 gross ₱%i: tie with 8% at expenses ₱%i (₱%i each); more expenses (₱%i) make itemized cheaper', (gross, tieExpenses, tieTotal, more) => {
    expect(total(gross, tieExpenses, '8pct')).toBe(tieTotal)
    expect(total(gross, tieExpenses, 'itemized')).toBe(tieTotal)
    expect(total(gross, more, 'itemized')).toBeLessThan(tieTotal)
  })
  it('INF:W-INF-3 References example: ₱50,000 monthly taxable pay -> withholding ₱5,208.40', () => {
    expect(withholdingCalculator({ amount: 50000, mode: 'taxable', payPeriod: 'monthly' }).perPeriodWithholding).toBe(5208.4)
  })
  it('INF:W-INF-4 deadlines on Sunday Oct 31, 2027 move to Wed Nov 3, 2027 (Nov 1-2 holidays, Proclamation 1427)', () => {
    const emp = individual({ hasEmployees: true, withholdsEwt: true, withholdsFwt: true })
    for (const id of ['bir-1601eq', 'bir-qap', 'bir-1601fq', 'sss-employer']) {
      expect(due(emp, id, '2027-09-01', '2027-12-31', '2027-10-31')).toBe('2027-11-03')
    }
    const self = individual({})
    for (const id of ['sss-self', 'philhealth-self']) {
      expect(due(self, id, '2027-09-01', '2027-12-31', '2027-10-31')).toBe('2027-11-03')
    }
  })
})
