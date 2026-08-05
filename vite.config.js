import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { standaloneHtml } from './scripts/standalone-plugin.js'

export default defineConfig({
  // Relative asset URLs so the built app runs from any location: a domain root,
  // a project subpath (e.g. GitHub Pages /Tax-Suite/), or opened straight from
  // disk as a file://. Absolute '/assets/...' paths 404 in the latter two.
  base: './',
  plugins: [react(), standaloneHtml()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
})
