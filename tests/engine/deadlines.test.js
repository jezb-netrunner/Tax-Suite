import { describe, it, expect } from 'vitest'
import obligationsData from '../../src/data/rules/obligations.json'
import holidaysData from '../../src/data/rules/holidays.json'
import { generateDeadlines, generateChecklist } from '../../src/engine/deadlines.js'
import { defaultProfile } from '../../src/engine/profile.js'
import { fromISO, iso, taxableYearQuarters, shiftToBusinessDay } from '../../src/engine/dates.js'

const OB = obligationsData.obligations
const HOLIDAYS = new Set(holidaysData.holidays.map(h => h.date))

function gen(profile, fromS, toS) {
  return generateDeadlines(OB, profile, {
    from: fromISO(fromS), to: fromISO(toS), holidays: HOLIDAYS, refDate: fromISO(fromS),
  })
}
function datesOf(list, obId) {
  return list.filter(d => d.obligation.id === obId).map(d => iso(d.date))
}

describe('self-employed 8% — TY2026 calendar', () => {
  const p = { ...defaultProfile('individual'), name: 'T', regime: '8pct' }
  const list = gen(p, '2026-01-01', '2027-04-30')
  it('1701Q on statutory dates with weekend shifts (Aug 15 Sat → Aug 17, Nov 15 Sun → Nov 16)', () => {
    expect(datesOf(list, 'bir-1701q')).toEqual(['2026-05-15', '2026-08-17', '2026-11-16'])
  })
  it('annual 1701A on Apr 15 2027 (TY2026)', () => {
    expect(datesOf(list, 'bir-1701a-annual')).toContain('2027-04-15')
  })
  it('no percentage tax returns on the 8% regime', () => {
    expect(datesOf(list, 'bir-2551q')).toEqual([])
  })
  it('no employer forms without employees', () => {
    expect(datesOf(list, 'bir-1601c')).toEqual([])
  })
})

describe('self-employed graduated — percentage tax quarters', () => {
  const p = { ...defaultProfile('individual'), name: 'T', regime: 'graduated_osd' }
  const list = gen(p, '2026-01-01', '2027-01-31')
  it('2551Q due 25 days after each quarter, weekend-shifted (Apr 25 Sat→27, Jul 25 Sat→27, Oct 25 Sun→26)', () => {
    expect(datesOf(list, 'bir-2551q')).toEqual(['2026-01-26', '2026-04-27', '2026-07-27', '2026-10-26', '2027-01-25'])
    // 2026-01-25 is a Sunday → Jan 26 for the Q4-2025 return caught in window
  })
  it('graduated individual files 1701A (OSD), not 1701', () => {
    const l2 = gen(p, '2027-01-01', '2027-12-31')
    expect(datesOf(l2, 'bir-1701a-annual')).toContain('2027-04-15')
    expect(datesOf(l2, 'bir-1701-annual')).toEqual([])
  })
  it('itemized individual files 1701 instead', () => {
    const pi = { ...p, regime: 'graduated_itemized' }
    const l3 = gen(pi, '2027-01-01', '2027-12-31')
    expect(datesOf(l3, 'bir-1701-annual')).toContain('2027-04-15')
    expect(datesOf(l3, 'bir-1701a-annual')).toEqual([])
  })
})

describe('VAT-registered sole prop', () => {
  const p = { ...defaultProfile('individual'), name: 'T', vatRegistered: true, regime: 'graduated_osd' }
  const list = gen(p, '2026-01-01', '2026-12-31')
  it('files 2550Q not 2551Q', () => {
    expect(datesOf(list, 'bir-2550q').length).toBeGreaterThan(0)
    expect(datesOf(list, 'bir-2551q')).toEqual([])
  })
})

describe('employer facets', () => {
  const p = { ...defaultProfile('individual'), name: 'T', hasEmployees: true, withholdsEwt: true }
  const list = gen(p, '2026-01-01', '2027-02-28')
  it('1601-C monthly on the 10th, December due Jan 15', () => {
    const d = datesOf(list, 'bir-1601c')
    expect(d).toContain('2026-02-10')
    expect(d).toContain('2026-11-10')
    // November period → Dec 10 2026 (Thu); December period → Jan 15 2027 (Fri)
    expect(d).toContain('2026-12-10')
    expect(d).toContain('2027-01-15')
    expect(d).not.toContain('2027-01-10')
  })
  it('0619-E only months 1–2 of each quarter (no Mar/Jun/Sep/Dec periods)', () => {
    const d = datesOf(list, 'bir-0619e')
    // Feb period → Mar 10; Mar period skipped (no Apr 10 unless from Feb…)
    expect(d).toContain('2026-03-10')
    expect(d).not.toContain('2026-04-10') // March period folds into 1601-EQ
    expect(d).toContain('2026-05-11') // April period → May 10 2026 (Sun) → May 11
  })
  it('1601-EQ on the last day of the month after each quarter', () => {
    const d = datesOf(list, 'bir-1601eq')
    expect(d).toContain('2026-04-30')
    expect(d).toContain('2026-07-31')
    expect(d).toContain('2026-11-03') // Oct 31 Sat → Nov 1 All Saints (Sun) → Nov 2 All Souls → Nov 3
    expect(d).toContain('2027-02-01') // Jan 31 2027 is a Sunday → Feb 1
  })
  it('annual information returns: 1604-C Jan 31 (Sun 2027 → Feb 1), 1604-E Mar 1', () => {
    expect(datesOf(list, 'bir-1604c')).toContain('2027-02-01')
    expect(datesOf(list, 'bir-1604e')).toContain('2026-03-02') // Mar 1 2026 is a Sunday → Mar 2
  })
  it('13th month pay never shifts past Dec 24', () => {
    expect(datesOf(list, 'dole-13th-month')).toContain('2026-12-24')
  })
})

describe('corporation — calendar year', () => {
  const p = { ...defaultProfile('corporation'), name: 'C', vatRegistered: true, hasEmployees: true }
  const list = gen(p, '2026-01-01', '2027-04-30')
  it('1702Q within 60 days of Q1–Q3 close, hopping weekends AND holidays', () => {
    const d = datesOf(list, 'bir-1702q')
    expect(d).toContain('2026-06-01') // Mar 31 + 60 = May 30 2026 (Sat) → Jun 1
    expect(d).toContain('2026-09-01') // Jun 30 + 60 = Aug 29 (Sat) → Aug 31 is National Heroes Day → Sep 1
    expect(d).toContain('2026-12-01') // Sep 30 + 60 = Nov 29 (Sun) → Nov 30 is Bonifacio Day → Dec 1
  })
  it('annual 1702 on Apr 15 following the calendar year', () => {
    expect(datesOf(list, 'bir-1702-annual')).toContain('2027-04-15')
  })
})

describe('corporation — fiscal year ending June 30', () => {
  const p = { ...defaultProfile('corporation'), name: 'C', fiscalYearEndMonth: 6, vatRegistered: true }
  const list = gen(p, '2026-01-01', '2026-12-31')
  it('annual return on the 15th day of the 4th month after FY end (Oct 15)', () => {
    expect(datesOf(list, 'bir-1702-annual')).toContain('2026-10-15')
  })
  it('quarterly VAT follows fiscal quarters (Q ends Sep 30 → Oct 25 Sun → Oct 26)', () => {
    const d = datesOf(list, 'bir-2550q')
    expect(d).toContain('2026-10-26')
  })
  it('withholding stays calendar-based despite the fiscal year', () => {
    const pe = { ...p, hasEmployees: true }
    const le = gen(pe, '2026-01-01', '2026-12-31')
    expect(datesOf(le, 'bir-1604c')).toContain('2026-02-02') // Jan 31 2026 Sat → Feb 2
  })
})

describe('employee', () => {
  const p = { ...defaultProfile('employee'), name: 'E' }
  const list = gen(p, '2026-01-01', '2027-04-30')
  it('sees the 2316 hand-off and nothing to file (substituted)', () => {
    expect(datesOf(list, 'bir-2316-collect').length).toBeGreaterThan(0)
    expect(datesOf(list, 'bir-1700-annual')).toEqual([])
  })
  it('multiple employers → files 1700 on Apr 15', () => {
    const p2 = { ...p, multipleEmployers: true }
    const l2 = gen(p2, '2026-01-01', '2027-04-30')
    expect(datesOf(l2, 'bir-1700-annual')).toContain('2027-04-15')
  })
  it('checklist shows substituted-filing note', () => {
    const cl = generateChecklist(OB, p)
    expect(cl.some(o => o.id === 'emp-substituted')).toBe(true)
  })
})

describe('date primitives', () => {
  it('fiscal quarters for FY ending June', () => {
    const q = taxableYearQuarters(2026, 6)
    expect(iso(q[0].end)).toBe('2025-09-30')
    expect(iso(q[3].end)).toBe('2026-06-30')
    expect(iso(q[0].start)).toBe('2025-07-01')
  })
  it('holiday shifting hops consecutive non-working days', () => {
    // Sat Oct 31 → Sun Nov 1 (All Saints) → Mon Nov 2 (All Souls, Proc. 1006) → Tue Nov 3
    expect(iso(shiftToBusinessDay(fromISO('2026-10-31'), HOLIDAYS))).toBe('2026-11-03')
  })
})
