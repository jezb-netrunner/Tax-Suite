// H16: tax numbers must come from the rulebook (src/data/rules/*.json, put
// into words by src/engine/ruleText.js), never typed into a page, the engine,
// the form guide, the blog, the glossary or any other data or helper module
// (src/data/*.js, src/lib/*.js). This test reads the source of those files and
// fails when a string, template or JSX text contains a peso amount, a
// percentage, a count of years or days, an "Nth taxable year" or a pay factor.
// Comments are ignored. Each exception below says why it may stay.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import * as espree from 'espree'

const root = path.resolve(__dirname, '../..')

function filesIn(dir, exts) {
  const out = []
  for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...filesIn(rel, exts))
    else if (exts.some(x => e.name.endsWith(x))) out.push(rel)
  }
  return out
}

const FILES = [...new Set([
  ...filesIn('src/pages', ['.jsx', '.js']),
  ...filesIn('src/engine', ['.js']),
  ...filesIn('src/components', ['.jsx', '.js']),
  'src/App.jsx',
  // Follow-up: every data and helper module, not only the form guide and blog.
  ...filesIn('src/data', ['.js']),
  ...filesIn('src/lib', ['.js', '.jsx']),
])]

// What counts as a typed tax number.
const PATTERNS = [
  { name: 'peso amount', re: /₱\s?\d[\d,]*(\.\d+)?\s?(M|k|K|million)?/g },
  { name: 'percentage', re: /\b\d+(\.\d+)?\s?%/g },
  // (2 or more: '1 day left' is countdown wording, not a rule)
  { name: 'count of years or days', re: /\b([2-9]|\d{2,}) (years?|days?)\b/g },
  { name: 'Nth taxable year', re: /\b\d+(st|nd|rd|th) (taxable )?year\b|\b(fourth|third|fifth) (taxable )?year\b/gi },
  { name: 'pay factor', re: /\b(365|313|261)\b/g },
]

// Exceptions: [file, the exact text matched, why it may stay].
const ALLOWED = [
  ['src/engine/estimators/individual.js', '1%', 'earlier law (Jul 2020 to Jun 2023) in the "not supported" note; never used in a computation'],
  ['src/engine/estimators/corporation.js', '1%', 'earlier law (Jul 2020 to Jun 2023) in the "not supported" note; never used in a computation'],
  ['src/data/posts.js', '₱500', 'the annual registration fee that EOPT abolished (history, not a current rule)'],
  ['src/data/forms.js', '₱500', 'the annual registration fee that EOPT abolished (history, not a current rule)'],
  ['src/data/forms.js', '₱30', 'documentary stamp tax on the COR, quoted for reference; not in any computation'],
  ['src/data/forms.js', '₱150M', 'transfer-pricing documentation threshold (RR 34-2020), quoted for reference only'],
  ['src/data/forms.js', '₱90M', 'transfer-pricing documentation threshold (RR 34-2020), quoted for reference only'],
  ['src/data/forms.js', '10 days', 'registration-update windows (Forms 1902 and 1905), quoted for reference only'],
  ['src/data/statutes.js', '8%', 'one-line summary of what TRAIN (RA 10963) enacted; describes the law, not the current rule'],
  ['src/data/statutes.js', '12%', 'one-line summary of what RA 12023 enacted; describes the law, not the current rule'],
  ['src/data/statutes.js', '20%', 'one-line summary of CREATE MORE\'s RBE rate (RA 12066); not used by any estimator'],
  ['src/lib/format.js', '₱999,999,999,999.99', 'the largest amount an input box accepts (MAX_MONEY_CENTAVOS); an input limit, not a tax rule'],
]

// CSS values in style objects (borderRadius: '50%', width: '100%') are not tax.
const CSS_KEYS = new Set(['width', 'height', 'maxWidth', 'minWidth', 'maxHeight', 'minHeight', 'borderRadius', 'left', 'right', 'top', 'bottom', 'flexBasis', 'transform', 'backgroundSize', 'lineHeight'])

function findings(file) {
  const src = fs.readFileSync(path.join(root, file), 'utf8')
  const tokens = espree.tokenize(src, { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true }, loc: true })
  const out = []
  tokens.forEach((t, i) => {
    if (!['String', 'Template', 'JSXText'].includes(t.type)) return
    const prev = tokens[i - 1]
    const key = tokens[i - 2]
    if (prev && prev.value === ':' && key && CSS_KEYS.has(key.value)) return
    for (const { name, re } of PATTERNS) {
      for (const m of t.value.matchAll(re)) {
        const text = m[0]
        if (/^₱\s?0(\.0+)?$/.test(text.trim())) continue // ₱0 is no rule
        if (ALLOWED.some(([f, a]) => f === file && a === text.trim())) continue
        out.push(`${file}:${t.loc.start.line} ${name} "${text.trim()}" in ${JSON.stringify(t.value.replace(/\s+/g, ' ').slice(0, 90))}`)
      }
    }
  })
  return out
}

describe('no tax numbers typed into pages, engine, form guide or blog (H16)', () => {
  it('scans the files it should', () => {
    expect(FILES).toContain('src/pages/Estimator.jsx')
    expect(FILES).toContain('src/engine/estimators/individual.js')
    expect(FILES).toContain('src/data/glossary.js')
    expect(FILES).toContain('src/data/statutes.js')
    expect(FILES).toContain('src/data/forms.js')
    expect(FILES).toContain('src/lib/format.js')
    expect(FILES.length).toBeGreaterThan(30)
  })

  for (const file of FILES) {
    it(file, () => {
      expect(findings(file)).toEqual([])
    })
  }

  it('every exception is still needed (no stale allowlist entries)', () => {
    for (const [file, text] of ALLOWED) {
      const src = fs.readFileSync(path.join(root, file), 'utf8')
      expect(src.includes(text), `${file} still contains ${text}`).toBe(true)
    }
  })

  it('catches a typed rate, threshold and year count (self-check)', () => {
    const sample = "const a = 'Over ₱3,000,000 the 8% option ends; MCIT from the 4th taxable year; carry 3 years; 313 days.'"
    const tokens = espree.tokenize(sample, { ecmaVersion: 'latest', sourceType: 'module' })
    const hits = PATTERNS.flatMap(({ re }) => [...tokens[3].value.matchAll(re)].map(m => m[0].trim()))
    expect(hits).toEqual(['₱3,000,000', '8%', '3 years', '313 days', '4th taxable year', '313'])
  })
})
