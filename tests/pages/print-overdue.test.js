// M22 (follow-up): the printed calendar ("Print / Save as PDF") lists every
// overdue deadline. On screen the Overdue list shows the first 5 until "Show
// all" is pressed, but buttons are hidden in print, so the rest is rendered
// with a class that is hidden on screen and shown in print.
import { describe, it, expect, vi, afterAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { defaultProfile } from '../../src/engine/profile.js'

// The review's case: Oct 8, 2026 (Manila), a VAT-registered corporation
// registered in 2015, with nothing marked filed: 11 overdue deadlines.
vi.useFakeTimers({ toFake: ['Date'] })
vi.setSystemTime(new Date('2026-10-08T04:00:00Z'))
afterAll(() => vi.useRealTimers())

const corp = { ...defaultProfile('corporation'), id: 'p-corp', name: 'Fox VAT Corp', vatRegistered: true, registrationYear: 2015, hasEmployees: true }
vi.mock('../../src/state/AppState.jsx', () => ({
  useApp: () => ({
    authReady: true, hasCloud: false, signedIn: true, profilesReady: true, loadError: null,
    profiles: [corp], active: corp, save: async p => p, updateProfile: async () => corp,
  }),
}))
const { default: Dashboard } = await import('../../src/pages/Dashboard.jsx')

const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Dashboard)))
const list = html.slice(html.indexOf('id="overdue-list"'), html.indexOf('</ul>', html.indexOf('id="overdue-list"')))
const rows = [...list.matchAll(/<li[^>]*class="([^"]*)"/g)].map(m => m[1])
const css = fs.readFileSync(path.resolve(__dirname, '../../src/styles/app.css'), 'utf8')
const printBlock = css.slice(css.indexOf('@media print'), css.indexOf('@media (prefers-reduced-motion'))

describe('M22 printed calendar lists every overdue item', () => {
  it('the heading says 11 overdue', () => {
    expect(html).toContain('Overdue (11)')
  })
  it('all 11 overdue rows are in the page; the 6 after the first 5 are print-only on screen', () => {
    expect(rows).toHaveLength(11)
    expect(rows.filter(c => c.split(' ').includes('print-extra'))).toHaveLength(6)
    expect(rows.slice(0, 5).every(c => !c.includes('print-extra'))).toBe(true)
  })
  it('the stylesheet hides those rows on screen and shows them in print', () => {
    expect(css).toMatch(/\.frow\.print-extra\s*\{\s*display:\s*none;?\s*\}/)
    expect(printBlock).toMatch(/\.frow\.print-extra\s*\{\s*display:\s*flex;?\s*\}/)
  })
  it('"Show all 11 overdue" still works on screen', () => {
    expect(html).toContain('Show all 11 overdue')
  })
})
