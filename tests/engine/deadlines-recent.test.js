// The calendar is a reference, not a tracker (owner, Oct 17, 2026): "Mark as
// filed" is gone. Due dates of the last 60 days are listed as "Recently
// passed" (was the M09 Overdue list), whatever the profile holds; checklist
// items can still be ticked (M09).
import { describe, it, expect } from 'vitest'
import obligationsData from '../../src/data/rules/obligations.json'
import { HOLIDAY_SET } from '../../src/lib/deadlineData.js'
import * as deadlines from '../../src/engine/deadlines.js'
import { recentDeadlines, RECENT_DAYS, isChecked, withChecked } from '../../src/engine/deadlines.js'
import { defaultProfile } from '../../src/engine/profile.js'
import { fromISO, iso } from '../../src/engine/dates.js'

const OB = obligationsData.obligations
const mixed = { ...defaultProfile('mixed'), id: 'm1', name: 'Ana Reyes', regime: 'graduated_osd' }
const recent = (p, todayS) => recentDeadlines(OB, p, { today: fromISO(todayS), holidays: HOLIDAY_SET })
const view = list => list.map(d => [iso(d.date), d.obligation.id, d.label, d.daysAgo])

const OCT_27 = [
  ['2026-09-01', 'philhealth-self', 'Jul 2026', 56],
  ['2026-09-01', 'sss-self', 'Jul 2026', 56],
  ['2026-09-10', 'pagibig-self', 'Aug 2026', 47],
  ['2026-09-30', 'philhealth-self', 'Aug 2026', 27],
  ['2026-09-30', 'sss-self', 'Aug 2026', 27],
  ['2026-10-12', 'pagibig-self', 'Sep 2026', 15],
  ['2026-10-15', 'bir-annual-itr-2nd-installment', null, 12],
  ['2026-10-26', 'bir-2551q', 'Q3', 1],
]

describe('Recently passed: the due dates of the last 60 days', () => {
  it('mixed-income earner on Tue Oct 27, 2026: every due date of the last 60 days, oldest first', () => {
    expect(RECENT_DAYS).toBe(60)
    expect(view(recent(mixed, '2026-10-27'))).toEqual(OCT_27)
  })

  it('on the due date itself the item is not listed yet (the 2551Q is due today)', () => {
    expect(recent(mixed, '2026-10-26').some(d => d.obligation.id === 'bir-2551q')).toBe(false)
  })

  it('an item stays 60 days after its due date, then drops off (Oct 15 -> Dec 14 in, Dec 15 out)', () => {
    const p = { ...defaultProfile('employee'), id: 'e1', name: 'E', multipleEmployers: true }
    expect(view(recent(p, '2026-12-14'))).toEqual([['2026-10-15', 'bir-annual-itr-2nd-installment', null, 60]])
    expect(view(recent(p, '2026-12-15'))).toEqual([])
  })

  it('filed marks saved by an earlier version are ignored: the dates are still listed', () => {
    const old = { ...mixed, filed: { 'bir-2551q:2026-10-25': '2026-10-27', 'bir-annual-itr-2nd-installment:2026-10-15': 'n/a' } }
    expect(view(recent(old, '2026-10-27'))).toEqual(OCT_27)
  })

  it('there is no way left to mark a deadline filed', () => {
    for (const name of ['filedKey', 'isFiled', 'filedStatus', 'withFiled', 'withFiledMany', 'overdueDeadlines', 'OVERDUE_DAYS', 'railStatus']) {
      expect(deadlines[name], name).toBeUndefined()
    }
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
