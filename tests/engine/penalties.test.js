import { describe, it, expect } from 'vitest'
import { estimatePenalty, compromiseFor } from '../../src/engine/estimators/penalties.js'

// Hand-worked: ₱50,000 due, 60 days late.
//   Regular:     25% surcharge 12,500 + 12%×60/365 interest 986.30 + compromise 10,000
//   Micro/small: 10% surcharge  5,000 +  6%×60/365 interest 493.15 + compromise  5,000
describe('late-filing penalty', () => {
  it('regular taxpayer', () => {
    const r = estimatePenalty({ taxDue: 50000, daysLate: 60, microSmall: false })
    expect(r.surcharge).toBeCloseTo(12500)
    expect(r.interest).toBeCloseTo(986.30, 1)
    expect(r.compromise).toBe(10000)
    expect(r.total).toBeCloseTo(73486.30, 1)
  })
  it('micro/small taxpayer under EOPT', () => {
    const r = estimatePenalty({ taxDue: 50000, daysLate: 60, microSmall: true })
    expect(r.surcharge).toBeCloseTo(5000)
    expect(r.interest).toBeCloseTo(493.15, 1)
    expect(r.compromise).toBe(5000)
    expect(r.total).toBeCloseTo(60493.15, 1)
  })
  it('willful neglect surcharge is 50%', () => {
    const r = estimatePenalty({ taxDue: 100000, daysLate: 30, willful: true })
    expect(r.surcharge).toBeCloseTo(50000)
  })
  it('compromise tiers', () => {
    expect(compromiseFor(4000)).toBe(1000)
    expect(compromiseFor(50000)).toBe(10000)
    expect(compromiseFor(2000000)).toBe(40000)
    expect(compromiseFor(10000000)).toBe(50000)
  })
})
