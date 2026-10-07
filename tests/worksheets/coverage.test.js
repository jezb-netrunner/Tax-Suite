// M30: every worksheet in REVIEW.md section 3 (the hand-computed cases) has at
// least one test whose title names it, so the owner can find the test for any
// worksheet by its ID (for example "TB:W09").
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const review = fs.readFileSync(path.join(root, 'REVIEW.md'), 'utf8')
const section3 = review.slice(review.indexOf('## 3. Test worksheets'), review.indexOf('## 4. Findings'))
const IDS = [...section3.matchAll(/^#### ([A-Z]+:[A-Z-]*\d+):/gm)].map(m => m[1])

function testFiles(dir) {
  const out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...testFiles(p))
    else if (e.name.endsWith('.test.js')) out.push(p)
  }
  return out
}

// Titles of it(...), it.each(...)(...), describe(...) and test(...) calls.
const TITLES = testFiles(path.join(root, 'tests')).flatMap(f => {
  const src = fs.readFileSync(f, 'utf8')
  return [...src.matchAll(/\b(?:it|describe|test)(?:\.each\((?:[\w.]+|\[[\s\S]*?\])\))?\(\s*(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g)].map(m => m[2])
})

describe('REVIEW.md section 3 worksheets have named tests (M30)', () => {
  it('finds the worksheets', () => {
    expect(IDS.length).toBe(103)
    expect(IDS).toContain('TI:WS-08')
    expect(IDS).toContain('BUG:W7')
  })
  it('every worksheet ID appears in a test title', () => {
    const missing = IDS.filter(id => !TITLES.some(t => new RegExp(`${id.replace(/[-:]/g, '\\$&')}(?![0-9])`).test(t)))
    expect(missing).toEqual([])
  })
  it('money is asserted exactly: no test uses toBeCloseTo', () => {
    const loose = testFiles(path.join(root, 'tests')).filter(f => /\.toBeCloseTo\(/.test(fs.readFileSync(f, 'utf8')))
    expect(loose.map(f => path.relative(root, f))).toEqual([])
  })
})
