// Calendar filter (owner, Oct 17, 2026): show only some agencies (for
// example BIR) and/or some types of obligation. Nothing picked shows
// everything; a deadline is shown when it matches both lists.
import { describe, it, expect } from 'vitest'
import { OBLIGATIONS, HOLIDAY_SET } from '../../src/lib/deadlineData.js'
import {
  generateDeadlines, recentDeadlines, NO_FILTER, isFiltered, filterDeadlines, filterOptions, trimPick, filterText,
} from '../../src/engine/deadlines.js'
import { defaultProfile } from '../../src/engine/profile.js'
import { fromISO, addDays } from '../../src/engine/dates.js'

// Sat Oct 17, 2026 (Manila). Maria: self-employed on 8%, employer, receives 2307s.
const TODAY = fromISO('2026-10-17')
const maria = { ...defaultProfile('individual'), id: 'p-maria', name: 'Maria Santos', hasEmployees: true, receives2307: true }
const juan = { ...defaultProfile('employee'), id: 'p-juan', name: 'Juan Dela Cruz' }
const upcoming = p => generateDeadlines(OBLIGATIONS, p, { from: TODAY, to: addDays(TODAY, 400), holidays: HOLIDAY_SET, refDate: TODAY })
const calendar = p => [...recentDeadlines(OBLIGATIONS, p, { today: TODAY, holidays: HOLIDAY_SET }), ...upcoming(p)]
const list = upcoming(maria)
const pick = (agency = [], category = []) => ({ agency, category })

describe('filterOptions: the buttons the filter shows', () => {
  it('the agencies and types on the calendar, BIR first', () => {
    expect(filterOptions(calendar(maria))).toEqual({
      agency: ['BIR', 'SSS', 'PhilHealth', 'Pag-IBIG', 'LGU', 'DOLE'],
      category: ['income', 'withholding', 'payroll', 'registration'],
    })
  })
  it('an employee: BIR and the LGU (cedula)', () => {
    expect(filterOptions(calendar(juan))).toEqual({ agency: ['BIR', 'LGU'], category: ['income', 'registration'] })
  })
})

describe('filterDeadlines', () => {
  it('nothing picked: everything, unchanged', () => {
    expect(list).toHaveLength(110)
    expect(isFiltered(NO_FILTER)).toBe(false)
    expect(filterDeadlines(list, NO_FILTER)).toBe(list)
  })
  it('BIR only: the 28 BIR deadlines of the next 13 months, nothing else', () => {
    const bir = filterDeadlines(list, pick(['BIR']))
    expect(bir).toHaveLength(28)
    expect(bir.every(d => d.obligation.agency === 'BIR')).toBe(true)
    expect(list.filter(d => d.obligation.agency === 'BIR')).toHaveLength(28)
  })
  it('two agencies: SSS and PhilHealth together', () => {
    const two = filterDeadlines(list, pick(['SSS', 'PhilHealth']))
    expect(two.length).toBe(filterDeadlines(list, pick(['SSS'])).length + filterDeadlines(list, pick(['PhilHealth'])).length)
    expect(new Set(two.map(d => d.obligation.agency))).toEqual(new Set(['SSS', 'PhilHealth']))
  })
  it('a type only: Withholding (16)', () => {
    const w = filterDeadlines(list, pick([], ['withholding']))
    expect(w).toHaveLength(16)
    expect(w.every(d => d.obligation.category === 'withholding')).toBe(true)
  })
  it('agency and type together must both match: BIR + Payroll & contributions is empty', () => {
    expect(isFiltered(pick(['BIR'], ['payroll']))).toBe(true)
    expect(filterDeadlines(list, pick(['BIR'], ['payroll']))).toEqual([])
    expect(filterDeadlines(list, pick(['BIR', 'SSS'], ['payroll']))).toEqual(filterDeadlines(list, pick(['SSS'])))
  })
  it('the order of the list is kept', () => {
    const bir = filterDeadlines(list, pick(['BIR']))
    expect(bir).toEqual(list.filter(d => d.obligation.agency === 'BIR'))
  })
})

describe('trimPick: only values the filter has a button for', () => {
  const options = filterOptions(calendar(maria))
  it('keeps what this calendar has', () => {
    expect(trimPick(pick(['BIR', 'SSS'], ['withholding']), options)).toEqual(pick(['BIR', 'SSS'], ['withholding']))
  })
  it('drops a value picked for another profile (a corporation\'s SEC), so it hides nothing', () => {
    expect(trimPick(pick(['SEC'], ['business']), options)).toEqual(NO_FILTER)
    expect(trimPick(pick(['SEC', 'BIR']), options)).toEqual(pick(['BIR']))
  })
  it('drops a row with a single value (no buttons are shown for it)', () => {
    const one = { agency: ['BIR'], category: ['income', 'withholding'] }
    expect(trimPick(pick(['BIR'], ['income']), one)).toEqual(pick([], ['income']))
  })
})

describe('filterText: the summary line of a filtered calendar', () => {
  it.each([
    [pick(['BIR']), 'BIR'],
    [pick(['BIR', 'SSS']), 'BIR, SSS'],
    [pick([], ['withholding']), 'Withholding'],
    [pick(['BIR', 'SSS'], ['withholding', 'payroll']), 'BIR, SSS; Withholding, Payroll & contributions'],
  ])('%j -> %s', (p, text) => {
    expect(filterText(p)).toBe(text)
  })
})
