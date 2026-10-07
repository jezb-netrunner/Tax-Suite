// M06 / C07: a failed background save shows a small notice on every page,
// e.g. "Couldn't save your figures. This profile was deleted in another
// window.", announced to screen readers and dismissable.
import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

let appState = {}
vi.mock('../../src/state/AppState.jsx', () => ({ useApp: () => appState }))
const { default: SaveNotice } = await import('../../src/components/SaveNotice.jsx')
const { FIGURES_NOT_SAVED } = await import('../../src/lib/inputSaver.js')

const strip = s => s.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim()

describe('M06 "Couldn\'t save your figures" notice', () => {
  it('shows the message and its cause in an alert with a Dismiss button', () => {
    const err = new Error(FIGURES_NOT_SAVED, { cause: new Error('This profile was deleted in another window.') })
    appState = { saveProblem: err, clearSaveProblem: () => {} }
    const html = renderToStaticMarkup(React.createElement(SaveNotice))
    expect(html).toContain('role="alert"')
    expect(strip(html)).toBe("Couldn't save your figures. This profile was deleted in another window. Dismiss")
    expect(html).toContain('<button class="linkbtn" type="button"')
  })

  it('shows nothing when every save worked', () => {
    appState = { saveProblem: null }
    expect(renderToStaticMarkup(React.createElement(SaveNotice))).toBe('')
    appState = {}
    expect(renderToStaticMarkup(React.createElement(SaveNotice))).toBe('')
  })
})
