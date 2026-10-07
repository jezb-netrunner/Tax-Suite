import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { standaloneHtml } from './scripts/standalone-plugin.js'
import { accountsEnabled, ACCOUNTS_OPT_IN } from './scripts/build-mode.js'

export default defineConfig(({ command, mode }) => {
  // M29: accounts mode is off in a build unless JEZ_ENABLE_ACCOUNTS=1 is set
  // with both Supabase keys (see scripts/build-mode.js).
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const accounts = accountsEnabled({ command, env, optIn: process.env[ACCOUNTS_OPT_IN] })
  return {
    // Relative asset URLs so the built app runs from any location: a domain root,
    // a project subpath (e.g. GitHub Pages /Tax-Suite/), or opened straight from
    // disk as a file://. Absolute '/assets/...' paths 404 in the latter two.
    base: './',
    // The source entry is app.html; the build writes the runnable app to
    // index.html (see scripts/standalone-plugin.js), so the file people open by
    // instinct is the working app rather than un-compiled source.
    build: { rollupOptions: { input: 'app.html' } },
    // A local-mode build compiles the Supabase keys out, whatever the env says.
    define: accounts
      ? {}
      : {
          'import.meta.env.VITE_SUPABASE_URL': '""',
          'import.meta.env.VITE_SUPABASE_ANON_KEY': '""',
        },
    server: { open: '/app.html' },
    preview: { open: '/index.html' },
    plugins: [react(), standaloneHtml({ writeRootIndex: !accounts })],
    test: {
      environment: 'node',
      include: ['tests/**/*.test.js'],
    },
  }
})
