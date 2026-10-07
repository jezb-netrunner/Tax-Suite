// L07: BIR deadline extensions recorded in the rulebook ("overrides") and
// applied by the calendar. RMC 30-2026 moved the TY2025 annual income tax
// returns, payment and attachments to May 15, 2026 (attachments.json agrees).
import { describe, it, expect } from 'vitest'
import obligationsData from '../../src/data/rules/obligations.json'
import attachments from '../../src/data/rules/attachments.json'
import { HOLIDAY_SET } from '../../src/lib/deadlineData.js'
import { generateDeadlines, overdueDeadlines, filedKey } from '../../src/engine/deadlines.js'
import { defaultProfile } from '../../src/engine/profile.js'
import { fromISO, iso } from '../../src/engine/dates.js'

const OB = obligationsData.obligations

function gen(profile, fromS, toS, extra = {}) {
  return generateDeadlines(OB, profile, {
    from: fromISO(fromS), to: fromISO(toS), holidays: HOLIDAY_SET, refDate: fromISO(fromS), ...extra,
  })
}
const view = (list, id) => list.filter(d => d.obligation.id === id).map(d => ({
  raw: iso(d.rawDate), date: iso(d.date), extended: d.extended ? { basis: d.extended.basis, from: iso(d.extended.from) } : null,
}))
const EXT = { basis: 'RMC 30-2026', from: '2026-04-15' }
const EXT_EAFS = { basis: 'RMC 30-2026 and RMC 39-2026', from: '2026-04-30' }

describe('L07 rulebook overrides', () => {
  it('records RMC 30-2026 for every TY2025 annual return item, all moved to May 15, 2026', () => {
    expect(obligationsData.overrides.map(o => [o.obligationId, o.rawDate, o.newDate, o.basis])).toEqual([
      ['bir-1701a-annual', '2026-04-15', '2026-05-15', 'RMC 30-2026'],
      ['bir-1701-annual', '2026-04-15', '2026-05-15', 'RMC 30-2026'],
      ['bir-1700-annual', '2026-04-15', '2026-05-15', 'RMC 30-2026'],
      ['bir-sawt-individual', '2026-04-15', '2026-05-15', 'RMC 30-2026'],
      ['bir-1702-annual', '2026-04-15', '2026-05-15', 'RMC 30-2026'],
      ['bir-sawt-corp-annual', '2026-04-15', '2026-05-15', 'RMC 30-2026'],
      ['bir-eafs-itr-attachments-individual', '2026-04-30', '2026-05-15', 'RMC 30-2026 and RMC 39-2026'],
      ['bir-eafs-itr-attachments-corp', '2026-04-30', '2026-05-15', 'RMC 30-2026 and RMC 39-2026'],
    ])
    for (const o of obligationsData.overrides) expect(OB.some(ob => ob.id === o.obligationId), o.obligationId).toBe(true)
  })
  it('matches the attachments rulebook (RMC 30-2026: May 15, 2026)', () => {
    expect(attachments.itrAttachmentDeadline.notes).toContain('RMC 30-2026 moved filing, payment AND attachments to May 15, 2026')
  })
})

describe('L07 the calendar applies the extensions', () => {
  it('8% freelancer: TY2025 1701A due May 15, 2026 (extended), TY2026 back to Apr 15, 2027', () => {
    const p = { ...defaultProfile('individual'), name: 'T', regime: '8pct', receives2307: true }
    const list = gen(p, '2026-01-01', '2027-04-30')
    expect(view(list, 'bir-1701a-annual')).toEqual([
      { raw: '2026-04-15', date: '2026-05-15', extended: EXT },
      { raw: '2027-04-15', date: '2027-04-15', extended: null },
    ])
    expect(view(list, 'bir-sawt-individual').filter(v => v.raw === '2026-04-15')).toEqual([{ raw: '2026-04-15', date: '2026-05-15', extended: EXT }])
    expect(view(list, 'bir-eafs-itr-attachments-individual')).toEqual([
      { raw: '2026-04-30', date: '2026-05-15', extended: EXT_EAFS },
      { raw: '2027-04-30', date: '2027-04-30', extended: null },
    ])
    const d = list.find(x => x.obligation.id === 'bir-1701a-annual')
    expect(d.shifted).toBe(false)
    expect(filedKey(d)).toBe('bir-1701a-annual:2026-04-15') // marks keep the statutory date
  })

  it('1701 (itemized) and 1700 (two employers) filers', () => {
    const itemized = { ...defaultProfile('individual'), name: 'I', regime: 'graduated_itemized' }
    const twoEmp = { ...defaultProfile('employee'), name: 'E', multipleEmployers: true }
    expect(view(gen(itemized, '2026-01-01', '2026-12-31'), 'bir-1701-annual')).toEqual([{ raw: '2026-04-15', date: '2026-05-15', extended: EXT }])
    expect(view(gen(twoEmp, '2026-01-01', '2026-12-31'), 'bir-1700-annual')).toEqual([{ raw: '2026-04-15', date: '2026-05-15', extended: EXT }])
  })

  it('calendar-year corporation: 1702, SAWT and eAFS moved; a June fiscal year (Oct 15, 2026) is not', () => {
    const corp = { ...defaultProfile('corporation'), name: 'C', receives2307: true }
    const list = gen(corp, '2026-01-01', '2026-12-31')
    expect(view(list, 'bir-1702-annual')).toEqual([{ raw: '2026-04-15', date: '2026-05-15', extended: EXT }])
    expect(view(list, 'bir-sawt-corp-annual')).toEqual([{ raw: '2026-04-15', date: '2026-05-15', extended: EXT }])
    expect(view(list, 'bir-eafs-itr-attachments-corp')).toEqual([{ raw: '2026-04-30', date: '2026-05-15', extended: EXT_EAFS }])
    const fy = { ...defaultProfile('corporation'), name: 'F', fiscalYearEndMonth: 6 }
    expect(view(gen(fy, '2026-01-01', '2026-12-31'), 'bir-1702-annual')).toEqual([{ raw: '2026-10-15', date: '2026-10-15', extended: null }])
  })

  it('an extension longer than the usual look-back still shows: viewed on May 10, 2026 the 1701A is due May 15', () => {
    const p = { ...defaultProfile('individual'), name: 'T', regime: '8pct' }
    const list = gen(p, '2026-05-10', '2026-06-30')
    expect(view(list, 'bir-1701a-annual')).toEqual([{ raw: '2026-04-15', date: '2026-05-15', extended: EXT }])
    expect(list.find(d => d.obligation.id === 'bir-1701a-annual').daysAway).toBe(5)
  })

  it('overdue counts from the extended date: on May 16, 2026 the unfiled 1701A is 1 day overdue', () => {
    const p = { ...defaultProfile('individual'), name: 'T', regime: '8pct' }
    const od = overdueDeadlines(OB, p, { today: fromISO('2026-05-16'), holidays: HOLIDAY_SET })
    expect(od.filter(d => d.obligation.id === 'bir-1701a-annual').map(d => [iso(d.date), d.daysOverdue])).toEqual([['2026-05-15', 1]])
  })

  it('an override can also name the period instead of the statutory date', () => {
    const p = { ...defaultProfile('individual'), name: 'T', regime: '8pct' }
    const overrides = [{ obligationId: 'bir-1701q', period: 'Q3 2026', newDate: '2026-11-27', basis: 'RMC 99-2026 (example)' }]
    expect(view(gen(p, '2026-11-01', '2026-11-30', { overrides }), 'bir-1701q'))
      .toEqual([{ raw: '2026-11-15', date: '2026-11-27', extended: { basis: 'RMC 99-2026 (example)', from: '2026-11-16' } }])
  })
})
