import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { standaloneHtml } from './scripts/standalone-plugin.js'
import { accountsEnabled, ACCOUNTS_OPT_IN, supabaseConnectSources } from './scripts/build-mode.js'

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
    // M23: a local-mode build ships a two-line stand-in for the account
    // library instead of the library itself (src/lib/supabaseStub.js).
    resolve: {
      alias: command === 'build' && !accounts
        ? [{ find: /^@supabase\/supabase-js$/, replacement: fileURLToPath(new URL('./src/lib/supabaseStub.js', import.meta.url)) }]
        : [],
    },
    // A local-mode build compiles the Supabase keys out, whatever the env says.
    define: accounts
      ? {}
      : {
          'import.meta.env.VITE_SUPABASE_URL': '""',
          'import.meta.env.VITE_SUPABASE_ANON_KEY': '""',
        },
    server: { open: '/app.html' },
    preview: { open: '/index.html' },
    // L18: the built pages carry a Content-Security-Policy; an accounts build
    // also lets the app talk to its Supabase project.
    plugins: [react(), standaloneHtml({
      writeRootIndex: !accounts,
      connect: accounts ? supabaseConnectSources(env.VITE_SUPABASE_URL) : [],
    })],
    test: {
      environment: 'node',
      include: ['tests/**/*.test.js'],
      // M30: `npm run test:coverage` (CI prints the table in the job log).
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{js,jsx}'],
        reporter: ['text', 'text-summary'],
        reportsDirectory: 'coverage',
      },
    },
  }
})
