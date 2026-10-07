// C08: in "Edit profile", tapping the taxpayer-type card that is already
// selected used to rebuild the profile from defaults, silently resetting the
// regime, VAT, books, employer, 2307 and EWT answers (the audit's employer
// profile dropped from 110 to 47 dated obligations). Now the same type changes
// nothing, and a real type change keeps the answers both types share, plus the
// figures, filed marks and checklist ticks.
import { describe, it, expect } from 'vitest'
import { changeProfileType, sharedAnswers, defaultProfile } from '../../src/engine/profile.js'
import { generateDeadlines } from '../../src/engine/deadlines.js'
import { addDays } from '../../src/engine/dates.js'
import { OBLIGATIONS, HOLIDAY_SET } from '../../src/lib/deadlineData.js'
import { TYPE_CHANGE_CONFIRM } from '../../src/pages/ProfileWizard.jsx'

// The Dashboard's "Showing N dated obligations over the next 13 months".
const TODAY = new Date(2026, 9, 7)
const datedCount = p => generateDeadlines(OBLIGATIONS, p, { from: TODAY, to: addDays(TODAY, 400), holidays: HOLIDAY_SET, refDate: TODAY }).length

// The verifier's seeded profile (ux-verify/v10_edit.cjs): a self-employed
// employer on graduated rates with itemized deductions.
const employer = {
  ...defaultProfile('individual'),
  id: 'p-emp', name: 'Santos Design Studio',
  regime: 'graduated_itemized', booksType: 'looseleaf',
  hasEmployees: true, receives2307: true, withholdsEwt: true,
  inputs: { individual: { gross: 777000, expenses: 1000, cwt: 5000 } },
  filed: { '1601C-2026-09': '2026-10-06' },
  checklistDone: { 'bir-invoices': '2026-10-01' },
}

describe('C08 tapping the type that is already selected', () => {
  it('changes nothing: the employer profile keeps its 143 dated obligations (Oct 7, 2026)', () => {
    const after = changeProfileType(employer, 'individual')
    expect(after).toBe(employer)
    expect(datedCount(employer)).toBe(143)
    expect(datedCount(after)).toBe(143)
    // What the old reset produced: defaults with only id, name and inputs kept.
    const oldReset = { ...defaultProfile('individual'), id: employer.id, name: employer.name, inputs: employer.inputs }
    expect(datedCount(oldReset)).toBe(49)
  })

  it('works for every type', () => {
    for (const type of ['employee', 'individual', 'mixed', 'corporation']) {
      const p = { ...defaultProfile(type), id: 'x', name: 'X', hasEmployees: type !== 'employee' }
      expect(changeProfileType(p, type)).toBe(p)
    }
  })
})

describe('C08 changing the type keeps the answers both types share', () => {
  it('self-employed to mixed income: every registration answer is kept', () => {
    expect(changeProfileType(employer, 'mixed')).toEqual({ ...employer, type: 'mixed' })
    expect(datedCount(changeProfileType(employer, 'mixed'))).toBe(datedCount({ ...employer, type: 'mixed' }))
  })

  it('self-employed to corporation: shared answers kept, the rest set to the corporation defaults', () => {
    expect(changeProfileType(employer, 'corporation')).toEqual({
      id: 'p-emp', name: 'Santos Design Studio', type: 'corporation',
      vatRegistered: false,
      regime: 'corporate',
      hasEmployees: true, withholdsEwt: true, withholdsFwt: false, receives2307: true,
      booksType: 'looseleaf', usesCrmPos: false, sellsGoods: false, hasBusinessEstablishment: true,
      licensedProfessional: false, dtiRegistered: false, multipleEmployers: false,
      fiscalYearEndMonth: 12, registrationYear: null, secRegistered: true,
      inputs: { individual: { gross: 777000, expenses: 1000, cwt: 5000 } },
      filed: { '1601C-2026-09': '2026-10-06' },
      checklistDone: { 'bir-invoices': '2026-10-01' },
    })
  })

  it('corporation (VAT) to self-employed: VAT kept, regime becomes graduated + OSD (8% is closed to VAT-registered)', () => {
    const corp = { ...defaultProfile('corporation'), id: 'c1', name: 'Fox Corp', vatRegistered: true, fiscalYearEndMonth: 6, registrationYear: 2020, hasEmployees: true }
    const after = changeProfileType(corp, 'individual')
    expect(after.vatRegistered).toBe(true)
    expect(after.regime).toBe('graduated_osd')
    expect(after.hasEmployees).toBe(true)
    expect(after.withholdsEwt).toBe(true)
    expect(after.fiscalYearEndMonth).toBe(12)
    expect(after.registrationYear).toBe(null)
    expect(after.dtiRegistered).toBe(false)
  })

  it('employee to self-employed: only the PRC licence answer is shared', () => {
    const emp = { ...defaultProfile('employee'), id: 'e1', name: 'Dan', licensedProfessional: true, multipleEmployers: true, inputs: { employee: { monthly: 30000 } } }
    expect(changeProfileType(emp, 'individual')).toEqual({
      ...defaultProfile('individual'), id: 'e1', name: 'Dan', licensedProfessional: true, inputs: { employee: { monthly: 30000 } },
    })
  })

  it('the shared answers for each pair of types', () => {
    const biz = ['vatRegistered', 'receives2307', 'hasEmployees', 'withholdsEwt', 'withholdsFwt', 'booksType', 'hasBusinessEstablishment', 'usesCrmPos', 'sellsGoods']
    expect(sharedAnswers('individual', 'mixed')).toEqual(['vatRegistered', 'regime', 'receives2307', 'hasEmployees', 'withholdsEwt', 'withholdsFwt', 'booksType', 'hasBusinessEstablishment', 'dtiRegistered', 'licensedProfessional', 'usesCrmPos', 'sellsGoods'])
    expect(sharedAnswers('individual', 'corporation')).toEqual(biz)
    expect(sharedAnswers('corporation', 'mixed')).toEqual(biz)
    expect(sharedAnswers('employee', 'mixed')).toEqual(['licensedProfessional'])
    expect(sharedAnswers('employee', 'corporation')).toEqual([])
    expect(sharedAnswers(undefined, 'corporation')).toEqual([])
  })

  it('the input profile is not changed', () => {
    const copy = JSON.parse(JSON.stringify(employer))
    changeProfileType(employer, 'corporation')
    expect(employer).toEqual(copy)
  })
})

describe('C08 a saved profile asks before its type changes', () => {
  it('the question', () => {
    expect(TYPE_CHANGE_CONFIRM).toBe(
      'Changing the taxpayer type resets the registration answers. Answers both types share, saved figures and filed marks are kept. Continue?',
    )
  })
})
