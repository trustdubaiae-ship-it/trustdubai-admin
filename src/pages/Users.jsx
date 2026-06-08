import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

/* ============================== helpers ============================== */
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtDateTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-AE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function timeAgo(d) {
  if (!d) return ''
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60); if (m < 60) return m + ' min ago'
  const h = Math.floor(m / 60); if (h < 24) return h + ' hr ago'
  const days = Math.floor(h / 24); if (days < 30) return days + 'd ago'
  const mo = Math.floor(days / 30); if (mo < 12) return mo + 'mo ago'
  return Math.floor(mo / 12) + 'y ago'
}

function Modal({ title, onClose, children, wide }) {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
      <div style={{ background: isDark ? '#1e293b' : '#fff', borderRadius: 16, padding: 24, width: wide ? 720 : 520, maxHeight: '90vh', overflowY: 'auto', border: '1px solid ' + (isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0') }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18, alignItems: 'center', position: 'sticky', top: 0 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: isDark ? '#f1f5f9' : '#0f172a' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: isDark ? '#94a3b8' : '#64748b', lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function Users() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
  const [, forceUpdate] = useState(0)
  const [loading, setLoading] = useState(true)
  const [customers, setCustomers] = useState([])
  const [total, setTotal] = useState(0)
  const [revCount, setRevCount] = useState({})
  const [leadCount, setLeadCount] = useState({})
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState('list')

  // detail (360° history)
  const [detailC, setDetailC] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [history, setHistory] = useState({ reviews: [], leads: [], likes: [], teamRatings: [], chats: [] })

  useEffect(() => {
    fetchAll()
    const observer = new MutationObserver(() => forceUpdate(n => n + 1))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  async function fetchAll() {
    setLoading(true)
    try {
      const [{ count: cTotal }, { data: custRows }, { data: revRows }, { data: leadRows }] = await Promise.all([
        supabase.from('customers').select('*', { count: 'exact', head: true }),
        supabase.from('customers').select('*').order('created_at', { ascending: false }).range(0, 1999),
        supabase.from('reviews').select('id,customer_id,reviewer_email').range(0, 4999),
        supabase.from('lead_submissions').select('id,customer_id,email').range(0, 4999),
      ])
      setTotal(cTotal || 0)
      const custs = custRows || []
      setCustomers(custs)

      // build per-customer counts (match by customer_id, fallback email)
      const rc = {}, lc = {}
      const byId = {}, byEmail = {}
      custs.forEach(c => { byId[c.id] = c; if (c.email) byEmail[c.email.toLowerCase()] = c })
      ;(revRows || []).forEach(r => {
        const cust = byId[r.customer_id] || (r.reviewer_email ? byEmail[r.reviewer_email.toLowerCase()] : null)
        if (cust) rc[cust.id] = (rc[cust.id] || 0) + 1
      })
      ;(leadRows || []).forEach(l => {
        const cust = byId[l.customer_id] || (l.email ? byEmail[l.email.toLowerCase()] : null)
        if (cust) lc[cust.id] = (lc[cust.id] || 0) + 1
      })
      setRevCount(rc); setLeadCount(lc)
    } catch (e) { console.error('Users fetch error:', e) }
    finally { setLoading(false) }
  }

  async function openDetail(c) {
    setDetailC(c)
    setDetailLoading(true)
    setHistory({ reviews: [], leads: [], likes: [], teamRatings: [], chats: [] })
    const id = c.id, email = (c.email || '').toLowerCase()
    try {
      const [rev, leads, likes, tr, chats] = await Promise.all([
        supabase.from('reviews').select('*, companies(name,category)')
          .or(email ? `customer_id.eq.${id},reviewer_email.eq.${email}` : `customer_id.eq.${id}`)
          .order('created_at', { ascending: false }),
        supabase.from('lead_submissions').select('*')
          .or(email ? `customer_id.eq.${id},email.eq.${email}` : `customer_id.eq.${id}`)
          .order('created_at', { ascending: false }),
        supabase.from('portfolio_likes').select('*').eq('customer_id', id).order('created_at', { ascending: false }),
        supabase.from('team_ratings').select('*').eq('customer_id', id).order('created_at', { ascending: false }),
        supabase.from('lead_chat').select('*').eq('customer_id', id).order('created_at', { ascending: false }),
      ])
      setHistory({
        reviews: rev.data || [],
        leads: leads.data || [],
        likes: likes.data || [],
        teamRatings: tr.data || [],
        chats: chats.data || [],
      })
    } catch (e) { console.error('History fetch error:', e) }
    finally { setDetailLoading(false) }
  }

  /* ---------- theme ---------- */
  const text      = isDark ? '#f1f5f9' : '#0f172a'
  const textSub   = isDark ? '#94a3b8' : '#64748b'
  const textMuted = isDark ? '#475569' : '#94a3b8'
  const borderCol = isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'
  const cardBg    = isDark ? '#1e293b' : '#ffffff'
  const bgRow     = isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc'

  const initials = (n) => (n || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  const avatarColors = ['#1a73e8', '#1e8e3e', '#d93025', '#f9a825', '#9c27b0', '#00897b']
  const avatarColor = (n) => avatarColors[(n || '?').charCodeAt(0) % avatarColors.length]

  /* ---------- filtering + stats ---------- */
  let list = customers
  if (search) {
    const q = search.toLowerCase()
    list = list.filter(c =>
      c.full_name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q) ||
      c.area?.toLowerCase().includes(q)
    )
  }

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
  const withPhone = customers.filter(c => c.phone && c.phone.trim()).length
  const newThisMonth = customers.filter(c => new Date(c.created_at).getTime() >= monthStart).length
  const withReviews = Object.keys(revCount).length

  const STATS = [
    { label: 'Total Users', value: total,         icon: 'ti-users',     color: '#03C1F5' },
    { label: 'With Phone',  value: withPhone,     icon: 'ti-phone',     color: '#1e8e3e' },
    { label: 'New (month)', value: newThisMonth,  icon: 'ti-user-plus', color: '#8b5cf6' },
    { label: 'Reviewers',   value: withReviews,   icon: 'ti-star',      color: '#f59e0b' },
  ]

  /* ---------- answers (lead) renderer ---------- */
  function renderAnswers(answers) {
    if (!answers || typeof answers !== 'object') return null
    const entries = Object.entries(answers).filter(([k]) => k !== '_area')
    if (!entries.length) return null
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
        {entries.map(([k, v]) => (
          <div key={k} style={{ fontSize: 11.5, color: textSub }}>
            <span style={{ fontWeight: 600 }}>{k}:</span> <span style={{ color: text }}>{Array.isArray(v) ? v.join(', ') : String(v)}</span>
          </div>
        ))}
      </div>
    )
  }

  const sectionTitle = (icon, label, count, color) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '18px 0 10px' }}>
      <i className={'ti ' + icon} style={{ fontSize: 16, color }} />
      <span style={{ fontSize: 13, fontWeight: 700, color: text }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color, background: color + (isDark ? '22' : '1e'), padding: '1px 8px', borderRadius: 99 }}>{count}</span>
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: text }}>Customers</h1>
          <p style={{ fontSize: 13, color: textSub, marginTop: 4 }}>All registered users · full activity history · {list.length} shown</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', background: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9', borderRadius: 8, padding: 3, border: '1px solid ' + borderCol }}>
            {[{ id: 'list', icon: 'ti-list' }, { id: 'card', icon: 'ti-layout-grid' }].map(v => (
              <button key={v.id} onClick={() => setViewMode(v.id)} style={{ width: 32, height: 32, border: 'none', borderRadius: 6, cursor: 'pointer', background: viewMode === v.id ? (isDark ? '#334155' : '#fff') : 'transparent', color: viewMode === v.id ? '#03C1F5' : textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className={'ti ' + v.icon} style={{ fontSize: 15 }} />
              </button>
            ))}
          </div>
          <button onClick={fetchAll} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#03C1F5', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            <i className="ti ti-refresh" style={{ fontSize: 14 }} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
        {STATS.map(s => (
          <div key={s.label} style={{ background: cardBg, border: '1px solid ' + borderCol, borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: s.color + (isDark ? '22' : '1e'), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className={'ti ' + s.icon} style={{ fontSize: 18, color: s.color }} />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: text, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: textSub, marginTop: 3 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, phone, area..."
          style={{ width: '100%', padding: '9px 12px', border: '1px solid ' + borderCol, borderRadius: 8, fontSize: 13, background: cardBg, color: text, outline: 'none', boxSizing: 'border-box' }} />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ width: 36, height: 36, border: '3px solid #03C1F5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          <p style={{ color: textMuted, fontSize: 13 }}>Loading customers...</p>
        </div>
      ) : list.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <i className="ti ti-users-off" style={{ fontSize: 48, color: textMuted, display: 'block', marginBottom: 12 }} />
          <p style={{ color: textMuted, fontSize: 14 }}>No customers found</p>
        </div>
      ) : viewMode === 'list' ? (
        <div style={{ background: cardBg, border: '1px solid ' + borderCol, borderRadius: 12, overflow: 'hidden', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr style={{ background: bgRow }}>
                {['Customer', 'Phone', 'Area', 'Reviews', 'Leads', 'Joined', ''].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: textSub, borderBottom: '1px solid ' + borderCol, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map(c => (
                <tr key={c.id} onClick={() => openDetail(c)} style={{ borderBottom: '1px solid ' + borderCol, cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = bgRow}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {c.avatar_url
                        ? <img src={c.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        : <div style={{ width: 36, height: 36, borderRadius: '50%', background: avatarColor(c.full_name || c.email) + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: avatarColor(c.full_name || c.email), flexShrink: 0 }}>{initials(c.full_name || c.email)}</div>}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: text }}>{c.full_name || '—'}</div>
                        <div style={{ fontSize: 11, color: textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{c.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: textSub, whiteSpace: 'nowrap' }}>{c.phone || '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: textSub }}>{c.area || '—'}</td>
                  <td style={{ padding: '12px 16px' }}><span style={{ fontSize: 12, fontWeight: 700, color: revCount[c.id] ? '#f59e0b' : textMuted }}>{revCount[c.id] || 0}</span></td>
                  <td style={{ padding: '12px 16px' }}><span style={{ fontSize: 12, fontWeight: 700, color: leadCount[c.id] ? '#03C1F5' : textMuted }}>{leadCount[c.id] || 0}</span></td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: textMuted, whiteSpace: 'nowrap' }}>{fmtDate(c.created_at)}</td>
                  <td style={{ padding: '12px 16px' }}><i className="ti ti-chevron-right" style={{ fontSize: 16, color: textMuted }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {list.map(c => (
            <div key={c.id} onClick={() => openDetail(c)} style={{ background: cardBg, border: '1px solid ' + borderCol, borderRadius: 14, padding: 16, cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = isDark ? '0 8px 24px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.08)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                {c.avatar_url
                  ? <img src={c.avatar_url} alt="" style={{ width: 46, height: 46, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  : <div style={{ width: 46, height: 46, borderRadius: '50%', background: avatarColor(c.full_name || c.email) + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: avatarColor(c.full_name || c.email), flexShrink: 0 }}>{initials(c.full_name || c.email)}</div>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.full_name || '—'}</div>
                  <div style={{ fontSize: 11, color: textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                {c.area && <span style={{ fontSize: 11, background: bgRow, color: textSub, padding: '2px 8px', borderRadius: 8 }}>📍 {c.area}</span>}
                <span style={{ fontSize: 11, background: isDark ? 'rgba(245,158,11,0.15)' : '#fffbeb', color: '#f59e0b', padding: '2px 8px', borderRadius: 8 }}>★ {revCount[c.id] || 0} reviews</span>
                <span style={{ fontSize: 11, background: isDark ? 'rgba(3,193,245,0.12)' : '#e0f9ff', color: '#03C1F5', padding: '2px 8px', borderRadius: 8 }}>📨 {leadCount[c.id] || 0} leads</span>
              </div>
              <div style={{ fontSize: 11, color: textMuted }}>Joined {fmtDate(c.created_at)}</div>
            </div>
          ))}
        </div>
      )}

      {/* ============== 360° CUSTOMER DETAIL ============== */}
      {detailC && (
        <Modal title={detailC.full_name || detailC.email} onClose={() => setDetailC(null)} wide>
          {/* Profile header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8, padding: 16, background: bgRow, borderRadius: 12 }}>
            {detailC.avatar_url
              ? <img src={detailC.avatar_url} alt="" style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              : <div style={{ width: 60, height: 60, borderRadius: '50%', background: avatarColor(detailC.full_name || detailC.email) + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: avatarColor(detailC.full_name || detailC.email), flexShrink: 0 }}>{initials(detailC.full_name || detailC.email)}</div>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: text }}>{detailC.full_name || '—'}</div>
              <div style={{ fontSize: 13, color: textSub, marginTop: 2 }}>{detailC.email}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {detailC.area && <span style={{ fontSize: 11, background: cardBg, border: '1px solid ' + borderCol, color: textSub, padding: '3px 10px', borderRadius: 99 }}>📍 {detailC.area}</span>}
                {detailC.nationality && <span style={{ fontSize: 11, background: cardBg, border: '1px solid ' + borderCol, color: textSub, padding: '3px 10px', borderRadius: 99 }}>{detailC.nationality}</span>}
                {detailC.gender && <span style={{ fontSize: 11, background: cardBg, border: '1px solid ' + borderCol, color: textSub, padding: '3px 10px', borderRadius: 99 }}>{detailC.gender}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              {detailC.phone && <a href={'https://wa.me/' + detailC.phone.replace(/[^0-9]/g, '')} target="_blank" rel="noreferrer" style={{ width: 36, height: 36, borderRadius: 9, background: isDark ? 'rgba(30,142,62,0.15)' : '#e6f4ea', color: '#1e8e3e', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}><i className="ti ti-brand-whatsapp" style={{ fontSize: 17 }} /></a>}
              <a href={'mailto:' + detailC.email} style={{ width: 36, height: 36, borderRadius: 9, background: isDark ? 'rgba(3,193,245,0.12)' : '#e0f9ff', color: '#03C1F5', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}><i className="ti ti-mail" style={{ fontSize: 17 }} /></a>
            </div>
          </div>

          {/* Contact + meta grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 4 }}>
            {[
              ['Phone', detailC.phone || '—'],
              ['Area', detailC.area || '—'],
              ['Nationality', detailC.nationality || '—'],
              ['Gender', detailC.gender || '—'],
              ['Joined', fmtDate(detailC.created_at)],
              ['Last login', detailC.last_login ? fmtDateTime(detailC.last_login) : '—'],
            ].map(([k, v]) => (
              <div key={k} style={{ background: bgRow, borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ fontSize: 10.5, color: textMuted, marginBottom: 2 }}>{k}</div>
                <div style={{ fontSize: 13, color: text, fontWeight: 500, wordBreak: 'break-word' }}>{v}</div>
              </div>
            ))}
          </div>

          {detailLoading ? (
            <div style={{ textAlign: 'center', padding: 30 }}>
              <div style={{ width: 28, height: 28, border: '3px solid #03C1F5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 8px' }} />
              <p style={{ color: textMuted, fontSize: 12 }}>Loading history...</p>
            </div>
          ) : (
            <>
              {/* REVIEWS */}
              {sectionTitle('ti-star', 'Reviews Given', history.reviews.length, '#f59e0b')}
              {history.reviews.length === 0 ? (
                <div style={{ fontSize: 12, color: textMuted, padding: '4px 2px' }}>No reviews yet.</div>
              ) : history.reviews.map(r => (
                <div key={r.id} style={{ background: bgRow, borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: text }}>{r.companies?.name || 'Company'}</span>
                    <span style={{ color: '#f59e0b', fontSize: 12 }}>{'★'.repeat(r.rating || 0)}<span style={{ color: textMuted }}>{'★'.repeat(Math.max(0, 5 - (r.rating || 0)))}</span></span>
                  </div>
                  {r.review_text && <div style={{ fontSize: 12, color: textSub, marginTop: 4, lineHeight: 1.5 }}>{r.review_text}</div>}
                  <div style={{ fontSize: 10.5, color: textMuted, marginTop: 5 }}>{r.companies?.category ? r.companies.category + ' · ' : ''}{fmtDate(r.created_at)}{r.is_approved === false ? ' · ⏳ pending approval' : ''}</div>
                </div>
              ))}

              {/* LEADS */}
              {sectionTitle('ti-address-book', 'Quote Requests', history.leads.length, '#03C1F5')}
              {history.leads.length === 0 ? (
                <div style={{ fontSize: 12, color: textMuted, padding: '4px 2px' }}>No quote requests yet.</div>
              ) : history.leads.map(l => (
                <div key={l.id} style={{ background: bgRow, borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: text }}>{(l.answers && (l.answers['Service Category'] || l.answers.category)) || 'Quote request'}</span>
                    {l.status && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: l.status === 'new' ? (isDark ? 'rgba(3,193,245,0.15)' : '#e0f9ff') : bgRow, color: l.status === 'new' ? '#03C1F5' : textSub }}>{l.status}</span>}
                  </div>
                  {(l.answers && l.answers._area) && <div style={{ fontSize: 11, color: textSub, marginTop: 3 }}>📍 {l.answers._area}</div>}
                  {renderAnswers(l.answers)}
                  <div style={{ fontSize: 10.5, color: textMuted, marginTop: 5 }}>{fmtDateTime(l.created_at)}</div>
                </div>
              ))}

              {/* CHATS */}
              {sectionTitle('ti-message-2', 'Messages', history.chats.length, '#8b5cf6')}
              {history.chats.length === 0 ? (
                <div style={{ fontSize: 12, color: textMuted, padding: '4px 2px' }}>No messages yet.</div>
              ) : (
                <div style={{ fontSize: 12, color: textSub }}>
                  {history.chats.length} message{history.chats.length > 1 ? 's' : ''} · last {timeAgo(history.chats[0].created_at)}
                </div>
              )}

              {/* LIKES + TEAM RATINGS (compact) */}
              <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 130, background: bgRow, borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: text }}>{history.likes.length}</div>
                  <div style={{ fontSize: 11, color: textSub }}>Portfolio likes</div>
                </div>
                <div style={{ flex: 1, minWidth: 130, background: bgRow, borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: text }}>{history.teamRatings.length}</div>
                  <div style={{ fontSize: 11, color: textSub }}>Team ratings given</div>
                </div>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  )
}
