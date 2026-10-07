// L05: the micro-taxpayer abatement item (RR 4-2026) and a generic
// "showUntil" date for checklist (ongoing / info) items.
import { describe, it, expect, vi, afterEach } from 'vitest'
import obligationsData from '../../src/data/rules/obligations.json'
import penalties from '../../src/data/rules/penalties.json'
import { generateChecklist } from '../../src/engine/deadlines.js'
import { defaultProfile } from '../../src/engine/profile.js'
import { fromISO } from '../../src/engine/dates.js'

const OB = obligationsData.obligations
const ABATE = 'bir-micro-abatement-2026'
const biz = { ...defaultProfile('individual'), name: 'T' }
const ids = (list) => list.map(o => o.id)

afterEach(() => { vi.useRealTimers() })

describe('L05 micro-taxpayer abatement item', () => {
  const ob = OB.find(o => o.id === ABATE)
  it('says "below ₱3M", matching the micro definition (gross sales below ₱3,000,000)', () => {
    expect(ob.desc).toContain('gross sales below ₱3M')
    expect(ob.desc).not.toContain('≤')
    expect(penalties.classification.value.micro).toEqual({ grossSalesBelow: 3000000 })
  })
  it('cites RR 4-2026 with the issuance and effectivity dates from firm alerts, flagged needs_review', () => {
    expect(ob.legalBasis).toEqual(['RR 4-2026 (issued June 18, 2026; effective July 7, 2026, per firm alerts)'])
    expect(ob.confidence).toBe('needs_review')
  })
  it('is shown until Dec 31, 2026 and hidden from Jan 1, 2027', () => {
    expect(ob.showUntil).toBe('2026-12-31')
    expect(ids(generateChecklist(OB, biz, { today: fromISO('2026-10-07') }))).toContain(ABATE)
    expect(ids(generateChecklist(OB, biz, { today: fromISO('2026-12-31') }))).toContain(ABATE)
    expect(ids(generateChecklist(OB, biz, { today: fromISO('2027-01-01') }))).not.toContain(ABATE)
  })
  it('without a date the checklist uses today in Manila (00:30 Jan 1, 2027 Manila is still Dec 31 in UTC: hidden)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-12-31T16:30:00Z')) // 00:30 Jan 1, 2027 in Manila
    expect(ids(generateChecklist(OB, biz))).not.toContain(ABATE)
    vi.setSystemTime(new Date('2026-12-31T15:59:00Z')) // 23:59 Dec 31, 2026 in Manila
    expect(ids(generateChecklist(OB, biz))).toContain(ABATE)
  })
})

describe('L05 generic showUntil for ongoing and info items', () => {
  const rules = [
    { id: 'a', schedule: { kind: 'ongoing' }, appliesTo: { allOf: ['business'] }, showUntil: '2026-06-30' },
    { id: 'b', schedule: { kind: 'info' }, appliesTo: { allOf: ['business'] } },
    { id: 'c', schedule: { kind: 'info' }, appliesTo: { allOf: ['business'] }, showUntil: '2026-07-01' },
  ]
  it('drops items whose showUntil date has passed; keeps items with no date', () => {
    expect(ids(generateChecklist(rules, biz, { today: fromISO('2026-06-30') }))).toEqual(['a', 'b', 'c'])
    expect(ids(generateChecklist(rules, biz, { today: fromISO('2026-07-01') }))).toEqual(['b', 'c'])
    expect(ids(generateChecklist(rules, biz, { today: fromISO('2026-07-02') }))).toEqual(['b'])
  })
})
