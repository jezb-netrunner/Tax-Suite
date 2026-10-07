// ESLint flat config (L22). Run with `npm run lint`; CI runs it too.
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  { ignores: ['dist/', 'coverage/', 'node_modules/', 'index.html'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { 'react-hooks': reactHooks },
    // The two classic hook rules. eslint-plugin-react-hooks 7 also ships React
    // Compiler rules (refs, set-state-in-effect, ...); they flag patterns this
    // React 18 code uses on purpose, so they are left off until a compiler move.
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
]
