// L23 (default in REVIEW.md 4.3): the community tax (cedula) reminder also
// applies to employees (LGC Sec 157: individuals regularly employed on a wage
// or salary), flagged needs_review. Worksheet GAP:GW-7.
import { describe, it, expect } from 'vitest'
import obligationsData from '../../src/data/rules/obligations.json'
import { HOLIDAY_SET } from '../../src/lib/deadlineData.js'
import { generateDeadlines } from '../../src/engine/deadlines.js'
import { defaultProfile } from '../../src/engine/profile.js'
import { fromISO, iso } from '../../src/engine/dates.js'

const OB = obligationsData.obligations
const cedula = OB.find(o => o.id === 'lgu-cedula')

function cedulaDates(profile) {
  return generateDeadlines(OB, profile, {
    from: fromISO('2026-01-01'), to: fromISO('2027-04-30'), holidays: HOLIDAY_SET, refDate: fromISO('2026-01-01'),
  }).filter(d => d.obligation.id === 'lgu-cedula').map(d => [iso(d.date), d.nonWorkingDay, d.lastWorkingDayBefore && iso(d.lastWorkingDayBefore)])
}

describe('L23 community tax (cedula) for employees', () => {
  it('GAP:GW-7 employee (single employer): due by the last day of February, kept on the legal date (M08)', () => {
    const p = { ...defaultProfile('employee'), name: 'E' }
    expect(cedulaDates(p)).toEqual([
      ['2026-02-28', 'weekend', '2026-02-27'], // Sat Feb 28, 2026 -> pay by Fri Feb 27
      ['2027-02-28', 'weekend', '2027-02-26'], // Sun Feb 28, 2027 -> pay by Fri Feb 26
    ])
  })
  it('employee with two employers too', () => {
    const p = { ...defaultProfile('employee'), name: 'E2', multipleEmployers: true }
    expect(cedulaDates(p).map(r => r[0])).toEqual(['2026-02-28', '2027-02-28'])
  })
  it('business profiles keep the reminder', () => {
    for (const type of ['individual', 'mixed', 'corporation']) {
      expect(cedulaDates({ ...defaultProfile(type), name: type }).map(r => r[0]), type).toEqual(['2026-02-28', '2027-02-28'])
    }
  })
  it('the rule covers employees, cites LGC Sec 157 and is flagged needs_review', () => {
    expect(cedula.appliesTo).toEqual({ anyOf: ['business', 'type:employee'] })
    expect(cedula.desc).toBe('Yearly community tax for individuals who work for an employer, run a business or practice a profession, and for corporations.')
    expect(cedula.legalBasis).toContain('Local Government Code (RA 7160) Sec 157 (individuals regularly employed on a wage or salary)')
    expect(cedula.confidence).toBe('needs_review')
  })
})
