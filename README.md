# Present Value — Philippine Tax Suite

A multi-tenant SaaS web app from **The Present Value** that gives Philippine taxpayers —
MSME owners, freelancers/professionals, employers, corporations, and the bookkeepers who
serve them — three integrated tools:

1. **Deadline tracker** — a personalized compliance calendar of every BIR filing/payment
   date (plus LGU, SSS, PhilHealth, Pag-IBIG, SEC, DTI, DOLE obligations) that applies to a
   specific taxpayer profile, weekend/holiday-shifted by rule.
2. **Tax estimator** — regime-aware liability estimates with the full math shown line by
   line: 8% vs graduated (OSD/itemized) for individuals, mixed-income aggregation,
   employee annualization and take-home, corporate RCIT vs MCIT, payroll withholding.
3. **Compliance checklist** — the recurring, no-fixed-date obligations (invoicing, books,
   registration upkeep, GIS timing) tied to that profile.

Accounts hold **multiple taxpayer profiles** — a bookkeeper can manage every client from
one login. Without a configured backend the app runs in local mode (profiles stored
in-browser).

## Stack

- React 18 + Vite, plain CSS design system (`src/styles/app.css`)
- Supabase (auth + Postgres with row-level security) — optional; local mode otherwise
- Vitest for the tax-engine test suite (`tests/engine/`)

```bash
npm install
npm run dev        # local dev
npm test           # engine tests (hand-worked tax examples)
npm run build      # production build → dist/
npm run audit:calendar   # print every taxpayer type's generated calendar
```

### Opening the app

**Just open `index.html`.** It is the whole app in a single self-contained file —
double-click it, email it, or serve it; no build step or web server needed.

| I want to… | Use |
|---|---|
| Look at the app / send it to someone | `index.html` (or the identical `dist/standalone.html`) |
| Work on the code | `npm run dev` — serves the source entry `app.html` with hot reload |
| Host it properly | Upload `dist/`. Asset paths are relative, so a project subpath (e.g. `example.com/tax-suite/`) works, and routing uses hash URLs so no server rewrite rules are needed |

**File layout note:** `app.html` is the Vite *source* entry — the one `npm run dev`
serves and `npm run build` compiles. The root `index.html` is *generated* by the
build (see [`scripts/standalone-plugin.js`](scripts/standalone-plugin.js)) and is
committed so the repo is directly openable. Edit `app.html`, never `index.html`.

Pushing to `main` publishes the site via GitHub Actions
([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)) — enable it once
under **Settings → Pages → Source: GitHub Actions**. To publish with cloud
accounts enabled, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as
repository secrets; without them the published site runs in local-device mode.

## Where the tax rules live — and how to update them

**All rates, thresholds, deadlines, forms, and holidays are data, not code**, in
[`src/data/rules/`](src/data/rules/):

| File | Contents |
|---|---|
| `income-tax.json` | Graduated brackets, 8% option, OSD, 13th-month cap |
| `withholding-compensation.json` | The four 2023+ withholding tables, annualization |
| `business-tax.json` | VAT rate/threshold, percentage tax |
| `corporate.json` | RCIT 25%/20%, MCIT, fiscal-year rules |
| `ewt-rates.json` | Common expanded-withholding rates |
| `penalties.json` | Surcharge/interest/compromise + EOPT classification |
| `contributions.json` | SSS / PhilHealth / Pag-IBIG schedules |
| `obligations.json` | Every deadline rule: who, what form, what schedule |
| `holidays.json` | Non-working days used for deadline shifting |
| `meta.json` | Verification date stamp |

Every entry carries `legalBasis` (the RA/RR/RMC it comes from), `confidence`
(`verified` or `needs_review`), and notes. The in-app **References** page is generated
from these same files, so the audit trail can't drift from behavior. When the law changes:
edit the value, cite the issuance, bump `meta.json` — no code changes.

Entries marked `needs_review` could not be fully confirmed against a primary source at the
last verification pass and are labeled **"needs CPA review"** in the UI.

## Backend (multi-tenant accounts)

Set env vars (see `.env.example`) to enable accounts + cloud-synced profiles:

```
VITE_SUPABASE_URL=…
VITE_SUPABASE_ANON_KEY=…
```

Schema: [`supabase/migrations/0001_taxpayer_profiles.sql`](supabase/migrations/0001_taxpayer_profiles.sql)
— one table, JSONB profile data, RLS restricting every row to its owner.

## Repository layout

- `src/engine/` — pure tax logic: deadline generator (`deadlines.js`), estimators, date math
- `src/data/` — the rulebook (above), form reference content, blog posts
- `src/pages/`, `src/components/`, `src/state/` — UI
- `tests/engine/` — hand-worked examples with known-correct answers
- `legacy/index.html` — the previous single-file app, kept for reference
- `project/`, `chats/` — original design-handoff bundle, kept for reference

> **Disclaimer:** Present Value provides estimates and reminders, not tax or legal advice,
> and does not replace review by a CPA. Verify dates and amounts with the agency before
> filing or paying.
