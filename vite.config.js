import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { standaloneHtml } from './scripts/standalone-plugin.js'

export default defineConfig({
  // Relative asset URLs so the built app runs from any location: a domain root,
  // a project subpath (e.g. GitHub Pages /Tax-Suite/), or opened straight from
  // disk as a file://. Absolute '/assets/...' paths 404 in the latter two.
  base: './',
  // The source entry is app.html; the build writes the runnable app to
  // index.html (see scripts/standalone-plugin.js), so the file people open by
  // instinct is the working app rather than un-compiled source.
  build: { rollupOptions: { input: 'app.html' } },
  server: { open: '/app.html' },
  preview: { open: '/index.html' },
  plugins: [react(), standaloneHtml()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
})
