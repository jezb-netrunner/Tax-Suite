// L18 (follow-up, owner decision: self-host the fonts): Schibsted Grotesk and
// IBM Plex Mono are served as WOFF2 files from the app's own origin (from the
// @fontsource npm packages, latin subset, only the weights the app uses), so
// no visitor's browser contacts Google. The single-file index.html embeds no
// fonts (size) and uses the system-font fallback stack.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../..')
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')
const fontsCss = read('src/styles/fonts.css')
const faces = (fontsCss.match(/@font-face\s*\{[^}]*\}/g) || []).map(f => ({
  family: (f.match(/font-family:\s*'([^']+)'/) || [])[1],
  style: (f.match(/font-style:\s*(\w+)/) || [])[1],
  weight: Number((f.match(/font-weight:\s*(\d+)/) || [])[1]),
  srcs: [...f.matchAll(/url\(([^)]+)\)\s*format\('([^']+)'\)/g)].map(m => ({ url: m[1].replace(/['"]/g, ''), format: m[2] })),
  text: f,
}))
const key = f => `${f.family} ${f.weight}${f.style === 'italic' ? ' italic' : ''}`

describe('self-hosted fonts (L18)', () => {
  it('exactly the faces the app uses: Schibsted Grotesk 400-800 and 400 italic, IBM Plex Mono 400-700', () => {
    expect(faces.map(key)).toEqual([
      'Schibsted Grotesk 400', 'Schibsted Grotesk 400 italic', 'Schibsted Grotesk 500', 'Schibsted Grotesk 600',
      'Schibsted Grotesk 700', 'Schibsted Grotesk 800',
      'IBM Plex Mono 400', 'IBM Plex Mono 500', 'IBM Plex Mono 600', 'IBM Plex Mono 700',
    ])
  })
  it('each is one latin WOFF2 file from the @fontsource package, present on disk, with font-display: swap', () => {
    for (const f of faces) {
      expect(f.srcs).toHaveLength(1)
      expect(f.srcs[0].format).toBe('woff2')
      expect(f.srcs[0].url).toMatch(/^@fontsource\/(schibsted-grotesk|ibm-plex-mono)\/files\/[a-z-]+-latin-\d{3}-(normal|italic)\.woff2$/)
      expect(fs.existsSync(path.join(root, 'node_modules', f.srcs[0].url)), f.srcs[0].url).toBe(true)
      expect(f.text).toContain('font-display: swap;')
    }
  })
  it('the font CSS is part of the app styles; nothing loads fonts from elsewhere', () => {
    expect(read('src/main.jsx')).toContain("import './styles/fonts.css'")
    expect(read('src/main.jsx')).not.toMatch(/googleapis|loadWebFonts|data-fonts/)
    expect(read('app.html')).not.toMatch(/googleapis|gstatic/)
    expect(read('README.md')).not.toMatch(/Google Fonts|googleapis|gstatic/)
    expect(read('src/pages/Privacy.jsx')).not.toMatch(/Google/)
  })
  it('both packages are dependencies (the font files are open-source, OFL)', () => {
    const pkg = JSON.parse(read('package.json'))
    expect(Object.keys(pkg.dependencies)).toEqual(expect.arrayContaining(['@fontsource/schibsted-grotesk', '@fontsource/ibm-plex-mono']))
  })
  it('the CSS keeps the system-font fallback stacks (used by the single file)', () => {
    const css = read('src/styles/app.css')
    expect(css).toContain("font-family: 'Schibsted Grotesk', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;")
    expect(css).toContain("font-family: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;")
  })
})
