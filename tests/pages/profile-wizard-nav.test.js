// M24: profile wizard navigation. Cancel used to be the browser's Back button,
// so a wizard opened directly (bookmark, new tab, shared link) left the app;
// an edit link for a profile that no longer exists opened a blank "new
// profile" form (and saving it created a profile); after saving, Back
// reopened an empty wizard.
import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

let appState = {}
vi.mock('../../src/state/AppState.jsx', () => ({ useApp: () => appState }))
const { default: ProfileWizard, cancelWizard, leaveAfterSave } = await import('../../src/pages/ProfileWizard.jsx')
const { defaultProfile } = await import('../../src/engine/profile.js')

const ana = { ...defaultProfile('individual'), id: 'ana', name: 'Ana Freelancer' }
const h = React.createElement
const strip = s => s.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim()

function render(path, app) {
  appState = { hasCloud: false, profiles: [ana], profilesReady: true, loadError: null, ...app }
  return renderToStaticMarkup(h(MemoryRouter, { initialEntries: [path] },
    h(Routes, null,
      h(Route, { path: '/profiles/new', element: h(ProfileWizard) }),
      h(Route, { path: '/profiles/:profileId/edit', element: h(ProfileWizard) }))))
}

describe('M24 an edit link for a profile that does not exist', () => {
  it('shows "Profile not found" with a link to the profile list, not a blank new-profile form', () => {
    const html = render('/profiles/bogus/edit')
    const text = strip(html)
    expect(text).toContain('Profile not found')
    expect(text).toContain('There is no profile at this link. It may have been deleted, or the link is incomplete.')
    expect(html).toContain('href="/profiles"')
    expect(text).toContain('Go to your profiles')
    expect(text).not.toContain('Set up a taxpayer profile')
    expect(html).not.toContain('id="pf-name"')
    expect(text).not.toContain('Create profile')
  })

  it('a profile that exists opens for editing', () => {
    const html = render('/profiles/ana/edit')
    expect(strip(html)).toContain('Edit profile')
    expect(html).toContain('value="Ana Freelancer"')
  })

  it('a new profile still opens the blank form', () => {
    expect(strip(render('/profiles/new'))).toContain('Set up a taxpayer profile')
  })

  it('while profiles are still loading nothing is shown yet', () => {
    expect(render('/profiles/bogus/edit', { profilesReady: false })).toBe('')
  })

  it('when the profiles could not be loaded it says so instead of "not found"', () => {
    const text = strip(render('/profiles/ana/edit', { profiles: [], loadError: new Error('offline') }))
    expect(text).toContain('Couldn’t load your saved profiles, so this one can’t be opened. This is a loading problem, not lost data.')
    expect(text).not.toContain('Profile not found')
  })
})

describe('M24 Cancel and the page after saving', () => {
  it('Cancel goes to the profile list when the wizard was opened directly (no in-app history)', () => {
    const nav = vi.fn()
    cancelWizard(nav, { key: 'default', pathname: '/profiles/new' })
    expect(nav.mock.calls).toEqual([['/profiles']])
  })

  it('Cancel goes back when the wizard was opened from inside the app', () => {
    const nav = vi.fn()
    cancelWizard(nav, { key: 'k3j9x2', pathname: '/profiles/new' })
    expect(nav.mock.calls).toEqual([[-1]])
  })

  it('after saving, the wizard is replaced in history, so Back does not reopen it', () => {
    const nav = vi.fn()
    leaveAfterSave(nav)
    expect(nav.mock.calls).toEqual([['/', { replace: true }]])
  })
})
