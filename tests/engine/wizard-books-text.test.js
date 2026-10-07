// H11: the books-of-accounts text in profile setup is built from the
// obligation rules (bir-looseleaf-books: 15 days, bir-cas-books: 30 days after
// the taxable year ends), so a fiscal-year corporation is not told "January".
import { describe, it, expect } from 'vitest'
import obligationsData from '../../src/data/rules/obligations.json'
import { booksCardText } from '../../src/engine/wizardText.js'
import { generateDeadlines } from '../../src/engine/deadlines.js'
import { HOLIDAY_SET } from '../../src/lib/deadlineData.js'
import { defaultProfile } from '../../src/engine/profile.js'
import { fromISO, iso } from '../../src/engine/dates.js'

const OB = obligationsData.obligations

describe('H11 books of accounts text', () => {
  it('calendar-year taxpayer', () => {
    expect(booksCardText(OB)).toEqual({
      looseleaf: 'Printed/bound records under a BIR permit; bound copies due 15 days after your taxable year ends (Jan 15 for calendar-year taxpayers).',
      cas: 'BIR-registered accounting system; annual back-up/registration due 30 days after your taxable year ends (Jan 30 for calendar-year taxpayers).',
      summary: 'Loose-leaf and computerized books are due 15 days (loose-leaf) / 30 days (computerized) after your taxable year ends (Jan 15 / Jan 30 for calendar-year taxpayers).',
    })
  })

  it('June year-end corporation: Jul 15 / Jul 30, matching its calendar', () => {
    const t = booksCardText(OB, 6)
    expect(t.summary).toBe('Loose-leaf and computerized books are due 15 days (loose-leaf) / 30 days (computerized) after your taxable year ends (Jan 15 / Jan 30 for calendar-year taxpayers). For your taxable year ending in June: Jul 15 / Jul 30.')
    // Hand check: Jun 30, 2026 + 15 days = Wed Jul 15, 2026; + 30 days = Thu Jul 30, 2026.
    const corp = { ...defaultProfile('corporation'), name: 'June Corp', fiscalYearEndMonth: 6 }
    const due = booksType => generateDeadlines(OB, { ...corp, booksType }, {
      from: fromISO('2026-07-01'), to: fromISO('2026-07-31'), holidays: HOLIDAY_SET, refDate: fromISO('2026-07-01'),
    }).filter(d => d.obligation.id.endsWith('-books')).map(d => [d.obligation.id, iso(d.date)])
    expect(due('looseleaf')).toEqual([['bir-looseleaf-books', '2026-07-15']])
    expect(due('cas')).toEqual([['bir-cas-books', '2026-07-30']])
  })

  it('no text says "every January 15" or "by January 30" any more', () => {
    for (const m of [12, 6, 3]) {
      for (const s of Object.values(booksCardText(OB, m))) {
        expect(s).not.toContain('every January 15')
        expect(s).not.toContain('by January 30')
      }
    }
  })
})
