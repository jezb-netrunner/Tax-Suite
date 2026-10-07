# JEZ Tax Suite

**JEZ Tax Suite** is a multi-tenant web app that gives Philippine taxpayers
(MSME owners, freelancers/professionals, employers, corporations, and the bookkeepers who
serve them) three integrated tools:

1. **Deadline tracker**: a personalized compliance calendar of every BIR filing/payment
   date (plus LGU, SSS, PhilHealth, Pag-IBIG, SEC, DTI, DOLE obligations) that applies to a
   specific taxpayer profile, weekend/holiday-shifted by rule.
2. **Tax estimator**: regime-aware liability estimates with the full math shown line by
   line: 8% vs graduated (OSD/itemized) for individuals, mixed-income aggregation,
   employee annualization and take-home, corporate RCIT vs MCIT, payroll withholding.
3. **Compliance checklist**: the recurring, no-fixed-date obligations (invoicing, books,
   registration upkeep, GIS timing) tied to that profile.

Accounts hold **multiple taxpayer profiles**, so a bookkeeper can manage every client from
one login. Without a configured backend the app runs in local mode (profiles stored
in-browser).

## Stack

- React 18 + Vite, plain CSS design system (`src/styles/app.css`)
- Supabase (auth + Postgres with row-level security), optional; local mode otherwise
- Vitest for the tax-engine test suite (`tests/engine/`)
- React Router 6.30.6 or later on the v6 line. `npm audit` still lists two
  moderate React Router advisories (GHSA-wrjc-x8rr-h8h6, GHSA-337j-9hxr-rhxg)
  that are fixed only in 7.18+; every navigation in this app uses a fixed path
  and there is no server rendering, so neither can be reached. Moving to React
  Router 7.18+ is the long-term fix (the v7 future flags are already on in
  `src/main.jsx`).

```bash
npm install
npm run dev        # local dev
npm test           # engine tests (hand-worked tax examples)
npm run lint       # ESLint (eslint.config.js); CI fails on any warning
npm run test:coverage   # tests plus a coverage table (CI prints it)
npm run build      # production build → dist/
npm run audit:calendar   # print every taxpayer type's generated calendar
```

### Opening the app

**Just open `index.html`.** It is the whole app in a single self-contained file:
double-click it, email it, or serve it; no build step or web server needed.

| I want to… | Use |
|---|---|
| Look at the app / send it to someone | `index.html` (or the identical `dist/standalone.html`) |
| Work on the code | `npm run dev`, which serves the source entry `app.html` with hot reload |
| Host it properly | Upload `dist/`. Asset paths are relative, so a project subpath (e.g. `example.com/tax-suite/`) works, and routing uses hash URLs so no server rewrite rules are needed |

**File layout note:** `app.html` is the Vite *source* entry, the one `npm run dev`
serves and `npm run build` compiles. The root `index.html` is *generated* by the
build (see [`scripts/standalone-plugin.js`](scripts/standalone-plugin.js)) and is
committed so the repo is directly openable. Edit `app.html`, never `index.html`.
After changing anything under `src/` or `app.html`, run `npm run build` and
commit the regenerated `index.html` with your change: CI rebuilds it and fails
when the committed file differs from a fresh build.

The committed `index.html` is always the **local-mode** app. `npm run build`
ignores `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (from the shell or a
`.env` file) unless you also set `JEZ_ENABLE_ACCOUNTS=1` in the shell:

```bash
JEZ_ENABLE_ACCOUNTS=1 VITE_SUPABASE_URL=… VITE_SUPABASE_ANON_KEY=… npm run build
```

Such an accounts build writes `dist/` only and leaves `index.html` unchanged.
`npm run dev` reads the two keys as before.

Pushing to `main` publishes the site via GitHub Actions
([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)).
**Owner action: Settings → Pages → Source must be "GitHub Actions".** With
"Deploy from a branch", GitHub also publishes the raw branch on every push and
whichever copy finishes last is live, so the tested build may not be the one
people see. To publish with cloud accounts enabled, add `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` as repository secrets (the workflow then builds `dist/`
with `JEZ_ENABLE_ACCOUNTS=1`); without them the published site runs in
local-device mode.

## Hosting

**Owner action: give the app a web address of its own.** The site is served at
`jezb-netrunner.github.io/Tax-Suite/`. Browsers keep saved data per *host*
(`jezb-netrunner.github.io`), not per folder, so every GitHub Pages site
published under the same account shares this app's browser storage. Any of
those sites could read the client names and income figures saved in local
mode and, in accounts mode, the sign-in session (which would let it act as the
user). There is no exposure while the account publishes no other Pages site.

Choose one:

1. **Serve the app from a dedicated domain or subdomain** (recommended), for
   example `tax.example.ph`: add it under Settings → Pages → Custom domain and
   turn on "Enforce HTTPS". Nothing else may be published on that host. A
   GitHub user or organization whose only Pages site is this app also works.
2. **Or publish no other GitHub Pages site under the `jezb-netrunner`
   account**, including a `jezb-netrunner.github.io` user site, for as long as
   the app is served from `jezb-netrunner.github.io`.

**Content-Security-Policy.** `npm run build` adds a CSP `<meta>` tag to
`dist/index.html`, `dist/standalone.html` and `index.html`
([`scripts/standalone-plugin.js`](scripts/standalone-plugin.js)): only the
app's own code runs (inline blocks by SHA-256 hash), styles and fonts may come
from Google Fonts while `app.html` loads them, and connections go nowhere
except, in an accounts build, the Supabase project. `npm run dev` has no CSP
because Vite injects its own inline scripts there. A `<meta>` tag cannot set
`frame-ancestors`; if the host can send HTTP headers, also send
`Content-Security-Policy: frame-ancestors 'none'` (GitHub Pages cannot).

After a move, profiles saved in local mode stay behind on the old address and
the new address starts empty, so tell users to keep a copy with "Download my
data" (Profiles page) before the switch. In accounts mode, also change the
Supabase Site URL and redirect allow-list to the new address.

## Where the tax rules live, and how to update them

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

Every entry carries `legalBasis` (the RA/RR/RMC it comes from), a `confidence`
maintenance flag, and notes. The in-app **References** page is generated
from these same files, so the audit trail can't drift from behavior.

The calculators read these values, and every rate, threshold, cap and due date
shown in words (labels, warnings, help text, the profile setup cards, the form
guide and the blog) is built from them by
[`src/engine/ruleText.js`](src/engine/ruleText.js). When a **value** changes
(a new rate, a CPI-adjusted threshold, a new cap, a moved due date): edit the
value, cite the issuance, bump `meta.json`, and run `npm test` and
`npm run build`. No code change is needed. When the **shape** of a rule
changes (a new bracket structure, a new exemption, a new kind of deadline, a
different rounding), the code and its tests must change too.

A test (`tests/build/no-typed-tax-numbers.test.js`) fails if a peso amount,
percentage, year count or pay factor is typed into a page, the engine, the
form guide or the blog instead of coming from the rulebook; its short list of
exceptions (for example earlier-law rates in "not supported" notes) says why
each may stay.

## Backend (multi-tenant accounts)

Set env vars (see `.env.example`) to enable accounts + cloud-synced profiles:

```
VITE_SUPABASE_URL=…
VITE_SUPABASE_ANON_KEY=…
```

`npm run dev` picks them up directly. A production build also needs
`JEZ_ENABLE_ACCOUNTS=1` (see [Opening the app](#opening-the-app)).

Schema: [`supabase/migrations/0001_taxpayer_profiles.sql`](supabase/migrations/0001_taxpayer_profiles.sql):
one table, JSONB profile data, RLS restricting every row to its owner.
[`supabase/migrations/0002_account_privacy_and_limits.sql`](supabase/migrations/0002_account_privacy_and_limits.sql)
adds `delete_own_account()`, the server function behind "Delete my account"
(a signed-in user deletes their own login; their profiles go with it), a
64 kB limit per profile, a cap of 500 profiles per account, database-set
`created_at` / `updated_at`, and the policies rewritten for signed-in users
only. The app also filters its profile list by the signed-in user.
**Neither migration has been applied to a live database** (accounts mode has
never been live). Apply both, in order, when accounts mode is switched on.

Users can download all their data as JSON and erase it ("Erase all data on
this device" in local mode, "Delete my account" in accounts mode) from the
Profiles page.

### Supabase Auth settings checklist (before switching accounts mode on)

These settings live only in the Supabase dashboard (Authentication section),
so check each one by hand and again after any change. The app's sign-in
screens show only generic messages, and "Forgot password?" answers the same
way for every email; the settings below keep the server side consistent.

- [ ] **Email confirmation ON** ("Confirm email"). With it on, signing up with
      an email that already has an account looks the same as a new sign-up, so
      the app cannot be used to find out who uses it.
- [ ] **Minimum password length 8 or more** (the app asks for at least 8; keep
      `MIN_PASSWORD_LENGTH` in [`src/lib/auth.js`](src/lib/auth.js) in step if
      you raise it). Requiring letters and digits is a good addition.
- [ ] **Leaked-password protection ON** (rejects passwords found in known data
      leaks).
- [ ] **Rate limits** kept at or below Supabase's defaults for sign-ups,
      sign-ins, password-reset emails and token checks. **CAPTCHA** (hCaptcha or
      Cloudflare Turnstile) needs app support that is not built yet (a captcha
      token on sign-up, sign-in and reset); add that before turning it on.
- [ ] **Site URL** set to the app's real address (see [Hosting](#hosting)),
      for example `https://tax.example.ph/`.
- [ ] **Redirect URLs allow-list limited to the real domain**: only the exact
      app addresses, for example `https://tax.example.ph/` and
      `https://tax.example.ph/index.html`. No wildcards for other hosts and no
      `localhost` entries in production. Password-reset and confirmation emails
      link back to the page the user was on, so that page must be listed.
- [ ] **Session time-out**: set an inactivity time-out and a maximum session
      length (for example 12 hours and 7 days), so a forgotten sign-in on a
      shared computer ends by itself.
- [ ] **Custom SMTP** for account emails (Supabase's built-in sender is for
      testing and has a very low hourly limit).
- [ ] Migrations `0001` and `0002` applied, in order.

## Privacy

The app shows a **Privacy Notice** (Data Privacy Act of 2012, RA 10173) at
`#/privacy` ([`src/pages/Privacy.jsx`](src/pages/Privacy.jsx)). It is linked from
the footer, the sign-up form (a required consent checkbox; the consent time and
notice version are stored with the account) and profile setup, and the Estimator
says that typed figures are saved to the profile.

**Before publishing, fill in the placeholders** at the top of `Privacy.jsx`:
`[CONTACT EMAIL]`, `[DPO NAME]` and, once accounts mode is on, the Supabase
`[REGION]`. They show highlighted on the page until then. When the notice
changes, update `PRIVACY_NOTICE_UPDATED` there and `PRIVACY_NOTICE_VERSION` in
[`src/lib/auth.js`](src/lib/auth.js).

## Repository layout

- `src/engine/`: pure tax logic: deadline generator (`deadlines.js`), estimators, date math
- `src/data/`: the rulebook (above), form reference content, blog posts
- `src/pages/`, `src/components/`, `src/state/`: UI
- `tests/engine/`: hand-worked examples with known-correct answers
- The previous single-file app (`legacy/index.html`) and the original design
  bundle (`project/`) were removed from the branch. They are archived under the
  git tag `archive/pre-review-2026-10` (`git show archive/pre-review-2026-10:legacy/index.html`).
  Their tax rules are out of date; do not publish them.

> **Disclaimer:** JEZ Tax Suite provides estimates and reminders, not tax or legal advice,
> and does not replace review by a CPA. Verify dates and amounts with the agency before
> filing or paying.
