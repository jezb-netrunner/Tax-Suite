// H14 (owner decision 18): a Privacy Notice under the Data Privacy Act of 2012
// (RA 10173), linked from the footer, sign-up and profile setup, and a
// required consent checkbox at sign-up. The notice is rendered to plain HTML
// here and checked for every element REVIEW.md asks for; the sign-up helper is
// checked with a mocked Supabase client.
import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import Privacy, { PRIVACY_PLACEHOLDERS, PRIVACY_NOTICE_UPDATED, operatorDetails } from '../../src/pages/Privacy.jsx'
import operator from '../../src/data/operator.json'
import { signUp, PRIVACY_NOTICE_VERSION } from '../../src/lib/auth.js'

function render(mode) {
  const html = renderToStaticMarkup(
    React.createElement(StaticRouter, { location: '/privacy' }, React.createElement(Privacy, { mode })),
  )
  // Plain text with single spaces, so phrases split across tags still match.
  return html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ')
}

describe('H14 Privacy Notice page', () => {
  const local = render('local')
  const accounts = render('accounts')

  it('names the law and is dated', () => {
    expect(local).toContain('Data Privacy Act of 2012 (Republic Act 10173)')
    expect(PRIVACY_NOTICE_UPDATED).toBe('October 17, 2026')
    expect(local).toContain('Last updated October 17, 2026')
  })

  it('shows the owner placeholders, clearly marked, while operator.json is not filled in', () => {
    expect(PRIVACY_PLACEHOLDERS).toEqual({
      contactEmail: '[CONTACT EMAIL]',
      dpoName: '[DPO NAME]',
      region: '[REGION]',
    })
    const blank = operatorDetails({ contactEmail: '', dpoName: '  ', region: '' })
    const html = mode => renderToStaticMarkup(React.createElement(StaticRouter, { location: '/privacy' }, React.createElement(Privacy, { mode, details: blank })))
    for (const mode of ['local', 'accounts']) {
      // Every placeholder is wrapped in a highlighted marker the owner can spot.
      expect(html(mode).match(/<mark[^>]*data-placeholder="true"[^>]*>\[CONTACT EMAIL\]<\/mark>/g).length).toBeGreaterThan(0)
      expect(html(mode)).toMatch(/<mark[^>]*data-placeholder="true"[^>]*>\[DPO NAME\]<\/mark>/)
    }
    // The server region matters only once accounts are switched on.
    expect(html('accounts')).toMatch(/<mark[^>]*data-placeholder="true"[^>]*>\[REGION\]<\/mark>/)
    expect(html('local')).not.toContain('[REGION]')
    expect(html('local')).toContain('Accounts are not switched on for this site, so nothing is stored there.')
  })

  // Audit Nov 11, 2026: the operator's details come from one file.
  it('shows the details from src/data/operator.json once they are filled in, with no placeholder left', () => {
    const filled = operatorDetails({ contactEmail: ' privacy@example.ph ', dpoName: 'Juan Dela Cruz', region: 'Singapore' })
    expect(filled.contactEmail).toEqual({ text: 'privacy@example.ph', missing: false })
    for (const mode of ['local', 'accounts']) {
      const html = renderToStaticMarkup(React.createElement(StaticRouter, { location: '/privacy' }, React.createElement(Privacy, { mode, details: filled })))
      expect(html).not.toContain('data-placeholder')
      expect(html).not.toMatch(/\[CONTACT EMAIL\]|\[DPO NAME\]|\[REGION\]/)
      expect(html).toContain('<a href="mailto:privacy@example.ph"')
      expect(html).toContain('Juan Dela Cruz')
    }
    const accounts = renderToStaticMarkup(React.createElement(StaticRouter, { location: '/privacy' }, React.createElement(Privacy, { mode: 'accounts', details: filled })))
    expect(accounts).toContain('Singapore')
  })

  it('operator.json has exactly the three details, as text', () => {
    expect(Object.keys(operator).filter(k => !k.startsWith('$')).sort()).toEqual(['contactEmail', 'dpoName', 'region'])
    for (const k of ['contactEmail', 'dpoName', 'region']) expect(typeof operator[k]).toBe('string')
    // A filled-in contact must be an email address (it becomes a mailto: link).
    if (operator.contactEmail) expect(operator.contactEmail).toMatch(/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/)
  })

  it('lists what is collected: profile names, taxpayer type, registration answers, estimator figures; email and password only in accounts mode', () => {
    expect(local).toContain('Profile names')
    expect(local).toContain('Taxpayer type')
    expect(local).toContain('registration answers')
    expect(local).toContain('figures you type into the Estimator')
    expect(local).toContain('Which profile you last used')
    // The calendar and the checklist no longer track what was filed or done.
    expect(local).not.toContain('Deadlines you mark as filed')
    expect(local).not.toContain('Checklist items you tick')
    expect(local).toContain('Email address and password (accounts only)')
    expect(local).toContain('We do not ask for your TIN')
  })

  it('says why the data is used and that it is not sold or used for advertising', () => {
    expect(local).toContain('Why we use it')
    expect(local).toContain('build your deadline calendar, estimates and checklist')
    expect(local).toContain('We do not sell your data, show ads, or use tracking cookies or analytics.')
  })

  it('local mode: data stays in this browser only and nothing is sent to the operator', () => {
    expect(local).toContain('This site is running in local mode')
    expect(local).toContain('stays in this browser on this device')
    expect(local).toContain('Nothing you type is sent to us')
    expect(local).toContain("Anyone who uses this browser can see these profiles. Don't use this on a shared computer.")
  })

  it('accounts mode: data is stored with Supabase in the stated region', () => {
    expect(accounts).toContain('This site uses accounts')
    expect(accounts).toContain('Supabase')
    expect(accounts).toMatch(/Supabase[^.]*\[REGION\]/)
  })

  it('names every recipient: GitHub Pages hosting logs, Supabase in accounts mode (fonts are self-hosted: no Google)', () => {
    expect(local).toContain('GitHub Pages')
    expect(local).toContain('IP address')
    expect(local).not.toMatch(/Google/)
    expect(accounts).not.toMatch(/Google/)
    expect(local).toMatch(/Supabase \(accounts only\)/)
  })

  // M06: in accounts mode, figures not yet saved when the page is closed are
  // kept in this browser until the next sign-in.
  it('accounts: says unsaved figures are kept in this browser until the next sign-in', () => {
    expect(local).toContain('If you reload or close the page before figures you typed reach your account, they are kept in this browser until you next sign in here, then saved to your account.')
  })

  it('states how long data is kept', () => {
    expect(local).toContain('How long we keep it')
    expect(local).toContain('until you delete the profile, use "Erase all data on this device", or clear this site')
    expect(local).toContain('until you delete the profile or your account')
  })

  it('lists every data-subject right and how to exercise it', () => {
    for (const right of [
      'Be informed', 'Access', 'Correct', 'Erase or block', 'Data portability', 'Object',
      'File a complaint with the National Privacy Commission',
    ]) expect(local).toContain(right)
    expect(local).toContain('Download my data')
    expect(local).toContain('Erase all data on this device')
    expect(local).toContain('Delete my account')
    expect(local).toContain('privacy.gov.ph')
  })

  it('reminds bookkeepers that clients must be told when their data is entered', () => {
    expect(local).toContain('If you enter other people')
  })
})

function mockClient(result = { data: { user: { id: 'u1' }, session: null }, error: null }) {
  return { auth: { signUp: vi.fn().mockResolvedValue(result) } }
}

describe('H14 sign-up consent', () => {
  it('refuses to create an account without consent and never calls Supabase', async () => {
    const client = mockClient()
    const r = await signUp(client, { email: 'ana@example.com', password: 'longenough', consent: false })
    expect(r.ok).toBe(false)
    expect(r.message).toBe('Please tick the box to agree to the Privacy Notice before creating an account.')
    expect(client.auth.signUp).not.toHaveBeenCalled()
  })

  it('records the consent time and the notice version with the account', async () => {
    const client = mockClient()
    const now = new Date('2026-10-07T03:15:00Z')
    const r = await signUp(client, {
      email: 'ana@example.com', password: 'longenough', consent: true, now,
      redirectTo: 'https://example.ph/tax/',
    })
    expect(r.ok).toBe(true)
    // Audit Nov 2026 (S8): in step with the notice's "last updated" date.
    expect(PRIVACY_NOTICE_VERSION).toBe('2026-10-17')
    expect(PRIVACY_NOTICE_UPDATED).toBe('October 17, 2026')
    expect(client.auth.signUp).toHaveBeenCalledTimes(1)
    expect(client.auth.signUp).toHaveBeenCalledWith({
      email: 'ana@example.com',
      password: 'longenough',
      options: {
        emailRedirectTo: 'https://example.ph/tax/',
        data: { privacy_notice_version: '2026-10-17', privacy_consent_at: '2026-10-07T03:15:00.000Z' },
      },
    })
  })
})
