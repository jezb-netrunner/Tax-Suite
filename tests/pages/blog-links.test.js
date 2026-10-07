// M18: every blog card is a real link (reachable with Tab, opened with Enter,
// announced as a link named after the article), not a click-only box.
import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import BlogPage from '../../src/pages/Blog.jsx'
import { POSTS } from '../../src/data/posts.js'

const h = React.createElement
const html = () => renderToStaticMarkup(h(MemoryRouter, { initialEntries: ['/blog'] }, h(BlogPage)))

describe('M18 blog cards are links', () => {
  it('each article has one link to its page, named by its title', () => {
    const out = html()
    for (const p of POSTS) {
      const links = out.match(new RegExp(`<a [^>]*href="/blog/${p.id}"[^>]*>([^<]*)</a>`, 'g')) || []
      expect(links.length).toBe(1)
      expect(links[0]).toContain(`>${p.title.replace(/'/g, '&#x27;')}</a>`)
    }
  })

  it('no click-only boxes are left', () => {
    expect(html()).not.toMatch(/<div class="card click"/)
  })

  it('the "Read article" arrow is decoration, not a second link name', () => {
    expect(html()).toMatch(/<div aria-hidden="true"[^>]*>Read article →<\/div>/)
  })
})
