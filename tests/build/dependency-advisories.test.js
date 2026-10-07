// L19: the lockfile must not fall back to versions with known advisories.
// react-router 6.x still carries GHSA-wrjc-x8rr-h8h6 / GHSA-337j-9hxr-rhxg
// (patched only in 7.18+, which is the long-term fix); every navigation in the
// app uses fixed paths, so neither can be reached.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const lock = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package-lock.json'), 'utf8'))
const pkgs = lock.packages

function versionsOf(name) {
  return Object.entries(pkgs)
    .filter(([key]) => key === `node_modules/${name}` || key.endsWith(`/node_modules/${name}`))
    .map(([, v]) => v.version)
}
function cmp(a, b) {
  const pa = a.split(/[.-]/).map(Number)
  const pb = b.split(/[.-]/).map(Number)
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i]
  return 0
}
const atLeast = (name, min) => {
  const vs = versionsOf(name)
  expect(vs.length, `${name} is in the lockfile`).toBeGreaterThan(0)
  for (const v of vs) expect(cmp(v, min), `${name}@${v} >= ${min}`).toBeGreaterThanOrEqual(0)
}

describe('dependency versions (L19)', () => {
  it('react-router-dom is 6.30.6 or later (GHSA-jjmj-jmhj-qwj2)', () => atLeast('react-router-dom', '6.30.6'))
  it('vitest is past the @vitest/mocker advisory (>= 4.1.11)', () => atLeast('vitest', '4.1.11'))
  it('tinypool (GHSA-5gmw-xhrv-c9v3, GHSA-85c8-ppgw-ccpr) is either gone or 2.1.2+', () => {
    for (const v of versionsOf('tinypool')) expect(cmp(v, '2.1.2')).toBeGreaterThanOrEqual(0)
  })
  it('nanoid is 3.3.18 or later (GHSA-2v37-7h3g-55p8)', () => atLeast('nanoid', '3.3.18'))
  it('source-map-js is 1.2.2 or later (GHSA-68fv-2mgg-jv7q)', () => atLeast('source-map-js', '1.2.2'))
})
