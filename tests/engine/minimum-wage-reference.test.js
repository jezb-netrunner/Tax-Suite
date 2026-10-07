import { describe, it, expect } from 'vitest'
import wcomp from '../../src/data/rules/withholding-compensation.json'
import { minimumWageReferenceNote } from '../../src/engine/estimators/payroll.js'

// H10: the NCR minimum wage reference follows Wage Order No. NCR-28
// (₱755 non-agriculture; ₱718 agriculture, retail/service with 15 or fewer
// workers and manufacturing with fewer than 10 workers; from Sept 26, 2026),
// keeps the NCR-26 / NCR-27 history and stays needs_review until the NWPC
// PDF is checked.

const rule = wcomp.minimumWageReference

describe('H10 NCR minimum wage reference (Wage Order No. NCR-28)', () => {
  it('₱755 / ₱718 from 2026-09-26 (not NCR-26 ₱695 / ₱658)', () => {
    expect(rule.value.region).toBe('NCR')
    expect(rule.value.order).toBe('Wage Order No. NCR-28')
    expect(rule.value.dailyNonAgriculture).toBe(755)
    expect(rule.value.dailyAgricultureAndSmall).toBe(718)
    expect(rule.value.effective).toBe('2026-09-26')
  })
  it('cites the wage order first and keeps NCR-26 / NCR-27 as history', () => {
    expect(rule.legalBasis[0]).toMatch(/^Wage Order No\. NCR-28/)
    expect(rule.notes).toMatch(/NCR-26/)
    expect(rule.notes).toMatch(/NCR-27/)
    expect(rule.notes).not.toMatch(/remains NCR-26/)
    expect(rule.value.history.map(h => h.order)).toEqual(['NCR-26', 'NCR-27'])
  })
  it('stays needs_review with the NWPC confirmation note', () => {
    expect(rule.confidence).toBe('needs_review')
    expect(rule.notes).toContain('confirm against the NWPC wage-order PDF (reported by GMA News, Daily Tribune, Philstar, Sept 2026)')
  })
  it('the minimum wage earner hint quotes the NCR-28 rates', () => {
    expect(minimumWageReferenceNote()).toBe(
      'NCR (Wage Order No. NCR-28, from Sep 26, 2026): ₱755 a day for non-agriculture; ₱718 for agriculture, retail/service with 15 or fewer workers and manufacturing with fewer than 10 workers. Other regions have their own wage orders.',
    )
  })
})
