# JEZ Tax Suite — Review

Status: **Phase 2 (audit) in progress.** Sections 1–5 are compiled once all area reports are in.
Raw findings are appended to the log at the bottom as each audit subagent reports.

## 0. Baseline (run 2026-10-07, branch `review/jez-tax-suite` from `main` @ ed29f5a)

| Command | Result |
|---|---|
| `npm ci` | OK. `npm audit`: 7 vulnerabilities (3 moderate, 2 high, 2 critical), all but 2 in dev tooling; production deps: 2 moderate (`react-router` / `react-router-dom` 6.26) |
| `npm test` | OK: 6 test files, 89 tests passed |
| `npm run build` | OK (vite 6.4.3). Warning: single JS chunk 590 kB (171 kB gzip). Regenerated `index.html` is byte-identical to the committed one |
| lint | No lint script or ESLint config in the project |

### Test commands
```bash
npm ci
npm test            # vitest run (tests/engine)
npm run build       # writes dist/ and regenerates index.html
npm run audit:calendar
```

## Raw findings log (appended by audit subagents)
