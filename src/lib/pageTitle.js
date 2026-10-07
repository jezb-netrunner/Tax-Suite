// M21: the browser-tab title of each page, "<Page> · JEZ Tax Suite"
// (WCAG 2.4.2 Page Titled). App.jsx sets document.title from this on every
// route change.
import { POSTS } from '../data/posts.js'

export const BRAND = 'JEZ Tax Suite'

const PAGES = {
  '/': 'Calendar',
  '/estimator': 'Estimator',
  '/checklist': 'Checklist',
  '/forms': 'Forms',
  '/tools': 'Tools',
  '/blog': 'Blog',
  '/references': 'References',
  '/privacy': 'Privacy Notice',
  '/account/password': 'Change password',
  '/profiles': 'Profiles',
  '/profiles/new': 'New profile',
}

/**
 * The page part of the title for a route path.
 * opts.signedOut: accounts mode before sign-in (every route but /privacy shows the sign-in screen).
 * opts.recovery: back from a password-reset email link.
 */
export function pageName(pathname, { signedOut = false, recovery = false } = {}) {
  const path = (pathname || '/').replace(/\/+$/, '') || '/'
  if (recovery) return 'Set a new password'
  if (signedOut) return path === '/privacy' ? PAGES['/privacy'] : 'Sign in'
  if (PAGES[path]) return PAGES[path]
  const post = path.match(/^\/blog\/([^/]+)$/)
  if (post) {
    const p = POSTS.find(x => x.id === decodeURIComponent(post[1]))
    return `${p ? p.title : 'Article not found'} · Blog`
  }
  if (/^\/profiles\/[^/]+\/edit$/.test(path)) return 'Edit profile'
  // Any other address redirects to the calendar.
  return PAGES['/']
}

export function pageTitle(pathname, opts) {
  return `${pageName(pathname, opts)} · ${BRAND}`
}
