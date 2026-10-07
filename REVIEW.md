# JEZ Tax Suite: Review

Branch `review/jez-tax-suite` (from `main` at ed29f5a). Review date: **October 7, 2026** (Asia/Manila).
Owner decisions are recorded in section 4.3 (Phase 3). Fixes follow in Phase 4.

## 0. Baseline: install, build, lint, tests

| Command | Result |
|---|---|
| `npm ci` | OK. `npm audit`: 7 advisories (3 moderate, 2 high, 2 critical), all but 2 in build/test tools. Shipped app: 2 moderate (`react-router`), not reachable in this app (L19) |
| `npm test` | OK: 6 test files, 89 of 89 tests pass |
| `npm run build` | OK (vite 6.4.3). Warning: one 590 kB JS chunk. The rebuilt `index.html` is byte-identical to the committed one |
| lint | No lint script or ESLint config. A temporary ESLint run found 1 error and 14 warnings (L22) |
| Browser crawl | 15 routes × 8 profile types, all input edge cases: 0 page errors, 0 console errors, 0 failed requests (only React Router "future flag" notices) |

### Test commands
```bash
npm ci
npm test                 # vitest run (tests/engine)
npm run build            # writes dist/ and regenerates index.html
npm run audit:calendar   # prints each taxpayer type's calendar
```

### How this review was done
Nine audit subagents (four on tax logic, then posted information, bugs, UI/UX, security/privacy and code health) each produced findings. A separate adversarial verifier re-ran every reproduction and re-checked every legal claim for each area. A final completeness pass checked your checklist for gaps. Result: 123 verified findings, none rejected. Duplicates across areas were merged into the **78 findings** in section 4.

**Limits on legal verification (please read).** From this environment the BIR, lawphil, Official Gazette and Supreme Court e-Library websites could not be opened directly (blocked by the network proxy), and the shared web-search budget ran out during the audit. Legal statuses therefore rest on the text of primary documents as shown in search-engine results, or on Big-4 and law-firm tax alerts. On Oct 7, 2026 I re-checked the six points that change amounts or dates the most, by search:
- RR 6-2024: the 50% compromise cut applies only to violations of Secs 113, 237 and 238 (search-indexed BIR PDF; cloudcfo.ph; mpm.ph). Supports **C03**.
- BIR Forms 1700/1701/1701A/1701Q (Jan 2018): "DO NOT enter Centavos; 49 Centavos or Less drop down; 50 or more round up" (search-indexed BIR PDFs). Supports **M03**.
- RR 8-2018: crossing ₱3M moves the whole year to graduated rates with 8% payments credited; VAT applies from the month after the threshold is crossed; register within the following month (KPMG summary). Supports **H04** and the VAT-registration row.
- Proclamation 1427 s.2026 (2027 holidays, signed Sept 8, 2026) adds Chinese New Year, Black Saturday, All Souls' Day and Christmas Eve 2027 (GMA News, Philstar, NDV Law). Supports **H03**.
- Wage Order NCR-28: ₱755 / ₱718 from Sept 26, 2026 (GMA News, Daily Tribune, Philstar). Supports **H10**.
- RA 11976 (EOPT): reduced compromise for micro/small taxpayers is tied to Secs 113, 237, 238 (firm summaries). Supports **C03**.

Items marked **UNVERIFIED** below could not be confirmed from any source and need your confirmation as CPA.

## 1. Summary

**Status: not ready for clients to rely on its amounts.** The engine gets the core rate tables right: the 2023 graduated table, the 8% option for purely self-employed taxpayers, OSD, the four withholding tables, SSS/PhilHealth/Pag-IBIG schedules, RCIT, and almost every deadline date and holiday roll-over. But several features around those tables give wrong amounts or lose data.

Findings: **8 Critical, 17 High, 30 Medium, 23 Low** (78 in total, merged from 123 verified area findings).

**Top 5 risks**
1. **Centavos are misread (C01).** Typing or pasting ₱4,800.00 is read as ₱480,000. Any 2307, 2316 or payslip amount with centavos produces a tax or refund about 100 times off, and the wrong figure is saved.
2. **The amount payable with the annual return is wrong (C02, H06).** It mixes quarterly percentage tax into the income tax payable, uses 2307s against percentage tax, and ignores quarterly payments already made.
3. **The penalty calculator understates penalties for micro and small taxpayers (C03, H17).** It halves the compromise penalty for late filing (law: invoicing violations only), and applies EOPT rates to returns due before Jan 22, 2024.
4. **Payroll figures are wrong for common cases (C04, C05).** Minimum wage earners are charged withholding, and SSS ignores regular allowances, so withholding is wrong too.
5. **Silent data loss (C07, C08).** Two open tabs revert each other's profile edits and resurrect deleted clients; re-tapping the selected type in "Edit profile" wipes the registration settings and removes deadlines.

**Urgent, date-bound:** the **Oct 15, 2026** second installment of TY2025 income tax is missing from every calendar (**H02**), and the dashboard's "days left" uses the device's time zone, not Manila's (**H01**).

**Also outside the code (owner actions):** GitHub Pages is publishing two different copies of the site and the untested one is live (M29). Change *Settings → Pages → Source* to "GitHub Actions". There is no privacy notice (H14), and it needs your details as data controller.

## 2. Tax rules table

Every rate, bracket, threshold, deduction, credit, withholding rate, penalty and deadline checked: **194 rules: 118 OK, 45 WRONG, 31 UNVERIFIED.** WRONG means the app value or behaviour differs from the law for at least one taxable period or case; the related finding is in section 4. "Source" names the issuance and where it was read (see the verification limits in section 0).

### 2.1 Individual income tax (graduated, 8%, OSD, mixed income, credits)

| Rule | App value | Correct value | Source | Status |
|---|---|---|---|---|
| Graduated rates TY2023 onward: 0 up to 250k; 15% over 250k; 22,500+20% over 400k; 102,500+25% over 800k; 402,500+30% over 2M; 2,202,500+35% over 8M | Same table (income-tax.json graduatedBrackets) | Same | NIRC Sec 24(A)(2)(a) as amended by RA 10963; BIR Form 1701A Jan 2018 Table 2: https://bir-cdn.bir.gov.ph/local/pdf/1701A%20Jan%202018%20v5%20with%20rates.pdf (via auditor's search excerpt). Verifier: bracket bases recomputed exactly and internally consistent. | OK |
| Graduated rates TY2018-TY2022: 0 up to 250k; 20% over 250k; 30,000+25% over 400k; 130,000+30% over 800k; 490,000+32% over 2M; 2,410,000+35% over 8M | Not present; 2023 table used for all years | Separate table for taxable years 2018-2022 | BIR Form 1701A/1701 Jan 2018 Table 1 (bir-cdn URLs above); RR 8-2018 digest https://bir-cdn.bir.gov.ph/local/pdf/Digest%20RR%208-2018_copy.pdf. Verifier: bracket bases internally consistent. | **WRONG** |
| Law applied per taxable period (taxable-year selection or label) | No year input or year label for individual/mixed estimator | Rates must follow the taxable year being computed; at minimum the page must state the year | Owner rule; RA 10963 two-schedule structure; RA 11534 Sec 116 dated window | **WRONG** |
| Bracket boundaries: tax computed on the excess over the floor; floor value belongs to the lower bracket | amount > over picks bracket; 400,000 -> 22,500; 400,000.01 -> 22,500.002 | Same | Sec 24(A)(2)(a) 'over ... but not over' | OK |
| Zero or negative taxable income -> no tax | 0 | 0 | Sec 24(A)(2)(a) | OK |
| 8% rate on gross sales/receipts and other non-operating income | 8% on gross sales/receipts only (no non-operating income input) | 8% on gross sales/receipts + other non-operating income | NIRC Sec 24(A)(2)(b) as amended by RA 10963; RR 8-2018 digest (bir-cdn); RMO 23-2018 | **WRONG** |
| ₱250,000 reduction for purely self-employed/professionals under 8% | 250,000 | 250,000 | Sec 24(A)(2)(b); RR 8-2018 | OK |
| Mixed-income earners: no ₱250,000 reduction on business side; compensation at graduated rates | allowanceForMixedIncome 0; compTax = gradTax(compensationTaxable) | Same; unused zero band on compensation not transferable | Sec 24(A)(2)(c); RR 8-2018 digest; RMO 23-2018 (auditor's search excerpt) | OK |
| 8% ceiling: gross sales/receipts + other non-operating income not exceeding ₱3,000,000 | gross > 3,000,000 => ineligible (exact 3,000,000 eligible); uses vatThreshold, eightPercent.grossCeiling unused; non-operating income ignored | Not exceeding ₱3M including other non-operating income | Sec 24(A)(2)(b); RR 8-2018 | **WRONG** |
| 8% not available to VAT-registered taxpayers | eligible8 = !vat | Same | RR 8-2018; RMO 23-2018 | OK |
| 8% not available to taxpayers subject to Other Percentage Taxes (Secs 117-127) | Not checked (the app's own rulebook note lists the exclusion) | Ineligible | RR 8-2018 (secondary: KPMG, Grant Thornton alerts); app rulebook src/data/rules/income-tax.json:25 | **WRONG** |
| 8% is in lieu of graduated income tax and Sec 116 percentage tax | No percentage tax under 8% | Same | Sec 24(A)(2)(b); RR 8-2018 | OK |
| Exceeding ₱3M during the year: graduated rates for the whole year; 8% quarterly payments credited | Graduated for whole year: yes; credit for 8% payments: not modeled | Both | RR 8-2018 digest; RMO 23-2018 https://bir-cdn.bir.gov.ph/local/pdf/RMO%20NO.23-2018.pdf; app rulebook income-tax.json:25 says the same | **WRONG** |
| Exceeding ₱3M: Sec 116 percentage tax from Jan 1 until VAT liability, VAT thereafter | No percentage tax at all once gross > 3M; warning says 3% no longer applies | 3% PT on pre-VAT sales + VAT after | RMO 23-2018 (elibrary 10/90318, auditor's search excerpt); app rulebook income-tax.json:25; same conclusion in verified area TB-04 | **WRONG** |
| OSD for individuals = 40% of gross sales/receipts | 40% of gross | 40% of gross sales/receipts | NIRC Sec 34(L) as amended by RA 9504; RR 16-2008 https://bir-cdn.bir.gov.ph/BIR/pdf/43181rr%2016-2008.pdf | OK |
| OSD base for individual sellers is not reduced by cost of sales/services | Not reduced | Not reduced | RR 16-2008 (auditor's search excerpt) | OK |
| OSD base is gross sales net of returns, allowances and discounts | Field labelled 'gross sales / receipts'; no returns/discounts field | Net of returns/allowances/discounts | RR 16-2008 | OK |
| Itemized: net = gross - allowable expenses; loss gives zero tax | max(0, gross - expenses) | Same for the year's tax | NIRC Sec 34(A) | OK |
| NOLCO: carry over 3 years when itemizing; not claimable while on OSD; period still runs | Not modeled; loss silently dropped | Track and apply NOLCO | NIRC Sec 34(D)(3); RR 14-2001 https://lawphil.net/administ/bir/rr/rr14_01.pdf; RR 16-2008 (auditor's search excerpts) | **WRONG** |
| Mixed earner: net business loss does not reduce taxable compensation | Not offset (Math.max(0, businessNet)) | Could not confirm from a primary source | No primary text found (WebFetch blocked; search inconclusive; verifier could not search) | *UNVERIFIED* |
| Mixed graduated option: compensation + business net aggregated in one graduated computation | gradTax(compensationTaxable + businessNet) | Same | Sec 24(A)(2)(c)(1); BIR Form 1701 Jan 2018 | OK |
| Percentage tax rate: 3%; 1% from Jul 1 2020 to Jun 30 2023 | 3% always; label hard-codes '3%' | 1% for sales from 2020-07-01 to 2023-06-30, 3% otherwise | RA 11534 Sec 116 https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/2/93191; RMC 69-2023 https://bir-cdn.bir.gov.ph/local/pdf/RMC%20No.%2069-2023%20v2.pdf; app rulebook business-tax.json:17 states the same window | **WRONG** |
| Percentage tax paid quarterly on 2551Q, separately from the annual ITR | Included in 'Tax payable with the annual return' | Excluded from annual ITR payable | NIRC Sec 116/128; 2551Q guidelines https://bir-cdn.bir.gov.ph/local/pdf/2551Q_%20Jan%202018%20Guide.pdf | **WRONG** |
| 2307 creditable income tax withheld and employer withholding are credits against income tax only | Credited against income tax + percentage tax | Against income tax only | BIR Form 1701/1701A/1701Q tax-credit items (bir-cdn URLs) | **WRONG** |
| Forms: 1701A for purely business/profession on OSD or 8%; 1701 for mixed income or itemized | 1701A for pure OSD/8%; 1701 for mixed or itemized | Same | BIR Form 1701A Jan 2018 'who shall file' https://bir-cdn.bir.gov.ph/local/pdf/1701A%20Jan%202018%20v5%20with%20rates.pdf; 1701 guidelines (eFPS) | OK |
| Quarterly 1701Q: cumulative income, prior-quarter payments and 2307s credited; 8% ₱250k reduction applied cumulatively | Not computed; no quarterly-payments input | Cumulative quarterly computation | BIR Form 1701Q Jan 2018 https://bir-cdn.bir.gov.ph/local/pdf/1701Q%20Jan%202018%20final%20rev2_copy.pdf | **WRONG** |
| Election of 8% signified on Q1 return, irrevocable for the year | Banner: 'election locks for the year on the Q1 filing' | Same | RR 8-2018; RMO 23-2018 (auditor's search excerpt) | OK |
| Overpayment options on annual ITR: refund, TCC, or carry-over (carry-over irrevocable) | 'refund or carry over' | Refund / TCC / carry-over; irrevocability for individuals not confirmed | NIRC Sec 76 (corporate; SC cases on elibrary); exact 1701 wording not fetched | *UNVERIFIED* |
| ITR amounts in whole pesos: 49 centavos or less dropped, 50 or more rounded up | Cards/preview whole pesos (Math.round on float values; a .50 total can round down because of float error); breakdown in centavos; no per-line rounding | Whole pesos per form line, half-up | BIR Forms 1700/1701/1701A/1701Q Jan 2018: "DO NOT enter Centavos; 49 Centavos or Less drop down; 50 or more round up" (search-indexed BIR PDFs, re-checked 2026-10-07) | **WRONG** |
| 13th month pay and other benefits exclusion ₱90,000 (compensation side) | 90,000 | 90,000 | NIRC Sec 32(B)(7)(e) as amended by RA 10963; RR 11-2018 https://bir-cdn.bir.gov.ph/local/pdf/RR%20No.%2011-2018.pdf | OK |
| 2316 item for annual taxable compensation (all employers) | Hint: box 21 | Item 23 (item 21 present employer + item 22 previous employer) | Secondary only: https://guide.sprout.ph/composition-of-bir-form-2316 | **WRONG** |
| TY2027 bracket change (HB 10345, ₱350k zero bracket) | Not applied; note in rulebook | Not enacted as of Oct 1, 2026 (House committee approval Aug 2026); re-verify before TY2027 | https://bworldonline.com/banking-finance/2026/10/01/783704/is-real-tax-relief-finally-here-a-look-inside-house-bill-no-10345/; https://www.philstar.com/headlines/2026/08/11/2548552/house-panel-oks-p350000-tax-free-income-threshold | *UNVERIFIED* |

### 2.2 Percentage tax, VAT, EOPT and penalties

| Rule | App value | Correct value | Source | Status |
|---|---|---|---|---|
| Percentage tax rate, NIRC Sec 116, current (from Jul 1, 2023) | 3% (business-tax.json percentageTaxRate 0.03) | 3% | RMC 69-2023; RA 11534 (https://batasnatin.com/laws/rmc-no-69-2023-reverts-the-rates-of-percentage-tax-minimum-corporate-income) | OK |
| Percentage tax rate Jul 1, 2020 – Jun 30, 2023 (CREATE) | Not modelled; 3% applied to any period (estimator is effectively current-year only) | 1% | RA 11534 amending Sec 116; RR 4-2021; RMC 69-2023 (Grant Thornton, batasnatin); app's own legalBasis text business-tax.json:17 | **WRONG** |
| Percentage tax base after EOPT | Gross sales, accrual basis (forms.js 2551Q text) | Gross sales for goods and services (RR 3-2024; sales from Apr 27, 2024) | RR 3-2024 (PwC Tax Alert 24; GT) | OK |
| Percentage tax when sales cross ₱3M during the year (non-VAT) | ₱0 percentage tax for the whole year; banner says 3% 'no longer applies'; VAT not computed | 3% PT on sales before VAT liability (about the first ₱3M); VAT prospectively | RR 8-2018 per KPMG 2018 (secondary); app's own income-tax.json:25 note | **WRONG** |
| VAT rate | 12% | 12% | NIRC Sec 106/108 | OK |
| VAT threshold (from Jan 1, 2018) | ₱3,000,000; VAT if gross > ₱3,000,000 | ₱3,000,000; exempt if gross sales do not exceed ₱3M (Sec 109(CC)) | RA 10963 (TRAIN) | OK |
| VAT threshold before TRAIN | Not modelled (current-year only) | ₱1,919,500 (2012–2017, RR 16-2011); ₱1,500,000 before 2012 (RA 9337) | RR 16-2011 (search summary) | OK |
| VAT threshold CPI adjustment every 3 years (EOPT) | Stated in notes; first adjustment around Jan 2027 | Not confirmed from a primary source. The CPI clause is confirmed for the residential Sec 109(P) ceiling; whether the ₱3M VAT-exempt threshold itself is CPI-indexed was disputed between areas | dumlao.ph; Senate STSRO Tax Bits (secondary); not re-verified by the verifier | *UNVERIFIED* |
| VAT computation: output VAT less input VAT, excess input carried over | Not computed ('VAT 12%' label; 'see the VAT panel' points to nothing) | Quarterly output VAT − creditable input VAT; excess input carried to the next quarter | NIRC Sec 110; app's own forms.js 2550Q description | **WRONG** |
| VAT registration deadline after crossing ₱3M | 'Register before the end of the month following the month the threshold was exceeded' (rulebook marks needs_review; Estimator banner states it as fact) | Register (update registration) within the month following the month the ₱3M threshold was exceeded; VAT applies from the first day of the month following the month it was exceeded (RR 8-2018) | RR 8-2018 via KPMG "Elucidating the eight percent tax option" (search excerpt re-checked 2026-10-07). The app text matches. | OK |
| VAT filing frequency | Quarterly 2550Q, 25 days after quarter; 2550M no longer required | Same, from Jan 1, 2023 | TRAIN Sec 114(A); RMC 5-2023 (PwC Tax Alert 4; KPMG) | OK |
| Optional monthly 2550M (RMC 52-2023) | Optional, no penalty | Monthly 2550M optional, no deadline, no penalty (RMC 52-2023); quarterly 2550Q mandatory | RMC 52-2023 (Forvis Mazars, KPMG summaries); resolved by the completeness pass | OK |
| VAT on services on gross sales (accrual) basis; Sec 110(D) uncollected receivables | From Apr 27, 2024; output-VAT deduction next quarter | Same (RR 3-2024, sales from Apr 27, 2024) | PwC Tax Alert 24 (RR 3-2024); GT | OK |
| Invoice replaces OR; ₱500 invoice threshold; OR-to-invoice transition to Dec 31, 2024 | Invoice for sales of ₱500 or more | Transition confirmed (system ORs stamped 'Invoice' valid to Dec 31, 2024). GT describes the non-VAT trigger as 'more than ₱500', so 'or more' versus 'more than' is not settled | RR 7-2024 as amended by RR 11-2024 (GT) | *UNVERIFIED* |
| VAT on digital services start date | Liability from June 2, 2025 | June 2, 2025 | RA 12023; RR 3-2025 (PwC, KPMG) | OK |
| Digital services B2B withholding through Form 1600-VT by the 10th | Stated | Not confirmed in sources found | none found | *UNVERIFIED* |
| Surcharge, standard (Sec 248(A)) | 25% | 25% | NIRC Sec 248(A) | OK |
| Surcharge, willful neglect or fraud (Sec 248(B)); not reduced for micro/small | 50% in engine; not selectable in UI | 50%, not reduced | RR 6-2024 per KPMG | OK |
| Surcharge, micro & small (EOPT) | 10%, applied to any period | 10% for violations from Jan 22, 2024; 25% before | EOPT; RR 6-2024 (KPMG, GT) | **WRONG** |
| Wrong-venue 25% surcharge removed | Stated as removed | Removed by EOPT; file and pay at any AAB/RDO (RR 4-2024) | GT and KPMG EOPT filing FAQs | OK |
| Interest rate, standard (Sec 249, from 2018) | 12% p.a. simple | 12% (double the 6% BSP legal rate) | RR 21-2018 (platonmartinez summary); MTF Counsel | OK |
| Interest rate before Jan 1, 2018 | Not modelled | 20% p.a. | MTF Counsel (TRAIN cut 20% to 12%) | **WRONG** |
| Interest, micro & small (EOPT) | 6% (timing issue covered in the 'EOPT reduced penalties: timing' row) | 6% (50% of the Sec 249 rate) for violations from Jan 22, 2024 | RR 6-2024 (search-quoted text; KPMG) | OK |
| Interest base and running period | Basic tax only × rate × days/365 | Unpaid basic tax from the due date to full payment (before notice and demand); no simultaneous deficiency and delinquency interest | Sec 249(A) as amended; RR 21-2018 | OK |
| Interest day-count convention (leap years) | Actual days / 365 always; marked 'verified' | Not confirmed | RR 21-2018 illustrations not readable | *UNVERIFIED* |
| Citation for no-simultaneous-interest rule | Sec 249(D) | Sec 249(A) proviso | MTF Counsel quoting Sec 249(A) | **WRONG** |
| Compromise schedule, Sec 255 failure to file/pay (RMO 7-2015 Annex A) | ≤5k 1,000; ≤10k 3,000; ≤20k 5,000; ≤50k 10,000; ≤100k 15,000; ≤500k 20,000; ≤1M 30,000; ≤5M 40,000; >5M 50,000 | Same tiers (5,000 and below 1,000; 5,001–10,000 3,000; … over 5,000,000 50,000) | RMO 7-2015 Annex A copies (scribd 268039552; alasoplascpas Annex A PDF; mpm.ph) | OK |
| Compromise when tax due is ₱0 | ₱1,000 (₱500 if micro/small) | ₱1,000 (first tier, '5,000 and below'); no micro/small reduction | RMO 7-2015 Annex A; respicio (low-quality corroboration) | **WRONG** |
| Compromise 50% reduction for micro & small | Applied to late filing/payment (Sec 255) | Only for Sec 113/237/238 violations not involving fraud | RR 6-2024: "criminal violation by covered taxpayers of Sections 113, 237, and 238 ... not involving fraud ... 50%" (search-indexed BIR PDF re-checked 2026-10-07; cloudcfo.ph, mpm.ph) | **WRONG** |
| RMO 7-2015 still the operative schedule (Oct 2026) | 'confirmed still operative as of Aug 2026' | Still referenced by RR 6-2024 (Apr 2024); no superseding RMO found as of Apr 2025; 2026 not confirmed | RR 6-2024; Taxumo (secondary) | *UNVERIFIED* |
| EOPT taxpayer classification thresholds | Micro <3M; small 3M–<20M; medium 20M–<1B; large ≥1B | Same | RR 8-2024 (PwC, mpm.ph, search-indexed BIR PDF) | OK |
| Classification basis | Tool text: 'gross sales under ₱20M' (self-assessed) | BIR-assigned: initially TY2022 gross sales; no data means micro (VAT-registered means small); reclassification by BIR | RR 8-2024 (search summary) | OK |
| EOPT reduced penalties: timing | Applied regardless of violation date | Prospective, from EOPT effectivity Jan 22, 2024 (RR 6-2024 effective Apr 27, 2024) | KPMG Apr 2024; GT (secondary) | **WRONG** |
| Sec 250 information-return penalty, standard | ₱1,000 per failure, ₱25,000 cap per calendar year | ₱1,000 each, cap ₱25,000 | NIRC Sec 250 as amended by TRAIN (JuanTax summary) | OK |
| Sec 250 information-return penalty, micro & small | ₱500 per failure, ₱12,500 cap | ₱500 each, cap ₱12,500 | EOPT; KPMG via Philstar Oct 22, 2024 | OK |
| RR 4-2026 micro abatement: eligibility, ceiling, fee, window | 'gross sales ≤ ₱3M'; ≤ ₱80,000; ₱5,000 fee; until Dec 31, 2026 | Gross sales < ₱3M (RR 8-2024 micro definition; app's own penalties.json:33); ≤ ₱80,000; ₱5,000 fee; until Dec 31, 2026 | Grant Thornton; KPMG June 2026 (secondary); RR 8-2024 | **WRONG** |
| RR 4-2026 issuance / effectivity date | 'published July 22, 2026' | Issued Jun 18, 2026, effective Jul 7, 2026 per firm summaries; not re-checked against a BIR copy | Grant Thornton; KPMG June 2026 (secondary only) | *UNVERIFIED* |
| Money math: floating point and rounding of penalty outputs | Unrounded doubles shown with toLocaleString to 2 decimals (half away from zero) | Centavo results equal exact half-up rounding; line items add up to the total | Auditor: 3.5M cases; verifier: 300,000 cases through the UI formatter money2, 0 mismatches | OK |
| Peso input with centavos | Decimal point stripped (₱12,345.67 becomes ₱1,234,567) | Should accept or reject centavos explicitly | Code + reproduction | **WRONG** |

### 2.3 Deadlines, holidays and time basis

| Rule | App value | Correct value | Source | Status |
|---|---|---|---|---|
| Weekend/holiday rollover for BIR filing and payment | Next working day for all BIR items (cites BIR Tax Calendar, RR 26-2002) | Next business day for eFPS, eBIRForms and manual filers (RMC 65-2016) | https://www.forvismazars.com/ph/en/insights/tax-alerts/bir-rmc-65-2016 ; https://www.grantthornton.com.ph/globalassets/1.-member-firms/philippines/tax-alerts/2016/06.27.2016/rmc-no-65-2016.pdf (secondary/copy) [verifier: not re-fetched; egress blocked] | OK |
| Rollover, SSS contributions | Next working day | Next working day | https://www.sss.gov.ph/pay-loans/ (SSS payment-deadline text) [verifier: not re-fetched; egress blocked] | OK |
| Rollover, PhilHealth employer remittance | Next working day | Next working day (PhilHealth Circular 1 s.2014) | https://www.philhealth.gov.ph/circulars/2014/TS_circ01_2014.pdf [verifier: not re-fetched; egress blocked] | OK |
| Rollover, Pag-IBIG remittance | Next working day | Secondary sources say next working day; no primary found | https://kamiworkforce.com/ph/blog/sss-philhealth-pagibig-contribution-tables-2026/ (secondary) | *UNVERIFIED* |
| Rollover, LGU business tax / cedula / PTR | Moved later to next working day (weekends and holidays) | LGC sets fixed last days (Secs 139, 161, 167); no weekend rollover rule found. Administrative Code of 1987 pretermission-of-holiday rule may allow holidays (not weekends) to roll forward: section/text not confirmed | LGC Secs 139, 161, 167 via https://batasnatin.com/laws/tax-community-tax-cedula-Sec-156-164 | *UNVERIFIED* |
| Rollover, SEC AFS | May 29, 2027 (Sat) moved to May 31 | SEC MC 9-2026: weekend submissions 'considered filed on the next working day' (not an extension); 2027 date not yet set | https://www.pwc.com/ph/en/tax/tax-publications/tax-alerts/2026/tax-alert-11.html [verifier: not re-fetched; egress blocked] | *UNVERIFIED* |
| 13th-month pay never moves later | Dec 24, no shift | Not later than Dec 24 (PD 851 IRR; DOLE labor advisories) | https://www.alburolaw.com/wp-content/uploads/2025/12/112124-LA-13-24-Guidelines-on-the-Payment-of-Thirteenth-Month-Pay.pdf | OK |
| Time basis for today / days left | Device local clock | Philippine time: a BIR deadline is a Philippine calendar date (owner rule: Dates use Asia/Manila time) | CLAUDE.md project rule; RMC 65-2016 per auditor's secondary sources; verifier frozen-clock reproduction (tz.mjs) | **WRONG** |
| 2026 holidays (20 dates) | Jan1, Feb17, Mar20, Apr2-4, Apr9, May1, May27, Jun12, Aug21, Aug31, Nov1, Nov2, Nov30, Dec8, Dec24, Dec25, Dec30, Dec31 | Same: Proc 1006 s.2025 + Proc 1189 s.2026 (Eid'l Fitr Mar 20) + Proc 1264 s.2026 (Eid'l Adha May 27); Feb 25 EDSA is a special WORKING day | https://lawphil.net/executive/proc/proc2025/proc_1006_2025.html ; https://lawphil.net/executive/proc/proc2026/proc_1189_2026.html ; https://lawphil.net/executive/proc/proc2026/proc_1264_2026.html [verifier: not re-fetched; egress blocked] Verifier checked … | OK |
| 2027 holidays | 14 dates fixed by law; data file says proclamation not issued | Proc 1427 s.2026 (Sep 8, 2026) also adds Feb 6, Mar 27, Nov 2 (Tue), Dec 24 (Fri) | Proclamation 1427 s.2026 (signed Sept 8, 2026): GMA News, Philstar, NDV Law, re-checked 2026-10-07; Official Gazette not openable here | **WRONG** |
| Eid'l Fitr / Eid'l Adha 2027 | Omitted | Not yet proclaimed (issued separately, close to the date) | Proc 1006/1427 practice: Eid proclamations issued after dates are determined | *UNVERIFIED* |
| 2025 holidays | None | Proc 727 s.2024 (+ Proc 839 s.2025 Eid'l Fitr Apr 1, other Eid/election proclamations) | https://lawphil.net/executive/proc/proc2024/proc_727_2024.html [verifier: not re-fetched; egress blocked] | **WRONG** |
| 2028+ holidays fixed by law (e.g., Labor Day May 1, Independence Day Jun 12) | None; weekends only | Regular holidays fixed by law recur every year (EO 292 Sec 26 as amended by RA 9492) | Proc 1427 lists May 1 etc. as regular holidays under the Administrative Code as amended [verifier: not re-fetched; egress blocked] | **WRONG** |
| 1701Q due dates | May 15 / Aug 15 / Nov 15, no Q4 | May 15 / Aug 15 / Nov 15 (NIRC Sec 74(A) as amended by TRAIN) | https://taxsummaries.pwc.com/philippines/individual/tax-administration | OK |
| 1700 / 1701 / 1701A annual | Apr 15 | Apr 15 (NIRC Sec 51(C)(1)) | https://taxsummaries.pwc.com/philippines/individual/tax-administration | OK |
| TY2025 AITR + attachments (one-off) | Apr 15, 2026 / eAFS Apr 30, 2026 | May 15, 2026 (RMC 30-2026) | https://www.pwc.com/ph/en/tax/tax-publications/tax-alerts/2026/tax-alert-12.html ; corroborated by the app's own src/data/rules/attachments.json:38 | **WRONG** |
| 2nd installment, individual annual income tax | Not on calendar (reference text only: 1701A notes, income-tax.json annualITRInstallment) | On or before Oct 15 when tax due > ₱2,000 and installment elected (NIRC Sec 56(A)(2) as amended by RA 10963) | https://taxsummaries.pwc.com/philippines/individual/tax-administration ; https://www.forvismazars.com/ph/en/insights/tax-deadlines/october-2025-tax-calendar ; app's own income-tax.json:39-44 | **WRONG** |
| 1702Q | 60 days after close of Q1-Q3 (fiscal-aware) | Within 60 days after close of each of the first three quarters (NIRC Sec 75/77(B)) | https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/10/51569 ; https://juan.tax/form-1702q/ | OK |
| 1702-RT/EX/MX annual | 15th day of 4th month after FY end | 15th day of 4th month after close of taxable year (NIRC Sec 77(B)) | https://taxsummaries.pwc.com/Philippines/Corporate/Tax-administration | OK |
| 2550Q | 25 days after quarter end (fiscal-aware) | Within 25 days after close of taxable quarter (NIRC Sec 114(A) as amended) | https://batasnatin.com/laws/quarterly-vat-return-bir-form-2550q-deadlines-and-late-filing-penalties | OK |
| 2551Q | 25 days after quarter end (fiscal-aware) | Within 25 days after taxable quarter (NIRC Sec 128(A)(1)); form has calendar/fiscal box | https://juan.tax/form-2551q/ | OK |
| SLSP | 25 days after quarter end | On or before 25th day of month after close of quarter (RR 1-2012) | https://juan.tax/slsp (secondary) | OK |
| 1601-C | 10th of following month; Dec due Jan 15 (non-eFPS) | 10th; December due Jan 15; eFPS staggered 11th-15th (later, so app is conservative) | https://www.pwc.com/ph/en/tax/tax-publications/taxwise-or-otherwise/2019-taxwise-or-otherwise/wrapping-up-the-year-right.html | OK |
| 0619-E / 0619-F | 10th of following month, months 1-2 of quarter only | Same; eFPS 11th-15th by group (RR 26-2002) | https://kpmg.com/ph/en/home/insights/2018/09/special-intax-sept2018-issue1-vol1.html | OK |
| 1601-EQ / 1601-FQ / QAP | Last day of month after calendar quarter | Last day of month following quarter (RR 11-2018) | https://www.taxumo.com/blog/bir-tax-calendar-2026/ (secondary; shows Nov 3, 2026 for Q3) | OK |
| 1604-C and 1604-F | Jan 31 | Jan 31 (RR 11-2018) | https://www.forvismazars.com/ph/en/insights/tax-alerts/bir-form-nos-1604-c-and-1604-f | OK |
| 1604-E | Mar 1 | Mar 1 (RR 11-2018) | https://www.pwc.com/ph/en/tax/tax-publications/tax-alerts/previous-years/tax-alert-32-2018.html | OK |
| 2316 to employees | Jan 31 | On or before Jan 31 (RR 2-98 Sec 2.83 as amended by RR 2-2015/11-2018) | https://www2.deloitte.com/content/dam/Deloitte/ph/Documents/tax/ph-revenue-regulations-2-2015.pdf | OK |
| 2316 duplicates to BIR | Feb 28 | Not later than Feb 28 (RR 2-2015) | https://www2.deloitte.com/content/dam/Deloitte/ph/Documents/tax/ph-revenue-regulations-2-2015.pdf | OK |
| 2307 issuance | 20 days after calendar quarter | Within 20 days after close of quarter or on request (RR 2-98 Sec 2.58(B)) | https://juan.tax/form-2307 (secondary) | OK |
| 2306 issuance | Jan 31 following year | Believed Jan 31 (RR 2-98 Sec 2.58(B): final-tax statement to the payee on or before January 31 of the succeeding year, per verifier's reading); not retrieved from a source | none retrieved | *UNVERIFIED* |
| eAFS ITR attachments | Apr 30 / 15 days after FY annual due date | 15 days from deadline or actual e-filing, whichever later (RMC 44-2021) | https://kpmg.com/content/dam/kpmg/ph/pdf/InTAX/2021/RMC%20No.%2044-2021%20revised.pdf | OK |
| Loose-leaf books / CAS books | 15 days / 30 days after year end | 15 days (bound loose-leaf) / 30 days (CAS) after close of taxable year, via ORUS | https://www.aureadalaw.com/post/bir-philippines-loose-leaf-books-binding-registration-deadlines-for-2026 (secondary) | OK |
| Inventory list | 30 days after year end | 30th day after close of taxable year (RMC 57-2015) | https://dev.lawyerly.ph/laws/91872 ; https://www.grantthornton.com.ph/insights/articles-and-updates1/lets-talk-tax/tax-reminders-on-your-inventories/ | OK |
| Annual registration fee (₱500, Form 0605) | Info only: abolished, not dated | Abolished by RA 11976 (EOPT) effective Jan 22, 2024 | https://kpmg.com/ph/en/home/insights/2024/01/ease-of-paying-taxes-act.html | OK |
| Mandatory e-invoicing (first group) | Dec 31, 2026, no shift; cites RR 11-2025 | Dec 31, 2026 per RR 26-2025 extension, retained by later guidelines | https://www.grantthornton.com.ph/technical-alerts/tax-alert/2026/bir-issues-guidelines-on-electronic-invoicing-retains-31-dec-2026-deadline/ | OK |
| Micro-taxpayer abatement window | Until Dec 31, 2026 (info) | Applications until Dec 31, 2026 (RR 4-2026); whether the ₱5,000 fee is per taxable year is reported inconsistently | https://www.grantthornton.com.ph/insights/articles-and-updates1/tax-notes/bir-introduces-one-time-tax-abatement-for-micro-taxpayers/ ; https://kpmg.com/ph/en/insights/2026/08/exploring-tax-abatement-for-micro-taxpayers.html | OK |
| LGU business tax / mayor's permit | Jan 20 | Within first 20 days of January (LGC Sec 167) | https://muntinlupacity.gov.ph/wp-content/uploads/2025/01/Ordinance-No.-2025-292.pdf (quotes Sec 167) | OK |
| Community tax (cedula) | Last day of February | Not later than last day of February (LGC Sec 161) | https://batasnatin.com/laws/tax-community-tax-cedula-Sec-156-164 | OK |
| Professional tax (PTR) | Jan 31 | On or before Jan 31 (LGC Sec 139) | https://www.divinalaw.com/dose-of-law/payment-professional-tax | OK |
| SSS employer / self-employed | Last day of month following applicable month | Same (SSS Circular 2019-012); OFW/quarterly options differ | https://www.sss.gov.ph/pay-loans/ ; https://www.gmanetwork.com/news/money/companies/886639/sss-self-employed-voluntary-members-have-until-oct-31-to-pay-q3-contributions/story/ | OK |
| PhilHealth employer | 15th of following month (safe side) | PEN 0-4: 11th-15th; PEN 5-9: 16th-20th of following month | https://www.philhealth.gov.ph/circulars/2014/TS_circ01_2014.pdf | OK |
| PhilHealth self-paying | Last day of following month (needs_review) | Governed by PhilHealth Circular 2026-0011; summaries conflict (within month covered, or annual by Dec 31 with Jan grace) | https://www.philhealth.gov.ph/circulars/2026/TS-PC-2026-0011-English.pdf [verifier: not re-fetched; egress blocked] | *UNVERIFIED* |
| Pag-IBIG employer | 10th of following month (start of earliest window) | By first letter of employer name: A-D 10-14, E-L 15-19, M-Q 20-24, R-Z 25-EOM (secondary only) | https://techpilipinas.com/pag-ibig-contribution-table-payment-schedule/ (secondary) | *UNVERIFIED* |
| Pag-IBIG self-employed | 10th of following month (needs_review) | Not found | none retrieved | *UNVERIFIED* |
| DOLE 13th-month compliance report | Jan 15 | Jan 15 (Labor Advisory 16-2025 for 2025 pay) | https://www.sunstar.com.ph/manila/firms-told-submit-13th-month-pay-compliance-report | OK |
| SEC AFS, calendar-year corporations | May 29 every year (shifted on weekends) | FY2025: May 29, 2026, later moved to June 15, 2026 (MC 9-2026 + SEC notice); FY2026 date not yet set | https://www.pna.gov.ph/articles/1273093 ; https://www.grantthornton.com.ph/insights/articles-and-updates1/tax-notes/sec-mc-no-9-2026-guidelines-on-the-filing-of-afs-and-gis/ ; the June 15 move is also recorded in the app's own obligations.json:1182 and … | *UNVERIFIED* |
| SEC AFS, fiscal-year corporations | 120 days after FY end | 120 calendar days (MC 9-2026); 105 days for SRC 17.2 entities | https://www.grantthornton.com.ph/insights/articles-and-updates1/tax-notes/sec-mc-no-9-2026-guidelines-on-the-filing-of-afs-and-gis/ | OK |
| SEC GIS | Ongoing: 30 days after annual meeting | 30 calendar days from actual annual meeting (MC 9-2026) | https://www.grantthornton.com.ph/insights/articles-and-updates1/tax-notes/sec-mc-no-9-2026-guidelines-on-the-filing-of-afs-and-gis/ | OK |
| DOLE OSH reports (AEDR Jan 30, AMR Mar 31, WAIR monthly 20th) | Not tracked | Secondary sources list these for employers (DO 198-18, OSH Standards Rule 1050) | https://www.lawyer-philippines.com/articles/dole-reportorial-requirements-for-employers-in-the-philippines (secondary) | *UNVERIFIED* |
| Fiscal-year, leap-year and end-of-month date math (all 12 FY-end months; quarters ending Feb 28/29; 'last day' rules) | Engine output | Independent Python recomputation, FY ends 1-12, window Jun 2027-May 2029: 71 rows identical (e.g., Feb 29, 2028 + 60 = Apr 29, 2028); verifier re-checked the 16 worksheet dates in Python (ws_expected.py), all identical to the engine except where a holiday is missing from the data | auditor fy-check.mjs vs fy-expected.py; verifier ws.mjs vs ws_expected.py | OK |

### 2.4 Withholding, contributions and corporate tax

| Rule | App value | Correct value | Source | Status |
|---|---|---|---|---|
| Withholding table on compensation, MONTHLY (2023 onward) | over 20,833: 15%; over 33,333: 1,875 + 20%; over 66,667: 8,541.80 + 25%; over 166,667: 33,541.80 + 30%; over 666,667: 183,541.80 + 35% | Same (floors = annual brackets ÷ 12, rounded; bases continuous with the annual table) | RR 11-2018 Annex E https://bir-cdn.bir.gov.ph/local/pdf/Annex%20E%20RR%2011-2018.pdf (auditor's search extract). Verifier spot-check: floors equal 250k/400k/800k/2M/8M ÷ 12 rounded, and each base equals the tax at the previous floor (hand.out) | OK |
| Withholding table, SEMI-MONTHLY (2023 onward) | 10,417 / 16,667 (937.50) / 33,333 (4,270.70) / 83,333 (16,770.70) / 333,333 (91,770.70); rates 15-35% | Same (floors = annual ÷ 24, rounded) | RR 11-2018 Annex E (as above); verifier internal-consistency check in hand.out | OK |
| Withholding table, WEEKLY (2023 onward) | 4,808 / 7,692 (432.60) / 15,385 (1,971.20) / 38,462 (7,740.45) / 153,846 (42,355.65) | Same (floors = annual ÷ 52, rounded) | RR 11-2018 Annex E; verifier internal-consistency check in hand.out | OK |
| Withholding table, DAILY (2023 onward) | 685 / 1,096 (61.65) / 2,192 (280.85) / 5,479 (1,102.60) / 21,918 (6,034.30) | Same (floors = annual brackets ÷ 365: 684.93, 1,095.89, 2,191.78, 5,479.45, 21,917.81, rounded) | RR 11-2018 Annex E; verifier internal-consistency check in hand.out | OK |
| Annual graduated income tax table (annualization), 2023 onward | 0% to 250k; 15% over 250k; 22,500 + 20% over 400k; 102,500 + 25% over 800k; 402,500 + 30% over 2M; 2,202,500 + 35% over 8M | Same | NIRC Sec 24(A)(2)(a) as amended by RA 10963 https://www.lawphil.net/statutes/repacts/ra2017/ra_10963_2017.html | OK |
| 13th-month pay and other benefits exclusion | ₱90,000 | ₱90,000 | NIRC Sec 32(B)(7)(e), RA 10963 (lawphil, as above); same row verified OK in the individual area | OK |
| Mandatory employee contributions excluded from taxable compensation | Employee SSS + PhilHealth + Pag-IBIG shares deducted | Excluded (NIRC Sec 32(B)(7)(f)) | RA 10963 / NIRC (lawphil) | OK |
| SSS MPF (WISP) employee share treated as excludable mandatory contribution | Full SSS employee share, including MPF, deducted | No BIR guidance found | Auditor searched; nothing primary found. Verifier could not reopen it (WebSearch budget exhausted; WebFetch/curl egress-blocked for all source domains). | *UNVERIFIED* |
| Year-end annualization; over-withholding refunded by Jan 25 | Stated | Same | RR 2-98 Sec 2.79(B)(5)(b) as amended by RR 11-2018 (secondary: https://www.respicio.ph/commentaries/when-do-employers-refund-excess-tax-deducted-from-employees-in-the-philippines) | OK |
| Minimum wage earner exemption (statutory minimum wage plus holiday, OT, night differential, hazard pay) | Rule present (citing RR 10-2008) but not applied by any estimator; MWE's SMW and extra pay are taxed | SMW + holiday/OT/ND/hazard pay exempt; other taxable pay still taxed (RR 11-2018, after Soriano) | NIRC 24(A)(2), RA 9504; RR 11-2018 digest https://bir-cdn.bir.gov.ph/local/pdf/Digest%20RR%2011-2018.pdf ; G.R. 184450 https://lawphil.net/judjuris/juri2017/jan2017/gr_184450_2017.html | **WRONG** |
| NCR minimum wage reference | ₱695 non-agri (NCR-26) still operative; NCR-27 enjoined (as of Aug 26, 2026) | ₱755 non-agriculture / ₱718 agriculture and small establishments from Sept 26, 2026 (Wage Order NCR-28) | GMA News, Daily Tribune, Philstar (Sept 2026), re-checked 2026-10-07; NWPC PDF not openable here | **WRONG** |
| De minimis ceilings under RR 29-2025, effective Jan 6, 2026 (rice ₱2,500/mo; uniform ₱8,000/yr; monetized VL 12 days; dependents' medical ₱2,000/semester; laundry ₱400/mo; gifts ₱6,000; achievement awards ₱12,000) | Same | Same | Secondary: https://www.grantthornton.com.ph/insights/articles-and-updates1/tax-notes/updated-de-minimis-benefits-threshold/ ; https://kpmg.com/ph/en/insights/2026/01/maximizing-de-minimis-benefits-and-take-home-pay.html (auditor's extracts; not reopened by … | OK |
| De minimis under RR 29-2025: actual medical ₱12,000; OT meal 30% of minimum wage; CBA/productivity ₱12,000 | ₱12,000 / 30% / ₱12,000 | Increase confirmed generally; individual figures not confirmed | Same secondary sources (item values not in extracts). Verifier could not reopen it (WebSearch budget exhausted; WebFetch/curl egress-blocked for all source domains). | *UNVERIFIED* |
| RR 4-2025: uniform ₱6,000 to ₱7,000; cash/gift-certificate achievement awards allowed; effective Feb 14, 2025 | Same | Same | https://www.grantthornton.com.ph/insights/articles-and-updates1/tax-notes/amendments-to-de-minimis-benefits-uniform-and-clothing-allowance-and-employee-achievement-awards/ | OK |
| Substituted filing (one employer in the year, tax correctly withheld) | Profile flag driven by 'multiple employers'; card notes other exits (short withholding, other income) | RR 11-2018 conditions | Not checked against a source. Verifier could not reopen it (WebSearch budget exhausted; WebFetch/curl egress-blocked for all source domains). | *UNVERIFIED* |
| SSS rate 2025-2026 | 15% (employer 10% / employee 5%) | 15% (10/5); no 2026 change found | SSS Circular 2024-006 (secondary: https://www.grantthornton.com.ph/insights/articles-and-updates1/tax-notes/sss-implements-revised-contribution-rates-for-2025/ ; https://kpmg.com/xx/en/our-insights/gms-flash-alert/flash-alert-2025-026.html) | OK |
| SSS MSC floor / ceiling / step | ₱5,000 / ₱35,000 / ₱500, rounded half-up (5,250 gives 5,500; 34,750 gives 35,000) | Same | SSS Circular 2024-006 (secondary, as above); verifier re-ran boundaries (v1.out) | OK |
| SSS EC (employer-paid) | ₱10 if MSC < 15,000; ₱30 if ≥ 15,000 | Same | Secondary (GT / KPMG, as above) | OK |
| SSS MPF portion (MSC above ₱20,000) | (MSC − 20,000) × 15% | Same | RA 11199 Sec 4(a); SSS 2025 schedule (secondary) | OK |
| SSS contribution base for employees | Basic salary only | All actual remuneration (incl. regular allowances, commissions, OT, COLA), MSC capped at ₱35,000 | RA 11199 Sec 8(f); IRR https://www.lawphil.net/statutes/repacts/ra2019/irr_11199_2019.html | **WRONG** |
| SSS self-employed: 15% of MSC plus EC | ₱760 at MSC 5,000 | ₱760 (₱750 + ₱10 EC); voluntary members ₱750 | Secondary: https://www.grantthornton.com.ph/insights/articles-and-updates1/tax-notes/sss-implements-revised-contribution-rates-for-2025/ | OK |
| Self-employed SSS / PhilHealth base | Gross sales ÷ 12, labelled 'average monthly income' | Declared monthly (net) earnings / income | Secondary (Grant Thornton): https://www.grantthornton.com.ph/insights/articles-and-updates1/tax-notes/sss-clarifies-definition-of-earnings-declared-for-contributions-of-self-employed-members/ (auditor's extract; not reopened by verifier) | **WRONG** |
| PhilHealth premium CY2026 | 5% of basic salary, floor ₱10,000, ceiling ₱100,000 (₱500 to ₱5,000), split 50/50 | Same | PhilHealth Advisory 2026-0042 https://www.philhealth.gov.ph/advisories/2026/PA2026-0042.pdf ; PA2025-0002 https://www.philhealth.gov.ph/advisories/2025/PA2025-0002.pdf (auditor's search extracts) | OK |
| PhilHealth odd-centavo split | Each half rounded separately: total 1 centavo over the premium for most odd salaries, 1 under for some (float error) | Not found | No PhilHealth rounding rule found. Verifier could not reopen it (WebSearch budget exhausted; WebFetch/curl egress-blocked for all source domains). | *UNVERIFIED* |
| Pag-IBIG rates and maximum fund salary | Employee 1% if ≤ ₱1,500 else 2%; employer 2%; fund salary cap ₱10,000 (max ₱200 + ₱200) | Same (from Feb 2024) | HDMF Circular 460 https://www.grantthornton.com.ph/contentassets/3696729c37164538add37945681d7d6f/circular-no.-460---guidelines-on-the-pag-ibig-funds-implementation-of-increase-in-the-mfs-effective-february-2024-1.pdf | OK |
| Pag-IBIG self-employed pays both shares (max ₱400) | 4%, capped at ₱400 | Not confirmed | Circular 460 extract says only 'same rates apply'. Verifier could not reopen it (WebSearch budget exhausted; WebFetch/curl egress-blocked for all source domains). | *UNVERIFIED* |
| RCIT rates | 25%; 20% if net taxable income ≤ ₱5M AND total assets (excl. land) ≤ ₱100M | Same | RA 11534 Sec 27(A) https://lawphil.net/statutes/repacts/ra2021/ra_11534_2021.html ; RR 5-2021 https://bir-cdn.bir.gov.ph/local/pdf/RR%20No.%205-2021.pdf | OK |
| MCIT rate for 2026 | 2% of gross income | 2% (since Jul 1, 2023) | RMC 69-2023 https://bir-cdn.bir.gov.ph/local/pdf/RMC%20No.%2069-2023%20v2.pdf | OK |
| MCIT transitional rates | Engine applies 2% to every year (UI cannot currently select those years) | 1% Jul 1, 2020 to Jun 30, 2023; calendar 2023 blended 1.5% (monthly proration) | RA 11534; RMC 36-2024 https://bir-cdn.bir.gov.ph/BIR/pdf/RMC%20No.%2036-2024-Digest.pdf | **WRONG** |
| MCIT start: 4th taxable year after the year of BIR registration | taxYear ≥ registrationYear + 4, with taxYear = device's calendar year and registrationYear asked as 'Year operations began' | Count the taxable year being filed (including fiscal years) from the year of BIR registration | RR 9-98 https://lawphil.net/administ/bir/rr/rr1998.html | **WRONG** |
| Excess MCIT carry-forward | Stated as 3 years in text; not computed | Credit against RCIT for the next 3 taxable years | NIRC 27(E)(2); RR 9-98 | OK |
| Quarterly MCIT (1702Q) computed cumulatively | Not computed; 1702Q card lists RCIT only | Cumulative quarterly MCIT vs RCIT | RR 12-2007 https://bir-cdn.bir.gov.ph/BIR/pdf/37123rr%2012-2007.pdf | **WRONG** |
| Annual corporate payable = tax due less quarterly payments, prior-year credits and CWT | 'Income tax still payable' = tax due less 2307s only | Tax due less prior-year excess credits, 1702Q payments and creditable withholding | NIRC Secs 75-77 (RA 8424 as amended) https://lawphil.net/statutes/repacts/ra1997/ra_8424_1997.html ; BIR Form 1702-RT (Jan 2018) | **WRONG** |
| Corporate OSD | 40% of gross income (rulebook only) | 40% of gross income (sales less cost of sales) | RR 16-2008 https://bir-cdn.bir.gov.ph/BIR/pdf/43181rr%2016-2008.pdf | OK |
| Percentage tax for non-VAT corporations | 3% | 3% from Jul 1, 2023 (1% Jul 2020 to Jun 2023) | RA 11534 Sec 116 (lawphil); see TB-05 in the business-tax area | OK |
| Corporate quarterly returns 60 days after Q1-Q3; annual return 15th day of 4th month | Same | Not opened | Resolved by the completeness pass against the deadlines area (NIRC Secs 75, 77(B)) | OK |
| IAET repealed for taxable years ending after Apr 11, 2021 | Same | Same | RR 5-2021 (secondary: https://kpmg.com/ph/en/home/insights/2021/04/special-intax-april-2021-issue1-volume7.html) | OK |
| EWT professional fees, individuals | 5% if gross ≤ ₱3M with sworn declaration; 10% otherwise | Same | RR 11-2018 https://bir-cdn.bir.gov.ph/local/pdf/RR%20No.%2011-2018.pdf (search extract) | OK |
| EWT professional fees, juridical persons | 10% if ≤ ₱720,000; 15% otherwise | Same | RR 11-2018 (search extract) | OK |
| Broker and agent commissions follow professional-fee rates | Same | Same since RR 11-2018 | Secondary: https://roquelaw.com.ph/new-withholding-rules-on-payments-of-professional-talent-and-commission-fees/ | OK |
| GPP payments to partners | 10% if ≤ ₱720,000; 15% otherwise (ATC WI152/WI153) | Rates the same; ATC codes not confirmed | RR 2-98 Sec 2.57.2(H) (secondary: https://dev.lawyerly.ph/laws/50209) | OK |
| EWT rentals 5% / contractors 2% | 5% / 2% | 5% / 2% | RR 2-98 as amended (secondary extract only) | OK |
| Top Withholding Agents: goods 1% / services 2% | 1% / 2% | Same (re-stated in RR 24-2025) | https://www.grantthornton.com.ph/insights/articles-and-updates1/tax-notes/bir-revises-withholding-tax-rates-for-top-withholding-agents/ | OK |
| TWA 0.5% on purchases from manufacturers/direct importers of motor vehicles, pharmaceuticals, fuels | 0.5% from Oct 10, 2025 (RR 24-2025; RMC 79-2026) | Same | GT (as above); PwC Tax Alert 39 https://www.pwc.com/ph/en/tax/tax-publications/tax-alerts/2026/tax-alert-39.html | OK |
| E-marketplace / digital-payment platform withholding on seller remittances | 0.5% of gross remittances (RR 5-2025), replacing 1% of half (RR 16-2023); ₱500k threshold | Same; RR 5-2025 effective Mar 14, 2025 | RR 16-2023 https://bir-cdn.bir.gov.ph/BIR/pdf/RR%2016-2023.pdf ; RR 5-2025 https://bir-cdn.bir.gov.ph/BIR/pdf/RR%205-2025.pdf ; EY https://www.ey.com/content/dam/ey-unified-site/ey-com/en-ph/technical/sgv-tax-bulletin/documents/ey-ph-trb-mar-2025.pdf | OK |
| Credit-card company payments to merchants | 0.5% of gross | Same (RR 5-2025) | As above | OK |
| Lone payor ≤ ₱250,000 exempt by sworn declaration | Stated | Same | RR 11-2018 (secondary, roquelaw) | OK |
| Fringe benefits tax | 35%; gross-up divisor 65%; 1603Q due last day of the month after each quarter | Same | RA 10963; secondary https://kpmg.com/ph/en/home/insights/2018/04/special-intax-lets-get-on-the-train-tax-alert-15.html | OK |
| NIRC Sec 34(K) repealed by EOPT (expense deductible even if withholding not remitted, from TY2024) | Stated | Same (RR 4-2024; RMC 60-2024) | https://www.pwc.com/ph/en/tax/tax-publications/tax-alerts/2024/tax-alert-25.html | OK |
| 1601-C due date | 10th of the following month (Jan 15 for December); eFPS staggered dates mentioned only on the forms card | Applies to manual/eBIRForms filers; eFPS staggered 11th-15th not checked | Resolved by the completeness pass: 10th of the following month, December on Jan 15 for non-eFPS; eFPS staggered dates are later, so the app is on the safe side | OK |
| Rounding on annual income tax returns (1700/1701/1702) | Shown with centavos | Whole pesos (49 centavos drop / 50 round up) | BIR Form 1701 Jan 2018 https://bir-cdn.bir.gov.ph/local/pdf/1701%20Jan%202018%20final%20with%20rates.pdf (auditor's search extract; the individual-area verifier relied on the same rule, TI-07) | **WRONG** |
| Rounding convention on 1601-C / 2316 | Unrounded floats, display-rounded | Not confirmed | 1601-C Jan 2018 form identified but not openable. Verifier could not reopen it (WebSearch budget exhausted; WebFetch/curl egress-blocked for all source domains). | *UNVERIFIED* |

### 2.5 Other posted rules and citations

| Rule | App value | Correct value | Source | Status |
|---|---|---|---|---|
| Senate counterpart bill SB 2338 (₱350k from Jan 1, 2027) | Pending | Filed by Sen. Sotto; pending (auditor's source) | https://www.gmanetwork.com/news/money/economy/996468/erwin-tulfo-tito-sotto-file-bills-on-system-loss-tax-relief-after-sona-2026/story/ | OK |
| SB 1685 (₱500k exemption) | Pending | Could not confirm the bill number or contents | auditor's search returned nothing; not re-fetched by the verifier: WebFetch is egress-blocked for these hosts and the shared web-search budget was exhausted | *UNVERIFIED* |
| 8% option as described in the blog post | 'a flat 8% on your gross receipts above ₱250,000, and nothing else' (no mention of mixed income or the ₱3M/non-VAT condition) | Mixed-income earners: 8% on all business gross, no ₱250k reduction; option only for non-VAT taxpayers with gross ≤ ₱3M | RR 8-2018; RMC 50-2018; the app's own income-tax.json:16-26 (allowanceForMixedIncome 0, grossCeiling 3,000,000) | **WRONG** |
| 8% election made on the 1701Q (citation RMC 32-2018) | RMC 32-2018 | RMC 32-2018 (Apr 2018) circularized the revised 1701Q on which the election is made | https://kpmg.com/ph/en/home/insights/2018/05/special-intax-lets-get-on-the-train-tax-alert-16.html | OK |
| Form 1701A only for income purely from business or profession (8% or OSD) | Forms page, calendar and estimator: mixed income files 1701. Profile wizard: VAT-registered mixed earner on OSD 'files 1701A' | 1701 for mixed income (RMC 17-2019; the 1701A is titled for individuals earning income PURELY from business/profession) | https://home.kpmg.com/content/dam/kpmg/ph/pdf/InTAX/2019/RMC%20No%2017-2019.pdf | **WRONG** |
| Form 1701-MS (micro and small individuals; RMC 34-2025, then RMC 20-2026; in eBIRForms 7.9.6) | As stated | Same (auditor's sources) | https://assets.kpmg.com/content/dam/kpmg/ph/pdf/InTAX/2025/RMC_2025-034_GudielinesforFilingAITRsfor2024.pdf ; https://kpmg.com/ph/en/insights/2025/04/special-intax-april-2025-issue-1-volume-1.html | OK |
| CY2025 annual ITR guidelines (RMC 20-2026) and extension to May 15, 2026 for filing, payment and attachments (RMC 30-2026, EO 110) | As stated in the obligations and attachments notes | Same (auditor's sources) | https://bir-cdn.bir.gov.ph/BIR/pdf/RMC%20No.%2030-2026.pdf ; https://www.grantthornton.com.ph/technical-alerts/tax-alert/2026/annual-income-tax-return-filing-and-payment-guidelines-for-the-calendar-year-2025/ | OK |
| RMC 46-2026 grace period to May 25, 2026 for eAFS issues | As stated | RMC 46-2026 exists (PwC Tax Alert 26); details not confirmed | https://www.pwc.com/ph/en/tax/tax-publications/tax-alerts/2026/tax-alert-26.html (not re-fetched by the verifier: WebFetch is egress-blocked for these hosts and the shared web-search budget was exhausted) | *UNVERIFIED* |
| Abolition of the ₱500 annual registration fee (EOPT): citation | RMC 15-2024 | RMC 14-2024 (Jan 2024), with the BIR advisory of January 2024. RMC 15-2024 is reported to concern joint-venture CWT on Form 0605 | https://www.reyestacandong.com/bir-issuances-rmc-14-2024/ ; https://kpmg.com/ph/en/home/insights/2024/01/special-intax-january-2024-issue-1-volume-9.html (verifier's own knowledge agrees on RMC 14-2024; pages not re-fetched by the verifier: WebFetch is … | **WRONG** |
| ₱30 documentary stamp tax on the Certificate of Registration still due after EOPT | Only ₱30 DST on the COR remains | Same (auditor's sources) | https://www.grantthornton.com.ph/insights/articles-and-updates1/tax-notes/eopt-is-here-updates-on-the-preservation-of-book-of-accounts-and-changes-in-taxpayer-registration/ ; https://pwc.com/ph/en/tax/tax-publications/tax-alerts/2024/tax-alert-27.html | OK |
| Venue for a 1905 RDO transfer (business taxpayers) | Checklist: any RDO. Forms page: current RDO (RMC 91-2024) | Per RMC 91-2024; auditor's sources conflict | https://bir-cdn.bir.gov.ph/BIR/pdf/RMC%20No.%2091-2024%20Digest.pdf (not re-fetched by the verifier: WebFetch is egress-blocked for these hosts and the shared web-search budget was exhausted) | *UNVERIFIED* |
| Mandatory e-invoicing deadline and coverage | Dec 31, 2026; CAS/POS users (plus e-commerce above micro and large taxpayers); cites RR 11-2025 only | Dec 31, 2026 (RR 11-2025 as amended by RR 26-2025). RMC 98-2026 (Sept 22, 2026) reportedly sets coverage and operating rules | https://bir-cdn.bir.gov.ph/BIR/pdf/PR101SEP2326.pdf ; https://www.fiscal-requirements.com/news/4585 (not re-fetched by the verifier: WebFetch is egress-blocked for these hosts and the shared web-search budget was exhausted) | OK |
| Pag-IBIG employer remittance windows by first letter of name (HDMF Circular 275) | A-D 10th-14th, E-L 15th-19th, M-Q 20th-24th, R-Z 25th-end; 10th shown | Same (auditor's source) | https://batasnatin.com/news/pagibig-hdmf-contribution-employer-remittance | OK |
| Form label for self-employed Pag-IBIG savings | 'Pag-IBIG MP2/RTPO' | MP2 is the voluntary Modified Pag-IBIG II savings program; regular savings use the regular contribution channel (general knowledge; no primary source fetched) | no primary source fetched (not re-fetched by the verifier: WebFetch is egress-blocked for these hosts and the shared web-search budget was exhausted); also flagged by the deadlines verifier | *UNVERIFIED* |
| Alphalist module version (RMC 15-2025, v7.4; no v7.5) | v7.4 | v7.4 (no v7.5 found by the auditor) | https://batasnatin.com/laws/rmc-no-15-2025-availability-of-the-alphalist-data-entry-and-validation-module | OK |
| eAFS file-size limit | 4.8 GB per file (shown on the Forms page) | Sources conflict (4.8 GB vs 4.8/10 MB) | https://help.juan.tax/en/articles/174-how-to-use-eafs-of-the-bir-for-compliance (not re-fetched by the verifier: WebFetch is egress-blocked for these hosts and the shared web-search budget was exhausted) | *UNVERIFIED* |
| Monthly withholding example in the References note (₱50,000 taxable) | ₱5,208.40 | ₱1,875 + 20% x ₱16,667 = ₱5,208.40 | RR 11-2018 Annex E (revised table effective 2023); verifier exact arithmetic | OK |

### 2.6 Gap checks

| Rule | App value | Correct value | Source | Status |
|---|---|---|---|---|
| 8% option for mixed-income earners: 8% of all business gross sales, no ₱250,000 reduction (Tools projector) | Projector subtracts ₱250,000 for every profile | No reduction for mixed income (₱250,000 reduction only for purely self-employed) | NIRC Sec 24(A)(2)(c) as amended by RA 10963; RR 8-2018 (verified OK in the tax-individual table) | **WRONG** |
| 8% option not available to VAT-registered individuals or to corporations (Tools projector) | Projector shows an 8% tax and monthly set-aside for VAT-registered and corporate profiles, no warning below ₱3M | No 8% figure; graduated rates (individuals) or RCIT/MCIT (corporations) apply | NIRC Sec 24(A)(2)(b); RR 8-2018; RMO 23-2018 (verified OK in the tax-individual table) | **WRONG** |
| Community tax (cedula): individuals regularly employed on wage/salary for 30+ consecutive working days are liable; due by the last day of February | Reminder only for business profiles (individual, mixed, corporation) | Also employees (RA 7160 Sec 157), per the reviewer's reading of the Code | RA 7160 Secs 157, 161 https://lawphil.net/statutes/repacts/ra1991/ra_7160_1991.html (not re-fetched: egress blocked) | *UNVERIFIED* |

## 3. Test worksheets

Each case can be redone with a calculator. "Correct result" applies the law in force for the period; "App result" is what the app (engine or browser) produced on Oct 7, 2026. ✔ = matches, ✘ = differs (see the linked finding). These cases become the automated tests in Phase 4.

### 3.1 Individual income tax

#### TI:WS-01: Zero-band edge (TY2023+ table)  (✔ matches; see M03)
- **Inputs:** Taxable income ₱250,000.00; ₱250,000.01; ₱250,001
- **Steps:**
  1. Legal basis: NIRC Sec 24(A)(2)(a) as amended by TRAIN, table effective Jan 1, 2023.
  2. ₱250,000.00 is 'not over ₱250,000' -> tax ₱0.
  3. ₱250,000.01: excess over ₱250,000 = 0.01 x 15% = ₱0.0015 -> ₱0.00 (₱0 on the form).
  4. ₱250,001: excess 1 x 15% = ₱0.15 (₱0 on the form).
- **Correct result:** ₱0 / ₱0.0015 / ₱0.15
- **App result:** gradTax: 0 / 0.001500000001396984 / 0.15 (displays ₱0.00 / ₱0.00 / ₱0.15)

#### TI:WS-02: ₱400,000 bracket edge  (✔ matches)
- **Inputs:** Taxable income ₱400,000; ₱400,000.01
- **Steps:**
  1. ₱400,000: 15% x (400,000 - 250,000) = ₱22,500.
  2. ₱400,000.01: 22,500 + 20% x 0.01 = ₱22,500.002.
- **Correct result:** ₱22,500 / ₱22,500.002
- **App result:** 22500 / 22500.002

#### TI:WS-03: ₱800,000 bracket edge  (✔ matches)
- **Inputs:** Taxable income ₱800,000; ₱800,000.01
- **Steps:**
  1. ₱800,000: 22,500 + 20% x 400,000 = ₱102,500.
  2. ₱800,000.01: 102,500 + 25% x 0.01 = ₱102,500.0025.
- **Correct result:** ₱102,500 / ₱102,500.0025
- **App result:** 102500 / 102500.0025

#### TI:WS-04: ₱2,000,000 bracket edge  (✔ matches)
- **Inputs:** Taxable income ₱2,000,000; ₱2,000,000.01
- **Steps:**
  1. ₱2,000,000: 102,500 + 25% x 1,200,000 = ₱402,500.
  2. ₱2,000,000.01: 402,500 + 30% x 0.01 = ₱402,500.003.
- **Correct result:** ₱402,500 / ₱402,500.003
- **App result:** 402500 / 402500.003

#### TI:WS-05: ₱8,000,000 bracket edge  (✔ matches)
- **Inputs:** Taxable income ₱8,000,000; ₱8,000,000.01
- **Steps:**
  1. ₱8,000,000: 402,500 + 30% x 6,000,000 = ₱2,202,500.
  2. ₱8,000,000.01: 2,202,500 + 35% x 0.01 = ₱2,202,500.0035.
- **Correct result:** ₱2,202,500 / ₱2,202,500.0035
- **App result:** 2202500 / 2202500.0035

#### TI:WS-06: Loss and very large amounts  (✔ matches)
- **Inputs:** Taxable income -₱100,000; ₱1,000,000,000,000; ₱9,000,000,000,000,000
- **Steps:**
  1. Loss: no tax -> ₱0.
  2. ₱1e12: 2,202,500 + 35% x (1,000,000,000,000 - 8,000,000) = 2,202,500 + 349,997,200,000 = ₱349,999,402,500.
  3. ₱9e15: 2,202,500 + 35% x (9e15 - 8,000,000) = ₱3,149,999,999,402,500. (9e15 is just below 2^53 = 9,007,199,254,740,992, so whole pesos are still exact in the computer's number format; above that, results would lose precision.)
- **Correct result:** ₱0 / ₱349,999,402,500 / ₱3,149,999,999,402,500
- **App result:** 0 / 349999402500 / 3149999999402500

#### TI:WS-07: Pure self-employed, 8% best (TY2026)  (✔ matches; see H06)
- **Inputs:** Gross ₱1,200,000; itemized expenses ₱300,000; no 2307; not VAT
- **Steps:**
  1. 8% (Sec 24(A)(2)(b), RR 8-2018): (1,200,000 - 250,000) x 8% = ₱76,000; no percentage tax.
  2. OSD (Sec 34(L)): 40% x 1,200,000 = 480,000; net 720,000; tax 22,500 + 20% x 320,000 = ₱86,500; percentage tax 3% x 1,200,000 = ₱36,000; total ₱122,500.
  3. Itemized: net 900,000; tax 102,500 + 25% x 100,000 = ₱127,500 + ₱36,000 = ₱163,500.
  4. Cheapest: 8% at ₱76,000, saving ₱46,500. Form 1701A; payable before quarterly 1701Q payments ₱76,000.
- **Correct result:** 8% ₱76,000; OSD ₱122,500; itemized ₱163,500; best 8% saving ₱46,500
- **App result:** 8% 76,000; OSD 122,500 (86,500 + 36,000); itemized 163,500; best 8pct; savingsVsNext 46,500; preview 1701A 'Tax payable with the annual return ₱76,000' (no quarterly-payments input)

#### TI:WS-08: Pure self-employed, OSD best, with 2307 credits  (✘ differs; see C02)
- **Inputs:** Gross ₱420,000; expenses ₱0; 2307 credits ₱21,000 (5% EWT); not VAT
- **Steps:**
  1. 8%: (420,000 - 250,000) x 8% = ₱13,600.
  2. OSD: net 60% x 420,000 = 252,000; tax 15% x 2,000 = ₱300; percentage tax 3% x 420,000 = ₱12,600 (2551Q); total burden ₱12,900 -> cheapest, saves ₱700.
  3. Annual return 1701A: income tax ₱300 - 2307 credits ₱21,000 = overpayment ₱20,700.
  4. Percentage tax ₱12,600 is paid on the four 2551Q returns, not on the 1701A, and is not reduced by private-client 2307s.
- **Correct result:** Best OSD; 1701A overpayment ₱20,700; percentage tax ₱12,600 separately on 2551Q
- **App result:** Best OSD (12,900, saving 700); preview 'Overpayment (refund / carry-over) ₱8,100' (= 12,900 - 21,000)

#### TI:WS-09: Tie between 8% and OSD  (✔ matches; see L01)
- **Inputs:** Gross ₱400,000 (also ₱437,500, ₱437,501 and ₱400,001); no expenses
- **Steps:**
  1. ₱400,000: 8% = 150,000 x 8% = ₱12,000; OSD net 240,000 -> ₱0 tax + 3% PT ₱12,000 = ₱12,000. Exact tie.
  2. ₱437,500: 8% = 187,500 x 8% = ₱15,000; OSD net 262,500 -> 15% x 12,500 = 1,875 + PT 13,125 = ₱15,000. Exact tie.
  3. ₱437,501: 8% ₱15,000.08 vs OSD ₱15,000.12 -> 8% cheaper by ₱0.04.
  4. ₱400,001: 8% ₱12,000.08 vs OSD ₱12,000.03 -> OSD cheaper by ₱0.05.
- **Correct result:** Totals equal at ₱400,000 and ₱437,500 (should be presented as a tie); differences under ₱1 at ₱437,501 and ₱400,001 (no 'saving' clause)
- **App result:** Totals correct; banner at ₱400,000: '8% flat tax is the cheapest eligible option at ₱12,000.'; at ₱437,501: '... saving ₱0 versus the next best.'; at ₱400,001: 'Graduated + OSD (40%) ... saving ₱0'

#### TI:WS-10: Itemized best, credits exceed income tax  (✘ differs; see C02)
- **Inputs:** Gross ₱1,000,000; expenses ₱900,000; 2307 credits ₱100,000 (10% EWT); not VAT
- **Steps:**
  1. 8%: 750,000 x 8% = ₱60,000.
  2. OSD: net 600,000 -> 22,500 + 20% x 200,000 = 62,500 + PT 30,000 = ₱92,500.
  3. Itemized: net 100,000 -> ₱0 tax + PT 30,000 = ₱30,000 -> cheapest.
  4. Annual return 1701: income tax ₱0 - credits ₱100,000 = overpayment ₱100,000. PT ₱30,000 paid on 2551Q.
- **Correct result:** Best itemized; 1701 overpayment ₱100,000; PT ₱30,000 on 2551Q
- **App result:** Best itemized (30,000); preview 'Overpayment (refund / carry-over) ₱70,000'

#### TI:WS-11: Itemized loss (pure self-employed)  (✘ differs; see C02, M04)
- **Inputs:** Gross ₱500,000; expenses ₱700,000; no credits
- **Steps:**
  1. Itemized net = 500,000 - 700,000 = (₱200,000) loss -> taxable ₱0 -> income tax ₱0.
  2. Loss of ₱200,000 becomes NOLCO usable in the next 3 years if itemizing (Sec 34(D)(3)).
  3. PT 3% x 500,000 = ₱15,000 (2551Q). 8% = ₱20,000; OSD = 7,500 + 15,000 = ₱22,500. Cheapest: itemized ₱15,000.
  4. Annual return 1701 payable: ₱0.
- **Correct result:** Income tax ₱0; NOLCO ₱200,000 disclosed; 1701 payable ₱0; PT ₱15,000 on 2551Q
- **App result:** Income tax 0; 'Net taxable business income ₱0.00' with no NOLCO; preview 'Tax payable with the annual return ₱15,000'

#### TI:WS-12: Mixed income, 8% best  (✔ matches)
- **Inputs:** Taxable compensation ₱600,000 (withheld ₱62,500); business gross ₱400,000; expenses ₱100,000
- **Steps:**
  1. Compensation at graduated rates: 22,500 + 20% x 200,000 = ₱62,500.
  2. 8% on business, no ₱250k reduction (RR 8-2018): 400,000 x 8% = ₱32,000. Total ₱94,500.
  3. OSD: 600,000 + 240,000 = 840,000 -> 102,500 + 25% x 40,000 = 112,500 + PT 12,000 = ₱124,500.
  4. Itemized: 600,000 + 300,000 = 900,000 -> 127,500 + 12,000 = ₱139,500.
  5. Best 8%; Form 1701 payable 94,500 - 62,500 = ₱32,000 (before 1701Q payments).
- **Correct result:** 8% ₱94,500 (best); OSD ₱124,500; itemized ₱139,500; payable ₱32,000
- **App result:** 8% 94,500; OSD 124,500; itemized 139,500; best 8pct; netPayable 32,000

#### TI:WS-13: Mixed income, OSD best, with 2307  (✘ differs; see C02)
- **Inputs:** Taxable compensation ₱150,000 (withheld ₱0); business gross ₱300,000; expenses ₱100,000; 2307 ₱15,000
- **Steps:**
  1. 8%: compensation tax ₱0 (under ₱250k) + 300,000 x 8% = ₱24,000.
  2. OSD: 150,000 + 180,000 = 330,000 -> 15% x 80,000 = ₱12,000 + PT ₱9,000 = ₱21,000 (best, saves ₱3,000).
  3. Itemized: 150,000 + 200,000 = 350,000 -> 15,000 + 9,000 = ₱24,000.
  4. Form 1701: income tax 12,000 - 2307 15,000 = overpayment ₱3,000. PT ₱9,000 on 2551Q.
- **Correct result:** Best OSD; 1701 overpayment ₱3,000; PT ₱9,000 separately
- **App result:** Best OSD (21,000); preview 'Tax payable with the annual return ₱6,000'

#### TI:WS-14: Mixed income with business loss  (✘ differs; see C02, M04)
- **Inputs:** Taxable compensation ₱600,000 (withheld ₱62,500); business gross ₱300,000; expenses ₱500,000
- **Steps:**
  1. Itemized business result (₱200,000) loss; assumed not to reduce compensation (rule UNVERIFIED) -> taxable ₱600,000 -> ₱62,500; PT ₱9,000; total ₱71,500 (best).
  2. 8%: 62,500 + 24,000 = ₱86,500. OSD: 600,000 + 180,000 = 780,000 -> 22,500 + 20% x 380,000 = 98,500 + 9,000 = ₱107,500.
  3. Form 1701: 62,500 - 62,500 = ₱0 payable; PT ₱9,000 on 2551Q.
  4. If a business loss could offset compensation, tax would be on ₱400,000 = ₱22,500 (not adopted; see open question).
- **Correct result:** Income tax ₱62,500; 1701 payable ₱0; PT ₱9,000 separately
- **App result:** Income tax 62,500 (best itemized 71,500); preview 'Tax payable with the annual return ₱9,000'

#### TI:WS-15: Exactly ₱3,000,000 gross  (✔ matches)
- **Inputs:** Gross ₱3,000,000; no expenses; not VAT
- **Steps:**
  1. 8% allowed ('not exceeding' ₱3M): (3,000,000 - 250,000) x 8% = ₱220,000.
  2. OSD: net 1,800,000 -> 102,500 + 25% x 1,000,000 = 352,500 + PT 90,000 = ₱442,500.
  3. Itemized (no expenses): 3,000,000 -> 402,500 + 30% x 1,000,000 = 702,500 + 90,000 = ₱792,500.
- **Correct result:** 8% eligible ₱220,000 (best)
- **App result:** 8% eligible 220,000; OSD 442,500; itemized 792,500; best 8pct

#### TI:WS-16: Just above ₱3,000,000  (✘ differs; see H04, C01)
- **Inputs:** Gross ₱3,000,000.01 (engine) and ₱3,000,001 (UI); assume threshold crossed in December; not VAT-registered
- **Steps:**
  1. 8% not available; whole year at graduated rates (RR 8-2018).
  2. OSD at 3,000,001: net 1,800,000.60 -> 352,500 + 25% x 0.60 = ₱352,500.15 (form lines: OSD ₱1,200,000, net ₱1,800,001, tax ₱352,500.25 -> ₱352,500).
  3. Percentage tax 3% applies to January-November sales (until VAT liability), VAT after (RMO 23-2018); amount depends on monthly sales, which the app does not ask for.
  4. UI: typing '3,000,000.01' gives ₱300,000,001 (TI-05).
- **Correct result:** Income tax ₱352,500; PT on pre-VAT sales + VAT after; 8% N/A
- **App result:** Income tax 352,500.0015 / 352,500.15 (card ₱352,500); business tax 'VAT 12%' for the whole year, PT ₱0; warning says 3% percentage tax no longer applies

#### TI:WS-17: TY2022 case shows the period issue  (✘ differs; see M01)
- **Inputs:** Taxable year 2022; gross ₱500,000; no expenses; not VAT
- **Steps:**
  1. 8%: 250,000 x 8% = ₱20,000.
  2. OSD with 2018-2022 table: net 300,000 -> 20% x 50,000 = ₱10,000; PT at 1% (RA 11534, Jul 2020-Jun 2023) = ₱5,000; total ₱15,000.
  3. Itemized: 500,000 -> 30,000 + 25% x 100,000 = 55,000 + 5,000 = ₱60,000.
  4. Cheapest: OSD ₱15,000 (saves ₱5,000 vs 8%).
- **Correct result:** OSD ₱15,000 best; 8% ₱20,000; itemized ₱60,000
- **App result:** No year input; 8% 20,000; OSD 22,500 (7,500 + 15,000); itemized 57,500; recommends 8%

#### TI:WS-18: TY2023 split percentage-tax rate  (✘ differs; see M01)
- **Inputs:** Taxable year 2023; gross ₱500,000 earned evenly (₱125,000 per quarter)
- **Steps:**
  1. PT: Jan-Jun 250,000 x 1% = 2,500; Jul-Dec 250,000 x 3% = 7,500; total ₱10,000 (RA 11534; RMC 69-2023).
  2. OSD: net 300,000 -> 2023 table 15% x 50,000 = ₱7,500; total ₱17,500.
  3. 8%: ₱20,000.
  4. Cheapest: OSD ₱17,500.
- **Correct result:** OSD ₱17,500 best
- **App result:** OSD 22,500; 8% 20,000; recommends 8%

#### TI:WS-19: 2018-2022 graduated table values  (✘ differs; see M01)
- **Inputs:** TY2022 taxable income ₱300,000; ₱1,000,000; ₱2,000,001
- **Steps:**
  1. ₱300,000: 20% x 50,000 = ₱10,000.
  2. ₱1,000,000: 130,000 + 30% x 200,000 = ₱190,000.
  3. ₱2,000,001: 490,000 + 32% x 1 = ₱490,000.32.
- **Correct result:** ₱10,000 / ₱190,000 / ₱490,000.32
- **App result:** 7,500 / 152,500 / 402,500.30 (2023 table)

#### TI:WS-20: Amount-field parsing  (✘ differs; see C01)
- **Inputs:** '1,234.56'; '480000.75'; '3,000,000.01'; '0.5'; '-500'; '1e6'; 'abc'; ''; '₱ 1,000'; '4,800.00'
- **Steps:**
  1. A correct parser keeps the decimal point: 1,234.56; 480,000.75; 3,000,000.01; 0.50; 4,800.00.
  2. '-500' and '1e6' and 'abc' should be rejected with a message; '' -> 0; '₱ 1,000' -> 1,000.
- **Correct result:** 1,234.56 / 480,000.75 / 3,000,000.01 / 0.50 / reject / reject / reject / 0 / 1,000 / 4,800.00
- **App result:** 123,456 / 48,000,075 / 300,000,001 / 5 / 500 / 16 / 0 / 0 / 1,000 / 480,000 (last one from the bugs-area browser run)

#### TI:WS-21: BIR whole-peso rounding per line  (✘ differs; see M03)
- **Inputs:** Pure SE, OSD option: gross ₱416,761; and gross ₱416,684 for the card check
- **Steps:**
  1. Form rule: no centavos; 49 or less drop, 50 or more round up.
  2. 416,761: OSD 40% = 166,704.40 -> ₱166,704; net 416,761 - 166,704 = ₱250,057; tax 15% x 57 = 8.55 -> ₱9.
  3. 416,684: OSD 40% = 166,673.60 -> ₱166,674; net ₱250,010; tax 15% x 10 = 1.50 -> ₱2. PT 3% x 416,684 = 12,500.52 -> ₱12,501. Sum of rounded lines ₱12,503.
- **Correct result:** Income tax ₱9 (416,761); card parts and total consistent at 416,684: ₱2 + ₱12,501 = ₱12,503
- **App result:** 416,761: income tax 8.49 (breakdown ₱8.49, card ₱8). 416,684: card shows Income tax ₱2, Business tax ₱12,501, Total ₱12,502

#### TI:WS-22: Compensation side (employee.js) annual tax  (✔ matches; see M05)
- **Inputs:** Monthly basic ₱50,000; allowances ₱0; 13th month and bonuses ₱100,000; contributions from engine: SSS 1,750 + PhilHealth 1,250 + Pag-IBIG 200 = ₱3,200/month (contribution amounts belong to another audit area)
- **Steps:**
  1. Monthly taxable 50,000 - 3,200 = ₱46,800; x 12 = ₱561,600.
  2. Bonus excess over ₱90,000 cap (Sec 32(B)(7)(e)): 100,000 - 90,000 = ₱10,000.
  3. Annual taxable ₱571,600 -> 22,500 + 20% x 171,600 = ₱56,820.
  4. Monthly withholding (2023 table): 1,875 + 20% x (46,800 - 33,333) = ₱4,568.40.
  5. Year-end difference: 56,820 - 12 x 4,568.40 = ₱1,999.20.
- **Correct result:** Annual tax ₱56,820; monthly withholding ₱4,568.40; year-end difference ₱1,999.20
- **App result:** annualTaxable 571,600; annualTax 56,820; monthlyWithholding 4,568.4; yearEndDifference 1,999.2000000000044 (displays ₱1,999.20)

#### TI:WS-23: [verifier] Half-peso total rounded down by floating-point error  (✘ differs; see M03, C02)
- **Inputs:** Pure SE; gross ₱419,165; itemized expenses ₱167,788; no credits; not VAT
- **Steps:**
  1. 8%: (419,165 - 250,000) x 8% = ₱13,533.20.
  2. OSD: net 60% x 419,165 = 251,499; tax 15% x 1,499 = ₱224.85; PT 3% x 419,165 = ₱12,574.95; total ₱12,799.80.
  3. Itemized: net 419,165 - 167,788 = 251,377; tax 15% x 1,377 = ₱206.55; PT ₱12,574.95; total ₱12,781.50 -> cheapest.
  4. Whole pesos, half-up: total ₱12,781.50 -> ₱12,782 (per-line: income tax ₱207 + PT ₱12,575 = ₱12,782). 1701 income tax due ₱207; PT paid separately (TI-01).
- **Correct result:** Best itemized; displayed total ₱12,782
- **App result:** Best itemized; raw total 12781.499999999998; banner, card and preview payable all show ₱12,781

### 3.2 Penalties, percentage tax and VAT

#### TB:W01: ₱10,000 tax, 30 days late, Medium/Large, 2026 violation  (✔ matches)
- **Inputs:** Basic tax ₱10,000; days late 30; Medium/Large
- **Steps:**
  1. 1. Surcharge (NIRC Sec 248(A)) = 10,000 × 25% = 2,500.00
  2. 2. Interest (Sec 249(A) as amended by TRAIN, 12% simple) = 10,000 × 12% × 30/365 = 98.6301… → 98.63
  3. 3. Compromise (RMO 7-2015 Annex A, tier 5,001–10,000) = 3,000.00
  4. 4. Total = 10,000 + 2,500 + 98.63 + 3,000 = 15,598.63
- **Correct result:** Surcharge 2,500.00; interest 98.63; compromise 3,000.00; total 15,598.63
- **App result:** ₱2,500.00 / ₱98.63 / ₱3,000.00 / total ₱15,598.63 (verifier re-run)

#### TB:W02: ₱10,000 tax, 30 days late, Micro/Small, 2026 violation  (✘ differs; see C03)
- **Inputs:** Basic tax ₱10,000; days late 30; Micro/Small; due date after Jan 22, 2024
- **Steps:**
  1. 1. Surcharge (EOPT / RR 6-2024) = 10,000 × 10% = 1,000.00
  2. 2. Interest at 50% of 12% = 6%: 10,000 × 6% × 30/365 = 49.3150… → 49.32
  3. 3. Compromise: late filing is a Sec 255 violation; the EOPT 50% cut covers only Secs 113/237/238, so the full Annex A tier 5,001–10,000 applies = 3,000.00
  4. 4. Total = 10,000 + 1,000 + 49.32 + 3,000 = 14,049.32
- **Correct result:** 1,000.00 / 49.32 / 3,000.00 / total 14,049.32
- **App result:** ₱1,000.00 / ₱49.32 / ₱1,500.00 / total ₱12,549.32 (verifier re-run)

#### TB:W03: ₱10,000 tax, 30 days late, willful neglect, Micro (engine only; the UI cannot select willful)  (✘ differs; see C03, L04)
- **Inputs:** Basic tax ₱10,000; 30 days; microSmall true; willful true
- **Steps:**
  1. 1. Surcharge (Sec 248(B)) = 10,000 × 50% = 5,000.00 (not reduced for micro/small per RR 6-2024)
  2. 2. Interest 10,000 × 6% × 30/365 = 49.32
  3. 3. Compromise: no 50% cut for Sec 255. If the schedule applies (no fraud), tier 5,001–10,000 = 3,000; if fraud is involved, the RMO 7-2015 schedule does not apply
  4. 4. Total (schedule case) = 10,000 + 5,000 + 49.32 + 3,000 = 18,049.32
- **Correct result:** 5,000.00 / 49.32 / 3,000.00 (or not on the schedule) / 18,049.32
- **App result:** Engine: ₱5,000.00 / ₱49.32 / ₱1,500.00 / total ₱16,549.32; UI cannot produce this case (verifier re-run)

#### TB:W04: ₱0 tax due (nil return) filed 30 days late, Medium/Large  (✔ matches)
- **Inputs:** Basic tax ₱0; 30 days; Medium/Large
- **Steps:**
  1. 1. Surcharge = 0 × 25% = 0.00
  2. 2. Interest = 0 × 12% × 30/365 = 0.00
  3. 3. Compromise: ₱0 falls in Annex A tier '5,000 and below' = 1,000.00
  4. 4. Total = 1,000.00
- **Correct result:** 0.00 / 0.00 / 1,000.00 / 1,000.00
- **App result:** ₱0.00 / ₱0.00 / ₱1,000.00 / total ₱1,000.00 (verifier re-run)

#### TB:W05: ₱0 tax due filed 30 days late, Micro/Small  (✘ differs; see C03)
- **Inputs:** Basic tax ₱0; 30 days; Micro/Small
- **Steps:**
  1. 1. Surcharge 10% × 0 = 0.00
  2. 2. Interest 6% × 0 = 0.00
  3. 3. Compromise: Sec 255 tier '5,000 and below' = 1,000.00 (no EOPT halving)
  4. 4. Total = 1,000.00
- **Correct result:** 1,000.00
- **App result:** ₱0.00 / ₱0.00 / ₱500.00 / total ₱500.00 (verifier re-run)

#### TB:W06: Compromise tier edges, Medium/Large  (✔ matches)
- **Inputs:** Tax due at 0, 1, 5,000, 5,001, 10,000, 10,001, 20,000, 20,001, 50,000, 50,001, 100,000, 100,001, 500,000, 500,001, 1,000,000, 1,000,001, 5,000,000, 5,000,001
- **Steps:**
  1. 1. Apply RMO 7-2015 Annex A (Sec 255): up to 5,000 → 1,000; 5,001–10,000 → 3,000; 10,001–20,000 → 5,000; 20,001–50,000 → 10,000; 50,001–100,000 → 15,000; 100,001–500,000 → 20,000; 500,001–1,000,000 → 30,000; 1,000,001–5,000,000 → 40,000; over 5,000,000 → 50,000
  2. 2. Each edge value belongs to the lower tier (the brackets read 'not over')
- **Correct result:** 1,000; 1,000; 1,000; 3,000; 3,000; 5,000; 5,000; 10,000; 10,000; 15,000; 15,000; 20,000; 20,000; 30,000; 30,000; 40,000; 40,000; 50,000
- **App result:** compromiseFor(): 1000,1000,1000,3000,3000,5000,5000,10000,10000,15000,15000,20000,20000,30000,30000,40000,40000,50000 (verifier re-run)

#### TB:W07: Compromise tier edges, Micro/Small  (✘ differs; see C03)
- **Inputs:** Same 18 tax-due values, Micro/Small
- **Steps:**
  1. 1. Same Annex A tiers as W06; EOPT / RR 6-2024 halve the compromise only for Sec 113/237/238 violations, not Sec 255
- **Correct result:** Same as W06 (1,000 … 50,000)
- **App result:** 500,500,500,1500,1500,2500,2500,5000,5000,7500,7500,10000,10000,15000,15000,20000,20000,25000 (verifier re-run)

#### TB:W08: ₱50,000 tax, 60 days late, Medium/Large (existing unit-test case)  (✔ matches)
- **Inputs:** ₱50,000; 60 days; Medium/Large
- **Steps:**
  1. 1. Surcharge 25% = 12,500.00
  2. 2. Interest 50,000 × 12% × 60/365 = 986.3013… → 986.30
  3. 3. Compromise tier 20,001–50,000 = 10,000.00
  4. 4. Total = 50,000 + 12,500 + 986.30 + 10,000 = 73,486.30
- **Correct result:** 73,486.30
- **App result:** ₱12,500.00 / ₱986.30 / ₱10,000.00 / total ₱73,486.30 (verifier re-run)

#### TB:W09: ₱50,000 tax, 60 days late, Micro/Small (the Tools page default)  (✘ differs; see C03)
- **Inputs:** ₱50,000; 60 days; Micro/Small (default toggle and default inputs)
- **Steps:**
  1. 1. Surcharge 10% = 5,000.00
  2. 2. Interest 50,000 × 6% × 60/365 = 493.1506… → 493.15
  3. 3. Compromise tier 20,001–50,000 = 10,000.00 (no halving for Sec 255)
  4. 4. Total = 50,000 + 5,000 + 493.15 + 10,000 = 65,493.15
- **Correct result:** 65,493.15
- **App result:** ₱5,000.00 / ₱493.15 / ₱5,000.00 / total ₱60,493.15 (unit test also asserts 60,493.15; verifier re-run)

#### TB:W10: Pre-EOPT violation by a taxpayer now classified micro: 1701Q Q3 2023 due Nov 15, 2023, paid Jan 15, 2024  (✘ differs; see H17, C03)
- **Inputs:** ₱20,000 basic tax; due Wed Nov 15, 2023; paid Jan 15, 2024; user selects Micro/Small
- **Steps:**
  1. 1. Days late: Nov 16–30 (15) + Dec (31) + Jan 1–15 (15) = 61 (python date difference = 61)
  2. 2. The violation and full payment both fall before EOPT took effect (Jan 22, 2024), so regular rates apply
  3. 3. Surcharge 25% = 5,000.00
  4. 4. Interest 20,000 × 12% × 61/365 = 401.0959… → 401.10
  5. 5. Compromise tier 10,001–20,000 = 5,000.00
  6. 6. Total = 20,000 + 5,000 + 401.10 + 5,000 = 30,401.10
- **Correct result:** 30,401.10
- **App result:** ₱2,000.00 / ₱200.55 / ₱2,500.00 / total ₱24,700.55 (verifier re-run)

#### TB:W11: One year late spanning Feb 29, 2024: 2551Q Q3 2023 due Oct 25, 2023, paid Oct 25, 2024, Medium/Large  (✔ matches; see H17)
- **Inputs:** ₱100,000; due Wed Oct 25, 2023; paid Oct 25, 2024 (366 days); Medium/Large
- **Steps:**
  1. 1. Days from the due date (exclusive) to payment (inclusive) = 366 (includes Feb 29, 2024)
  2. 2. Surcharge 25% = 25,000.00
  3. 3. Interest on the app's actual/365 basis = 100,000 × 12% × 366/365 = 12,032.8767 → 12,032.88 (alternatives: 366-day year = 12,000.00; actual/actual split 67/365 + 299/366 = 12,006.02); BIR convention UNVERIFIED
  4. 4. Compromise tier 50,001–100,000 = 15,000.00
  5. 5. Total = 100,000 + 25,000 + 12,032.88 + 15,000 = 152,032.88
- **Correct result:** 152,032.88 on actual/365 (152,000.00 on a 366-day basis)
- **App result:** ₱25,000.00 / ₱12,032.88 / ₱15,000.00 / total ₱152,032.88 (verifier re-run)

#### TB:W12: Rounding stress: ₱33,333, 17 days, Medium/Large  (✔ matches)
- **Inputs:** ₱33,333; 17 days; Medium/Large
- **Steps:**
  1. 1. Surcharge 33,333 × 25% = 8,333.25
  2. 2. Interest 33,333 × 12% × 17/365 = 186.29950… → 186.30
  3. 3. Compromise tier 20,001–50,000 = 10,000.00
  4. 4. Total = 33,333 + 8,333.25 + 186.30 + 10,000 = 51,852.55
  5. 5. Brute force. Auditor: 3.5M combinations through toFixed. Verifier: 300,000 cases (100,000 sequential tax amounts plus 200,000 random amounts up to ₱1 billion and up to 3,650 days) through the UI formatter money2. Interest and total always equal exact half-up centavos computed with integers, 0 mismatches
- **Correct result:** 51,852.55
- **App result:** ₱8,333.25 / ₱186.30 / ₱10,000.00 / total ₱51,852.55; brute force 0 mismatches (verifier re-run)

#### TB:W13: Top tier: ₱5,000,001, 365 days late, Medium/Large  (✔ matches)
- **Inputs:** ₱5,000,001; 365 days; Medium/Large
- **Steps:**
  1. 1. Surcharge 25% = 1,250,000.25
  2. 2. Interest 5,000,001 × 12% × 365/365 = 600,000.12
  3. 3. Compromise over 5,000,000 = 50,000.00
  4. 4. Total = 5,000,001 + 1,250,000.25 + 600,000.12 + 50,000 = 6,900,001.37
- **Correct result:** 6,900,001.37
- **App result:** ₱1,250,000.25 / ₱600,000.12 / ₱50,000.00 / total ₱6,900,001.37 (verifier re-run)

#### TB:W14: Percentage tax: ₱600,000 sales per quarter, TY2022 vs TY2023 vs TY2024  (✘ differs; see M01)
- **Inputs:** Non-VAT, graduated regime; gross sales ₱600,000 each quarter (₱2,400,000 per year)
- **Steps:**
  1. 1. TY2022 (all quarters inside the CREATE window, Jul 1, 2020 – Jun 30, 2023): 600,000 × 1% = 6,000 per quarter; × 4 = 24,000
  2. 2. TY2023: Q1 and Q2 at 1% = 6,000 each; Q3 and Q4 at 3% (RMC 69-2023) = 18,000 each; total 48,000
  3. 3. TY2024 onward: 600,000 × 3% = 18,000 per quarter; × 4 = 72,000
- **Correct result:** 2022: 24,000; 2023: 48,000; 2024 and later: 72,000
- **App result:** 72,000 for any year (estimateCorporation with taxYear 2022/2023/2024/2026 and estimateIndividual all give 72,000; the UI has no year input; verifier re-run)

#### TB:W15: VAT for a VAT-registered individual: ₱4,000,000 sales, ₱1,500,000 VATable purchases  (✘ differs; see H05)
- **Inputs:** Gross sales ₱4,000,000 (VAT-exclusive); VATable purchases ₱1,500,000 (VAT-exclusive); itemized expenses ₱1,500,000
- **Steps:**
  1. 1. Output VAT = 4,000,000 × 12% = 480,000
  2. 2. Creditable input VAT = 1,500,000 × 12% = 180,000
  3. 3. VAT payable for the year (sum of four 2550Q returns) = 480,000 − 180,000 = 300,000; any quarterly excess input VAT is carried over
  4. 4. Income tax for reference (outside this area): OSD net 2,400,000 → 402,500 + 30% × 400,000 = 522,500
- **Correct result:** VAT payable ₱300,000, shown as part of total business taxes
- **App result:** Business tax 'VAT 12%' with no amount; breakdown says 'see the VAT panel' (no such panel); totals 522,500 (OSD) and 552,500 (itemized) exclude VAT (verifier re-run)

#### TB:W16: Non-VAT individual crosses ₱3M during the year: ₱3,200,000 gross  (✘ differs; see H04, H05)
- **Inputs:** Not VAT-registered; gross sales ₱3,200,000; itemized expenses ₱2,000,000; threshold assumed crossed late in the year
- **Steps:**
  1. 1. Sales before VAT liability (about the first ₱3,000,000) stay subject to 3% percentage tax: 3,000,000 × 3% = 90,000 (RR 8-2018 per KPMG; app's own income-tax.json:25)
  2. 2. Excess ₱200,000 is subject to VAT prospectively: output VAT 200,000 × 12% = 24,000, less input VAT
  3. 3. Income tax (graduated, itemized) on 1,200,000 = 102,500 + 25% × 400,000 = 202,500
  4. 4. Business taxes add at least ₱90,000 of percentage tax to the total
- **Correct result:** Percentage tax ≈ ₱90,000 plus VAT on the excess; total well above ₱202,500
- **App result:** Percentage tax ₱0; VAT not computed; 'Total annual tax' ₱202,500; corporate equivalent pct 0 (verifier re-run)

#### TB:W17: Tax due with centavos typed or pasted: ₱12,345.67, 30 days, Medium/Large  (✘ differs; see C01)
- **Inputs:** User types or pastes '12,345.67'; 30 days; Medium/Large
- **Steps:**
  1. 1. Surcharge 12,345.67 × 25% = 3,086.4175 → 3,086.42
  2. 2. Interest 12,345.67 × 12% × 30/365 = 121.7655… → 121.77
  3. 3. Compromise tier 10,001–20,000 = 5,000.00
  4. 4. Total = 12,345.67 + 3,086.42 + 121.77 + 5,000 = 20,553.86
- **Correct result:** 20,553.86
- **App result:** Field reads ₱1,234,567 → ₱308,641.75 / ₱12,176.55 / ₱40,000.00 / total ₱1,595,385.30 (verifier re-run)

### 3.3 Deadlines

#### DL:WS-01: 1701Q, Q3 TY2026 (8% freelancer)  (✔ matches)
- **Inputs:** Calendar-year individual in business; quarter Jul-Sep 2026
- **Steps:**
  1. NIRC Sec 74(A) as amended by TRAIN: Q3 return due Nov 15
  2. Nov 15, 2026 is a Sunday
  3. BIR rule (RMC 65-2016): a deadline on Sat/Sun/holiday moves to the next business day
  4. Nov 16, 2026 (Monday) is not a holiday in the app's 2026 list (Proc 1006), so it is a working day
- **Correct result:** Mon Nov 16, 2026
- **App result:** 2026-11-16 (moved from 2026-11-15, weekend)

#### DL:WS-02: 2550Q, Q3 2026 (VAT sole prop, calendar quarter)  (✔ matches)
- **Inputs:** Quarter ends Sep 30, 2026
- **Steps:**
  1. NIRC Sec 114(A): within 25 days after close of quarter
  2. Sep 30 + 25 days = Oct 25, 2026
  3. Oct 25 is a Sunday
  4. Oct 26 (Monday) is a working day
- **Correct result:** Mon Oct 26, 2026
- **App result:** 2026-10-26 (moved from 2026-10-25, weekend)

#### DL:WS-03: 1601-EQ / 1601-FQ / QAP, Q3 2026: four non-working days in a row  (✔ matches)
- **Inputs:** Calendar quarter ends Sep 30, 2026
- **Steps:**
  1. RR 11-2018: last day of the month after the quarter = Oct 31, 2026
  2. Oct 31 is a Saturday
  3. Nov 1 is a Sunday and All Saints' Day (special, Proc 1006)
  4. Nov 2 (Monday) is an additional special non-working day (Proc 1006)
  5. Nov 3 (Tuesday) is a working day
- **Correct result:** Tue Nov 3, 2026 (secondary 2026 BIR calendars also show Nov 3)
- **App result:** 2026-11-03 (moved from 2026-10-31) for 1601-EQ, 1601-FQ and QAP

#### DL:WS-04: 1702Q, Q3 2026 (calendar-year corporation): weekend then regular holiday  (✔ matches)
- **Inputs:** Quarter ends Sep 30, 2026
- **Steps:**
  1. NIRC Sec 77(B): within 60 days after close of quarter
  2. Sep 30 + 31 days (October) = Oct 31; + 29 more days = Nov 29, 2026
  3. Nov 29 is a Sunday
  4. Nov 30 (Monday) is Bonifacio Day, a regular holiday
  5. Dec 1 (Tuesday) is a working day
- **Correct result:** Tue Dec 1, 2026
- **App result:** 2026-12-01 (moved from 2026-11-29)

#### DL:WS-05: 1601-C, September 2026 compensation  (✔ matches)
- **Inputs:** Non-eFPS employer
- **Steps:**
  1. RR 2-98 Sec 2.58(A) as amended: 10th of the following month = Oct 10, 2026
  2. Oct 10 is a Saturday, Oct 11 a Sunday
  3. Oct 12 (Monday) is a working day
  4. (eFPS groups file on the 11th-15th, which is later, so the shown date is conservative)
- **Correct result:** Mon Oct 12, 2026
- **App result:** 2026-10-12 (moved from 2026-10-10, weekend)

#### DL:WS-06: 1601-C, December 2026 compensation (December exception)  (✔ matches)
- **Inputs:** Employer
- **Steps:**
  1. December withholding is due Jan 15 of the next year, not Jan 10
  2. Jan 15, 2027 is a Friday and not a holiday
- **Correct result:** Fri Jan 15, 2027
- **App result:** 2027-01-15 (no shift)

#### DL:WS-07: 1604-C / 1604-F / 2316 issuance, TY2026  (✔ matches)
- **Inputs:** Employer
- **Steps:**
  1. RR 11-2018: on or before Jan 31, 2027
  2. Jan 31, 2027 is a Sunday
  3. Feb 1, 2027 (Monday) is a working day
- **Correct result:** Mon Feb 1, 2027
- **App result:** 2027-02-01 (moved from 2027-01-31, weekend) for 1604-C, 1604-F and 2316

#### DL:WS-08: SSS employer contributions, November 2026: special day, regular holiday, then weekend  (✔ matches)
- **Inputs:** Applicable month Nov 2026
- **Steps:**
  1. SSS: last day of the following month = Dec 31, 2026 (Thursday)
  2. Dec 31 is a special non-working day (Proc 1006)
  3. Jan 1, 2027 (Friday) is New Year's Day, a regular holiday
  4. Jan 2 is a Saturday, Jan 3 a Sunday
  5. SSS rule: a deadline on Sat/Sun/holiday can be paid on the next working day, Mon Jan 4, 2027
- **Correct result:** Mon Jan 4, 2027
- **App result:** 2027-01-04 (moved from 2026-12-31, holiday)

#### DL:WS-09: SSS employer contributions, July 2026: weekday regular holiday  (✔ matches)
- **Inputs:** Applicable month Jul 2026
- **Steps:**
  1. Last day of following month = Aug 31, 2026 (Monday)
  2. Aug 31, 2026 is National Heroes Day (last Monday of August, regular holiday)
  3. Sep 1 (Tuesday) is a working day
- **Correct result:** Tue Sep 1, 2026
- **App result:** 2026-09-01 (moved from 2026-08-31, holiday)

#### DL:WS-10: 1601-EQ / QAP / SSS, Q3 2027: missing Proc 1427 day  (✘ differs; see H03)
- **Inputs:** Calendar quarter ends Sep 30, 2027
- **Steps:**
  1. Last day of the month after the quarter = Oct 31, 2027 (Sunday)
  2. Nov 1, 2027 (Monday) is All Saints' Day (special, fixed by law)
  3. Nov 2, 2027 (Tuesday) is an additional special non-working day under Proc 1427 s.2026 (as reported by the auditor; not re-fetched by the verifier)
  4. Nov 3, 2027 (Wednesday) is a working day
  5. Without Proc 1427 the same chain stops at Nov 2, which is what the app shows
- **Correct result:** Wed Nov 3, 2027
- **App result:** 2027-11-02 for 1601-EQ, 1601-FQ, QAP, SSS employer/self and PhilHealth self (Nov 2 is missing from holidays.json)

#### DL:WS-11: 2551Q, fiscal year ending May (Q3 = Dec 2026-Feb 2027): Holy Week chain  (✔ matches)
- **Inputs:** Non-VAT corporation, FY ends May 31
- **Steps:**
  1. Quarter ends Feb 28, 2027; + 25 days = Mar 25, 2027
  2. Mar 25 is Maundy Thursday (regular), Mar 26 Good Friday (regular); Easter 2027 is Mar 28
  3. Mar 27 is Black Saturday (a Saturday; also special under Proc 1427), Mar 28 Easter Sunday
  4. Mar 29 (Monday) is a working day
- **Correct result:** Mon Mar 29, 2027
- **App result:** 2027-03-29 (moved from 2027-03-25, holiday)

#### DL:WS-12: 1702-RT, fiscal year ending June 30, 2026  (✔ matches)
- **Inputs:** Corporation, FY Jul 1, 2025 to Jun 30, 2026
- **Steps:**
  1. NIRC Sec 77(B): 15th day of the 4th month after close of the taxable year
  2. Months after June: Jul (1), Aug (2), Sep (3), Oct (4), so Oct 15, 2026
  3. Oct 15, 2026 is a Thursday, a working day
- **Correct result:** Thu Oct 15, 2026
- **App result:** 2026-10-15

#### DL:WS-13: 1702Q, FY ending May 2028, Q3 ends Feb 29 (leap year), with no 2028 holiday list  (✘ differs; see M07)
- **Inputs:** Corporation, FY Jun 1, 2027 to May 31, 2028
- **Steps:**
  1. Q3 ends Feb 29, 2028; + 60 days: + 31 (March) = Mar 31; + 29 = Apr 29, 2028
  2. Apr 29, 2028 is a Saturday, Apr 30 a Sunday
  3. May 1, 2028 (Monday) is Labor Day, a regular holiday fixed by law every year
  4. May 2, 2028 (Tuesday) is a working day
- **Correct result:** Tue May 2, 2028
- **App result:** 2028-05-01 (moved from 2028-04-29, weekend), because the app has no 2028 holidays

#### DL:WS-14: 1601-EQ, Q1 2028 (no holiday data for 2028)  (✘ differs; see M07)
- **Inputs:** Calendar quarter ends Mar 31, 2028
- **Steps:**
  1. Last day of month after quarter = Apr 30, 2028 (Sunday)
  2. May 1, 2028 (Monday) is Labor Day (regular holiday)
  3. May 2, 2028 is a working day
- **Correct result:** Tue May 2, 2028
- **App result:** 2028-05-01 (on the dashboard from 2027-03-28)

#### DL:WS-15: Second installment of TY2025 annual income tax  (✘ differs; see H02)
- **Inputs:** 1701A filer whose TY2025 tax due exceeded ₱2,000 and who elected to pay in two installments
- **Steps:**
  1. NIRC Sec 56(A)(2) as amended by RA 10963: second installment on or before October 15 following the close of the calendar year
  2. Oct 15, 2026 is a Thursday, a working day
- **Correct result:** Thu Oct 15, 2026 listed as a deadline
- **App result:** Not listed (dashboard window from 2026-10-07 for an 8% freelancer: Oct 12 Pag-IBIG, Nov 3 PhilHealth and SSS, Nov 10 Pag-IBIG, Nov 16 1701Q)

#### DL:WS-16: 13th-month pay 2027 (deadline must never move later)  (✔ matches)
- **Inputs:** Employer
- **Steps:**
  1. PD 851 IRR: pay not later than Dec 24
  2. Dec 24, 2027 (Friday) is an additional special non-working day (Proc 1427, as reported), but this deadline does not roll forward
  3. Practical note: pay by Dec 23 if offices close
- **Correct result:** Fri Dec 24, 2027 (on or before)
- **App result:** 2027-12-24 (noWeekendShift)

#### DL:WS-17: Days left for the 2550Q Q3 2026, viewed from Los Angeles after the Manila deadline  (✘ differs; see H01)
- **Inputs:** Instant 2026-10-27T03:00Z = 11:00 AM Oct 27 Manila = 8:00 PM Oct 26 Los Angeles; deadline Mon Oct 26, 2026
- **Steps:**
  1. The BIR deadline is the end of Oct 26 in Philippine time
  2. At 11:00 AM Oct 27 Manila the deadline passed 11 hours ago
  3. The item should show as passed/overdue, not as due
- **Correct result:** Shown as passed/overdue (under TZ=Asia/Manila the item is gone: next 2550Q Jan 25, 2027)
- **App result:** Under TZ=America/Los_Angeles and TZ=America/New_York: app-today 2026-10-26, 2550Q due 2026-10-26, daysAway = 0 ("0 days left")

#### DL:WS-18: [verifier] 1702Q, FY ending November, quarter ending Aug 31, 2027: missing Proc 1427 day  (✘ differs; see H03)
- **Inputs:** Corporation, FY Dec 1, 2026 to Nov 30, 2027; Q3 = Jun-Aug 2027
- **Steps:**
  1. NIRC Sec 77(B): within 60 days after close of the quarter
  2. Aug 31 + 30 days (September) = Sep 30; + 30 more = Oct 30, 2027
  3. Oct 30 is a Saturday, Oct 31 a Sunday
  4. Nov 1 (Monday) All Saints' Day (special, fixed by law)
  5. Nov 2 (Tuesday) additional special non-working day under Proc 1427 (as reported)
  6. Nov 3 (Wednesday) is a working day
- **Correct result:** Wed Nov 3, 2027
- **App result:** 2027-11-02 (same for SAWT; also FY ending Feb and May)

### 3.4 Withholding, contributions and corporate tax

#### WH:WS-01: Monthly withholding table: every bracket edge  (✔ matches)
- **Inputs:** Monthly taxable compensation ₱20,833; ₱20,834; ₱33,333; ₱66,667; ₱166,667; ₱666,667; ₱1,000,000
- **Steps:**
  1. Table: RR 11-2018 Annex E, monthly, effective Jan 1, 2023. Over 20,833: 15% of excess. Over 33,333: 1,875 + 20%. Over 66,667: 8,541.80 + 25%. Over 166,667: 33,541.80 + 30%. Over 666,667: 183,541.80 + 35%.
  2. ₱20,833 is not over 20,833, so ₱0.00
  3. ₱20,834: (20,834 − 20,833) × 15% = ₱0.15
  4. ₱33,333: (33,333 − 20,833) × 15% = 12,500 × 0.15 = ₱1,875.00
  5. ₱66,667: 1,875 + (66,667 − 33,333) × 20% = 1,875 + 6,666.80 = ₱8,541.80
  6. ₱166,667: 8,541.80 + 100,000 × 25% = ₱33,541.80
  7. ₱666,667: 33,541.80 + 500,000 × 30% = ₱183,541.80
  8. ₱1,000,000: 183,541.80 + 333,333 × 35% (116,666.55) = ₱300,208.35
- **Correct result:** 0.00 / 0.15 / 1,875.00 / 8,541.80 / 33,541.80 / 183,541.80 / 300,208.35
- **App result:** withholdingForPeriod(...,'monthly'): 0 / 0.15 / 1875 / 8541.8 / 33541.8 / 183541.8 / 300208.35 (verifier re-run v1.out)

#### WH:WS-02: Semi-monthly withholding table: bracket edges  (✔ matches)
- **Inputs:** Semi-monthly taxable ₱10,417; ₱16,667; ₱33,333; ₱83,333; ₱333,333; ₱400,000
- **Steps:**
  1. Annex E semi-monthly table
  2. ₱10,417: ₱0
  3. ₱16,667: (16,667 − 10,417) × 15% = ₱937.50
  4. ₱33,333: 937.50 + 16,666 × 20% (3,333.20) = ₱4,270.70
  5. ₱83,333: 4,270.70 + 50,000 × 25% = ₱16,770.70
  6. ₱333,333: 16,770.70 + 250,000 × 30% = ₱91,770.70
  7. ₱400,000: 91,770.70 + 66,667 × 35% (23,333.45) = ₱115,104.15
- **Correct result:** 0 / 937.50 / 4,270.70 / 16,770.70 / 91,770.70 / 115,104.15
- **App result:** 0 / 937.5 / 4270.700000000001 (displays 4,270.70) / 16770.7 / 91770.7 / 115104.15

#### WH:WS-03: Weekly withholding table: bracket edges  (✔ matches)
- **Inputs:** Weekly taxable ₱4,808; ₱7,692; ₱15,385; ₱38,462; ₱153,846; ₱200,000
- **Steps:**
  1. Annex E weekly table
  2. ₱4,808: ₱0
  3. ₱7,692: 2,884 × 15% = ₱432.60
  4. ₱15,385: 432.60 + 7,693 × 20% (1,538.60) = ₱1,971.20
  5. ₱38,462: 1,971.20 + 23,077 × 25% (5,769.25) = ₱7,740.45
  6. ₱153,846: 7,740.45 + 115,384 × 30% (34,615.20) = ₱42,355.65
  7. ₱200,000: 42,355.65 + 46,154 × 35% (16,153.90) = ₱58,509.55
- **Correct result:** 0 / 432.60 / 1,971.20 / 7,740.45 / 42,355.65 / 58,509.55
- **App result:** 0 / 432.59999999999997 (displays 432.60) / 1971.2000000000003 (1,971.20) / 7740.45 / 42355.649999999994 (42,355.65) / 58509.55

#### WH:WS-04: Daily withholding table: bracket edges  (✔ matches)
- **Inputs:** Daily taxable ₱685; ₱1,096; ₱2,192; ₱5,479; ₱21,918; ₱30,000
- **Steps:**
  1. Annex E daily table (floors = annual brackets ÷ 365: 684.93, 1,095.89, 2,191.78, 5,479.45, 21,917.81, rounded)
  2. ₱685: ₱0
  3. ₱1,096: 411 × 15% = ₱61.65
  4. ₱2,192: 61.65 + 1,096 × 20% (219.20) = ₱280.85
  5. ₱5,479: 280.85 + 3,287 × 25% (821.75) = ₱1,102.60
  6. ₱21,918: 1,102.60 + 16,439 × 30% (4,931.70) = ₱6,034.30
  7. ₱30,000: 6,034.30 + 8,082 × 35% (2,828.70) = ₱8,863.00
- **Correct result:** 0 / 61.65 / 280.85 / 1,102.60 / 6,034.30 / 8,863.00
- **App result:** 0 / 61.65 / 280.85 / 1102.6 / 6034.299999999999 (displays 6,034.30) / 8863

#### WH:WS-05: Employee ₱25,000/month: payslip and year-end  (✔ matches)
- **Inputs:** Basic ₱25,000/month; no allowances; no bonus
- **Steps:**
  1. SSS: MSC 25,000 (Circular 2024-006) × 5% = 1,250.00
  2. PhilHealth: 25,000 × 5% = 1,250 premium; employee half = 625.00
  3. Pag-IBIG: fund salary capped at 10,000 × 2% = 200.00
  4. Total employee contributions 2,075.00 (excluded, NIRC 32(B)(7)(f))
  5. Monthly taxable = 25,000 − 2,075 = 22,925.00
  6. Monthly withholding = (22,925 − 20,833) × 15% = 2,092 × 0.15 = 313.80
  7. Take-home = 25,000 − 2,075 − 313.80 = 22,611.20
  8. Annual taxable = 22,925 × 12 = 275,100; tax = (275,100 − 250,000) × 15% = 3,765.00
  9. Withheld 313.80 × 12 = 3,765.60, so December refund ₱0.60 (the app hides adjustments under ₱1)
- **Correct result:** Withholding ₱313.80; take-home ₱22,611.20; annual tax ₱3,765.00; refund ₱0.60
- **App result:** monthlyWithholding 313.8; monthlyTakeHome 22611.2; annualTax 3765; yearEndDifference −0.60 (no adjustment row shown, |diff| < 1)

#### WH:WS-06: Employee ₱50,000/month  (✔ matches)
- **Inputs:** Basic ₱50,000/month
- **Steps:**
  1. SSS: MSC capped at 35,000 × 5% = 1,750
  2. PhilHealth: 50,000 × 5% ÷ 2 = 1,250
  3. Pag-IBIG 200; total 3,200
  4. Taxable = 46,800
  5. Withholding = 1,875 + (46,800 − 33,333) × 20% = 1,875 + 2,693.40 = 4,568.40
  6. Annual 561,600: 22,500 + 161,600 × 20% = 54,820.00
  7. Withheld 54,820.80, so refund ₱0.80
- **Correct result:** ₱4,568.40 / month; ₱54,820.00 / year
- **App result:** monthlyWithholding 4568.4; annualTax 54820; yearEndDifference −0.80

#### WH:WS-07: Employee ₱100,000/month with 13th month ₱100,000 (above ₱90k cap)  (✔ matches)
- **Inputs:** Basic ₱100,000; 13th month/bonus ₱100,000
- **Steps:**
  1. SSS 35,000 × 5% = 1,750; PhilHealth ceiling 100,000 × 5% = 5,000 ÷ 2 = 2,500; Pag-IBIG 200; total 4,450
  2. Monthly taxable 95,550; withholding = 8,541.80 + (95,550 − 66,667) × 25% = 8,541.80 + 7,220.75 = 15,762.55
  3. Annual taxable = 95,550 × 12 = 1,146,600 + (100,000 − 90,000) = 1,156,600 (NIRC 32(B)(7)(e))
  4. Tax = 102,500 + (1,156,600 − 800,000) × 25% = 102,500 + 89,150 = 191,650.00
  5. Withheld 15,762.55 × 12 = 189,150.60, so December extra withholding = 2,499.40
- **Correct result:** ₱15,762.55 / month; annual ₱191,650.00; December extra ₱2,499.40
- **App result:** monthlyWithholding 15762.55; annualTax 191650; yearEndDifference 2499.40

#### WH:WS-08: NCR minimum wage earner, monthly-paid, under the reported NCR-28 rate (premise unconfirmed, see WH-02)  (✘ differs; see C04, H10)
- **Inputs:** Statutory daily wage ₱755 (Wage Order NCR-28 as reported by news, from Sep 26, 2026); paid for all 365 days; monthly equivalent ₱22,964.58, entered as ₱22,965 because fields accept whole pesos
- **Steps:**
  1. Monthly equivalent = 755 × 365 ÷ 12 = 22,964.58 (365 factor for workers paid every day of the year)
  2. If ₱755 is the statutory minimum, the worker is an MWE and the minimum wage is exempt (NIRC 24(A)(2), RA 9504; RR 11-2018)
  3. Expected withholding ₱0.00 and annual tax ₱0.00
  4. App path: SSS MSC 23,000 × 5% = 1,150; PhilHealth 22,965 × 2.5% = 574.125, app rounds to 574.13; Pag-IBIG 200; total 1,924.13
  5. App taxable 22,965 − 1,924.13 = 21,040.87; withholding = 207.87 × 15% = 31.1805, shown ₱31.18
  6. App annual 21,040.87 × 12 = 252,490.44; tax = 2,490.44 × 15% = 373.566, shown ₱373.57
- **Correct result:** ₱0.00 per month; ₱0.00 per year (if NCR-28 is in force)
- **App result:** monthlyWithholding 31.1805 (₱31.18); annualTax 373.566 (₱373.57) on the Employee tab; ₱31.18 under 1601-C on the Payroll tab

#### WH:WS-09: NCR minimum wage earner (₱695, 6-day week) who also earns commissions (verifier replaced the NCR-28 premise with the undisputed NCR-26 rate)  (✘ differs; see C04)
- **Inputs:** Statutory daily wage ₱695 (NCR-26); 313 paid days: 695 × 313 ÷ 12 = ₱18,127.92, entered ₱18,128; plus ₱6,000 a month commissions entered as 'taxable allowances / other pay'
- **Steps:**
  1. The ₱18,128 statutory minimum wage is exempt (NIRC 24(A)(2), RA 9504; RR 11-2018 after Soriano). Only the ₱6,000 commission is taxable
  2. Monthly taxable non-exempt pay 6,000 is below the ₱20,833 monthly zero bracket, so withholding is ₱0
  3. Annual taxable 6,000 × 12 = 72,000 is below ₱250,000, so annual tax ₱0 (the same holds if the ₱6,000 were overtime or holiday pay, which is itself exempt)
  4. App: SSS on basic only, MSC 18,000 × 5% = 900; PhilHealth 18,128 × 2.5% = 453.20; Pag-IBIG 200; total 1,553.20
  5. App taxable 18,128 + 6,000 − 1,553.20 = 22,574.80; withholding (22,574.80 − 20,833) × 15% = 1,741.80 × 0.15 = 261.27
  6. App annual 22,574.80 × 12 = 270,897.60; tax (270,897.60 − 250,000) × 15% = 3,134.64
- **Correct result:** ₱0.00 / month; ₱0.00 / year
- **App result:** monthlyWithholding 261.27 (Employee and Payroll tabs); annualTax 3,134.64 (verifier run v2.out)

#### WH:WS-10: SSS base must include regular allowances  (✘ differs; see C05)
- **Inputs:** Basic ₱15,000; regular taxable allowance ₱10,000 (not liquidated)
- **Steps:**
  1. SSS compensation = 25,000 (RA 11199 Sec 8(f)), so MSC 25,000: employee 5% = 1,250; employer 10% = 2,500 + EC 30 = 2,530
  2. PhilHealth on basic 15,000 × 5% = 750, employee half 375
  3. Pag-IBIG 10,000 cap × 2% = 200; total employee deductions 1,825
  4. Taxable = 25,000 − 1,825 = 23,175; withholding = (23,175 − 20,833) × 15% = 2,342 × 0.15 = 351.30
  5. Annual 23,175 × 12 = 278,100 gives (278,100 − 250,000) × 15% = 4,215.00
- **Correct result:** SSS employee ₱1,250; employer ₱2,530; withholding ₱351.30; annual tax ₱4,215
- **App result:** SSS employee 750; employer 1,530; withholding 426.30; annual tax 5,115

#### WH:WS-11: SSS at the MSC floor  (✔ matches)
- **Inputs:** Monthly compensation ₱4,000; ₱5,249.99; ₱5,250
- **Steps:**
  1. 2025 schedule (Circular 2024-006): below 5,250 gives MSC 5,000; 5,250 to 5,749.99 gives 5,500
  2. ₱4,000 and ₱5,249.99: MSC 5,000; employee 5% = 250; employer 10% = 500 + EC 10 = 510; total 760; MPF 0
  3. ₱5,250: MSC 5,500; employee 275; employer 550 + 10 = 560; total 835
- **Correct result:** 760 / 760 / 835 total
- **App result:** sssEmployee: msc 5000 total 760 / msc 5000 total 760 / msc 5500 total 835

#### WH:WS-12: SSS at the MSC ceiling, with MPF portion  (✔ matches)
- **Inputs:** ₱34,749.99; ₱34,750; ₱50,000
- **Steps:**
  1. ₱34,749.99: MSC 34,500; employee 1,725; employer 3,450 + 30 = 3,480; total 5,205; MPF = (34,500 − 20,000) × 15% = 2,175
  2. ₱34,750: MSC 35,000; employee 1,750; employer 3,500 + 30 = 3,530; total 5,280; MPF = 15,000 × 15% = 2,250
  3. ₱50,000: capped at MSC 35,000, same as above
- **Correct result:** 5,205 / 5,280 / 5,280 (MPF 2,175 / 2,250 / 2,250)
- **App result:** total 5205 (wispPortionOfTotal 2175) / 5280 (2250) / 5280 (2250)

#### WH:WS-13: PhilHealth floor and ceiling  (✔ matches)
- **Inputs:** Basic ₱8,000; ₱150,000
- **Steps:**
  1. 5% of basic salary; floor ₱10,000, ceiling ₱100,000 (PhilHealth CY2026)
  2. ₱8,000 uses base 10,000: premium 500; employee 250 / employer 250
  3. ₱150,000 uses base 100,000: premium 5,000; 2,500 / 2,500
- **Correct result:** 500 (250/250); 5,000 (2,500/2,500)
- **App result:** premium 500 (250/250); premium 5000 (2500/2500)

#### WH:WS-14: Pag-IBIG boundaries  (✔ matches)
- **Inputs:** ₱1,500; ₱1,500.01; ₱1,501; ₱30,000
- **Steps:**
  1. HDMF Circular 460: employee 1% if ≤ 1,500, else 2%; employer 2%; fund salary cap 10,000
  2. ₱1,500: employee 15.00; employer 30.00
  3. ₱1,500.01: employee 2% × 1,500.01 = 30.0002, rounds to 30.00; employer 30.00
  4. ₱1,501: employee 30.02; employer 30.02
  5. ₱30,000 capped at 10,000: 200 / 200
- **Correct result:** 15/30; 30.00/30.00; 30.02/30.02; 200/200
- **App result:** 15/30; 30/30; 30.02/30.02; 200/200

#### WH:WS-15: Corporation at the ₱5M income / ₱100M asset edges  (✔ matches)
- **Inputs:** A: sales 20,000,000; cost 8,000,000; opex 7,000,000; assets 100,000,000. B: opex 6,999,999 (net taxable income 5,000,001). C: as A but assets 100,000,001. All in the 4th+ taxable year, TY2026.
- **Steps:**
  1. A: gross income 12,000,000; net taxable income 5,000,000; both 'not exceeding' tests met, so 20% (RA 11534 Sec 27(A)): RCIT 1,000,000. MCIT 2% × 12,000,000 = 240,000, so RCIT is due: 1,000,000
  2. B: income 5,000,001 > 5M, so 25% on the whole (no marginal relief) = 1,250,000.25 (₱1,250,000 on the 1702-RT in whole pesos)
  3. C: assets > 100M, so 25% × 5,000,000 = 1,250,000
- **Correct result:** A ₱1,000,000; B ₱1,250,000.25 (₱1,250,000 on the return); C ₱1,250,000
- **App result:** A due 1000000 (smallCorp true); B 1250000.25; C 1250000

#### WH:WS-16: MCIT higher than RCIT  (✔ matches; see H13, M11)
- **Inputs:** Gross income 20,000,000; net taxable income 1,000,000; assets 150,000,000; registered 2015; TY2026
- **Steps:**
  1. Assets > 100M, so 25%: RCIT = 250,000
  2. MCIT = 2% × 20,000,000 = 400,000 (Sec 27(E))
  3. Tax due = higher amount = 400,000
  4. Excess MCIT 150,000 creditable against RCIT for the next 3 years
- **Correct result:** ₱400,000 due; ₱150,000 carry-forward
- **App result:** usesMcit true; incomeTaxDue 400000 (carry-forward not tracked; see WH-05)

#### WH:WS-17: TY2026 return prepared in filing season (March 2027)  (✘ differs; see C06)
- **Inputs:** Registered with BIR 2023; gross income 6,000,000; net taxable income 100,000; assets 50M
- **Steps:**
  1. RR 9-98: commencement year = BIR registration year 2023
  2. Taxable years after it: 2024 (1st), 2025 (2nd), 2026 (3rd), 2027 (4th), so MCIT starts TY2027
  3. TY2026 tax = RCIT 20% × 100,000 = 20,000
  4. App in March 2027 passes taxYear = 2027 from the device clock, so MCIT applies: 2% × 6,000,000 = 120,000
- **Correct result:** ₱20,000
- **App result:** ₱120,000 (estimateCorporation with taxYear 2027, as the UI passes in 2027); ₱20,000 only if taxYear 2026 is passed

#### WH:WS-18: Transitional MCIT years (engine with taxYear passed; not reachable from the UI)  (✘ differs; see C06)
- **Inputs:** Gross income 6,000,000; net taxable income 100,000; small corporation; TY2022 and calendar TY2023
- **Steps:**
  1. TY2022: MCIT 1% (CREATE, Jul 1, 2020 to Jun 30, 2023) × 6,000,000 = 60,000 > RCIT 20,000, so 60,000
  2. TY2023 (RMC 36-2024): 6,000,000 ÷ 12 = 500,000 per month; Jan-Jun 6 × 500,000 × 1% = 30,000; Jul-Dec 6 × 500,000 × 2% = 60,000; MCIT 90,000 > RCIT 20,000
  3. The UI cannot select these years; the engine applies 2%
- **Correct result:** TY2022 ₱60,000; TY2023 ₱90,000
- **App result:** TY2022 ₱120,000; TY2023 ₱120,000

#### WH:WS-19: Payroll true monthly cost including 13th month  (✘ differs; see M12)
- **Inputs:** Basic ₱25,000
- **Steps:**
  1. Employer SSS 2,500 + EC 30 = 2,530; PhilHealth 625; Pag-IBIG 200, total 3,355
  2. 13th month accrual (PD 851) = 25,000 ÷ 12 = 2,083.33
  3. Total = 25,000 + 3,355 + 2,083.33 = 30,438.33
- **Correct result:** ₱30,438.33
- **App result:** ₱28,355.00

#### WH:WS-20: Centavo rounding and footing  (✘ differs; see M03)
- **Inputs:** Basic ₱22,748; basic ₱22,729; PhilHealth basic ₱25,001 and ₱10,241
- **Steps:**
  1. ₱22,748: SSS MSC 22,500 gives 1,125; PhilHealth 22,748 × 5% ÷ 2 = 568.70; Pag-IBIG 200; taxable 20,854.30; withholding 21.30 × 15% = 3.195, which rounds half-up to ₱3.20
  2. ₱22,729: PhilHealth 568.225 (app 568.23); taxable 20,835.77; withholding 2.77 × 15% = 0.4155, shown ₱0.42; 12 × ₱0.42 = ₱5.04
  3. ₱25,001: premium 1,250.05; shares must total 1,250.05 (e.g. 625.02 employee + 625.03 employer)
  4. ₱10,241: premium 512.05; shares must total 512.05
- **Correct result:** ₱3.20; 12-month total ₱5.04; PhilHealth shares totaling ₱1,250.05 and ₱512.05
- **App result:** ₱3.19 (raw 3.1949999999998906); 12-month total shown ₱4.99; PhilHealth 625.03 + 625.03 = ₱1,250.06; 256.02 + 256.02 = ₱512.04

#### WH:WS-21: Self-employed monthly contributions (default example)  (✘ differs; see M13)
- **Inputs:** Gross sales ₱480,000/yr; expenses ₱180,000/yr
- **Steps:**
  1. Declared monthly earnings = (480,000 − 180,000) ÷ 12 = 25,000
  2. SSS self-employed: MSC 25,000 × 15% = 3,750 + EC 30 = 3,780
  3. PhilHealth: 25,000 × 5% = 1,250
  4. Pag-IBIG: 10,000 × (2% + 2%) = 400 (both shares; UNVERIFIED)
  5. Total 5,430 per month
- **Correct result:** ₱5,430 per month
- **App result:** ₱7,680 per month (computed on gross ÷ 12 = 40,000: SSS 5,280, PhilHealth 2,000, Pag-IBIG 400)

#### WH:WS-22: [verifier] Monthly-paid NCR minimum wage earner (₱695) with commissions  (✘ differs; see C04)
- **Inputs:** ₱695 × 365 ÷ 12 = ₱21,139.58, entered ₱21,140 (whole pesos only); plus ₱3,000 a month commissions as 'taxable allowances / other pay'
- **Steps:**
  1. Statutory minimum wage exempt (NIRC 24(A)(2); RR 11-2018); only the ₱3,000 commission is taxable
  2. Monthly 3,000 < 20,833, so withholding ₱0; annual 36,000 < 250,000, so tax ₱0
  3. App: SSS MSC 21,000 × 5% = 1,050; PhilHealth 21,140 × 2.5% = 528.50; Pag-IBIG 200; total 1,778.50
  4. App taxable 21,140 + 3,000 − 1,778.50 = 22,361.50; withholding 1,528.50 × 15% = 229.275, shown ₱229.28
  5. App annual 22,361.50 × 12 = 268,338; tax 18,338 × 15% = 2,750.70
- **Correct result:** ₱0.00 / month; ₱0.00 / year
- **App result:** monthlyWithholding 229.275 (₱229.28); annualTax 2,750.70 (v2.out)

#### WH:WS-23: [verifier] Corporate annual payable after quarterly payments  (✘ differs; see H06)
- **Inputs:** App default corporate figures: sales 10,000,000; cost 4,000,000; opex 3,000,000; assets 50,000,000; 2307s ₱100,000; assumed 1702Q payments Q1-Q3 ₱450,000; registered 2015; TY2026
- **Steps:**
  1. Gross income 6,000,000; net taxable income 3,000,000; small corporation, so RCIT 20% = 600,000
  2. MCIT 2% × 6,000,000 = 120,000 < RCIT, so tax due 600,000
  3. Annual return payable = 600,000 − 450,000 (1702Q payments) − 100,000 (2307s) = 50,000 (NIRC Secs 76-77)
  4. App subtracts only the 2307s: 600,000 − 100,000 = 500,000, labelled 'Income tax still payable'
- **Correct result:** ₱50,000 payable with the 1702-RT
- **App result:** 'Income tax still payable' ₱500,000 (v2.out)

#### WH:WS-24: [verifier] MCIT start counted from the BIR registration year  (✘ differs; see H13)
- **Inputs:** Registered with BIR Nov 2022; first sale Feb 2023; user enters 2023 as 'Year operations began'; TY2026 gross income 6,000,000, net taxable income 100,000, assets 50M
- **Steps:**
  1. RR 9-98: the commencement year for MCIT is the BIR registration year, 2022
  2. Taxable years after it: 2023 (1st), 2024 (2nd), 2025 (3rd), 2026 (4th), so MCIT applies in TY2026
  3. RCIT 20% × 100,000 = 20,000; MCIT 2% × 6,000,000 = 120,000; tax due 120,000
  4. App with registrationYear 2023: 2026 < 2027, so MCIT not applied; due 20,000
- **Correct result:** ₱120,000
- **App result:** ₱20,000 (registrationYear 2023, taxYear 2026; v1.out)

### 3.5 Gap checks

#### GAP:GW-1: Float error with whole-peso inputs, itemized option card (resolves bugs-area OK row vs TI-07/CH-06)  (✘ differs; see M03)
- **Inputs:** Self-employed, non-VAT. Gross sales ₱375,865; itemized expenses ₱125,288; no 2307s
- **Steps:**
  1. Net taxable income = 375,865 - 125,288 = 250,577 (NIRC Sec 34(A))
  2. Graduated tax (2023 table, NIRC Sec 24(A)(2)(a)): 15% x (250,577 - 250,000) = 15% x 577 = 86.55
  3. Percentage tax (Sec 116, 3%): 3% x 375,865 = 11,275.95
  4. Total = 86.55 + 11,275.95 = 11,362.50 (exact)
  5. Whole pesos, 50 centavos and up rounded up (BIR form rule): 11,363. Per-line rounding gives 87 + 11,276 = 11,363 too
- **Correct result:** Itemized card total ₱11,363
- **App result:** Engine total 11362.499999999998; card shows 'Graduated + itemized ₱11,362 · Income tax ₱87 · Business tax ₱11,276' (browser, ws1_out.json)

#### GAP:GW-2: Float error on the recommended option and the banner  (✘ differs; see M03)
- **Inputs:** Self-employed, non-VAT. Gross sales ₱419,165; itemized expenses ₱167,788
- **Steps:**
  1. Net = 419,165 - 167,788 = 251,377; tax = 15% x 1,377 = 206.55
  2. Percentage tax = 3% x 419,165 = 12,574.95; itemized total = 12,781.50
  3. Check other options: OSD tax = 15% x (60% x 419,165 - 250,000) = 15% x 1,499 = 224.85, plus 12,574.95 = 12,799.80; 8% = 8% x (419,165 - 250,000) = 13,533.20. Itemized is cheapest
  4. Whole pesos half-up: 12,782
- **Correct result:** Recommended option 'Graduated + itemized' ₱12,782
- **App result:** Engine 12781.499999999998; card 'LOWEST ₱12,781'; banner 'cheapest eligible option at ₱12,781' (browser, ws1_out.json)

#### GAP:GW-3: YTD projector, mixed-income earner, default figures  (✘ differs; see H12)
- **Inputs:** Tools > Year-to-date projector; active profile = mixed income; gross so far ₱240,000; months in 6
- **Steps:**
  1. Projected annual gross = 240,000 / 6 x 12 = 480,000
  2. Mixed income on 8%: no ₱250,000 reduction on the business side (NIRC Sec 24(A)(2)(c); RR 8-2018), so 8% x 480,000 = 38,400
  3. Set aside per month = 38,400 / 12 = 3,200
- **Correct result:** Estimated 8% tax ₱38,400; set aside ₱3,200 a month
- **App result:** Projected annual income ₱480,000 · Estimated 8% tax ₱18,400 · Set aside / month ₱1,533 (browser, ytd_out.json)

#### GAP:GW-4: YTD projector, mixed-income earner, larger business  (✘ differs; see H12)
- **Inputs:** Mixed-income profile; gross so far ₱1,200,000; months in 6
- **Steps:**
  1. Projected annual gross = 1,200,000 / 6 x 12 = 2,400,000 (below ₱3M, so 8% is available)
  2. 8% x 2,400,000 = 192,000 (no ₱250,000 reduction for mixed income)
  3. Per month = 192,000 / 12 = 16,000
- **Correct result:** ₱192,000; ₱16,000 a month
- **App result:** ₱2,400,000 · ₱172,000 · ₱14,333 (browser, ytd_out.json)

#### GAP:GW-5: YTD projector, purely self-employed (control case)  (✔ matches; see H12)
- **Inputs:** Self-employed 8% profile; gross so far ₱240,000; months in 6
- **Steps:**
  1. Projected annual gross = 480,000
  2. 8% x (480,000 - 250,000) = 8% x 230,000 = 18,400 (NIRC Sec 24(A)(2)(b))
  3. Per month = 18,400 / 12 = 1,533.33, which shows as ₱1,533
- **Correct result:** ₱18,400; ₱1,533 a month
- **App result:** ₱480,000 · ₱18,400 · ₱1,533

#### GAP:GW-6: YTD projector, VAT-registered individual and corporation  (✘ differs; see H12)
- **Inputs:** Active profile = VAT-registered individual on OSD (then a corporation); gross so far ₱240,000; months in 6
- **Steps:**
  1. Projected annual gross = 480,000
  2. A VAT-registered individual cannot elect 8% (RR 8-2018); graduated rates plus VAT apply. A corporation can never use the individual 8% option
  3. So no 8% figure should be shown, or it should say the option is not available
- **Correct result:** No '8% tax' or 'set aside' figure, or a clear 'not available to this profile' note
- **App result:** Both profiles: 'Estimated 8% tax ₱18,400 · Set aside / month ₱1,533' with no warning (browser, ytd_out.json)

#### GAP:GW-7: Community tax reminder for an employee profile  (✘ differs; see L23)
- **Inputs:** Employee profile (single employer), calendar window 2026-01-01 to 2027-04-30 (scripts/calendar-audit.mjs)
- **Steps:**
  1. RA 7160 Sec 157 (reviewer's reading, not re-fetched): an individual regularly employed on a wage or salary for at least 30 consecutive working days in a calendar year pays the community tax
  2. Sec 161: it accrues on January 1 and is payable by the last day of February
  3. Feb 28, 2027 is a Sunday (python datetime). The app moves business-profile cedula dates to Monday Mar 1, 2027; whether LGU dates roll over is UNVERIFIED (DL-06)
- **Correct result:** A 'Pay community tax (cedula)' reminder due by the end of February 2027 for the employee profile
- **App result:** Employee calendar has only 'Collect BIR Form 2316' (2026-02-02, 2027-02-01); no CTC item. Business profiles show CTC on 2026-03-02 and 2027-03-01

### 3.6 Posted information

#### INF:W-INF-1: Blog rule of thumb: 8% beats graduated + itemized when costs are under about 40% of income  (✔ matches)
- **Inputs:** Pure self-employed, non-VAT, gross sales of ₱500,000, ₱1,000,000, ₱2,000,000 and ₱3,000,000; find the expense ratio at which graduated + itemized (plus 3% percentage tax) ties with 8%
- **Steps:**
  1. 1. 8% tax = (Gross - ₱250,000) x 8% (NIRC Sec 24(A)(2)(b), as amended by TRAIN; RR 8-2018). ₱500k: 20,000. ₱1M: 60,000. ₱2M: 140,000. ₱3M: 220,000.
  2. 2. The graduated route also pays 3% percentage tax = Gross x 3% (NIRC Sec 116; 3% from Jul 1, 2023). ₱500k: 15,000. ₱1M: 30,000. ₱2M: 60,000. ₱3M: 90,000.
  3. 3. Graduated income tax needed to tie = step 1 - step 2: ₱5,000; ₱30,000; ₱80,000; ₱130,000.
  4. 4. Invert the 2023+ table (Sec 24(A)(2)(a)): ₱5,000 -> 250,000 + 5,000 / 0.15 = ₱283,333.33. ₱30,000 -> 400,000 + (30,000 - 22,500) / 0.20 = ₱437,500. ₱80,000 -> 400,000 + (80,000 - 22,500) / 0.20 = ₱687,500. ₱130,000 -> 800,000 + (130,000 - 102,500) / 0.25 = ₱910,000.
  5. 5. Break-even expenses = Gross - net: ₱216,666.67 (43.33%), ₱562,500 (56.25%), ₱1,312,500 (65.63%), ₱2,090,000 (69.67%).
  6. 6. Below about 43% costs, 8% wins at these income levels, so the blog's 'under about 40% -> 8% usually wins; above that, run both' holds. Nuance: at gross ₱400,001-₱437,499 the break-even is between 37.5% and 40% (e.g. ₱420,000: 38.89%), so 'about' and 'usually' are needed; below ₱400,000 gross the 3% percentage tax alone is at least the 8% tax, so 8% never loses.
- **Correct result:** Ties at expenses of ₱216,666.67 / ₱562,500 / ₱1,312,500 / ₱2,090,000; one peso more of expenses makes itemized cheaper.
- **App result:** Verifier re-run of estimateIndividual: (500,000; 216,666) 8%=20,000, itemized=20,000.10 -> 8%. (500,000; 216,667) itemized=19,999.95 -> itemized. (1,000,000; 562,500) tie 60,000 -> 8%; 562,501 -> itemized 59,999.80. (2,000,000; 1,312,500) tie 140,000 -> 8%; +1 -> itemized 139,999.80. (3,000,000; 2,090,000) tie 220,000 -> 8%; +1 -> itemized 219,999.75.

#### INF:W-INF-2: Estimator default example (₱480,000 gross, ₱180,000 expenses)  (✔ matches)
- **Inputs:** Pure self-employed, non-VAT, gross ₱480,000, itemized expenses ₱180,000, no 2307s (Estimator.jsx:83 defaults)
- **Steps:**
  1. 1. 8%: (480,000 - 250,000) x 8% = ₱18,400 (no percentage tax).
  2. 2. OSD: net = 480,000 x 60% = 288,000. Tax = (288,000 - 250,000) x 15% = ₱5,700. Plus 3% percentage tax 480,000 x 3% = 14,400. Total ₱20,100.
  3. 3. Itemized: net = 480,000 - 180,000 = 300,000. Tax = (300,000 - 250,000) x 15% = ₱7,500. Plus 14,400 = ₱21,900.
  4. 4. Cheapest = 8% at ₱18,400; saving versus the next best (OSD) = 20,100 - 18,400 = ₱1,700.
- **Correct result:** 8% ₱18,400; OSD ₱20,100; itemized ₱21,900; 8% shown as lowest, saving ₱1,700
- **App result:** 8pct=18400 osd=20100 itemized=21900, best 8pct, savingsVsNext 1700 (verifier re-run)

#### INF:W-INF-3: Withholding example quoted on the References page (₱50,000 monthly taxable pay)  (✔ matches)
- **Inputs:** Monthly taxable compensation ₱50,000, monthly table (RR 11-2018 Annex E, effective Jan 1, 2023)
- **Steps:**
  1. 1. ₱50,000 falls in the bracket over ₱33,333 up to ₱66,666: base ₱1,875 + 20% of the excess over ₱33,333.
  2. 2. Excess = 50,000 - 33,333 = ₱16,667.
  3. 3. 20% x 16,667 = ₱3,333.40.
  4. 4. Tax = 1,875 + 3,333.40 = ₱5,208.40.
- **Correct result:** ₱5,208.40
- **App result:** withholdingForPeriod(50000,'monthly') = 5208.4 (verifier re-run)

#### INF:W-INF-4: Holiday shift for deadlines falling on Sunday Oct 31, 2027  (✘ differs; see H03)
- **Inputs:** Q3-2027 1601-EQ / 1601-FQ / QAP (last day of the month after the quarter), September 2027 SSS employer remittance, September 2027 self-employed SSS and PhilHealth (last day of the following month). All have a raw due date of Oct 31, 2027.
- **Steps:**
  1. 1. Oct 31, 2027 is a Sunday -> move to the next working day (BIR rule printed on the tax calendar and forms; app shiftRule).
  2. 2. Mon Nov 1, 2027 = All Saints' Day, special non-working (RA 9492; in the app's list) -> move again.
  3. 3. Tue Nov 2, 2027 = All Souls' Day, an additional special non-working day under Proclamation 1427 s. 2026 (reported; not re-fetched by the verifier) -> move again (app rule: weekday special non-working days shift deadlines, holidays.json:7).
  4. 4. Wed Nov 3, 2027 = working day.
- **Correct result:** Nov 3, 2027 (if Proclamation 1427 is as reported)
- **App result:** 2027-11-02 for 1601-EQ Q3, 1601-FQ Q3, QAP Q3, SSS R-5/PRN Sep 2027, SSS PRN (self-employed) Sep 2027, PhilHealth SPA Sep 2027 (verifier re-run, scratch posted-info-verify/hol2027.mjs)

#### INF:W-INF-5: Annual return form for a VAT-registered mixed-income earner on OSD  (✘ differs; see H08)
- **Inputs:** Profile type: Mixed income; VAT-registered: on; deduction: Graduated + OSD
- **Steps:**
  1. 1. Form 1701A is for individuals earning income PURELY from business or profession, on 8% or graduated with OSD (RMC 17-2019).
  2. 2. A mixed-income earner also has compensation income, so the 1701A is not available.
  3. 3. The correct annual return is BIR Form 1701 (NIRC Sec 51; form guidelines).
- **Correct result:** Form 1701
- **App result:** Profile wizard card (ProfileWizard.jsx:147): '40% Optional Standard Deduction: simpler books, files 1701A.' Calendar: '2027-04-15 bir-1701-annual 1701'. Estimator OSD option: '1701Q + 1701 + 2550Q' (verifier re-run, scratch posted-info-verify/ws.mjs).

#### INF:W-INF-6: Tools page default late-payment penalty (labels and amounts)  (✘ differs; see C03)
- **Inputs:** Basic tax due ₱50,000; 60 days late; taxpayer size Micro/Small (Tools.jsx:15-17 defaults)
- **Steps:**
  1. 1. Surcharge: 10% (NIRC Sec 248 as amended by EOPT for micro and small) x 50,000 = ₱5,000.00.
  2. 2. Interest: 6% a year (half of 12%, Sec 249 as amended by EOPT) x 50,000 x 60/365 = 36,000/73 = ₱493.1507 -> ₱493.15.
  3. 3. Compromise: tier ₱20,001-₱50,000 = ₱10,000 (RMO 7-2015 Annex A). No 50% cut: RR 6-2024 limits the micro/small 50% compromise reduction to invoicing violations (Secs 113, 237, 238) not involving fraud; late filing/payment is not one of them (see TB-01).
  4. 4. Total = 50,000 + 5,000 + 493.15 + 10,000 = ₱65,493.15.
- **Correct result:** ₱65,493.15 (surcharge ₱5,000.00; interest ₱493.15; compromise ₱10,000.00), and no ', 50% off' in the compromise label
- **App result:** estimatePenalty: surcharge 5000, interest 493.1506849315068, compromise 5000, total 60493.150684931505 -> displayed ₱60,493.15; label 'Compromise penalty (RMO 7-2015 schedule, 50% off)' (verifier re-run)

#### INF:W-INF-7: Blog 8% formula versus the engine for a mixed-income earner  (✔ matches; see H09)
- **Inputs:** Mixed income; business gross ₱600,000; taxable compensation ₱500,000; non-VAT; 8% option
- **Steps:**
  1. 1. Compensation stays on the graduated table (Sec 24(A)(2)(a)): 22,500 + 20% x (500,000 - 400,000) = ₱42,500.
  2. 2. Business on 8% for a mixed-income earner: 8% x all business gross, no ₱250,000 reduction (RR 8-2018; RMC 50-2018) = 8% x 600,000 = ₱48,000.
  3. 3. Total income tax = 42,500 + 48,000 = ₱90,500.
  4. 4. The blog's formula ('8% on gross receipts above ₱250,000') would give (600,000 - 250,000) x 8% = ₱28,000 on the business, ₱20,000 too low.
- **Correct result:** Business 8% tax ₱48,000; total ₱90,500
- **App result:** estimateIndividual 8% option rows: compensation tax 42500; 'Income tax on business @ 8% of gross = 48000'; total 90500 (scratch posted-info-verify/w7.mjs). The engine is right; only the blog text is incomplete.

### 3.7 Input and flow cases

#### BUG:W1: Self-employed (8%) with a 2307 credit entered with centavos  (✘ differs; see C01)
- **Inputs:** Profile Ana: individual, non-VAT, 8%. TY 2026. Gross sales 480,000; itemized expenses 180,000; 2307 tax withheld pasted as '4,800.00' (meaning ₱4,800.00).
- **Steps:**
  1. Rates (verified OK in the individual area): 8% of gross over ₱250,000 (NIRC Sec 24(A)(2)(b)); graduated table 2023+ (Sec 24(A)(2)(a)); OSD 40% of gross (Sec 34(L)); percentage tax 3% (Sec 116).
  2. 8% option: 480,000 - 250,000 = 230,000; 230,000 x 8% = 18,400.00
  3. Graduated + OSD: 480,000 x 60% = 288,000; (288,000 - 250,000) x 15% = 5,700.00; percentage tax 480,000 x 3% = 14,400.00; total 20,100.00
  4. Graduated + itemized: 480,000 - 180,000 = 300,000; (300,000 - 250,000) x 15% = 7,500.00; + 14,400.00 = 21,900.00
  5. Lowest = 8% option, 18,400.00
  6. Less 2307 credits 4,800.00: 18,400.00 - 4,800.00 = 13,600.00 still payable
- **Correct result:** Tax still payable ₱13,600.00 (8% option, ₱18,400.00 total tax)
- **App result:** Field shows '480,000'. Breakdown: 'Less: creditable tax withheld (₱480,000.00) / Overpayment: refund or carry over ₱461,600.00'. Engine netPayable -461,600 (verifier re-run, bugs-verify/v1.cjs and v_engine.mjs). With 4800 entered as a whole number the engine gives 13,600 (correct).

#### BUG:W2: Self-employed gross sales entered with centavos  (✘ differs; see C01)
- **Inputs:** Profile Ana (non-VAT, 8%); TY 2026; gross typed '480,000.50'; expenses 180,000; CWT 0
- **Steps:**
  1. Gross 480,000.50 is below the ₱3,000,000 threshold (app value; VAT threshold not re-verified here), so the 8% option is available
  2. 8% option: (480,000.50 - 250,000) x 8% = 230,000.50 x 0.08 = 18,400.04
  3. OSD: 480,000.50 x 60% = 288,000.30; (288,000.30 - 250,000) x 15% = 5,700.045, rounded 5,700.05; percentage tax 480,000.50 x 3% = 14,400.015, rounded 14,400.02; total 20,100.07
  4. Itemized: (300,000.50 - 250,000) x 15% = 7,500.08; + 14,400.02 = 21,900.10
  5. Lowest = 8% option, 18,400.04; no over-threshold or VAT warning
- **Correct result:** 8% option is the cheapest at ₱18,400.04; no VAT warning
- **App result:** Field shows '48,000,050'. The VAT-threshold warning appears; the 8% card is N/A; banner 'Graduated + OSD (40%) is the cheapest eligible option at ₱9,482,511'. Engine: 48,000,050 x 60% = 28,800,030; 2,202,500 + 35% x 20,800,030 = 9,482,510.50 (verifier re-run).

#### BUG:W3: Penalty calculator with tax due entered with centavos  (✘ differs; see C01)
- **Inputs:** Tools page: Basic tax due '1,234.56'; Days late 60; Taxpayer size Micro/Small; violation in 2026
- **Steps:**
  1. Rates: surcharge 10% and interest 6% p.a. for micro/small (EOPT, violations from Jan 22, 2024; RR 6-2024, verified in the penalties area); compromise per RMO 7-2015 Annex A, tier 'tax due ₱5,000 and below' = ₱1,000. The penalties area (TB-01) found the EOPT 50% compromise reduction does not cover late filing/payment, so it is not applied here. Day count actual days / 365 as in the app (convention UNVERIFIED in the penalties area).
  2. Surcharge: 1,234.56 x 10% = 123.456, rounded 123.46
  3. Interest: 1,234.56 x 6% x 60/365 = 12.1765, rounded 12.18
  4. Compromise: ₱1,000.00
  5. Total: 1,234.56 + 123.46 + 12.18 + 1,000.00 = 2,370.20
  6. Under the app's own (disputed) 50% compromise reduction the total would be 1,234.56 + 123.46 + 12.18 + 500.00 = 1,870.20
- **Correct result:** Estimated total to pay ₱2,370.20 (₱1,870.20 if the app's 50% compromise reduction were right); either way far from the app's figure
- **App result:** Field shows '₱123,456'. Surcharge ₱12,345.60; Interest ₱1,217.65; Compromise ₱10,000.00; 'Estimated total to pay ₱147,019.25' (verifier re-run)

#### BUG:W4: Employee monthly salary entered with centavos  (✘ differs; see C01)
- **Inputs:** Profile Dan (employee); TY 2026; Monthly basic salary '15,000.75'; allowances 0; bonuses 0
- **Steps:**
  1. Contribution rules (verified in the withholding area): SSS employee 5% of the monthly salary credit; 15,000.75 falls in the 14,750 to 15,249.99 range, MSC 15,000; 15,000 x 5% = 750.00
  2. PhilHealth: 15,000.75 x 5% = 750.0375 premium; employee half 375.01875, rounded 375.02
  3. Pag-IBIG: 2% x min(10,000, 15,000.75) = 200.00
  4. Monthly taxable = 15,000.75 - (750.00 + 375.02 + 200.00) = 13,675.73
  5. 13,675.73 is not over 20,833 (RR 11-2018 Annex E monthly table, 2023+), so withholding = 0.00; take-home 13,675.73
- **Correct result:** Withholding tax this month ₱0.00; take-home ₱13,675.73
- **App result:** Field shows '1,500,075'. 'Withholding tax this month ₱473,677.10' (183,541.80 + 35% x (1,495,625 - 666,667)); take-home ₱1,021,947.90; annual tax ₱5,684,125.00. Engine with 15000.75 typed correctly gives withholding 0 and take-home 13,675.73 (verifier re-run).

#### BUG:W5: Penalty calculator with 0 days late  (✘ differs; see H17)
- **Inputs:** Tools page: Basic tax due 50,000; Days late 0; Micro/Small
- **Steps:**
  1. 0 days late means filed and paid on the due date, so the return is not late (Sec 248(A) surcharge is for failure to file/pay on or before the prescribed date; Sec 249 interest runs from the due date)
  2. Surcharge = 0; interest = 50,000 x 6% x 0/365 = 0; compromise penalty = 0
  3. Total to pay = basic tax 50,000.00
- **Correct result:** ₱50,000.00 (no penalties)
- **App result:** Surcharge ₱5,000.00; Interest ₱0.00; Compromise ₱5,000.00; 'Estimated total to pay ₱60,000.00' (verifier re-run)

#### BUG:W6: Established corporation whose start year cannot be selected  (✘ differs; see H13)
- **Inputs:** Domestic corporation registered and operating since 1990; TY 2026 (calendar year); gross sales 10,000,000; cost of sales 2,000,000; opex 7,800,000; total assets excluding land 1,000,000; 'Year operations began' = 'Not sure' (1990 is not in the 2026-1997 list)
- **Steps:**
  1. Rates (verified in the withholding/corporate area): RCIT 20% if taxable income ≤ ₱5M and assets ≤ ₱100M excluding land, else 25% (NIRC Sec 27(A), CREATE); MCIT 2% of gross income since Jul 1, 2023 (RMC 69-2023), from the 4th taxable year following the start year (Sec 27(E); RR 9-98 counts from the year of BIR registration)
  2. Gross income = 10,000,000 - 2,000,000 = 8,000,000
  3. Taxable income = 8,000,000 - 7,800,000 = 200,000
  4. Small-corporation test: 200,000 ≤ 5,000,000 and 1,000,000 ≤ 100,000,000, so 20%; RCIT = 200,000 x 20% = 40,000
  5. MCIT applies (1990 + 4 = 1994 ≤ 2026): 8,000,000 x 2% = 160,000
  6. Income tax due = higher of RCIT and MCIT = 160,000
- **Correct result:** Income tax due ₱160,000.00 (MCIT)
- **App result:** Engine with registrationYear null: rcit 40,000, mcit 0, mcitApplies false, incomeTaxDue 40,000; headline 'Income tax due: ₱40,000 at the 20% small-corporation rate.' With start year 1997 selected instead: incomeTaxDue 160,000 (verifier re-run, bugs-verify/v_engine.mjs)

#### BUG:W7: Countdown for a user outside the Philippines  (✘ differs; see H01)
- **Inputs:** Profile Fox Corp (corporation, employer, start year 2020). Instant 2026-10-13 01:00 Manila. Browser time zone America/Los_Angeles, Asia/Riyadh or UTC.
- **Steps:**
  1. 1601-C for September 2026 is due Saturday Oct 10, 2026, moved to Monday Oct 12 (next business day, RMC 65-2016 per the deadlines area; weekdays checked with python)
  2. In Manila it is already Tuesday Oct 13, so the Oct 12 deadline has passed
  3. Next deadline in the app's own list for this profile (as the Manila browser shows): 2307 issuance for Q3, Oct 20, 2026; Oct 20 - Oct 13 = 7 days
- **Correct result:** Header 'Oct 13, 2026'; next deadline 2307, Oct 20, 7 days left (what the Asia/Manila browser shows)
- **App result:** LA, Riyadh and UTC browsers: header 'Oct 12, 2026'; next deadline '1601-C Sep 2026 ... 0 days left Oct 12, 2026' (verifier re-run, bugs-verify/v2.cjs)

## 4. Findings

Severity: **Critical** = wrong tax amount or deadline, or data loss/leak. **High** = misleading information or a broken feature. **Medium** = edge case or UX problem. **Low** = polish. IDs start with the severity letter. "Decision" is filled in from Phase 3.

### 4.1 Findings table

| ID | Severity | Area | Problem | Effect on users | Proposed fix | Decision |
|---|---|---|---|---|---|---|
| C01 | Critical | Bugs / Tax logic | Every peso box deletes the decimal point and the minus sign. "1,234.56" becomes ₱123,456, "-500" becomes 500, "1e6" becomes 16, and a typed "." simply vanishes. A cleared box turns into 0. No message is shown. | Amounts copied from a 2307, 2316 or payslip come out 100 times too big, and the wrong figure is saved to the profile. Example: ₱4,800.00 of 2307 credit is read as ₱480,000 and the app shows a ₱461,600 refund instead of ₱13,600 payable. | Accept pesos and centavos (one decimal point, up to 2 decimals) and hold amounts as whole centavos. Reject letters, minus signs and impossible amounts with a short message instead of changing them. Decimal keypad on phones. Add the commas when the user leaves the box (this also fixes M16). | Pending |
| C02 | Critical | Tax logic | When graduated rates win, the "Tax payable with the annual return" line adds the 3% percentage tax to income tax and then subtracts 2307s and employer withholding from the combined amount. The "Where it lands on the return" card also never shows the taxable-income line. | Wrong amount to pay or refund on the 1701/1701A preview and breakdown. Example: ₱420,000 sales with ₱21,000 of 2307s shows an ₱8,100 overpayment; the correct 1701A overpayment is ₱20,700, with ₱12,600 percentage tax paid separately on the 2551Q. | Annual-return line = income tax due minus income-tax credits only. Show percentage tax on its own line ("paid quarterly on 2551Q, not on the annual return"). Fill in the taxable-income line. | Pending |
| C03 | Critical | Tax logic | The late-filing penalty calculator halves the compromise penalty for micro and small taxpayers. RR 6-2024 gives the 50% cut only for violations of NIRC Secs 113, 237 and 238 (invoicing), not for late filing or late payment (Sec 255). The References notes and a unit test repeat the error. | Every micro/small result understates the total by ₱500 to ₱25,000. The page opens on Micro/Small with ₱50,000 tax 60 days late and shows ₱60,493.15; the correct figure is ₱65,493.15. | Use the full RMO 7-2015 Annex A amount for late filing/payment. Remove ", 50% off" from the label and the rulebook notes. Correct the unit test and add tests at every tier edge. | Pending |
| C04 | Critical | Tax logic | The Employee and Payroll calculators have no "minimum wage earner" option, so a minimum wage earner's statutory pay goes through the withholding table. The rulebook has the exemption rule but nothing uses it, and it cites RR 10-2008 (struck down in part by Soriano, 2017) instead of RR 11-2018. | Over-withholding. An NCR minimum wage earner at ₱695/day (₱18,128/month) with ₱6,000 commissions is shown ₱261.27/month withheld and ₱3,134.64/year; the correct figure is ₱0. | Add a minimum-wage-earner switch with the statutory daily rate and pay factor. Exempt the statutory wage plus holiday, overtime, night-differential and hazard pay; tax only other pay and benefits above ₱90,000. Cite RR 11-2018 and Soriano. | Pending |
| C05 | Critical | Tax logic | SSS is computed on basic salary only. Regular allowances, commissions and other pay the user enters are ignored for SSS, although the SSS law counts all actual pay up to the ₱35,000 cap. | Wrong SSS, and through it wrong withholding. ₱15,000 basic + ₱10,000 regular allowance: employee SSS ₱750 (should be ₱1,250), employer ₱1,530 (should be ₱2,530), withholding ₱426.30 (should be ₱351.30). An employer would under-remit ₱1,500 a month. | SSS on all regular pay (MSC cap ₱35,000), PhilHealth on basic salary, Pag-IBIG on its own base. Split the allowance box into "regular" and "one-time / liquidated". | Pending |
| C06 | Critical | Tax logic | The corporate estimator always uses the device's current calendar year as the taxable year. There is no year choice and the result does not say which year it is. MCIT is one 2% rate for every year. | Wrong MCIT test in filing season and for fiscal-year corporations. A corporation registered in 2023 that prepares its TY2026 return in March 2027 is told MCIT of ₱120,000 applies; the correct tax is the ₱20,000 regular tax (MCIT starts in TY2027). | Add a taxable-year choice that defaults to the year whose return is due next (Manila date, fiscal-year aware) and show it on the result. Keep MCIT/RCIT rates with effective dates (1% Jul 2020 to Jun 2023, prorated). | Pending |
| C07 | Critical | Bugs | With the app open in two browser tabs, saving estimator figures in one tab writes back that tab's old copy of the whole profile. | Silent data loss. Renames, VAT or regime switches and employer settings made in the other tab are undone, and a deleted client comes back. A client switched to VAT can revert to non-VAT, so the calendar shows the wrong filings. | Reload profiles when another tab changes them. When saving figures, update only the figures on the latest stored profile. Never re-create a deleted profile. In accounts mode, reject stale saves. | Pending |
| C08 | Critical | UI/UX | In "Edit profile", tapping the taxpayer-type card that is already selected resets every registration answer (regime, VAT, books, employees, 2307s, EWT, permits, year-end, start year) to defaults, with no warning. | Silent loss of settings and deadlines. In the test, an employer profile dropped from 110 to 47 dated obligations (every payroll filing gone) and its regime flipped from graduated to 8%. | Ignore taps on the selected type. When the type really changes on an existing profile, ask first and keep the answers both types share. | Pending |
| H01 | High | Tax logic (dates) | "Today", "days left" and "overdue" follow the device's clock and time zone, not Philippine time. The dashboard's "today" never refreshes after midnight, and a deadline due today reads "0 days left". | Users abroad (OFWs, overseas bookkeepers) see a Manila deadline that has already passed as "0 days left" for hours (about 15 in Los Angeles), or one extra day on every countdown, and may file late. The corporate tax year and the wizard year list switch at the device's New Year. | One helper for the Manila calendar date, used by the dashboard, the estimator year and the wizard. Refresh at Manila midnight and when the tab regains focus. Show "Due today" instead of "0 days left". | Pending |
| H02 | High | Tax logic (deadlines) | The October 15 second installment of annual income tax (NIRC Sec 56(A)(2): tax due over ₱2,000 may be paid half at filing, half by Oct 15) is not on any calendar. | Individuals who paid half in April get no reminder. The TY2025 second half is due Thursday, Oct 15, 2026, eight days from this review. Paying late brings surcharge and interest. | Add an Oct 15 item, "2nd installment of annual income tax (only if you paid half with your return)", for individuals who file 1700, 1701 or 1701A. | Pending |
| H03 | High | Tax logic (deadlines) | The 2027 holiday list lacks the four extra non-working days in Proclamation 1427 s.2026 (Feb 6, Mar 27, Nov 2 and Dec 24, 2027), and the data file says the proclamation has not been issued. | 63 deadline occurrences show Tue Nov 2, 2027 instead of Wed Nov 3, 2027 (Q3 1601-EQ, 1601-FQ, QAP; September SSS and PhilHealth; some fiscal-year corporate items). The shown date is one day early, so it is safe, but it is wrong. | Add the four dates citing Proc 1427 s.2026, update the notes and the References text, and add a test (1601-EQ Q3 2027 becomes Nov 3). | Pending |
| H04 | High | Tax logic | When a non-VAT taxpayer's sales pass ₱3M, the app drops percentage tax for the whole year and says "the 3% percentage tax no longer applies". It gives no credit for 8% quarterly payments already made, and the banner can still say the regime is 8%. | Under RR 8-2018 the whole year moves to graduated rates with the 8% payments credited, 3% percentage tax still applies to sales until VAT liability, and VAT starts the month after the threshold is crossed. Example: ₱3.2M sales leaves about ₱90,000 of percentage tax out of the total. | Ask for the month the ₱3M was crossed. Compute 3% on sales before VAT and show VAT as applying after. Add an input for 8% payments already made. Correct the banner and the unit test that locks in the wrong behaviour. | Pending |
| H05 | High | Tax logic | VAT is never computed. The breakdown says "see the VAT panel", which does not exist. Option cards show "VAT 12%" where an amount belongs, and "Total annual tax" leaves VAT out. VAT-registered users under ₱3M get no "VAT not included" note. | VAT-registered users look for a feature that is not there and may read income tax as their whole tax bill. Example: ₱4M sales with ₱1.5M VATable purchases leaves ₱300,000 of VAT out. | Either add a simple quarterly VAT estimate (output VAT less input VAT, excess carried over), or remove the pointer and label every VAT-case total "income tax and percentage tax only; VAT not included". | Pending |
| H06 | High | Tax logic | There is no box for income tax already paid on the quarterly returns (1701Q, 1702Q) or for prior-year excess credits, and the "payable with the annual return" line ignores them. Quarterly amounts are not computed, and the page does not say so. | The annual payable is overstated by the full quarterly payments. An 8% filer with ₱1.2M sales who paid every quarter still sees ₱76,000 due. A corporation that paid ₱450,000 on its 1702Qs sees ₱500,000 instead of ₱50,000. | Add "quarterly payments made this year" and "prior-year excess credits" boxes and subtract them, or compute the 1701Q/1702Q schedule. Say clearly what the figure includes. | Pending |
| H07 | High | Posted information | Rules the rulebook marks "needs review" are shown as firm: the SEC AFS date for 2027, PhilHealth and Pag-IBIG self-employed dates, e-invoicing, the 2027 holidays, VAT registration timing, the minimum wage, CRM/POS and FBT notes. The References page shows neither the values nor the flags, yet says it shows "exactly what the calculators use". | Users and the owner cannot tell confirmed dates from unconfirmed ones. 27 of the 47 items on a default freelancer calendar come from two unconfirmed rules. | Show an "unconfirmed: check with the agency" badge on calendar rows, checklist items and References entries. Show each rule's value on References. Show obligation notes on calendar rows. | Pending |
| H08 | High | Posted information | Profile setup tells a VAT-registered mixed-income earner on OSD that they file Form 1701A. The 8% card for mixed income says "in lieu of graduated rates" without saying the salary is still taxed at graduated rates. | Mixed-income users may prepare the wrong annual return (1701A instead of 1701), or think 8% removes graduated tax on their salary. | Choose the card text by profile type: mixed income files 1701. Reword the 8% card for mixed income. | Pending |
| H09 | High | Posted information | Blog posts are out of date or incomplete: "Issue a BIR-registered invoice for every payment you receive" (pre-EOPT receipt habit; the invoice is issued at each sale); eAFS "within 15 days of filing"; the 8% post omits that mixed-income earners get no ₱250,000 reduction and that 8% is only for non-VAT taxpayers at or below ₱3M. | Freelancers may invoice when paid instead of when they sell (wrong quarter on the 2551Q/2550Q). A mixed-income earner using the post understates the 8% tax by ₱20,000. | Rewrite those sentences and add a "last reviewed" date to each post. | Pending |
| H10 | High | Posted information | The References entry on the NCR minimum wage still says ₱695 / ₱658 (Wage Order NCR-26) is operative. Wage Order NCR-28 raised it to ₱755 / ₱718 from Sept 26, 2026. | Anyone judging minimum-wage-earner status from the app uses a floor ₱60 too low. Display only today; it matters more once C04 adds the minimum-wage option. | Update to the NCR-28 rates and date, cite the wage order, and bump the verified date. | Pending |
| H11 | High | Posted information | Profile setup says loose-leaf books are due "every January 15" and CAS back-ups "by January 30". For fiscal-year taxpayers both run from their own year-end (15 and 30 days). The calendar itself is right. | A June-year-end corporation is told January during setup, while its calendar says July 15 and July 30. | Build the text from the rule: "15 days (loose-leaf) or 30 days (CAS) after your taxable year ends (Jan 15 / Jan 30 for calendar-year)". | Pending |
| H12 | High | Tax logic | The Tools "Year-to-date projector" always subtracts ₱250,000 and shows an 8% tax for every profile, including mixed-income earners (no reduction allowed), VAT-registered individuals and corporations (8% not available). "Months in" above 12 is silently treated as 12. "Projected annual income" is really projected gross sales. | A mixed-income earner with ₱240,000 sales in 6 months is told to set aside ₱1,533 a month (₱18,400 a year); the correct figure is ₱3,200 a month (₱38,400). VAT-registered and corporate users see a tax that does not apply to them. | Follow the active profile (or ask "purely self-employed or mixed income?"). Hide the 8% line for VAT-registered and corporate profiles. Accept 1 to 12 months only, with a message. Rename the label. Move the math into the tested engine. | Pending |
| H13 | High | Tax logic | Corporate MCIT start year: the wizard lists only 1997 to 2026 and defaults to "Not sure". With "Not sure" the estimator skips MCIT and headlines the regular tax alone. The question asks "year operations began", but RR 9-98 counts from the year of BIR registration. | Established corporations see an understated headline tax (₱40,000 shown where MCIT makes it ₱160,000), or enter a start year that gives the wrong MCIT test. | Ask "Year registered with the BIR (for MCIT)" and allow any year or "1997 or earlier". When unknown, show both RCIT and MCIT with a warning instead of RCIT alone. | Pending |
| H14 | High | Security / privacy | There is no privacy notice, consent step or terms anywhere, although the app collects client names, income, withholding and (in accounts mode) email addresses, and autosaves figures without saying so. Third parties are not disclosed (Supabase, Google Fonts, GitHub Pages hosting logs). | Users and their clients are not told how their data is handled, which exposes the operator under the Data Privacy Act (RA 10173). | Add a Privacy Notice page linked from the footer, sign-up and profile setup; a consent line at sign-up; a note that typed figures are saved to the profile; and a contact/DPO line (owner to supply the details). | Pending |
| H15 | High | UI/UX | On phones (360 px wide) the deadline list, the Forms list and the Profiles list are squashed: titles wrap one word per line, due-date text is cut off, and tags overlap the Edit button. | The main screens are hard or impossible to read on a phone. The Forms page hides the due-date wording of 12 forms. | Below 720 px, stack each row (date and title, then description, then tags) and let tags and due-date text wrap. | Pending |
| H16 | High | Code health | Rates, thresholds and due dates are typed as fixed text in about 40 places (labels, banners, wizard text) instead of being read from the rulebook, and several rulebook values are never read. The README says law changes need no code edits. | When the rulebook is updated (for example a CPI adjustment of the ₱3M threshold, TY2027 brackets, or a new ₱90,000 cap), the math changes but labels and help text keep the old numbers. One copy has already drifted (H11). | Build labels from rulebook values, move the remaining constants into the rulebook, wire up or delete unused values, and add a test that fails when a tax number is typed into a page. Correct the README until then. | Pending |
| H17 | High | Tax logic | The penalty calculator asks only "days late". It has no due date or payment date, no weekend/holiday roll-over, applies the EOPT micro/small rates even to returns due before Jan 22, 2024 (and has no 20% pre-2018 interest), and still charges surcharge and compromise when days late is 0 or blank. | Miscounted interest. Pre-2024 micro/small cases are understated: a ₱20,000 1701Q due Nov 15, 2023 and paid Jan 15, 2024 shows ₱24,700.55; the correct figure is ₱30,401.10. A taxpayer who paid on time is shown ₱60,000 to ₱72,500 of penalties on ₱50,000. | Ask for the original due date and the payment date (Manila time). Use the deadline engine's rolled-over date. Choose the rates by violation date. Show "Not late: no penalty" when paid on time. | Pending |
| M01 | Medium | Tax logic | The individual estimator has no taxable-year label or choice, and every rule holds one value with no effective dates (the 2018-2022 graduated table and the 1% percentage tax of Jul 2020 to Jun 2023 are not modelled). | Correct for TY2026, wrong if used for TY2018 to TY2023 (amended returns, audits). ₱500,000 gross in TY2022 shows 8% as best at ₱20,000; the correct best is OSD at ₱15,000. A TY2027 law change entered in place would also change TY2026 returns prepared in early 2027. | At minimum, print "Rates for taxable year 2026". If other years are needed, store rules with effective dates and add a year selector. | Pending |
| M02 | Medium | Tax logic | The 8% test and base ignore "other non-operating income", and the app never asks whether the business is subject to other percentage taxes (Secs 117-127), which rules out 8%. | Someone with ₱2.9M sales and ₱200,000 other income (₱3.1M) is shown 8% as available and cheapest. Below ₱3M the 8% tax is understated by 8% of that income. | Add the input; include it in the ₱3M test and the 8% base but not in the OSD or percentage-tax base. Add a yes/no for other percentage taxes. | Pending |
| M03 | Medium | Tax logic / Code health | All tax math uses floating-point numbers with three different rounding methods. BIR income tax returns are filled in whole pesos per line (49 centavos or less dropped, 50 or more rounded up), but the app rounds only for display. Card parts often do not add to the card total (about 1 card in 4); a total ending in exactly 50 centavos can show ₱1 low; payslip rows do not foot; PhilHealth halves add to 1 centavo more than the premium. | Small ₱1 or ₱0.01 differences from the return or payslip, and visibly non-footing figures, undermine trust in the numbers. | Hold money in whole centavos with one rounding helper. Round return figures to whole pesos per form line and add the rounded lines for totals. Round payslip and penalty lines to the centavo. Set the PhilHealth employer share to premium minus employee share. | Pending |
| M04 | Medium | Tax logic | Itemized expenses above gross silently become ₱0 net income: no loss is shown, and there is no NOLCO input or tracking (corporate costs above sales behave the same way). | Users are not told they have a loss to carry over, and a later year's itemized estimate overstates tax, which can tilt the recommendation. | Show the net loss and the NOLCO it creates, with its expiry year. Add an optional "NOLCO from prior years" box applied only to the itemized option. Confirm the carry-over period for 2020-2021 losses first. | Pending |
| M05 | Medium | Bugs | Every estimator mode starts with sample figures (₱480,000 gross, ₱600,000 compensation with ₱62,500 withheld, ₱30,000 salary, ₱10M corporate sales) under "Estimating for <client>". Editing any one box saves all the samples to the client's profile. Mixed-income profiles have two unlinked sets of salary figures (Mixed tab vs Compensation tab). | Made-up figures can be mistaken for, and stored as, the client's real numbers. The same person gets two different compensation taxes on two tabs. | Start with empty boxes (or label samples clearly and do not save them). Feed the Compensation tab into the Mixed tab, or warn when they differ. | Pending |
| M06 | Medium | Bugs | Estimator figures are saved 0.9 seconds after typing stops. Reloading or closing within that window loses the last edit; opening "Edit profile" within it and saving wipes the figures. Save errors are hidden. | The last figures entered can be lost without notice. | Save when the page is hidden or closed, merge into the latest stored profile, and show "Couldn't save" when saving fails. | Pending |
| M07 | Medium | Tax logic (deadlines) | For years with no holiday list (2025, 2028 and later) only weekends are skipped, even holidays fixed by law such as May 1 and June 12, and no warning is shown. | From Mar 28, 2027 the dashboard will show Mon May 1, 2028 (Labor Day) instead of Tue May 2 for several items, and later Jun 12 instead of Jun 13, 2028. | Compute the fixed-by-law holidays for every year (including Maundy Thursday and Good Friday from Easter) and show a banner when a year's proclaimed holidays are not yet known. | Pending |
| M08 | Medium | Tax logic (deadlines) | LGU (cedula, PTR, business tax), SEC and DOLE deadlines are moved later when they fall on a weekend or holiday, but no rule allowing that was found. The roll-over is confirmed for the BIR (RMC 65-2016), SSS and PhilHealth. | Cedula shows Mon Mar 1, 2027, but the law says by the last day of February (Feb 28, 2027 is a Sunday). PTR shows Feb 1 instead of Jan 31; SEC AFS shows May 31 instead of May 29. If the agency does not honour the move, the user is late. | Give each agency its own roll-over policy. For LGU, SEC and DOLE show the legal date with a note ("if this falls on a weekend, pay on the last working day before unless your LGU allows otherwise"). | Pending |
| M09 | Medium | Tax logic (deadlines) | A missed deadline disappears from the calendar the next day; there is no "overdue" state. The income-tax progress rail puts a tick on every passed date as if it were filed, and checklist items cannot be checked off. | A user who missed the Oct 26 2551Q sees no sign of it while penalties run, and the ticks read as "filed". | Keep passed items in an "Overdue" section (for example for 60 days or until marked filed), use a neutral "date passed" icon, and optionally let users mark items as filed (saved per profile). | Pending |
| M10 | Medium | UI/UX | The calendar "Timeline" view silently stops after 40 deadlines while the header says "110 dated obligations". | For an employer the Apr 15, 2027 annual return and everything after it are missing from that view. | Show all deadlines grouped by month, or "Showing 40 of 110: show more". | Pending |
| M11 | Medium | Tax logic | The corporate estimator has no excess-MCIT carry-over credit (3 years), no OSD option (40% of gross income) and no quarterly 1702Q MCIT comparison. | Corporations with MCIT carry-over see too much tax; OSD corporations cannot estimate at all; quarterly payments can be underestimated. | Add a carry-over input applied against regular tax only, an itemized/OSD choice, and a 1702Q view. | Pending |
| M12 | Medium | Tax logic | The Payroll "true cost" total leaves out the mandatory 13th-month pay. | A ₱25,000 employee is shown ₱28,355 a month; with the 13th-month accrual it is ₱30,438.33 (about 7% more). | Add an "accrued 13th-month pay (1/12 of basic)" line, or relabel the total. | Pending |
| M13 | Medium | Tax logic | The self-employed SSS / PhilHealth / Pag-IBIG card divides gross sales by 12 and calls it "average monthly income". | Contributions are overstated: the default example shows ₱7,680 a month instead of ₱5,430 on net earnings, ₱27,000 a year too much. | Use (gross minus expenses) ÷ 12, or ask for declared monthly earnings; fix the label. | Pending |
| M14 | Medium | Posted information | The Checklist says Form 1905 RDO transfers can be filed at any RDO; the Forms page says business taxpayers file with their current RDO (RMC 91-2024). | A business owner may file the transfer at an office that will not accept it. | Owner to confirm the RMC 91-2024 rule; then make both pages say the same and cite it. | Pending |
| M15 | Medium | Posted information | The self-employed Pag-IBIG payment is tagged "Pag-IBIG MP2/RTPO". MP2 is Pag-IBIG's voluntary savings program, not the regular monthly contribution. | A self-employed user could pay into MP2 thinking it covers the regular contribution, leaving gaps that affect loan eligibility. | Relabel with the regular-savings channel (owner to confirm the name). | Pending |
| M16 | Medium | UI/UX | Editing the middle of an amount moves the cursor to the end, so the next digits land in the wrong place. | Correcting 480,000 can give 4,580,000 and then 45,800,005. | Add the commas only when leaving the box, or keep the cursor position (fixed together with C01). | Pending |
| M17 | Medium | UI/UX | On phones the main menu shows only "Calendar"; Estimator, Checklist, Forms, Tools and Blog are hidden off-screen with no hint. Some tab bars do the same. | Phone users may never find most pages. | Below 720 px, use a menu button or let the menu wrap; add a scroll hint or wrapping to tab bars. | Pending |
| M18 | Medium | UI/UX | Blog article cards cannot be reached or opened with the keyboard and are not announced as links (WCAG 2.1.1, Level A). | Keyboard and screen-reader users cannot read the blog. | Make each card a real link. | Pending |
| M19 | Medium | UI/UX | The two grey text colours fail contrast on every page (3.72:1 and 2.35:1; 4.5:1 is required): field labels, hints, citations, the footer disclaimer. Switch and box outlines are also too faint. | Hard to read for older or low-vision users and on phones outdoors. | Darken the two greys and the pill, badge and outline colours to meet WCAG 2.2 AA. | Pending |
| M20 | Medium | UI/UX | Profile wizard: no "Step X of Y", the Continue button is greyed out with no reason, focus does not move to the new step, and option groups and switch descriptions are not linked for screen readers. | First-time users get stuck on step 1; blind users cannot follow the wizard. | Show step text, say the name is required, move focus to the new step heading, and group options properly. | Pending |
| M21 | Medium | UI/UX | Every page has the same browser-tab title and page changes are not announced (WCAG 2.4.2). | Tabs, bookmarks and history cannot be told apart; screen-reader users hear nothing when they change page. | Give each page its own title (for example "Estimator · JEZ Tax Suite") and move focus to the page heading on navigation. | Pending |
| M22 | Medium | UI/UX | There is no print layout and no export. Printed estimates wash out, the menu and buttons print, and the printout has no date, tax year or profile. There is no PDF, CSV or calendar-file (.ics) download. | A CPA cannot hand a client a clean printout, and users cannot put deadlines into their own calendar. | Add a print stylesheet and a "Print / Save as PDF" button; optionally an .ics calendar file and a CSV of deadlines. | Pending |
| M23 | Medium | UI/UX | Slow first load on mobile data: one 604 kB file, a 212 kB account library loaded even in local mode, and Google Fonts that block the first paint. The screen is blank until everything loads. | On slow 3G nothing shows for about 5.5 s (compressed) to 14 s (uncompressed). | Load the account library only when accounts are configured, self-host the fonts or load them without blocking, and show "Loading…". | Pending |
| M24 | Medium | Bugs | Profile wizard navigation: Cancel can leave the app when the wizard was opened directly; an edit link for a deleted profile opens a blank "new profile" form; Back after saving reopens an empty wizard. | Users land outside the app or on a blank page, or create duplicate or unintended profiles. | Cancel goes to the profile list when there is no in-app history; show "Profile not found"; replace the history entry after saving. | Pending |
| M25 | Medium | Security / privacy | Users cannot delete their account or download their data, and local mode has no "erase all data on this device". | Data Privacy Act rights (erasure, data portability) cannot be honoured in the app. | Add "Delete my account" (server-side function), "Download my data", and "Erase all data on this device". | Pending |
| M26 | Medium | Security / privacy | The site is served at jezb-netrunner.github.io/Tax-Suite/, so its browser storage is shared with every other GitHub Pages site of the same account. | If the account publishes another Pages site, that site could read saved client data and (in accounts mode) login tokens. No exposure if no other Pages site exists. | Owner action: serve the app from its own domain or subdomain, or publish nothing else under that account. | Pending |
| M27 | Medium | Security / privacy | Local mode keeps client names and income as plain text in the browser with no shared-computer warning and no erase-all. Data is left behind if the site later switches to accounts mode. A developer instruction ("Connect a Supabase project (see .env.example)") is shown to users. | On a shared office or café computer the next person sees every client and their figures. | Add a shared-computer warning and "Erase all data on this device"; replace the developer text; offer to import or erase leftover local data on sign-in. | Pending |
| M28 | Medium | Security / privacy | There is no "Forgot password" or change-password flow. Auth settings (email confirmation, password length, rate limits, redirect URLs) exist only in the Supabase dashboard, and raw Supabase error text is shown. | A user who forgets their password loses access to all their client profiles; raw errors can reveal whether an email is registered. | Add a reset-password flow, document the auth settings in the repo, and show generic error messages. | Pending |
| M29 | Medium | Security / Code health | GitHub Pages publishes both the raw main branch and the Actions build on every push, and whichever finishes last is live. The raw branch copy is live now: the hand-built index.html (never tested in CI) plus the old apps in legacy/ and project/ with stale tax rules. Nothing checks that index.html matches the source. | The owner cannot control what is live. Old app copies with outdated rules are publicly reachable. A forgotten rebuild would ship stale rules. | Owner action: set Settings > Pages > Source to "GitHub Actions". Code: a CI step that fails when index.html differs from a fresh build; archive legacy/ and project/ under a tag. | Pending |
| M30 | Medium | Code health | Tests miss whole modules (payroll, amount parsing and formatting, self-employed contributions) and most boundary cases. Several assertions allow errors of up to ₱5, and one test locks in wrong behaviour (no percentage tax above ₱3M). 11 of 11 deliberately injected errors passed the whole suite. | Wrong numbers can ship without any warning, and the owner relies on tests rather than reading code. | Exact-centavo tests for every worksheet case and threshold edge; tests for parsing, formatting and payroll; a coverage report in CI. | Pending |
| L01 | Low | Tax logic | When two options cost exactly the same, the app silently picks 8%; differences under 50 centavos read "saving ₱0". | Looks like a bug; the tie is not explained. | Compare rounded pesos; say "tie" and explain the non-tax differences. | Pending |
| L02 | Low | Tax logic | The overpayment text offers "refund or carry over" and omits the tax credit certificate. | Users do not see the TCC option. | "On the return choose one: refund, tax credit certificate, or carry over." | Pending |
| L03 | Low | Tax logic | The mixed-income hint says "box 21 of your 2316" (present employer only). Total taxable compensation for the year is item 23, and every 2316 must be added when there were several employers. | Someone who changed jobs enters too little compensation and the tax is understated. | Correct the hint after confirming the item numbers on the current 2316. | Pending |
| L04 | Low | Tax logic | The 50% surcharge (willful neglect or fraud) cannot be selected in the penalty calculator, and the page does not mention it. | A CPA cannot model such cases and might quote 10% or 25%. | Add the option with a note that the standard compromise schedule does not cover fraud. | Pending |
| L05 | Low | Posted information | The micro-taxpayer abatement item (RR 4-2026) says "gross sales ≤ ₱3M" (micro is below ₱3M), cites "published July 22, 2026" (firm alerts: issued June 18, effective July 7, 2026), and has no end date. | A taxpayer at exactly ₱3M may think they qualify; from Jan 1, 2027 users are told to apply for a program that has ended. | Fix the wording and date; add a "show until Dec 31, 2026" date. | Pending |
| L06 | Low | Posted information | Citations to correct: Sec 249(D) should be the Sec 249(A) proviso; the ₱500 registration fee abolition is RMC 14-2024, not 15-2024; e-invoicing should also cite RR 26-2025 (and RMC 98-2026); the roll-over rule should cite RMC 65-2016. | A CPA checking the References page is pointed to wrong or incomplete issuances. The rules themselves are right. | Update the citations. | Pending |
| L07 | Low | Tax logic (deadlines) | There is no way to record BIR deadline extensions. RMC 30-2026 moved the TY2025 annual returns to May 15, 2026, but the calendar still shows Apr 15 and contradicts the attachments page. | Past dates only today, but the next nationwide extension (for example after a typhoon) will not appear. | Add an "overrides" list to the rulebook, applied by the calendar, and record RMC 30-2026. | Pending |
| L08 | Low | Tax logic | The semi-monthly, weekly and daily withholding tables are stored correctly but cannot be reached; only the monthly computation is shown. | Employers paying semi-monthly cannot get the per-payday amount. | Add a pay-period choice (and a working-days factor for daily-paid staff), or remove the unused path. | Pending |
| L09 | Low | Bugs | A ₱0 salary shows a −₱250 take-home pay and ₱260 of employer cost. | Nonsense result for a blank or zero salary. | Skip contributions when pay is ₱0, or ask for a salary. | Pending |
| L10 | Low | Bugs | "Read the form guide" on the next-deadline card always opens Form 1701Q, whatever form is due. | Users (even corporations) land on the wrong form. | Open the deadline's own form. | Pending |
| L11 | Low | Posted information | The footer and References say "rules last verified August 26, 2026" and call the rules "current", but several September 2026 issuances are not in (Proc 1427, NCR-28, RMC 98-2026). | The word "current" misleads. | Bump the date after the fixes and say "as of <date>". | Pending |
| L12 | Low | Posted information | Wording polish: "the monthly 2550M is gone" (it is optional); laws listed out of date order; RA 12023 missing from the statutes list; the brand appears as both "The Present Value" and "Present Value". | Minor confusion; no amount or date affected. | Fix the wording (the brand is handled by the rename). | Pending |
| L13 | Low | UI/UX | The profile switcher says it is a "menu", but arrow keys do nothing, focus does not move into it, and it stays open when tabbing away. | Confusing for keyboard and screen-reader users (it still works with Tab and Enter). | Use a simple disclosure pattern, or implement the full menu pattern. | Pending |
| L14 | Low | UI/UX | The calendar "Table" view on phones hides half its columns off-screen with no scroll hint. | Agency and period can be missed. | Stacked rows on narrow screens, or a visible scroll cue. | Pending |
| L15 | Low | UI/UX | Unexplained codes on calendar chips (SSS R-5/PRN, PhilHealth SPA/EPRS, Pag-IBIG MCRF, EIS, ORUS) and the heading "RCIT or MCIT". | Non-accountants do not know what they mean. | Add short tooltips or a glossary; spell out RCIT/MCIT. | Pending |
| L16 | Low | UI/UX | Heading levels skip from 1 to 3 on several pages, and the welcome page has no main heading. | A weaker page outline for screen-reader users. | Fix the heading levels. | Pending |
| L17 | Low | Security / privacy | Database row-level security is correct, but there is no limit on profile size or count, users can set their own timestamps, and the profile list relies on row-level security alone. | Abuse or cost risk; no cross-user access was found. | Size check, per-user row cap, updated_at trigger, and filter the list by user. | Pending |
| L18 | Low | Security / privacy | No Content-Security-Policy on the app pages. | Extra protection only (no script-injection hole was found). | Add a CSP meta tag; self-host the fonts. | Pending |
| L19 | Low | Security / privacy | Dependencies with published advisories (react-router, vitest/tinypool, nanoid, source-map-js); none can be triggered in the shipped app. | No current risk to users. | Upgrade react-router-dom to 6.30.6 or later (plan 7.18+), upgrade vitest, run npm audit fix. | Pending |
| L20 | Low | Security / privacy | CI hygiene: Node 20 (end of life), actions pinned to movable tags, broad publish permissions, and .env.* files not ignored by git. | Small supply-chain and accidental-leak risk; nothing is leaking today. | Node 22 or 24, pin actions to commit hashes, narrow permissions, ignore .env.* files. | Pending |
| L21 | Low | Code health | Dead code, unused outputs and duplicated helpers (daysBetween, pct, HOLIDAYS, the holiday set built three times, monthly withholding computed twice). | More code to keep correct when rules change. | Delete or wire up; one helper each. | Pending |
| L22 | Low | Code health | No lint script. ESLint finds one real error (the original error is lost when a profile save fails) and some unused code. | Small quality problems build up unseen. | Add an ESLint config, an npm run lint script and a CI step; fix the error. | Pending |
| L23 | Low | Tax logic (deadlines) | Employees never get the community tax (cedula) reminder; the Local Government Code (Sec 157) also covers people employed on a wage or salary (UNVERIFIED: the code text could not be fetched). | Employee clients are not reminded of a small yearly local tax. | Apply the reminder to employee profiles, or say that employee profiles cover BIR only. | Pending |

### 4.2 Open questions for the owner

**Scope and product decisions (asked in Phase 3):**
1. Which taxable years must the calculators support: the current year only (with a clear label), or also prior years (TY2018 onward) and the next year? (M01, C06, H17)
2. Should amount boxes accept centavos, or whole pesos only with decimals rejected by a message? (C01)
3. Display rounding: whole pesos on return figures (as the BIR forms require) and centavos on payslips and penalties, or one format everywhere? (M03)
4. VAT: build a simple quarterly VAT estimate, or state clearly that VAT is not included? (H05)
5. Quarterly payments: add a "quarterly tax already paid" box, or build full 1701Q/1702Q schedules? (H06)
6. Crossing ₱3M mid-year: ask for the month the threshold was crossed (to split percentage tax and VAT), or only correct the warning text? (H04)
7. Penalty calculator: switch to due date + payment date, or keep "days late" with fixes? (H17)
8. Unconfirmed ("needs review") rules: show with a badge, hide, or show unchanged? (H07)
9. Minimum wage earners: user enters the daily rate and pay factor, or the app keeps a regional wage-order table? (C04)
10. Sample figures in a new profile: start blank, or keep them clearly labelled and unsaved? (M05)
11. Filing status: an "Overdue" section plus "mark as filed" saved per profile, or an overdue banner only? (M09)
12. Exports wanted: print/PDF layout, .ics calendar file, CSV of deadlines? (M22)
13. Keep committing the single-file index.html (with a CI check), or stop? Archive legacy/ and project/? (M29)
14. Has accounts mode (Supabase) ever been live with real users? Who is the Personal Information Controller and DPO/contact for the privacy notice? (H14, M25 to M28)

**Legal points for the CPA to confirm (UNVERIFIED in this review):**
- Sec 249 interest: day count in leap years (always 365, or 366?), and whether interest runs from the original due date or the rolled-over working day. (H17)
- For a micro/small taxpayer whose tax fell due before Jan 22, 2024 and is still unpaid, does interest after that date drop to 6%? Do violations between Jan 22 and Apr 26, 2024 get the reduced rates? (H17)
- RMC 91-2024: does a business taxpayer file the Form 1905 RDO transfer at the old RDO or the new one? (M14)
- Can a mixed-income earner's net business loss reduce taxable compensation? (The app assumes no.) (M04)
- The correct channel/form name for a self-employed member's regular Pag-IBIG savings. (M15)
- Whether LGU (cedula, PTR, business tax), SEC and DOLE deadlines may roll to the next working day. (M08)
- Whether the ₱3M VAT threshold itself is CPI-indexed every 3 years under EOPT. (rules table 2.2)
- Whether the 1701/1701A overpayment carry-over choice is irrevocable for individuals. (L02)
- PhilHealth: which share absorbs the odd centavo? SSS MPF employee share: fully excluded from taxable pay? (M03)
- Which 2316 item numbers to cite for total taxable compensation (current form revision). (L03)
- Whether employees must be reminded of the community tax (LGC Sec 157). (L23)
- eAFS file-size limit; RR 4-2026 issuance date; Eid holidays for 2027 (proclaimed later).

### 4.3 Owner decisions (Phase 3)

*Pending.*

## 5. Technical appendix

File paths and line numbers refer to `main` at ed29f5a. "Original IDs" are the per-area IDs in Appendix B. Evidence is abridged; full JSON for each area was kept in the session scratchpad during the review.

### C01 (Critical): Every peso box deletes the decimal point and the minus sign. "1,234.56" becomes ₱123,456, "-500" becomes 500, "1e6" …
- **Original IDs:** BUG-01, TI-05, TB-07, WH-08, UX-01, CH-03, UX-13 (blank becomes 0)
- **Worksheets:** TI:WS-20, TB:W17, BUG:W1, BUG:W2, BUG:W3, BUG:W4
- **BUG-01** location: `src/lib/format.js:16-19 (parseNum: String(raw).replace(/[^0-9]/g,'') then parseInt); src/components/ui.jsx:24-31 (NumField: type=text, inputMode=numeric, value reformatted with toLocaleString on every keystroke); used by every NumField in src/pages/Estimator.jsx and src/pages/Tools.jsx; src/pages/Tools.jsx:63 (Basic tax due shown with money(), whole pesos)`
  - Evidence: Verifier re-run (Playwright, dev server, scratch bugs-verify/v1.cjs, v1_out.json): Estimator, profile Ana (individual, non-VAT, 8%), gross 480,000: pasting '4,800.00' into 'Tax withheld by clients (2307s)' shows '480,000'; breakdown reads 'Less: creditable tax withheld (₱480,000.00) ... Overpayment: refund or carry over ₱461,600.00'. Typing 4800.00 key by key also ends at '480,000'. Gross '480,000.50' shows '48,000,050', the VAT-threshold warning appears and the banner says 'Graduated + OSD (40%) is the cheapest eligible option at ₱9,482,511'. After 1.2 s localStorage holds inputs {gross:48000050, cwt:480000}. Tools penalty, 'Basic tax due' '1,234.56', 60 days, Micro/Small: field …
- **TI-05** location: `src/lib/format.js:16-19 (parseNum); src/components/ui.jsx:24-30 (NumField, inputMode='numeric', onChange={parseNum})`
  - Evidence: Verifier re-ran parseNum (v1.out): '1,234.56'=123456; '480000.75'=48000075; '3,000,000.01'=300000001; '0.5'=5; '-500'=500; '1e6'=16; 'abc'=0; ''=0; '₱ 1,000'=1000; '480,000.'=480000 (dot disappears); '480,0007'=4800007. Real-browser Playwright run by the bugs area (scratchpad/audit/bugs/s4_estimator.cjs lines 23-36, s4_out.json): 2307 field filled with '4,800.00' shows '480,000', breakdown 'Less: creditable tax withheld (2307s) (₱480,000.00) / Overpayment ₱461,600.00'; gross '480,000.50' shows '48,000,050' with banner '... cheapest eligible option at ₱9,482,511'. Same defect is TB-07 in the VAT/penalties area (rated Medium there); verifier keeps High because the 2307 field routinely carries …
- **TB-07** location: `src/lib/format.js:16-19; src/components/ui.jsx:24-30; src/pages/Tools.jsx:54`
  - Evidence: Worksheet W17. Verifier re-ran: parseNum('12,345.67') = 1234567 and parseNum('12345.67') = 1234567. A simulated keystroke sequence '12345.67' through the controlled field ends at 1234567 (shown '1,234,567'). estimatePenalty on that base gives 308,641.75 + 12,176.55 + 40,000.00, total 1,595,385.30. Python exact: 12,345.67 + 3,086.42 + 121.77 + 5,000 = 20,553.86.
- **WH-08** location: `src/lib/format.js:16-19 (parseNum); src/components/ui.jsx:29-30 (NumField)`
  - Evidence: Verifier re-run (v1.out): parseNum('22,964.58') = 2296458; parseNum('25000.50') = 2500050; parseNum('-5000') = 5000. estimateEmployee({monthlyBasic:2296458}) gives monthlyWithholding 752411.15 and annualTax 9028933.60.
- **UX-01** location: `src/lib/format.js:16-19 (parseNum keeps only 0-9); src/components/ui.jsx:24-31 (inputMode="numeric", onChange=parseNum, value.toLocaleString); used by every NumField in src/pages/Estimator.jsx and src/pages/Tools.jsx`
  - Evidence: Verifier re-run (vite-node, ux-verify/eng.mjs): parseNum('480000.50')=48000050; parseNum('₱480,000.00')=48000000; parseNum('12,345.67')=1234567; parseNum('-500')=500. Engine with gross 48,000,050: best 'Graduated + OSD (40%)' 9,482,510.50, shown ₱9,482,511, saving ₱6,657,007. Same engine with 480,000.50: 8% at 18,400.04. Playwright re-run (ux-verify/v05_inputs.cjs, 1280x900, profile 'Maria Santos'): typed 480000.50 -> field '48,000,050', card 'Graduated + OSD (40%) LOWEST ₱9,482,511 … Business tax VAT 12%'; pasted ₱480,000.00 -> '48,000,000'; 2307 box 12,345.67 -> '1,234,567'. See WS-1. Same root cause as BUG-01, TI-05, TB-07 and WH-08 in other areas. Auditor screenshots: …
  - Sources: Playwright run against the Vite dev server (app.html) ; vite-node engine run
- **CH-03** location: `src/lib/format.js:16-19 (parseNum); src/components/ui.jsx:24-31 (NumField: value.toLocaleString on line 29, onChange parseNum on line 30)`
  - Evidence: Verifier re-run (code-health-verify/v1.out): parseNum('1,234.56') -> 123456; parseNum('30000.50') -> 3000050; parseNum('-500') -> 500; parseNum('1e5') -> 15; parseNum('12.5%') -> 125; typing '1,234.' -> 1234 (dot vanishes), then '1,2345' -> 12345. Mutation check (verifier scratch copy): making parseNum return 10x still passes 89/89 tests.
- **UX-13** location: `src/pages/Tools.jsx:33-34 (Math.min(12, …) with no message); src/engine/estimators/individual.js:51 and corporation.js:27-28 (Math.max(0, …)); src/components/ui.jsx:29-30 and src/lib/format.js:16-19 (blank becomes 0)`
  - Evidence: Verifier re-run (ux-verify/v05_inputs.cjs): Months in 18 -> field '18', 'Projected annual income ₱240,000'; Months 0 -> '₱0'; gross 300,000 with expenses 900,000 -> page text has no 'loss/exceed'; cleared field -> value "0". Engine (eng.mjs): itemized rows 'Less: itemized expenses -900,000 / Net taxable business income 0 / Graduated income tax 0'. See WS-4. Overlaps BUG-13 (months clamp) and TI-08 (NOLCO); the audit's line 'no error or warning messages anywhere' was corrected because over-₱3M warnings do exist.
  - Sources: Playwright run ; vite-node engine run

### C02 (Critical): When graduated rates win, the "Tax payable with the annual return" line adds the 3% percentage tax to income tax and …
- **Original IDs:** TI-01, BUG-16, CH-13 (preview row)
- **Worksheets:** TI:WS-08, TI:WS-10, TI:WS-11, TI:WS-13, TI:WS-14
- **TI-01** location: `src/engine/estimators/individual.js:64, 83, 93, 141-147, 160; src/pages/Estimator.jsx:173-180, 188`
  - Evidence: Verifier re-ran the engine and a copy of FormPreview (tax-individual-verify/v1.mjs, v1.out). WS-08 gross 420,000, cwt 21,000 -> preview 'BIR Form 1701A / Income tax due ₱300 / Percentage tax (separate 2551Q) ₱12,600 / Less: creditable withholding (₱21,000) / Overpayment (refund / carry-over) ₱8,100'. Correct 1701A: 300 - 21,000 = overpayment ₱20,700. WS-10 gross 1,000,000, expenses 900,000, cwt 100,000 -> app overpayment ₱70,000; correct ₱100,000. WS-11 gross 500,000, expenses 700,000 -> app 'Tax payable with the annual return ₱15,000'; correct ₱0. WS-13 mixed comp 150,000, gross 300,000, cwt 15,000 -> app payable ₱6,000; correct overpayment ₱3,000. WS-14 mixed comp 600,000 (withheld …
  - Sources: https://bir-cdn.bir.gov.ph/local/pdf/1701A%20Jan%202018%20v5%20with%20rates.pdf ; https://bir-cdn.bir.gov.ph/local/pdf/1701%20Jan%202018%20final%20with%20rates.pdf ; https://bir-cdn.bir.gov.ph/local/pdf/2551Q_%20Jan%202018%20Guide.pdf ; https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/2/93191 (NIRC Sec 116 as amended; quarterly percentage tax return under Sec 128)
- **BUG-16** location: `src/pages/Estimator.jsx:175 ({ label: taxableLabel, value: null }) and 188 (rows.filter(x => x.value != null))`
  - Evidence: Verifier re-run (bugs-verify/v1.cjs), profile Ana: card text 'WHERE IT LANDS ON THE RETURN BIR Form 1701A Income tax due ₱18,400 Percentage tax (separate 2551Q) — Less: creditable withholding — Tax payable with the annual return ₱18,400'. There is no taxable-base line.
- **CH-13** location: `Unused exports: src/engine/dates.js:23 (daysBetween, duplicated inline at src/engine/deadlines.js:157); src/lib/format.js:12 (pct); src/lib/deadlineData.js:7 (HOLIDAYS). Unused outputs: src/engine/estimators/individual.js:75,85,95 (option.basis citations), 158 (rowsFor); contributions.js:28 (wispPortionOfTotal); corporation.js:98 (totalAnnualTax); payroll.js:49 (perPeriodWithholding). …`
  - Evidence: Verifier grep -w per name across src/tests/scripts: daysBetween, pct (format.js export) and HOLIDAYS (deadlineData export) have no importer; the 'pct' and 'HOLIDAYS' hits elsewhere are local variables. '.basis', rowsFor, wispPortionOfTotal, perPeriodWithholding, totalAnnualTax are not read in src/pages. Verifier re-run: payroll daily path gives monthly WH 5,250.57 versus 4,568.40 monthly for ₱50,000 (unreachable, untested).

### C03 (Critical): The late-filing penalty calculator halves the compromise penalty for micro and small taxpayers. RR 6-2024 gives the 50% …
- **Original IDs:** TB-01
- **Worksheets:** TB:W02, TB:W05, TB:W07, TB:W09, INF:W-INF-6
- **TB-01** location: `src/engine/estimators/penalties.js:10-13; src/pages/Tools.jsx:17,66; src/data/rules/penalties.json:27,40; src/pages/References.jsx:34 (shows those notes); tests/engine/penalties.test.js:6,15-21`
  - Evidence: Verifier re-ran the engine (vite-node): estimatePenalty({taxDue:50000,daysLate:60,microSmall:true}) = surcharge ₱5,000.00, interest ₱493.15, compromise ₱5,000.00, total ₱60,493.15. compromiseFor(t,true) returns half of every tier (500 … 25,000); compromiseFor(0,true) = 500. Python exact arithmetic with the full tier: 50,000 + 5,000 + 493.15 + 10,000 = 65,493.15 (worksheets W02, W05, W07, W09). The legacy v1 app (legacy/index.html:341-350) did not halve; the halving came in commit f13057a (git log -S confirms). Legal basis: RR 6-2024, reduced compromise penalty provision, as quoted by the auditor from the search-indexed BIR PDF: 'In case of criminal violation by covered taxpayers of Sections …
  - Sources: https://bir-cdn.bir.gov.ph/BIR/pdf/RR%206-2024%20(final).pdf (primary; wording seen through the search index; direct fetch blocked for both auditor and verifier) ; https://businessmirror.com.ph/2024/02/20/new-law-grants-concessions-to-micro-small-taxpayers/ (secondary) ; https://taxacctgcenter.ph/revenue-regulations-no-6-2024/ (secondary) ; https://mpm.ph/rr-6-2024/ (secondary)

### C04 (Critical): The Employee and Payroll calculators have no "minimum wage earner" option, so a minimum wage earner's statutory pay …
- **Original IDs:** WH-01
- **Worksheets:** WH:WS-08, WH:WS-09, WH:WS-22
- **WH-01** location: `src/engine/estimators/employee.js:23-34; src/engine/estimators/payroll.js:26-31; src/pages/Estimator.jsx:221-246, 287-305; src/data/rules/withholding-compensation.json:75-80 (mweExempt defined but unused; cites RR 10-2008); src/pages/References.jsx:116-118 (says the calculators use these rules)`
  - Evidence: Verifier re-run (v2.out): estimateEmployee({monthlyBasic:18128, monthlyAllowances:6000}) gives deductions 1,553.20, monthly taxable 22,574.80, monthlyWithholding 261.27, annualTax 3,134.64; estimatePayroll gives the same ₱261.27 under 'Withholding tax to remit (1601-C)'. {monthlyBasic:21140, monthlyAllowances:3000} gives 229.28 a month and 2,750.70 a year. {monthlyBasic:22965} gives 31.18 a month (raw 31.1805) and 373.57 a year (v1.out). Exact hand computation: hand.py / hand.out (WS-08, WS-09, WS-22). grep: mweExempt and minimumWageReference are read only by References.jsx, through its generic rule list.
  - Sources: NIRC Sec 24(A)(2) as amended by RA 9504 and RA 10963: https://www.lawphil.net/statutes/repacts/ra2017/ra_10963_2017.html ; RR 11-2018 digest (MWE exemption, other taxable pay): https://bir-cdn.bir.gov.ph/local/pdf/Digest%20RR%2011-2018.pdf ; Soriano v. Secretary of Finance, G.R. 184450 (Jan 24, 2017): https://lawphil.net/judjuris/juri2017/jan2017/gr_184450_2017.html ; NCR-26 ₱695 rate as stated in the app's own rulebook (withholding-compensation.json:64-65)

### C05 (Critical): SSS is computed on basic salary only. Regular allowances, commissions and other pay the user enters are ignored for …
- **Original IDs:** WH-03
- **Worksheets:** WH:WS-10
- **WH-03** location: `src/engine/estimators/employee.js:23; src/engine/estimators/payroll.js:26 and 34; src/engine/estimators/contributions.js:63-88 (employeeMandatoryDeductions / employerContributions take one salary figure for all three agencies)`
  - Evidence: Verifier re-run (v1.out): estimateEmployee({monthlyBasic:15000, monthlyAllowances:10000}) gives SSS 750, total deductions 1,325, monthly taxable 23,675, withholding 426.30, annualTax 5,115. estimatePayroll gives employer SSS 1,530. Exact hand computation (hand.out, 'WS10 law'): MSC 25,000 gives employee 1,250 and employer 2,500 + EC 30 = 2,530. Deductions 1,825, taxable 23,175, withholding 351.30, annual tax 4,215.
  - Sources: RA 11199 Sec 8(f) 'compensation' (all actual remuneration, including COLA) and IRR: https://www.lawphil.net/statutes/repacts/ra2019/irr_11199_2019.html ; Secondary summary: https://www.lawyer-philippines.com/articles/inclusion-of-allowances-in-sss-contribution-computation-in-the-philippines

### C06 (Critical): The corporate estimator always uses the device's current calendar year as the taxable year. There is no year choice and …
- **Original IDs:** WH-04
- **Worksheets:** WH:WS-17, WH:WS-18
- **WH-04** location: `src/pages/Estimator.jsx:256 (taxYear: new Date().getFullYear()); src/engine/estimators/corporation.js:25, 36-37; src/data/rules/corporate.json:14-22 (mcit.value.rate single 0.02)`
  - Evidence: Verifier re-run (v1.out): estimateCorporation({GS 6M, cost 0, opex 5.9M, assets 50M, registrationYear 2023, taxYear 2027}) gives mcitApplies true and due 120,000. With taxYear 2026 it gives due 20,000. taxYear 2022 and 2023 (registration 2015) both give due 120,000 at 2%. Exact: TY2022 1% × 6,000,000 = 60,000. TY2023: 500,000 × 6 × 1% + 500,000 × 6 × 2% = 90,000 (hand.out). RR 9-98 counts MCIT years from the year of BIR registration.
  - Sources: RA 11534 (CREATE) Sec 27(A),(E): https://lawphil.net/statutes/repacts/ra2021/ra_11534_2021.html ; RMC 36-2024 (TY2023 MCIT computation): https://bir-cdn.bir.gov.ph/BIR/pdf/RMC%20No.%2036-2024-Digest.pdf ; RMC 69-2023 (MCIT reverts to 2%): https://bir-cdn.bir.gov.ph/local/pdf/RMC%20No.%2069-2023%20v2.pdf ; RR 9-98 (registration year = commencement year): https://lawphil.net/administ/bir/rr/rr1998.html

### C07 (Critical): With the app open in two browser tabs, saving estimator figures in one tab writes back that tab's old copy of the whole …
- **Original IDs:** BUG-02
- **BUG-02** location: `src/pages/Estimator.jsx:55-65 (flush saves {...activeRef.current, inputs}, the tab's in-memory copy); src/lib/backend.js:50-57 (local saveProfile replaces the stored record, or pushes it back if its id is not found); src/state/AppState.jsx:46-66 (profiles loaded once; no 'storage' event listener anywhere in src/)`
  - Evidence: Verifier re-run (bugs-verify/v1.cjs, same browser context, tabs A and B, profiles seeded in localStorage): tab B opened the Estimator for 'Ben VAT Shop'. Tab A renamed Ben to 'Ben RENAMED IN A' through the wizard; storage then held 'Ben RENAMED IN A'. Tab B typed 777777 in 'Itemized expenses'; 1.3 s later storage held 'Ben VAT Shop' again (rename reverted). Ben was then removed from storage (4 profiles to 3, as tab A's delete does); tab B typed 99999 and 1.3 s later storage held 4 profiles with 'Ben VAT Shop' re-added at the end. grep finds no addEventListener('storage') in src/. Cloud mode was not tested (no Supabase configured); by code reading, a stale tab or device would also overwrite …

### C08 (Critical): In "Edit profile", tapping the taxpayer-type card that is already selected resets every registration answer (regime, …
- **Original IDs:** UX-02
- **UX-02** location: `src/pages/ProfileWizard.jsx:47-53 (pickType always rebuilds the profile from defaultProfile(type), keeping only id, name and inputs); :89 (onClick={() => pickType(k)} with no check for the current type); src/engine/profile.js:23-61 (defaults)`
  - Evidence: Verifier re-run (ux-verify/v10_edit.cjs). Seeded profile: regime graduated_itemized, booksType looseleaf, hasEmployees, receives2307, withholdsEwt all true, estimator inputs {gross 777000}. Steps: Edit, tap 'Self-employed / Sole prop' (already selected), Continue x3, Save changes. Step 2 showed '8% flat tax' selected; step 3 showed all four switches off. Saved result: hasEmployees=false, receives2307=false, withholdsEwt=false, regime='8pct', booksType='manual'; inputs kept. Dashboard: 'Showing 141 dated obligations' -> 'Showing 47'. Control run without re-tapping: settings kept. The auditor's run on the unseeded profile gave 110 -> 47 (verifier engine count for that profile: 110). …
  - Sources: Playwright run

### H01 (High): "Today", "days left" and "overdue" follow the device's clock and time zone, not Philippine time. The dashboard's …
- **Original IDs:** DL-01, BUG-03, UX-09, CH-10, DL-08, BUG-12
- **Worksheets:** DL:WS-17, BUG:W7
- **DL-01** location: `src/engine/dates.js:1-2, 14-17 (today() uses the device's local date); src/pages/Dashboard.jsx:39-44 (t = today() used as from/refDate), 146-147 (hero shows the raw day count, "0 days left" on the due date); src/engine/deadlines.js:145, 157 (window filter and daysAway measured from that local date). Related: src/pages/Estimator.jsx:256 and src/engine/estimators/corporation.js:25 take the tax year …`
  - Evidence: Verifier re-ran a frozen-clock copy of the Dashboard call (scratch tax-deadlines-verify/tz.mjs; from = today(), to = today+400, refDate = today; VAT sole prop). At 2026-10-27T03:00Z (11:00 AM Oct 27 Manila, 11 hours after the Q3 2550Q deadline of Mon Oct 26): Asia/Manila, Asia/Tokyo, Asia/Dubai and Europe/London give next 2550Q = 2027-01-25 (the Oct 26 item is gone, correct); America/New_York and America/Los_Angeles give app-today 2026-10-26, 2550Q 2026-10-26, daysAway = 0. At 2026-10-26T16:30Z (12:30 AM Oct 27 Manila): Dubai, London, New York and Los Angeles all give daysAway = 0. At 2026-10-25T16:30Z (12:30 AM Oct 26 Manila, the due date): those four zones give daysAway = 1, Manila and …
  - Sources: https://www.grantthornton.com.ph/globalassets/1.-member-firms/philippines/tax-alerts/2016/06.27.2016/rmc-no-65-2016.pdf ; https://www.forvismazars.com/ph/en/insights/tax-alerts/bir-rmc-65-2016 ; CLAUDE.md (project rule: Dates use Asia/Manila time)
- **BUG-03** location: `src/engine/dates.js:14-17 (today() uses new Date() local fields); src/pages/Dashboard.jsx:39; src/pages/Estimator.jsx:256 (taxYear: new Date().getFullYear()); src/engine/estimators/corporation.js:25 (default taxYear); src/pages/ProfileWizard.jsx:172`
  - Evidence: Verifier re-run (bugs-verify/v2.cjs, v2_out.json), profile Fox Corp (corporation, employer, start year 2020), clock pinned with Playwright clock.install. Instant 2026-10-13 01:00 Manila: Asia/Manila browser shows header 'Oct 13, 2026' and next deadline 'Issue 2307 certificates ... 7 days left Oct 20, 2026'; America/Los_Angeles, Asia/Riyadh and UTC browsers show 'Oct 12, 2026' and '1601-C Sep 2026 ... 0 days left Oct 12, 2026'. Instant 2026-10-12 00:30 Manila (the due day): Manila shows '0 days left'; LA, Riyadh and UTC show '1 day left'. Instant 2027-01-01 10:00 Manila, start year 2023: Manila estimator headline says '... above the ₱120,000 MCIT floor'; LA headline omits MCIT (MCIT treated …
  - Sources: CLAUDE.md project rule: 'Dates: use Asia/Manila time.'
- **UX-09** location: `src/engine/dates.js:14-17 (today() uses new Date() local fields); src/pages/Dashboard.jsx:39, :146-148, :262`
  - Evidence: Verifier re-run (ux-verify/v14_tz.cjs), clock fixed at 2026-10-08T03:00:00Z. timezoneId Asia/Manila: header 'Oct 8, 2026', hero '4 days left Oct 12, 2026 moved from Oct 10, 2026 (weekend)'. timezoneId America/Los_Angeles: header 'Oct 7, 2026', hero '5 days left'. See WS-6. Same issue as DL-01 and BUG-03 (reported here because it shows on the dashboard).
  - Sources: Playwright run
- **CH-10** location: `src/engine/dates.js:1-2 (comment), 14-17 (today); src/pages/Dashboard.jsx:39-44, 86-89; src/pages/Estimator.jsx:256; src/engine/estimators/corporation.js:25`
  - Evidence: Verifier re-run (code-health-verify/tz.mjs, clock frozen): Manila wall clock 2026-10-07 08:00 -> today() = 2026-10-07 under TZ=Asia/Manila and UTC, but 2026-10-06 under TZ=America/Los_Angeles. Manila 2027-01-01 00:30 -> new Date().getFullYear() = 2027 under Asia/Manila, 2026 under UTC and America/Los_Angeles. Auditor: vitest passes 89/89 under four different TZ values.
- **DL-08** location: `src/pages/Dashboard.jsx:39 (useMemo(() => today(), []))`
  - Evidence: useMemo with an empty dependency list computes once per mount of the Dashboard component. grep of src for visibilitychange / setInterval: none; the only setTimeout is the estimator autosave (src/pages/Estimator.jsx:73).
- **BUG-12** location: `src/pages/Dashboard.jsx:39 (useMemo(() => today(), [])); 146-147`
  - Evidence: Verifier re-run (bugs-verify/v2.cjs, Manila clock): loaded at 2026-10-12 23:58, fast-forwarded 5 minutes (page clock 'Tue Oct 13 2026 00:03'), toggled Table and Feed: the hero still reads '1601-C Sep 2026 ... 0 days left Oct 12, 2026'. Same issue as DL-08 in the deadlines area.

### H02 (High): The October 15 second installment of annual income tax (NIRC Sec 56(A)(2): tax due over ₱2,000 may be paid half at …
- **Original IDs:** DL-02
- **Worksheets:** DL:WS-15
- **DL-02** location: `src/data/rules/obligations.json:43-68 (1701A; Oct 15 only in notes at line 67), 70-95 (1701, not mentioned), 142-164 (1700, not mentioned); src/data/rules/income-tax.json:39-44 (annualITRInstallment, secondInstallmentDue "October 15", read by no code); no obligation with month 10 / day 15 exists`
  - Evidence: Verifier scratch view.mjs, window 2026-10-07 to 2026-11-21, refDate 2026-10-07. 8% freelancer: 2026-10-12 Pag-IBIG, 2026-11-03 PhilHealth, 2026-11-03 SSS, 2026-11-10 Pag-IBIG, 2026-11-16 1701Q. Mixed income (OSD): same plus 2026-10-26 2551Q. Employee with two employers: none. Over 2026-2027 no occurrence of any obligation has a raw date of Oct 15 for an itemized individual. grep of src (excluding src/data) for installment / October 15 / secondInstallment: no matches, so the rule is never turned into a date. Oct 15, 2026 is a Thursday (python weekday check). Legal basis: NIRC Sec 56(A)(2) as amended by RA 10963: when the tax due exceeds ₱2,000, a taxpayer other than a corporation may pay in …
  - Sources: https://taxsummaries.pwc.com/philippines/individual/tax-administration ; https://www.forvismazars.com/ph/en/insights/tax-deadlines/october-2025-tax-calendar

### H03 (High): The 2027 holiday list lacks the four extra non-working days in Proclamation 1427 s.2026 (Feb 6, Mar 27, Nov 2 and Dec …
- **Original IDs:** DL-03, INF-01
- **Worksheets:** DL:WS-10, DL:WS-18, INF:W-INF-4
- **DL-03** location: `src/data/rules/holidays.json:2 ($comment says the 2027 proclamation has not issued), 10-14 (confidenceByYear, confidenceNote), 36-49 (2027 rows), 51-54 (notes2027); shown on src/pages/References.jsx:100-114`
  - Evidence: Verifier scratch h2027.mjs compares the app's holiday set with the same set plus the four Proc. 1427 days, across 28 profiles (individual, 8% professional, mixed, two-employer employee, and VAT and non-VAT corporations for each of the 12 fiscal-year ends), window 2026-10-07 to 2027-12-31. Exactly 63 occurrences change, every one from 2027-11-02 to 2027-11-03: bir-1601eq, bir-1601fq, bir-qap, sss-employer (raw Oct 31), sss-self and philhealth-self (raw Oct 31), bir-1702q and bir-sawt-corp-quarterly (raw Oct 30, FY ending 11, 2, 5), bir-cas-books and bir-inventory-list (raw Oct 30, FY ending 9), bir-eafs-itr-attachments-corp (raw Oct 30, FY ending 6). Chain (python weekday check): Oct 30, …
  - Sources: https://www.officialgazette.gov.ph/2026/09/08/proclamation-no-1427-s-2026/ ; https://lawphil.net/executive/proc/proc2026/proc_1427_2026.html ; https://pco.gov.ph/news_releases/pbbm-declares-2027-regular-and-special-holidays/ ; https://www.pna.gov.ph/articles/1283808
- **INF-01** location: `src/data/rules/holidays.json:2, 9-14, 36-49 (2027 rows), 51-54 (notes2027); src/data/rules/meta.json:7; src/pages/References.jsx:100-113 (list shown without confidenceNote or notes2027); src/pages/Dashboard.jsx:41-44 (400-day window at :43)`
  - Evidence: Verifier re-ran the auditor's script (scratch posted-info-verify/hol2027.mjs; corporation with employees, EWT and FWT, plus an individual on OSD; today 2026-10-07; window end 2027-11-11). Output: '2027-11-02 raw 2027-10-31' for 1601-EQ Q3, 1601-FQ Q3, SSS R-5/PRN Sep 2027 and QAP Q3; for the individual, PhilHealth SPA Sep 2027 and SSS PRN Sep 2027. Python weekdays: 2027-10-30 Sat, 10-31 Sun, 11-01 Mon (All Saints' Day, in the app), 11-02 Tue, 11-03 Wed; 2027-02-06 and 2027-03-27 Sat; 2027-12-24 Fri. holidays.json:7 says weekday special non-working days shift deadlines like regular holidays. References.jsx:100-113 renders only shiftRule.value and the date list; no page reads confidenceNote, …
  - Sources: https://www.officialgazette.gov.ph/2026/09/08/proclamation-no-1427-s-2026/ (primary; not re-fetched by the verifier: WebFetch is egress-blocked for these hosts and the shared web-search budget was exhausted) ; https://pia.gov.ph/news/pbbm-declares-2027-regular-and-special-holidays/ ; https://www.pna.gov.ph/articles/1283808 ; https://newsinfo.inquirer.net/2303491/list-holidays-special-non-working-days-for-2027

### H04 (High): When a non-VAT taxpayer's sales pass ₱3M, the app drops percentage tax for the whole year and says "the 3% percentage …
- **Original IDs:** TI-03, TB-04
- **Worksheets:** TI:WS-16, TB:W16
- **TI-03** location: `src/engine/estimators/individual.js:35-37, 47, 82, 92, 138-139; src/pages/Estimator.jsx:104-110, 152; contradicts src/data/rules/income-tax.json:25; pinned by tests/engine/individual.test.js:42-49`
  - Evidence: Verifier re-ran: gross 3,000,000.01 and 3,000,001 -> 8% ineligible (correct), OSD income tax 352,500.0015 / 352,500.15 (correct), businessTax {kind:'vat', amount:null}, pct = 0 (individual.js:47 'pct = vat ? 0 : gross * PCT_RATE'). Warning text at Estimator.jsx:106. Exactly 3,000,000 keeps 8% (correct, WS-15). Real-browser run in the bugs area (s4_out.json 'grossDecimal'): warning shown together with banner '... Note: the regime on this profile is the 8% option'. Rulebook income-tax.json:25: 'Breaching ₱3M mid-year puts the ENTIRE year back on graduated rates (8% payments become credits) plus percentage tax until VAT registration.' Same defect was independently verified in the …
  - Sources: https://bir-cdn.bir.gov.ph/local/pdf/Digest%20RR%208-2018_copy.pdf ; https://bir-cdn.bir.gov.ph/local/pdf/RMO%20NO.23-2018.pdf ; https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/10/90318 (RMO 23-2018: percentage tax under Sec 116 from the beginning of the year until the taxpayer is liable for VAT; 8% quarterly payments allowed as tax credit; read by the auditor via search excerpt)
- **TB-04** location: `src/engine/estimators/individual.js:35-47; src/engine/estimators/corporation.js:41-43,75-76; src/pages/Estimator.jsx:104-109; contradicts src/data/rules/income-tax.json:25`
  - Evidence: Verifier re-ran: estimateIndividual({gross:3200000, expenses:2000000}) gives vat=true, best=itemized, businessTax {kind:'vat', amount:null}, total 202,500 (graduated tax on 1,200,000 = 102,500 + 25% × 400,000 = 202,500). estimateCorporation({grossSales:3200000, costOfSales:1000000, opex:1000000, totalAssets:1e6}) gives pct 0, vat true, totalAnnualTax 240,000. Worksheet W16: 3,000,000 × 3% = 90,000; 200,000 × 12% = 24,000 output VAT. Rulebook income-tax.json:25 says: 'Breaching ₱3M mid-year puts the ENTIRE year back on graduated rates (8% payments become credits) plus percentage tax until VAT registration.' KPMG (2018, secondary) on RR 8-2018: 3% percentage tax on the first ₱3,000,000 and …
  - Sources: https://kpmg.com/ph/en/home/insights/2018/03/elucidating-the-eight-percent-tax-option.html (secondary) ; src/data/rules/income-tax.json:25 (app's own rulebook)

### H05 (High): VAT is never computed. The breakdown says "see the VAT panel", which does not exist. Option cards show "VAT 12%" where …
- **Original IDs:** TB-03, BUG-07, UX-08, CH-12
- **Worksheets:** TB:W15
- **TB-03** location: `src/engine/estimators/individual.js:82-95,138-141; src/pages/Estimator.jsx:104-109,127-139,177; src/engine/estimators/corporation.js:76`
  - Evidence: Verifier: grep -rn 'VAT panel' src app.html legacy project matches only individual.js:139; no component. grep for output/input VAT in src finds only text (forms.js:13, individual.js:139, corporation.js:76, Estimator.jsx:108). Engine: estimateIndividual({gross:4000000, expenses:1500000}) gives OSD and itemized options with businessTax {kind:'vat', amount:null}, totals 522,500 / 552,500 (income tax only), and the row 'Value-added tax=null [… see the VAT panel.]'. estimateIndividual({gross:2000000, expenses:1000000, vatRegistered:true}) gives overThreshold=false, so the Estimator.jsx:104 banner is not shown. Worksheet W15: 4,000,000 × 12% − 1,500,000 × 12% = 480,000 − 180,000 = 300,000.
  - Sources: src/data/forms.js:13 (the app's own 2550Q description: output VAT less creditable input VAT) ; NIRC Sec 110 (input tax credit and carry-over)
- **BUG-07** location: `src/engine/estimators/individual.js:139; option card text at src/pages/Estimator.jsx:128 and 137`
  - Evidence: Verifier re-run (bugs-verify/v1.cjs), profile 'Ben VAT Shop' (individual, VAT) on the Estimator: page text contains 'VAT (12%) is computed separately on sales less creditable input VAT; see the VAT panel.' grep -rn 'VAT panel' src/ finds only individual.js:139, and no VAT estimator exists. The wider point (VAT never computed) is TB-03 in the business-tax area.
- **UX-08** location: `src/engine/estimators/individual.js:138-140 ('see the VAT panel'); src/pages/Estimator.jsx:104-110 (exclusion note only when over ₱3M), :137 and :177 ('VAT 12%' in the amount column); src/engine/estimators/corporation.js:76`
  - Evidence: Verifier re-run: engine with gross 3,500,000 returns row 'Value-added tax' with sub '…see the VAT panel.' and total 432,500 (ux-verify/eng.mjs); Playwright (v05_inputs.cjs) finds 'VAT panel' and 'VAT 12%' on the page. grep finds 'VAT panel' only in individual.js:139 and no VAT computation anywhere. Code check: the 'exclude VAT' note (Estimator.jsx:104-110) renders only when r.overThreshold is true, so a VAT-registered profile under ₱3M sees no note. Same issue as TB-03 and BUG-07. Auditor screenshot /tmp/claude-0/-home-user-Tax-Suite/5f55781b-8e32-597f-b833-03712e4a9117/scratchpad/audit/ux/d_est_over3m.png
  - Sources: Playwright run ; vite-node engine run ; grep of src/
- **CH-12** location: `src/engine/estimators/individual.js:139; src/engine/estimators/corporation.js:76; src/pages/Estimator.jsx:104-110 (warning only when overThreshold), 127-128, 137, 177`
  - Evidence: Verifier: grep 'VAT panel' in src finds only individual.js:139. git log --all -G 'VatPanel/VatEstimator/function Vat/vat-panel' finds nothing; the text arrived in f13057a.

### H06 (High): There is no box for income tax already paid on the quarterly returns (1701Q, 1702Q) or for prior-year excess credits, …
- **Original IDs:** TI-04, WH-11
- **Worksheets:** TI:WS-07, WH:WS-23
- **TI-04** location: `src/engine/estimators/individual.js:64, 142-147, 160; src/pages/Estimator.jsx:95-101 (inputs), 179 (label)`
  - Evidence: Inputs available: gross, expenses, cwt, compensationTaxable, compensationWithheld only (Estimator.jsx:96-100). credits = cwt + compensationWithheld (individual.js:64). Verifier re-ran WS-07: gross 1,200,000, expenses 300,000 -> preview 'BIR Form 1701A ... Tax payable with the annual return ₱76,000', with no way to enter quarterly payments. grep for 'quarter' in individual.js/Estimator.jsx finds only the forms strings and the 2551Q note.
  - Sources: https://bir-cdn.bir.gov.ph/local/pdf/1701Q%20Jan%202018%20final%20rev2_copy.pdf (cumulative taxable income with previous quarter; ₱250,000 allowable reduction item; prior-quarter payments and creditable tax withheld) ; https://bir-cdn.bir.gov.ph/local/pdf/1701Q%20Guide%20Jan%202018_copy.pdf
- **WH-11** location: `src/engine/estimators/corporation.js:77-82 (cwt-only payable rows), 97 (netPayable); src/pages/Estimator.jsx:250-252, 262-268 (no quarterly-payment input)`
  - Evidence: Verifier run (v2.out): estimateCorporation({grossSales 10M, costOfSales 4M, opex 3M, assets 50M, cwt 100,000, registrationYear 2015, taxYear 2026}) gives rows 'Income tax due: 600000', 'Less: creditable tax withheld (2307s): -100000', 'Income tax still payable: 500000'; netPayable 500000. Hand: 600,000 − 450,000 − 100,000 = 50,000 (WS-23).
  - Sources: NIRC Secs 75-77 (quarterly payments; final adjustment return credits quarterly payments; carry-over under Sec 76), RA 8424 as amended: https://lawphil.net/statutes/repacts/ra1997/ra_8424_1997.html ; BIR Form 1702-RT (Jan 2018) tax credits/payments section: https://bir-cdn.bir.gov.ph/local/pdf/1702-RT%20Jan%202018%20ENCS%20Final%20v3.pdf

### H07 (High): Rules the rulebook marks "needs review" are shown as firm: the SEC AFS date for 2027, PhilHealth and Pag-IBIG …
- **Original IDs:** CH-02, DL-05, INF-05
- **CH-02** location: `src/pages/References.jsx:15-27 (ruleEntries drops value and confidence; comment claims they are listed), 116-118 (claim 'exactly what the calculators and calendar use'); src/pages/Dashboard.jsx:323-342 (DeadlineRow renders title/desc only, no notes/confidence); src/pages/Checklist.jsx:49-61 (shows notes, no confidence); src/data/rules/obligations.json:458,941,965,1184,1384,1428; …`
  - Evidence: Verifier grep 'confidence/needs_review' in src/**/*.js(x): only the comment at References.jsx:16. obligations.json counts: 50 verified, 6 needs_review (bir-einvoicing, philhealth-self, pagibig-self, sec-afs-calendar, bir-crm-pos, bir-fbt-note). Verifier re-run (v1.out), default individual profile, window 2026-10-07 + 400 days (the Dashboard's window, Dashboard.jsx:43): 27 of 47 occurrences from needs_review rules ['pagibig-self','philhealth-self']. Default corporation: sec-afs-calendar 2027-05-31 (raw 2027-05-29, a Saturday).
  - Sources: /home/user/Tax-Suite/src/data/rules/obligations.json ; /home/user/Tax-Suite/src/data/rules/holidays.json
- **DL-05** location: `src/data/rules/obligations.json:458 (bir-einvoicing), 941 (philhealth-self), 965 (pagibig-self), 1184 (sec-afs-calendar; note at 1186); src/data/rules/holidays.json:9-14 (confidence, confidenceByYear); src/pages/Dashboard.jsx:131-249 and src/pages/References.jsx:83-114 never read `confidence``
  - Evidence: grep -rn for confidence / legalBasis in src excluding src/data: the only UI match for confidence is a comment at src/pages/References.jsx:16. Dashboard DeadlineRow (Dashboard.jsx:323-342) shows title, desc and the shift note only, never notes or confidence. Verifier ws.mjs: corp sec-afs-calendar raw 2027-05-29 (Sat) gives app 2027-05-31, period "TY 2026". The FY2025 move from May 29 to June 15, 2026 is recorded in the app's own obligations.json:1182 legal basis and meta.json. PhilHealth Circular 2026-0011 and its due dates are the auditor's (not re-fetched by the verifier: WebFetch egress-blocked and web-search budget exhausted); the verifier could not confirm the self-paying due date …
  - Sources: https://www.grantthornton.com.ph/insights/articles-and-updates1/tax-notes/sec-mc-no-9-2026-guidelines-on-the-filing-of-afs-and-gis/ ; https://www.pna.gov.ph/articles/1273093 ; https://www.philhealth.gov.ph/circulars/2026/TS-PC-2026-0011-English.pdf
- **INF-05** location: `src/pages/References.jsx:18-27 (ruleEntries keeps only key, legalBasis and notes, dropping value and confidence), :51-54, :70-81, :115-119; src/pages/Estimator.jsx:104-110 (line 107); README.md:74-76; needs_review entries: business-tax.json:21-26 (vatRegistrationDeadline), holidays.json:9 and :52, obligations.json bir-einvoicing (437), philhealth-self (920), pagibig-self (945), sec-afs-calendar …`
  - Evidence: grep for 'confidence' in src outside src/data finds only the code comment at References.jsx:16. A python walk of the rules JSON lists exactly these needs_review paths: business-tax vatRegistrationDeadline; holidays (top) and notes2027; obligations bir-einvoicing, philhealth-self, pagibig-self, sec-afs-calendar, bir-crm-pos, bir-fbt-note; withholding-compensation minimumWageReference. ruleEntries() returns {file, key, legalBasis, notes}; ewt-rates.json rates.value (the ATC/rate table) and withholding-compensation.json deMinimis.value are read by no code other than References.jsx, which never renders .value. Estimator.jsx:107 shows the VAT-registration sentence whenever gross exceeds ₱3M. …
  - Sources: https://www.respicio.ph/commentaries/vat-liability-after-exceeding-the-vat-threshold ; https://batasnatin.com/news/sme-vat-registration-threshold-philippines

### H08 (High): Profile setup tells a VAT-registered mixed-income earner on OSD that they file Form 1701A. The 8% card for mixed income …
- **Original IDs:** INF-03
- **Worksheets:** INF:W-INF-5
- **INF-03** location: `src/pages/ProfileWizard.jsx:55 (isBiz covers both 'individual' and 'mixed'), :147 ('files 1701A'), :128 (8% card)`
  - Evidence: Code: ProfileWizard.jsx:55 const isBiz = p.type === 'individual' // p.type === 'mixed'; the VAT-registered block (lines 141-155) renders ':147 40% Optional Standard Deduction: simpler books, files 1701A.' for both types. Verifier engine run (scratch posted-info-verify/ws.mjs, mixed profile, VAT on, graduated_osd): calendar lists '2027-04-15 bir-1701-annual 1701'; estimateIndividual osd option forms = '1701Q + 1701 + 2550Q' (individual.js:84). forms.js:6 describes 1701A as 'Purely self-employed on 8% or graduated + OSD' and forms.js:8 lists 1701 for 'mixed-income earners'. Legal basis: RMC 17-2019 made the 1701A available to individuals earning income PURELY from business or profession (8% …
  - Sources: https://home.kpmg.com/content/dam/kpmg/ph/pdf/InTAX/2019/RMC%20No%2017-2019.pdf ; https://www.grantthornton.com.ph/insights/articles-and-updates1/tax-notes/new-bir-form-1701a-for-individuals-now-available/

### H09 (High): Blog posts are out of date or incomplete: "Issue a BIR-registered invoice for every payment you receive" (pre-EOPT …
- **Original IDs:** INF-04, INF-12
- **Worksheets:** INF:W-INF-7
- **INF-04** location: `src/data/posts.js:19 (first-year post, 'Every month' list); src/data/posts.js:23 (eAFS sentence); compare src/data/rules/obligations.json:1258-1277 (bir-invoices), src/data/rules/business-tax.json:27-32 (servicesAccrualBasis), :45-50 (invoiceIssuanceThreshold), src/data/rules/attachments.json:34-38 (itrAttachmentDeadline, shown on the Forms page)`
  - Evidence: posts.js:19 reads 'Issue a BIR-registered invoice for every payment you receive.'; posts.js:23 reads '...upload the scans through the BIR's eAFS portal within 15 days of filing.' The wording is unchanged from v1 (legacy/index.html contains the same string) but the post is dated 'May 2026'. obligations.json:1260 says 'Since the EOPT Act, the invoice is the primary document for both goods and services; official receipts are supplementary only.' business-tax.json:46-49 (₱500 threshold, VAT-registered always) and attachments.json:35 ('whichever comes LATER: April 30 for calendar-year annual returns filed on time'), rendered at Forms.jsx:40. NIRC Sec 113 and 237 as amended by RA 11976 require …
  - Sources: https://forvismazars.com/ph/en/insights/tax-alerts/ease-of-paying-taxes-act/vat-invoicing-requirements-eopt-act ; https://www.grantthornton.com.ph/alerts-and-publications/technical-alerts/tax-alert/2024/implementation-of-the-amendments-introduced-by-eopt-act-on-the-invoicing-requirements-and-registration-procedures/ ; https://www.reyestacandong.com/bir-issuances-rr-3-2024/
- **INF-12** location: `src/data/posts.js:3-13 (post '8-vs-grad', sentence at :6); compare src/data/rules/income-tax.json:16-26 (allowanceForMixedIncome 0, grossCeiling 3,000,000) and src/engine/estimators/individual.js:43-44, 112`
  - Evidence: posts.js:6 text quoted above; no other sentence in the post mentions salary income, mixed income, VAT or ₱3M. Engine (scratch posted-info-verify/w7.mjs): mixed income, business gross ₱600,000, taxable compensation ₱500,000: 'Income tax on business @ 8% of gross = 48000' (the post's formula gives (600,000 - 250,000) x 8% = 28,000). Pure self-employed gross ₱3,200,000: 8% option eligible = false. Legal basis: NIRC Sec 24(A)(2)(b) and RR 8-2018 Sec 2 (8% only if gross sales/receipts and other non-operating income do not exceed the VAT threshold; mixed-income earners get no ₱250,000 reduction), RMC 50-2018; the app's own income-tax.json:16-26 encodes the same rules.
  - Sources: https://assets.kpmg.com/content/dam/kpmg/ph/pdf/topofmindarticles/2018/July242018TopOfMind.pdf (RMC 50-2018 summary; not re-fetched by the verifier: WebFetch is egress-blocked for these hosts and the shared web-search budget was exhausted) ; https://juan.tax/wp-content/uploads/2018/05/RMO_No.-23-2018.pdf

### H10 (High): The References entry on the NCR minimum wage still says ₱695 / ₱658 (Wage Order NCR-26) is operative. Wage Order NCR-28 …
- **Original IDs:** INF-02, WH-02
- **INF-02** location: `src/data/rules/withholding-compensation.json:63-68 (minimumWageReference value, legalBasis, notes); rendered by src/pages/References.jsx:70-81 (legalBasis and notes only)`
  - Evidence: Verifier confirmed the text: withholding-compensation.json:67 reads 'NCR-27's ₱85 increase is judicially frozen as of Aug 26, 2026; ... the operative NCR floor for minimum-wage-earner exemption purposes remains NCR-26's ₱695 (₱658 agriculture/small retail)'; :66 is confidence needs_review; References.jsx:18-27 keeps only legalBasis and notes, so the notes are what users read. NCR-28 facts are the auditor's search-result summaries of NWPC, DOLE and Philstar (not re-fetched by the verifier: WebFetch is egress-blocked for these hosts and the shared web-search budget was exhausted). Corroboration: the withholding-area auditor independently used the NCR-28 ₱755 rate in its own test inputs …
  - Sources: https://nwpc.dole.gov.ph/wp-content/uploads/2026/09/Wage-Order-No.-NCR-28.pdf ; https://nwpc.dole.gov.ph/wp-content/uploads/2026/09/Latest-Wage-Order-Matrix-11-September-2026.pdf ; https://dole.gov.ph/news/tolentino-p60-ncr-wage-hike-in-full-effect-today/ ; https://www.philstar.com/headlines/2026/09/27/2559226/p60-ncr-wage-hike-takes-effect
- **WH-02** location: `src/data/rules/withholding-compensation.json:63-68; displayed by src/pages/References.jsx:18-27, 70-79 (notes only; the needs_review flag is not shown); src/data/rules/meta.json:3 (verifiedDate 'August 26, 2026')`
  - Evidence: withholding-compensation.json:67 says 'the operative NCR floor for minimum-wage-earner exemption purposes remains NCR-26's ₱695'. The NCR-28 facts come only from the auditor's search extracts of the two news articles below. The verifier's WebSearch budget was exhausted and WebFetch/curl were blocked for philstar.com, businessmirror.com.ph, nwpc.dole.gov.ph and every other source domain, so the verifier could neither confirm nor refute it.
  - Sources: News (secondary, unconfirmed): https://www.philstar.com/headlines/2026/09/26/2559067/p60-wage-hike-metro-manila-minimum-wage-earners-takes-effect ; News (secondary, unconfirmed): https://businessmirror.com.ph/2026/09/28/metro-manila-minimum-wage-hike-takes-effect/ ; NCR-27 injunction background (news): https://newsinfo.inquirer.net/2284076/pasig-rtc-extends-suspension-of-ncr-wage-hike-2

### H11 (High): Profile setup says loose-leaf books are due "every January 15" and CAS back-ups "by January 30". For fiscal-year …
- **Original IDs:** CH-04, INF-11(b)
- **CH-04** location: `src/pages/ProfileWizard.jsx:210-212; src/data/rules/obligations.json (bir-looseleaf-books: annual_fy daysAfterEnd 15; bir-cas-books: annual_fy daysAfterEnd 30; both notes say 'January 15/30 for calendar-year taxpayers'); src/engine/deadlines.js:102-114`
  - Evidence: Verifier re-run (v1.out): corporation, fiscalYearEndMonth 6, booksType looseleaf -> bir-looseleaf-books 2026-07-15; booksType cas -> bir-cas-books 2026-07-30. Python: Jun 30 2026 + 15 days = Wed Jul 15 2026; + 30 days = Thu Jul 30 2026. Wizard text (ProfileWizard.jsx:211-212): 'bound copies submitted every January 15.' and 'annual back-up/registration by January 30.' The deadlines-area verified table marks '15 days (bound loose-leaf) / 30 days (CAS) after close of taxable year' as OK (secondary source https://www.aureadalaw.com/post/bir-philippines-loose-leaf-books-binding-registration-deadlines-for-2026); not re-fetched by this verifier (egress blocked).
  - Sources: /home/user/Tax-Suite/src/data/rules/obligations.json ; https://www.aureadalaw.com/post/bir-philippines-loose-leaf-books-binding-registration-deadlines-for-2026 (secondary; cited by the tax-deadlines verified table)
- **INF-11** location: `(a) src/data/forms.js:13 vs src/data/rules/business-tax.json:33-38 and obligations.json:404; (b) src/pages/ProfileWizard.jsx:211-212; (c) src/pages/Profiles.jsx:66; (d) src/pages/Dashboard.jsx:143 and src/pages/Forms.jsx:14; (e) src/App.jsx:146-147 and src/pages/References.jsx:59-64 vs src/data/rules/business-tax.json:39-44; (f) README.md:3, src/pages/Blog.jsx:16, src/data/rules/meta.json:6`
  - Evidence: Verifier confirmed each quoted string at the listed lines. Forms.jsx:14 useState('1701Q') is the default open form; Dashboard.jsx:143 calls nav('/forms') with no form code. business-tax.json:39-44 (digitalServicesVat) cites RA 12023. RMC 52-2023 (May 2023) allows optional monthly 2550M filing with no deadline and no penalty (Forvis Mazars, PNA).
  - Sources: https://forvismazars.com/ph/en/insights/tax-alerts/bir-rmc-52-2023 ; https://alpha.pna.gov.ph/articles/1201607

### H12 (High): The Tools "Year-to-date projector" always subtracts ₱250,000 and shows an 8% tax for every profile, including …
- **Original IDs:** GAP-01, BUG-13, UX-13 (months)
- **Worksheets:** GAP:GW-3, GAP:GW-4, GAP:GW-5, GAP:GW-6
- **GAP-01** location: `src/pages/Tools.jsx:11, 33-37 (proj8 at :35 always uses EIGHT.allowanceForPureSelfEmployed), 104-126 (card; the only warning, at :125, is for projections over ₱3M); compare src/data/rules/income-tax.json:19-20 (allowanceForMixedIncome 0) and src/engine/estimators/individual.js:43 (Estimator applies it correctly)`
  - Evidence: Browser run (Playwright Chromium, local dev server, Asia/Manila; completeness/ytd.cjs -> ytd_out.json), repeated with a mixed-income profile, a pure 8% profile, a VAT-registered OSD profile and a corporate profile active. All four show identical figures: at the default ₱240,000 / 6 months, 'Projected annual income ₱480,000 · Estimated 8% tax ₱18,400 · Set aside / month ₱1,533'; at ₱1,200,000 / 6 months, ₱2,400,000 · ₱172,000 · ₱14,333. No warning appears for the VAT or corporate profiles. Exact hand computation (completeness/scripts/hand.py, hand.out): mixed 8% = 8% x 480,000 = 38,400 (3,200 a month) and 8% x 2,400,000 = 192,000 (16,000 a month). The difference is 20,000 = 8% x 250,000 in …
  - Sources: NIRC Sec 24(A)(2)(b)-(c) as amended by RA 10963 https://www.lawphil.net/statutes/repacts/ra2017/ra_10963_2017.html ; RR 8-2018 digest https://bir-cdn.bir.gov.ph/local/pdf/Digest%20RR%208-2018_copy.pdf (rules 'no ₱250,000 reduction for mixed income' and '8% not available to VAT-registered' are verified OK in the tax-individual, bugs and UX rules tables; not re-fetched in this pass)
- **BUG-13** location: `src/pages/Tools.jsx:33-34 (mIn = Math.min(12, Math.max(0, ytdMonths)))`
  - Evidence: Verifier re-run (bugs-verify/v1.cjs): Gross so far 240,000 and Months in 15: the field shows '15' but 'Projected annual income ₱240,000' (computed with 12). With 15 months the projection would be 240,000 / 15 x 12 = ₱192,000. Engine check: mIn 0 gives projection 0.
- **UX-13** location: `src/pages/Tools.jsx:33-34 (Math.min(12, …) with no message); src/engine/estimators/individual.js:51 and corporation.js:27-28 (Math.max(0, …)); src/components/ui.jsx:29-30 and src/lib/format.js:16-19 (blank becomes 0)`
  - Evidence: Verifier re-run (ux-verify/v05_inputs.cjs): Months in 18 -> field '18', 'Projected annual income ₱240,000'; Months 0 -> '₱0'; gross 300,000 with expenses 900,000 -> page text has no 'loss/exceed'; cleared field -> value "0". Engine (eng.mjs): itemized rows 'Less: itemized expenses -900,000 / Net taxable business income 0 / Graduated income tax 0'. See WS-4. Overlaps BUG-13 (months clamp) and TI-08 (NOLCO); the audit's line 'no error or warning messages anywhere' was corrected because over-₱3M warnings do exist.
  - Sources: Playwright run ; vite-node engine run

### H13 (High): Corporate MCIT start year: the wizard lists only 1997 to 2026 and defaults to "Not sure". With "Not sure" the estimator …
- **Original IDs:** BUG-04, WH-12, WH-05(d)
- **Worksheets:** BUG:W6, WH:WS-24
- **BUG-04** location: `src/pages/ProfileWizard.jsx:169-176 (options: 'Not sure' + 30 years counting back from the current year); src/engine/profile.js:45 (registrationYear: null default); src/engine/estimators/corporation.js:36 (mcitApplies requires a year) and 69-72; src/pages/Estimator.jsx:270-276 (headline)`
  - Evidence: Engine (vite-node bugs-verify/v_engine.mjs): gross sales 10,000,000, cost of sales 2,000,000, opex 7,800,000, assets 1,000,000, TY 2026. registrationYear null gives {rcit:40000, mcit:0, mcitApplies:false, incomeTaxDue:40000}; registrationYear 1997 gives {rcit:40000, mcit:160000, mcitApplies:true, usesMcit:true, incomeTaxDue:160000}. Code: ProfileWizard.jsx:171-174 builds Array.from({length:30}) of currentYear - i. Law: MCIT applies from the 4th taxable year after the year operations commenced (NIRC Sec 27(E)); the corporate area (WH-12) notes RR 9-98 counts from the year of BIR registration. Either way a corporation that began in 1990 is in MCIT years for 2026. Overlaps WH-05(d) in the …
- **WH-12** location: `src/pages/ProfileWizard.jsx:169-176; src/engine/estimators/corporation.js:34-36 (registrationYear + 4)`
  - Evidence: Verifier run (v1.out): registrationYear 2023, taxYear 2026, GS 6M, opex 5.9M gives mcitApplies false, due 20,000. registrationYear 2022 gives due 120,000 (v2.out 'FY' line). Hand: MCIT 2% × 6,000,000 = 120,000 > RCIT 20% × 100,000 = 20,000 (WS-24).
  - Sources: RR 9-98 Sec 2.27(E): the taxable year operations commenced is the year of BIR registration: https://lawphil.net/administ/bir/rr/rr1998.html
- **WH-05** location: `src/engine/estimators/corporation.js:23-41, 70-73; src/data/rules/corporate.json:30-36 (osdCorporate, unused); src/data/forms.js:10 (1702Q lines); src/pages/ProfileWizard.jsx:169-173`
  - Evidence: grep: osdCorporate is read only by References.jsx. corporation.js has no carry-over or OSD inputs. WS-16: MCIT 400,000 > RCIT 250,000, so 150,000 should carry forward 3 years, and the app has nowhere to apply it next year. ProfileWizard year options: Array.from({length:30}) from the current year, i.e. 2026 back to 1997. With registrationYear null the result row says 'Set "year operations began" on the profile to check the 2% MCIT' (v2.out), and mcitApplies is false (corporation.js:36).
  - Sources: RR 12-2007 (quarterly cumulative MCIT): https://bir-cdn.bir.gov.ph/BIR/pdf/37123rr%2012-2007.pdf ; RR 16-2008 (corporate OSD 40% of gross income): https://bir-cdn.bir.gov.ph/BIR/pdf/43181rr%2016-2008.pdf ; NIRC Sec 27(E)(2) carry-forward, via RR 9-98: https://lawphil.net/administ/bir/rr/rr1998.html

### H14 (High): There is no privacy notice, consent step or terms anywhere, although the app collects client names, income, withholding …
- **Original IDs:** SEC-01
- **SEC-01** location: `src/pages/Auth.jsx:16-24,65-67; src/App.jsx:143-152 (footer: tax disclaimer only); src/pages/Estimator.jsx:48-76 (autosave at :64, 900 ms timer at :73), :82-84, :222, :250-252, :288; src/engine/profile.js:23-49; src/pages/ProfileWizard.jsx:84-85; app.html:10-12; index.html:11-13`
  - Evidence: grep -rniE 'privacy/consent/10173/personal data/terms of/cookie' over src/, README.md and app.html: no matches. Auth.jsx:17 calls supabase.auth.signUp({ email, password }) with no consent step. Estimator.jsx:64 calls app.save({...current, inputs:{...,[key]:inputs}}) from a 900 ms timer (:73) restarted on each keystroke; no on-screen text mentions saving (grep 'saved/remember/stored' in Estimator.jsx finds only code and comments). Verifier re-run (security-verify/ls-demo.mjs via vite-node): saving a 'mixed' profile named 'Maria Santos' stored {"name":"Maria …
  - Sources: https://lawphil.net/statutes/repacts/ra2012/ra_10173_2012.html (UNVERIFIED in session: lawphil.net, privacy.gov.ph, officialgazette.gov.ph, elibrary.judiciary.gov.ph all blocked by the egress proxy) ; https://raw.githubusercontent.com/github/docs/main/content/pages/getting-started-with-github-pages/what-is-github-pages.md (visitor IP addresses logged)

### H15 (High): On phones (360 px wide) the deadline list, the Forms list and the Profiles list are squashed: titles wrap one word per …
- **Original IDs:** UX-04
- **UX-04** location: `src/pages/Dashboard.jsx:323-341 (DeadlineRow: tags/boxcode flexShrink 0, title column minWidth 0); src/styles/app.css:98 (.list-card overflow hidden), :99 (.frow no wrap), :146 and :153-157 (.tag/.boxcode nowrap + flex-shrink 0), :281-285 (.agency nowrap); src/pages/Forms.jsx:81-92 (row overflow hidden; 'when' whiteSpace nowrap, flexShrink 0); src/pages/Profiles.jsx:33-58`
  - Evidence: Verifier re-run (ux-verify/v_mobile.cjs, v_forms.cjs; 360x740 and 320x740, mobile emulation). Dashboard first rows: title/description column width 0 px (agency tag at x=113, form code at x=196-330); list-card scrollWidth 385 vs clientWidth 322 (282 at 320 px); page height 10,735 px at 360. Forms at 360: 12 rows wider than their clipped box, widest '0619-F / 1601-FQ / 1604-F' 651 vs 322 px; 1702-RT 444 vs 322. Profiles: name column 37 px at 360, 0 px at 320. Screenshots: /tmp/claude-0/-home-user-Tax-Suite/5f55781b-8e32-597f-b833-03712e4a9117/scratchpad/audit/ux-verify/v_m360_profiles.png, …
  - Sources: Playwright run ; WCAG 2.2 SC 1.4.10 (https://www.w3.org/TR/WCAG22/#reflow)

### H16 (High): Rates, thresholds and due dates are typed as fixed text in about 40 places (labels, banners, wizard text) instead of …
- **Original IDs:** CH-01
- **CH-01** location: `src/engine/estimators/individual.js:69,75,79,85,95,112,119,121,124,136,139; src/engine/estimators/corporation.js:36,55,56,59,62,67,71,75,76; src/engine/estimators/employee.js:46; src/engine/estimators/payroll.js:9,41; src/engine/estimators/penalties.js:12,23; src/pages/Estimator.jsx:106,128,137,177,230,266,273; src/pages/Tools.jsx:51,66,88,106,117,125; …`
  - Evidence: Verifier grep of code outside src/data/rules (word match): vatRate 0 refs, grossCeiling 0, excessCarryForwardYears 0, startsInTaxableYear 0, convention 0, effectiveFrom 0, taxYearDefault 0; 'classification' appears only as prose in forms.js:7 and References.jsx:34/62 (value never read). Meanwhile '12%' is literal at individual.js:139, corporation.js:76, Estimator.jsx:137,177; '₱20M' at Tools.jsx:51; '3 years' at corporation.js:62; 'registrationYear + 4' at corporation.js:36,67; '/ 365' at penalties.js:23; '* 0.5' at penalties.js:12; '₱3,000,000' at Estimator.jsx:106, ProfileWizard.jsx:120,163; '₱3M' at Estimator.jsx:128, Tools.jsx:125, corporation.js:75, forms.js:7,8,11,12,13. …
  - Sources: /home/user/Tax-Suite/README.md ; /home/user/Tax-Suite/src/data/rules/meta.json

### H17 (High): The penalty calculator asks only "days late". It has no due date or payment date, no weekend/holiday roll-over, applies …
- **Original IDs:** TB-02, TB-06, BUG-06
- **Worksheets:** TB:W10, TB:W11, BUG:W5
- **TB-02** location: `src/pages/Tools.jsx:15-23,49-58; src/engine/estimators/penalties.js:18-34; src/data/rules/penalties.json:3-14`
  - Evidence: Worksheet W10. Verifier re-ran: estimatePenalty({taxDue:20000,daysLate:61,microSmall:true}) = 2,000.00 + 200.55 + 2,500.00, total 24,700.55. Python: Nov 15, 2023 (Wednesday) to Jan 15, 2024 = 61 days; 25% = 5,000.00; 20,000 × 12% × 61/365 = 401.0959 → 401.10; Annex A tier 10,001–20,000 = 5,000; total 30,401.10 (the engine's Medium/Large result, 30,401.10, equals this). The auditor's secondary sources (KPMG, Grant Thornton) state that the EOPT reductions apply prospectively from Jan 22, 2024. The 20%-to-12% change under TRAIN from Jan 1, 2018 is also in the auditor's MTF Counsel source and matches the verifier's knowledge of Sec 249 before and after TRAIN. The verifier could not re-fetch any …
  - Sources: https://kpmg.com/ph/en/insights/2024/04/special-intax-april-2024-issue-1-volume-3.html (secondary) ; https://www.grantthornton.com.ph/insights/articles-and-updates1/tax-notes/eopt-is-here-revised-rules-on-taxpayer-classification-and-reduced-penalties-for-micro-and-small-taxpayers/ (secondary) ; https://mtfcounsel.com/2024/05/16/deficiency-interest/ (secondary)
- **TB-06** location: `src/pages/Tools.jsx:16,23,55,65; src/engine/estimators/penalties.js:19-24; src/data/rules/penalties.json:10,12; src/engine/dates.js:42-47`
  - Evidence: Worksheets W11 and W12. Python: Jul 25, 2026 is a Saturday; Jul 27 to Aug 3 = 7 days, Jul 25 to Aug 3 = 9 days; 10,000 × 6% × 7/365 = 11.51, × 9/365 = 14.79 (engine gives the same). Leap case: 100,000 × 12% × 366/365 = 12,032.88 (app); on a 366-day basis 12,000.00; actual/actual (67/365 + 299/366) 12,006.02. Verifier added the zero-day case: estimatePenalty({taxDue:50000, daysLate:0}) gives surcharge 12,500, interest 0, compromise 10,000 (Micro/Small: 5,000 + 0 + 5,000). parseNum('') returns 0, so clearing the field gives the same result. RR 21-2018 (primary PDF blocked) says interest runs 'from the date prescribed for payment until full payment'. Its day-count illustration could not be …
  - Sources: https://bir-cdn.bir.gov.ph/local/pdf/RR%2021-2018.pdf (primary; not readable through the proxy) ; https://platonmartinez.com/articles/bir-revenue-regulations-no-21-2018-14-september-2018 (secondary)
- **BUG-06** location: `src/pages/Tools.jsx:15-23 and 61-76 (pen = estimatePenalty(...) always applied); src/engine/estimators/penalties.js:19-33 (surcharge and compromise do not depend on daysLate)`
  - Evidence: Verifier re-run (bugs-verify/v1.cjs): Basic tax due 50,000, Days late 0, Micro/Small shows Surcharge ₱5,000.00, 'Interest · 0 days' ₱0.00, Compromise ₱5,000.00, 'Estimated total to pay ₱60,000.00'. Days late blank gives the same. Engine: estimatePenalty({taxDue:50000, daysLate:0, microSmall:true}) = {surcharge:5000, interest:0, compromise:5000, total:60000}. Law: the Sec 248(A) surcharge is for failure to file/pay on or before the prescribed date, and Sec 249 interest runs from the due date (rows verified in the penalties area). The auditor also listed 'Basic tax due blank shows ₱500' as a defect; that part is dropped, because a late return with no tax due can still carry a compromise …

### M01 (Medium): The individual estimator has no taxable-year label or choice, and every rule holds one value with no effective dates …
- **Original IDs:** TI-02, TB-05, CH-09
- **Worksheets:** TI:WS-17, TI:WS-18, TI:WS-19, TB:W14
- **TI-02** location: `src/data/rules/income-tax.json:3-15; src/data/rules/business-tax.json:15-20; src/engine/estimators/individual.js:10-14, 47, 136; src/pages/Estimator.jsx:80-90 (no year field)`
  - Evidence: Verifier re-ran: gross 500,000 -> app 8% 20,000 / OSD 22,500 (7,500 + 15,000) / itemized 57,500, best 8%. Exact hand computation (hand.py): TY2022 with 2018-2022 table and 1% PT -> 8% 20,000 / OSD 10,000 + 5,000 = 15,000 / itemized 55,000 + 5,000 = 60,000, best OSD (WS-17). TY2023 with PT 1% for H1 and 3% for H2 (even sales) -> PT 10,000, OSD 17,500 (WS-18). 2018-2022 table: 300,000 -> 10,000 (app 7,500); 1,000,000 -> 190,000 (app 152,500); 2,000,001 -> 490,000.32 (app 402,500.30) (WS-19). Both tables' bracket bases recomputed and internally consistent. No taxYear in individual.js or IndividualEstimator (the corporate estimator does pass a year). The page's legal-basis note prints …
  - Sources: https://bir-cdn.bir.gov.ph/local/pdf/1701A%20Jan%202018%20v5%20with%20rates.pdf (Table 1: Jan 1 2018-Dec 31 2022; Table 2: Jan 1 2023 onwards) ; https://bir-cdn.bir.gov.ph/local/pdf/Digest%20RR%208-2018_copy.pdf ; https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/2/93191 (RA 11534 Sec 116: 1% from July 1, 2020 until June 30, 2023) ; https://bir-cdn.bir.gov.ph/local/pdf/RMC%20No.%2069-2023%20v2.pdf (reversion to 3% from July 1, 2023)
- **TB-05** location: `src/data/rules/business-tax.json:15-20; src/engine/estimators/individual.js:14,47,136; src/engine/estimators/corporation.js:10,43,75; src/pages/Estimator.jsx:256; src/data/rules/income-tax.json:12 (brackets 2023 onward only)`
  - Evidence: Worksheet W14. Verifier re-ran estimateCorporation({grossSales:2400000, …, taxYear}) for 2022, 2023, 2024 and 2026: pct = 72,000 every time. estimateIndividual({gross:2400000, expenses:1800000}): OSD and itemized pct = 72,000. Correct: TY2022 = 4 × 600,000 × 1% = 24,000; TY2023 = 2 × 6,000 + 2 × 18,000 = 48,000; TY2024 = 72,000. The 1% window (RA 11534, amending Sec 116; reverted by RMC 69-2023) matches the rulebook's own legalBasis text at business-tax.json:17.
  - Sources: https://batasnatin.com/laws/rmc-no-69-2023-reverts-the-rates-of-percentage-tax-minimum-corporate-income (secondary) ; https://www.grantthornton.com.ph/insights/articles-and-updates1/tax-notes/reversion-of-rates-of-percentage-tax-minimum-corporate-income-tax-and-regular-income-tax-on-proprietary-educational-institutions-and-not-for-profit-hospitals (secondary)
- **CH-09** location: `src/data/rules/*.json (single 'value' per rule); src/data/rules/business-tax.json:15-19; src/data/rules/corporate.json:14-22; src/data/rules/withholding-compensation.json:42-61 (effectiveFrom unused); src/data/rules/income-tax.json:14; src/pages/Estimator.jsx:256; src/engine/estimators/corporation.js:25`
  - Evidence: Verifier grep: deMinimis.effectiveFrom has 0 code references. estimateIndividual/estimateEmployee take no year parameter. Estimator.jsx:256 passes taxYear: new Date().getFullYear(). business-tax.json percentageTaxRate.value = 0.03, with the 1% window only in legalBasis text; corporate.json mcit.value.rate = 0.02, 1% window only in legalBasis text.
  - Sources: /home/user/Tax-Suite/src/data/rules/income-tax.json ; /home/user/Tax-Suite/src/data/rules/business-tax.json

### M02 (Medium): The 8% test and base ignore "other non-operating income", and the app never asks whether the business is subject to …
- **Original IDs:** TI-06
- **TI-06** location: `src/engine/estimators/individual.js:21-37, 43-45; src/pages/Estimator.jsx:95-101; rulebook note src/data/rules/income-tax.json:25`
  - Evidence: Verifier re-ran: gross 2,900,000 -> 8% eligible, total 212,000, best 8%; gross 2,000,000 -> 8% 140,000. Exact: (2,100,000 - 250,000) x 8% = 148,000 when ₱100,000 non-operating income exists. No non-operating-income field in estimateIndividual inputs (individual.js:21-33). income-tax.json:25 notes say 8% is 'Unavailable to ... those subject to other percentage taxes (Secs 117-127)' but eligible8 = !vat only (individual.js:37).
  - Sources: https://bir-cdn.bir.gov.ph/local/pdf/Digest%20RR%208-2018_copy.pdf (8% on gross sales/receipts and other non-operating income in excess of ₱250,000; threshold test includes other non-operating income) ; https://bir-cdn.bir.gov.ph/local/pdf/RMO%20NO.23-2018.pdf ; Secondary: https://kpmg.com/ph/en/home/insights/2018/03/elucidating-the-eight-percent-tax-option.html; https://www.grantthornton.com.ph/insights/articles-and-updates1/lets-talk-tax/revenue-regulations-no.-08-2018-for-individual-taxpayers/ (not available to taxpayers subject to Other Percentage Taxes)

### M03 (Medium): All tax math uses floating-point numbers with three different rounding methods. BIR income tax returns are filled in …
- **Original IDs:** TI-07, CH-05, CH-06, UX-14, WH-10, CH-07
- **Worksheets:** TI:WS-21, TI:WS-23, GAP:GW-1, GAP:GW-2, WH:WS-20
- **TI-07** location: `src/engine/estimators/individual.js:44-62 (no per-line rounding); src/pages/Estimator.jsx:20 (money2 centavos in breakdown), 127, 132, 137 (each card piece rounded separately), 150, 179; src/lib/format.js:1-10`
  - Evidence: WS-21: gross 416,761 OSD: form lines OSD 166,704.40 -> ₱166,704, net ₱250,057, tax 15% x 57 = 8.55 -> ₱9; app taxes unrounded net 250,056.60 -> 8.49 -> card ₱8 (breakdown ₱8.49). Verifier re-ran the brute force independently (tax-individual-verify/roundcheck.mjs) over 392,858 gross values (250,000-3,000,000 step 7): 25,239 (6.4%) OSD income-tax figures differ by ₱1 from per-line rounding; 102,262 (26.0%) cards where money(incomeTax)+money(pct) != money(total), e.g. gross 416,684: ₱2 + ₱12,501 shown with total ₱12,502. Correction to the auditor: the auditor reported 0 display errors from float noise alone; the verifier's exact BigInt comparison (floatcheck.mjs, 4,954,920 displayed values …
  - Sources: https://bir-cdn.bir.gov.ph/local/pdf/1701%20Jan%202018%20final%20with%20rates.pdf ('DO NOT enter Centavos; 49 Centavos or Less drop down; 50 or more round up', per the auditor's search excerpt) ; https://bir-cdn.bir.gov.ph/local/pdf/1701Q%20Jan%202018%20final%20rev2_copy.pdf ; https://bir-cdn.bir.gov.ph/BIR/pdf/1701-MS%20Guide%20August%202024%20ENCS_Final.pdf
- **CH-05** location: `src/pages/Estimator.jsx:127 (total), 132 (income tax), 137 (business tax), 150-151; src/lib/format.js:1-5 (money rounds each value independently)`
  - Evidence: Verifier re-run (v1.out): gross 650,050, OSD card shows ₱21,005 + ₱19,502 with total ₱40,506 (parts add to ₱40,507); gross 316,950, expenses 0, itemized card ₱10,043 + ₱9,509 with total ₱19,551. Independent verifier sweep (sweep.mjs: gross 250,001–3,000,000 step 37, expenses 0/30%/55%): 113,326 of 445,950 non-VAT graduated cards (25.4%) have parts that do not equal the total. Auditor's own sweep: 2,771 of 10,836 (25.6%).
- **CH-06** location: `src/engine/tax.js:5-13; src/engine/estimators/individual.js:45-62; src/engine/estimators/employee.js:28-58; src/engine/estimators/penalties.js:22-23; src/engine/estimators/contributions.js:6; src/lib/format.js:1-10`
  - Evidence: Verifier re-run (v1.out): gross 375,865, expenses 125,288: itemized IT raw 86.55, PT raw 11275.949999999999, total raw 11362.499999999998; card money() ₱87 / ₱11,276 / ₱11,362; rows ₱86.55 / ₱11,275.95 / ₱11,362.50. Python Decimal: 15% × 577 = 86.55; 3% × 375,865 = 11,275.95; sum 11,362.50 -> half-up 11,363. Verifier sweep (sweep.mjs, exact BigInt comparison): 8 of 1,337,850 card values rounded one peso low (e.g. gross 561,430, expenses 308,786: raw 17239.499999999996 shown ₱17,239, exact 17,239.50). Auditor's sweep: 19 of 3.96 million. Employee ₱30k: monthlyWithholding × 12 = 12090.599999999999. money(2.5) = '₱3', money(-2.5) = '−₱2' (latent: all current money() call sites pass …
  - Sources: https://bir-cdn.bir.gov.ph/local/pdf/1701%20Jan%202018%20final%20with%20rates.pdf (rounding instruction as cited by the individual-tax and withholding verified tables; not re-fetched here)
- **UX-14** location: `src/lib/format.js:1-10 (money rounds to pesos, money2 to centavos); src/pages/Estimator.jsx:127-137, :150-151, :176-179 (money) vs :20 (money2); src/engine/estimators/employee.js:31-36, :56; src/engine/estimators/payroll.js:30-32; src/pages/Tools.jsx:63-75`
  - Evidence: Verifier re-run (vite-node, ux-verify/eng.mjs): itemized option incomeTax 5.25 -> '₱5', businessTax 11,906.43 -> '₱11,906', total 11,911.68 -> '₱11,912'. Employee basic 22,740: monthlyWithholding 2.025 -> '₱2.03', take-home 20,844.475 -> '₱20,844.48', 'Total withheld over 12 months' 24.30. Exact hand check in WS-2 and WS-3 (ux-verify/hand.py). Corrections to the audit: location payroll.js:109-110 does not exist (file has 57 lines; the per-period withholding is at :30-32); the clause about negative amounts printing as '−₱' was dropped because no screen shows it. Overlaps TI-07 and WH-10.
  - Sources: vite-node engine run ; Playwright run
- **WH-10** location: `src/engine/tax.js:5-13; src/engine/estimators/employee.js:31-36, 56-57; src/engine/estimators/contributions.js:6, 44-50; src/lib/format.js:7-10; src/engine/estimators/corporation.js:32-39`
  - Evidence: Verifier re-run (v1.out/v2.out): basic 22,748 gives raw withholding 3.1949999999998906, displayed ₱3.19. The exact value is 21.30 × 15% = 3.195, which rounds to ₱3.20. Basic 22,729: monthly shows ₱0.42 but 'Total withheld over 12 months' shows ₱4.99 instead of 12 × 0.42 = ₱5.04. PhilHealth over salaries 10,001-99,999: 45,000 of 89,999 do not foot. 41,186 are 1 centavo over (25,001: 625.03 + 625.03 = 1,250.06 vs premium 1,250.05). 3,814 are 1 centavo under (10,241: 256.02 + 256.02 = 512.04 vs 512.05). Corporation: incomeTaxDue 1,250,000.25 is shown with centavos.
  - Sources: BIR Form 1701 (Jan 2018) whole-peso instruction (auditor's search extract; also relied on by TI-07): https://bir-cdn.bir.gov.ph/local/pdf/1701%20Jan%202018%20final%20with%20rates.pdf ; BIR Form 1702-RT (Jan 2018): https://bir-cdn.bir.gov.ph/local/pdf/1702-RT%20Jan%202018%20ENCS%20Final%20v3.pdf
- **CH-07** location: `src/engine/estimators/contributions.js:41-51`
  - Evidence: Verifier re-run (v1.out): 10,001 -> premium 500.05, EE 250.03, ER 250.03, sum 500.06; 10,003 -> 500.15 vs 500.16; 33,333 -> 1,666.65 vs 1,666.66; 45,555 -> 2,277.75 vs 2,277.76. Python Decimal: 10,001 × 5% = 500.05; ÷ 2 = 250.025, half-up 250.03, × 2 = 500.06.

### M04 (Medium): Itemized expenses above gross silently become ₱0 net income: no loss is shown, and there is no NOLCO input or tracking …
- **Original IDs:** TI-08, UX-13 (losses)
- **Worksheets:** TI:WS-11, TI:WS-14
- **TI-08** location: `src/engine/estimators/individual.js:51, 129-133; src/pages/Estimator.jsx:95-101`
  - Evidence: Verifier re-ran WS-11: gross 500,000, expenses 700,000 -> rows 'Less: itemized expenses (₱700,000.00)', 'Net taxable business income ₱0.00', 'Graduated income tax ₱0.00'; no NOLCO row; itemNet = Math.max(0, gross - expenses) (individual.js:51).
  - Sources: https://lawphil.net/administ/bir/rr/rr14_01.pdf (RR 14-2001, NOLCO; read by the auditor via search excerpt) ; https://bir-cdn.bir.gov.ph/BIR/pdf/43181rr%2016-2008.pdf (RR 16-2008; OSD filer cannot claim NOLCO, 3-year period continues to run; via search excerpt)
- **UX-13** location: `src/pages/Tools.jsx:33-34 (Math.min(12, …) with no message); src/engine/estimators/individual.js:51 and corporation.js:27-28 (Math.max(0, …)); src/components/ui.jsx:29-30 and src/lib/format.js:16-19 (blank becomes 0)`
  - Evidence: Verifier re-run (ux-verify/v05_inputs.cjs): Months in 18 -> field '18', 'Projected annual income ₱240,000'; Months 0 -> '₱0'; gross 300,000 with expenses 900,000 -> page text has no 'loss/exceed'; cleared field -> value "0". Engine (eng.mjs): itemized rows 'Less: itemized expenses -900,000 / Net taxable business income 0 / Graduated income tax 0'. See WS-4. Overlaps BUG-13 (months clamp) and TI-08 (NOLCO); the audit's line 'no error or warning messages anywhere' was corrected because over-₱3M warnings do exist.
  - Sources: Playwright run ; vite-node engine run

### M05 (Medium): Every estimator mode starts with sample figures (₱480,000 gross, ₱600,000 compensation with ₱62,500 withheld, ₱30,000 …
- **Original IDs:** TI-09, BUG-08, BUG-17
- **TI-09** location: `src/pages/Estimator.jsx:48-51 and 67-74 (seeding and save), 82-84 (defaults), 222 (employee defaults), 327-332 (separate tabs), 348 ('Estimating for')`
  - Evidence: useInputs seeds { ...defaults, ...(saved // {}) } (Estimator.jsx:51); update() saves { ...vals, [k]: v }, i.e. all current values including the samples, to profile.inputs[key] after 900 ms (lines 67-74, 64). Defaults at Estimator.jsx:83 include compensationTaxable: 600000, compensationWithheld: 62500. Mixed tab and 'Compensation side' tab use different input keys ('mixed' vs 'employee'). Engine with the mixed defaults: best 8% ₱100,900, payable ₱38,400 (v1.out 'default-mixed').
- **BUG-08** location: `src/pages/Estimator.jsx:82-84 (mixed defaults compensationTaxable 600000, compensationWithheld 62500, saved under key 'mixed'); 222 (employee inputs under key 'employee', monthlyBasic 30000, bonuses 30000); 328-332 (tabs)`
  - Evidence: Engine (bugs-verify/v_engine.mjs): mixed defaults give 'Taxable compensation (annual) 600,000 / Income tax on compensation (graduated) 62,500'; employee defaults give annualTaxable 330,600, annualTax 12,090. The two tabs use separate input keys ('mixed' and 'employee'), so editing one cannot change the other. Same issue is part of TI-09 in the individual-tax area.
- **BUG-17** location: `src/pages/Estimator.jsx:82-84, 222, 250-252, 288 (defaults passed to useInputs); 51 and 68-71 (all values, defaults included, saved on first edit)`
  - Evidence: Code: useInputs seeds { ...defaults, ...saved }. Verifier re-run (bugs-verify/v1.cjs): on a fresh individual profile, editing only the 2307 field saved {gross, expenses, cwt, compensationTaxable:600000, compensationWithheld:62500} to the profile, i.e. the sample figures became stored client data. Part of TI-09 in the individual-tax area.

### M06 (Medium): Estimator figures are saved 0.9 seconds after typing stops. Reloading or closing within that window loses the last …
- **Original IDs:** BUG-05
- **BUG-05** location: `src/pages/Estimator.jsx:48-78 (useInputs: setTimeout(flush, 900) at line 73; .catch(() => {}) at line 64; flush only on in-app unmount at line 76); src/pages/ProfileWizard.jsx:27 and 62 (form seeded once from the in-memory profile, then saved whole)`
  - Evidence: Verifier re-run (bugs-verify/v1.cjs): profile Ana, typed 123456 in 'Itemized expenses', waited 300 ms, reloaded: field shows '180,000' (old value). Typed 222222, waited 1,300 ms, reloaded: '222,222' kept. bugs-verify/v3.cjs: typed 345678 in 'Itemized expenses' and immediately went to #/profiles/ana/edit; storage then held expenses 345678 (the unmount flush worked); renamed the profile and clicked 'Save changes': storage then held the new name with inputs {} (the estimator figures were wiped).

### M07 (Medium): For years with no holiday list (2025, 2028 and later) only weekends are skipped, even holidays fixed by law such as May …
- **Original IDs:** DL-04
- **Worksheets:** DL:WS-13, DL:WS-14
- **DL-04** location: `src/engine/dates.js:44-52 (shiftToBusinessDay only knows the set it is given); src/lib/deadlineData.js:6 (HOLIDAY_SET built only from the listed rows); src/data/rules/holidays.json:15-50 (2026-2027 only); src/pages/Dashboard.jsx:43 (window = today + 400 days)`
  - Evidence: Verifier scratch ws.mjs: corp bir-1601eq Q1 raw 2028-04-30 gives app 2028-05-01 (shifted, reason weekend); corpMay (FY ends May) bir-1702q Q3 raw 2028-04-29 (Feb 29, 2028 + 60 days) gives app 2028-05-01. Scratch h2027.mjs run with the 2028 dates fixed by law added: the first changes are the end-April chain (bir-1702q, bir-sawt-corp-quarterly, bir-1601eq, bir-1601fq, bir-qap, bir-cas-books, bir-inventory-list, bir-eafs-itr-attachments-individual and -corp, sss-employer, sss-self, philhealth-self: app 2028-05-01, correct 2028-05-02), then bir-1601c, bir-0619e/f, pagibig-employer/self (raw Jun 10, 2028: app Jun 12, correct Jun 13). Python: 2028-04-29 Sat, 2028-04-30 Sun, 2028-05-01 Mon, …
  - Sources: https://lawphil.net/executive/proc/proc2024/proc_727_2024.html ; https://www.officialgazette.gov.ph/2026/09/08/proclamation-no-1427-s-2026/

### M08 (Medium): LGU (cedula, PTR, business tax), SEC and DOLE deadlines are moved later when they fall on a weekend or holiday, but no …
- **Original IDs:** DL-06
- **DL-06** location: `src/engine/deadlines.js:142-143 (shift applied to every obligation unless noWeekendShift); src/data/rules/holidays.json:7 (shiftRule.notes: "as the safe default"); src/data/rules/obligations.json:1021-1043 (lgu-business-permit), 1045-1067 (lgu-cedula), 1069-1091 (lgu-ptr), 1162-1186 (sec-afs-calendar), 996-1019 (dole-13th-month-report)`
  - Evidence: Verifier ws.mjs: lgu-cedula raw 2027-02-28 (Sun) gives app 2027-03-01; lgu-ptr raw 2027-01-31 (Sun) gives app 2027-02-01; sec-afs-calendar raw 2027-05-29 (Sat) gives app 2027-05-31. Only dole-13th-month and bir-einvoicing carry noWeekendShift (obligations summary). LGC (RA 7160) Sec 161: community tax "shall be paid not later than the last day of February"; Sec 139(b): professional tax "payable annually, on or before the thirty-first (31st) day of January"; Sec 167: local taxes paid "within the first twenty (20) days of January", and the sanggunian may extend by up to six months. Verifier note: the Administrative Code of 1987 (EO 292, Book I) has a "pretermission of holiday" rule letting an …
  - Sources: https://www.sss.gov.ph/pay-loans/ ; https://www.philhealth.gov.ph/circulars/2014/TS_circ01_2014.pdf ; https://www.pwc.com/ph/en/tax/tax-publications/tax-alerts/2026/tax-alert-11.html ; https://batasnatin.com/laws/tax-community-tax-cedula-Sec-156-164

### M09 (Medium): A missed deadline disappears from the calendar the next day; there is no "overdue" state. The income-tax progress rail …
- **Original IDs:** DL-07, UX-18
- **DL-07** location: `src/engine/deadlines.js:144-145 (items before `from` dropped); src/pages/Dashboard.jsx:42-44 (from = today), 205-206 (timeline statuses only "Due soon"/"Upcoming"), 254-277 (rail: done = d.date < t, check mark, progress bar), 276 (small-print caveat)`
  - Evidence: Verifier tz.mjs under TZ=Asia/Manila at 2026-10-27T03:00Z: the Q3 2550Q (due 2026-10-26) is no longer in the list; the next 2550Q is 2027-01-25. Verifier rail.mjs for 2026-10-07: 8% individual rail = "✓ passed 1701A 2026-04-15, ✓ passed eAFS 2026-04-30, ✓ passed 1701Q Q1 2026-05-15, ✓ passed 1701Q Q2 2026-08-17, due 1701Q Q3 2026-11-16". Dashboard.jsx:262-267 renders a check mark for every d.date < t, and line 258 sets the bar width from the same test.
- **UX-18** location: `src/pages/Dashboard.jsx:254-278 (progress bar :258, tick when d.date < t :262-267, note :275-277); src/pages/Checklist.jsx:50-63 (bullet dot, no checkbox)`
  - Evidence: Verifier engine run (ux-verify/rail.mjs, refDate 2026-10-07): self-employed with employees + 2307s: 7 of 9 income filings before today (78%): 1701A Apr 15, SAWT Annual Apr 15, eAFS Apr 30, 1701Q Q1 May 15, SAWT Q1 May 15, 1701Q Q2 Aug 17, SAWT Q2 Aug 17 ticked; 1701Q Q3 and SAWT Q3 Nov 16 not. Code: done = d.date < t, no filed flag exists on the profile. Auditor screenshot /tmp/claude-0/-home-user-Tax-Suite/5f55781b-8e32-597f-b833-03712e4a9117/scratchpad/audit/ux/d_dash_feed_indiv.png. Same issue as DL-07 (progress-rail part).
  - Sources: vite-node engine run ; Playwright screenshot (auditor)

### M10 (Medium): The calendar "Timeline" view silently stops after 40 deadlines while the header says "110 dated obligations".
- **Original IDs:** UX-22
- **UX-22** location: `src/pages/Dashboard.jsx:205 (deadlines.slice(0, 40), no count or 'show more'); header count at :82-84`
  - Evidence: Verifier Playwright run (ux-verify/v_timeline.cjs, 1280x900, today 2026-10-07). 'Maria Santos' (self-employed, employer, 2307s): header 'Showing 110 dated obligations…'; Timeline items 40, first Oct 12, 2026, last Mar 1, 2027; no 'show more' or 'of' text; Table view has 110 rows ending Nov 10, 2027. 'Ana Reyes' (mixed): 47 obligations, Timeline 40, last Aug 31, 2027. Corporation (38 obligations) is not cut.
  - Sources: Playwright run

### M11 (Medium): The corporate estimator has no excess-MCIT carry-over credit (3 years), no OSD option (40% of gross income) and no …
- **Original IDs:** WH-05(a-c)
- **Worksheets:** WH:WS-16
- **WH-05** location: `src/engine/estimators/corporation.js:23-41, 70-73; src/data/rules/corporate.json:30-36 (osdCorporate, unused); src/data/forms.js:10 (1702Q lines); src/pages/ProfileWizard.jsx:169-173`
  - Evidence: grep: osdCorporate is read only by References.jsx. corporation.js has no carry-over or OSD inputs. WS-16: MCIT 400,000 > RCIT 250,000, so 150,000 should carry forward 3 years, and the app has nowhere to apply it next year. ProfileWizard year options: Array.from({length:30}) from the current year, i.e. 2026 back to 1997. With registrationYear null the result row says 'Set "year operations began" on the profile to check the 2% MCIT' (v2.out), and mcitApplies is false (corporation.js:36).
  - Sources: RR 12-2007 (quarterly cumulative MCIT): https://bir-cdn.bir.gov.ph/BIR/pdf/37123rr%2012-2007.pdf ; RR 16-2008 (corporate OSD 40% of gross income): https://bir-cdn.bir.gov.ph/BIR/pdf/43181rr%2016-2008.pdf ; NIRC Sec 27(E)(2) carry-forward, via RR 9-98: https://lawphil.net/administ/bir/rr/rr1998.html

### M12 (Medium): The Payroll "true cost" total leaves out the mandatory 13th-month pay.
- **Original IDs:** WH-06
- **Worksheets:** WH:WS-19
- **WH-06** location: `src/engine/estimators/payroll.js:45 and 53 (totalMonthlyCost); src/pages/Estimator.jsx:299`
  - Evidence: Verifier re-run (v1.out): estimatePayroll({monthlyBasic:25000}) gives totalMonthlyCost 28,355 (employer 2,530 + 625 + 200). Exact: 25,000 + 3,355 + 25,000/12 = 30,438.33 (hand.out).
  - Sources: PD 851: https://lawphil.net/statutes/presdecs/pd1975/pd_851_1975.html

### M13 (Medium): The self-employed SSS / PhilHealth / Pag-IBIG card divides gross sales by 12 and calls it "average monthly income".
- **Original IDs:** WH-07
- **Worksheets:** WH:WS-21
- **WH-07** location: `src/pages/Estimator.jsx:164 (monthly={Math.round(v.gross / 12)}) and 206; src/engine/estimators/contributions.js:90-102`
  - Evidence: Verifier re-run (v1.out): selfEmployedMonthlyContributions(40000) gives total 7,680 (SSS 5,280, PhilHealth 2,000, Pag-IBIG 400). selfEmployedMonthlyContributions(25000) gives 5,430 (3,780 + 1,250 + 400). Exact: hand.out WS21.
  - Sources: SSS definition of earnings declared for self-employed (secondary, Grant Thornton): https://www.grantthornton.com.ph/insights/articles-and-updates1/tax-notes/sss-clarifies-definition-of-earnings-declared-for-contributions-of-self-employed-members/ ; RA 11199 IRR: https://www.lawphil.net/statutes/repacts/ra2019/irr_11199_2019.html

### M14 (Medium): The Checklist says Form 1905 RDO transfers can be filed at any RDO; the Forms page says business taxpayers file with …
- **Original IDs:** INF-06
- **INF-06** location: `src/data/rules/obligations.json:1388-1408 (notes at 1407); src/data/forms.js:27 (1905 summary)`
  - Evidence: Verifier confirmed both strings: obligations.json:1407 'Under EOPT, transfers and updates can be filed at any RDO; no more transfer-first requirement.'; forms.js:27 '...non-business taxpayers file via ORUS or at the new RDO; business taxpayers file with their current RDO, and transfers proceed even with open cases (RMC 91-2024).' The checklist item applies to every business profile and to employees; the Forms entry is visible to everyone. RMC 91-2024 text not re-fetched by the verifier: WebFetch is egress-blocked for these hosts and the shared web-search budget was exhausted; the auditor's search summaries conflicted.
  - Sources: https://bir-cdn.bir.gov.ph/BIR/pdf/RMC%20No.%2091-2024%20Digest.pdf ; https://www.bdblaw.com.ph/images/publications/tu/137_RMC_91-2024.pdf ; https://www.grantthornton.com.ph/insights/articles-and-updates1/tax-notes/clarifications-on-the-registration-procedures-under-eopt-act/

### M15 (Medium): The self-employed Pag-IBIG payment is tagged "Pag-IBIG MP2/RTPO". MP2 is Pag-IBIG's voluntary savings program, not the …
- **Original IDs:** INF-08
- **INF-08** location: `src/data/rules/obligations.json:945-967 (pagibig-self; form at :948); shown on the dashboard hero, rows, timeline and table, and src/pages/References.jsx:90`
  - Evidence: Verifier confirmed obligations.json:948 '"form": "Pag-IBIG MP2/RTPO"' and the engine prints 'Pag-IBIG MP2/RTPO Pay Pag-IBIG savings (self-employed)' for an individual profile (scratch posted-info-verify/hol2027.mjs). That MP2 is the voluntary savings program is general knowledge and was flagged independently by the deadlines verifier; no primary source could be fetched (not re-fetched by the verifier: WebFetch is egress-blocked for these hosts and the shared web-search budget was exhausted), so the rule row stays UNVERIFIED.

### M16 (Medium): Editing the middle of an amount moves the cursor to the end, so the next digits land in the wrong place.
- **Original IDs:** UX-03
- **UX-03** location: `src/components/ui.jsx:29-30 (value={value.toLocaleString('en-US')} rewritten on every change)`
  - Evidence: Verifier re-run (ux-verify/v05_inputs.cjs): in the 480,000 field, Home, ArrowRight, type '5' -> value '4,580,000', cursor 9 (end); type '5' again -> '45,800,005', cursor 10. Severity lowered from High to Medium: the wrong number is visible in the box, so this is a usability problem rather than a hidden wrong result.
  - Sources: Playwright run

### M17 (Medium): On phones the main menu shows only "Calendar"; Estimator, Checklist, Forms, Tools and Blog are hidden off-screen with …
- **Original IDs:** BUG-10, UX-05
- **BUG-10** location: `src/styles/app.css:63-64 (.nav overflow-x:auto; scrollbar-width:none; ::-webkit-scrollbar hidden) and the @media (max-width:720px) block at line 183 (no nav rule); src/App.jsx:116-121 (nav)`
  - Evidence: Verifier re-run (bugs-verify/v1.cjs, 360x640, isMobile): nav.nav scrollWidth 459, clientWidth 115. Calendar at x 183-270 is visible; Estimator (272-360), Checklist, Forms, Tools and Blog extend past the nav's right edge (about x 298). Screenshot bugs-verify/shots/b10_mobile.png.
- **UX-05** location: `src/styles/app.css:63-64 (.nav overflow-x:auto; scrollbar hidden), :79-83 (.seg same pattern); src/App.jsx:99-121 (six nav links in one row)`
  - Evidence: Verifier re-run (ux-verify/v_mobile.cjs): at 360 px nav scrollWidth 459 vs clientWidth 115; 'Calendar:visible, Estimator:partly(26/88), Checklist/Forms/Tools/Blog:hidden'. At 320 px clientWidth 75, only part of 'Calendar' visible. Forms category bar 458 vs 322 at 360 px. Tools bars 240/273 vs 236 and corporate estimator tabs 313 vs 282 only at 320 px (they fit at 360 px). Auditor screenshot /tmp/claude-0/-home-user-Tax-Suite/5f55781b-8e32-597f-b833-03712e4a9117/scratchpad/audit/ux/m_focus_nav_blog.png shows the clipped focus ring. Severity lowered from High to Medium: navigation still works by swiping; the problem is that it cannot be discovered. Same issue as BUG-10.
  - Sources: Playwright run

### M18 (Medium): Blog article cards cannot be reached or opened with the keyboard and are not announced as links (WCAG 2.1.1, Level A).
- **Original IDs:** BUG-11, UX-06
- **BUG-11** location: `src/pages/Blog.jsx:19 and 33 (<div className="card click" onClick=...> with no role or tabIndex)`
  - Evidence: Verifier re-run (bugs-verify/v1.cjs) on #/blog: all 4 cards are DIV elements with tabIndex -1 and no role. Pressing Tab 25 times focuses only the 6 header links, the avatar button, the footer 'References' link and the page body; no article card is ever focused.
- **UX-06** location: `src/pages/Blog.jsx:19 and :33 (div.card.click with onClick only; no link, role or tabIndex)`
  - Evidence: Verifier re-run (ux-verify/v_kbd.cjs, Chromium 141, 1280x900): all 4 cards tabIndex -1, role null, 0 focusable children. Tab order from page load: Calendar, Estimator, Checklist, Forms, Tools, Blog, avatar, footer 'References', then back to the top; no card is ever focused. Severity lowered from High to Medium: the blog is supplementary content and the problem affects keyboard-only users; the audit's statement that screen-reader users cannot read articles at all is overstated. Same issue as BUG-11.
  - Sources: Playwright run ; WCAG 2.2 SC 2.1.1 (https://www.w3.org/TR/WCAG22/#keyboard)

### M19 (Medium): The two grey text colours fail contrast on every page (3.72:1 and 2.35:1; 4.5:1 is required): field labels, hints, …
- **Original IDs:** UX-07
- **UX-07** location: `src/styles/app.css:13-14 (--mut, --dim), :23-24 (--warn on --warnSoft), :181 (.ftr p uses --dim), :223 (.form-err), :127 (.input-w border var(--line)), :264 (.switch #d7e0e9), :288 (.agency.sss/philhealth/pagibig), :299 (.cite uses --dim); src/pages/Dashboard.jsx:206 and :212 ('Due soon' pill); src/pages/Estimator.jsx:124 ('Lowest' badge); src/pages/Blog.jsx:25, :34 (category labels in --acc); …`
  - Evidence: Verifier recomputed every ratio with the WCAG relative-luminance formula (ux-verify/contrast.py): #76869a/#fff 3.72; #76869a/#f5f8fb 3.49; #9aabbc/#fff 2.35; #9aabbc/#f5f8fb 2.21; #c2843c/#f6edd9 2.71; #2f8a5b/#e3f3ea 3.72; #fff/#2f8a5b 4.28; #b4503e/#f8e7e3 4.22; #3f7cae/#fff 4.46; #3f7cae/#f5f8fb 4.19; #d7e0e9/#fff 1.34; #e3eaf1/#fbfdff 1.19. axe-core re-run (ux-verify/v_axe.cjs): color-contrast violations on #/ 92, #/estimator 43, #/blog 19, #/forms 65. Auditor crawl.json: all 42 page/viewport views fail, 7 to 342 nodes. Corrections: app.css:178 (.mini-warn, 5.45:1) passes and was removed from the location; footer is App.jsx:143-152, not 161-170. Severity lowered from High to Medium …
  - Sources: axe-core 4 ; WCAG 2.2 SC 1.4.3 and 1.4.11 (https://www.w3.org/TR/WCAG22/; not re-fetched, w3.org blocked from this environment)

### M20 (Medium): Profile wizard: no "Step X of Y", the Continue button is greyed out with no reason, focus does not move to the new …
- **Original IDs:** UX-10
- **UX-10** location: `src/pages/ProfileWizard.jsx:75-77 (aria-hidden step bars, no text), :124, :143, :208 (labels without a control), :255-263 (disabled Continue, no focus move); src/components/ui.jsx:52-69 (Switch has aria-label only, no aria-describedby)`
  - Evidence: Verifier re-run (ux-verify/v_kbd.cjs): with an empty name, Continue disabled=true and no text matches /required/enter a name/. After Enter on Continue the heading became 'Tax registration' while document.activeElement stayed on BUTTON 'Continue'. First switch aria-describedby=null. Code read confirms the aria-hidden step bars and unassociated labels.
  - Sources: Playwright run

### M21 (Medium): Every page has the same browser-tab title and page changes are not announced (WCAG 2.4.2).
- **Original IDs:** UX-12
- **UX-12** location: `app.html:6 (single title); src/App.jsx:80 (route change only scrolls to the top)`
  - Evidence: Verifier re-run (ux-verify/v05_inputs.cjs): page.title() is 'Present Value — Philippine Tax Suite' for #/, #/estimator, #/checklist, #/forms, #/tools, #/blog, #/references, #/profiles and #/profiles/new. Location corrected from App.jsx:98 to App.jsx:80.
  - Sources: Playwright run ; WCAG 2.2 SC 2.4.2 (https://www.w3.org/TR/WCAG22/#page-titled)

### M22 (Medium): There is no print layout and no export. Printed estimates wash out, the menu and buttons print, and the printout has no …
- **Original IDs:** UX-15
- **UX-15** location: `src/styles/app.css (no @media print); src/pages/Dashboard.jsx:131-155 (hero white text); src/pages/Estimator.jsx:147-154 (banner white text); no print/export code anywhere in src/`
  - Evidence: Verifier: grep -rn '@media print/window.print/.ics/VCALENDAR/text/csv/download=' src app.html returns nothing. Verifier viewed the auditor's print crop /tmp/claude-0/-home-user-Tax-Suite/5f55781b-8e32-597f-b833-03712e4a9117/scratchpad/audit/ux/pdf_dash_hero-1.png: the hero title prints as light grey on white. Auditor PDFs: /tmp/claude-0/-home-user-Tax-Suite/5f55781b-8e32-597f-b833-03712e4a9117/scratchpad/audit/ux/print_est.pdf, print_dash.pdf, print_est_corp.pdf.
  - Sources: Playwright print emulation (auditor) ; grep

### M23 (Medium): Slow first load on mobile data: one 604 kB file, a 212 kB account library loaded even in local mode, and Google Fonts …
- **Original IDs:** UX-16
- **UX-16** location: `app.html:10-12 (Google Fonts stylesheet in head), :15 (empty #root); src/lib/backend.js:10, :16 (static import of @supabase/supabase-js); scripts/standalone-plugin.js and vite.config.js (single-file build)`
  - Evidence: Verifier: index.html body 603,832 bytes, 174,142 gzip (transfer incl. headers 604,132 / 174,442). Verifier re-run (ux-verify/v_speed.cjs, CDP Slow 3G 2,000 ms / 51,200 B/s, 360x740): gzip app rendered at 5,452 ms; raw 13,828 ms; Google Fonts CSS delayed 5 s -> FCP 5,072 ms. Auditor (all profiles): gzip Slow 3G 5,513 ms, raw 14,118 ms, gzip Fast 3G 1,566 ms, raw 3,872 ms. Auditor's scratch chunked build, re-measured by the verifier: supabase 212,306 B (55.2 kB gz), react-dom 134,827, rules-data 100,595, app 98,743, router 22,923, blog-posts 4,995 (total JS 588,858 B). Correction to the audit: the host (GitHub Pages) can revalidate an unchanged file, so not every visit re-downloads it; the …
  - Sources: Playwright + Chrome DevTools Protocol network throttling ; vite build (auditor's scratch outDir)

### M24 (Medium): Profile wizard navigation: Cancel can leave the app when the wizard was opened directly; an edit link for a deleted …
- **Original IDs:** BUG-09
- **BUG-09** location: `src/pages/ProfileWizard.jsx:12-21 (editing = profiles.find(...); a missing id falls back to a new form); 256 (nav(-1)); 62-63 (nav('/') after save, not replace)`
  - Evidence: Verifier re-run: bugs-verify/v1.cjs opened app.html#/profiles/new as the first page of a new tab and clicked Cancel; page.url() became 'about:blank'. #/profiles/bogus/edit shows h1 'Set up a taxpayer profile' with an empty name field. bugs-verify/v3.cjs: after creating 'Back Test' (URL #/), goBack() went to #/profiles/new with h1 'Set up a taxpayer profile' and an empty name.

### M25 (Medium): Users cannot delete their account or download their data, and local mode has no "erase all data on this device".
- **Original IDs:** SEC-02
- **SEC-02** location: `src/pages/Profiles.jsx:46-58; src/App.jsx:56-69 (menu has only new / manage / sign out); src/lib/backend.js:79-86; supabase/migrations/0001_taxpayer_profiles.sql:8 (on delete cascade); node_modules/@supabase/auth-js/dist/main/GoTrueAdminApi.js:703-734`
  - Evidence: grep over src/ for deleteUser, updateUser, auth.admin, .rpc(, Blob, download, createObjectURL, .csv, .ics: no matches. GoTrueAdminApi.js:703-709: 'Delete a user. Requires a `service_role` key... This function should only be called on a server. Never expose your `service_role` key in the browser.' find supabase -type f: only migrations/0001_taxpayer_profiles.sql (no functions/ folder, no RPC). Legal basis: RA 10173 Sec. 16(e) erasure or blocking, Sec. 18 data portability (UNVERIFIED in session: primary sources blocked).
  - Sources: https://lawphil.net/statutes/repacts/ra2012/ra_10173_2012.html (UNVERIFIED in session: lawphil.net, privacy.gov.ph, officialgazette.gov.ph, elibrary.judiciary.gov.ph all blocked by the egress proxy)

### M26 (Medium): The site is served at jezb-netrunner.github.io/Tax-Suite/, so its browser storage is shared with every other GitHub …
- **Original IDs:** SEC-03
- **SEC-03** location: `.github/workflows/deploy.yml:36-49; vite.config.js:6-9 (comment: 'GitHub Pages /Tax-Suite/'); src/lib/backend.js:18-34; src/state/AppState.jsx:15,24,85; node_modules/@supabase/auth-js/dist/main/GoTrueClient.js:241 (storage = globalThis.localStorage), :258 (new BroadcastChannel(storageKey)), :4326 (broadcastChannel.postMessage({ event, session })); …`
  - Evidence: GitHub docs: a project site's default location is 'http(s)://<owner>.github.io/<repositoryname>'. Verifier: gh api repos/jezb-netrunner/Tax-Suite returns has_pages=true, homepage=null; every Pages deployment status (8 checked, 5 Aug to 31 Aug 2026) has environment_url https://jezb-netrunner.github.io/Tax-Suite/; no CNAME file in the repo. supabase-js index.mjs:626 builds the key as `sb-${baseUrl.hostname.split(".")[0]}-auth-token`. The local-mode demo shows pv.profiles.v1 holding plain JSON with name and income. Whether the account publishes other Pages sites could not be checked (GitHub API limited to this repository; the live site is blocked by the egress proxy).
  - Sources: https://github.com/github/docs/blob/main/content/pages/getting-started-with-github-pages/what-is-github-pages.md

### M27 (Medium): Local mode keeps client names and income as plain text in the browser with no shared-computer warning and no erase-all. …
- **Original IDs:** SEC-04, INF-11(c)
- **SEC-04** location: `src/lib/backend.js:18-34,40-41,51-57; src/App.jsx:65-69,84-87; src/pages/Profiles.jsx:64-68`
  - Evidence: Verifier re-run of security-verify/ls-demo.mjs (cd /home/user/Tax-Suite && npx vite-node --root <scratch> <scratch>/ls-demo.mjs): hasCloud = false; raw localStorage["pv.profiles.v1"] = [{"id":"905d9b38-...","name":"Maria Santos","type":"mixed",...,"inputs":{"mixed":{"gross":480000,"expenses":180000,"cwt":24000,"compensationTaxable":600000,"compensationWithheld":62500}}}]; after delete: "[]". When hasCloud is true, listProfiles/saveProfile/deleteProfile return before touching LS_KEY (backend.js:41,51,80), and no code removes it (grep localStorage in src: only backend.js:21,27 and AppState.jsx:24,85,92). The live index.html is compiled with `const Dp=void 0,mx=void 0,Gt=!!Dp` (no Supabase …
- **INF-11** location: `(a) src/data/forms.js:13 vs src/data/rules/business-tax.json:33-38 and obligations.json:404; (b) src/pages/ProfileWizard.jsx:211-212; (c) src/pages/Profiles.jsx:66; (d) src/pages/Dashboard.jsx:143 and src/pages/Forms.jsx:14; (e) src/App.jsx:146-147 and src/pages/References.jsx:59-64 vs src/data/rules/business-tax.json:39-44; (f) README.md:3, src/pages/Blog.jsx:16, src/data/rules/meta.json:6`
  - Evidence: Verifier confirmed each quoted string at the listed lines. Forms.jsx:14 useState('1701Q') is the default open form; Dashboard.jsx:143 calls nav('/forms') with no form code. business-tax.json:39-44 (digitalServicesVat) cites RA 12023. RMC 52-2023 (May 2023) allows optional monthly 2550M filing with no deadline and no penalty (Forvis Mazars, PNA).
  - Sources: https://forvismazars.com/ph/en/insights/tax-alerts/bir-rmc-52-2023 ; https://alpha.pna.gov.ph/articles/1201607

### M28 (Medium): There is no "Forgot password" or change-password flow. Auth settings (email confirmation, password length, rate limits, …
- **Original IDs:** SEC-05
- **SEC-05** location: `src/pages/Auth.jsx:5 (modes 'signin' or 'signup' only), :12-29 (only signUp / signInWithPassword), :26 (raw ex.message shown), :50 (minLength={8} client-only); supabase/ (no config.toml)`
  - Evidence: grep of src/ for resetPasswordForEmail, PASSWORD_RECOVERY and updateUser: no matches. find supabase -type f: only migrations/0001_taxpayer_profiles.sql. The live Supabase project was not queried, by instruction. The email-enumeration behaviour depends on the dashboard 'Confirm email' setting and is UNVERIFIED (supabase.com docs not reachable in this session).

### M29 (Medium): GitHub Pages publishes both the raw main branch and the Actions build on every push, and whichever finishes last is …
- **Original IDs:** SEC-10, CH-11, CH-14
- **SEC-10** location: `.github/workflows/deploy.yml:3-4 (comment), :36-49; index.html (committed local-mode build); legacy/index.html; project/uploads/index.html:2105,3866-3883 (tpv_2307log); app.html`
  - Evidence: gh api (repository-scoped, read-only): every push to main since 5 Aug 2026 triggered two runs: 'Deploy to GitHub Pages' (.github/workflows/deploy.yml, steps npm ci, npm test, npm run build, upload dist) and 'pages build and deployment' (dynamic/pages/pages-build-deployment, steps Checkout and 'Build with Jekyll', the builder for the 'Deploy from a branch' source; it also ran alone on 16 Jun, 2 Jul and 4 Aug before deploy.yml existed). Deployment statuses: 4c9c837 (5 Aug 09:34) Actions copy active until 10:00:27; ce1b7d3 (5 Aug 10:00) Actions copy active until 26 Aug; 1f2a963 (26 Aug) Actions copy made inactive 4 s after success, branch copy active until 31 Aug; ed29f5a (31 Aug) Actions copy …
  - Sources: https://github.com/github/docs/blob/main/content/pages/getting-started-with-github-pages/what-is-github-pages.md
- **CH-11** location: `index.html (generated, committed); scripts/standalone-plugin.js:20-58 (line 51 writes path.resolve('index.html')); .github/workflows/deploy.yml (no drift check); README.md:36-48 ('Just open index.html')`
  - Evidence: git status after the baseline build: index.html unchanged, so it currently equals a fresh build. Verifier git log: commits 0b7e7dd, 3ff130c, ff2ae4b, 787f258, e8a3b8b and 8b499b5 (all 2026-08-04) changed src/ or app.html without index.html; the generator arrived in 143c372/3fa172e (2026-08-05); every later src commit also changed index.html. Verifier read-only gh api: each push to main runs both 'Deploy to GitHub Pages' (.github/workflows/deploy.yml) and 'pages build and deployment' (dynamic/pages/pages-build-deployment); for ed29f5a (2026-08-31) the Actions deployment was set 'inactive' at 06:59:04 and the branch deployment (run 33366333685) succeeded at 06:59:03 and is the active one …
- **CH-14** location: `legacy/index.html; project/uploads/index.html; project/support.js; project/Present Value.dc.html; README.md:97-98; src/styles/app.css:2; src/data/posts.js:1`
  - Evidence: vite.config.js builds only app.html and deploy.yml uploads dist/ only, but the active deployment for the latest commit (ed29f5a) is the branch-source 'pages build and deployment' run (verifier gh api; see CH-11), which publishes the repository root. Verifier grep of legacy/index.html: lines 324-325, 333-334, 750-752 and 1001 contain hardcoded 250000, 0.15, 20833, 0.08, 0.03 and 0.40. du: legacy 88K, project 496K.

### M30 (Medium): Tests miss whole modules (payroll, amount parsing and formatting, self-employed contributions) and most boundary cases. …
- **Original IDs:** CH-08, TI-13
- **CH-08** location: `tests/engine/*.test.js; untested: src/engine/estimators/payroll.js (all), src/lib/format.js (all), src/engine/estimators/contributions.js:33-39,78-107, src/engine/profile.js:76 (VAT+8% coercion), 85, 93-99, src/engine/deadlines.js:115-117 ('once' schedules), src/engine/dates.js:14-17,23-25,72-78; loose assertions: tests/engine/employee.test.js:23 (toBeCloseTo 1 dp), 29 (toBeLessThan(5)); …`
  - Evidence: Verifier: no test file imports payroll.js, format.js, sssSelfEmployed, selfEmployedMonthlyContributions, employerContributions or profileFlags (grep). Verifier mutation re-run in its own scratch copy (code-health-verify/mut): 11 of 11 re-tested mutants SURVIVED with 89/89 passing: gross > 3M -> >= 3M; small-corp TI <= 5M -> < 5M; assets <= 100M -> < 100M; Pag-IBIG <= 1500 -> < 1500; payroll daily factor 313 -> 261; employer cost omits allowances; take-home ignores withholding; self-employed SSS drops EC; parseNum × 10; money() truncates; profile VAT+8% coercion removed. Control mutants were caught: compromise 0.5 -> 0.6 (1 failure), interest /365 -> /360 (2 failures). Auditor's coverage run …
- **TI-13** location: `tests/engine/individual.test.js:14-20, 31-49, 62-80; tests/engine/tax.test.js:6-29`
  - Evidence: individual.test.js uses toBeCloseTo for every money assertion except one (line 13, toBe(18400)); the CWT tests (lines 31-40) only exercise the 8% option, so the percentage-tax netting in TI-01 is never tested; lines 42-49 assert businessTax.kind === 'vat' with the comment 'no percentage tax when VAT applies' for a non-VAT-registered ₱3.5M profile. No test references parseNum, ₱3,000,000 exactly, or any tax year.

### L01 (Low): When two options cost exactly the same, the app silently picks 8%; differences under 50 centavos read "saving ₱0".
- **Original IDs:** TI-10
- **Worksheets:** TI:WS-09
- **TI-10** location: `src/engine/estimators/individual.js:99-101, 156; src/pages/Estimator.jsx:150-151`
  - Evidence: Verifier re-ran (v1.out): gross 400,000 -> totals 12,000 / 12,000, best 8pct, banner '8% flat tax is the cheapest eligible option at ₱12,000.'; gross 437,500 -> 15,000 / 15,000, same; gross 437,501 -> 8% 15,000.08 vs OSD 15,000.12, banner '... at ₱15,000, saving ₱0 versus the next best.'; gross 400,001 -> OSD best by 0.05, 'saving ₱0'.

### L02 (Low): The overpayment text offers "refund or carry over" and omits the tax credit certificate.
- **Original IDs:** TI-11
- **TI-11** location: `src/engine/estimators/individual.js:146; src/pages/Estimator.jsx:179`
  - Evidence: Row text: 'Overpayment: refund or carry over' / sub 'Excess credits can be refunded or carried forward to next year's returns.' (individual.js:146); preview label 'Overpayment (refund / carry-over)' (Estimator.jsx:179).
  - Sources: Auditor's search excerpt: for individuals, excess of quarterly payments and taxes withheld over annual tax may be refunded or issued a TCC at the taxpayer's option. Exact Form 1701 box wording: UNVERIFIED (PDF not fetchable) ; https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/1/59161 (Sec 76 irrevocability, corporate case)

### L03 (Low): The mixed-income hint says "box 21 of your 2316" (present employer only). Total taxable compensation for the year is …
- **Original IDs:** TI-12
- **TI-12** location: `src/pages/Estimator.jsx:99`
  - Evidence: Hint text at Estimator.jsx:99: 'After mandatory contributions and non-taxable benefits; see box 21 of your 2316.'
  - Sources: Secondary only: https://guide.sprout.ph/composition-of-bir-form-2316 (item 21 = present employer; item 23 = sum of items 21 and 22)

### L04 (Low): The 50% surcharge (willful neglect or fraud) cannot be selected in the penalty calculator, and the page does not …
- **Original IDs:** TB-08
- **Worksheets:** TB:W03
- **TB-08** location: `src/pages/Tools.jsx:23,56-59; src/engine/estimators/penalties.js:20`
  - Evidence: Tools.jsx:23 calls estimatePenalty({taxDue, daysLate, microSmall}) with no 'willful'. Verifier re-ran willful + micro on ₱10,000 / 30 days: surcharge 5,000 (50%, correct), interest 49.32, compromise 1,500 (halved, see TB-01), total 16,549.32 (worksheet W03). RR 6-2024, per KPMG: the 50% surcharge is not reduced for micro and small taxpayers. The app's own penalties.json:7 says the same.
  - Sources: https://kpmg.com/ph/en/insights/2024/04/special-intax-april-2024-issue-1-volume-3.html (secondary) ; https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/10/69577 (RMO 7-2015; not re-fetched, egress blocked)

### L05 (Low): The micro-taxpayer abatement item (RR 4-2026) says "gross sales ≤ ₱3M" (micro is below ₱3M), cites "published July 22, …
- **Original IDs:** TB-09, INF-10
- **TB-09** location: `src/data/rules/obligations.json:1325,1338 (compare src/data/rules/penalties.json:33)`
  - Evidence: Verifier confirmed the text at obligations.json:1325 ('gross sales ≤ ₱3M') and :1338 ('published July 22, 2026'). The app's own penalties.json:33 defines micro as grossSalesBelow 3,000,000, which matches RR 8-2024 (micro = less than ₱3M). The issuance and effectivity dates come from the auditor's secondary sources (Grant Thornton, KPMG, June 2026). The verifier could not re-fetch them (egress blocked) and has no independent knowledge of RR 4-2026, so the date part rests on secondary sources only.
  - Sources: https://www.grantthornton.com.ph/insights/articles-and-updates1/tax-notes/prescribing-guidelines-and-procedures-for-the-availment-of-a-one-time-abatement-of-taxes-and-penalties-for-micro-taxpayers-under-rr-no-4-2026/ (secondary) ; https://kpmg.com/ph/en/insights/2026/06/special-intax-june-2026-issue-1-volume-2.html (secondary) ; https://assets.kpmg.com/content/dam/kpmgsites/ph/pdf/InTAX/2026/RR-No-4-2026.pdf (copy of the RR hosted by KPMG)
- **INF-10** location: `src/data/rules/obligations.json:1323-1342 (bir-micro-abatement-2026, schedule kind 'info' at :1335); src/engine/deadlines.js:166-171 (generateChecklist has no date filter)`
  - Evidence: generateChecklist returns every 'ongoing' or 'info' obligation whose appliesTo matches, with no date check (deadlines.js:166-171). The abatement item applies to every business profile ('allOf': ['business']). obligations.json:1325 'Micro taxpayers (gross sales ≤ ₱3M)'; penalties.json:33 defines micro as grossSalesBelow 3,000,000 (RR 8-2024).
  - Sources: https://www.forvismazars.com/ph/en/insights/tax-alerts/bir-2026-tax-abatement-for-micro-taxpayers ; https://www.sunstar.com.ph/amp/story/cebu/bir-opens-one-time-tax-amnesty-program-for-micro-taxpayers

### L06 (Low): Citations to correct: Sec 249(D) should be the Sec 249(A) proviso; the ₱500 registration fee abolition is RMC 14-2024, …
- **Original IDs:** TB-10, INF-07, DL-10
- **TB-10** location: `src/data/rules/penalties.json:11`
  - Evidence: penalties.json:11 reads 'NIRC Sec 249(D) (no simultaneous deficiency + delinquency interest)'. Sec 249(A) as amended by RA 10963: '…Provided, That in no case shall the deficiency and the delinquency interest prescribed under Subsections (B) and (C) hereof, be imposed simultaneously' (quoted by MTF Counsel; matches the verifier's knowledge of the amended text, in which (D) is 'Interest on Extended Payment').
  - Sources: https://mtfcounsel.com/2024/05/16/deficiency-interest/ (secondary)
- **INF-07** location: `src/data/rules/obligations.json:1317 (bir-arf-abolished legalBasis); src/data/rules/obligations.json:454-459 (bir-einvoicing legalBasis and notes); src/data/rules/obligations.json:434 and src/data/rules/attachments.json:61 (SLSP notes)`
  - Evidence: Verifier confirmed obligations.json:1317 reads 'RMC 15-2024' and :456 lists only 'RR 11-2025'. RMC 14-2024 as the ARF-abolition circular matches the verifier's own knowledge of the 2024 BIR issuances and the auditor's sources (Reyes Tacandong, KPMG); the RMC 15-2024 subject, RR 26-2025 and RMC 98-2026 rest on the auditor's sources (not re-fetched by the verifier: WebFetch is egress-blocked for these hosts and the shared web-search budget was exhausted). Severity lowered from Medium to Low: a citation error with correct substance, the same level as DL-10.
  - Sources: https://www.reyestacandong.com/bir-issuances-rmc-14-2024/ ; https://kpmg.com/ph/en/home/insights/2024/01/special-intax-january-2024-issue1-volume2.html ; https://kpmg.com/ph/en/home/insights/2024/01/special-intax-january-2024-issue-1-volume-9.html ; https://bir-cdn.bir.gov.ph/BIR/pdf/PR101SEP2326.pdf
- **DL-10** location: `src/data/rules/obligations.json:454-457 (shown at src/pages/References.jsx:92); src/data/rules/holidays.json:5 (not rendered: References.jsx:103 shows only shiftRule.value)`
  - Evidence: References.jsx renders obligation legalBasis (line 92) but for the holiday file only holidays.shiftRule.value (line 103); grep of src for shiftRule finds only that line. RMC 65-2016 summary (Forvis Mazars; copy hosted by Grant Thornton) and the RR 26-2025 extension (Grant Thornton, KPMG) are the auditor's (not re-fetched by the verifier: WebFetch egress-blocked and web-search budget exhausted).
  - Sources: https://www.forvismazars.com/ph/en/insights/tax-alerts/bir-rmc-65-2016 ; https://www.grantthornton.com.ph/globalassets/1.-member-firms/philippines/tax-alerts/2016/06.27.2016/rmc-no-65-2016.pdf ; https://www.grantthornton.com.ph/technical-alerts/tax-alert/2026/bir-issues-guidelines-on-electronic-invoicing-retains-31-dec-2026-deadline/

### L07 (Low): There is no way to record BIR deadline extensions. RMC 30-2026 moved the TY2025 annual returns to May 15, 2026, but the …
- **Original IDs:** DL-09
- **DL-09** location: `src/engine/deadlines.js:134-163 (no override hook); src/data/rules/obligations.json:43-95 (annual returns, Apr 15 fixed), 294-318 (eAFS individual), 1093-1115 (loose-leaf; RMC 4-2026 only in legal basis/notes); compare src/data/rules/attachments.json:38`
  - Evidence: Verifier rail.mjs (2026 rail, refDate 2026-10-07): 8% individual "✓ passed 1701A 2026-04-15 ... ✓ passed via eAFS 2026-04-30"; corporation "✓ passed 1702-RT 2026-04-15 ... ✓ passed via eAFS 2026-04-30". The app's own attachments.json:38: "for CY2025, RMC 30-2026 moved filing, payment AND attachments to May 15, 2026 (EO 110 energy emergency)". The RDO-specific August 2026 extensions (RMC 89-2026 / 95-2026) cited by the auditor were not re-checked by the verifier (not re-fetched by the verifier: WebFetch egress-blocked and web-search budget exhausted).
  - Sources: https://www.grantthornton.com.ph/insights/articles-and-updates1/tax-notes/rmc-no-302026-deadline-for-the-filing-of-2025-annual-income-tax-returns-and-payment-of-the-corresponding-tax-due-thereon-extended-until-15-may-2026/ ; https://www.pwc.com/ph/en/tax/tax-publications/tax-alerts/2026/tax-alert-12.html ; https://www.pwc.com/ph/en/tax/tax-publications/tax-alerts/2026/tax-alert-41.html

### L08 (Low): The semi-monthly, weekly and daily withholding tables are stored correctly but cannot be reached; only the monthly …
- **Original IDs:** WH-09
- **WH-09** location: `src/engine/estimators/employee.js:18, 30-34; src/engine/estimators/payroll.js:9, 24-31; src/pages/Estimator.jsx:287-289; src/pages/Tools.jsx:30`
  - Evidence: Verifier re-run (v1.out): estimatePayroll 25,000 semiMonthly gives per-period 156.825 and monthly 313.65; weekly gives monthly 313.55; daily gives 758.69 (313/12 factor against the 365-day-based daily table). WS-01 to WS-04 confirm every table edge.
  - Sources: RR 11-2018 Annex E: https://bir-cdn.bir.gov.ph/local/pdf/Annex%20E%20RR%2011-2018.pdf

### L09 (Low): A ₱0 salary shows a −₱250 take-home pay and ₱260 of employer cost.
- **Original IDs:** BUG-14
- **BUG-14** location: `src/engine/estimators/contributions.js:43 (base = max(incomeFloor, monthlyBasic)); contributions.js:11 and 21 (MSC 0 but EC ₱10 still added); src/engine/estimators/employee.js:36; src/engine/estimators/payroll.js:34 and 45`
  - Evidence: Verifier re-run (bugs-verify/v1.cjs), profile Dan (employee), monthly basic 0: 'Less: PhilHealth employee share (₱250.00) ... Estimated monthly take-home (₱250.00)'. Engine: estimateEmployee({monthlyBasic:0}) gives deductions {sss:0, philhealth:250, pagibig:0}, takeHome -250; estimatePayroll({monthlyBasic:0}) gives employer {sss:10, philhealth:250, pagibig:0}, totalMonthlyCost 260.

### L10 (Low): "Read the form guide" on the next-deadline card always opens Form 1701Q, whatever form is due.
- **Original IDs:** BUG-15, UX-20, INF-11(d)
- **BUG-15** location: `src/pages/Dashboard.jsx:143 (nav('/forms')); src/pages/Forms.jsx:14 (useState('1701Q'))`
  - Evidence: Verifier re-run (bugs-verify/v1.cjs), Fox Corp on 2026-10-07: next deadline '1601-C Sep 2026 ... 5 days left Oct 12, 2026'. Clicking 'Read the form guide' opens #/forms with only '1701Q Quarterly Income Tax Return' expanded.
- **UX-20** location: `src/pages/Dashboard.jsx:143 (nav('/forms')); src/pages/Forms.jsx:14 (default open '1701Q')`
  - Evidence: Verifier re-run (ux-verify/v10_edit.cjs): hero form chip '1601-C'; after the click the URL is #/forms and the open form is '1701Q'. Same issue as BUG-15.
  - Sources: Playwright run
- **INF-11** location: `(a) src/data/forms.js:13 vs src/data/rules/business-tax.json:33-38 and obligations.json:404; (b) src/pages/ProfileWizard.jsx:211-212; (c) src/pages/Profiles.jsx:66; (d) src/pages/Dashboard.jsx:143 and src/pages/Forms.jsx:14; (e) src/App.jsx:146-147 and src/pages/References.jsx:59-64 vs src/data/rules/business-tax.json:39-44; (f) README.md:3, src/pages/Blog.jsx:16, src/data/rules/meta.json:6`
  - Evidence: Verifier confirmed each quoted string at the listed lines. Forms.jsx:14 useState('1701Q') is the default open form; Dashboard.jsx:143 calls nav('/forms') with no form code. business-tax.json:39-44 (digitalServicesVat) cites RA 12023. RMC 52-2023 (May 2023) allows optional monthly 2550M filing with no deadline and no penalty (Forvis Mazars, PNA).
  - Sources: https://forvismazars.com/ph/en/insights/tax-alerts/bir-rmc-52-2023 ; https://alpha.pna.gov.ph/articles/1201607

### L11 (Low): The footer and References say "rules last verified August 26, 2026" and call the rules "current", but several September …
- **Original IDs:** INF-09
- **INF-09** location: `src/data/rules/meta.json:3, 7; src/App.jsx:144-150; src/pages/References.jsx:51-54; src/data/rules/income-tax.json:14, 37; src/data/rules/withholding-compensation.json:67`
  - Evidence: meta.json:3 '"verifiedDate": "August 26, 2026"'; meta.json:7 '2027 holiday proclamation (expected Sept–Oct 2026 ...)' (not rendered; only verifiedDate is used in the UI). App.jsx:146-149: '...plus current BIR, SSS, PhilHealth, Pag-IBIG, SEC, and LGU issuances. Every figure's legal basis and verification date is on the References page (rules last verified {meta.verifiedDate})'. income-tax.json:14 'Nothing enacted as of Aug 26, 2026' and :37 'committee stage only as of Aug 2026'. Post-Aug-26 sources: see INF-01, INF-02, INF-07 (not re-fetched by the verifier: WebFetch is egress-blocked for these hosts and the shared web-search budget was exhausted). Severity lowered from Medium to Low because …
  - Sources: https://bworldonline.com/banking-finance/2026/10/01/783704/is-real-tax-relief-finally-here-a-look-inside-house-bill-no-10345/ ; https://newsinfo.inquirer.net/2281400/p350000-income-tax-exemption-ceiling-bill-hurdles-house-panel ; https://tribune.net.ph/2026/10/01/bir-updates-ebirforms-for-micro-taxpayer-tax-relief

### L12 (Low): Wording polish: "the monthly 2550M is gone" (it is optional); laws listed out of date order; RA 12023 missing from the …
- **Original IDs:** INF-11(a,e,f)
- **INF-11** location: `(a) src/data/forms.js:13 vs src/data/rules/business-tax.json:33-38 and obligations.json:404; (b) src/pages/ProfileWizard.jsx:211-212; (c) src/pages/Profiles.jsx:66; (d) src/pages/Dashboard.jsx:143 and src/pages/Forms.jsx:14; (e) src/App.jsx:146-147 and src/pages/References.jsx:59-64 vs src/data/rules/business-tax.json:39-44; (f) README.md:3, src/pages/Blog.jsx:16, src/data/rules/meta.json:6`
  - Evidence: Verifier confirmed each quoted string at the listed lines. Forms.jsx:14 useState('1701Q') is the default open form; Dashboard.jsx:143 calls nav('/forms') with no form code. business-tax.json:39-44 (digitalServicesVat) cites RA 12023. RMC 52-2023 (May 2023) allows optional monthly 2550M filing with no deadline and no penalty (Forvis Mazars, PNA).
  - Sources: https://forvismazars.com/ph/en/insights/tax-alerts/bir-rmc-52-2023 ; https://alpha.pna.gov.ph/articles/1201607

### L13 (Low): The profile switcher says it is a "menu", but arrow keys do nothing, focus does not move into it, and it stays open …
- **Original IDs:** UX-11
- **UX-11** location: `src/App.jsx:16-74 (ProfileMenu; role="menu" at :44, menuitems at :47-62; closes only on pointerdown or Escape at :22-33); src/styles/app.css:311 (mobile menu fixed full-width)`
  - Evidence: Verifier re-run (ux-verify/v_kbd.cjs): Enter on the avatar opens the menu; focus stays on the avatar; ArrowDown does not move it. After 9 Tabs focus is on the dashboard 'Timeline' button and the menu is still open (count 1). Escape closes it; focus stays on 'Timeline'. Severity lowered from Medium to Low: the menu remains usable with Tab and Enter; this is a pattern-conformance problem.
  - Sources: Playwright run ; WAI-ARIA Authoring Practices menu button pattern

### L14 (Low): The calendar "Table" view on phones hides half its columns off-screen with no scroll hint.
- **Original IDs:** UX-17
- **UX-17** location: `src/pages/Dashboard.jsx:229-248 (list-card overflowX auto around .tbl)`
  - Evidence: Auditor layout scan: list-card scrollWidth 676 vs clientWidth 322 at 360 px; axe 'scrollable-region-focusable' on the table view. Verifier re-run (ux-verify/v_kbd.cjs, Chromium 141): the first Tab after choosing 'Table' lands on DIV.list-card, so in current Chrome (and Firefox) the box IS keyboard-scrollable; the audit's claim that keyboard users cannot scroll it at all holds only for Safari and older browsers. Severity lowered from Medium to Low: optional view, content reachable by swiping, Feed view shows the same deadlines.
  - Sources: Playwright run ; axe-core 4

### L15 (Low): Unexplained codes on calendar chips (SSS R-5/PRN, PhilHealth SPA/EPRS, Pag-IBIG MCRF, EIS, ORUS) and the heading "RCIT …
- **Original IDs:** UX-19
- **UX-19** location: `src/data/rules/obligations.json:823 ('SSS R-5/PRN'), :848 ('PhilHealth SPA/EPRS'), :873 ('Pag-IBIG MCRF'), :440 ('EIS'), :1096 and :1120 ('via ORUS'); src/pages/Dashboard.jsx:339 (chip); src/pages/Estimator.jsx:339 (heading)`
  - Evidence: Verifier read obligations.json: SLSP, QAP and CTC rows have titles 'Submit the Summary List of Sales & Purchases (SLSP)', 'Submit the Quarterly Alphalist of Payees (QAP)', 'Pay community tax (cedula)', so the audit's claim that these appear without explanation was dropped. No title/abbr/tooltip on chips (grep). Severity lowered from Medium to Low. Two parts of the original finding are covered elsewhere and removed here: the 'Pag-IBIG MP2/RTPO' label (INF-08, posted-info area) and asking 'Days late' instead of dates (TB-06).
  - Sources: Repository data files

### L16 (Low): Heading levels skip from 1 to 3 on several pages, and the welcome page has no main heading.
- **Original IDs:** UX-21
- **UX-21** location: `src/pages/Dashboard.jsx:19 (h2, no h1 on the welcome page); src/pages/Estimator.jsx:158, :204, :235, :239, :279, :299; src/pages/Tools.jsx:48, :87, :105; src/pages/Checklist.jsx:48; src/pages/References.jsx:57, :68, :83, :100`
  - Evidence: Verifier grep of heading tags confirms h1 followed by h3 on these pages and an h2-only welcome page. Correction: the audit cited References.jsx:275-318, but the file has 122 lines; the h3s are at :57, :68, :83, :100. Auditor axe best-practice run: page-has-heading-one and heading-order.
  - Sources: axe-core 4 best-practice (auditor) ; grep

### L17 (Low): Database row-level security is correct, but there is no limit on profile size or count, users can set their own …
- **Original IDs:** SEC-06
- **SEC-06** location: `supabase/migrations/0001_taxpayer_profiles.sql:6-28; src/lib/backend.js:42-45,63`
  - Evidence: Verifier re-run of pglite/rls-test.mjs plus extra cases: anon select gives []; anon insert, update-all and delete-all give an RLS error / 0 rows; A select gives only A's row; A inserting a row with user_id=B gives 'new row violates row-level security policy'; A updating or deleting B's row affects 0 rows; A setting user_id=B on its own row gives an RLS error; A filtering by B's user_id sees 0 rows; B sees only its own row; A inserting a 5,000,020-byte profile succeeds; A inserting 2,000 rows in one statement succeeds; A setting created_at='1999-01-01' succeeds. relrowsecurity=true. No SECURITY DEFINER functions, views or grants in the migration. The 5 MB result is at database level; any …

### L18 (Low): No Content-Security-Policy on the app pages.
- **Original IDs:** SEC-07
- **SEC-07** location: `app.html:1-21 (no http-equiv CSP); app.html:10-12 (Google Fonts); scripts/standalone-plugin.js:31-49 (inlined script and style, which would need hashes)`
  - Evidence: grep -c Content-Security-Policy: index.html 0, app.html 0, dist/index.html 0, dist/standalone.html 0. Searching src/ for dangerouslySetInnerHTML, innerHTML, eval(, document.write, window.open and href= found none. Route params (postId, profileId) are only compared, never rendered as HTML. W3C CSP spec source (w3c/webappsec-csp index.bs:970-972): 'Content-Security-Policy-Report-Only header is not supported inside a <meta> element. Neither are the report-uri, frame-ancestors, and sandbox directives.' The claim that GitHub Pages cannot send custom headers is UNVERIFIED in this session (docs.github.com blocked).
  - Sources: https://github.com/w3c/webappsec-csp/blob/main/index.bs

### L19 (Low): Dependencies with published advisories (react-router, vitest/tinypool, nanoid, source-map-js); none can be triggered in …
- **Original IDs:** SEC-08
- **SEC-08** location: `package.json:16-24; package-lock.json; navigation call sites (22): src/App.jsx:57,58,118,139,149; src/pages/Blog.jsx:19,33,54,61; src/pages/Checklist.jsx:23,40; src/pages/Dashboard.jsx:27,107,143,195,287,308; src/pages/Estimator.jsx:319; src/pages/ProfileWizard.jsx:63,256; src/pages/Profiles.jsx:18,56`
  - Evidence: Verifier re-ran npm audit: full = 7 vulnerabilities (3 moderate, 2 high, 2 critical); --omit=dev = 2 moderate (react-router, react-router-dom). GHSA-jjmj-jmhj-qwj2: react-router-dom >=6.30.2 <=6.30.5, patched 6.30.6; 'Applications with open redirects could permit attacker crafted links...'. GHSA-wrjc-x8rr-h8h6: react-router >=6.0.0 <7.18.0, 'attacker supplied paths passed to navigation mechanisms'; no 6.x patch. GHSA-337j-9hxr-rhxg: >=6.4.0 <7.18.0, SSR hydration only. Dev-only: tinypool GHSA-5gmw-xhrv-c9v3 / GHSA-85c8-ppgw-ccpr (critical), @vitest/mocker GHSA-82fw-gwwq-j7x9, nanoid GHSA-2v37-7h3g-55p8, source-map-js GHSA-68fv-2mgg-jv7q. All 22 navigation call sites use constant strings, …
  - Sources: https://github.com/advisories/GHSA-jjmj-jmhj-qwj2 ; https://github.com/advisories/GHSA-wrjc-x8rr-h8h6 ; https://github.com/advisories/GHSA-337j-9hxr-rhxg

### L20 (Low): CI hygiene: Node 20 (end of life), actions pinned to movable tags, broad publish permissions, and .env.* files not …
- **Original IDs:** SEC-09
- **SEC-09** location: `.github/workflows/deploy.yml:10-13,23-26,36-37,49; .gitignore:1-6`
  - Evidence: nodejs.org previous-releases (fetched by the verifier): v20 'Iron' status EOL, last updated Mar 24, 2026; v22 and v24 LTS. Verifier git check-ignore: .env ignored; .env.local ignored; .env.production.local ignored; .env.production, .env.development, .env.staging, .env.test NOT ignored.
  - Sources: https://nodejs.org/en/about/previous-releases

### L21 (Low): Dead code, unused outputs and duplicated helpers (daysBetween, pct, HOLIDAYS, the holiday set built three times, …
- **Original IDs:** CH-13
- **CH-13** location: `Unused exports: src/engine/dates.js:23 (daysBetween, duplicated inline at src/engine/deadlines.js:157); src/lib/format.js:12 (pct); src/lib/deadlineData.js:7 (HOLIDAYS). Unused outputs: src/engine/estimators/individual.js:75,85,95 (option.basis citations), 158 (rowsFor); contributions.js:28 (wispPortionOfTotal); corporation.js:98 (totalAnnualTax); payroll.js:49 (perPeriodWithholding). …`
  - Evidence: Verifier grep -w per name across src/tests/scripts: daysBetween, pct (format.js export) and HOLIDAYS (deadlineData export) have no importer; the 'pct' and 'HOLIDAYS' hits elsewhere are local variables. '.basis', rowsFor, wispPortionOfTotal, perPeriodWithholding, totalAnnualTax are not read in src/pages. Verifier re-run: payroll daily path gives monthly WH 5,250.57 versus 4,568.40 monthly for ₱50,000 (unreachable, untested).

### L22 (Low): No lint script. ESLint finds one real error (the original error is lost when a profile save fails) and some unused code.
- **Original IDs:** CH-15
- **CH-15** location: `src/lib/backend.js:28-29 (preserve-caught-error), 40 (unused userId); src/pages/References.jsx:20 (unused k); 11 files line 1 (unused React default import)`
  - Evidence: Verifier re-run: node /opt/node-tools/node_modules/eslint/bin/eslint.js (v10.1.0) -c <auditor scratch>/eslint.config.mjs src scripts tests -> '15 problems (1 error, 14 warnings)'; 11 'React is defined but never used' warnings (auditor said 12); no-undef 0, no-unreachable 0. Output saved at code-health-verify/eslint.out.

### L23 (Low): Employees never get the community tax (cedula) reminder; the Local Government Code (Sec 157) also covers people …
- **Original IDs:** GAP-02
- **Worksheets:** GAP:GW-7
- **GAP-02** location: `src/data/rules/obligations.json:1045-1067 (desc at :1047; appliesTo allOf ['business'] at :1051-1055; legalBasis at :1063); src/engine/profile.js:67-68 (the 'business' flag is set only for individual, mixed and corporation)`
  - Evidence: TZ=Asia/Manila npx vite-node scripts/calendar-audit.mjs (output saved to completeness/calendar-audit.out; the repo script only reads data). The 'EMPLOYEE (single employer)' and 'EMPLOYEE (two employers, licensed professional)' profiles list 2316, PTR, 1700 and eAFS, but no CTC. Every business profile lists 'Pay community tax (cedula)', for example 2027-03-01, moved from Sunday 2027-02-28. The text of RA 7160 Sec 157 is from the reviewer's reading of the Code; it was not re-fetched because WebFetch is egress-blocked and the shared WebSearch budget is used up. The rule row is therefore UNVERIFIED and the owner should confirm it.
  - Sources: RA 7160 (Local Government Code) Secs 157 and 161 https://lawphil.net/statutes/repacts/ra1991/ra_7160_1991.html (not re-fetched: egress blocked)

### Brand inventory (for the rename to "JEZ Tax Suite")

```
BRAND INVENTORY (auditor's, spot-checked by grep: README.md:1,3,100; src/App.jsx:91,114,145; src/pages/Auth.jsx:66; src/pages/Blog.jsx:16; src/data/rules/meta.json:6 confirmed)
Current brand strings: 'Present Value', 'The Present Value', 'Philippine Tax Suite', 'present-value', 'pv.'.
USER-FACING
- app.html:6 <title>Present Value — Philippine Tax Suite</title>; index.html:7 (generated) same; index.html inlined bundle carries every src string below (regenerated by npm run build).
- src/App.jsx:91 and :114 header brand name 'Present Value'; src/App.jsx:145 footer disclaimer.
- src/pages/Auth.jsx:66 sign-in disclaimer; src/pages/Dashboard.jsx:24 welcome hero; src/pages/Blog.jsx:16 'The Present Value Journal'.
- README.md:1, :3 ('from **The Present Value**'), :100 disclaimer.
- app.html meta description, theme-color and favicon, and the header '₱' brand-mark, are brand-neutral.
INTERNAL
- package.json:2 name 'present-value-tax-suite'; package.json:6 description; package-lock.json:2,8.
- scripts/standalone-plugin.js:19 plugin name 'present-value-standalone-html'.
- src/lib/backend.js:18 localStorage key 'pv.profiles.v1'; src/state/AppState.jsx:15 'pv.activeProfile.v1' (renaming without migration orphans local-mode users' saved profiles).
- src/styles/app.css:1 comment; src/data/rules/meta.json:6 maintainer (not rendered).
- No brand strings in .github/workflows/deploy.yml, supabase/migrations, .env.example or scripts/calendar-audit.mjs; dist/ is gitignored; legacy/ and project/ copies contain the old brand (out of scope).
EXISTENCE CHECKS: no web manifest, no Open Graph/Twitter tags, no email templates in the repo (Supabase auth emails live in the Supabase dashboard), no print/PDF output, no hard-coded domains.
```

### Other area worksheets (not tax computations)
- UI/UX: contrast ratios (#76869a on white 3.72:1; #9aabbc 2.35:1), option-card footing, payslip footing, slow-3G load-time arithmetic, Manila vs device countdown.
- Security: what local mode writes to the browser; row-level-security test of the Supabase migration in a local in-memory PostgreSQL (no live database touched); secret scan of the working tree and full git history (no secrets found); which sites share storage with the hosted app; which build is live on GitHub Pages.
- Code health: PhilHealth split at ₱10,001; payroll and self-employed contribution hand-checks; mutation test (11 of 11 injected errors passed the current suite); books deadline text vs calendar for a fiscal-year corporation.

## Appendix B. Raw area logs (appended by the audit subagents as each area finished)

These use the original per-area IDs. The consolidated IDs in section 4 list the original IDs they replace.
### Tax logic: VAT, percentage tax, EOPT, penalties (verified)

| ID | Severity | Problem | Location |
|---|---|---|---|
| TB-01 | Critical | Penalty tool halves the compromise penalty for micro/small taxpayers; EOPT halves it only for invoicing violations (Secs 113/237/238), not late filing/payment. Default view understates by ₱5,000 | src/engine/estimators/penalties.js:10-13 |
| TB-02 | High | EOPT 10%/6% rates applied to returns due before Jan 22, 2024; no due-date input and no date limit stated on the page | src/pages/Tools.jsx:15-23,49-58 |
| TB-03 | High | VAT never computed; breakdown points to a nonexistent 'VAT panel' and 'Total annual tax' leaves VAT out | src/engine/estimators/individual.js:82-95,138-141 |
| TB-04 | High | Non-VAT taxpayer crossing ₱3M mid-year shown ₱0 percentage tax for the whole year; banner says 3% no longer applies | src/engine/estimators/individual.js:35-47 |
| TB-05 | Low | Percentage tax fixed at 3% with no tax-year input or 'current year only' label (1% applied Jul 2020 to Jun 2023) | src/data/rules/business-tax.json:15-20 |
| TB-06 | Medium | Hand-typed days late: no due/payment dates or holiday roll-over, unverified 365-day convention, penalty shown even at 0 days | src/pages/Tools.jsx:16,23,55,65 |
| TB-07 | Medium | Amount fields drop the decimal point, so ₱12,345.67 becomes ₱1,234,567 | src/lib/format.js:16-19 |
| TB-08 | Low | 50% willful-neglect/fraud surcharge cannot be selected or mentioned in the penalty tool | src/pages/Tools.jsx:23,56-59 |
| TB-09 | Low | RR 4-2026 abatement card says micro is gross sales ≤ ₱3M (should be below ₱3M); cited date differs from firm summaries | src/data/rules/obligations.json:1325,1338 (compare src/data/rules/penalties.json:33) |
| TB-10 | Low | No-simultaneous-interest rule cited as Sec 249(D); it is the Sec 249(A) proviso | src/data/rules/penalties.json:11 |

Rejected after verification: none

### Tax logic: individual income tax (verified)

| ID | Severity | Problem | Location |
|---|---|---|---|
| TI-01 | Critical | Annual-return payable adds percentage tax and nets 2307/employer credits against it; refund/payable shown is wrong | src/engine/estimators/individual.js:64,83,93,141-147,160; src/pages/Estimator.jsx:173-180 |
| TI-02 | Medium | No taxable-year input or label; 2023 table and 3% percentage tax used for every year (wrong for TY2018-2023) | src/data/rules/income-tax.json:3-15; src/data/rules/business-tax.json:15-20; src/engine/estimators/individual.js:47,136 |
| TI-03 | High | Over ₱3M: percentage tax for pre-VAT months omitted, warning says it no longer applies, 8% payments not credited | src/engine/estimators/individual.js:35-47; src/pages/Estimator.jsx:104-110,152 |
| TI-04 | High | No 1701Q computation or quarterly-payments input, yet the figure is labeled the annual-return payable | src/engine/estimators/individual.js:64,160; src/pages/Estimator.jsx:95-101,179 |
| TI-05 | High | Amount fields drop the decimal point: ₱4,800.00 becomes ₱480,000; centavos cannot be entered | src/lib/format.js:16-19; src/components/ui.jsx:24-30 |
| TI-06 | Medium | 8% test and base ignore other non-operating income; other-percentage-tax businesses not excluded | src/engine/estimators/individual.js:21-45; src/pages/Estimator.jsx:95-101 |
| TI-07 | Medium | No per-line whole-peso rounding; card parts do not add up (26%); float error can show a .50 total ₱1 low | src/engine/estimators/individual.js:44-62; src/pages/Estimator.jsx:20,127-137; src/lib/format.js:1-10 |
| TI-08 | Medium | Itemized business loss silently floored to zero; NOLCO neither shown nor accepted as input | src/engine/estimators/individual.js:51,129-133 |
| TI-09 | Medium | Sample figures prefill new profiles and are saved on first edit; mixed tabs hold unlinked compensation figures | src/pages/Estimator.jsx:48-74,82-84,222,327-332 |
| TI-10 | Low | Exact ties shown as 8% cheapest; banner can say saving ₱0 | src/engine/estimators/individual.js:99-101,156; src/pages/Estimator.jsx:150-151 |
| TI-11 | Low | Overpayment text omits the tax credit certificate option | src/engine/estimators/individual.js:146; src/pages/Estimator.jsx:179 |
| TI-12 | Low | Compensation hint cites 2316 item 21 (present employer only) instead of item 23 | src/pages/Estimator.jsx:99 |
| TI-13 | Low | Tests use approximate checks, miss risky edges, and pin the wrong over-₱3M behaviour | tests/engine/individual.test.js:13-49,62-80; tests/engine/tax.test.js:6-29 |

Rejected after verification: none

### Tax logic: deadlines, calendar, holidays, time zone (verified)

| ID | Severity | Problem | Location |
|---|---|---|---|
| DL-01 | High | Today and days-left use the device clock, not Manila time; abroad, '0 days left' shows for hours after the deadline passed | src/engine/dates.js:14-17; src/pages/Dashboard.jsx:39-44 |
| DL-02 | High | Oct 15 second installment of annual income tax (NIRC 56(A)(2)) is never on the calendar; TY2025 one is due Oct 15, 2026 | src/data/rules/obligations.json:43-164; src/data/rules/income-tax.json:39-44 |
| DL-03 | High | 2027 holidays miss Proc 1427 extra days (Feb 6, Mar 27, Nov 2, Dec 24); Q3 2027 withholding, SSS and some FY 1702Q show Nov 2, should be Nov 3 | src/data/rules/holidays.json:2,36-54 |
| DL-04 | Medium | Years with no holiday list (2025, 2028+) shift for weekends only, ignoring fixed holidays like May 1; 2028 dates show a day early with no warning | src/engine/dates.js:44-52; src/lib/deadlineData.js:6; src/data/rules/holidays.json:15-50 |
| DL-05 | Medium | Dates the rulebook marks needs_review (SEC AFS 2027, PhilHealth and Pag-IBIG self-employed, e-invoicing, 2027 holidays) are shown as firm | src/pages/Dashboard.jsx:131-249; src/pages/References.jsx:83-114 |
| DL-06 | Medium | LGU (cedula, PTR, business tax), SEC and DOLE dates are moved later on weekends without a confirmed rollover rule | src/engine/deadlines.js:142-143; src/data/rules/holidays.json:7 |
| DL-07 | Medium | Missed deadlines vanish the next day (no overdue state); progress rail ticks passed dates as if filed | src/engine/deadlines.js:145; src/pages/Dashboard.jsx:42-44,254-277 |
| DL-08 | Low | Dashboard 'today' is fixed at page load and never refreshes past midnight | src/pages/Dashboard.jsx:39 |
| DL-09 | Low | No way to record BIR extensions; TY2025 annual returns still shown Apr 15, 2026 though RMC 30-2026 moved them to May 15 | src/engine/deadlines.js:134-163; src/data/rules/obligations.json:43-95,294-318 |
| DL-10 | Low | E-invoicing cites RR 11-2025 only (RR 26-2025 set Dec 31, 2026); rollover rule cites Tax Calendar and RR 26-2002, not RMC 65-2016 | src/data/rules/obligations.json:454-457; src/data/rules/holidays.json:5 |

Rejected after verification: none

### Tax logic: withholding, payroll, contributions, corporate (verified)

| ID | Severity | Problem | Location |
|---|---|---|---|
| WH-01 | Critical | No minimum-wage-earner option: MWE pay is taxed (NCR ₱695 MWE with ₱6,000 commissions shown ₱261.27/month, should be ₱0); rulebook MWE rule unused | src/engine/estimators/employee.js:23-34; payroll.js:26-31; withholding-compensation.json:75-80 |
| WH-03 | Critical | SSS computed on basic pay only, ignoring regular allowances and other pay; SSS under-remitted and withholding overstated | src/engine/estimators/employee.js:23; payroll.js:26,34; contributions.js:63-88 |
| WH-04 | Critical | Corporate estimator uses the device calendar year as the taxable year; wrong MCIT test in filing season and for fiscal years; one 2% rate for all years | src/pages/Estimator.jsx:256; src/engine/estimators/corporation.js:25,36-37; corporate.json:14-22 |
| WH-11 | High | Corporate 'Income tax still payable' subtracts only 2307s, ignoring 1702Q payments and prior-year credits | src/engine/estimators/corporation.js:77-82,97; src/pages/Estimator.jsx:250-268 |
| WH-02 | Medium | References still says NCR minimum wage is ₱695; news reports NCR-28 (₱755 / ₱718 from Sep 26, 2026), not confirmed by verifier | src/data/rules/withholding-compensation.json:63-68 |
| WH-05 | Medium | Corporate estimator lacks MCIT carry-over, OSD option, quarterly 1702Q MCIT, and start years before 1997 | src/engine/estimators/corporation.js:23-41; src/data/forms.js:10; src/pages/ProfileWizard.jsx:169-173 |
| WH-06 | Medium | Payroll 'true cost' omits the mandatory 13th-month accrual (₱28,355 shown vs ₱30,438.33) | src/engine/estimators/payroll.js:45,53 |
| WH-07 | Medium | Self-employed contributions computed on gross sales ÷ 12 labelled income, not declared net earnings (₱7,680 vs ₱5,430/month) | src/pages/Estimator.jsx:164,206; contributions.js:90-102 |
| WH-08 | Medium | Money fields drop the decimal point (₱22,964.58 becomes ₱2,296,458); same root cause as TB-07 / TI-05 | src/lib/format.js:16-19; src/components/ui.jsx:29-30 |
| WH-12 | Medium | MCIT start field asks year operations began; RR 9-98 counts from the year of BIR registration | src/pages/ProfileWizard.jsx:169-176; src/engine/estimators/corporation.js:34-36 |
| WH-09 | Low | Semi-monthly, weekly and daily withholding tables exist but no screen can use them | src/engine/estimators/employee.js:18; payroll.js:9,24-31; src/pages/Estimator.jsx:287-289 |
| WH-10 | Low | No centavo rounding: ₱3.19 shown for ₱3.20, 12-month total does not foot, PhilHealth shares ≠ premium, annual figures not in whole pesos | src/engine/tax.js:5-13; contributions.js:6,44-50; src/lib/format.js:7-10 |

Rejected after verification: none

### Posted information and content accuracy (verified)

| ID | Severity | Problem | Location |
|---|---|---|---|
| INF-01 | High | 2027 holidays miss Proc 1427 days; Q3-2027 withholding, SSS, PhilHealth show Tue Nov 2, should be Wed Nov 3 (same defect as DL-03) | src/data/rules/holidays.json:2,9-14,36-54; src/pages/References.jsx:100-113 |
| INF-02 | High | References still shows NCR minimum wage ₱695 as operative; NCR-28 (₱755/₱718) reported in force since Sept 26, 2026 | src/data/rules/withholding-compensation.json:63-68; src/pages/References.jsx:70-81 |
| INF-03 | High | Profile setup tells VAT-registered mixed-income earners on OSD they file 1701A; mixed income always files 1701 | src/pages/ProfileWizard.jsx:55,128,147 |
| INF-04 | High | Blog says invoice 'for every payment you receive' (pre-EOPT); invoice is due at each sale/service; eAFS timing also contradicts Forms page | src/data/posts.js:19,23 |
| INF-05 | Medium | References page shows no values and no needs-review flags; Estimator states unconfirmed VAT-registration deadline as fact | src/pages/References.jsx:18-27,51-54,115-119; src/pages/Estimator.jsx:107 |
| INF-06 | Medium | Checklist (any RDO) and Forms page (current RDO for business) disagree on where to file 1905 transfer; rule unverified | src/data/rules/obligations.json:1407; src/data/forms.js:27 |
| INF-08 | Medium | Self-employed Pag-IBIG item labeled 'MP2/RTPO'; MP2 is the voluntary savings program, not regular contributions | src/data/rules/obligations.json:948 |
| INF-07 | Low | ARF abolition cites RMC 15-2024 (should be RMC 14-2024); e-invoicing cites only RR 11-2025 | src/data/rules/obligations.json:1317,454-459 |
| INF-09 | Low | 'Rules last verified Aug 26, 2026' and footer 'current issuances' predate Sept 2026 changes | src/data/rules/meta.json:3,7; src/App.jsx:144-150 |
| INF-10 | Low | Micro-taxpayer abatement notice has no end date and will show after Dec 31, 2026 | src/data/rules/obligations.json:1323-1342; src/engine/deadlines.js:166-171 |
| INF-11 | Low | Polish: '2550M is gone', Jan 15/Jan 30 book dates for fiscal-year users, dev text on Profiles, form-guide button, statute list, brand form | src/data/forms.js:13; src/pages/ProfileWizard.jsx:211-212; src/pages/Profiles.jsx:66; src/pages/Dashboard.jsx:143; src/App.jsx:146-147 |
| INF-12 | Low | [verifier] Blog 8% post omits that mixed-income earners get no ₱250k reduction and that 8% needs non-VAT and gross ≤ ₱3M | src/data/posts.js:6 |

Rejected after verification: none

### Bugs: run the app and test every flow (verified)

| ID | Severity | Problem | Location |
|---|---|---|---|
| BUG-01 | Critical | Amounts with centavos read as 100x larger (4,800.00 becomes 480,000); minus signs and other characters silently dropped | src/lib/format.js:16-19; src/components/ui.jsx:24-31 |
| BUG-02 | Critical | With two tabs open, the Estimator writes back a stale profile: edits are reverted and deleted profiles come back | src/pages/Estimator.jsx:55-65; src/lib/backend.js:50-57; src/state/AppState.jsx |
| BUG-03 | High | Today and days-left follow the device clock, not Manila time; users abroad see passed deadlines as 0 days left | src/engine/dates.js:14-17; Dashboard.jsx:39; Estimator.jsx:256; ProfileWizard.jsx:172 |
| BUG-04 | High | Corporate estimator skips MCIT when start year is Not sure (the default) or before 1997; headline understates tax | ProfileWizard.jsx:169-176; corporation.js:36, 69-72; Estimator.jsx:270-276 |
| BUG-05 | Medium | Estimator figures lost on reload/close or a profile edit within about 1 s; save failures hidden | Estimator.jsx:48-78; ProfileWizard.jsx:27, 62 |
| BUG-06 | Medium | Penalty tool charges surcharge and compromise at 0 or blank days late (50,000 on time shows 60,000) | Tools.jsx:15-23, 61-76; penalties.js:19-33 |
| BUG-07 | Medium | Breakdown points to a VAT panel that does not exist; totals leave VAT out | individual.js:139; Estimator.jsx:128, 137 |
| BUG-08 | Medium | Mixed-income profiles have two unlinked salary input sets giving different compensation tax | Estimator.jsx:82-84, 222, 328-332 |
| BUG-09 | Medium | Wizard: Cancel can leave the app; unknown edit link opens a blank new-profile form; Back after save reopens wizard | ProfileWizard.jsx:12-21, 62-63, 256 |
| BUG-10 | Medium | On phones the main menu is squeezed to 115 px with hidden scrollbar; most sections sit off-screen | src/styles/app.css:63-64, 183; App.jsx:116-121 |
| BUG-11 | Medium | Blog article cards cannot be focused or opened with the keyboard | src/pages/Blog.jsx:19, 33 |
| BUG-12 | Low | Calendar today never updates after midnight; shows 0 days left instead of Due today | Dashboard.jsx:39, 146-147 |
| BUG-13 | Low | YTD projector silently uses 12 when Months in is above 12; 0 or blank gives zeros with no message | Tools.jsx:33-34 |
| BUG-14 | Low | A 0 salary shows PhilHealth 250 deducted and a negative take-home; payroll shows 260 employer cost | contributions.js:11, 21, 43; employee.js:36; payroll.js:34, 45 |
| BUG-15 | Low | Read the form guide always opens 1701Q, not the form that is due | Dashboard.jsx:143; Forms.jsx:14 |
| BUG-16 | Low | Where it lands on the return card never shows the taxable income line | Estimator.jsx:175, 188 |
| BUG-17 | Low | Sample figures shown as the client's estimate and saved on first edit, with no sample label | Estimator.jsx:51, 68-71, 82-84, 222, 250-252, 288 |

Rejected after verification: none

### Security and privacy (verified)
| ID | Severity | Problem | Location |
|---|---|---|---|
| SEC-01 | High | No privacy notice, consent step or terms anywhere in the app, although it collects and saves personal financial data | src/pages/Auth.jsx:16-24,65-67 |
| SEC-02 | Medium | Users cannot delete their account or download their data | src/pages/Profiles.jsx:46-58 |
| SEC-03 | Medium | The hosted site shares its web origin with every other GitHub Pages site of the same account, so saved client data and login tokens are readable by those sites | .github/workflows/deploy.yml:36-49 |
| SEC-04 | Medium | Local mode keeps client names and income unencrypted in the browser, with no shared-computer warning, no erase-all, and data left behind if the site later switches to accounts | src/lib/backend.js:18-34,40-41,51-57 |
| SEC-05 | Medium | No 'forgot password' or account-recovery flow; Supabase auth settings are not recorded in the repo | src/pages/Auth.jsx:5,12-29,26,50 |
| SEC-06 | Low | Database row-level security is correct, but there is no limit on profile size or count, and the app relies on that security alone when listing profiles | supabase/migrations/0001_taxpayer_profiles.sql:6-28 |
| SEC-07 | Low | No Content-Security-Policy on the app pages | app.html:1-21 (no http-equiv CSP) |
| SEC-08 | Low | Dependencies with published advisories (none exploitable in the shipped app) | package.json:16-24 |
| SEC-09 | Low | Build and deploy pipeline hygiene: end-of-life Node 20, actions pinned to movable tags, broad permissions, and .gitignore gaps for env files | .github/workflows/deploy.yml:10-13,23-26,36-37,49 |
| SEC-10 | Medium | [verifier] The site is published twice on every update and the two copies race; the live site is now the raw branch copy, which ignores the account settings and also publishes the old app copies | .github/workflows/deploy.yml:3-4,36-49 |
Rejected after verification: none

### UI/UX and accessibility (verified)

| ID | Severity | Problem | Location |
|---|---|---|---|
| UX-01 | Critical | Amount boxes drop the decimal point: 480,000.50 becomes 48,000,050 and the tax shown is wrong (₱9,482,511 instead of ₱18,400) | src/lib/format.js:16-19; src/components/ui.jsx:24-31 |
| UX-02 | Critical | Edit profile: re-tapping the selected type card resets regime, books, employer, 2307 and EWT settings with no warning (110 -> 47 deadlines) | src/pages/ProfileWizard.jsx:47-53, :89 |
| UX-03 | Medium | Editing inside an amount jumps the cursor to the end, so later digits land in the wrong place | src/components/ui.jsx:29-30 |
| UX-04 | High | On phones, calendar, Forms and Profiles rows are squashed, overlapping and cut off (due dates hidden on 12 forms) | src/pages/Dashboard.jsx:323-341; src/pages/Forms.jsx:81-92; src/pages/Profiles.jsx:33-58; src/styles/app.css:98-99,146,153 |
| UX-05 | Medium | On phones the main menu shows only Calendar; other pages and some tab options are hidden with no scroll hint | src/styles/app.css:63-64, :79-83; src/App.jsx:99-121 |
| UX-06 | Medium | Blog article cards cannot be opened with the keyboard and are not marked as links (WCAG 2.1.1) | src/pages/Blog.jsx:19, :33 |
| UX-07 | Medium | Grey text fails WCAG contrast on every page (2.2:1 to 4.46:1, needs 4.5:1); switch track and box outlines 1.2-1.3:1 | src/styles/app.css:13-14, :23-24, :127, :181, :223, :264, :288 |
| UX-08 | High | Breakdown points to a nonexistent 'VAT panel'; VAT never estimated; VAT-registered under ₱3M get no 'VAT excluded' note | src/engine/estimators/individual.js:138-140; src/pages/Estimator.jsx:104-110, :137, :177 |
| UX-09 | High | 'Today' and days-left follow the device time zone, not Manila (one day too generous abroad) | src/engine/dates.js:14-17; src/pages/Dashboard.jsx:39, :146-148, :262 |
| UX-10 | Medium | Profile wizard: no step count, no reason Continue is disabled, focus not moved, option groups and switch help not announced | src/pages/ProfileWizard.jsx:75-77, :124, :143, :208, :255-263; src/components/ui.jsx:52-69 |
| UX-11 | Low | Profile switcher claims to be a menu but arrow keys do nothing; stays open when tabbing away; focus not returned | src/App.jsx:16-74 |
| UX-12 | Medium | Every page has the same tab title and page changes are not announced (WCAG 2.4.2) | app.html:6; src/App.jsx:80 |
| UX-13 | Medium | Invalid inputs silently changed: months over 12 treated as 12, losses shown as ₱0, cleared box becomes 0, no field messages | src/pages/Tools.jsx:33-34; src/engine/estimators/individual.js:51; corporation.js:27-28; src/components/ui.jsx:29-30 |
| UX-14 | Medium | Displayed lines do not add up to totals (₱1 and ₱0.01-₱0.06 gaps); pesos and centavos mixed on one screen | src/lib/format.js:1-10; src/pages/Estimator.jsx:127-137, :176-179; src/engine/estimators/employee.js:31-36, :56 |
| UX-15 | Medium | No print layout (washed-out printouts, buttons print) and no PDF, CSV or .ics export | src/styles/app.css (no @media print); src/pages/Dashboard.jsx:131-155; src/pages/Estimator.jsx:147-154 |
| UX-16 | Medium | Slow first load: 604 kB single file, unused 212 kB Supabase library, render-blocking Google Fonts (about 5.5 s on Slow 3G) | app.html:10-12, :15; src/lib/backend.js:10, :16; scripts/standalone-plugin.js |
| UX-17 | Low | Table view on phones hides Agency, Type and Period off-screen with no scroll hint | src/pages/Dashboard.jsx:229-248 |
| UX-18 | Medium | Income-tax rail ticks passed deadlines as if filed (7 of 9, 78%); nothing can be marked done | src/pages/Dashboard.jsx:254-278; src/pages/Checklist.jsx:50-63 |
| UX-19 | Low | Some payment-channel codes (R-5/PRN, SPA/EPRS, MCRF, ORUS, EIS) and RCIT/MCIT heading not explained | src/data/rules/obligations.json:440, :823, :848, :873, :1096; src/pages/Estimator.jsx:339 |
| UX-20 | Low | 'Read the form guide' on the next-deadline card opens 1701Q, not the deadline's form | src/pages/Dashboard.jsx:143; src/pages/Forms.jsx:14 |
| UX-21 | Low | Welcome page has no h1; Estimator, Tools, Checklist and References skip from h1 to h3 | src/pages/Dashboard.jsx:19; src/pages/Estimator.jsx:158-299; src/pages/Tools.jsx:48-105; src/pages/Checklist.jsx:48; src/pages/References.jsx:57-100 |
| UX-22 | Medium | [verifier] Timeline view silently stops after 40 deadlines (e.g. ends Mar 1, 2027; April 15 return missing) | src/pages/Dashboard.jsx:205 |

Rejected after verification: none

### Code health (verified)
| ID | Severity | Problem | Location |
|---|---|---|---|
| CH-03 | Critical | Amount fields drop the decimal point, so 1,234.56 is read as 123,456 and every result is wrong | src/lib/format.js:16-19; src/components/ui.jsx:29-30 |
| CH-01 | High | Rates, thresholds and due dates are also typed into screens and calculators; README says rulebook edits need no code changes | src/engine/estimators/*.js; src/pages/{Estimator,Tools,ProfileWizard}.jsx; README.md:77; src/data/rules/meta.json:5,7 |
| CH-02 | High | Rules marked needs_review are shown as verified; References page shows neither values nor review flags | src/pages/References.jsx:15-27,116-118; src/pages/Dashboard.jsx:323-342; src/pages/Checklist.jsx:49-61 |
| CH-04 | High | Setup screen says books are due Jan 15 / Jan 30, wrong for fiscal-year corporations (calendar is right) | src/pages/ProfileWizard.jsx:210-212 |
| CH-10 | High | Today and the tax year come from the device clock, not Manila time; countdowns off by a day abroad | src/engine/dates.js:14-17; src/pages/Dashboard.jsx:39-44; src/pages/Estimator.jsx:256 |
| CH-05 | Medium | Estimator cards: income tax plus business tax often differs from the total shown by 1 peso | src/pages/Estimator.jsx:127-137,150-151; src/lib/format.js:1-5 |
| CH-06 | Medium | All money math is floating point with three rounding methods; rare .50 totals shown a peso low | src/lib/format.js:1-10; src/engine/tax.js:5-13; src/engine/estimators/*.js |
| CH-08 | Medium | No tests for payroll, input parsing, self-employed contributions or thresholds; 11 planted errors pass | tests/engine/*.test.js; src/engine/estimators/payroll.js; src/lib/format.js |
| CH-09 | Medium | Rulebook has one value per rule and no tax-year input, so prior or next years cannot be computed | src/data/rules/*.json; src/pages/Estimator.jsx:256; src/engine/estimators/corporation.js:25 |
| CH-11 | Medium | Committed index.html (the live site) is hand-built and never checked against the source or tested | index.html; scripts/standalone-plugin.js:20-58; .github/workflows/deploy.yml |
| CH-12 | Medium | VAT users are told to see a VAT panel that does not exist; totals exclude VAT | src/engine/estimators/individual.js:139; src/pages/Estimator.jsx:104-110,137,177 |
| CH-14 | Medium | legacy/ and project/ are old full app copies with their own tax rules, and the live site publishes them | legacy/index.html; project/; README.md:97-98 |
| CH-07 | Low | PhilHealth employee plus employer shares can exceed the premium by 1 centavo | src/engine/estimators/contributions.js:41-51 |
| CH-13 | Low | Dead code, unreachable payroll pay periods, unused outputs and duplicated helpers | src/engine/dates.js:23; src/lib/format.js:12; src/engine/estimators/payroll.js:9,29-32; src/pages/Estimator.jsx:173-175,188 |
| CH-15 | Low | No lint step; ESLint finds 1 error (lost error cause) and 14 warnings | src/lib/backend.js:28-29,40; src/pages/References.jsx:20 |
Rejected after verification: none

### Completeness pass (gap checks)

| ID | Severity | Problem | Location |
|---|---|---|---|
| GAP-01 | High | Tools year-to-date projector subtracts ₱250,000 and shows an '8% tax' for every profile: ₱20,000 too low for mixed-income earners (₱18,400 vs ₱38,400 at the defaults), and shown to VAT-registered and corporate profiles that cannot use 8% | src/pages/Tools.jsx:33-37 (:35), 104-126 |
| GAP-02 | Low | Community tax (cedula) reminder only for business profiles; employees (LGC Sec 157: wage/salary earners) get none. Legal text not re-fetched (UNVERIFIED) | src/data/rules/obligations.json:1045-1067 |

Contradictions resolved (details in completeness.json):
- Bugs-area row 'whole-peso displays free of float error = OK' is wrong. ₱11,362.50 is shown as ₱11,362 and the recommended ₱12,781.50 as ₱12,781 (covered by TI-07/CH-06).
- Rules-status conflicts:
  - Resolved OK: 1601-C date, 1702Q/1702 dates, optional 2550M, ₱3M VAT threshold, ₱90k 13th-month cap.
  - Resolved WRONG: NCR minimum wage (INF-02 basis).
  - Different scope, no real conflict: SEC AFS, RR 4-2026, books deadlines.
  - Still UNVERIFIED: CPI indexation of the ₱3M threshold.
- Severity conflicts to merge:
  - Centavo input: Critical in BUG-01/UX-01/CH-03, High in TI-05, Medium in TB-07/WH-08. Use Critical.
  - VAT never computed: High in TB-03/UX-08, Medium in BUG-07/CH-12. Use High.
  - Rules marked 'needs review' shown as verified: High in CH-02, Medium in DL-05/INF-05. Use High.
  - Fiscal-year books setup text: High in CH-04, Low in INF-11(b). Use High.
  - NCR minimum wage: High in INF-02, Medium in WH-02. Use High.
  - Sample figures saved as client data: Medium in TI-09, Low in BUG-17. Use Medium.
- Gap checks with no new defect:
  - Console crawl (all routes x 8 profile states x odd inputs): 0 errors, only React Router future-flag warnings.
  - No external links; all internal routes resolve.
  - Spell check: no typos beyond INF-11.
  - Obligation applicability matrix matches the verified rules except GAP-02.
- Web sources were unreachable in this pass, so UNVERIFIED rows stay UNVERIFIED.


