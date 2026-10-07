// H14 (owner decision 18): a Privacy Notice under the Data Privacy Act of 2012
// (RA 10173), linked from the footer, sign-up and profile setup, and a
// required consent checkbox at sign-up. The notice is rendered to plain HTML
// here and checked for every element REVIEW.md asks for; the sign-up helper is
// checked with a mocked Supabase client.
import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import Privacy, { PRIVACY_PLACEHOLDERS, PRIVACY_NOTICE_UPDATED } from '../../src/pages/Privacy.jsx'
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
    expect(PRIVACY_NOTICE_UPDATED).toBe('October 7, 2026')
    expect(local).toContain('Last updated October 7, 2026')
  })

  it('shows the owner placeholders, clearly marked, for contact, DPO and server region', () => {
    expect(PRIVACY_PLACEHOLDERS).toEqual({
      contactEmail: '[CONTACT EMAIL]',
      dpoName: '[DPO NAME]',
      region: '[REGION]',
    })
    for (const text of [local, accounts]) {
      expect(text).toContain('[CONTACT EMAIL]')
      expect(text).toContain('[DPO NAME]')
      expect(text).toContain('[REGION]')
    }
    const html = renderToStaticMarkup(React.createElement(StaticRouter, { location: '/privacy' }, React.createElement(Privacy, { mode: 'local' })))
    // Every placeholder is wrapped in a highlighted marker the owner can spot.
    expect(html.match(/<mark[^>]*data-placeholder="true"[^>]*>\[CONTACT EMAIL\]<\/mark>/g).length).toBeGreaterThan(0)
    expect(html).toMatch(/<mark[^>]*data-placeholder="true"[^>]*>\[DPO NAME\]<\/mark>/)
    expect(html).toMatch(/<mark[^>]*data-placeholder="true"[^>]*>\[REGION\]<\/mark>/)
  })

  it('lists what is collected: profile names, taxpayer type, registration answers, estimator figures; email and password only in accounts mode', () => {
    expect(local).toContain('Profile names')
    expect(local).toContain('Taxpayer type')
    expect(local).toContain('registration answers')
    expect(local).toContain('figures you type into the Estimator')
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

  it('names every recipient: GitHub Pages hosting logs, Google Fonts, Supabase in accounts mode', () => {
    expect(local).toContain('GitHub Pages')
    expect(local).toContain('IP address')
    expect(local).toContain('Google Fonts')
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
    expect(PRIVACY_NOTICE_VERSION).toBe('2026-10-07')
    expect(client.auth.signUp).toHaveBeenCalledTimes(1)
    expect(client.auth.signUp).toHaveBeenCalledWith({
      email: 'ana@example.com',
      password: 'longenough',
      options: {
        emailRedirectTo: 'https://example.ph/tax/',
        data: { privacy_notice_version: '2026-10-07', privacy_consent_at: '2026-10-07T03:15:00.000Z' },
      },
    })
  })
})
