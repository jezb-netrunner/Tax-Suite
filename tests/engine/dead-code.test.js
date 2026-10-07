// L21: dead exports and unused outputs are gone; duplicated helpers have one
// copy each; the MPF portion of SSS (an output nothing showed) is wired up.
import { describe, it, expect } from 'vitest'
import * as deadlineData from '../../src/lib/deadlineData.js'
import * as payroll from '../../src/engine/estimators/payroll.js'
import * as individual from '../../src/engine/estimators/individual.js'
import { estimateCorporation } from '../../src/engine/estimators/corporation.js'
import * as profile from '../../src/engine/profile.js'
import { sssEmployee } from '../../src/engine/estimators/contributions.js'

describe('dead code removed (L21)', () => {
  it('unused exports are gone', () => {
    expect(deadlineData.HOLIDAYS).toBeUndefined()
    expect(payroll.withholdingForPeriod).toBeUndefined()
  })
  it('estimator results no longer carry outputs nothing reads', () => {
    const r = individual.estimateIndividual({ gross: 480000, expenses: 180000, taxYear: 2026 })
    for (const o of r.options) expect(o).not.toHaveProperty('basis')
    const c = estimateCorporation({ grossSales: 1000000, costOfSales: 0, opex: 0, totalAssets: 1000000, registrationYear: 2000, taxYear: 2026 })
    expect(c).not.toHaveProperty('totalAnnualTax')
  })
})

describe('one helper each (L21)', () => {
  it('regimeLabel names the regime the same way on every page', () => {
    expect(profile.regimeLabel('8pct')).toBe('8% flat tax')
    expect(profile.regimeLabel('graduated_osd')).toBe('Graduated + OSD')
    expect(profile.regimeLabel('graduated_itemized')).toBe('Graduated + itemized')
  })
  it('annualReturnForm: 1701A only for purely self-employed on 8% or OSD', () => {
    const f = individual.annualReturnForm
    expect(f({ mixed: false, regime: '8pct' })).toBe('1701A')
    expect(f({ mixed: false, regime: 'osd' })).toBe('1701A')
    expect(f({ mixed: false, regime: 'graduated_osd' })).toBe('1701A')
    expect(f({ mixed: false, regime: 'itemized' })).toBe('1701')
    expect(f({ mixed: false, regime: 'graduated_itemized' })).toBe('1701')
    for (const regime of ['8pct', 'osd', 'itemized']) expect(f({ mixed: true, regime })).toBe('1701')
  })
  it('the estimator options use it', () => {
    const pure = individual.estimateIndividual({ gross: 480000, expenses: 180000, taxYear: 2026 })
    expect(pure.options.map(o => [o.key, o.returnForm, o.forms])).toEqual([
      ['8pct', '1701A', '1701Q + 1701A'],
      ['osd', '1701A', '1701Q + 1701A + 2551Q'],
      ['itemized', '1701', '1701Q + 1701 + 2551Q'],
    ])
  })
})

describe('SSS note shows the MPF portion (L21, worksheet WH:WS-12)', () => {
  it('MSC 34,500: ₱2,175 of the contributions go to the MPF', () => {
    expect(sssEmployee(34749.99).wispPortionOfTotal).toBe(2175)
    expect(payroll.sssBaseNote(34500)).toContain('Of the SSS contributions on this credit, ₱2,175 (on the part above ₱20,000) goes to the Mandatory Provident Fund (MPF).')
  })
  it('MSC 35,000 (₱34,750 and ₱50,000 pay): ₱2,250', () => {
    expect(sssEmployee(34750).wispPortionOfTotal).toBe(2250)
    expect(sssEmployee(50000).wispPortionOfTotal).toBe(2250)
    expect(payroll.sssBaseNote(35000)).toContain('₱2,250 (on the part above ₱20,000) goes to the Mandatory Provident Fund (MPF).')
  })
  it('no MPF sentence at or below the ₱20,000 threshold', () => {
    expect(payroll.sssBaseNote(20000)).not.toContain('Provident Fund')
    expect(payroll.sssBaseNote(5000)).not.toContain('Provident Fund')
  })
})
