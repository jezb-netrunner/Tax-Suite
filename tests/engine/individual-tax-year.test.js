import { describe, it, expect, vi, afterEach } from 'vitest'
import { estimateIndividual } from '../../src/engine/estimators/individual.js'

// M01 (owner decision 1): current taxable year only, labelled with the Manila
// calendar year; earlier years (2018-2022 table, 1% percentage tax Jul 2020 to
// Jun 2023) are named as not supported.

const NOTE = 'Earlier years used different rates (the 2018-2022 graduated table, and a 1% percentage tax from July 2020 to June 2023) and are not supported here.'

afterEach(() => { vi.useRealTimers() })

describe('taxable-year label', () => {
  it('explicit taxYear 2026', () => {
    const r = estimateIndividual({ gross: 500000, taxYear: 2026 })
    expect(r.taxYear).toBe(2026)
    expect(r.ratesLabel).toBe('Rates for taxable year 2026')
    expect(r.ratesNote).toBe(NOTE)
  })
  it('default year is the Manila date: 11:59 pm Dec 31, 2026 in Manila is still 2026', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-12-31T15:59:00Z'))
    expect(estimateIndividual({ gross: 500000 }).ratesLabel).toBe('Rates for taxable year 2026')
  })
  it('default year is the Manila date: 12:30 am Jan 1, 2027 in Manila (still Dec 31 in UTC) is 2027', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-12-31T16:30:00Z'))
    const r = estimateIndividual({ gross: 500000 })
    expect(r.taxYear).toBe(2027)
    expect(r.ratesLabel).toBe('Rates for taxable year 2027')
  })
})
