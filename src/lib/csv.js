// CSV writing (RFC 4180) with spreadsheet-formula protection.
//
// A cell that starts with = + - @ (or a tab or carriage return) could run as
// a formula when the file is opened in Excel, Google Sheets or LibreOffice,
// so it gets an apostrophe in front (OWASP "CSV injection"). Cells with a
// comma, a double quote or a line break are quoted, and quotes are doubled.

// Audit Nov 12, 2026: the profile name (typed by the user) is now a cell, so
// the check also looks past leading spaces and covers the full-width forms of
// the same characters, which some spreadsheets treat alike.
const FORMULA_START = /^\s*[=+\-@\t\r\uFF1D\uFF0B\uFF0D\uFF20]/
const NEEDS_QUOTES = /[",\r\n]/

export function csvCell(value) {
  if (value == null) return ''
  let s = String(value)
  if (FORMULA_START.test(s)) s = "'" + s
  if (NEEDS_QUOTES.test(s)) s = '"' + s.replace(/"/g, '""') + '"'
  return s
}

// Rows of cells -> CSV text, CRLF line ends, ending with a line end.
export function toCsv(rows) {
  return rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
