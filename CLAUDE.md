# CLAUDE.md

## Project rules

- Philippine tax web app (BIR). Users: Filipino freelancers, professionals, and small businesses.
- The owner is a CPA who does not read code. Explain results in plain language. For each change, give a manual check: enter X, expect Y.
- Tax law: apply the Philippine law in force for each taxable period (NIRC as amended by TRAIN, CREATE, EOPT, CREATE MORE, later laws, BIR issuances). Verify with web search against primary sources and cite them. If you cannot verify a rule, mark it UNVERIFIED. Do not guess.
- Money: no floating-point errors. Rounding must match BIR forms.
- Dates: use Asia/Manila time.
- IMPORTANT: Never deploy. Never push or merge to main. Never write to the live database.
- When compacting, keep the REVIEW.md findings list and the test commands.
