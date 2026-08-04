import { describe, it, expect } from 'vitest'
import { bracketTax } from '../../src/engine/tax.js'
import { gradTax } from '../../src/engine/estimators/individual.js'

// Hand-worked against NIRC Sec 24(A)(2)(a) rates effective 2023 (TRAIN).
describe('graduated income tax table', () => {
  it('zero band up to 250k', () => {
    expect(gradTax(0)).toBe(0)
    expect(gradTax(250000)).toBe(0)
  })
  it('15% band: 300,000 → 7,500', () => {
    expect(gradTax(300000)).toBe(7500)
  })
  it('bracket boundary 400,000 → 22,500', () => {
    expect(gradTax(400000)).toBe(22500)
  })
  it('20% band: 800,000 → 102,500', () => {
    expect(gradTax(800000)).toBe(102500)
  })
  it('25% band: 1,000,000 → 152,500', () => {
    expect(gradTax(1000000)).toBe(152500)
  })
  it('30% band: 3,000,000 → 702,500', () => {
    expect(gradTax(3000000)).toBe(702500)
  })
  it('35% band: 10,000,000 → 2,902,500', () => {
    expect(gradTax(10000000)).toBe(2202500 + 2000000 * 0.35)
  })
})

describe('bracketTax primitive', () => {
  const t = [
    { over: 0, base: 0, rate: 0 },
    { over: 100, base: 0, rate: 0.1 },
    { over: 200, base: 10, rate: 0.2 },
  ]
  it('picks the right bracket at boundaries', () => {
    expect(bracketTax(t, 100)).toBe(0)
    expect(bracketTax(t, 101)).toBeCloseTo(0.1)
    expect(bracketTax(t, 200)).toBeCloseTo(10)
    expect(bracketTax(t, 250)).toBeCloseTo(20)
  })
})
