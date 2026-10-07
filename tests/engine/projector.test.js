import { describe, it, expect } from 'vitest'
import { projectYear, projectorKind } from '../../src/engine/estimators/projector.js'
import { defaultProfile } from '../../src/engine/profile.js'

// REVIEW.md section 3.5, GAP:GW-3 to GW-6 (Tools > Year-to-date projector).
// Projected gross sales = gross so far / months in × 12. The 8% option:
// purely self-employed get the ₱250,000 reduction, mixed-income earners get
// none (NIRC Sec 24(A)(2)(b)-(c), RR 8-2018); not available to VAT-registered
// individuals or corporations, or above ₱3,000,000 of gross sales.
describe('year-to-date projector', () => {
  it('GW-3 mixed income, ₱240,000 in 6 months: 8% × 480,000 = 38,400; ₱3,200 a month', () => {
    const r = projectYear({ grossSoFar: 240000, monthsIn: 6, kind: 'mixed' })
    expect(r.projectedGross).toBe(480000)
    expect(r.eightPercentAvailable).toBe(true)
    expect(r.reduction).toBe(0)
    expect(r.eightPercentTax).toBe(38400)
    expect(r.setAsidePerMonth).toBe(3200)
  })
  it('GW-4 mixed income, ₱1,200,000 in 6 months: 8% × 2,400,000 = 192,000; ₱16,000 a month', () => {
    const r = projectYear({ grossSoFar: 1200000, monthsIn: 6, kind: 'mixed' })
    expect(r.projectedGross).toBe(2400000)
    expect(r.eightPercentTax).toBe(192000)
    expect(r.setAsidePerMonth).toBe(16000)
  })
  it('GW-5 purely self-employed, ₱240,000 in 6 months: 8% × (480,000 − 250,000) = 18,400; ₱1,533.33 a month', () => {
    const r = projectYear({ grossSoFar: 240000, monthsIn: 6, kind: 'pure' })
    expect(r.projectedGross).toBe(480000)
    expect(r.reduction).toBe(250000)
    expect(r.eightPercentTax).toBe(18400)
    expect(r.setAsidePerMonth).toBe(1533.33)
  })
  it('GW-6 VAT-registered individual: projection only, no 8% figure', () => {
    const r = projectYear({ grossSoFar: 240000, monthsIn: 6, kind: 'vat' })
    expect(r.projectedGross).toBe(480000)
    expect(r.eightPercentAvailable).toBe(false)
    expect(r.notAvailableBecause).toBe('vat')
    expect(r.eightPercentTax).toBe(null)
    expect(r.setAsidePerMonth).toBe(null)
  })
  it('GW-6 corporation: projection only, no 8% figure', () => {
    const r = projectYear({ grossSoFar: 240000, monthsIn: 6, kind: 'corporation' })
    expect(r.projectedGross).toBe(480000)
    expect(r.eightPercentAvailable).toBe(false)
    expect(r.notAvailableBecause).toBe('corporation')
    expect(r.eightPercentTax).toBe(null)
  })
  it('exactly ₱3,000,000 projected keeps the 8% option; one centavo more does not', () => {
    const at = projectYear({ grossSoFar: 1500000, monthsIn: 6, kind: 'pure' })
    expect(at.projectedGross).toBe(3000000)
    expect(at.overCeiling).toBe(false)
    expect(at.eightPercentTax).toBe(220000)
    expect(at.setAsidePerMonth).toBe(18333.33)
    const over = projectYear({ grossSoFar: 250000.01, monthsIn: 1, kind: 'mixed' })
    expect(over.projectedGross).toBe(3000000.12)
    expect(over.overCeiling).toBe(true)
    expect(over.eightPercentAvailable).toBe(false)
    expect(over.notAvailableBecause).toBe('over-ceiling')
    expect(over.eightPercentTax).toBe(null)
  })
  it('projection is rounded half-up to the centavo: ₱100,000 in 7 months = 171,428.57', () => {
    const r = projectYear({ grossSoFar: 100000, monthsIn: 7, kind: 'mixed' })
    expect(r.projectedGross).toBe(171428.57)
    expect(r.eightPercentTax).toBe(13714.29)
    expect(r.setAsidePerMonth).toBe(1142.86)
  })
  it('12 months in: the projection is the gross so far; below ₱250,000 the pure 8% tax is 0', () => {
    const r = projectYear({ grossSoFar: 200000, monthsIn: 12, kind: 'pure' })
    expect(r.projectedGross).toBe(200000)
    expect(r.eightPercentTax).toBe(0)
    expect(r.setAsidePerMonth).toBe(0)
  })
  it('months in must be a whole number from 1 to 12 (no silent clamping)', () => {
    for (const m of [0, 13, 15, 1.5, -1, NaN, null, undefined]) {
      expect(() => projectYear({ grossSoFar: 240000, monthsIn: m, kind: 'pure' })).toThrow(RangeError)
    }
    expect(projectYear({ grossSoFar: 240000, monthsIn: 1, kind: 'pure' }).projectedGross).toBe(2880000)
  })
  it('needs to know the kind of filer', () => {
    expect(() => projectYear({ grossSoFar: 240000, monthsIn: 6, kind: null })).toThrow(RangeError)
  })
})

describe('projectorKind follows the active profile', () => {
  it('no profile or an employee profile: ask the user', () => {
    expect(projectorKind(null)).toBe(null)
    expect(projectorKind(defaultProfile('employee'))).toBe(null)
  })
  it('self-employed / sole prop, not VAT-registered: purely self-employed', () => {
    expect(projectorKind(defaultProfile('individual'))).toBe('pure')
  })
  it('mixed income, not VAT-registered: mixed', () => {
    expect(projectorKind(defaultProfile('mixed'))).toBe('mixed')
  })
  it('VAT-registered individual or mixed-income earner: vat', () => {
    expect(projectorKind({ ...defaultProfile('individual'), vatRegistered: true, regime: 'graduated_osd' })).toBe('vat')
    expect(projectorKind({ ...defaultProfile('mixed'), vatRegistered: true })).toBe('vat')
  })
  it('corporation: corporation', () => {
    expect(projectorKind(defaultProfile('corporation'))).toBe('corporation')
    expect(projectorKind({ ...defaultProfile('corporation'), vatRegistered: true })).toBe('corporation')
  })
})
