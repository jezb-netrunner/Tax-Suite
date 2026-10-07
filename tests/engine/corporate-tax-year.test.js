import { describe, it, expect, vi, afterEach } from 'vitest'
import { estimateCorporation, corporateTaxYears, taxablePeriod, EARLIER_YEARS_NOTE } from '../../src/engine/estimators/corporation.js'
import { mkDate } from '../../src/engine/dates.js'

// C06 (owner decision 1): the corporate estimator offers the current and the
// previous taxable year only, defaulting to the year whose annual return
// (1702-RT, 15th day of the 4th month after year-end, moved to the next working
// day) is due next, by the Manila date and the profile's fiscal year. Earlier
// years are "not supported" because MCIT and percentage-tax rates differed.

function at(instant) {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(instant))
}
afterEach(() => { vi.useRealTimers() })

// WS-17 / WS-24 figures: gross income 6,000,000; net taxable income 100,000; assets 50M.
const lean = { grossSales: 6000000, costOfSales: 0, opex: 5900000, totalAssets: 50000000 }

describe('WH:WS-17 TY2026 return prepared in filing season (March 2027)', () => {
  const ty = corporateTaxYears({ today: mkDate(2027, 3, 15) })
  it('choices are 2027 (current) and 2026 (previous); default 2026, due Apr 15, 2027', () => {
    expect(ty.options.map(o => o.year)).toEqual([2027, 2026])
    expect(ty.defaultYear).toBe(2026)
    expect(ty.options.find(o => o.year === 2026).dueDate).toBe('2027-04-15')
  })
  it('registered with the BIR in 2023: TY2026 tax is the ₱20,000 regular tax (not ₱120,000 MCIT)', () => {
    const r = estimateCorporation({ ...lean, registrationYear: 2023, taxYear: ty.defaultYear })
    expect(r.taxYear).toBe(2026)
    expect(r.mcitApplies).toBe(false)
    expect(r.incomeTaxDue).toBe(20000)
  })
  it('the engine default (no taxYear passed) is the same TY2026 in March 2027, Manila time', () => {
    at('2027-03-15T04:00:00Z')
    const r = estimateCorporation({ ...lean, registrationYear: 2023 })
    expect(r.taxYear).toBe(2026)
    expect(r.incomeTaxDue).toBe(20000)
  })
  it('the result names the year', () => {
    const r = estimateCorporation({ ...lean, registrationYear: 2023, taxYear: 2026 })
    expect(r.period.label).toBe('Taxable year 2026 (January to December 2026)')
  })
})

describe('default flips the day after the (rolled-over) due date, in Manila time', () => {
  it('11:59 PM Apr 15, 2027 Manila: still TY2026', () => {
    at('2027-04-15T15:59:00Z')
    expect(estimateCorporation({ ...lean, registrationYear: 2023 }).taxYear).toBe(2026)
  })
  it('12:30 AM Apr 16, 2027 Manila (still Apr 15 in UTC): TY2027, so a 2023 registration now has MCIT', () => {
    at('2027-04-15T16:30:00Z')
    const r = estimateCorporation({ ...lean, registrationYear: 2023 })
    expect(r.taxYear).toBe(2027)
    expect(r.mcitApplies).toBe(true)
    expect(r.incomeTaxDue).toBe(120000)
  })
  it('Apr 15, 2028 is a Saturday: the TY2027 return is due Monday Apr 17, so on Apr 16 the default is still 2027', () => {
    const ty = corporateTaxYears({ today: mkDate(2028, 4, 16) })
    expect(ty.options.find(o => o.year === 2027).dueDate).toBe('2028-04-17')
    expect(ty.defaultYear).toBe(2027)
    expect(corporateTaxYears({ today: mkDate(2028, 4, 18) }).defaultYear).toBe(2028)
  })
  it('today (Oct 7, 2026), calendar year: default TY2026, choices 2026 and 2025', () => {
    const ty = corporateTaxYears({ today: mkDate(2026, 10, 7) })
    expect(ty.defaultYear).toBe(2026)
    expect(ty.options.map(o => o.year)).toEqual([2026, 2025])
  })
})

describe('fiscal-year corporations (year ends June 30)', () => {
  it('Oct 7, 2026: current FY ends June 2027; the FY ending June 2026 return is due Oct 15, 2026, so it is the default', () => {
    const ty = corporateTaxYears({ today: mkDate(2026, 10, 7), fiscalYearEndMonth: 6 })
    expect(ty.options.map(o => o.year)).toEqual([2027, 2026])
    expect(ty.defaultYear).toBe(2026)
    expect(ty.options.find(o => o.year === 2026).dueDate).toBe('2026-10-15')
    expect(ty.options.find(o => o.year === 2026).label).toBe('Fiscal year July 2025 to June 2026')
  })
  it('Oct 16, 2026: default moves to the FY ending June 2027', () => {
    expect(corporateTaxYears({ today: mkDate(2026, 10, 16), fiscalYearEndMonth: 6 }).defaultYear).toBe(2027)
  })
  it('MCIT test counts the fiscal year being filed: registered 2022, FY ending June 2026 is the 4th year', () => {
    const r = estimateCorporation({ ...lean, registrationYear: 2022, taxYear: 2026, fiscalYearEndMonth: 6 })
    expect(r.mcitApplies).toBe(true)
    expect(r.incomeTaxDue).toBe(120000)
    expect(r.period.label).toBe('Fiscal year July 2025 to June 2026')
  })
})

describe('WH:WS-18 transitional MCIT years are not supported (owner decision 1)', () => {
  // REVIEW.md WS-18 lists TY2022 ₱60,000 and TY2023 ₱90,000; under decision 1 these years are
  // refused with a message instead of being computed (no dated rate tables before Jul 2023).
  it('TY2022: no figures, a "not supported" message (never the old ₱120,000)', () => {
    const r = estimateCorporation({ ...lean, registrationYear: 2015, taxYear: 2022 })
    expect(r.supported).toBe(false)
    expect(r.incomeTaxDue).toBe(null)
    expect(r.mcit).toBe(null)
    expect(r.message).toBe(EARLIER_YEARS_NOTE)
    expect(r.message).toMatch(/^Not supported: MCIT and percentage-tax rates differed/)
    expect(r.message).toMatch(/1% from Jul 2020 to Jun 2023/)
  })
  it('calendar TY2023 (starts before Jul 1, 2023): not supported', () => {
    expect(estimateCorporation({ ...lean, registrationYear: 2015, taxYear: 2023 }).supported).toBe(false)
  })
  it('fiscal year Jul 2023 to Jun 2024 is supported; Apr 2023 to Mar 2024 is not', () => {
    expect(estimateCorporation({ ...lean, registrationYear: 2015, taxYear: 2024, fiscalYearEndMonth: 6 }).supported).toBe(true)
    expect(estimateCorporation({ ...lean, registrationYear: 2015, taxYear: 2024, fiscalYearEndMonth: 3 }).supported).toBe(false)
  })
  it('TY2024 calendar: supported, 2% MCIT', () => {
    const r = estimateCorporation({ ...lean, registrationYear: 2015, taxYear: 2024 })
    expect(r.supported).toBe(true)
    expect(r.incomeTaxDue).toBe(120000)
  })
})

describe('taxablePeriod', () => {
  it('calendar and fiscal periods', () => {
    expect(taxablePeriod(2026)).toMatchObject({ start: '2026-01-01', end: '2026-12-31', annualDue: '2027-04-15' })
    expect(taxablePeriod(2026, 6)).toMatchObject({ start: '2025-07-01', end: '2026-06-30', annualDue: '2026-10-15' })
    expect(taxablePeriod(2027, 3)).toMatchObject({ start: '2026-04-01', end: '2027-03-31', annualDue: '2027-07-15' })
  })
})
