// L20: CI hygiene guards for the GitHub Pages workflow and .gitignore.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const workflow = fs.readFileSync(path.join(root, '.github/workflows/deploy.yml'), 'utf8')
const lines = workflow.split('\n')

// The text of one job, from its "  name:" line to the next job.
function jobText(name) {
  const start = lines.findIndex((l) => l === `  ${name}:`)
  if (start < 0) return ''
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (/^ {2}[A-Za-z0-9_-]+:\s*$/.test(lines[i])) { end = i; break }
  }
  return lines.slice(start, end).join('\n')
}

describe('deploy.yml (L20)', () => {
  it('uses a supported Node.js LTS (22 or 24), not Node 20', () => {
    const versions = [...workflow.matchAll(/node-version:\s*['"]?(\d+)/g)].map((m) => m[1])
    expect(versions.length).toBeGreaterThan(0)
    for (const v of versions) expect(['22', '24']).toContain(v)
  })

  it('pins every action to a full commit SHA with the tag in a comment', () => {
    const uses = lines.filter((l) => /^\s*-?\s*uses:/.test(l))
    expect(uses.length).toBeGreaterThan(0)
    for (const l of uses) {
      expect(l).toMatch(/uses:\s*[\w.-]+\/[\w.-]+@[0-9a-f]{40}\s+#\s*v\d+(\.\d+)*\s*$/)
    }
  })

  it('grants nothing at the top level and Pages rights only to the deploy job', () => {
    expect(workflow).toMatch(/^permissions:\s*\{\}\s*$/m)
    const build = jobText('build')
    const deploy = jobText('deploy')
    expect(build).toMatch(/permissions:\n\s+contents: read/)
    expect(build).not.toMatch(/pages: write|id-token: write/)
    expect(deploy).toMatch(/pages: write/)
    expect(deploy).toMatch(/id-token: write/)
    expect(workflow.match(/pages: write/g)).toHaveLength(1)
    expect(workflow.match(/id-token: write/g)).toHaveLength(1)
  })
})

describe('lint (L22)', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  it('has an npm run lint script that fails on any warning', () => {
    expect(pkg.scripts.lint).toBe('eslint . --max-warnings 0')
    expect(fs.existsSync(path.join(root, 'eslint.config.js'))).toBe(true)
  })
  it('CI runs the linter before the tests', () => {
    const build = jobText('build')
    expect(build).toMatch(/- run: npm run lint\n\s+- run: npm test/)
  })
})

describe('.gitignore (L20)', () => {
  const ignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8').split('\n').map((l) => l.trim())
  it('ignores every .env.* file except .env.example', () => {
    expect(ignore).toContain('.env')
    expect(ignore).toContain('.env.*')
    expect(ignore).toContain('!.env.example')
  })
})
