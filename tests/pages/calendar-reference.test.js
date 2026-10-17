// The calendar is a reference, not a tracker (owner, Oct 17, 2026). "Mark as
// filed" is gone: no buttons, no "Filed" ticks, no Overdue list. The due dates
// of the last 60 days are under "Recently passed", closed on screen until
// "Show dates" but always printed (M22). A filter shows only some agencies or
// types; it is not printed.
import { describe, it, expect, vi, afterAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { defaultProfile } from '../../src/engine/profile.js'

// Oct 8, 2026 (Manila), a VAT-registered corporation registered in 2015 with
// employees: 11 due dates in the last 60 days. Its profile still carries a
// mark saved while the app had "Mark as filed"; nothing shows it.
vi.useFakeTimers({ toFake: ['Date'] })
vi.setSystemTime(new Date('2026-10-08T04:00:00Z'))
afterAll(() => vi.useRealTimers())

const corp = {
  ...defaultProfile('corporation'), id: 'p-corp', name: 'Fox VAT Corp', vatRegistered: true, registrationYear: 2015, hasEmployees: true,
  filed: { 'bir-1601c:2026-09-10': '2026-09-09' },
}
vi.mock('../../src/state/AppState.jsx', () => ({
  useApp: () => ({
    authReady: true, hasCloud: false, signedIn: true, profilesReady: true, loadError: null,
    profiles: [corp], active: corp, save: async p => p, updateProfile: async () => corp,
  }),
}))
const { default: Dashboard } = await import('../../src/pages/Dashboard.jsx')

const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Dashboard)))
const text = html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ')
const listStart = html.indexOf('<ul id="recent-list"')
const list = html.slice(listStart, html.indexOf('</ul>', listStart))
const css = fs.readFileSync(path.resolve(__dirname, '../../src/styles/app.css'), 'utf8')
const printBlock = css.slice(css.indexOf('@media print'), css.indexOf('@media (prefers-reduced-motion'))
const pressed = [...html.matchAll(/<button type="button" class="fchip" aria-pressed="(true|false)">([^<]*)<\/button>/g)]
  .map(m => [m[2].replace(/&amp;/g, '&'), m[1]])

describe('the calendar does not track filing', () => {
  it('no "Mark as filed", "Mark all", "Unmark", "Doesn’t apply to me" or "Filed" tick box', () => {
    for (const s of ['Mark as filed', 'Mark all', 'Unmark', 'Doesn’t apply to me', 'marked filed', 'Marked in the last']) {
      expect(text, s).not.toContain(s)
    }
    expect(html).not.toContain('type="checkbox"')
  })
  it('nothing is called overdue: the app cannot know what was filed', () => {
    expect(text).not.toMatch(/overdue/i)
  })
  it('the income-tax box lists the 2026 dates, passed ones as "was due", with no tick or count', () => {
    expect(text).toContain('2026 income-tax filings')
    expect(text).toContain('1702Q Q2 · was due Sep 1, 2026')
    expect(text).toContain('1702Q Q3 · due Dec 1, 2026')
    expect(text).not.toMatch(/\d+ of \d+ marked/)
  })
})

describe('Recently passed (was Overdue)', () => {
  it('the heading counts the 11 due dates of the last 60 days', () => {
    expect(html).toContain('Recently passed (11)')
  })
  it('closed until "Show dates"', () => {
    expect(html).toMatch(/<button type="button" class="btn sm ghost" aria-expanded="false" aria-controls="recent-list">Show dates<\/button>/)
    expect(html).toContain('<ul id="recent-list" class="list-card print-only"')
  })
  it('all 11 rows are in the page, so a printout lists them all; each says when it was due', () => {
    expect([...list.matchAll(/<li /g)]).toHaveLength(11)
    expect(text).toContain('Was due Mon, Aug 10, 2026 (59 days ago)')
    expect(text).toContain('Was due Thu, Sep 10, 2026 (28 days ago) · 1601-C') // the old "filed" mark is ignored
  })
  it('the stylesheet hides a closed list on screen and prints it', () => {
    expect(css).toMatch(/\.print-only\s*\{\s*display:\s*none;?\s*\}/)
    expect(printBlock).toMatch(/\.print-only\s*\{\s*display:\s*block\s*!important;?\s*\}/)
  })
  it('the penalty link stays for a return not yet filed', () => {
    expect(text).toContain('If one of these is not filed yet, file and pay as soon as you can')
    expect(html).toContain('href="/tools"')
  })
})

describe('calendar filter', () => {
  it('one button per agency and per type on this calendar, none picked', () => {
    expect(pressed).toEqual([
      ['BIR', 'false'], ['SSS', 'false'], ['PhilHealth', 'false'], ['Pag-IBIG', 'false'], ['LGU', 'false'], ['SEC', 'false'], ['DOLE', 'false'],
      ['Income tax', 'false'], ['Business tax', 'false'], ['Withholding', 'false'], ['Payroll & contributions', 'false'], ['Registration', 'false'],
    ])
    expect(text).toContain('Show only Agency BIR')
    expect(text).toContain('Type Income tax')
    // A polite live region, so a screen reader hears the new count after each click.
    expect(html).toContain('<span aria-live="polite">Pick one or more to show only those. Nothing picked shows everything.</span>')
  })
  it('is not printed; the summary line (printed) says nothing is filtered', () => {
    expect(html).toContain('class="cal-filter no-print" role="group" aria-labelledby="filter-h"')
    expect(text).toMatch(/Showing \d+ dated obligations over the next 13 months for Fox VAT Corp\./)
  })
})
