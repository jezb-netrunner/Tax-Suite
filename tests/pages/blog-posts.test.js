// H09: blog posts brought up to date (EOPT invoicing, eAFS timing, the 8%
// conditions; worksheet INF:W-INF-7) and each post shows when it was last reviewed.
import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { POSTS } from '../../src/data/posts.js'
import BlogPage from '../../src/pages/Blog.jsx'

const h = React.createElement
const post = id => POSTS.find(p => p.id === id)
const texts = p => p.body.flatMap(b => (b.kind === 'list' ? b.items : [b.text]))
const allText = POSTS.flatMap(texts).join('\n')

function renderPost(id) {
  return renderToStaticMarkup(h(MemoryRouter, { initialEntries: [`/blog/${id}`] },
    h(Routes, null, h(Route, { path: '/blog/:postId', element: h(BlogPage) }))))
}

describe('H09 invoicing (EOPT: an invoice for every sale, not every payment)', () => {
  it('first-year post, "Every month" list', () => {
    expect(texts(post('first-year'))).toContain(
      'Issue a BIR-registered invoice for every sale or service (any amount if VAT-registered; ₱500 and up, or whenever the client asks, if non-VAT).')
    expect(allText).not.toContain('for every payment you receive')
  })
})

describe('H09 eAFS timing', () => {
  it('attachments are due 15 days after the April 15 deadline, or after e-filing if later', () => {
    const p = texts(post('first-year')).find(t => t.includes('eAFS'))
    expect(p).toContain('upload the scans through the BIR\'s eAFS portal within 15 days after the April 15 deadline (or after you e-file, if later).')
    expect(allText).not.toContain('within 15 days of filing')
  })
})

describe('H09 the 8% post (INF:W-INF-7)', () => {
  it('says who gets the ₱250,000 reduction and who may use the 8% option', () => {
    const t = texts(post('8-vs-grad'))
    expect(t).toContain('The ₱250,000 reduction is only for those with no salary income; if you are also employed, the 8% applies to all your business gross. The 8% option is only for non-VAT taxpayers with gross sales of ₱3M or less.')
  })
})

describe('H09 last reviewed date', () => {
  it('every post carries it', () => {
    for (const p of POSTS) expect(p.reviewed, p.id).toBe('October 2026')
  })
  it('is visible on every post page', () => {
    for (const p of POSTS) expect(renderPost(p.id), p.id).toContain('Last reviewed: October 2026')
  })
})
