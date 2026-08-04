import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { POSTS } from '../data/posts.js'

// Ported from v1; navigation moved from component state to routes.
export default function BlogPage() {
  const { postId } = useParams()
  const nav = useNavigate()

  if (!postId) {
    const featured = POSTS.find(p => p.feature) || POSTS[0]
    const rest = POSTS.filter(p => p !== featured)
    return (
      <div className="page wrap" style={{ paddingTop: '34px', paddingBottom: '64px' }}>
        <div style={{ marginBottom: '26px' }}>
          <div className="mono" style={{ fontSize: '11.5px', fontWeight: 500, letterSpacing: '.13em', textTransform: 'uppercase', color: 'var(--acc)' }}>The Present Value Journal</div>
          <h1 style={{ fontSize: '30px', fontWeight: 800, letterSpacing: '-.025em', marginTop: '10px' }}>Plain-language tax, for people who'd rather be working</h1>
        </div>
        <div className="card click" onClick={() => nav(`/blog/${featured.id}`)} style={{ borderRadius: '16px', overflow: 'hidden', display: 'flex', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px', background: 'linear-gradient(150deg,var(--brand),var(--brand2))', padding: '28px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '22px' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#a9cde6' }}>{featured.cat}</span>
            <span className="mono" style={{ fontSize: '12px', color: '#cdddea' }}>{featured.read} · {featured.date}</span>
          </div>
          <div style={{ flex: '2.4 1 300px', padding: '28px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--acc)' }}>Featured</div>
            <h2 style={{ fontSize: '23px', fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.2, marginTop: '10px' }}>{featured.title}</h2>
            <p style={{ fontSize: '14.5px', color: 'var(--mut)', lineHeight: 1.6, marginTop: '11px' }}>{featured.excerpt}</p>
            <div style={{ marginTop: '16px', fontSize: '13.5px', fontWeight: 600, color: 'var(--accInk)' }}>Read article →</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: '16px', marginTop: '18px' }}>
          {rest.map(p => (
            <div key={p.id} className="card click" onClick={() => nav(`/blog/${p.id}`)} style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--acc)' }}>{p.cat}</span>
              <h3 style={{ fontSize: '16.5px', fontWeight: 700, letterSpacing: '-.015em', lineHeight: 1.25, marginTop: '10px' }}>{p.title}</h3>
              <p style={{ fontSize: '13.5px', color: 'var(--mut)', lineHeight: 1.55, marginTop: '9px', flex: 1 }}>{p.excerpt}</p>
              <div className="mono" style={{ fontSize: '11.5px', color: 'var(--dim)', marginTop: '14px' }}>{p.read} · {p.date}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const p = POSTS.find(x => x.id === postId) || POSTS[0]
  return (
    <div className="page" style={{ maxWidth: '680px', margin: '0 auto', padding: '30px 28px 72px' }}>
      <button className="linkbtn" style={{ fontSize: '13.5px', color: 'var(--mut)', marginBottom: '24px' }} onClick={() => nav('/blog')}>← All articles</button>
      <div style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--acc)' }}>{p.cat}</div>
      <h1 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1.1, marginTop: '12px' }}>{p.title}</h1>
      <div className="mono" style={{ fontSize: '12.5px', color: 'var(--mut)', marginTop: '14px', paddingBottom: '24px', borderBottom: '1px solid var(--line)' }}>{p.read} · {p.date}</div>
      <div style={{ marginTop: '8px' }}>
        {(p.body || []).map((b, i) => (
          <div key={i}>
            {b.kind === 'p' && <p style={{ fontSize: '17px', lineHeight: 1.7, color: '#34465a', marginTop: '20px' }}>{b.text}</p>}
            {b.kind === 'h' && <h2 style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-.015em', marginTop: '32px' }}>{b.text}</h2>}
            {b.kind === 'quote' && <blockquote style={{ marginTop: '24px', padding: '4px 0 4px 22px', borderLeft: '3px solid var(--acc)', fontSize: '19px', lineHeight: 1.5, fontWeight: 500, color: 'var(--brand)' }}>{b.text}</blockquote>}
            {b.kind === 'list' && (
              <div style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '11px' }}>
                {b.items.map((t, j) => (
                  <div key={j} style={{ display: 'flex', gap: '13px', alignItems: 'baseline' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--acc)', flexShrink: 0, marginTop: '8px', display: 'block' }}></span>
                    <span style={{ fontSize: '16.5px', lineHeight: 1.6, color: '#34465a' }}>{t}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
