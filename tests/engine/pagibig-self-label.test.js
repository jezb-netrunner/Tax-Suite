// M15 (default in REVIEW.md 4.3): the self-employed Pag-IBIG item is the
// regular monthly savings, not MP2 (Pag-IBIG's voluntary savings program).
// Relabelled "Pag-IBIG regular savings (self-employed)", flagged needs_review
// until the payment channel name is confirmed.
import { describe, it, expect } from 'vitest'
import obligationsData from '../../src/data/rules/obligations.json'
import { generateDeadlines, isUnconfirmed } from '../../src/engine/deadlines.js'
import { HOLIDAY_SET } from '../../src/lib/deadlineData.js'
import { defaultProfile } from '../../src/engine/profile.js'
import { fromISO } from '../../src/engine/dates.js'

const OB = obligationsData.obligations
const ob = OB.find(o => o.id === 'pagibig-self')

describe('M15 self-employed Pag-IBIG label', () => {
  it('is regular savings, not MP2/RTPO, and needs review', () => {
    expect(ob.title).toBe('Pay Pag-IBIG regular savings (self-employed)')
    expect(ob.form).toBe('Pag-IBIG savings')
    expect(ob.desc).toBe('Self-employed members remit their own regular monthly Pag-IBIG savings.')
    expect(ob.notes).toBe('This is the regular monthly Pag-IBIG savings, not MP2 (Pag-IBIG\'s separate voluntary savings program). The name of the payment channel is not yet confirmed: check with Pag-IBIG.')
    expect(ob.confidence).toBe('needs_review')
    expect(JSON.stringify(OB)).not.toContain('MP2/RTPO')
  })

  it('calendar items carry the new label and the unconfirmed flag', () => {
    const list = generateDeadlines(OB, { ...defaultProfile('individual'), name: 'F' }, {
      from: fromISO('2026-11-01'), to: fromISO('2026-11-30'), holidays: HOLIDAY_SET, refDate: fromISO('2026-11-01'),
    }).filter(d => d.obligation.id === 'pagibig-self')
    expect(list.map(d => [d.obligation.title, d.obligation.form, isUnconfirmed(d)])).toEqual([
      ['Pay Pag-IBIG regular savings (self-employed)', 'Pag-IBIG savings', true],
    ])
  })
})
