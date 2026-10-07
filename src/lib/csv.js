// CSV writing (RFC 4180) with spreadsheet-formula protection.
//
// A cell that starts with = + - @ (or a tab or carriage return) could run as
// a formula when the file is opened in Excel, Google Sheets or LibreOffice,
// so it gets an apostrophe in front (OWASP "CSV injection"). Cells with a
// comma, a double quote or a line break are quoted, and quotes are doubled.

const FORMULA_START = /^[=+\-@\t\r]/
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
