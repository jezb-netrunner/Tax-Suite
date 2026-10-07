// L18: every built page carries a Content-Security-Policy <meta> tag. Inline
// blocks are allowed by hash only, and the Supabase project only in an
// accounts build. Follow-up: the fonts are self-hosted, so no CSP names Google
// Fonts: the hosted page loads its fonts from its own origin (font-src
// 'self'), and the single file loads none (font-src 'none').
import { describe, it, expect } from 'vitest'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { contentSecurityPolicy, singleFileHtml, multiFileHtml, sha256Source } from '../../scripts/standalone-plugin.js'
import { supabaseConnectSources } from '../../scripts/build-mode.js'
import viteConfig from '../../vite.config.js'

const root = path.resolve(__dirname, '../..')
const appHtml = fs.readFileSync(path.join(root, 'app.html'), 'utf8')
const hash = text => `'sha256-${crypto.createHash('sha256').update(text, 'utf8').digest('base64')}'`
const cspOf = html => (html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)">/) || [])[1]

const SHELL = '<!DOCTYPE html><html><head>\n<meta charset="utf-8">\n' +
  '<style>.boot{color:#2a4d62}</style>\n<script type="module" crossorigin src="./assets/app.js"></script>\n' +
  '<link rel="stylesheet" crossorigin href="./assets/app.css">\n</head><body><div id="root"></div></body></html>'
// The built CSS, as Vite minifies it: the self-hosted @font-face rules first.
const FONT_FACES = '@font-face{font-family:Schibsted Grotesk;font-style:normal;font-display:swap;font-weight:400;src:url(./schibsted-grotesk-latin-400-normal-abc.woff2) format("woff2")}' +
  '@font-face{font-family:IBM Plex Mono;font-style:normal;font-display:swap;font-weight:600;src:url(./ibm-plex-mono-latin-600-normal-def.woff2) format("woff2")}'
const ASSETS = { './assets/app.js': 'document.title="x"', './assets/app.css': FONT_FACES + 'body{margin:0}' }
const read = rel => ASSETS[rel] ?? null

describe('Content-Security-Policy (L18)', () => {
  it('sha256Source hashes the exact text', () => {
    expect(sha256Source('abc')).toBe("'sha256-ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0='")
  })

  it('with nothing inline and no web fonts, scripts and styles come only from the site itself', () => {
    expect(contentSecurityPolicy()).toBe("default-src 'self'; script-src 'self'; style-src 'self'; font-src 'none'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'")
  })

  it('the single file allows only its own inlined script and styles, and no fonts (it uses the system fonts)', () => {
    const out = singleFileHtml(SHELL, read)
    const csp = cspOf(out)
    expect(csp).toBe([
      "default-src 'self'",
      `script-src ${hash('\ndocument.title="x"\n')}`,
      `style-src ${hash('.boot{color:#2a4d62}')} ${hash('\nbody{margin:0}\n')}`,
      "font-src 'none'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
    ].join('; '))
    expect(csp).not.toMatch(/unsafe-inline|unsafe-eval/)
    // The tag sits right after <meta charset>, before anything it governs.
    expect(out.indexOf('Content-Security-Policy')).toBeLessThan(out.indexOf('<style>'))
    // The font files are not embedded (size), and no @font-face points at them.
    expect(out).not.toContain('@font-face')
    expect(out).not.toContain('.woff2')
  })

  it('the hosted multi-file page allows its own files, its own fonts and the inline loading style', () => {
    const csp = cspOf(multiFileHtml(SHELL, { readAsset: read }))
    expect(csp).toContain("script-src 'self';")
    expect(csp).toContain(`style-src 'self' ${hash('.boot{color:#2a4d62}')};`)
    expect(csp).toContain("font-src 'self';")
    expect(csp).not.toMatch(/unsafe-inline|unsafe-eval/)
  })

  it('no CSP names Google Fonts; font-src is \'self\' only when the CSS has @font-face', () => {
    const noFonts = { ...ASSETS, './assets/app.css': 'body{margin:0}' }
    const pages = [
      singleFileHtml(SHELL, read), multiFileHtml(SHELL, { readAsset: read }), multiFileHtml(SHELL),
      multiFileHtml(SHELL, { readAsset: rel => noFonts[rel] ?? null }),
    ]
    for (const page of pages) expect(cspOf(page)).not.toMatch(/googleapis|gstatic/)
    expect(cspOf(pages[2])).toContain("font-src 'none'")
    expect(cspOf(pages[3])).toContain("font-src 'none'")
  })

  it('the real app.html loads nothing from Google (no font link, preload or preconnect)', () => {
    expect(appHtml).not.toMatch(/googleapis|gstatic|rel="preconnect"/)
    expect(cspOf(multiFileHtml(appHtml))).not.toMatch(/googleapis|gstatic/)
  })

  it('the Supabase project is allowed only in an accounts build', () => {
    expect(supabaseConnectSources('https://abc.supabase.co')).toEqual(['https://abc.supabase.co', 'wss://abc.supabase.co'])
    expect(supabaseConnectSources('')).toEqual([])
    const csp = cspOf(singleFileHtml(SHELL, read, { connect: supabaseConnectSources('https://abc.supabase.co') }))
    expect(csp).toContain("connect-src 'self' https://abc.supabase.co wss://abc.supabase.co;")
  })

  it('the real app.html gets a hash for its loading style', () => {
    const style = appHtml.match(/<style>([\s\S]*?)<\/style>/)[1]
    expect(cspOf(multiFileHtml(appHtml))).toContain(hash(style))
  })

  it('vite.config.js passes the Supabase sources only to an accounts build', () => {
    const saved = { ...process.env }
    try {
      delete process.env.JEZ_ENABLE_ACCOUNTS
      process.env.VITE_SUPABASE_URL = 'https://abc.supabase.co'
      process.env.VITE_SUPABASE_ANON_KEY = 'k'
      const api = cfg => cfg.plugins.flat().find(p => p && p.name === 'present-value-standalone-html').api
      expect(api(viteConfig({ command: 'build', mode: 'production' })).connect).toEqual([])
      process.env.JEZ_ENABLE_ACCOUNTS = '1'
      expect(api(viteConfig({ command: 'build', mode: 'production' })).connect).toEqual(['https://abc.supabase.co', 'wss://abc.supabase.co'])
    } finally {
      for (const k of ['JEZ_ENABLE_ACCOUNTS', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']) {
        if (k in saved) process.env[k] = saved[k]
        else delete process.env[k]
      }
    }
  })
})

