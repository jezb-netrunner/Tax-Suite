// M20: the profile wizard says which step you are on, explains that the name
// is required, groups its option cards under a legend, and links each
// switch to its description. (Focus moving to the new step's heading is
// checked in the browser: the heading is focusable with tabindex -1.)
import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

vi.mock('../../src/state/AppState.jsx', () => ({
  useApp: () => ({
    authReady: true, hasCloud: false, signedIn: true, profilesReady: true,
    profiles: [], active: null, loadError: null, save: async p => p,
  }),
}))
const { default: ProfileWizard } = await import('../../src/pages/ProfileWizard.jsx')
const { Switch } = await import('../../src/components/ui.jsx')

const h = React.createElement
const wizard = () => renderToStaticMarkup(
  h(MemoryRouter, { initialEntries: ['/profiles/new'] },
    h(Routes, null, h(Route, { path: '/profiles/new', element: h(ProfileWizard) }))),
)
const attr = (html, tag, name) => {
  const m = html.match(new RegExp(`<${tag}[^>]*\\s${name}="([^"]*)"`))
  return m ? m[1] : null
}

describe('M20 profile wizard accessibility', () => {
  it('shows "Step 1 of 4" in the focusable step heading', () => {
    const out = wizard()
    expect(out).toMatch(/<h2 class="sec-h wiz-head" tabindex="-1"><span class="wiz-count">Step 1 of 4<\/span> Who is this profile for\?<\/h2>/)
  })

  it('says under the name box that a name is required, and links it to the box', () => {
    const out = wizard()
    const input = out.match(/<input id="pf-name"[^>]*>/)[0]
    expect(input).toContain('aria-required="true"')
    const describedBy = attr(input, 'input', 'aria-describedby').split(' ')
    expect(describedBy).toContain('pf-name-req')
    expect(out).toContain('<p id="pf-name-req" class="field-note">Required. Type a name for this profile to continue.</p>')
  })

  it('puts the taxpayer-type cards in a fieldset with a legend', () => {
    const out = wizard()
    expect(out).toMatch(/<fieldset class="opt-fieldset"[^>]*><legend class="lbl">Taxpayer type<\/legend><div class="opt-grid">(<button [^>]*aria-pressed="(true|false)"[^>]*>.*?<\/button>){4}<\/div><\/fieldset>/)
  })

  it('explains why Continue is not available yet', () => {
    expect(wizard()).toContain('Type a profile name above to continue.')
  })
})

describe('M20 switches are linked to their description', () => {
  it('the switch is named by its title and described by its text', () => {
    const out = renderToStaticMarkup(h(Switch, { on: false, onChange: () => {}, title: 'Has employees', desc: 'Switches on the employer set.' }))
    const labelledBy = attr(out, 'button', 'aria-labelledby')
    const describedBy = attr(out, 'button', 'aria-describedby')
    expect(labelledBy).toBeTruthy()
    expect(describedBy).toBeTruthy()
    expect(out).toContain(`<div class="tt" id="${labelledBy}">Has employees</div>`)
    expect(out).toContain(`<div class="dd" id="${describedBy}">Switches on the employer set.</div>`)
    expect(out).toContain('role="switch"')
    expect(out).toContain('aria-checked="false"')
  })
})
