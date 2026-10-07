// M21: every page has its own browser-tab title, "<Page> · JEZ Tax Suite"
// (WCAG 2.4.2 Page Titled).
import { describe, it, expect } from 'vitest'
import { pageTitle } from '../../src/lib/pageTitle.js'
import { POSTS } from '../../src/data/posts.js'

describe('M21 page titles', () => {
  it.each([
    ['/', 'Calendar · JEZ Tax Suite'],
    ['/estimator', 'Estimator · JEZ Tax Suite'],
    ['/checklist', 'Checklist · JEZ Tax Suite'],
    ['/forms', 'Forms · JEZ Tax Suite'],
    ['/tools', 'Tools · JEZ Tax Suite'],
    ['/blog', 'Blog · JEZ Tax Suite'],
    ['/references', 'References · JEZ Tax Suite'],
    ['/privacy', 'Privacy Notice · JEZ Tax Suite'],
    ['/account/password', 'Change password · JEZ Tax Suite'],
    ['/profiles', 'Profiles · JEZ Tax Suite'],
    ['/profiles/new', 'New profile · JEZ Tax Suite'],
    ['/profiles/abc-123/edit', 'Edit profile · JEZ Tax Suite'],
  ])('%s -> %s', (path, title) => {
    expect(pageTitle(path)).toBe(title)
  })

  it('a blog article is titled by the article', () => {
    const post = POSTS.find(p => p.id === '2307')
    expect(pageTitle('/blog/2307')).toBe(`${post.title} · Blog · JEZ Tax Suite`)
  })

  it('an unknown article or address falls back to the page it shows', () => {
    expect(pageTitle('/blog/no-such-post')).toBe('Article not found · Blog · JEZ Tax Suite')
    expect(pageTitle('/no-such-page')).toBe('Calendar · JEZ Tax Suite')
  })

  it('signed-out screens', () => {
    expect(pageTitle('/', { signedOut: true })).toBe('Sign in · JEZ Tax Suite')
    expect(pageTitle('/estimator', { signedOut: true })).toBe('Sign in · JEZ Tax Suite')
    expect(pageTitle('/privacy', { signedOut: true })).toBe('Privacy Notice · JEZ Tax Suite')
    expect(pageTitle('/', { recovery: true })).toBe('Set a new password · JEZ Tax Suite')
  })
})
