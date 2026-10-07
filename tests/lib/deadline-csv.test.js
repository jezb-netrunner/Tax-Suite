// M22 (owner decision 12): "Download CSV" of the calendar deadlines and the
// print header line. CSV cells that a spreadsheet would read as a formula
// (starting with = + - @, or a tab or carriage return) get an apostrophe in
// front, so opening the file never runs anything.
import { describe, it, expect } from 'vitest'
import { csvCell, toCsv } from '../../src/lib/csv.js'
import { deadlineStatus, deadlineCsv, deadlineCsvFileName, printHeaderText } from '../../src/lib/exports.js'
import { OBLIGATIONS, HOLIDAY_SET } from '../../src/lib/deadlineData.js'
import { generateDeadlines, overdueDeadlines, filedStatus, OVERDUE_DAYS } from '../../src/engine/deadlines.js'
import { defaultProfile } from '../../src/engine/profile.js'
import { fromISO, addDays } from '../../src/engine/dates.js'

describe('csvCell: quoting', () => {
  it.each([
    ['Q3 2026', 'Q3 2026'],
    ['Remit withholding tax on compensation', 'Remit withholding tax on compensation'],
    ['Santos, Inc.', '"Santos, Inc."'],
    ['say "hi"', '"say ""hi"""'],
    ['two\nlines', '"two\nlines"'],
    ['', ''],
    [null, ''],
    [undefined, ''],
    [2026, '2026'],
  ])('%j -> %j', (input, out) => {
    expect(csvCell(input)).toBe(out)
  })
})

describe('csvCell: spreadsheet-formula protection', () => {
  it.each([
    ['=1+1', "'=1+1"],
    ['+639171234567', "'+639171234567"],
    ['-500', "'-500"],
    ['@SUM(A1:A2)', "'@SUM(A1:A2)"],
    ['\t=1+1', "'\t=1+1"],
    ['\r=1+1', "\"'\r=1+1\""],
    ['=HYPERLINK("http://x","y")', '"\'=HYPERLINK(""http://x"",""y"")"'],
    ['1601-C', '1601-C'],
    ['0619-E / 1601-EQ', '0619-E / 1601-EQ'],
  ])('%j -> %j', (input, out) => {
    expect(csvCell(input)).toBe(out)
  })
})

describe('toCsv', () => {
  it('joins cells with commas and rows with CRLF, ending with CRLF', () => {
    expect(toCsv([['Date', 'Form'], ['2026-10-12', '1601-C'], ['=x', 'a,b']])).toBe(
      'Date,Form\r\n2026-10-12,1601-C\r\n\'=x,"a,b"\r\n',
    )
  })
})

// Maria Santos: self-employed on 8%, employer, receives 2307s. Today Oct 7, 2026 (Manila).
const TODAY = fromISO('2026-10-07')
const maria = {
  ...defaultProfile('individual'), id: 'p-maria', name: 'Maria Santos', hasEmployees: true, receives2307: true,
  // Aug 2026 compensation withholding (1601-C due Sep 10, 2026) marked filed on Sep 9.
  filed: { 'bir-1601c:2026-09-10': '2026-09-09' },
}
const upcoming = generateDeadlines(OBLIGATIONS, maria, { from: TODAY, to: addDays(TODAY, 400), holidays: HOLIDAY_SET, refDate: TODAY })
const overdue = overdueDeadlines(OBLIGATIONS, maria, { today: TODAY, holidays: HOLIDAY_SET })
const recent = generateDeadlines(OBLIGATIONS, maria, {
  from: addDays(TODAY, -OVERDUE_DAYS), to: addDays(TODAY, -1), holidays: HOLIDAY_SET, refDate: TODAY,
}).filter(d => filedStatus(maria, d))

describe('deadlineStatus', () => {
  const find = (list, id) => list.find(d => d.id === id)
  it('DL:WS-05: 1601-C for September 2026, due Mon Oct 12, 2026 (5 days away) is "Due soon"', () => {
    const d = find(upcoming, 'bir-1601c:2026-10-10')
    expect(d.date).toEqual(fromISO('2026-10-12'))
    expect(deadlineStatus(d, maria, TODAY)).toBe('Due soon')
  })
  it('DL:WS-01: 1701Q Q3 2026, due Mon Nov 16, 2026 (40 days away) is "Upcoming"', () => {
    const d = upcoming.find(x => x.obligation.form === '1701Q' && x.period === 'Q3 2026')
    expect(d.date).toEqual(fromISO('2026-11-16'))
    expect(deadlineStatus(d, maria, TODAY)).toBe('Upcoming')
  })
  it('a passed date not marked filed is "Overdue"; one marked filed is "Filed"', () => {
    const jul = find(overdue, 'bir-1601c:2026-08-10')
    expect(deadlineStatus(jul, maria, TODAY)).toBe('Overdue')
    const aug = find(recent, 'bir-1601c:2026-09-10')
    expect(deadlineStatus(aug, maria, TODAY)).toBe('Filed')
  })
  it('a date marked "does not apply" says so, and a date due today is "Due today"', () => {
    const d = find(upcoming, 'bir-1601c:2026-10-10')
    expect(deadlineStatus(d, { ...maria, filed: { [d.id]: 'n/a' } }, TODAY)).toBe('Does not apply')
    expect(deadlineStatus(d, maria, fromISO('2026-10-12'))).toBe('Due today')
  })
})

describe('deadlineCsv', () => {
  const csv = deadlineCsv({ overdue, recent, upcoming, profile: maria, today: TODAY })
  const lines = csv.split('\r\n')

  it('has the header Date, Form, Title, Agency, Period, Status', () => {
    expect(lines[0]).toBe('Date,Form,Title,Agency,Period,Status')
  })

  it('has one row per deadline (overdue, marked in the last 60 days, and the next 13 months), in date order', () => {
    expect(lines.length).toBe(1 + overdue.length + recent.length + upcoming.length + 1) // trailing CRLF
    expect(lines[lines.length - 1]).toBe('')
    const dates = lines.slice(1, -1).map(l => l.slice(0, 10))
    expect([...dates].sort()).toEqual(dates)
  })

  it('writes the worksheet rows exactly', () => {
    expect(lines).toContain('2026-10-12,1601-C,Remit withholding tax on compensation,BIR,Sep 2026,Due soon')
    expect(lines).toContain('2026-11-16,1701Q,File & pay quarterly income tax,BIR,Q3 2026,Upcoming')
    expect(lines).toContain('2026-09-10,1601-C,Remit withholding tax on compensation,BIR,Aug 2026,Filed')
    expect(lines).toContain('2026-08-10,1601-C,Remit withholding tax on compensation,BIR,Jul 2026,Overdue')
  })

  it('a deadline without a form ("—") leaves the Form cell empty', () => {
    const d = upcoming.find(x => x.id === 'bir-1601c:2026-10-10')
    const noForm = { ...d, obligation: { ...d.obligation, form: '—' } }
    expect(deadlineCsv({ upcoming: [noForm], profile: maria, today: TODAY }))
      .toBe('Date,Form,Title,Agency,Period,Status\r\n2026-10-12,,Remit withholding tax on compensation,BIR,Sep 2026,Due soon\r\n')
  })

  it('a title that starts like a formula is protected in the file', () => {
    const d = upcoming.find(x => x.id === 'bir-1601c:2026-10-10')
    const evil = { ...d, obligation: { ...d.obligation, title: '=HYPERLINK("http://x","click")' } }
    expect(deadlineCsv({ upcoming: [evil], profile: maria, today: TODAY }).split('\r\n')[1])
      .toBe('2026-10-12,1601-C,"\'=HYPERLINK(""http://x"",""click"")",BIR,Sep 2026,Due soon')
  })
})

describe('deadlineCsvFileName', () => {
  it.each([
    ['Maria Santos', 'jez-tax-suite-deadlines-maria-santos-2026-10-07.csv'],
    ['Santos & Co., Inc.', 'jez-tax-suite-deadlines-santos-co-inc-2026-10-07.csv'],
    ['Niño Peñaflor', 'jez-tax-suite-deadlines-nino-penaflor-2026-10-07.csv'],
    ['', 'jez-tax-suite-deadlines-2026-10-07.csv'],
  ])('%j', (name, file) => {
    expect(deadlineCsvFileName(name, TODAY)).toBe(file)
  })
})

describe('printHeaderText', () => {
  it('JEZ Tax Suite · <profile> · Tax year <year> · Printed <Manila date>', () => {
    expect(printHeaderText({ profileName: 'Maria Santos', taxYear: 2026, printedOn: TODAY }))
      .toBe('JEZ Tax Suite · Maria Santos · Tax year 2026 · Printed Oct 7, 2026')
    expect(printHeaderText({ profileName: 'Fox Trading Corporation', taxYear: 'Jul 2025 to Jun 2026', printedOn: fromISO('2027-01-05') }))
      .toBe('JEZ Tax Suite · Fox Trading Corporation · Tax year Jul 2025 to Jun 2026 · Printed Jan 5, 2027')
  })
})
