import React, { useState } from 'react'
import { FORMS_DATA, FORM_CATS } from '../data/forms.js'
import attachments from '../data/rules/attachments.json'
import { Seg } from '../components/ui.jsx'

const ATTACH_BY_FORM = Object.fromEntries(attachments.perReturn.value.map(r => [r.form, r.items]))

// Ported from v1; data moved to src/data/forms.js and extended with the
// employer / withholding-agent / corporate forms. Per-form attachment
// requirements come from src/data/rules/attachments.json.
export default function FormsPage() {
  const [formQuery, setFormQuery] = useState('')
  const [formCat, setFormCat] = useState('all')
  const [openForm, setOpenForm] = useState('1701Q')
  const [showEafs, setShowEafs] = useState(false)
  const q = formQuery.toLowerCase()

  const filtered = FORMS_DATA.filter(f =>
    (formCat === 'all' || f.cat === formCat) &&
    (!q || (f.code + ' ' + f.name + ' ' + f.summary).toLowerCase().includes(q))
  )
  const eafs = attachments.eafsSystem.value
  const groups = attachments.eafsFileGroups.value

  return (
    <div className="page wrap" style={{ paddingTop: '26px', paddingBottom: '64px' }}>
      <div style={{ marginBottom: '18px' }}>
        <h1 className="pg-h1">BIR form reference</h1>
        <p className="pg-sub">Every form a freelancer, employer, or small business is likely to meet, in plain language. Tap one for what it's for, who files it, and the parts that matter.</p>
      </div>
      <div className="card pad" style={{ marginBottom: '18px' }}>
        <div role="button" tabIndex={0} aria-expanded={showEafs}
          onClick={() => setShowEafs(!showEafs)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowEafs(!showEafs) } }}
          style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
          <span className="formcode">eAFS</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '14.5px' }}>Where return attachments go</div>
            <div style={{ fontSize: '12.5px', color: 'var(--mut)', marginTop: '2px' }}>
              {attachments.itrAttachmentDeadline.value}
            </div>
          </div>
          <span className="mono" style={{ fontSize: '18px', color: 'var(--dim)', width: '16px', textAlign: 'center', flexShrink: 0 }} aria-hidden="true">{showEafs ? '–' : '+'}</span>
        </div>
        {showEafs && (
          <div className="acc-body" style={{ marginTop: '14px', borderTop: '1px solid var(--line2)', paddingTop: '14px' }}>
            <p style={{ fontSize: '13.5px', lineHeight: 1.6, color: 'var(--mut)' }}>
              {eafs.what}. Open to {eafs.who.charAt(0).toLowerCase() + eafs.who.slice(1)}. {eafs.enrollment}. Files: {eafs.fileFormat}. {eafs.proof}.
            </p>
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {groups.annual.map((g, i) => (
                <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <span className="boxcode" style={{ flexShrink: 0 }}>{g.group}</span>
                  <span className="mono" style={{ fontSize: '12px', color: 'var(--ink)' }}>{g.name}</span>
                  <span style={{ fontSize: '12.5px', color: 'var(--mut)', lineHeight: 1.5, flexBasis: '100%' }}>{g.contains}</span>
                </div>
              ))}
            </div>
            <p className="cite" style={{ marginTop: '12px', lineHeight: 1.6 }}>
              {groups.conventions}. Quarterly returns use {groups.quarterly[0].name} / {groups.quarterly[1].name}.
              Skipping a required attachment: {attachments.lateAttachmentPenalties.value.standard.toLowerCase()}; {attachments.lateAttachmentPenalties.value.microSmall.toLowerCase()}.
            </p>
            <p className="cite" style={{ marginTop: '8px' }}>{attachments.eafsSystem.legalBasis.join(' · ')}</p>
          </div>
        )}
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
                  {ATTACH_BY_FORM[f.code] && (
                    <div style={{ marginTop: '16px' }}>
                      <div style={{ fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--mut)' }}>Attachments</div>
                      <div style={{ marginTop: '9px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {ATTACH_BY_FORM[f.code].map((a, i) => (
                          <div key={i} style={{ fontSize: '13.5px', lineHeight: 1.55 }}>
                            <div>{a.doc}</div>
                            {a.channel !== '—' && (
                              <div style={{ fontSize: '12.5px', color: 'var(--mut)', marginTop: '2px' }}>
                                {a.channel} · {a.when}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
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
