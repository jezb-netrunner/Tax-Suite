// L06: citations corrected in the rulebook (shown on the References page).
import { describe, it, expect } from 'vitest'
import penalties from '../../src/data/rules/penalties.json'
import holidays from '../../src/data/rules/holidays.json'
import obligationsData from '../../src/data/rules/obligations.json'
import { ruleRegister } from '../../src/engine/rulebook.js'

const ob = id => obligationsData.obligations.find(o => o.id === id)
const allBasis = () => {
  const r = ruleRegister()
  return [...r.computation, ...r.holidays, ...r.obligations].flatMap(e => e.legalBasis || [])
}

describe('L06 citations', () => {
  it('no simultaneous deficiency and delinquency interest: the Sec 249(A) proviso, not 249(D)', () => {
    expect(penalties.interest.legalBasis).toContain('NIRC Sec 249(A), as amended by RA 10963 (proviso: no simultaneous deficiency and delinquency interest)')
    expect(JSON.stringify(penalties)).not.toContain('249(D)')
  })

  it('the ₱500 registration fee abolition is RMC 14-2024', () => {
    expect(ob('bir-arf-abolished').legalBasis).toEqual(['RA 11976 (EOPT), repealing NIRC Sec 236(B)', 'RMC 14-2024'])
  })

  it('e-invoicing also cites RR 26-2025 and RMC 98-2026, and stays needs_review', () => {
    expect(ob('bir-einvoicing').legalBasis).toEqual([
      'NIRC Sec 237-A, as amended by CREATE MORE (RA 12066)',
      'RR 11-2025',
      'RR 26-2025 (amends RR 11-2025; keeps the Dec 31, 2026 deadline)',
      'RMC 98-2026 (Sept 22, 2026: coverage and operating rules)',
    ])
    expect(ob('bir-einvoicing').confidence).toBe('needs_review')
  })

  it('the weekend/holiday roll-over rule cites RMC 65-2016', () => {
    expect(holidays.shiftRule.legalBasis).toContain('RMC 65-2016 (a deadline on a Saturday, Sunday or holiday moves to the next working day)')
  })

  it('the References register shows the corrected citations and none of the old ones', () => {
    const basis = allBasis()
    expect(basis).toContain('RMC 14-2024')
    expect(basis).toContain('RMC 98-2026 (Sept 22, 2026: coverage and operating rules)')
    expect(basis.some(b => b.includes('RMC 15-2024'))).toBe(false)
    expect(basis.some(b => b.includes('249(D)'))).toBe(false)
  })
})
