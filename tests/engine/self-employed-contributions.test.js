import { describe, it, expect } from 'vitest'
import { selfEmployedMonthlyEarnings, selfEmployedMonthlyContributions } from '../../src/engine/estimators/contributions.js'

// M13 (owner default): the self-employed SSS / PhilHealth / Pag-IBIG card is
// based on (gross − expenses) ÷ 12, labelled "net monthly earnings", with an
// optional "declared monthly earnings" override.

describe('WH:WS-21 self-employed monthly contributions (₱480,000 sales, ₱180,000 expenses)', () => {
  const e = selfEmployedMonthlyEarnings({ grossAnnual: 480000, expensesAnnual: 180000 })
  it('net monthly earnings (480,000 − 180,000) ÷ 12 = ₱25,000 (not gross ÷ 12 = ₱40,000)', () => {
    expect(e).toEqual({ monthly: 25000, basis: 'net' })
  })
  it('contributions ₱5,430 a month: SSS ₱3,780, PhilHealth ₱1,250, Pag-IBIG ₱400 (not ₱7,680)', () => {
    expect(selfEmployedMonthlyContributions(e.monthly)).toEqual({ sss: 3780, philhealth: 1250, pagibig: 400, total: 5430 })
  })
})

describe('declared monthly earnings override', () => {
  it('a declared ₱30,000 replaces the net figure', () => {
    expect(selfEmployedMonthlyEarnings({ grossAnnual: 480000, expensesAnnual: 180000, declaredMonthly: 30000 }))
      .toEqual({ monthly: 30000, basis: 'declared' })
  })
  it('a blank or ₱0 declared figure is ignored', () => {
    expect(selfEmployedMonthlyEarnings({ grossAnnual: 480000, expensesAnnual: 180000, declaredMonthly: null }).basis).toBe('net')
    expect(selfEmployedMonthlyEarnings({ grossAnnual: 480000, expensesAnnual: 180000, declaredMonthly: 0 }).basis).toBe('net')
  })
})

describe('net earnings edge cases', () => {
  it('no expenses entered: gross ÷ 12, to the centavo (₱100,001 -> ₱8,333.42)', () => {
    expect(selfEmployedMonthlyEarnings({ grossAnnual: 100001 })).toEqual({ monthly: 8333.42, basis: 'net' })
  })
  it('expenses equal to or above sales: no net earnings, and no contributions are computed', () => {
    expect(selfEmployedMonthlyEarnings({ grossAnnual: 500000, expensesAnnual: 700000 })).toEqual({ monthly: 0, basis: 'none' })
    expect(selfEmployedMonthlyContributions(0)).toEqual({ sss: 0, philhealth: 0, pagibig: 0, total: 0 })
  })
})
