import { describe, it, expect, vi, afterEach } from 'vitest'
import obligationsData from '../../src/data/rules/obligations.json'
import holidaysData from '../../src/data/rules/holidays.json'
import { generateDeadlines } from '../../src/engine/deadlines.js'
import { defaultProfile } from '../../src/engine/profile.js'
import { estimateCorporation } from '../../src/engine/estimators/corporation.js'
import { manilaToday, msUntilManilaMidnight, daysLeftLabel, today, iso, addDays } from '../../src/engine/dates.js'

// H01: "today" is the calendar date in Manila, whatever the device clock's
// time zone. Run the whole suite under TZ=America/Los_Angeles, TZ=UTC and
// TZ=Asia/Manila (see tdd.md); these cases must pass in all three.

const OB = obligationsData.obligations
const HOLIDAYS = new Set(holidaysData.holidays.map(h => h.date))

function at(instant) {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(instant))
}
afterEach(() => { vi.useRealTimers() })

// The Dashboard's call: from Manila today, 400 days ahead.
function dashboardList(profile) {
  const t = manilaToday()
  return generateDeadlines(OB, profile, { from: t, to: addDays(t, 400), holidays: HOLIDAYS, refDate: t })
}

describe('manilaToday', () => {
  it('2026-10-26T15:59:59Z is still Oct 26 in Manila (11:59:59 PM)', () => {
    at('2026-10-26T15:59:59Z')
    expect(iso(manilaToday())).toBe('2026-10-26')
  })
  it('2026-10-26T16:00:00Z is Oct 27 in Manila (midnight)', () => {
    at('2026-10-26T16:00:00Z')
    expect(iso(manilaToday())).toBe('2026-10-27')
  })
  it('2026-10-27T03:00Z is Oct 27 in Manila (8 PM Oct 26 in Los Angeles)', () => {
    at('2026-10-27T03:00:00Z')
    expect(iso(manilaToday())).toBe('2026-10-27')
  })
  it('returns a plain local-midnight date like the rest of the engine', () => {
    at('2026-10-27T03:00:00Z')
    const d = manilaToday()
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 10, 27, 0, 0])
  })
  it('accepts an explicit instant', () => {
    expect(iso(manilaToday(new Date('2026-12-31T16:30:00Z')))).toBe('2027-01-01')
  })
  it('today() is the Manila date too', () => {
    at('2026-10-26T16:00:00Z')
    expect(iso(today())).toBe('2026-10-27')
  })
  it('the year changes at Manila midnight, not the device New Year', () => {
    at('2026-12-31T16:00:00Z')
    expect(manilaToday().getFullYear()).toBe(2027)
    at('2026-12-31T15:59:59Z')
    expect(manilaToday().getFullYear()).toBe(2026)
  })
})

describe('msUntilManilaMidnight (Dashboard refresh timer)', () => {
  it('one second before Manila midnight', () => {
    expect(msUntilManilaMidnight(new Date('2026-10-26T15:59:59Z'))).toBe(1000)
  })
  it('exactly at Manila midnight: a full day to the next one', () => {
    expect(msUntilManilaMidnight(new Date('2026-10-26T16:00:00Z'))).toBe(86400000)
  })
  it('at 11:00 AM Manila', () => {
    expect(msUntilManilaMidnight(new Date('2026-10-27T03:00:00.250Z'))).toBe(13 * 3600000 - 250)
  })
})

describe('daysLeftLabel', () => {
  it('says "Due today" instead of "0 days left"', () => {
    expect(daysLeftLabel(0)).toBe('Due today')
    expect(daysLeftLabel(1)).toBe('1 day left')
    expect(daysLeftLabel(7)).toBe('7 days left')
  })
})

describe('DL:WS-17 2550Q Q3 2026 (due Mon Oct 26) viewed after the Manila deadline', () => {
  const p = { ...defaultProfile('individual'), name: 'V', vatRegistered: true, regime: 'graduated_osd' }
  it('at 2026-10-27T03:00Z the Oct 26 return has passed; next 2550Q is Jan 25, 2027', () => {
    at('2026-10-27T03:00:00Z')
    const vatReturns = dashboardList(p).filter(d => d.obligation.form === '2550Q')
    expect(vatReturns.map(d => iso(d.date))).not.toContain('2026-10-26')
    expect(iso(vatReturns[0].date)).toBe('2027-01-25')
  })
  it('at 11:59:59 PM Oct 26 Manila it is due today (0 days: "Due today")', () => {
    at('2026-10-26T15:59:59Z')
    const first = dashboardList(p).find(d => d.obligation.form === '2550Q')
    expect(iso(first.date)).toBe('2026-10-26')
    expect(first.daysAway).toBe(0)
    expect(daysLeftLabel(first.daysAway)).toBe('Due today')
  })
})

describe('BUG:W7 countdown for a user outside the Philippines', () => {
  const fox = { ...defaultProfile('corporation'), name: 'Fox Corp', hasEmployees: true, registrationYear: 2020 }
  it('at 1:00 AM Oct 13 Manila the Oct 12 1601-C has passed; next is Oct 20, 7 days left', () => {
    at('2026-10-12T17:00:00Z')
    const list = dashboardList(fox)
    expect(list.map(d => iso(d.date))).not.toContain('2026-10-12')
    const hero = list.filter(d => ['income', 'business', 'withholding'].includes(d.obligation.category))[0]
    expect(iso(hero.date)).toBe('2026-10-20')
    expect(hero.daysAway).toBe(7)
  })
})

// C06 changed the default from "this calendar year" to "the year whose annual
// return is due next", so the Manila boundary that matters is the due date.
describe('corporate estimator default taxable year follows Manila', () => {
  const figures = { grossSales: 10000000, costOfSales: 4000000, opex: 5900000, totalAssets: 50000000, registrationYear: 2023 }
  it('00:30 Jan 1, 2027 Manila: TY 2026 is still the return due next (Apr 15, 2027), so no MCIT yet for a 2023 registration', () => {
    at('2026-12-31T16:30:00Z')
    const r = estimateCorporation(figures)
    expect(r.taxYear).toBe(2026)
    expect(r.mcitApplies).toBe(false)
  })
  it('00:30 Apr 16, 2027 Manila (Apr 15 in UTC): TY 2027, so a 2023 start year now has MCIT', () => {
    at('2027-04-15T16:30:00Z')
    const r = estimateCorporation(figures)
    expect(r.taxYear).toBe(2027)
    expect(r.mcitApplies).toBe(true)
  })
})
