import { describe, it, expect } from 'vitest'
import { compensationForMixed, estimateIndividual } from '../../src/engine/estimators/individual.js'

// M05: the Mixed income tab takes annual taxable compensation and employer
// withholding from the Compensation side tab when that tab is filled (and says
// so), otherwise from its own boxes; it warns when both are filled and differ.
// Compensation tab case = TI:WS-22: monthly basic ₱50,000, 13th month and bonuses
// ₱100,000 -> annual taxable ₱571,600, annual tax ₱56,820 (what the employer
// withholds by December after the year-end adjustment).

const WS22 = { monthlyBasic: 50000, monthlyAllowances: 0, bonusesAnnual: 100000 }

describe('compensationForMixed', () => {
  it('Compensation tab filled, Mixed boxes empty: uses the tab (₱571,600 / ₱56,820)', () => {
    expect(compensationForMixed({}, WS22)).toEqual({
      source: 'compensationTab', taxable: 571600, withheld: 56820,
      ownTaxable: null, ownWithheld: null, differs: false,
    })
  })
  it('only the Mixed boxes filled: uses them', () => {
    expect(compensationForMixed({ compensationTaxable: 600000, compensationWithheld: 62500 }, null)).toEqual({
      source: 'own', taxable: 600000, withheld: 62500,
      ownTaxable: 600000, ownWithheld: 62500, differs: false,
    })
  })
  it('both filled and different: uses the tab and flags the difference', () => {
    const c = compensationForMixed({ compensationTaxable: 600000, compensationWithheld: 62500 }, WS22)
    expect(c.source).toBe('compensationTab')
    expect(c.taxable).toBe(571600)
    expect(c.withheld).toBe(56820)
    expect(c.differs).toBe(true)
  })
  it('both filled and equal: no warning', () => {
    const c = compensationForMixed({ compensationTaxable: 571600, compensationWithheld: 56820 }, WS22)
    expect(c.differs).toBe(false)
  })
  it('compared as whole-peso return lines: ₱386,135 / ₱20,420 typed vs ₱386,135.04 / ₱20,420.26 on the tab is not a difference', () => {
    // Monthly basic ₱35,003 -> annual taxable ₱386,135.04, annual tax ₱20,420.26 (employee estimator).
    const tab = { monthlyBasic: 35003 }
    expect(compensationForMixed({}, tab)).toMatchObject({ taxable: 386135.04, withheld: 20420.26 })
    expect(compensationForMixed({ compensationTaxable: 386135, compensationWithheld: 20420 }, tab).differs).toBe(false)
    expect(compensationForMixed({ compensationTaxable: 386136, compensationWithheld: 20420 }, tab).differs).toBe(true)
  })
  it('only one Mixed box filled and it differs: flagged', () => {
    expect(compensationForMixed({ compensationTaxable: null, compensationWithheld: 50000 }, WS22).differs).toBe(true)
  })
  it('Compensation tab with an empty salary counts as not filled', () => {
    const c = compensationForMixed({ compensationTaxable: 300000 }, { monthlyBasic: null, bonusesAnnual: 20000 })
    expect(c.source).toBe('own')
    expect(c.taxable).toBe(300000)
    expect(c.withheld).toBe(0)
  })
  it('nothing filled anywhere', () => {
    expect(compensationForMixed({}, undefined)).toEqual({
      source: 'none', taxable: 0, withheld: 0, ownTaxable: null, ownWithheld: null, differs: false,
    })
  })
})

describe('mixed estimate fed from the Compensation tab', () => {
  it('WS-22 compensation + ₱400,000 business: 8% = 56,820 + 32,000 = ₱88,820; payable after ₱56,820 withheld = ₱32,000', () => {
    const c = compensationForMixed({}, WS22)
    const r = estimateIndividual({
      gross: 400000, mixed: true, compensationTaxable: c.taxable, compensationWithheld: c.withheld,
    })
    // compensation 571,600 -> 22,500 + 20% × 171,600 = 56,820
    expect(r.best.key).toBe('8pct')
    expect(r.best.total).toBe(88820)
    expect(r.netPayable).toBe(32000)
  })
})

describe('blank boxes (null) are treated as nothing entered', () => {
  it('all-null individual inputs give ₱0 everywhere without errors', () => {
    const r = estimateIndividual({ gross: null, expenses: null, cwt: null, otherIncome: null, nolcoPrior: null })
    expect(r.best.total).toBe(0)
    expect(r.netPayable).toBe(0)
  })
})
