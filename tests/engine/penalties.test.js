import { describe, it, expect } from 'vitest'
import { estimatePenalty, compromiseFor } from '../../src/engine/estimators/penalties.js'

// Hand-worked: ₱50,000 due, 60 days late.
//   Regular:     25% surcharge 12,500 + 12%×60/365 interest 986.30 + compromise 10,000
//   Micro/small: 10% surcharge  5,000 +  6%×60/365 interest 493.15 + compromise  5,000
describe('late-filing penalty', () => {
  it('regular taxpayer', () => {
    const r = estimatePenalty({ taxDue: 50000, daysLate: 60, microSmall: false })
    expect(r.surcharge).toBe(12500)
    expect(r.interest).toBe(986.3)
    expect(r.compromise).toBe(10000)
    expect(r.total).toBe(73486.3)
  })
  it('micro/small taxpayer under EOPT', () => {
    const r = estimatePenalty({ taxDue: 50000, daysLate: 60, microSmall: true })
    expect(r.surcharge).toBe(5000)
    expect(r.interest).toBe(493.15)
    expect(r.compromise).toBe(5000)
    expect(r.total).toBe(60493.15)
  })
  it('willful neglect surcharge is 50%', () => {
    const r = estimatePenalty({ taxDue: 100000, daysLate: 30, willful: true })
    expect(r.surcharge).toBe(50000)
  })
  it('compromise tiers', () => {
    expect(compromiseFor(4000)).toBe(1000)
    expect(compromiseFor(50000)).toBe(10000)
    expect(compromiseFor(2000000)).toBe(40000)
    expect(compromiseFor(10000000)).toBe(50000)
  })
})
