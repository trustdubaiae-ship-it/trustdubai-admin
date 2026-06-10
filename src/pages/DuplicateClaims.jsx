// trustdubai-admin/src/pages/DuplicateClaims.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

function truthy(v) {
  return v === true || v === 1 || v === 'true' || v === 't' || v === '1' || v === 'yes'
}
function fmtDate(s) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtDateTime(s) {
  if (!s) return '—'
  return new Date(s).toLocaleString('en-AE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/* friendly labels for the conflict reasons set by the DB guard */
const REASONS = {
  target_company_already_claimed: { t: 'Company already claimed', sev: 'high' },
  phone_matches_claimed_company:  { t: 'Phone matches a claimed company', sev: 'mid' },
  email_matches_claimed_company:  { t: 'Email matches a claimed company', sev: 'mid' },
  license_matches_existing_company: { t: 'Licence matches another company', sev: 'high' },
}
function reasonList(s) {
  if (!s) return []
  return String(s).split(',').map(x => x.trim()).filter(Boolean)
}

function Modal({ title, onClose, children, wide }) {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
      <div style={{ background: isDark ? '#1e293b' : '#fff', borderRadius: 16, padding: 24, width: wide ? 640 : 520, maxHeight: '90vh', overflowY: 'auto', border: '1px solid ' + (isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0') }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: isDark ? '#f1f5f9' : '#0f172a' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: isDark ? '#94a3b8' : '#64748b', lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function DuplicateClaims() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
  const [, forceUpdate] = useState(0)
  const [tab, setTab] = useState('claims')        // claims | companies
  const [claims, setClaims] = useState([])
  const [dupes, setDupes] = useState([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    fetchAll()
    const observer = new MutationObserver(() => forceUpdate(n => n + 1))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  async function fetchAll() {
    setLoading(true)
    // 1) conflict-flagged claim requests (set automatically by the DB guard)
    const { data: cr } = await supabase
      .from('claim_requests')
      .select('*')
      .eq('conflict', true)
      .order('created_at', { ascending: false })
      .range(0, 999)
    setClaims(cr || [])

    // 2) duplicate companies (same phone / licence / owner email) via RPC
    const { data: dc, error: dcErr } = await supabase.rpc('fn_duplicate_companies')
    if (dcErr) console.error('fn_duplicate_companies error:', dcErr)
    setDupes(dc || [])

    setLoading(false)
  }

  const text      = isDark ? '#f1f5f9' : '#0f172a'
  const textSub   = isDark ? '#94a3b8' : '#64748b'
  const textMuted = isDark ? '#475569' : '#94a3b8'
  const borderCol = isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'
  const cardBg    = isDark ? '#1e293b' : '#ffffff'
  const bgRow     = isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc'

  const initials = (name) => name?.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
  const avatarColors = ['#1a73e8', '#1e8e3e', '#d93025', '#f9a825', '#9c27b0', '#00897b']
  const avatarColor = (name) => avatarColors[(name?.charCodeAt(0) || 0) % avatarColors.length] || '#1a73e8'

  function reasonBadge(code) {
    const r = REASONS[code] || { t: code, sev: 'mid' }
    const high = r.sev === 'high'
    const color = high ? '#ef4444' : '#f59e0b'
    const bg = high ? (isDark ? 'rgba(239,68,68,0.16)' : '#fce8e6') : (isDark ? 'rgba(245,158,11,0.16)' : '#fffbeb')
    return (
      <span key={code} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: bg, color, fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 99 }}>
        <i className={'ti ' + (high ? 'ti-alert-triangle' : 'ti-alert-circle')} style={{ fontSize: 12 }} /> {r.t}
      </span>
    )
  }

  const matchMeta = {
    phone:       { t: 'Same phone',   icon: 'ti-phone',         color: '#f59e0b' },
    licence:     { t: 'Same licence', icon: 'ti-file-text',     color: '#ef4444' },
    owner_email: { t: 'Same owner email', icon: 'ti-mail',      color: '#a16207' },
  }

  const STAT_CARDS = [
    { key: 'claims',    label: 'Flagged Claims',     value: claims.length, color: '#ef4444', bg: isDark ? 'rgba(239,68,68,0.12)' : '#fce8e6', icon: 'ti-alert-triangle' },
    { key: 'companies', label: 'Duplicate Companies', value: dupes.length,  color: '#f59e0b', bg: isDark ? 'rgba(245,158,11,0.12)' : '#fffbeb', icon: 'ti-copy' },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: text }}>Duplicate Watch</h1>
        <p style={{ fontSize: 13, color: textSub, marginTop: 4 }}>
          Auto-detected duplicate &amp; ownership-conflict signals. Review before approving any claim.
        </p>
      </div>

      {/* Stat / tab cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 20 }}>
        {STAT_CARDS.map(s => {
          const active = tab === s.key
          return (
            <div key={s.key} onClick={() => setTab(s.key)}
              style={{
                background: active ? s.bg : cardBg,
                border: '2px solid ' + (active ? s.color : borderCol),
                borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.15s',
                boxShadow: active ? '0 4px 12px ' + s.color + '26' : 'none',
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = s.color } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = borderCol } }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 10, background: s.color + (isDark ? '26' : '1e'), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={'ti ' + s.icon} style={{ fontSize: 19, color: s.color }} />
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: active ? s.color : text, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 12, color: textSub, marginTop: 3 }}>{s.label}</div>
              </div>
            </div>
          )
        })}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ width: 36, height: 36, border: '3px solid #03C1F5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          <p style={{ color: textMuted, fontSize: 13 }}>Scanning for duplicates...</p>
        </div>
      ) : tab === 'claims' ? (
        claims.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <i className="ti ti-shield-check" style={{ fontSize: 48, color: '#1e8e3e', display: 'block', marginBottom: 12 }} />
            <p style={{ color: textMuted, fontSize: 14 }}>No conflicting claims. All clear.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {claims.map(r => (
              <div key={r.id} onClick={() => setDetail(r)}
                style={{ background: cardBg, border: '1px solid ' + borderCol, borderLeft: '3px solid #ef4444', borderRadius: 12, padding: 14, cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}
                onMouseEnter={e => { e.currentTarget.style.background = bgRow }}
                onMouseLeave={e => { e.currentTarget.style.background = cardBg }}
              >
                <div style={{ width: 42, height: 42, borderRadius: 10, background: avatarColor(r.company_name) + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: avatarColor(r.company_name), flexShrink: 0 }}>
                  {initials(r.company_name)}
                </div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: text }}>{r.company_name || '—'}</div>
                  <div style={{ fontSize: 12, color: textSub, marginTop: 2 }}>
                    <i className="ti ti-user" style={{ fontSize: 12 }} /> {r.contact_name || '—'} · {r.contact_email || '—'}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    {reasonList(r.conflict_reason).map(reasonBadge)}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: textMuted, minWidth: 90, textAlign: 'right' }}>{fmtDate(r.created_at)}</div>
              </div>
            ))}
          </div>
        )
      ) : (
        dupes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <i className="ti ti-shield-check" style={{ fontSize: 48, color: '#1e8e3e', display: 'block', marginBottom: 12 }} />
            <p style={{ color: textMuted, fontSize: 14 }}>No duplicate companies found.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {dupes.map((d, i) => {
              const m = matchMeta[d.match_type] || { t: d.match_type, icon: 'ti-copy', color: '#64748b' }
              return (
                <div key={i} style={{ background: cardBg, border: '1px solid ' + borderCol, borderLeft: '3px solid ' + m.color, borderRadius: 12, padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: m.color + (isDark ? '26' : '1e'), color: m.color, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99 }}>
                      <i className={'ti ' + m.icon} style={{ fontSize: 12 }} /> {m.t}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: text }}>{d.match_value}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', background: isDark ? 'rgba(239,68,68,0.14)' : '#fce8e6', padding: '2px 8px', borderRadius: 99 }}>{d.company_count} companies</span>
                  </div>
                  <div style={{ fontSize: 12, color: textSub, lineHeight: 1.7 }}>{d.companies}</div>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* claim detail modal */}
      {detail && (() => {
        const isDk = document.documentElement.getAttribute('data-theme') === 'dark'
        const t  = isDk ? '#f1f5f9' : '#0f172a'
        const ts = isDk ? '#94a3b8' : '#64748b'
        const bc = isDk ? 'rgba(255,255,255,0.08)' : '#e2e8f0'
        const row = (label, value) => value ? (
          <div style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid ' + bc }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: ts, minWidth: 130 }}>{label}</span>
            <span style={{ fontSize: 13, color: t, wordBreak: 'break-word' }}>{value}</span>
          </div>
        ) : null
        return (
          <Modal title={detail.company_name || 'Flagged claim'} onClose={() => setDetail(null)} wide>
            <div style={{ background: isDk ? 'rgba(239,68,68,0.1)' : '#fef2f2', border: '1px solid ' + (isDk ? 'rgba(239,68,68,0.25)' : '#fecaca'), borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', marginBottom: 8 }}>⚠ Why this was flagged</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{reasonList(detail.conflict_reason).map(reasonBadge)}</div>
            </div>
            <div style={{ marginBottom: 16 }}>
              {row('Contact name', detail.contact_name)}
              {row('Email', detail.contact_email)}
              {row('Phone', detail.contact_phone)}
              {row('Trade licence no.', detail.tl_number)}
              {row('Linked company id', detail.company_id || '⚠️ none')}
              {row('Phone verified', truthy(detail.last4_verified) ? 'Yes' : 'No')}
              {row('Submitted', fmtDateTime(detail.created_at))}
              {detail.message && (
                <div style={{ padding: '10px 0' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: ts, display: 'block', marginBottom: 4 }}>Message</span>
                  <span style={{ fontSize: 13, color: t, lineHeight: 1.6 }}>{detail.message}</span>
                </div>
              )}
            </div>
            <p style={{ fontSize: 12, color: ts, lineHeight: 1.6, marginBottom: 16 }}>
              Open this request in <strong>Claim Requests</strong> to approve or reject. Approving a claim on an already-claimed company is blocked automatically to prevent hijacking.
            </p>
            <button onClick={() => setDetail(null)} style={{ width: '100%', padding: 11, background: 'transparent', color: ts, border: '1px solid ' + bc, borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Close</button>
          </Modal>
        )
      })()}
    </div>
  )
}
