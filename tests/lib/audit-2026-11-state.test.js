// November 2026 audit (AUDIT-2026-11.md), UI/state findings S1-S11.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { pageTitle } from '../../src/lib/pageTitle.js'
import { createInputSaver, figuresToShow } from '../../src/lib/inputSaver.js'
import { createBackend, usableProfiles, LS_KEY } from '../../src/lib/backend.js'
import { carryBusinessFigures, withWizardChanges, defaultProfile } from '../../src/engine/profile.js'
import ErrorBoundary, { storedDataSnapshot } from '../../src/components/ErrorBoundary.jsx'
import { memoryStorage } from './backend-fakes.js'

describe('S1 a malformed blog address no longer crashes the page title', () => {
  it('50%off, a lone % and a cut-off escape fall back to "Article not found"', () => {
    for (const path of ['/blog/50%off', '/blog/%', '/blog/%E0%A4%A']) {
      expect(() => pageTitle(path)).not.toThrow()
      expect(pageTitle(path)).toBe('Article not found · Blog · JEZ Tax Suite')
    }
  })
  it('the error screen offers a way back and a copy of the stored data', () => {
    function Boom() { throw new Error('boom') }
    // Server rendering does not run error boundaries, so check the fallback
    // directly: getDerivedStateFromError switches to it.
    expect(ErrorBoundary.getDerivedStateFromError(new Error('x'))).toEqual({ failed: true })
    const b = new ErrorBoundary({ children: React.createElement(Boom) })
    b.state = { failed: true }
    const html = renderToStaticMarkup(b.render())
    expect(html).toContain('This page could not be shown')
    expect(html).toContain('href="#/"')
    expect(html).toContain('Download a copy of my data')
  })
  it('the data copy reads every "pv." key straight from storage', () => {
    const storage = memoryStorage({ 'pv.profiles.v1': '[{"id":"a"}]', 'pv.activeProfile.v1': 'a', other: 'x' })
    expect(storedDataSnapshot(storage)).toEqual({ 'pv.profiles.v1': [{ id: 'a' }], 'pv.activeProfile.v1': 'a' })
  })
})

describe('S11 malformed stored profiles are not shown (and no longer blank every page)', () => {
  it('keeps only objects with an id and a known type', () => {
    expect(usableProfiles({})).toEqual([])
    expect(usableProfiles(null)).toEqual([])
    expect(usableProfiles([null, 1, 'x', { id: 'a' }, { id: '', type: 'employee' }, { id: 'b', type: 'robot' }, { id: 'c', type: 'employee' }]))
      .toEqual([{ id: 'c', type: 'employee' }])
  })
  it('local mode: an object instead of a list in storage gives an empty list, and saving still works', async () => {
    const storage = memoryStorage({ [LS_KEY]: '{}' })
    const be = createBackend({ storage })
    expect(await be.listProfiles()).toEqual([])
    const saved = await be.saveProfile(null, { ...defaultProfile('employee'), name: 'E' })
    expect(await be.listProfiles()).toEqual([saved])
  })
})

describe('S2 a failed save keeps the typed figures on screen and retries them', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })
  it('busy() stays true after a failed save, and the failed fields go out with the next save', async () => {
    const calls = []
    let fail = true
    const errors = []
    const s = createInputSaver({
      save: values => { calls.push(values); if (fail) throw new Error('quota') },
      onError: e => errors.push(e.message),
      win: null, doc: null,
    })
    s.schedule({ gross: 1500000 })
    vi.advanceTimersByTime(1000)
    expect(errors).toEqual(["Couldn't save your figures."])
    expect(s.busy()).toBe(true)
    expect(s.unsaved()).toEqual({ gross: 1500000 })
    // The estimator keeps what was typed while busy.
    const shown = { gross: 1500000 }
    expect(figuresToShow(shown, { gross: 300000 }, s.busy())).toBe(shown)
    fail = false
    s.schedule({ expenses: 100000 })
    vi.advanceTimersByTime(1000)
    await Promise.resolve()
    expect(calls[calls.length - 1]).toEqual({ gross: 1500000, expenses: 100000 })
    expect(s.busy()).toBe(false)
    expect(s.unsaved()).toBe(null)
  })
})

describe('S4 switching between self-employed and mixed income carries the business figures', () => {
  const figures = { gross: 900000, expenses: 100000, cwt: 9000, crossedMonth: '' }
  it('copies the shared figures when the new type has none', () => {
    const inputs = { mixed: { ...figures, compensationTaxable: 400000 } }
    expect(carryBusinessFigures(inputs, 'mixed', 'individual')).toEqual({
      mixed: inputs.mixed,
      individual: { gross: 900000, expenses: 100000, cwt: 9000 },
    })
  })
  it('leaves figures alone when the new type already has some, or for other types', () => {
    const inputs = { mixed: figures, individual: { gross: 1 } }
    expect(carryBusinessFigures(inputs, 'mixed', 'individual')).toBe(inputs)
    expect(carryBusinessFigures({ individual: figures }, 'individual', 'corporation')).toEqual({ individual: figures })
  })
  it('the wizard save applies it on a type change', () => {
    const base = { ...defaultProfile('mixed'), id: 'm', name: 'M', inputs: { mixed: figures } }
    const edited = { ...base, type: 'individual' }
    const next = withWizardChanges(base, base, edited)
    expect(next.type).toBe('individual')
    expect(next.inputs.individual).toEqual({ gross: 900000, expenses: 100000, cwt: 9000 })
  })
})

describe('S7 the data export never names a deleted profile as active', () => {
  it('drops an active id that is not in the stored list', async () => {
    const storage = memoryStorage({ [LS_KEY]: JSON.stringify([{ id: 'a', type: 'employee', name: 'Ana' }]), 'pv.activeProfile.v1': 'b' })
    const out = await createBackend({ storage }).exportData()
    expect(out.activeProfileId).toBe(null)
  })
})
