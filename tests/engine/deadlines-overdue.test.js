// M09 (owner decision 11): passed deadlines that are not marked filed stay in
// an Overdue list for 60 days after the due date; items can be marked filed
// (and unmarked), saved on the profile; the income-tax rail ticks only items
// marked filed; checklist items can be ticked.
import { describe, it, expect } from 'vitest'
import obligationsData from '../../src/data/rules/obligations.json'
import { HOLIDAY_SET } from '../../src/lib/deadlineData.js'
import {
  generateDeadlines, overdueDeadlines, OVERDUE_DAYS, filedKey, isFiled, withFiled, withFiledMany, filedStatus,
  railStatus, isChecked, withChecked,
} from '../../src/engine/deadlines.js'
import { defaultProfile } from '../../src/engine/profile.js'
import { fromISO, iso } from '../../src/engine/dates.js'

const OB = obligationsData.obligations
const mixed = { ...defaultProfile('mixed'), id: 'm1', name: 'Ana Reyes', regime: 'graduated_osd' }
const overdue = (p, todayS) => overdueDeadlines(OB, p, { today: fromISO(todayS), holidays: HOLIDAY_SET })
const view = list => list.map(d => [iso(d.date), d.obligation.id, d.label, d.daysOverdue])

describe('M09 overdue list', () => {
  it('mixed-income earner on Tue Oct 27, 2026: the Oct 26 2551Q and every unfiled date of the last 60 days', () => {
    expect(OVERDUE_DAYS).toBe(60)
    expect(view(overdue(mixed, '2026-10-27'))).toEqual([
      ['2026-09-01', 'philhealth-self', 'Jul 2026', 56],
      ['2026-09-01', 'sss-self', 'Jul 2026', 56],
      ['2026-09-10', 'pagibig-self', 'Aug 2026', 47],
      ['2026-09-30', 'philhealth-self', 'Aug 2026', 27],
      ['2026-09-30', 'sss-self', 'Aug 2026', 27],
      ['2026-10-12', 'pagibig-self', 'Sep 2026', 15],
      ['2026-10-15', 'bir-annual-itr-2nd-installment', null, 12],
      ['2026-10-26', 'bir-2551q', 'Q3', 1],
    ])
  })

  it('on the due date itself nothing is overdue yet (the 2551Q is due today)', () => {
    expect(overdue(mixed, '2026-10-26').some(d => d.obligation.id === 'bir-2551q')).toBe(false)
  })

  it('an item stays 60 days after its due date, then drops off (Oct 15 -> Dec 14 in, Dec 15 out)', () => {
    const p = { ...defaultProfile('employee'), id: 'e1', name: 'E', multipleEmployers: true }
    expect(view(overdue(p, '2026-12-14'))).toEqual([['2026-10-15', 'bir-annual-itr-2nd-installment', null, 60]])
    expect(view(overdue(p, '2026-12-15'))).toEqual([])
  })

  it('marking an item filed removes it; unmarking brings it back', () => {
    const today = fromISO('2026-10-27')
    const item = overdue(mixed, '2026-10-27').find(d => d.obligation.id === 'bir-2551q')
    expect(filedKey(item)).toBe('bir-2551q:2026-10-25')
    const filed = withFiled(mixed, filedKey(item), true, today)
    expect(filed.filed).toEqual({ 'bir-2551q:2026-10-25': '2026-10-27' })
    expect(mixed.filed).toBe(undefined) // the original profile is not changed
    expect(isFiled(filed, item)).toBe(true)
    expect(overdue(filed, '2026-10-27').some(d => d.obligation.id === 'bir-2551q')).toBe(false)
    expect(overdue(filed, '2026-10-27')).toHaveLength(7)
    const unfiled = withFiled(filed, filedKey(item), false, today)
    expect(unfiled.filed).toEqual({})
    expect(overdue(unfiled, '2026-10-27').some(d => d.obligation.id === 'bir-2551q')).toBe(true)
  })

  it('an optional item (2nd installment) can be marked "doesn\'t apply": it leaves the list and reads n/a', () => {
    const today = fromISO('2026-10-27')
    const item = overdue(mixed, '2026-10-27').find(d => d.obligation.id === 'bir-annual-itr-2nd-installment')
    const p2 = withFiled(mixed, filedKey(item), true, today, 'n/a')
    expect(p2.filed).toEqual({ 'bir-annual-itr-2nd-installment:2026-10-15': 'n/a' })
    expect(filedStatus(p2, item)).toBe('n/a')
    expect(filedStatus(withFiled(mixed, filedKey(item), true, today), item)).toBe('filed')
    expect(filedStatus(mixed, item)).toBe(null)
    expect(overdue(p2, '2026-10-27').some(d => d.obligation.id === 'bir-annual-itr-2nd-installment')).toBe(false)
  })

  it('"mark all as filed" marks every overdue item at once, and can be undone at once', () => {
    const today = fromISO('2026-10-27')
    const keys = overdue(mixed, '2026-10-27').map(filedKey)
    const all = withFiledMany(mixed, keys, true, today)
    expect(Object.keys(all.filed)).toHaveLength(8)
    expect(Object.values(all.filed).every(v => v === '2026-10-27')).toBe(true)
    expect(overdue(all, '2026-10-27')).toEqual([])
    expect(withFiledMany(all, keys, false, today).filed).toEqual({})
  })

  it('the filed key uses the date set by law, so it survives a weekend shift (Pag-IBIG Sep 2026: Sat Oct 10 -> Mon Oct 12)', () => {
    const item = overdue(mixed, '2026-10-27').find(d => d.obligation.id === 'pagibig-self' && d.label === 'Sep 2026')
    expect(filedKey(item)).toBe('pagibig-self:2026-10-10')
  })
})

describe('M09 income-tax rail: tick only when marked filed', () => {
  const p = { ...defaultProfile('individual'), id: 'f1', name: 'Paolo', regime: '8pct' }
  const today = fromISO('2026-10-07')
  const rail = generateDeadlines(OB, p, {
    from: fromISO('2026-01-01'), to: fromISO('2026-12-31'), holidays: HOLIDAY_SET, refDate: today,
  }).filter(d => d.obligation.category === 'income')

  it('nothing marked: passed dates read "passed", not "filed"', () => {
    expect(rail.map(d => [d.obligation.form, d.label, railStatus(p, d, today)])).toEqual([
      ['1701A', null, 'passed'],
      ['via eAFS', null, 'passed'],
      ['1701Q', 'Q1', 'passed'],
      ['1701Q', 'Q2', 'passed'],
      ['2nd installment', null, 'due'],
      ['1701Q', 'Q3', 'due'],
    ])
  })

  it('a ticked item reads "filed"; a return filed early can be ticked before its date', () => {
    const q2 = rail.find(d => d.label === 'Q2')
    const q3 = rail.find(d => d.label === 'Q3')
    const p2 = withFiled(withFiled(p, filedKey(q2), true, today), filedKey(q3), true, today)
    expect(railStatus(p2, q2, today)).toBe('filed')
    expect(railStatus(p2, q3, today)).toBe('filed')
    expect(rail.filter(d => railStatus(p2, d, today) === 'filed')).toHaveLength(2)
  })

  it('an optional item marked "doesn\'t apply" reads n/a', () => {
    const inst = rail.find(d => d.obligation.id === 'bir-annual-itr-2nd-installment')
    expect(railStatus(withFiled(p, filedKey(inst), true, today, 'n/a'), inst, today)).toBe('n/a')
  })
})

describe('M09 checklist ticks', () => {
  it('ticking and unticking a checklist item is saved on the profile', () => {
    const p = { ...defaultProfile('individual'), id: 'f1', name: 'Paolo' }
    const ob = OB.find(o => o.id === 'bir-books-current')
    expect(isChecked(p, ob)).toBe(false)
    const p2 = withChecked(p, ob.id, true, fromISO('2026-10-07'))
    expect(p2.checklistDone).toEqual({ 'bir-books-current': '2026-10-07' })
    expect(isChecked(p2, ob)).toBe(true)
    expect(isChecked(withChecked(p2, ob.id, false), ob)).toBe(false)
  })
})
