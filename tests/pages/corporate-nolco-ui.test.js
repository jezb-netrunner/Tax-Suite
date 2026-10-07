// M04 (corporations): the corporate estimator shows a net loss and its NOLCO,
// and has an optional "NOLCO from prior years" box used only with itemized
// deductions.
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
  ...defaultProfile('corporation'), id: 'p-fox', name: 'Fox Corp', registrationYear: 2015,
  inputs: { corporation: { totalAssets: 1000000, taxYear: 2026, ...inputs } },
})
const text = () => renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Estimator)))
  .replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/\s+/g, ' ')

describe('M04 corporate net loss on the estimator page', () => {
  it('sales 500,000, cost 400,000, opex 300,000: net loss ₱200,000 and its NOLCO years', () => {
    state.profile = fox({ grossSales: 500000, costOfSales: 400000, opex: 300000 })
    const t = text()
    expect(t).toContain('Net loss ₱200,000')
    expect(t).toContain('(TY 2027 to TY 2029)')
    expect(t).toContain('NOLCO from prior years')
  })
  it('the prior-year NOLCO box says it is not used with the OSD', () => {
    state.profile = fox({ grossSales: 1000000, costOfSales: 400000, deduction: 'osd', nolcoPrior: 250000 })
    const t = text()
    expect(t).toContain('NOLCO from prior years can\'t be used in a year on the 40% OSD')
  })
})
