// SSS / PhilHealth / Pag-IBIG monthly contribution math.
// Parameters live in src/data/rules/contributions.json.

import contrib from '../../data/rules/contributions.json'

function roundCentavo(n) { return Math.round(n * 100) / 100 }

// SSS monthly salary credit: salary rounded to the nearest MSC step within floor/ceiling.
export function sssMsc(monthlySalary) {
  const { mscFloor, mscCeiling, mscStep } = contrib.sss.value
  if (monthlySalary <= 0) return 0
  const stepped = Math.round(monthlySalary / mscStep) * mscStep
  return Math.min(mscCeiling, Math.max(mscFloor, stepped))
}

export function sssEmployee(monthlySalary) {
  const { employeeRate, employerRate, ec, wispThreshold } = contrib.sss.value
  const msc = sssMsc(monthlySalary)
  const employee = roundCentavo(msc * employeeRate)
  const employer = roundCentavo(msc * employerRate)
  const ecAmount = (ec.find(t => t.mscBelow === null || msc < t.mscBelow) || ec[ec.length - 1]).amount
  const wispBase = Math.max(0, msc - wispThreshold)
  return {
    msc,
    employee,
    employer: employer + ecAmount,
    ec: ecAmount,
    wispPortionOfTotal: roundCentavo(wispBase * (employeeRate + employerRate)),
    total: roundCentavo(employee + employer + ecAmount),
  }
}

export function sssSelfEmployed(declaredMonthlyIncome) {
  const { selfEmployedRate, ec } = contrib.sss.value
  const msc = sssMsc(declaredMonthlyIncome)
  const amount = roundCentavo(msc * selfEmployedRate)
  const ecAmount = (ec.find(t => t.mscBelow === null || msc < t.mscBelow) || ec[ec.length - 1]).amount
  return { msc, amount: amount + ecAmount, ec: ecAmount }
}

export function philhealthMonthly(monthlyBasic) {
  const { rate, incomeFloor, incomeCeiling, employerShare, employeeShare } = contrib.philhealth.value
  const base = Math.min(incomeCeiling, Math.max(incomeFloor, monthlyBasic))
  const premium = roundCentavo(base * rate)
  return {
    base,
    premium,
    employee: roundCentavo(premium * employeeShare),
    employer: roundCentavo(premium * employerShare),
  }
}

export function pagibigMonthly(monthlyComp) {
  const { employeeRateLow, employeeRateLowThreshold, employeeRate, employerRate, maxFundSalary } = contrib.pagibig.value
  const base = Math.min(maxFundSalary, Math.max(0, monthlyComp))
  const eeRate = monthlyComp <= employeeRateLowThreshold ? employeeRateLow : employeeRate
  return {
    base,
    employee: roundCentavo(base * eeRate),
    employer: roundCentavo(base * employerRate),
  }
}

// Mandatory employee-share deductions for withholding-tax purposes.
export function employeeMandatoryDeductions(monthlySalary) {
  const sss = sssEmployee(monthlySalary)
  const ph = philhealthMonthly(monthlySalary)
  const pi = pagibigMonthly(monthlySalary)
  return {
    sss: sss.employee,
    philhealth: ph.employee,
    pagibig: pi.employee,
    total: roundCentavo(sss.employee + ph.employee + pi.employee),
  }
}

// Full employer-side cost for one employee.
export function employerContributions(monthlySalary) {
  const sss = sssEmployee(monthlySalary)
  const ph = philhealthMonthly(monthlySalary)
  const pi = pagibigMonthly(monthlySalary)
  return {
    sss: sss.employer, // includes EC
    philhealth: ph.employer,
    pagibig: pi.employer,
    total: roundCentavo(sss.employer + ph.employer + pi.employer),
  }
}

export function selfEmployedMonthlyContributions(declaredMonthlyIncome) {
  const sss = sssSelfEmployed(declaredMonthlyIncome)
  const ph = philhealthMonthly(declaredMonthlyIncome)
  const pi = pagibigMonthly(declaredMonthlyIncome)
  const phFull = ph.premium // direct contributors shoulder the full premium
  const piFull = pagibigSelfTotal(pi)
  return {
    sss: sss.amount,
    philhealth: phFull,
    pagibig: piFull,
    total: roundCentavo(sss.amount + phFull + piFull),
  }
}

function pagibigSelfTotal(pi) {
  // Self-employed members shoulder both shares on the same schedule.
  return roundCentavo(pi.employee + pi.employer)
}
