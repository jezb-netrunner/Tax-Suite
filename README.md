# Present Value — Philippine Tax Suite

A standalone, single-file web app that helps self-employed Filipino freelancers and professionals
see and compute their taxes under current Philippine tax law.

**Open `index.html` in any browser — no build step, no server required.**
(It loads React and Babel from a CDN, so it needs an internet connection on first load.)

## What's inside

| Page | What it does |
|---|---|
| **Calendar** | Regime-aware BIR deadlines for Self-Employed, Mixed Income, Corporation and Employee taxpayers, with a live countdown to the next deadline, Feed / Timeline / Table views, and a computed filing-progress rail. |
| **Calculator** | Live three-way comparison — 8% flat tax vs graduated + 40% OSD vs graduated + itemized — with the full math, CWT crediting (including overpayment / carry-over), the ₱3M VAT-threshold guard, and a filled BIR form preview. |
| **Forms** | Plain-language reference for 14 BIR forms (1701Q, 1701A, 1701, 1702Q, 1702-RT, 2551Q, 2550Q, 2307, 2316, 1601-C, 0619-E, 0605, 1901, 1905). |
| **Tools** | Late-filing penalty estimator (EOPT-aware), monthly compensation-withholding calculator, and a year-to-date income/tax projector. |
| **Blog** | Plain-language guides on the 8%-vs-graduated decision, first-year registration, 2307s, and key deadlines. |

## Tax rules implemented (TY 2026)

- **Graduated income tax** — TRAIN (RA 10963) rates effective 2023 onward, Sec 24(A).
- **8% flat option** — 8% on gross receipts above the ₱250,000 allowance, in lieu of graduated
  rates *and* the 3% percentage tax; unavailable above the ₱3,000,000 VAT threshold.
- **Percentage tax** — 3% of gross (post-CREATE reversion, from July 1, 2023).
- **OSD** — 40% of gross sales/receipts for individuals.
- **VAT** — 12% registration required above ₱3M gross.
- **Withholding on compensation** — revised monthly table effective 2023 (RR 11-2018 as amended).
- **Penalties** — 25% surcharge + 12%/yr interest + RMO 7-2015 compromise; reduced to
  10% / 6%/yr for micro & small taxpayers under EOPT (RA 11976).
- **Deadlines** — TY 2026 BIR schedule with weekend deadlines moved to the next business day
  (e.g. 2551Q Q2: Jul 25 is a Saturday → due Mon Jul 27, 2026).

> **Disclaimer:** This is a reference tool, not tax advice. Always verify dates and rates with
> the BIR before filing.

## Repository layout

- `index.html` — the entire app (React 18 via CDN, single file).
- `project/`, `chats/` — the original Claude Design handoff bundle (prototypes and design
  transcripts) that this app was built from. Kept for reference; not used at runtime.
