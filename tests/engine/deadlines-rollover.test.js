// M08 (owner decision 14): each agency has its own weekend/holiday policy.
// BIR (RMC 65-2016), SSS and PhilHealth roll forward to the next working day;
// Pag-IBIG rolls forward too (needs_review). LGU, SEC and DOLE dates keep the
// statutory date and show a note. 13th-month pay never moves later.
import { describe, it, expect } from 'vitest'
import obligationsData from '../../src/data/rules/obligations.json'
import holidaysData from '../../src/data/rules/holidays.json'
import { HOLIDAY_SET } from '../../src/lib/deadlineData.js'
import { generateDeadlines } from '../../src/engine/deadlines.js'
import { defaultProfile } from '../../src/engine/profile.js'
import { fromISO, iso } from '../../src/engine/dates.js'

const OB = obligationsData.obligations
const NOTE = 'If this falls on a weekend or holiday, pay or file on the last working day before, unless your LGU or the agency allows later.'

function gen(profile, fromS, toS) {
  return generateDeadlines(OB, profile, {
    from: fromISO(fromS), to: fromISO(toS), holidays: HOLIDAY_SET, refDate: fromISO(fromS),
  })
}
function view(d) {
  return {
    rawDate: iso(d.rawDate), date: iso(d.date), shifted: d.shifted, rollOver: d.rollOver,
    nonWorkingDay: d.nonWorkingDay, lastWorkingDayBefore: d.lastWorkingDayBefore ? iso(d.lastWorkingDayBefore) : null,
    rollNote: d.rollNote,
  }
}
const one = (list, id) => list.filter(d => d.obligation.id === id).map(view)

describe('M08 rulebook: roll-over policy per agency', () => {
  const by = holidaysData.rollOverByAgency
  it('BIR, SSS, PhilHealth and Pag-IBIG move to the next working day; LGU, SEC and DOLE keep the statutory date', () => {
    expect(Object.fromEntries(Object.entries(by).map(([k, v]) => [k, v.policy]))).toEqual({
      BIR: 'next_working_day', SSS: 'next_working_day', PhilHealth: 'next_working_day', 'Pag-IBIG': 'next_working_day',
      LGU: 'statutory_date', SEC: 'statutory_date', DOLE: 'statutory_date',
    })
  })
  it('BIR cites RMC 65-2016; Pag-IBIG, LGU, SEC and DOLE are flagged needs_review', () => {
    expect(by.BIR.legalBasis).toContain('RMC 65-2016')
    expect(by.BIR.confidence).toBe('verified')
    for (const k of ['Pag-IBIG', 'LGU', 'SEC', 'DOLE']) expect(by[k].confidence, k).toBe('needs_review')
    for (const k of ['LGU', 'SEC', 'DOLE']) expect(by[k].note, k).toBe(NOTE)
  })
  it('the old "safe default" wording is gone from the shift rule', () => {
    expect(holidaysData.shiftRule.notes).not.toContain('safe default')
  })
})

describe('M08 LGU, SEC and DOLE: statutory date plus a note', () => {
  it('cedula 2027 stays Sun Feb 28, 2027 with the note (last working day before: Fri Feb 26)', () => {
    const p = { ...defaultProfile('individual'), name: 'T' }
    expect(one(gen(p, '2027-01-01', '2027-03-31'), 'lgu-cedula')).toEqual([{
      rawDate: '2027-02-28', date: '2027-02-28', shifted: false, rollOver: 'statutory_date',
      nonWorkingDay: 'weekend', lastWorkingDayBefore: '2027-02-26', rollNote: NOTE,
    }])
  })
  it('PTR 2027 stays Sun Jan 31, 2027 (last working day before: Fri Jan 29)', () => {
    const p = { ...defaultProfile('individual'), name: 'T', licensedProfessional: true }
    expect(one(gen(p, '2027-01-01', '2027-02-28'), 'lgu-ptr')).toEqual([{
      rawDate: '2027-01-31', date: '2027-01-31', shifted: false, rollOver: 'statutory_date',
      nonWorkingDay: 'weekend', lastWorkingDayBefore: '2027-01-29', rollNote: NOTE,
    }])
  })
  it('business permit on a working day: Wed Jan 20, 2027, no non-working-day flag, note still attached', () => {
    const p = { ...defaultProfile('individual'), name: 'T' }
    expect(one(gen(p, '2027-01-01', '2027-01-31'), 'lgu-business-permit')).toEqual([{
      rawDate: '2027-01-20', date: '2027-01-20', shifted: false, rollOver: 'statutory_date',
      nonWorkingDay: null, lastWorkingDayBefore: null, rollNote: NOTE,
    }])
  })
  it('SEC AFS (calendar year) 2027 stays Sat May 29, 2027 (last working day before: Fri May 28)', () => {
    const p = { ...defaultProfile('corporation'), name: 'C' }
    expect(one(gen(p, '2027-05-01', '2027-06-30'), 'sec-afs-calendar')).toEqual([{
      rawDate: '2027-05-29', date: '2027-05-29', shifted: false, rollOver: 'statutory_date',
      nonWorkingDay: 'weekend', lastWorkingDayBefore: '2027-05-28', rollNote: NOTE,
    }])
  })
  it('DOLE 13th-month report 2028 stays Sat Jan 15, 2028 (last working day before: Fri Jan 14)', () => {
    const p = { ...defaultProfile('corporation'), name: 'C', hasEmployees: true }
    expect(one(gen(p, '2028-01-01', '2028-01-31'), 'dole-13th-month-report')).toEqual([{
      rawDate: '2028-01-15', date: '2028-01-15', shifted: false, rollOver: 'statutory_date',
      nonWorkingDay: 'weekend', lastWorkingDayBefore: '2028-01-14', rollNote: NOTE,
    }])
  })
  it('13th-month pay never moves: Fri Dec 24, 2027 (a Proc 1427 non-working day) stays, pay by Thu Dec 23', () => {
    const p = { ...defaultProfile('corporation'), name: 'C', hasEmployees: true }
    const [d] = one(gen(p, '2027-12-01', '2027-12-31'), 'dole-13th-month')
    expect(d).toEqual({
      rawDate: '2027-12-24', date: '2027-12-24', shifted: false, rollOver: 'never_later',
      nonWorkingDay: 'holiday', lastWorkingDayBefore: '2027-12-23',
      rollNote: 'This date never moves later: if it falls on a weekend or holiday, do it on the last working day before.',
    })
  })
})

describe('M08 BIR, SSS, PhilHealth and Pag-IBIG unchanged: next working day', () => {
  const p = { ...defaultProfile('individual'), name: 'T', hasEmployees: true, withholdsEwt: true }
  const list = gen(p, '2026-10-01', '2027-02-28')
  const dates = id => list.filter(d => d.obligation.id === id).map(d => [iso(d.rawDate), iso(d.date), d.rollOver, d.rollNote])
  it('1604-C Sun Jan 31, 2027 -> Mon Feb 1 (DL:WS-07)', () => {
    expect(dates('bir-1604c')).toEqual([['2027-01-31', '2027-02-01', 'next_working_day', null]])
  })
  it('1601-EQ Q3 2026 Sat Oct 31 -> Tue Nov 3 (DL:WS-03)', () => {
    expect(dates('bir-1601eq').filter(([r]) => r === '2026-10-31')).toEqual([['2026-10-31', '2026-11-03', 'next_working_day', null]])
  })
  it('SSS employer Nov 2026: Thu Dec 31 -> Mon Jan 4, 2027 (DL:WS-08)', () => {
    expect(dates('sss-employer').filter(([r]) => r === '2026-12-31')).toEqual([['2026-12-31', '2027-01-04', 'next_working_day', null]])
  })
  it('Pag-IBIG employer Sep 2026: Sat Oct 10 -> Mon Oct 12', () => {
    expect(dates('pagibig-employer').filter(([r]) => r === '2026-10-10')).toEqual([['2026-10-10', '2026-10-12', 'next_working_day', null]])
  })
  it('PhilHealth employer Jan 2027: Mon Feb 15, 2027 stays', () => {
    expect(dates('philhealth-employer').filter(([r]) => r === '2027-02-15')).toEqual([['2027-02-15', '2027-02-15', 'next_working_day', null]])
  })
})
