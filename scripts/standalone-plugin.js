import fs from 'node:fs'
import path from 'node:path'

// Emits dist/standalone.html — the whole app (JS + CSS) inlined into one file.
//
// Why: browsers refuse to FETCH ES modules over file:// (CORS), so the normal
// multi-file build shows a blank page when opened straight from disk. Inline
// scripts aren't fetched, so a single-file build runs by double-clicking it —
// the way the original single-file version of this app did. dist/index.html
// stays as the normal, cacheable build for real hosting.
export function standaloneHtml() {
  return {
    name: 'present-value-standalone-html',
    apply: 'build',
    closeBundle() {
      const dist = path.resolve('dist')
      const indexPath = path.join(dist, 'index.html')
      if (!fs.existsSync(indexPath)) return
      let html = fs.readFileSync(indexPath, 'utf8')

      // Inline stylesheets.
      html = html.replace(
        /[ \t]*<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>\s*/g,
        (whole, href) => {
          const file = path.join(dist, href.replace(/^\.?\//, ''))
          if (!fs.existsSync(file)) return whole
          return `<style>\n${fs.readFileSync(file, 'utf8')}\n</style>\n`
        }
      )

      // Inline module scripts. Escaping "</script" keeps a string literal in the
      // bundle from terminating the tag early.
      html = html.replace(
        /[ \t]*<script[^>]*type="module"[^>]*src="([^"]+)"[^>]*><\/script>\s*/g,
        (whole, src) => {
          const file = path.join(dist, src.replace(/^\.?\//, ''))
          if (!fs.existsSync(file)) return whole
          const js = fs.readFileSync(file, 'utf8').replace(/<\/script/gi, '<\\/script')
          return `<script type="module">\n${js}\n</script>\n`
        }
      )

      const out = path.join(dist, 'standalone.html')
      fs.writeFileSync(out, html)
      const kb = (fs.statSync(out).size / 1024).toFixed(0)
      this.info?.(`standalone.html ${kb} kB — single file, opens from disk`)
    },
  }
}
