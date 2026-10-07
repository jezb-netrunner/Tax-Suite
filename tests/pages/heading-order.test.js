// L16: every page has exactly one h1 (the welcome page too), the h1 comes
// first, and heading levels never skip (h1 -> h3).
import { describe, it, expect, vi, afterAll } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { defaultProfile } from '../../src/engine/profile.js'

vi.useFakeTimers({ toFake: ['Date'] })
vi.setSystemTime(new Date('2026-10-07T04:00:00Z'))
afterAll(() => vi.useRealTimers())

const maria = {
  ...defaultProfile('individual'), id: 'p-maria', name: 'Maria Santos', hasEmployees: true, receives2307: true,
  inputs: { individual: { gross: 480000, expenses: 180000 } },
}
const juan = { ...defaultProfile('employee'), id: 'p-juan', name: 'Juan Dela Cruz', inputs: { employee: { monthlyBasic: 25000 } } }
const fox = {
  ...defaultProfile('corporation'), id: 'p-fox', name: 'Fox Trading Corporation', hasEmployees: true,
  registrationYear: 2020, inputs: { corporation: { grossSales: 12000000, costOfSales: 6000000, opex: 2000000 } },
}
const state = { profiles: [maria] }
vi.mock('../../src/state/AppState.jsx', () => ({
  useApp: () => ({
    authReady: true, hasCloud: false, signedIn: true, profilesReady: true, loadError: null,
    profiles: state.profiles, active: state.profiles[0] || null, save: async p => p,
  }),
}))

const pages = {
  Dashboard: (await import('../../src/pages/Dashboard.jsx')).default,
  Estimator: (await import('../../src/pages/Estimator.jsx')).default,
  Checklist: (await import('../../src/pages/Checklist.jsx')).default,
  Forms: (await import('../../src/pages/Forms.jsx')).default,
  Tools: (await import('../../src/pages/Tools.jsx')).default,
  Blog: (await import('../../src/pages/Blog.jsx')).default,
  References: (await import('../../src/pages/References.jsx')).default,
  Privacy: (await import('../../src/pages/Privacy.jsx')).default,
  Profiles: (await import('../../src/pages/Profiles.jsx')).default,
  ProfileWizard: (await import('../../src/pages/ProfileWizard.jsx')).default,
}

const h = React.createElement
function headings(page, path, route = path) {
  const html = renderToStaticMarkup(h(MemoryRouter, { initialEntries: [path] },
    h(Routes, null, h(Route, { path: route, element: h(pages[page]) }))))
  return [...html.matchAll(/<h([1-6])[\s>]/g)].map(m => Number(m[1]))
}

function expectGoodOutline(levels) {
  expect(levels.filter(l => l === 1).length).toBe(1)
  expect(levels[0]).toBe(1)
  for (let i = 1; i < levels.length; i++) expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1)
}

describe('L16 heading outline', () => {
  it('welcome page (no profile yet) has a main heading', () => {
    state.profiles = []
    expectGoodOutline(headings('Dashboard', '/'))
  })

  it.each([
    ['calendar, self-employed', 'Dashboard', '/', [maria]],
    ['calendar, employee', 'Dashboard', '/', [juan]],
    ['calendar, corporation', 'Dashboard', '/', [fox]],
    ['estimator, self-employed', 'Estimator', '/estimator', [maria]],
    ['estimator, employee', 'Estimator', '/estimator', [juan]],
    ['estimator, corporation', 'Estimator', '/estimator', [fox]],
    ['checklist', 'Checklist', '/checklist', [maria]],
    ['forms', 'Forms', '/forms', [maria]],
    ['tools', 'Tools', '/tools', [maria]],
    ['blog', 'Blog', '/blog', [maria]],
    ['references', 'References', '/references', [maria]],
    ['privacy', 'Privacy', '/privacy', [maria]],
    ['profiles', 'Profiles', '/profiles', [maria]],
    ['profile wizard', 'ProfileWizard', '/profiles/new', [maria]],
  ])('%s', (_, page, path, profiles) => {
    state.profiles = profiles
    expectGoodOutline(headings(page, path))
  })

  it('blog article', () => {
    state.profiles = [maria]
    expectGoodOutline(headings('Blog', '/blog/2307', '/blog/:postId'))
  })
})
