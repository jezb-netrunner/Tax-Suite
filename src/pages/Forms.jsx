import React, { useState } from 'react'
import { FORMS_DATA, FORM_CATS } from '../data/forms.js'
import { Seg } from '../components/ui.jsx'

// Ported from v1; data moved to src/data/forms.js and extended with the
// employer / withholding-agent / corporate forms.
export default function FormsPage() {
  const [formQuery, setFormQuery] = useState('')
  const [formCat, setFormCat] = useState('all')
  const [openForm, setOpenForm] = useState('1701Q')
  const q = formQuery.toLowerCase()

  const filtered = FORMS_DATA.filter(f =>
    (formCat === 'all' || f.cat === formCat) &&
    (!q || (f.code + ' ' + f.name + ' ' + f.summary).toLowerCase().includes(q))
  )

  return (
    <div className="page wrap" style={{ paddingTop: '26px', paddingBottom: '64px' }}>
      <div style={{ marginBottom: '18px' }}>
        <h1 className="pg-h1">BIR form reference</h1>
        <p className="pg-sub">Every form a freelancer, employer, or small business is likely to meet, in plain language. Tap one for what it's for, who files it, and the parts that matter.</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '18px' }}>
        <div className="search-w">
          <span style={{ color: 'var(--dim)', fontSize: '14px' }} aria-hidden="true">⌕</span>
          <input type="text" value={formQuery} aria-label="Search forms" onChange={e => setFormQuery(e.target.value)} placeholder="Search forms…" />
        </div>
        <Seg options={FORM_CATS} value={formCat} onChange={setFormCat} ariaLabel="Form category" />
      </div>
      {filtered.length === 0 && (
        <div className="card pad" style={{ textAlign: 'center', color: 'var(--mut)' }}>No forms match “{formQuery}”. Try a code like 1701Q or a word like “withholding”.</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filtered.map(f => {
          const isOpen = openForm === f.code
          return (
            <div key={f.code} className={isOpen ? undefined : 'click'} style={{ border: `1.5px solid ${isOpen ? 'var(--acc)' : 'var(--line)'}`, borderRadius: '13px', background: 'var(--sf)', overflow: 'hidden', transition: 'border-color .15s, box-shadow .2s' }}>
              <div role="button" tabIndex={0} aria-expanded={isOpen}
                onClick={() => setOpenForm(isOpen ? null : f.code)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenForm(isOpen ? null : f.code) } }}
                style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 18px', cursor: 'pointer' }}>
                <span className="formcode">{f.code}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '14.5px' }}>{f.name}</div>
                  <div style={{ fontSize: '12.5px', color: 'var(--mut)', marginTop: '2px' }}>{f.who}</div>
                </div>
                <span className="mono" style={{ fontSize: '12px', color: 'var(--mut)', whiteSpace: 'nowrap', flexShrink: 0 }}>{f.when}</span>
                <span className="mono" style={{ fontSize: '18px', color: 'var(--dim)', width: '16px', textAlign: 'center', flexShrink: 0 }} aria-hidden="true">{isOpen ? '–' : '+'}</span>
              </div>
              {isOpen && (
                <div className="acc-body" style={{ padding: '0 18px 18px', borderTop: '1px solid var(--line2)' }}>
                  <p style={{ fontSize: '14px', lineHeight: 1.6, marginTop: '14px' }}>{f.summary}</p>
                  {f.lines && f.lines.length > 0 && (
                    <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
                      {f.lines.map((ln, i) => (
                        <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'baseline' }}>
                          <span className="boxcode">{ln.box}</span>
                          <span style={{ fontSize: '13.5px', color: 'var(--mut)', lineHeight: 1.5 }}>{ln.desc}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
