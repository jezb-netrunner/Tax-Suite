// L10: "Read the form guide" on the next-deadline card opens that deadline's
// own form on the Forms page (e.g. #/forms?open=1601-C), expanded; the button
// is hidden when the Forms page has no guide for that form.
import { describe, it, expect, vi, afterAll } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { defaultProfile } from '../../src/engine/profile.js'

// BUG-15 / UX-20 evidence: a corporation with employees on Oct 7, 2026 (Manila):
// next deadline 1601-C for September 2026, due Mon Oct 12, 2026 (DL:WS-05).
vi.useFakeTimers({ toFake: ['Date'] })
vi.setSystemTime(new Date('2026-10-07T04:00:00Z'))
afterAll(() => vi.useRealTimers())

const fox = {
  ...defaultProfile('corporation'), id: 'p-fox', name: 'Fox Trading Corporation',
  hasEmployees: true, vatRegistered: true, registrationYear: 2020,
}
const state = { profile: fox }
vi.mock('../../src/state/AppState.jsx', () => ({
  useApp: () => ({
    authReady: true, hasCloud: false, signedIn: true, profilesReady: true,
    profiles: [state.profile], active: state.profile, loadError: null, save: async p => p,
  }),
}))
const { formGuideCode, formGuidePath } = await import('../../src/lib/formGuide.js')
const { default: Dashboard } = await import('../../src/pages/Dashboard.jsx')
const { default: FormsPage } = await import('../../src/pages/Forms.jsx')

const h = React.createElement
const render = (el, path = '/') => renderToStaticMarkup(h(MemoryRouter, { initialEntries: [path] }, el))

describe('L10 formGuideCode: the Forms-page entry for a deadline form', () => {
  it.each([
    ['1601-C', '1601-C'],
    ['1701Q', '1701Q'],
    ['2550Q', '2550Q'],
    ['1702-RT', '1702-RT'],
    ['0619-F', '0619-F / 1601-FQ / 1604-F'],
    ['1601-FQ', '0619-F / 1601-FQ / 1604-F'],
    ['1701Q / 1905', '1701Q'],
    ['2306', null],
    ['SSS R-5/PRN', null],
    ['2nd installment', null],
    ['—', null],
    [null, null],
  ])('%j -> %j', (form, code) => {
    expect(formGuideCode(form)).toBe(code)
  })

  it('formGuidePath', () => {
    expect(formGuidePath('1601-C')).toBe('/forms?open=1601-C')
    expect(formGuidePath('1601-FQ')).toBe('/forms?open=0619-F%20%2F%201601-FQ%20%2F%201604-F')
    expect(formGuidePath('SSS R-5/PRN')).toBe(null)
  })
})

describe('L10 next-deadline card', () => {
  it("links to the deadline's own form (1601-C), not 1701Q", () => {
    state.profile = fox
    const out = render(h(Dashboard))
    expect(out).toContain('Remit withholding tax on compensation')
    expect(out).toMatch(/<a [^>]*href="\/forms\?open=1601-C"[^>]*>Read the 1601-C form guide →<\/a>/)
    expect(out).not.toContain('href="/forms"')
  })
})

describe('L10 Forms page opens the requested form', () => {
  const rowOf = (out, code) => out.match(new RegExp(`<div role="button" tabindex="0" aria-expanded="(true|false)" class="form-row-head"[^>]*><span class="formcode">${code.replace(/[/]/g, '\\/')}</span>`))
  it('?open=1601-C expands 1601-C only', () => {
    const out = render(h(FormsPage), '/forms?open=1601-C')
    expect(rowOf(out, '1601-C')[1]).toBe('true')
    expect(rowOf(out, '1701Q')[1]).toBe('false')
  })
  it('a combined guide opens from its encoded code', () => {
    const out = render(h(FormsPage), '/forms?open=0619-F%20%2F%201601-FQ%20%2F%201604-F')
    expect(rowOf(out, '0619-F / 1601-FQ / 1604-F')[1]).toBe('true')
  })
  it('without ?open (or with an unknown code) the page opens as before, on 1701Q', () => {
    expect(rowOf(render(h(FormsPage), '/forms'), '1701Q')[1]).toBe('true')
    expect(rowOf(render(h(FormsPage), '/forms?open=XYZ'), '1701Q')[1]).toBe('true')
  })
})
