import React from 'react'
import { Link } from 'react-router-dom'
import { hasCloud } from '../lib/backend.js'

// Privacy Notice under the Data Privacy Act of 2012 (RA 10173).
//
// OWNER: fill in the three bracketed placeholders below before publishing
// (REVIEW.md 4.3, decision 18). They are shown highlighted on the page until
// then. The region is the Supabase project's region and only matters once
// accounts mode is switched on.
export const PRIVACY_PLACEHOLDERS = {
  contactEmail: '[CONTACT EMAIL]',
  dpoName: '[DPO NAME]',
  region: '[REGION]',
}

// Keep in step with PRIVACY_NOTICE_VERSION in src/lib/auth.js.
export const PRIVACY_NOTICE_UPDATED = 'October 7, 2026'

function Placeholder({ children }) {
  return (
    <mark data-placeholder="true" title="To be filled in by the site operator before publishing"
      style={{ background: 'var(--warnSoft)', color: '#6b4a12', padding: '0 4px', borderRadius: '4px', fontWeight: 600 }}>
      {children}
    </mark>
  )
}

const BODY = { fontSize: '14px', lineHeight: 1.65, color: 'var(--ink)' }
const LIST = { ...BODY, margin: '10px 0 0', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }

function Section({ title, children }) {
  return (
    <section className="card pad" style={{ marginTop: '16px' }}>
      <h2 className="sec-h" style={{ fontSize: '16px' }}>{title}</h2>
      <div style={{ ...BODY, marginTop: '8px' }}>{children}</div>
    </section>
  )
}

export default function Privacy({ mode = hasCloud ? 'accounts' : 'local' }) {
  const { contactEmail, dpoName, region } = PRIVACY_PLACEHOLDERS
  const contact = <Placeholder>{contactEmail}</Placeholder>

  return (
    <div className="page wrap" style={{ paddingTop: '26px', paddingBottom: '64px', maxWidth: '820px' }}>
      <h1 className="pg-h1">Privacy Notice</h1>
      <p style={{ ...BODY, marginTop: '6px' }}>
        How JEZ Tax Suite handles your personal information, as required by the
        Data Privacy Act of 2012 (Republic Act 10173). Last updated {PRIVACY_NOTICE_UPDATED}.
      </p>

      <div className="card pad" role="note" style={{ marginTop: '18px', background: 'var(--accSoft)', borderColor: '#cfdeeb' }}>
        <h2 className="sec-h" style={{ fontSize: '16px' }}>Where your data is right now</h2>
        {mode === 'local' ? (
          <p style={{ ...BODY, marginTop: '8px' }}>
            <b>This site is running in local mode.</b> Everything you type stays in this browser on this
            device. Nothing you type is sent to us, and there is no account or sign-in. Anyone who uses this
            browser can see these profiles. Don't use this on a shared computer.
          </p>
        ) : (
          <p style={{ ...BODY, marginTop: '8px' }}>
            <b>This site uses accounts.</b> Your profiles and the figures you type are stored with our
            database provider, Supabase, on servers in <Placeholder>{region}</Placeholder>, so you can see them
            on any device after signing in.
          </p>
        )}
      </div>

      <Section title="Who is responsible">
        <p>
          The operator of JEZ Tax Suite decides how the data described here is handled (the personal
          information controller). Contact: {contact}. Data Protection Officer: <Placeholder>{dpoName}</Placeholder>,
          reachable at the same address.
        </p>
      </Section>

      <Section title="What we collect">
        <ul style={LIST}>
          <li><b>Profile names</b> you choose, which are often a person's or a business's name.</li>
          <li><b>Taxpayer type</b> (employee, self-employed, mixed income or corporation) and your registration answers: VAT registration, tax regime, employees, books of accounts, fiscal year, business permit and similar facts.</li>
          <li><b>The figures you type into the Estimator</b>: income, expenses, tax withheld, salaries, bonuses, and corporate sales, costs and assets. They are saved to the selected profile as you type.</li>
          <li><b>Deadlines you mark as filed</b>, checklist items you tick, and which profile you last used.</li>
          <li><b>Email address and password (accounts only).</b> The password is stored by Supabase in scrambled (hashed) form; we never see it. We also keep the date you agreed to this notice.</li>
        </ul>
        <p style={{ marginTop: '10px' }}>
          We do not ask for your TIN or other ID numbers. Please don't type them into profile names.
        </p>
      </Section>

      <Section title="Why we use it">
        <p>
          Only to build your deadline calendar, estimates and checklist, and to remember them between visits.
          With an account, also to let you sign in on any device and to send account emails (confirming your
          email address and resetting your password). We do not sell your data, show ads, or use tracking
          cookies or analytics.
        </p>
        <p style={{ marginTop: '10px' }}>
          In local mode the data never leaves your device. With an account we rely on the consent you give when
          you sign up; you can withdraw it at any time by deleting your account.
        </p>
      </Section>

      <Section title="Where it is stored and who receives it">
        <ul style={LIST}>
          <li><b>This browser (local mode).</b> Profiles and figures are kept in this browser's storage on this device. They are not encrypted, and anyone who uses this browser can see them.</li>
          <li><b>Supabase (accounts only).</b> Our database provider stores your email, hashed password and profiles in <Placeholder>{region}</Placeholder>. Each account can read only its own profiles.</li>
          <li><b>GitHub Pages (hosting).</b> GitHub, which hosts this site, receives your IP address and browser details when you open the site and keeps them in its server logs.</li>
          <li><b>Google Fonts.</b> While the app loads its fonts from Google, Google receives your IP address and browser details.</li>
        </ul>
        <p style={{ marginTop: '10px' }}>
          If you enter other people's information (for example as a bookkeeper for your clients), you are
          responsible for telling them and for having their permission.
        </p>
      </Section>

      <Section title="How long we keep it">
        <ul style={LIST}>
          <li><b>Local mode:</b> until you delete the profile, use "Erase all data on this device", or clear this site's data in your browser settings.</li>
          <li><b>Accounts:</b> until you delete the profile or your account. Deleted data may stay in the database provider's backups until those backups expire.</li>
          <li><b>Hosting and font logs:</b> as long as GitHub and Google keep them under their own policies.</li>
        </ul>
      </Section>

      <Section title="Your rights and how to use them">
        <p>Under the Data Privacy Act you have the right to:</p>
        <ul style={LIST}>
          <li><b>Be informed</b> about how your data is used. This notice does that.</li>
          <li><b>Access</b> your data: use "Download my data" on the <Link to="/profiles">Profiles page</Link>.</li>
          <li><b>Correct</b> it: open a profile with "Edit", or change the figures in the Estimator.</li>
          <li><b>Erase or block</b> it: "Delete" a profile, "Erase all data on this device" (local mode), or "Delete my account" (accounts), all on the Profiles page.</li>
          <li><b>Data portability</b>: "Download my data" gives you every profile and figure as a JSON file you can keep or move.</li>
          <li><b>Object</b> to the processing: stop using the app and erase your data, or write to us.</li>
          <li><b>Claim damages</b> if you are harmed by a breach of these rights.</li>
          <li><b>File a complaint with the National Privacy Commission</b> (privacy.gov.ph).</li>
        </ul>
        <p style={{ marginTop: '10px' }}>
          For anything the app cannot do for you, email {contact}. We will reply without undue delay.
        </p>
      </Section>

      <Section title="Security and changes">
        <p>
          The site is served over an encrypted connection (HTTPS). With an account, the database lets each
          account read and change only its own profiles. If this notice changes, the date at the top changes
          too; with an account we will ask you to agree again to any change in how your data is used.
        </p>
      </Section>
    </div>
  )
}
