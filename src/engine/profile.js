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

export const PROFILE_TYPES = {
  employee: { name: 'Employee', desc: 'Pure compensation income from an employer' },
  individual: { name: 'Self-employed / Sole prop', desc: 'Freelancer, professional, or sole proprietorship' },
  mixed: { name: 'Mixed income', desc: 'Employed and running a business or practice on the side' },
  corporation: { name: 'Corporation', desc: 'Domestic corporation or taxable partnership' },
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
