// H07: the References page and the calendar/checklist rows show an
// "Unconfirmed: check with the agency" badge for needs_review rules, each
// rule's value (tables as tables) and the obligation notes ("Details").
import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import References from '../../src/pages/References.jsx'
import { UnconfirmedBadge, ConfidenceBadge, DeadlineDetails, UNCONFIRMED_LABEL } from '../../src/components/Confidence.jsx'
import { ruleRegister } from '../../src/engine/rulebook.js'
import { HOLIDAY_SET, OBLIGATIONS } from '../../src/lib/deadlineData.js'
import { generateDeadlines, UNCONFIRMED_RULE, unconfirmedRollOverReason } from '../../src/engine/deadlines.js'
import { defaultProfile } from '../../src/engine/profile.js'
import { fromISO, iso } from '../../src/engine/dates.js'

const h = React.createElement
const render = el => renderToStaticMarkup(h(MemoryRouter, null, el))
const count = (s, sub) => s.split(sub).length - 1
const tableRows = html => (html.match(/<tr[^>]*>.*?<\/tr>/g) || [])
  .map(r => [...r.matchAll(/<t[dh][^>]*>(.*?)<\/t[dh]>/g)].map(m => m[1].replace(/<[^>]+>/g, '')))

describe('H07 badge component', () => {
  it('shows the visible label and a screen-reader explanation', () => {
    const html = renderToStaticMarkup(h(UnconfirmedBadge, { reasons: [UNCONFIRMED_RULE] }))
    expect(UNCONFIRMED_LABEL).toBe('Unconfirmed: check with the agency')
    expect(html).toContain('Unconfirmed: check with the agency')
    expect(html).toContain('<span class="sr-only">. This rule is not yet confirmed from an official source.</span>')
  })
  it('a verified rule shows "Verified"', () => {
    const html = renderToStaticMarkup(h(ConfidenceBadge, { confidence: 'verified' }))
    expect(html).toContain('Verified')
    expect(html).not.toContain(UNCONFIRMED_LABEL)
  })
})

describe('H07 calendar row details', () => {
  const freelancer = { ...defaultProfile('individual'), name: 'Paolo' }
  const list = generateDeadlines(OBLIGATIONS, freelancer, {
    from: fromISO('2026-10-01'), to: fromISO('2026-11-30'), holidays: HOLIDAY_SET, refDate: fromISO('2026-10-07'),
  })
  it('a Details disclosure shows why the date is unconfirmed, the notes and the legal basis', () => {
    const d = list.find(x => x.obligation.id === 'pagibig-self' && iso(x.rawDate) === '2026-10-10')
    const html = renderToStaticMarkup(h(DeadlineDetails, { d }))
    expect(html).toMatch(/^<details/)
    expect(html).toContain('<summary')
    expect(html).toContain('Details<span class="sr-only"> for Pay Pag-IBIG')
    expect(html).toContain(UNCONFIRMED_RULE)
    expect(html).toContain(unconfirmedRollOverReason('Pag-IBIG'))
    expect(html).toContain('RA 9679')
  })
  it('notes of a verified obligation are shown', () => {
    const d = list.find(x => x.obligation.id === 'sss-self')
    const html = renderToStaticMarkup(h(DeadlineDetails, { d }))
    expect(html).toContain('Self-employed and voluntary members pay the full 15% themselves')
    expect(html).not.toContain('Why unconfirmed')
  })
})

describe('H07 References page', () => {
  const html = render(h(References))
  const r = ruleRegister()
  const entries = [...r.computation, ...r.holidays, ...r.obligations]

  it('one "Unconfirmed" badge per needs_review rule, a "Verified" badge for every other rule', () => {
    const review = entries.filter(e => e.confidence === 'needs_review').length
    expect(review).toBeGreaterThan(20)
    expect(count(html, UNCONFIRMED_LABEL)).toBe(review)
    expect(count(html, '>Verified<')).toBe(entries.length - review)
  })

  it('shows the graduated brackets and the monthly withholding table as tables', () => {
    const rows = tableRows(html)
    expect(rows).toContainEqual(['Over', 'Not over', 'Base tax', 'Rate'])
    expect(rows).toContainEqual(['₱400,000', '₱800,000', '₱22,500', '20%'])
    expect(rows).toContainEqual(['₱8,000,000', 'No limit', '₱2,202,500', '35%'])
    expect(rows).toContainEqual(['₱66,667', '₱8,541.80', '25%'])
  })

  it('shows obligation schedules, holiday notes and the roll-over rules per agency', () => {
    expect(html).toContain('15 days after the taxable year ends (January 15 for calendar-year taxpayers)')
    expect(html).toContain('Each year by May 15 (Q1), August 15 (Q2) and November 15 (Q3)')
    expect(html).toContain('2027 dates are verified against Proclamation No. 1427 s.2026')
    expect(html).toContain('Still pending: Eid&#x27;l Fitr and Eid&#x27;l Adha 2027')
    expect(html).toContain('This date never moves later')
    const rows = tableRows(html)
    expect(rows.find(row => row[0] === 'Pag-IBIG')).toBeTruthy()
    expect(rows.find(row => row[0] === 'LGU')[1]).toBe('Stays on the date set by law')
  })

  it('the intro stays true: values come from the same files the app uses', () => {
    expect(html).toContain('the values shown here are the ones the calculators and the calendar use')
    expect(html).not.toContain('exactly what the calculators and calendar use')
  })
})
