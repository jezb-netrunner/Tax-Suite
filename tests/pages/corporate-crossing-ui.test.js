// H04 (corporations): the corporate estimator asks the month a non-VAT
// corporation's sales passed ₱3,000,000, shows the 3% percentage tax on the
// sales up to then, and the banner names it (TB:W16 corporate).
import { describe, it, expect, vi, afterAll } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { defaultProfile } from '../../src/engine/profile.js'

vi.useFakeTimers({ toFake: ['Date'] })
vi.setSystemTime(new Date('2026-10-07T04:00:00Z'))
afterAll(() => vi.useRealTimers())

const state = { profile: null }
vi.mock('../../src/state/AppState.jsx', () => ({
  useApp: () => ({
    authReady: true, hasCloud: false, signedIn: true, profilesReady: true, loadError: null,
    profiles: [state.profile], active: state.profile, save: async p => p,
  }),
}))
const { default: Estimator } = await import('../../src/pages/Estimator.jsx')

const fox = inputs => ({
  ...defaultProfile('corporation'), id: 'p-fox', name: 'Fox Corp', vatRegistered: false, registrationYear: 2015,
  inputs: { corporation: { grossSales: 3200000, costOfSales: 1000000, opex: 1000000, totalAssets: 1000000, taxYear: 2026, ...inputs } },
})
const text = () => renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Estimator)))
  .replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/\s+/g, ' ')

describe('TB:W16 (corporate) on the estimator page', () => {
  it('month not given: asks the month (default December), banner shows ₱96,000 percentage tax', () => {
    state.profile = fox({})
    const t = text()
    expect(t).toContain('Your sales passed ₱3,000,000 this year')
    expect(t).toContain('Month your sales passed ₱3,000,000')
    expect(t).toContain('Not sure: assume even monthly sales (December)')
    expect(t).toContain('Plus ₱96,000 percentage tax on sales from January to December (Form 2551Q). VAT applies from January 2027: not included in this estimate.')
    expect(t).not.toContain('8% income tax already paid')
  })
  it('October: banner shows ₱80,000 and VAT from November 2026', () => {
    state.profile = fox({ crossedMonth: 10 })
    const t = text()
    expect(t).toContain('Sales from January to October')
    expect(t).toContain('Plus ₱80,000 percentage tax on sales from January to October (Form 2551Q). VAT applies from November 2026: not included in this estimate.')
  })
})
