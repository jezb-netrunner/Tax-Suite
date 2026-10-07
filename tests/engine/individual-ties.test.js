import { describe, it, expect } from 'vitest'
import { estimateIndividual } from '../../src/engine/estimators/individual.js'

// L01: when the cheapest options cost the same in whole pesos, say they tie and
// explain the non-tax difference; never "saving ₱0". TI:WS-09 re-derived with
// whole-peso BIR lines (M03): ₱437,501 and ₱400,001 now tie exactly too:
//   437,501: 8% 187,501 × 8% = 15,000.08 -> ₱15,000; OSD 175,000.40 -> 175,000, net 262,501,
//            tax 1,875.15 -> ₱1,875, PT 13,125.03 -> ₱13,125; total ₱15,000.
//   400,001: 8% 12,000.08 -> ₱12,000; OSD net 240,001 -> ₱0 tax, PT 12,000.03 -> ₱12,000.

const NOTE_8 = 'With 8% you file no quarterly percentage tax returns (2551Q).'

describe('TI:WS-09 ties between 8% and OSD', () => {
  for (const [gross, amount] of [[400000, 12000], [437500, 15000], [437501, 15000], [400001, 12000]]) {
    it(`₱${gross.toLocaleString('en-US')}: 8% and OSD tie at ₱${amount.toLocaleString('en-US')}`, () => {
      const r = estimateIndividual({ gross })
      expect(r.best.total).toBe(amount)
      expect(r.tie).toEqual(['8pct', 'osd'])
      expect(r.savingsVsNext).toBe(0)
      expect(r.tieNote).toBe(`8% flat tax and Graduated + OSD (40%) tie for the lowest tax at ₱${amount.toLocaleString('en-US')}. ${NOTE_8}`)
    })
  }
})

describe('OSD and itemized tie when 8% is not available', () => {
  it('₱1,000,000 sales, ₱400,000 expenses, other percentage taxes: both ₱92,500', () => {
    const r = estimateIndividual({ gross: 1000000, expenses: 400000, subjectToOtherPercentageTax: true })
    expect(r.tie).toEqual(['osd', 'itemized'])
    expect(r.tieNote).toBe(
      'Graduated + OSD (40%) and Graduated + itemized tie for the lowest tax at ₱92,500. ' +
      'OSD needs no proof of expenses; itemized deductions must be backed by receipts and books.'
    )
  })
})

describe('no tie', () => {
  it('INF:W-INF-2 ₱480,000 / ₱180,000: 8% saves ₱1,700, no tie', () => {
    const r = estimateIndividual({ gross: 480000, expenses: 180000 })
    expect(r.tie).toBe(null)
    expect(r.tieNote).toBe(null)
    expect(r.savingsVsNext).toBe(1700)
  })
  it('a tie below the cheapest option is not a tie for the lowest', () => {
    const r = estimateIndividual({ gross: 1000000, expenses: 400000 })
    expect(r.best.key).toBe('8pct')
    expect(r.tie).toBe(null)
    expect(r.savingsVsNext).toBe(32500)
  })
})
