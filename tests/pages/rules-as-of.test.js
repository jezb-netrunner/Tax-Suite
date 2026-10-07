// L11: after the October 2026 corrections the rulebook date is October 7,
// 2026, and the footer and References say "rules as of <date>" instead of
// calling the rules "current"; the "as of" notes touched in this round carry
// the new date.
import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import meta from '../../src/data/rules/meta.json'
import incomeTax from '../../src/data/rules/income-tax.json'
import penalties from '../../src/data/rules/penalties.json'
import obligationsData from '../../src/data/rules/obligations.json'

vi.mock('../../src/state/AppState.jsx', () => ({
  useApp: () => ({
    authReady: true, hasCloud: false, signedIn: false, profilesReady: true,
    profiles: [], active: null, loadError: null,
  }),
}))
const { default: App } = await import('../../src/App.jsx')
const { default: References } = await import('../../src/pages/References.jsx')

const h = React.createElement
const strip = s => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ')

describe('L11 rules as of October 7, 2026', () => {
  it('rulebook date', () => {
    expect(meta.verifiedDate).toBe('October 7, 2026')
    expect(meta.verificationMethod).toContain('October 7, 2026')
  })

  it('footer: "rules as of", not "current" or "last verified"', () => {
    const footer = strip(renderToStaticMarkup(h(MemoryRouter, { initialEntries: ['/references'] }, h(App)))).split('JEZ Tax Suite provides')[1]
    expect(footer).toContain('plus BIR, SSS, PhilHealth, Pag-IBIG, SEC, and LGU issuances, with rules as of October 7, 2026.')
    expect(footer).not.toContain('current')
    expect(footer).not.toContain('last verified')
  })

  it('References intro', () => {
    const out = strip(renderToStaticMarkup(h(MemoryRouter, null, h(References))))
    expect(out).toContain('Rules as of October 7, 2026.')
    expect(out).not.toContain('last verified')
  })

  it('the "as of" notes touched in this round carry the new date', () => {
    expect(incomeTax.graduatedBrackets.notes).toContain('Not enacted as of the October 7, 2026 review (latest report Oct 1, 2026)')
    expect(incomeTax.thirteenthMonthExclusionCap.notes).toContain('not enacted as of the October 7, 2026 review')
    expect(penalties.interest.notes).toContain('12% per annum confirmed current as of October 7, 2026')
    const einv = obligationsData.obligations.find(o => o.id === 'bir-einvoicing')
    expect(einv.notes).toContain('The Dec 31, 2026 date for the first covered group was reconfirmed in October 2026 (RR 26-2025 keeps it)')
    for (const s of [incomeTax.graduatedBrackets.notes, incomeTax.thirteenthMonthExclusionCap.notes, penalties.interest.notes, einv.notes]) {
      expect(s).not.toMatch(/as of Aug|reconfirmed Aug/)
    }
  })
})
