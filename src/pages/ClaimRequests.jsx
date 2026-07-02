import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

/* Robust boolean parse — DB columns may be boolean OR text ("true"/"false") */
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

function statusStyle(status, isDark) {
  if (status === 'approved') return { color: '#1e8e3e', bg: isDark ? 'rgba(30,142,62,0.2)' : '#e6f4ea', label: 'Approved' }
  if (status === 'rejected') return { color: '#ef4444', bg: isDark ? 'rgba(239,68,68,0.18)' : '#fce8e6', label: 'Rejected' }
  return { color: '#92400e', bg: isDark ? 'rgba(232,184,75,0.2)' : '#fef9ed', label: 'Pending' }
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

// Required before an admin can approve a real company claim. Admin CALLS the
// registered number, asks the verification questions, then ticks each box.
const VCHECK_ITEMS = [
  { key: 'called',   label: 'Called the registered number & reached the business' },
  { key: 'answered', label: 'Caller answered the verification questions correctly' },
  { key: 'tl_match', label: 'Trade licence matches the company (name + number)' },
]

export default function ClaimRequests({ theme, adminData } = {}) {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
  const [, forceUpdate] = useState(0)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('pending')   // pending | approved | rejected | all
  const [kindTab, setKindTab] = useState('all')                 // all | claim | support
  const [search, setSearch] = useState('')
  const [detail, setDetail] = useState(null)
  const [busy, setBusy] = useState(false)
  // per-open verification state
  const [vchecks, setVchecks] = useState({})
  const [vnotes, setVnotes] = useState('')
  const [companyRef, setCompanyRef] = useState(null)   // linked company's on-file data (the "answers")

  // Open a request: load its saved verification + the linked company's real details to verify against
  async function openDetail(r) {
    setDetail(r)
    setVchecks(r.verify_checklist || {})
    setVnotes(r.verify_notes || '')
    setCompanyRef(null)
    if (r.company_id) {
      const { data } = await supabase
        .from('companies')
        .select('name, phone, location, category, trade_license_number, owner_email, claimed')
        .eq('id', r.company_id).maybeSingle()
      setCompanyRef(data || null)
    }
  }

  useEffect(() => {
    fetchAll()
    const observer = new MutationObserver(() => forceUpdate(n => n + 1))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  async function fetchAll() {
    setLoading(true)
    const { data, error } = await supabase
      .from('claim_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .range(0, 1999)
    if (error) console.error('claim_requests fetch error:', error)
    setRows(data || [])
    setLoading(false)
  }

  // Open trade licence — private bucket via signed URL, fallback to public URL
  async function openTL(path) {
    if (!path) return
    try {
      const { data, error } = await supabase.storage.from('trade-licenses').createSignedUrl(path, 3600)
      if (!error && data?.signedUrl) { window.open(data.signedUrl, '_blank'); return }
    } catch (e) {}
    try {
      const { data } = supabase.storage.from('trade-licenses').getPublicUrl(path)
      if (data?.publicUrl) { window.open(data.publicUrl, '_blank'); return }
    } catch (e) {}
    alert('Could not open the trade licence file.')
  }

  async function approve(req) {
    // Gate: a real company claim can't be approved until the admin has called &
    // verified. (Support requests / no linked company skip the checklist.)
    const needsVerify = !!req.company_id
    if (needsVerify && !VCHECK_ITEMS.every(i => vchecks[i.key])) {
      alert('Please complete all verification steps first — call the registered number and tick each check.')
      return
    }
    setBusy(true)
    if (req.company_id) {
      // Anti-hijack: re-check the company isn't ALREADY claimed by someone else.
      const { data: cnow } = await supabase.from('companies').select('claimed, owner_email').eq('id', req.company_id).maybeSingle()
      if (cnow?.claimed) {
        setBusy(false)
        alert('⚠ This company is already claimed' + (cnow.owner_email ? ' by ' + cnow.owner_email : '') + '.\nCannot approve a second claim (possible hijack). Reject it if it is not legitimate.')
        return
      }
      // Promote the listed company to a claimed, owner-linked, license-verified profile
      // that can RECEIVE leads (accepting_leads) and is no longer "claim bait".
      await supabase.from('companies').update({
        claimed: true,
        owner_email: (req.contact_email || '').toLowerCase(),
        verification_level: 'license',
        accepting_leads: true,
      }).eq('id', req.company_id)
    }
    await supabase.from('claim_requests').update({
      status: 'approved',
      verify_checklist: needsVerify ? vchecks : null,
      verify_notes: vnotes || null,
      verified_by_name: adminData?.full_name || 'Admin',
      verified_at: new Date().toISOString(),
    }).eq('id', req.id)
    setBusy(false); setDetail(null); fetchAll()
    alert(req.company_id
      ? '✅ Approved. Company is now Claimed, License-Verified & receiving leads.'
      : '✅ Approved. No linked company — please add/assign manually if needed.')
  }

  async function reject(req) {
    if (!confirm('Reject this request? The applicant will not gain access.')) return
    setBusy(true)
    await supabase.from('claim_requests').update({ status: 'rejected' }).eq('id', req.id)
    setBusy(false); setDetail(null); fetchAll()
  }

  async function reopen(req) {
    setBusy(true)
    await supabase.from('claim_requests').update({ status: 'pending' }).eq('id', req.id)
    setBusy(false); setDetail(null); fetchAll()
  }

  /* counts */
  const counts = {
    pending:  rows.filter(r => (r.status || 'pending') === 'pending').length,
    approved: rows.filter(r => r.status === 'approved').length,
    rejected: rows.filter(r => r.status === 'rejected').length,
    all:      rows.length,
  }

  /* filter pipeline */
  let list = rows
  if (statusFilter !== 'all') list = list.filter(r => (r.status || 'pending') === statusFilter)
  if (kindTab !== 'all')      list = list.filter(r => (r.kind || 'claim') === kindTab)
  if (search) {
    const q = search.toLowerCase()
    list = list.filter(r =>
      r.company_name?.toLowerCase().includes(q) ||
      r.contact_name?.toLowerCase().includes(q) ||
      r.contact_email?.toLowerCase().includes(q) ||
      r.contact_phone?.toLowerCase().includes(q)
    )
  }

  const kindCounts = {
    all:     (statusFilter === 'all' ? rows : rows.filter(r => (r.status || 'pending') === statusFilter)).length,
    claim:   (statusFilter === 'all' ? rows : rows.filter(r => (r.status || 'pending') === statusFilter)).filter(r => (r.kind || 'claim') === 'claim').length,
    support: (statusFilter === 'all' ? rows : rows.filter(r => (r.status || 'pending') === statusFilter)).filter(r => (r.kind || 'claim') === 'support').length,
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

  const STAT_CARDS = [
    { key: 'pending',  label: 'Pending',  color: '#f59e0b', bg: isDark ? 'rgba(245,158,11,0.12)' : '#fffbeb', icon: 'ti-clock' },
    { key: 'approved', label: 'Approved', color: '#1e8e3e', bg: isDark ? 'rgba(30,142,62,0.12)'  : '#e6f4ea', icon: 'ti-discount-check' },
    { key: 'rejected', label: 'Rejected', color: '#ef4444', bg: isDark ? 'rgba(239,68,68,0.12)'  : '#fce8e6', icon: 'ti-x' },
    { key: 'all',      label: 'All',      color: '#03C1F5', bg: isDark ? 'rgba(3,193,245,0.12)'  : '#e0f9ff', icon: 'ti-list' },
  ]

  const KIND_TABS = [
    { id: 'all',     label: 'All',           count: kindCounts.all },
    { id: 'claim',   label: 'Claims',        count: kindCounts.claim },
    { id: 'support', label: 'Support / Help', count: kindCounts.support },
  ]

  function kindBadge(kind) {
    if ((kind || 'claim') === 'support') return { t: 'Support', color: '#a16207', bg: isDark ? 'rgba(161,98,7,0.2)' : '#fef9c3', icon: 'ti-headset' }
    return { t: 'Claim', color: '#1d4ed8', bg: isDark ? 'rgba(29,78,216,0.18)' : '#dbeafe', icon: 'ti-discount-check' }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: text }}>Claim Requests</h1>
        <p style={{ fontSize: 13, color: textSub, marginTop: 4 }}>
          Business owners claiming their listed profiles · {list.length} shown
        </p>
      </div>

      {/* Stat / status filter cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
        {STAT_CARDS.map(s => {
          const active = statusFilter === s.key
          return (
            <div key={s.key} onClick={() => setStatusFilter(s.key)}
              style={{
                background: active ? s.bg : cardBg,
                border: '2px solid ' + (active ? s.color : borderCol),
                borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.15s',
                boxShadow: active ? '0 4px 12px ' + s.color + '26' : 'none',
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = s.color; e.currentTarget.style.transform = 'translateY(-1px)' } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = borderCol; e.currentTarget.style.transform = 'none' } }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 10, background: s.color + (isDark ? '26' : '1e'), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={'ti ' + s.icon} style={{ fontSize: 19, color: s.color }} />
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: active ? s.color : text, lineHeight: 1 }}>{counts[s.key]}</div>
                <div style={{ fontSize: 12, color: textSub, marginTop: 3 }}>{s.label}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Search */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search company, name, email, phone..."
          style={{ flex: 1, padding: '8px 12px', border: '1px solid ' + borderCol, borderRadius: 8, fontSize: 13, background: cardBg, color: text, outline: 'none' }}
        />
      </div>

      {/* Kind sub-tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid ' + borderCol, flexWrap: 'wrap' }}>
        {KIND_TABS.map(t => (
          <button key={t.id} onClick={() => setKindTab(t.id)} style={{ padding: '10px 20px', border: 'none', background: 'none', borderBottom: kindTab === t.id ? '2px solid #03C1F5' : '2px solid transparent', color: kindTab === t.id ? '#03C1F5' : textSub, fontWeight: 500, fontSize: 13, cursor: 'pointer' }}>
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ width: 36, height: 36, border: '3px solid #03C1F5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          <p style={{ color: textMuted, fontSize: 13 }}>Loading requests...</p>
        </div>
      ) : list.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <i className="ti ti-inbox" style={{ fontSize: 48, color: textMuted, display: 'block', marginBottom: 12 }} />
          <p style={{ color: textMuted, fontSize: 14 }}>No requests here</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map(r => {
            const ss = statusStyle(r.status, isDark)
            const kb = kindBadge(r.kind)
            return (
              <div key={r.id} onClick={() => openDetail(r)}
                style={{ background: cardBg, border: '1px solid ' + borderCol, borderRadius: 12, padding: 14, cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}
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
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: kb.bg, color: kb.color, fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 99 }}>
                    <i className={'ti ' + kb.icon} style={{ fontSize: 12 }} /> {kb.t}
                  </span>
                  {truthy(r.last4_verified)
                    ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: isDark ? 'rgba(30,142,62,0.18)' : '#e6f4ea', color: '#1e8e3e', fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 99 }}><i className="ti ti-phone-check" style={{ fontSize: 12 }} /> Phone OK</span>
                    : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: isDark ? 'rgba(148,163,184,0.18)' : '#f1f5f9', color: textSub, fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 99 }}><i className="ti ti-phone-off" style={{ fontSize: 12 }} /> Unverified</span>}
                  {r.tl_url && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: isDark ? 'rgba(3,193,245,0.12)' : '#e0f9ff', color: '#03C1F5', fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 99 }}><i className="ti ti-file-text" style={{ fontSize: 12 }} /> TL</span>}
                  <span style={{ background: ss.bg, color: ss.color, fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 99 }}>{ss.label}</span>
                </div>
                <div style={{ fontSize: 11, color: textMuted, minWidth: 90, textAlign: 'right' }}>{fmtDate(r.created_at)}</div>
              </div>
            )
          })}
        </div>
      )}

      {/* Detail modal */}
      {detail && (() => {
        const ss = statusStyle(detail.status, isDark)
        const kb = kindBadge(detail.kind)
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
        const status = detail.status || 'pending'
        const needsVerify = status === 'pending' && !!detail.company_id
        const allChecked = VCHECK_ITEMS.every(i => vchecks[i.key])
        const callNumber = companyRef?.phone || detail.contact_phone || ''
        const QA = [
          ['Trade licence number', companyRef?.trade_license_number || detail.tl_number],
          ['Registered area / location', companyRef?.location],
          ['Business category', companyRef?.category],
          ['Owner email on file', companyRef?.owner_email],
        ].filter(x => x[1])
        return (
          <Modal title={detail.company_name || 'Request'} onClose={() => setDetail(null)} wide>
            {/* header strip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, padding: 16, background: isDk ? 'rgba(255,255,255,0.03)' : '#f8fafc', borderRadius: 12 }}>
              <div style={{ width: 54, height: 54, borderRadius: 12, background: avatarColor(detail.company_name) + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: avatarColor(detail.company_name), flexShrink: 0 }}>
                {initials(detail.company_name)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: t }}>{detail.company_name || '—'}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: kb.bg, color: kb.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99 }}>
                    <i className={'ti ' + kb.icon} style={{ fontSize: 12 }} /> {kb.t}
                  </span>
                  <span style={{ background: ss.bg, color: ss.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99 }}>{ss.label}</span>
                  {truthy(detail.last4_verified)
                    ? <span style={{ background: isDk ? 'rgba(30,142,62,0.18)' : '#e6f4ea', color: '#1e8e3e', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99 }}>✓ Phone verified</span>
                    : <span style={{ background: isDk ? 'rgba(148,163,184,0.18)' : '#f1f5f9', color: ts, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99 }}>Phone not verified</span>}
                </div>
              </div>
            </div>

            {/* details */}
            <div style={{ marginBottom: 16 }}>
              {row('Contact name', detail.contact_name)}
              {row('Email', detail.contact_email)}
              {row('Phone', detail.contact_phone)}
              {row('Trade licence no.', detail.tl_number)}
              {row('TL expiry', detail.tl_expiry ? fmtDate(detail.tl_expiry) : null)}
              {row('Linked company', detail.company_id ? detail.company_id : '⚠️ No linked company (manual handling)')}
              {row('Submitted', fmtDateTime(detail.created_at))}
              {row('Verified by', detail.verified_by_name)}
              {row('Verified at', detail.verified_at ? fmtDateTime(detail.verified_at) : null)}
              {row('Verify notes', detail.verify_notes)}
              {detail.message && (
                <div style={{ padding: '10px 0', borderBottom: '1px solid ' + bc }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: ts, display: 'block', marginBottom: 4 }}>Message</span>
                  <span style={{ fontSize: 13, color: t, lineHeight: 1.6 }}>{detail.message}</span>
                </div>
              )}
            </div>

            {/* trade licence */}
            {detail.tl_url && (
              <button onClick={() => openTL(detail.tl_url)} style={{ width: '100%', padding: 11, marginBottom: 16, background: isDk ? 'rgba(3,193,245,0.12)' : '#e0f9ff', color: '#03C1F5', border: '1px solid ' + (isDk ? 'rgba(3,193,245,0.3)' : '#bae6fd'), borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <i className="ti ti-file-text" style={{ fontSize: 16 }} /> View Trade Licence
              </button>
            )}

            {/* verification gate — admin must call & verify before approving a real claim */}
            {needsVerify && (
              <div style={{ background: isDk ? 'rgba(245,158,11,0.08)' : '#fffbeb', border: '1px solid ' + (isDk ? 'rgba(245,158,11,0.3)' : '#fde68a'), borderRadius: 12, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t, marginBottom: 4 }}>
                  <i className="ti ti-phone-check" style={{ color: '#f59e0b' }} /> Verify ownership before approving
                </div>
                <p style={{ fontSize: 12, color: ts, marginBottom: 12, lineHeight: 1.6 }}>
                  Call the company's <strong>registered number</strong> and confirm the answers below match. Approve is locked until all steps are checked.
                </p>

                {/* number to call */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: isDk ? 'rgba(255,255,255,0.04)' : '#fff', border: '1px solid ' + bc, borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
                  <i className="ti ti-phone" style={{ fontSize: 18, color: '#1e8e3e' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: ts }}>Registered number — call this</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: t, letterSpacing: 0.3 }}>{callNumber || '⚠️ no number on file'}</div>
                  </div>
                  {callNumber && <a href={'tel:' + callNumber.replace(/\s/g, '')} style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: '#1e8e3e', padding: '7px 12px', borderRadius: 8, textDecoration: 'none' }}>Call</a>}
                </div>

                {/* verification questions with on-file answers */}
                {QA.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: ts, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Ask the caller — must match on-file:</div>
                    {QA.map(([q, a]) => (
                      <div key={q} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '6px 0', borderBottom: '1px dashed ' + bc, fontSize: 12.5 }}>
                        <span style={{ color: ts }}>{q}?</span>
                        <span style={{ color: t, fontWeight: 600, textAlign: 'right', wordBreak: 'break-word' }}>{a}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* checklist */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                  {VCHECK_ITEMS.map(item => (
                    <label key={item.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: t, cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!vchecks[item.key]} onChange={e => setVchecks(v => ({ ...v, [item.key]: e.target.checked }))} style={{ marginTop: 2, width: 15, height: 15, cursor: 'pointer', accentColor: '#1e8e3e' }} />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>

                {/* notes */}
                <textarea value={vnotes} onChange={e => setVnotes(e.target.value)} placeholder="Notes — who you spoke to, anything unusual…"
                  style={{ width: '100%', boxSizing: 'border-box', minHeight: 52, resize: 'vertical', padding: '8px 10px', fontSize: 12.5, border: '1px solid ' + bc, borderRadius: 8, background: isDk ? 'rgba(255,255,255,0.04)' : '#fff', color: t, outline: 'none', fontFamily: 'inherit' }} />

                {!allChecked && <p style={{ fontSize: 11, color: '#ef4444', marginTop: 8 }}>⚠ Complete all checks above to enable Approve.</p>}
              </div>
            )}

            {/* actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              {status === 'pending' && (
                <>
                  <button onClick={() => approve(detail)} disabled={busy || (needsVerify && !allChecked)} style={{ flex: 1, padding: 11, background: (busy || (needsVerify && !allChecked)) ? '#94a3b8' : '#1e8e3e', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: (busy || (needsVerify && !allChecked)) ? 'not-allowed' : 'pointer' }}>
                    {busy ? 'Working…' : '✓ Approve Claim'}
                  </button>
                  <button onClick={() => reject(detail)} disabled={busy} style={{ flex: 1, padding: 11, background: isDk ? 'rgba(239,68,68,0.12)' : '#fce8e6', color: '#ef4444', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer' }}>
                    ✕ Reject
                  </button>
                </>
              )}
              {status !== 'pending' && (
                <button onClick={() => reopen(detail)} disabled={busy} style={{ flex: 1, padding: 11, background: isDk ? 'rgba(245,158,11,0.12)' : '#fffbeb', color: '#f59e0b', border: '1px solid ' + (isDk ? 'rgba(245,158,11,0.3)' : '#fde68a'), borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer' }}>
                  ↩ Reopen (set Pending)
                </button>
              )}
              <button onClick={() => setDetail(null)} style={{ padding: '11px 18px', background: 'transparent', color: ts, border: '1px solid ' + bc, borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Close</button>
            </div>

            {status === 'pending' && (
              <p style={{ fontSize: 11, color: isDk ? '#475569' : '#94a3b8', marginTop: 10, lineHeight: 1.6, textAlign: 'center' }}>
                Approving sets the company to <strong>Claimed</strong> + <strong>License-Verified</strong>, links <strong>{detail.contact_email || 'the owner'}</strong> as owner, and turns on <strong>lead receiving</strong>.
              </p>
            )}
          </Modal>
        )
      })()}
    </div>
  )
}
