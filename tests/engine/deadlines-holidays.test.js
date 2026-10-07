// Holiday calendar used to move deadlines (H03 and M07).
// Uses the app's own holiday calendar from src/lib/deadlineData.js, so these
// tests check exactly what the dashboard and the penalty calculator use.
import { describe, it, expect } from 'vitest'
import obligationsData from '../../src/data/rules/obligations.json'
import holidaysData from '../../src/data/rules/holidays.json'
import meta from '../../src/data/rules/meta.json'
import { HOLIDAY_SET } from '../../src/lib/deadlineData.js'
import { generateDeadlines } from '../../src/engine/deadlines.js'
import { defaultProfile } from '../../src/engine/profile.js'
import { fromISO, iso } from '../../src/engine/dates.js'

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
