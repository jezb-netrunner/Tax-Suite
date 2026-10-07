// Bridges the data layer to the UI: holiday calendar + obligation list.
import obligationsData from '../data/rules/obligations.json'
import holidaysData from '../data/rules/holidays.json'
import { makeHolidayCalendar } from '../engine/dates.js'

export const OBLIGATIONS = obligationsData.obligations

// The holiday calendar used to move deadlines, for any year: the proclaimed
// list where the rulebook has one, otherwise the holidays fixed by law.
// has(iso) / get(iso) / forYear(y) / isProclaimed(y) (see makeHolidayCalendar).
// Kept under its old name because the deadline engine and the penalty
// calculator take it wherever a Set of ISO dates used to go.
export const HOLIDAY_SET = makeHolidayCalendar(holidaysData.holidays, holidaysData.fixedByLaw.value)
