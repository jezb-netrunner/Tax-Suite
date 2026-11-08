// November 2026 audit (AUDIT-2026-11.md), UI/UX findings U1-U18.
import { describe, it, expect, vi, afterAll } from 'vitest'
import React from 'react'
import fs from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import obligationsData from '../../src/data/rules/obligations.json'
import { defaultProfile, profileInitial } from '../../src/engine/profile.js'
import { estimateEmployee } from '../../src/engine/estimators/employee.js'
import { generateDeadlines } from '../../src/engine/deadlines.js'
import { HOLIDAY_SET } from '../../src/lib/deadlineData.js'
import { printHeaderText } from '../../src/lib/exports.js'
import { fromISO } from '../../src/engine/dates.js'

vi.useFakeTimers({ toFake: ['Date'] })
vi.setSystemTime(new Date('2026-11-08T04:00:00Z'))
afterAll(() => vi.useRealTimers())

const state = { profile: null }
vi.mock('../../src/state/AppState.jsx', () => ({
  useApp: () => ({
    authReady: true, hasCloud: false, signedIn: true, profilesReady: true, loadError: null,
    profiles: state.profile ? [state.profile] : [], active: state.profile, save: async p => p,
  }),
}))
const { default: Estimator } = await import('../../src/pages/Estimator.jsx')
const { default: ToolsPage, KNOWN_EXTENSIONS } = await import('../../src/pages/Tools.jsx')
const render = el => renderToStaticMarkup(React.createElement(MemoryRouter, null, el))
  .replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/\s+/g, ' ')
const css = fs.readFileSync(new URL('../../src/styles/app.css', import.meta.url), 'utf8')

describe('layout fixes (CSS)', () => {
  it('U1: the countdown column has a width limit and wraps its notes', () => {
    expect(css).toMatch(/\.hero-side \{[^}]*max-width: 300px;[^}]*overflow-wrap: anywhere;/)
  })
  it('U2: the profile menu scrolls inside the screen', () => {
    expect(css).toMatch(/\.menu-pop \{[^}]*max-height: calc\(100vh - 90px\); overflow-y: auto;/)
  })
  it('U14: user-typed names wrap instead of widening the page', () => {
    expect(css).toContain('.pg-h1, .user-text, .print-head { overflow-wrap: anywhere; }')
  })
})

describe('U4 employee with more than one employer', () => {
  it('the engine adds the other employers\' pay and withholding and gives the Form 1700 balance', () => {
    const e = estimateEmployee({ monthlyBasic: 25000, bonusesAnnual: 25000, multipleEmployers: true, otherEmployersTaxable: 300000, otherEmployersWithheld: 7500 })
    expect(e.combined).not.toBe(null)
    expect(e.combined.taxable).toBe(e.annualTaxable + 300000)
    const balance = e.annualRows.find(x => x.label === 'Balance to pay with Form 1700' || x.label === 'Overpayment on Form 1700')
    expect(balance.sub).toContain('file Form 1700 by April 15 with every 2316')
    // One employer: no combined rows.
    expect(estimateEmployee({ monthlyBasic: 25000 }).combined).toBe(null)
  })
  it('the Estimator shows the boxes and the warning only on a two-employer profile', () => {
    state.profile = { ...defaultProfile('employee'), id: 'e', name: 'Emil', multipleEmployers: true, inputs: { employee: { monthlyBasic: 25000 } } }
    const t = render(React.createElement(Estimator))
    expect(t).toContain('More than one employer this year.')
    expect(t).toContain('Taxable compensation from your other employer(s) · year')
    state.profile = { ...state.profile, multipleEmployers: false }
    expect(render(React.createElement(Estimator))).not.toContain('More than one employer this year.')
  })
})

describe('U6 fiscal-year quarters name their months', () => {
  it('calendar-quarter withholding returns and fiscal-quarter returns can be told apart', () => {
    const corp = { ...defaultProfile('corporation'), name: 'June Co', fiscalYearEndMonth: 6, withholdsEwt: true, vatRegistered: false }
    const list = generateDeadlines(obligationsData.obligations, corp, { from: fromISO('2027-01-01'), to: fromISO('2027-03-31'), holidays: HOLIDAY_SET, refDate: fromISO('2027-01-01') })
    const eq = list.find(d => d.obligation.id === 'bir-1601eq')
    const pt = list.find(d => d.obligation.id === 'bir-2551q')
    expect(eq.label).toBe('Q4 (Oct–Dec 2026)')
    expect(pt.label).toBe('Q2 (Oct–Dec 2026)')
    expect(pt.period).toBe('Q2 FY2027 (Oct–Dec 2026)')
  })
  it('the calendar printout names its window, not a tax year', () => {
    expect(printHeaderText({ profileName: 'June Co', taxYear: 2026, printedOn: fromISO('2026-11-08'), periodText: 'Deadlines for the 13 months from Nov 8, 2026' }))
      .toBe('JEZ Tax Suite · June Co · Deadlines for the 13 months from Nov 8, 2026 · Printed Nov 8, 2026')
  })
})

describe('Tools page', () => {
  it('U8: the extensions the calendar knows are offered to the penalty calculator', () => {
    const apr = KNOWN_EXTENSIONS.find(e => e.rawDate === '2026-04-15')
    expect(apr).toMatchObject({ newDate: '2026-05-15', basis: 'RMC 30-2026' })
    expect(apr.forms).toEqual(expect.arrayContaining(['1700', '1701', '1701A', '1702-RT']))
  })
  it('U11: the projector starts blank, with no made-up gross', () => {
    state.profile = { ...defaultProfile('individual'), id: 'f', name: 'F', regime: '8pct' }
    const t = render(React.createElement(ToolsPage))
    expect(t).toContain('Enter your gross sales or receipts from January to now')
    expect(t).not.toContain('Projected gross sales / receipts')
  })
})

describe('small fixes', () => {
  it('U12: a take-home below zero is explained', () => {
    const e = estimateEmployee({ monthlyBasic: 100 })
    expect(e.monthlyTakeHome).toBeLessThan(0)
    expect(e.rows.find(x => x.label === 'Estimated monthly take-home').sub).toContain('minimum contributions are more than this pay')
  })
  it('U15: an emoji is one character on the avatar', () => {
    expect(profileInitial('😀 Juan')).toBe('😀')
    expect(profileInitial('  ana')).toBe('A')
    expect(profileInitial('')).toBe('?')
  })
  it('U18: the business-permit chip no longer repeats the agency; the 2316 item speaks of every employer', () => {
    const ob = id => obligationsData.obligations.find(o => o.id === id)
    expect(ob('lgu-business-permit').form).toBe('Mayor\'s permit')
    expect(ob('bir-2316-collect').desc).toContain('collect one from every employer')
  })
})
