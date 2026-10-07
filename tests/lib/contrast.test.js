// M19: the colour tokens in app.css meet WCAG 2.2 AA. Text needs 4.5:1
// (SC 1.4.3); the outline of a text box and the off switch need 3:1 against
// what is next to them (SC 1.4.11). Ratios use the WCAG relative-luminance
// formula, the same one axe-core uses.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'

const css = fs.readFileSync(new URL('../../src/styles/app.css', import.meta.url), 'utf8')

function rootTokens(text) {
  const root = text.match(/:root\s*\{([\s\S]*?)\}/)[1]
  const out = {}
  for (const m of root.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)) out[m[1]] = m[2].toLowerCase()
  return out
}

function luminance(hex) {
  const ch = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const T = rootTokens(css)
const WHITE = '#ffffff'
const TAG_FILL = '#eef3f8'   // .tag, .chip, .agency
const TAB_FILL = '#eaf0f6'   // .seg
const TABLE_HEAD = '#f3f7fb' // .tbl th
const INPUT_FILL = '#fbfdff' // .input-w

describe('M19 colour contrast (WCAG 2.2 AA)', () => {
  it('the formula matches the audit worksheet: #76869a on white is 3.72:1', () => {
    expect(Math.round(contrast('#76869a', WHITE) * 100) / 100).toBe(3.72)
  })

  it.each([
    ['--mut on white', () => T.mut, WHITE],
    ['--mut on the page background', () => T.mut, () => T.bg],
    ['--mut on tags', () => T.mut, TAG_FILL],
    ['--mut on tab bars', () => T.mut, TAB_FILL],
    ['--mut on table headers', () => T.mut, TABLE_HEAD],
    ['--mut on --accSoft', () => T.mut, () => T.accSoft],
    ['--mut in a text box', () => T.mut, INPUT_FILL],
    ['--dim on white', () => T.dim, WHITE],
    ['--dim on the page background (footer)', () => T.dim, () => T.bg],
    ['--dim in a text box (placeholder)', () => T.dim, INPUT_FILL],
    ['--dim on tags', () => T.dim, TAG_FILL],
    ['--bad on white', () => T.bad, WHITE],
    ['--bad on --badSoft (error messages)', () => T.bad, () => T.badSoft],
    ['--good on --goodSoft (SSS/PhilHealth/Pag-IBIG tags)', () => T.good, () => T.goodSoft],
    ['white on --good ("Lowest" badge)', WHITE, () => T.good],
    ['--warnInk on --warnSoft ("Due soon" pill)', () => T.warnInk, () => T.warnSoft],
    ['--accInk on white', () => T.accInk, WHITE],
    ['--accInk on --accSoft', () => T.accInk, () => T.accSoft],
  ])('text: %s is at least 4.5:1', (_, fg, bg) => {
    const f = typeof fg === 'function' ? fg() : fg
    const b = typeof bg === 'function' ? bg() : bg
    expect(f).toMatch(/^#[0-9a-f]{6}$/)
    expect(contrast(f, b)).toBeGreaterThanOrEqual(4.5)
  })

  it.each([
    ['text-box outline on white', () => T.field, WHITE],
    ['text-box outline on its fill', () => T.field, INPUT_FILL],
    ['off switch track on white', () => T.field, WHITE],
    ['white switch knob on the off track', WHITE, () => T.field],
    ['focus ring and selected outline on white', () => T.acc, WHITE],
    ['selected-tab outline on the tab bar', () => T.acc, TAB_FILL],
  ])('outline: %s is at least 3:1', (_, fg, bg) => {
    const f = typeof fg === 'function' ? fg() : fg
    const b = typeof bg === 'function' ? bg() : bg
    expect(f).toMatch(/^#[0-9a-f]{6}$/)
    expect(contrast(f, b)).toBeGreaterThanOrEqual(3)
  })

  it('text boxes, the search box and the off switch use the --field outline', () => {
    const rule = sel => css.match(new RegExp(`(^|\\n)${sel}\\s*\\{([^}]*)\\}`))[2]
    expect(rule('\\.input-w')).toMatch(/border: 1\.5px solid var\(--field\)/)
    expect(rule('\\.search-w')).toMatch(/border: 1\.5px solid var\(--field\)/)
    expect(rule('\\.switch')).toMatch(/background: var\(--field\)/)
  })
})
