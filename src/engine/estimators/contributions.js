// SSS / PhilHealth / Pag-IBIG monthly contribution math.
// Parameters live in src/data/rules/contributions.json. Each agency has its
// own contribution base (see employeeMandatoryDeductions below).
//
// Amounts are computed in whole centavos (src/lib/money.js) and each share is
// rounded half-up to the centavo. PhilHealth: the employee share is half the
// premium rounded half-up, and the employer pays the rest, so the two shares
// always add up to the premium (owner default, flagged needs_review).

import contrib from '../../data/rules/contributions.json'
import { toCentavos, fromCentavos, mulRate, divRoundHalfUp } from '../../lib/money.js'

const P = fromCentavos
const C = toCentavos

function ecFor(mscC, ec) {
  const t = ec.find(x => x.mscBelow === null || mscC < C(x.mscBelow)) || ec[ec.length - 1]
  return C(t.amount)
}

function sssMscC(salaryC) {
  const { mscFloor, mscCeiling, mscStep } = contrib.sss.value
  if (salaryC <= 0) return 0
  const stepC = C(mscStep)
  const stepped = divRoundHalfUp(salaryC, stepC) * stepC
  return Math.min(C(mscCeiling), Math.max(C(mscFloor), stepped))
}

// SSS monthly salary credit: salary rounded to the nearest MSC step within floor/ceiling.
export function sssMsc(monthlySalary) {
  return P(sssMscC(C(monthlySalary)))
}

export function sssEmployee(monthlySalary) {
  const { employeeRate, employerRate, ec, wispThreshold } = contrib.sss.value
  const mscC = sssMscC(C(monthlySalary))
  const employeeC = mulRate(mscC, employeeRate)
  const employerC = mulRate(mscC, employerRate)
  const ecC = ecFor(mscC, ec)
  const wispBaseC = Math.max(0, mscC - C(wispThreshold))
  return {
    msc: P(mscC),
    employee: P(employeeC),
    employer: P(employerC + ecC),
    ec: P(ecC),
    wispPortionOfTotal: P(mulRate(wispBaseC, employeeRate) + mulRate(wispBaseC, employerRate)),
    total: P(employeeC + employerC + ecC),
  }
}

export function sssSelfEmployed(declaredMonthlyIncome) {
  const { selfEmployedRate, ec } = contrib.sss.value
  const mscC = sssMscC(C(declaredMonthlyIncome))
  const amountC = mulRate(mscC, selfEmployedRate)
  const ecC = ecFor(mscC, ec)
  return { msc: P(mscC), amount: P(amountC + ecC), ec: P(ecC) }
}

function philhealthC(monthlyBasic) {
  const { rate, incomeFloor, incomeCeiling, employeeShare } = contrib.philhealth.value
  const baseC = Math.min(C(incomeCeiling), Math.max(C(incomeFloor), C(monthlyBasic)))
  const premiumC = mulRate(baseC, rate)
  const employeeC = mulRate(premiumC, employeeShare)
  return { baseC, premiumC, employeeC, employerC: premiumC - employeeC }
}

export function philhealthMonthly(monthlyBasic) {
  const p = philhealthC(monthlyBasic)
  return {
    base: P(p.baseC),
    premium: P(p.premiumC),
    employee: P(p.employeeC),
    employer: P(p.employerC),
  }
}

function pagibigC(monthlyComp) {
  const { employeeRateLow, employeeRateLowThreshold, employeeRate, employerRate, maxFundSalary } = contrib.pagibig.value
  const compC = C(monthlyComp)
  const baseC = Math.min(C(maxFundSalary), Math.max(0, compC))
  const eeRate = compC <= C(employeeRateLowThreshold) ? employeeRateLow : employeeRate
  return { baseC, employeeC: mulRate(baseC, eeRate), employerC: mulRate(baseC, employerRate) }
}

export function pagibigMonthly(monthlyComp) {
  const p = pagibigC(monthlyComp)
  return { base: P(p.baseC), employee: P(p.employeeC), employer: P(p.employerC) }
}

// C05: each agency has its own base (contributions.json):
//   SSS         basic pay + regular allowances, commissions and other regular pay
//               (RA 11199 Sec 8(f)); the MSC caps it at ₱35,000
//   PhilHealth  basic salary (the first argument)
//   Pag-IBIG    monthly compensation (basic + regular pay; needs_review), fund salary capped at ₱10,000
// Without the second argument every agency uses the one figure (e.g. the
// Tools calculator's "start from gross").
function bases(monthlyBasic, { sssCompensation, pagibigCompensation } = {}) {
  return {
    sss: sssCompensation ?? monthlyBasic,
    philhealth: monthlyBasic,
    pagibig: pagibigCompensation ?? monthlyBasic,
  }
}

// Mandatory employee-share deductions for withholding-tax purposes.
export function employeeMandatoryDeductions(monthlyBasic, other = {}) {
  const b = bases(monthlyBasic, other)
  const s = sssEmployee(b.sss)
  const sss = C(s.employee)
  const ph = philhealthC(b.philhealth).employeeC
  const pi = pagibigC(b.pagibig).employeeC
  return {
    sss: P(sss),
    sssMsc: s.msc,
    philhealth: P(ph),
    pagibig: P(pi),
    total: P(sss + ph + pi),
  }
}

// Full employer-side cost for one employee.
export function employerContributions(monthlyBasic, other = {}) {
  const b = bases(monthlyBasic, other)
  const sss = C(sssEmployee(b.sss).employer) // includes EC
  const ph = philhealthC(b.philhealth).employerC
  const pi = pagibigC(b.pagibig).employerC
  return {
    sss: P(sss),
    philhealth: P(ph),
    pagibig: P(pi),
    total: P(sss + ph + pi),
  }
}

export function selfEmployedMonthlyContributions(declaredMonthlyIncome) {
  const sss = C(sssSelfEmployed(declaredMonthlyIncome).amount)
  const ph = philhealthC(declaredMonthlyIncome).premiumC // direct contributors shoulder the full premium
  const pi = pagibigSelfTotalC(declaredMonthlyIncome)
  return {
    sss: P(sss),
    philhealth: P(ph),
    pagibig: P(pi),
    total: P(sss + ph + pi),
  }
}

function pagibigSelfTotalC(declaredMonthlyIncome) {
  // Self-employed members shoulder both shares on the same schedule.
  const p = pagibigC(declaredMonthlyIncome)
  return p.employeeC + p.employerC
}
