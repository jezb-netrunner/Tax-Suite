import React from 'react'
import { useManilaToday } from '../lib/useManilaToday.js'
import { printHeaderText } from '../lib/exports.js'

// M22: a line shown only on paper (and in "Save as PDF"):
// "JEZ Tax Suite · <profile> · Tax year <year> · Printed <Manila date>".
export function PrintHeader({ profileName, taxYear }) {
  const today = useManilaToday()
  return <p className="print-only print-head">{printHeaderText({ profileName, taxYear, printedOn: today })}</p>
}

// "Print / Save as PDF": the browser's print dialog, which also saves a PDF.
export function PrintButton() {
  return (
    <button type="button" className="btn sm ghost no-print" onClick={() => window.print()}>
      Print / Save as PDF
    </button>
  )
}
