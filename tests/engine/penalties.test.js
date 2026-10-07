import { describe, it, expect } from 'vitest'
import { estimatePenalty, compromiseFor } from '../../src/engine/estimators/penalties.js'

// Hand-worked (REVIEW.md worksheets TB:W08, TB:W09): ₱50,000 due, 60 days late.
//   Medium/large: 25% surcharge 12,500 + 12%×60/365 interest 986.30 + compromise 10,000
//   Micro/small:  10% surcharge  5,000 +  6%×60/365 interest 493.15 + compromise 10,000
// The compromise is the full RMO 7-2015 Annex A amount for every taxpayer size:
// RR 6-2024 halves it only for invoicing violations (Secs 113, 237, 238), not
// for late filing or payment (Sec 255).
describe('late-filing penalty', () => {
  it('TB:W08 medium/large taxpayer: total 73,486.30', () => {
    const r = estimatePenalty({ taxDue: 50000, daysLate: 60, microSmall: false })
    expect(r.surcharge).toBe(12500)
    expect(r.interest).toBe(986.3)
    expect(r.compromise).toBe(10000)
    expect(r.total).toBe(73486.3)
  })
  it('TB:W09 / INF:W-INF-6 micro/small taxpayer: full compromise 10,000, total 65,493.15', () => {
    const r = estimatePenalty({ taxDue: 50000, daysLate: 60, microSmall: true })
    expect(r.surcharge).toBe(5000)
    expect(r.interest).toBe(493.15)
    expect(r.compromise).toBe(10000)
    expect(r.total).toBe(65493.15)
  })
  it('TB:W01 ₱10,000, 30 days, medium/large: total 15,598.63', () => {
    const r = estimatePenalty({ taxDue: 10000, daysLate: 30, microSmall: false })
    expect(r.surcharge).toBe(2500)
    expect(r.interest).toBe(98.63)
    expect(r.compromise).toBe(3000)
    expect(r.total).toBe(15598.63)
  })
  it('TB:W02 ₱10,000, 30 days, micro/small: compromise 3,000, total 14,049.32', () => {
    const r = estimatePenalty({ taxDue: 10000, daysLate: 30, microSmall: true })
    expect(r.surcharge).toBe(1000)
    expect(r.interest).toBe(49.32)
    expect(r.compromise).toBe(3000)
    expect(r.total).toBe(14049.32)
  })
  it('TB:W04 ₱0 tax due filed late, medium/large: compromise 1,000', () => {
    const r = estimatePenalty({ taxDue: 0, daysLate: 30, microSmall: false })
    expect(r.surcharge).toBe(0)
    expect(r.interest).toBe(0)
    expect(r.compromise).toBe(1000)
    expect(r.total).toBe(1000)
  })
  it('TB:W05 ₱0 tax due filed late, micro/small: compromise 1,000 (not halved)', () => {
    const r = estimatePenalty({ taxDue: 0, daysLate: 30, microSmall: true })
    expect(r.surcharge).toBe(0)
    expect(r.interest).toBe(0)
    expect(r.compromise).toBe(1000)
    expect(r.total).toBe(1000)
  })
  it('willful neglect surcharge is 50%', () => {
    const r = estimatePenalty({ taxDue: 100000, daysLate: 30, willful: true })
    expect(r.surcharge).toBe(50000)
  })
})

// TB:W06 / TB:W07: RMO 7-2015 Annex A tier edges. Each edge belongs to the
// lower tier (the brackets read "not over"). Same amounts for every size.
const TIER_EDGES = [
  [0, 1000], [1, 1000], [5000, 1000],
  [5001, 3000], [10000, 3000],
  [10001, 5000], [20000, 5000],
  [20001, 10000], [50000, 10000],
  [50001, 15000], [100000, 15000],
  [100001, 20000], [500000, 20000],
  [500001, 30000], [1000000, 30000],
  [1000001, 40000], [5000000, 40000],
  [5000001, 50000],
]

describe('compromise tiers (RMO 7-2015 Annex A, Sec 255)', () => {
  it.each(TIER_EDGES)('TB:W06 tax due %d -> %d', (taxDue, amount) => {
    expect(compromiseFor(taxDue)).toBe(amount)
  })
  it.each(TIER_EDGES)('TB:W07 micro/small, tax due %d -> %d (no 50% cut)', (taxDue, amount) => {
    expect(compromiseFor(taxDue, true)).toBe(amount)
    expect(estimatePenalty({ taxDue, daysLate: 30, microSmall: true }).compromise).toBe(amount)
  })
  it('a centavo above an edge moves to the next tier', () => {
    expect(compromiseFor(5000.01)).toBe(3000)
    expect(compromiseFor(4999.99)).toBe(1000)
  })
  it('very large amounts stay in the top tier', () => {
    expect(compromiseFor(10000000)).toBe(50000)
    expect(compromiseFor(999999999999.99)).toBe(50000)
  })
})
