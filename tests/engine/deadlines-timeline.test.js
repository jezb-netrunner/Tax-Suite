// M10: the Timeline view lists every deadline in the window, grouped by month,
// matching the header count (it used to stop silently after 40).
import { describe, it, expect } from 'vitest'
import obligationsData from '../../src/data/rules/obligations.json'
import { HOLIDAY_SET } from '../../src/lib/deadlineData.js'
import { generateDeadlines, groupByMonth } from '../../src/engine/deadlines.js'
import { defaultProfile } from '../../src/engine/profile.js'
import { fromISO, iso, addDays } from '../../src/engine/dates.js'

const OB = obligationsData.obligations

describe('M10 timeline grouped by month', () => {
  // 'Maria Santos' from the review: self-employed, employer, EWT agent, receives 2307s.
  const p = { ...defaultProfile('individual'), name: 'Maria Santos', hasEmployees: true, withholdsEwt: true, receives2307: true }
  const t = fromISO('2026-10-07')
  const list = generateDeadlines(OB, p, { from: t, to: addDays(t, 400), holidays: HOLIDAY_SET, refDate: t })
  const groups = groupByMonth(list)

  it('every deadline appears once, in order (well over the old 40-item cut)', () => {
    expect(list.length).toBeGreaterThan(100)
    expect(groups.flatMap(g => g.items)).toEqual(list)
    expect(groups.reduce((n, g) => n + g.items.length, 0)).toBe(list.length)
  })

  it('14 month groups from October 2026 to November 2027, each holding only its own month', () => {
    expect(groups.map(g => g.key)).toEqual([
      '2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04',
      '2027-05', '2027-06', '2027-07', '2027-08', '2027-09', '2027-10', '2027-11',
    ])
    expect(groups[0].label).toBe('October 2026')
    expect(groups[13].label).toBe('November 2027')
    for (const g of groups) for (const d of g.items) expect(iso(d.date).slice(0, 7)).toBe(g.key)
  })

  it('the Apr 15, 2027 annual return and the last item (Nov 10, 2027) are in the timeline', () => {
    const apr = groups.find(g => g.key === '2027-04')
    expect(apr.items.some(d => d.obligation.id === 'bir-1701a-annual' && iso(d.date) === '2027-04-15')).toBe(true)
    expect(iso(groups[13].items[groups[13].items.length - 1].date)).toBe('2027-11-10')
  })

  it('an empty list gives no groups', () => {
    expect(groupByMonth([])).toEqual([])
  })
})
