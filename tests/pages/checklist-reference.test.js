// The Checklist is a reference list, not a tracker (owner, Oct 17, 2026): it
// shows the obligations with no fixed date and their legal basis, with no
// tick boxes and no "N of M ticked" count. Ticks saved by an earlier version
// are ignored.
import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { defaultProfile } from '../../src/engine/profile.js'

// A VAT-registered corporation with an old tick on "Issue BIR-registered invoices".
const corp = {
  ...defaultProfile('corporation'), id: 'p-corp', name: 'Fox VAT Corp', vatRegistered: true, registrationYear: 2015, hasEmployees: true,
  checklistDone: { 'bir-invoices': '2026-10-01' },
}
vi.mock('../../src/state/AppState.jsx', () => ({
  useApp: () => ({
    authReady: true, hasCloud: false, signedIn: true, profilesReady: true, loadError: null,
    profiles: [corp], active: corp, save: async p => p, updateProfile: async () => corp,
  }),
}))
const { default: Checklist } = await import('../../src/pages/Checklist.jsx')

const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Checklist)))
const text = html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/\s+/g, ' ')

describe('the Checklist is a reference list', () => {
  it('still lists the obligations with no fixed date, with their legal basis', () => {
    expect(text).toContain('Compliance checklist')
    expect(text).toContain('Issue BIR-registered invoices for every sale')
    expect(text).toContain('Keep books of accounts up to date')
    expect(text).toContain('File the General Information Sheet (GIS)')
    expect(text).toContain('NIRC Sec 237, as amended by RA 11976 (EOPT)')
  })
  it('has no tick boxes and no ticked count, and ignores old ticks', () => {
    expect(html).not.toContain('type="checkbox"')
    expect(text).not.toMatch(/\bticked\b|tick an item/i)
  })
  it('each item has a plain dot instead of a box', () => {
    const rows = (html.match(/class="check-row"/g) || []).length
    expect(rows).toBeGreaterThan(0)
    expect((html.match(/<span class="check-dot" aria-hidden="true"><\/span>/g) || []).length).toBe(rows)
  })
})
