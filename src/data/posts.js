// Blog content, ported from v1 (legacy/index.html, now in the git tag
// archive/pre-review-2026-10) and reviewed in October 2026
// (H09: EOPT invoicing, eAFS timing, the 8% conditions). `reviewed` is shown
// on each post as "Last reviewed"; update it whenever a post is re-checked.
import { RT, dueDayText, quarterlyDaysText, daysBetweenDueDays } from '../engine/ruleText.js'

// H16: rates, thresholds and due dates come from the rulebook.
const ANNUAL = dueDayText('bir-1701a-annual')
const EAFS_DAYS = daysBetweenDueDays('bir-1701a-annual', 'bir-eafs-itr-attachments-individual')
const QUARTERS = quarterlyDaysText('bir-1701q').split(' · ')

export const POSTS = [
  { id: '8-vs-grad', cat: 'Guides', title: `${RT.eightRate} or graduated? A freelancer's five-minute decision`, excerpt: 'The single choice you make at registration quietly shapes every deadline and every peso you owe. Here\'s how to get it right.', read: '6 min read', date: 'June 2026', reviewed: 'October 2026', feature: true, body: [
    { kind: 'p', text: 'When you register as self-employed, the BIR asks how your income should be taxed. There are two roads, and the one you pick quietly shapes every deadline and every peso you owe for the rest of the year.' },
    { kind: 'h', text: `The ${RT.eightRate} road` },
    { kind: 'p', text: `You pay a flat ${RT.eightRate} on your gross receipts above ${RT.eightAllowance}, and nothing else. No percentage tax, no itemizing, no separate 2551Q. For most freelancers with low overhead, it is both the simplest and the cheapest option.` },
    { kind: 'p', text: `The ${RT.eightAllowance} reduction is only for those with no salary income; if you are also employed, the ${RT.eightRate} applies to all your business gross. The ${RT.eightRate} option is only for non-VAT taxpayers with gross sales of ${RT.eightCeilingShort} or less.` },
    { kind: 'h', text: 'The graduated road' },
    { kind: 'p', text: `You pay the regular income-tax brackets on your profit (after either the ${RT.osdRate} OSD or your actual expenses), plus a separate ${RT.percentageTaxRate} percentage tax on gross. It wins when your expenses are high enough to pull your taxable income well down.` },
    { kind: 'quote', text: `Rule of thumb: if your real costs sit under about ${RT.osdRate} of your income, ${RT.eightRate} usually wins. Above that, run both numbers.` },
    { kind: 'h', text: 'How to actually decide' },
    { kind: 'list', items: ['Estimate your gross income for the year.', 'Estimate your deductible expenses as a share of it.', 'Run both through the Estimator; it shows the exact peso difference.', 'Remember the election locks for the year once you file your first quarter.'] },
    { kind: 'p', text: `When in doubt, most low-overhead freelancers are well served by ${RT.eightRate}: fewer forms, fewer deadlines, and usually a smaller bill.` },
  ] },
  { id: 'first-year', cat: 'Getting started', title: 'Your first year as a registered freelancer', excerpt: 'Registering is the easy part. Here is the shape of the twelve months that follow, month by month, without the dread.', read: '8 min read', date: 'May 2026', reviewed: 'October 2026', body: [
    { kind: 'p', text: 'Registering is the easy part. Knowing what happens next is what keeps people up at night. Here is the shape of your first twelve months.' },
    { kind: 'h', text: 'Month one: register and set up' },
    { kind: 'p', text: 'File Form 1901, receive your Certificate of Registration (2303), and register your books and invoices. Good news: the old ₱500 annual registration fee was scrapped in 2024.' },
    { kind: 'h', text: 'Every month: contribute and invoice' },
    { kind: 'list', items: [`Issue a BIR-registered invoice for every sale or service (any amount if VAT-registered; ${RT.invoiceThreshold} and up, or whenever the client asks, if non-VAT).`, 'Pay SSS, PhilHealth and Pag-IBIG; as a freelancer you cover both shares.', 'Keep your books current so quarter-end is painless.'] },
    { kind: 'h', text: 'Every quarter: file 1701Q' },
    { kind: 'p', text: 'Three times a year you total your income so far, compute the tax, and pay the difference. The calendar in this app counts down each one for you.' },
    { kind: 'h', text: 'Once a year: the annual return' },
    { kind: 'p', text: `By ${ANNUAL} you file your annual return (1701A or 1701) reconciling all four quarters. Claim any 2307 certificates your clients gave you (that is tax already paid on your behalf) and upload the scans through the BIR's eAFS portal within ${EAFS_DAYS} days after the ${ANNUAL} deadline (or after you e-file, if later).` },
    { kind: 'quote', text: 'The whole system rewards small, steady habits. Invoice, set aside, file. Repeat.' },
  ] },
  { id: '2307', cat: 'Withholding', title: 'What to do with every 2307 your clients hand you', excerpt: 'One of the few pieces of BIR paperwork that works in your favour, and the money you lose by ignoring it.', read: '4 min read', date: 'May 2026', reviewed: 'October 2026', body: [
    { kind: 'p', text: 'A 2307 is one of the rare pieces of BIR paperwork that works in your favour. It is proof that a client already paid part of your tax for you.' },
    { kind: 'h', text: 'Why it matters' },
    { kind: 'p', text: `When a client withholds (commonly ${RT.pfIndividualLowerRate} or ${RT.pfIndividualStandardRate} of your fee), they remit it to the BIR and hand you a 2307. That amount is a credit: it directly reduces what you owe on your quarterly and annual returns.` },
    { kind: 'list', items: ['Collect every 2307; chase clients who forget.', 'Check the amounts and period match your invoices.', 'Claim them on your 1701Q / 1701A, list them in the SAWT sent via eSubmission, and upload the scans through eAFS.'] },
    { kind: 'quote', text: 'A drawer full of unclaimed 2307s is just tax you paid twice.' },
  ] },
  { id: 'deadlines', cat: 'Calendar', title: 'The five deadlines that actually matter', excerpt: 'The BIR calendar is long. For a low-overhead freelancer, only a handful of dates decide whether you sleep well.', read: '5 min read', date: 'April 2026', reviewed: 'October 2026', body: [
    { kind: 'p', text: 'The BIR calendar is long, but for a low-overhead freelancer only a handful of dates truly decide whether you sleep well.' },
    { kind: 'list', items: [`1701Q: quarterly income tax, around ${QUARTERS.slice(0, -1).join(', ')} and ${QUARTERS[QUARTERS.length - 1]}.`, `1701A: your annual return, every ${ANNUAL}.`, 'Monthly contributions: SSS, PhilHealth and Pag-IBIG.', '2551Q: only if you chose graduated rates.', 'Invoices and books: the quiet daily habit behind all of it.'] },
    { kind: 'p', text: 'Everything else is either situational or handled for you. Master these five and the rest follows.' },
  ] },
]
