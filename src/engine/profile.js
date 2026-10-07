// Taxpayer profile model.
//
// A profile describes one taxpayer (a person or an entity). An account can
// hold many profiles — e.g. a bookkeeper managing several clients.
//
// type:
//   'employee'   — pure compensation earner
//   'individual' — self-employed / professional / sole proprietor (business income only)
//   'mixed'      — compensation + business/professional income
//   'corporation'— domestic corporation (or taxable partnership)
//
// "Employer / withholding agent" is not a separate type: it is the
// hasEmployees / withholdsEwt facets of an individual, mixed, or corporate
// profile, which switch on the full employer obligation set.

import { RT } from './ruleText.js'

export const PROFILE_TYPES = {
  employee: { name: 'Employee', desc: 'Pure compensation income from an employer' },
  individual: { name: 'Self-employed / Sole prop', desc: 'Freelancer, professional, or sole proprietorship' },
  mixed: { name: 'Mixed income', desc: 'Employed and running a business or practice on the side' },
  corporation: { name: 'Corporation', desc: 'Domestic corporation or taxable partnership' },
}

// The income-tax regime in a few words (profile cards and summaries). L21:
// one copy instead of one per page.
export function regimeLabel(regime) {
  if (regime === '8pct') return `${RT.eightRate} flat tax`
  if (regime === 'graduated_osd') return 'Graduated + OSD'
  return 'Graduated + itemized'
}

export function defaultProfile(type = 'individual') {
  const base = {
    id: null,
    name: '',
    type,
    // business-track fields (individual / mixed / corporation)
    vatRegistered: false,
    regime: '8pct', // '8pct' | 'graduated_osd' | 'graduated_itemized' (individual & mixed only)
    hasEmployees: false,
    withholdsEwt: false,
    withholdsFwt: false,
    receives2307: false,            // clients withhold on payments → SAWT with every return claiming the credits
    booksType: 'manual', // 'manual' | 'looseleaf' | 'cas'
    usesCrmPos: false,
    sellsGoods: false,              // maintains inventory → annual inventory list
    hasBusinessEstablishment: true, // LGU permit track (physical/registered place of business)
    licensedProfessional: false,    // PTR track (PRC-licensed professionals)
    dtiRegistered: false,           // sole-prop business name
    // employee-track fields
    multipleEmployers: false,
    // corporation-track fields
    fiscalYearEndMonth: 12,         // 12 = calendar year
    registrationYear: null,         // for the MCIT 4th-year rule
    secRegistered: true,
    // estimator memory (kept per profile so returning users see their numbers)
    inputs: {},
  }
  if (type === 'employee') {
    base.hasBusinessEstablishment = false
    base.secRegistered = false
    base.dtiRegistered = false
  }
  if (type === 'corporation') {
    base.regime = 'corporate'
    base.withholdsEwt = true
    base.dtiRegistered = false
  }
  return base
}

// C08: the registration answers the profile wizard asks for each type.
const BUSINESS_QUESTIONS = [
  'vatRegistered', 'regime', 'receives2307', 'hasEmployees', 'withholdsEwt', 'withholdsFwt',
  'booksType', 'hasBusinessEstablishment', 'dtiRegistered', 'licensedProfessional', 'usesCrmPos', 'sellsGoods',
]
export const TYPE_QUESTIONS = {
  employee: ['multipleEmployers', 'licensedProfessional'],
  individual: BUSINESS_QUESTIONS,
  mixed: BUSINESS_QUESTIONS,
  corporation: [
    'vatRegistered', 'fiscalYearEndMonth', 'registrationYear', 'receives2307', 'hasEmployees', 'withholdsEwt',
    'withholdsFwt', 'booksType', 'hasBusinessEstablishment', 'usesCrmPos', 'sellsGoods',
  ],
}

// C08: the answers asked for both types, in the order the wizard asks them
// for the new type.
export function sharedAnswers(fromType, toType) {
  const from = TYPE_QUESTIONS[fromType] || []
  return (TYPE_QUESTIONS[toType] || []).filter(k => from.includes(k))
}

// C08: the profile after the user picks a taxpayer type in the wizard.
// The type it already has: the same profile, unchanged (re-tapping the
// selected card used to reset every answer). Another type: that type's
// defaults, keeping the identity (id, name), the estimator figures, filed
// marks, checklist ticks and anything else saved, and the answers both types
// share. A VAT-registered individual cannot use the 8% option, so the regime
// moves to graduated + OSD as the VAT switch does.
export function changeProfileType(profile, type) {
  if (!PROFILE_TYPES[type] || profile.type === type) return profile
  const next = { ...profile }
  for (const [k, v] of Object.entries(defaultProfile(type))) {
    if (k !== 'id' && k !== 'name' && k !== 'inputs') next[k] = v
  }
  for (const k of sharedAnswers(profile.type, type)) {
    if (k in profile) next[k] = profile[k]
  }
  next.type = type
  next.inputs = profile.inputs || {}
  if ((type === 'individual' || type === 'mixed') && next.vatRegistered && next.regime === '8pct') {
    next.regime = 'graduated_osd'
  }
  return next
}

// M06: the profile wizard's edits applied to the newest stored profile.
// `base` is the profile the form was opened with and `edited` the form now.
// Only the answers the form changed are written; everything else comes from
// `latest`, so figures (inputs), filed marks and checklist ticks saved after
// the form opened, and answers changed in another window that the form did
// not touch, are kept.
const NOT_WIZARD_FIELDS = new Set(['id', 'inputs', 'filed', 'checklistDone'])

function sameValue(a, b) {
  return a === b || JSON.stringify(a) === JSON.stringify(b)
}

export function withWizardChanges(latest, base, edited) {
  const next = { ...latest }
  for (const k of Object.keys(edited)) {
    if (NOT_WIZARD_FIELDS.has(k)) continue
    if (!sameValue(edited[k], base[k])) next[k] = edited[k]
  }
  return next
}

// C07: a copy of the profile with the estimator figures of one tab (key:
// 'individual', 'mixed', 'employee', 'corporation' or 'payroll') replaced and
// every other part kept. Applied to the newest stored profile when saving, so
// a tab never writes back its old copy of the rest of the profile.
export function withInputs(profile, key, values) {
  return { ...profile, inputs: { ...(profile.inputs || {}), [key]: values } }
}

// Flags consumed by obligation `appliesTo` predicates.
export function profileFlags(p) {
  const f = new Set()
  f.add('type:' + p.type)
  const isBusiness = p.type === 'individual' || p.type === 'mixed' || p.type === 'corporation'
  if (isBusiness) f.add('business')
  if (p.type === 'individual' || p.type === 'mixed') f.add('individual-business')

  if (isBusiness) {
    if (p.vatRegistered) f.add('vat')
    else f.add('nonvat')
  }
  if (p.type === 'individual' || p.type === 'mixed') {
    const regime = p.vatRegistered && p.regime === '8pct' ? 'graduated_osd' : p.regime
    if (regime === '8pct') f.add('regime:8pct')
    else {
      f.add('regime:graduated')
      if (regime === 'graduated_itemized') f.add('itemized')
    }
  }
  if (p.type === 'corporation') {
    f.add('regime:corporate')
    f.add((p.fiscalYearEndMonth || 12) === 12 ? 'fy:calendar' : 'fy:fiscal')
  }

  if (p.hasEmployees) f.add('employer')
  if (p.withholdsEwt) f.add('ewt')
  if (p.withholdsFwt) f.add('fwt')
  // Employees are withheld via 2316, not 2307 — the SAWT track is business-only.
  if (isBusiness && p.receives2307) f.add('receives-2307')
  if (p.booksType === 'looseleaf') f.add('books:looseleaf')
  if (p.booksType === 'cas') f.add('books:cas')
  if (p.usesCrmPos) f.add('crm-pos')
  if (isBusiness && p.sellsGoods) f.add('inventory')
  if (isBusiness && p.hasBusinessEstablishment) f.add('lgu')
  if (p.licensedProfessional && p.type !== 'corporation') f.add('ptr')
  if (p.dtiRegistered) f.add('dti')
  if (p.type === 'corporation' && p.secRegistered) f.add('sec')
  if (p.type === 'individual' || p.type === 'mixed') f.add('self-contributions')
  if (p.type === 'employee') {
    if (p.multipleEmployers) f.add('files-1700')
    else f.add('substituted-filing')
  }
  return f
}

// True when an obligation's appliesTo matches this profile's flags.
// appliesTo: { anyOf?: [flag...], allOf?: [flag...], noneOf?: [flag...] }
export function obligationApplies(appliesTo, flags) {
  if (!appliesTo) return true
  if (appliesTo.anyOf && !appliesTo.anyOf.some(x => flags.has(x))) return false
  if (appliesTo.allOf && !appliesTo.allOf.every(x => flags.has(x))) return false
  if (appliesTo.noneOf && appliesTo.noneOf.some(x => flags.has(x))) return false
  return true
}
