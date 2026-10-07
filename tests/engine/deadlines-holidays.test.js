// Holiday calendar used to move deadlines (H03 and M07).
// Uses the app's own holiday calendar from src/lib/deadlineData.js, so these
// tests check exactly what the dashboard and the penalty calculator use.
import { describe, it, expect } from 'vitest'
import obligationsData from '../../src/data/rules/obligations.json'
import holidaysData from '../../src/data/rules/holidays.json'
import meta from '../../src/data/rules/meta.json'
import { HOLIDAY_SET } from '../../src/lib/deadlineData.js'
import { generateDeadlines, unproclaimedYears, holidayGapNote } from '../../src/engine/deadlines.js'
import { defaultProfile } from '../../src/engine/profile.js'
import { fromISO, iso, easterSunday, makeHolidayCalendar } from '../../src/engine/dates.js'
import { rollDueDate } from '../../src/engine/estimators/penalties.js'

const OB = obligationsData.obligations

function gen(profile, fromS, toS) {
  return generateDeadlines(OB, profile, {
    from: fromISO(fromS), to: fromISO(toS), holidays: HOLIDAY_SET, refDate: fromISO(fromS),
  })
}
const due = (list, id) => list.filter(d => d.obligation.id === id).map(d => [iso(d.rawDate), iso(d.date)])

describe('H03 2027 holidays per Proclamation 1427 s.2026', () => {
  it('adds the four extra special non-working days', () => {
    const rows = holidaysData.holidays.filter(h => ['2027-02-06', '2027-03-27', '2027-11-02', '2027-12-24'].includes(h.date))
    expect(rows.map(h => [h.date, h.name, h.type])).toEqual([
      ['2027-02-06', 'Chinese New Year', 'special_non_working'],
      ['2027-03-27', 'Black Saturday', 'special_non_working'],
      ['2027-11-02', "All Souls' Day", 'special_non_working'],
      ['2027-12-24', 'Christmas Eve', 'special_non_working'],
    ])
    for (const d of ['2027-02-06', '2027-03-27', '2027-11-02', '2027-12-24']) expect(HOLIDAY_SET.has(d), d).toBe(true)
  })

  it('EDSA anniversary (Thu Feb 25, 2027) stays a working day', () => {
    expect(HOLIDAY_SET.has('2027-02-25')).toBe(false)
  })

  it('2027 is marked verified per Proc 1427, with the Eid dates still pending', () => {
    expect(holidaysData.confidenceByYear['2027']).toBe('verified')
    expect(holidaysData.$comment).toContain('Proclamation No. 1427')
    expect(holidaysData.confidenceNote).toContain('Proclamation No. 1427')
    expect(holidaysData.notes2027.notes).toContain('Eid')
    expect(holidaysData.notes2027.notes).not.toContain('Still pending the 2027 proclamation')
    expect(meta.howToUpdate).not.toContain('2027 holiday proclamation (expected')
    expect(meta.howToUpdate).toContain('2027 Eid')
  })

  it('DL:WS-10 1601-EQ, 1601-FQ, QAP, SSS and PhilHealth for Q3/Sep 2027: raw Sun Oct 31 -> Wed Nov 3, 2027', () => {
    const p = { ...defaultProfile('individual'), name: 'T', hasEmployees: true, withholdsEwt: true, withholdsFwt: true }
    const list = gen(p, '2027-10-01', '2027-11-30')
    expect(due(list, 'bir-1601eq')).toEqual([['2027-10-31', '2027-11-03']])
    expect(due(list, 'bir-1601fq')).toEqual([['2027-10-31', '2027-11-03']])
    expect(due(list, 'bir-qap')).toEqual([['2027-10-31', '2027-11-03']])
    expect(due(list, 'sss-employer').filter(([raw]) => raw === '2027-10-31')).toEqual([['2027-10-31', '2027-11-03']])
    expect(due(list, 'sss-self').filter(([raw]) => raw === '2027-10-31')).toEqual([['2027-10-31', '2027-11-03']])
    expect(due(list, 'philhealth-self').filter(([raw]) => raw === '2027-10-31')).toEqual([['2027-10-31', '2027-11-03']])
  })

  it('DL:WS-18 1702Q and SAWT, FY ending November, quarter ending Aug 31, 2027: raw Sat Oct 30 -> Wed Nov 3, 2027', () => {
    const p = { ...defaultProfile('corporation'), name: 'C', fiscalYearEndMonth: 11, receives2307: true }
    const list = gen(p, '2027-10-01', '2027-11-30')
    expect(due(list, 'bir-1702q')).toEqual([['2027-10-30', '2027-11-03']])
    expect(due(list, 'bir-sawt-corp-quarterly')).toEqual([['2027-10-30', '2027-11-03']])
  })

  it('DL:WS-16 13th-month pay 2027 stays Fri Dec 24 even though Dec 24 is now a non-working day', () => {
    const p = { ...defaultProfile('corporation'), name: 'C', hasEmployees: true }
    expect(due(gen(p, '2027-12-01', '2027-12-31'), 'dole-13th-month')).toEqual([['2027-12-24', '2027-12-24']])
  })
})

// M07: holidays fixed by law for years with no proclaimed list. Expected
// values from py/m07_oracle.py (python dateutil.easter, Gregorian computus).
describe('M07 holidays fixed by law, for any year', () => {
  it('Easter Sunday (Gregorian) matches python dateutil for 2016-2100', () => {
    const years = [2016, 2017, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030, 2038, 2100]
    expect(years.map(y => iso(easterSunday(y)))).toEqual([
      '2016-03-27', '2017-04-16', '2023-04-09', '2024-03-31', '2025-04-20', '2026-04-05',
      '2027-03-28', '2028-04-16', '2029-04-01', '2030-04-21', '2038-04-25', '2100-03-28',
    ])
  })

  it('2028 (not yet proclaimed) gets the 14 holidays fixed by law, in date order', () => {
    expect(HOLIDAY_SET.forYear(2028).map(h => [h.date, h.name, h.type])).toEqual([
      ['2028-01-01', "New Year's Day", 'regular'],
      ['2028-04-09', 'Araw ng Kagitingan', 'regular'],
      ['2028-04-13', 'Maundy Thursday', 'regular'],
      ['2028-04-14', 'Good Friday', 'regular'],
      ['2028-05-01', 'Labor Day', 'regular'],
      ['2028-06-12', 'Independence Day', 'regular'],
      ['2028-08-21', 'Ninoy Aquino Day', 'special_non_working'],
      ['2028-08-28', 'National Heroes Day', 'regular'],
      ['2028-11-01', "All Saints' Day", 'special_non_working'],
      ['2028-11-30', 'Bonifacio Day', 'regular'],
      ['2028-12-08', 'Feast of the Immaculate Conception', 'special_non_working'],
      ['2028-12-25', 'Christmas Day', 'regular'],
      ['2028-12-30', 'Rizal Day', 'regular'],
      ['2028-12-31', 'Last Day of the Year', 'special_non_working'],
    ])
    expect(HOLIDAY_SET.isProclaimed(2028)).toBe(false)
    expect(HOLIDAY_SET.has('2028-05-01')).toBe(true)
    expect(HOLIDAY_SET.get('2028-06-12').name).toBe('Independence Day')
  })

  it('a proclaimed list wins for its year (2026, 2027), and contains every date fixed by law', () => {
    const rules = holidaysData.fixedByLaw.value
    for (const y of [2026, 2027]) {
      expect(HOLIDAY_SET.isProclaimed(y)).toBe(true)
      const proclaimed = holidaysData.holidays.filter(h => h.date.startsWith(String(y))).map(h => h.date)
      expect(HOLIDAY_SET.forYear(y).map(h => h.date)).toEqual(proclaimed)
      const computed = makeHolidayCalendar([], rules).forYear(y).map(h => h.date)
      expect(computed.filter(d => !proclaimed.includes(d)), String(y)).toEqual([])
    }
    // A proclaimed-only day comes from the list, not from the rules.
    expect(HOLIDAY_SET.has('2027-11-02')).toBe(true)
    expect(makeHolidayCalendar([], rules).has('2027-11-02')).toBe(false)
  })

  it('the fixed-by-law rules cite EO 292 as amended by RA 9492 and are flagged needs_review', () => {
    expect(holidaysData.fixedByLaw.legalBasis[0]).toBe('EO 292 (Administrative Code of 1987) Book I Sec 26, as amended by RA 9492')
    expect(holidaysData.fixedByLaw.confidence).toBe('needs_review')
  })

  it('DL:WS-14 1601-EQ Q1 2028: Sun Apr 30 -> Mon May 1 is Labor Day -> Tue May 2, 2028', () => {
    const p = { ...defaultProfile('corporation'), name: 'C' }
    const list = gen(p, '2028-04-01', '2028-05-31')
    expect(list.filter(d => d.obligation.id === 'bir-1601eq').map(d => [iso(d.rawDate), iso(d.date), d.shiftReason]))
      .toEqual([['2028-04-30', '2028-05-02', 'weekend']])
  })

  it('DL:WS-13 1702Q, FY ending May 2028, Q3 ends Tue Feb 29: + 60 days = Sat Apr 29 -> Tue May 2, 2028', () => {
    const p = { ...defaultProfile('corporation'), name: 'C', fiscalYearEndMonth: 5 }
    const list = gen(p, '2028-04-01', '2028-05-31')
    expect(due(list, 'bir-1702q')).toEqual([['2028-04-29', '2028-05-02']])
  })

  it('1601-C for May 2028: Sat Jun 10 -> Mon Jun 12 is Independence Day -> Tue Jun 13, 2028', () => {
    const p = { ...defaultProfile('corporation'), name: 'C', hasEmployees: true }
    expect(due(gen(p, '2028-06-01', '2028-06-30'), 'bir-1601c')).toEqual([['2028-06-10', '2028-06-13']])
  })

  it('unproclaimedYears: none for the Oct 7, 2026 view (window ends Nov 11, 2027); 2028 once the window reaches it', () => {
    expect(unproclaimedYears(HOLIDAY_SET, fromISO('2026-10-07'), fromISO('2027-11-11'))).toEqual([])
    expect(unproclaimedYears(HOLIDAY_SET, fromISO('2026-11-27'), fromISO('2028-01-01'))).toEqual([2028])
    expect(unproclaimedYears(HOLIDAY_SET, fromISO('2027-12-01'), fromISO('2029-01-05'))).toEqual([2028, 2029])
  })

  it('banner text names the years', () => {
    expect(holidayGapNote([])).toBe(null)
    expect(holidayGapNote([2028])).toBe('2028 holidays not yet proclaimed: a deadline may move one or more days later.')
    expect(holidayGapNote([2028, 2029])).toBe('2028 and 2029 holidays not yet proclaimed: a deadline may move one or more days later.')
  })

  it('the penalty calculator rolls over the same calendar and flags years without a proclaimed list', () => {
    expect(rollDueDate('2028-04-30')).toEqual({
      dueDate: '2028-04-30', rolledDueDate: '2028-05-02', moved: true, reason: 'weekend', holidayListMissing: true,
    })
    expect(rollDueDate('2028-05-01')).toEqual({
      dueDate: '2028-05-01', rolledDueDate: '2028-05-02', moved: true, reason: 'holiday', holidayListMissing: true,
    })
    expect(rollDueDate('2027-10-31')).toEqual({
      dueDate: '2027-10-31', rolledDueDate: '2027-11-03', moved: true, reason: 'weekend', holidayListMissing: false,
    })
    // A plain Set still works: years with any listed date count as covered.
    expect(rollDueDate('2026-11-01', new Set(['2026-11-02'])).rolledDueDate).toBe('2026-11-03')
    expect(rollDueDate('2026-11-01', new Set(['2026-11-02'])).holidayListMissing).toBe(false)
  })
})
