// M06: the profile wizard was seeded once from the in-memory profile and then
// saved whole, so estimator figures saved after it opened were wiped (audit
// bugs-verify/v3.cjs: typed 345678 in "Itemized expenses", opened Edit profile,
// renamed, saved: the profile then held the new name with inputs {}).
// "Save changes" now writes only what the form changed onto the latest stored
// profile.
import { describe, it, expect } from 'vitest'
import { withWizardChanges, changeProfileType, defaultProfile } from '../../src/engine/profile.js'
import { createBackend, LS_KEY } from '../../src/lib/backend.js'
import { memoryStorage } from '../lib/backend-fakes.js'

const ana = { ...defaultProfile('individual'), id: 'ana', name: 'Ana Freelancer', inputs: {} }

describe('M06 "Save changes" merges into the latest stored profile', () => {
  it('audit case: figures saved after the form opened are kept when the profile is renamed', async () => {
    const storage = memoryStorage({ [LS_KEY]: JSON.stringify([ana]) })
    const be = createBackend({ storage })
    const base = { ...ana } // what the form was seeded with
    // The estimator's pending figures reach storage after the form opened.
    await be.updateProfile(null, 'ana', p => ({ ...p, inputs: { individual: { gross: 480000, expenses: 345678 } } }))
    const edited = { ...base, name: 'Ana Santos' }
    await be.updateProfile(null, 'ana', latest => withWizardChanges(latest, base, edited))
    const after = JSON.parse(storage.getItem(LS_KEY))[0]
    expect(after.name).toBe('Ana Santos')
    expect(after.inputs).toEqual({ individual: { gross: 480000, expenses: 345678 } })
  })

  it('filed marks and checklist ticks saved meanwhile are kept', () => {
    const base = { ...ana, filed: { a: '2026-10-01' } }
    const latest = { ...base, filed: { a: '2026-10-01', b: '2026-10-07' }, checklistDone: { 'bir-invoices': '2026-10-07' } }
    const edited = { ...base, hasEmployees: true, filed: {} }
    expect(withWizardChanges(latest, base, edited)).toEqual({ ...latest, hasEmployees: true })
  })

  it('answers changed in another window and not touched in the form are kept; answers changed in the form win', () => {
    const base = { ...ana }
    const latest = { ...ana, name: 'Ana RENAMED IN A', receives2307: true, regime: 'graduated_osd' }
    const edited = { ...base, regime: 'graduated_itemized', booksType: 'looseleaf' }
    expect(withWizardChanges(latest, base, edited)).toEqual({
      ...ana, name: 'Ana RENAMED IN A', receives2307: true, regime: 'graduated_itemized', booksType: 'looseleaf',
    })
  })

  it('a type change writes every answer the form changed, and keeps the latest figures', () => {
    const base = { ...ana, hasEmployees: true }
    const latest = { ...base, inputs: { individual: { gross: 900000 } } }
    const edited = changeProfileType(base, 'corporation')
    const out = withWizardChanges(latest, base, edited)
    expect(out).toEqual({ ...edited, inputs: { individual: { gross: 900000 } } })
    expect(out.type).toBe('corporation')
    expect(out.regime).toBe('corporate')
    expect(out.hasEmployees).toBe(true)
  })

  it('nothing changed in the form: the latest profile is saved as it is', () => {
    const latest = { ...ana, name: 'Newer name', inputs: { individual: { gross: 1 } } }
    expect(withWizardChanges(latest, { ...ana }, { ...ana })).toEqual(latest)
  })

  it('the id always stays the stored one', () => {
    expect(withWizardChanges({ ...ana }, { ...ana }, { ...ana, id: 'other' }).id).toBe('ana')
  })
})
