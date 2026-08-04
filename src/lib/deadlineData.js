// Bridges the data layer to the UI: pre-parsed holiday set + obligation list.
import obligationsData from '../data/rules/obligations.json'
import holidaysData from '../data/rules/holidays.json'

export const OBLIGATIONS = obligationsData.obligations
export const HOLIDAY_SET = new Set(holidaysData.holidays.map(h => h.date))
export const HOLIDAYS = holidaysData.holidays
