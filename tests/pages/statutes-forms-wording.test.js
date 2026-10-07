// L12: wording polish. The monthly 2550M is optional (RMC 52-2023), not
// "gone"; the amending laws are listed in date order with RA 12023 (VAT on
// digital services) included, in the footer and on the References page.
import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { FORMS_DATA } from '../../src/data/forms.js'

vi.mock('../../src/state/AppState.jsx', () => ({
  useApp: () => ({
    authReady: true, hasCloud: false, signedIn: false, profilesReady: true,
    profiles: [], active: null, loadError: null,
  }),
}))

const { STATUTES, statuteListText } = await import('../../src/data/statutes.js')
const { default: App } = await import('../../src/App.jsx')
const { default: References } = await import('../../src/pages/References.jsx')

const h = React.createElement
const strip = html => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ')

describe('L12 Forms: 2550M', () => {
  it('the monthly 2550M is optional, not gone', () => {
    const f = FORMS_DATA.find(x => x.code === '2550Q')
    expect(f.summary).toContain('the monthly 2550M is no longer required (optional under RMC 52-2023)')
    expect(f.summary).not.toContain('2550M is gone')
  })
})

describe('L12 amending laws in date order', () => {
  it('TRAIN, CREATE, EOPT, VAT on digital services, CREATE MORE', () => {
    expect(STATUTES.map(s => s.ra)).toEqual(['RA 10963', 'RA 11534', 'RA 11976', 'RA 12023', 'RA 12066'])
    const dates = STATUTES.map(s => s.signed)
    expect([...dates].sort()).toEqual(dates)
  })

  it('footer sentence', () => {
    expect(statuteListText()).toBe('the TRAIN Law (RA 10963), CREATE (RA 11534), the Ease of Paying Taxes Act (RA 11976), the VAT on Digital Services Act (RA 12023) and CREATE MORE (RA 12066)')
    const html = strip(renderToStaticMarkup(h(MemoryRouter, { initialEntries: ['/references'] }, h(App))))
    expect(html).toContain('Rules follow Philippine tax law as amended by the TRAIN Law (RA 10963), CREATE (RA 11534), the Ease of Paying Taxes Act (RA 11976), the VAT on Digital Services Act (RA 12023) and CREATE MORE (RA 12066)')
  })

  it('References "Primary statutes" box lists the five laws in that order', () => {
    const html = strip(renderToStaticMarkup(h(MemoryRouter, null, h(References))))
    const pos = ['RA 10963 (TRAIN, 2017)', 'RA 11534 (CREATE, 2021)', 'RA 11976 (Ease of Paying Taxes Act, 2024)', 'RA 12023 (VAT on Digital Services, 2024)', 'RA 12066 (CREATE MORE, 2024)']
      .map(t => html.indexOf(t))
    expect(pos.every(p => p >= 0)).toBe(true)
    expect([...pos].sort((a, b) => a - b)).toEqual(pos)
  })
})
