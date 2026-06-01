import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'

const PLAN_GRAD = {
  free:     'linear-gradient(135deg,#6b7280,#4b5563)',
  silver:   'linear-gradient(135deg,#94a3b8,#64748b)',
  gold:     'linear-gradient(135deg,#e8b84b,#c9952a)',
  platinum: 'linear-gradient(135deg,#8b5cf6,#6d28d9)',
}
const EXPIRY_SOON_DAYS = 30

export default function DocumentVerification({ theme, adminData }) {
  const isDark = theme === 'dark'
  const [docMeta, setDocMeta] = useState([])
  const [allDocs, setAllDocs] = useState([])
  const [companies, setCompanies] = useState({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')   // pending | verified | expiring | expired | all
  const [planFilter, setPlanFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [view, setView] = useState('grid')
  const [activeCompany, setActiveCompany] = useState(null)

  const C = {
    card:   isDark ? '#161b22' : '#ffffff',
    border: isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0',
    text:   isDark ? '#f0fdf4' : '#0f172a',
    sub:    isDark ? '#9ca3af' : '#64748b',
    muted:  isDark ? '#6b7280' : '#94a3b8',
    bg2:    isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
    green:  '#22c55e',
  }

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: meta } = await supabase.from('verification_documents').select('*').eq('is_active', true).order('display_order', { ascending: true })
    setDocMeta(meta || [])
    const { data: docs } = await supabase.from('company_documents').select('*').order('uploaded_at', { ascending: false })
    setAllDocs(docs || [])
    const ids = [...new Set((docs || []).map(d => d.company_id))]
    if (ids.length) {
      const { data: comps } = await supabase.from('companies').select('id, name, slug, logo_url, area, location, plan, doc_verification_percent').in('id', ids)
      const cm = {}; (comps || []).forEach(c => { cm[c.id] = c }); setCompanies(cm)
    }
    setLoading(false)
  }

  function daysLeft(dateStr) {
    if (!dateStr) return null
    const today = new Date(); today.setHours(0,0,0,0)
    const exp = new Date(dateStr); exp.setHours(0,0,0,0)
    return Math.round((exp - today) / 86400000)
  }

  // group by company (only those who uploaded ≥1)
  const grouped = useMemo(() => {
    const totalMaster = docMeta.length || 8
    const map = {}
    allDocs.forEach(d => {
      if (!map[d.company_id]) map[d.company_id] = { company_id: d.company_id, docs: [], pending: 0, verified: 0, rejected: 0 }
      map[d.company_id].docs.push(d)
      if (d.status === 'pending') map[d.company_id].pending++
      else if (d.status === 'verified') map[d.company_id].verified++
      else if (d.status === 'rejected') map[d.company_id].rejected++
    })
    return Object.values(map).map(g => {
      const comp = companies[g.company_id] || {}
      const pct = comp.doc_verification_percent ?? Math.round((g.verified / totalMaster) * 100)
      // expiry info across docs
      let minDays = null, hasExpired = false, expiringCount = 0
      g.docs.forEach(d => {
        const dl = daysLeft(d.doc_expiry)
        if (dl === null) return
        if (dl < 0) hasExpired = true
        else if (dl <= EXPIRY_SOON_DAYS) expiringCount++
        if (minDays === null || dl < minDays) minDays = dl
      })
      return { ...g, comp, pct, totalMaster, minDays, hasExpired, expiringCount }
    })
  }, [allDocs, companies, docMeta])

  const filtered = useMemo(() => {
    let list = grouped
    if (filter === 'pending') list = list.filter(g => g.pending > 0)
    else if (filter === 'verified') list = list.filter(g => g.pending === 0 && g.verified > 0)
    else if (filter === 'expiring') list = list.filter(g => g.expiringCount > 0)
    else if (filter === 'expired') list = list.filter(g => g.hasExpired)
    if (planFilter !== 'all') list = list.filter(g => (g.comp.plan || 'free') === planFilter)
    if (search.trim()) { const q = search.toLowerCase(); list = list.filter(g => (g.comp.name || '').toLowerCase().includes(q)) }
    return list.sort((a, b) => (b.hasExpired - a.hasExpired) || b.pending - a.pending || a.pct - b.pct)
  }, [grouped, filter, planFilter, search])

  const stats = useMemo(() => {
    let pendingDocs = 0, verifiedDocs = 0, expiringDocs = 0, expiredDocs = 0
    grouped.forEach(g => {
      pendingDocs += g.pending
      verifiedDocs += g.verified
      expiringDocs += g.expiringCount
      g.docs.forEach(d => { const dl = daysLeft(d.doc_expiry); if (dl !== null && dl < 0) expiredDocs++ })
    })
    const avg = grouped.length ? Math.round(grouped.reduce((s, g) => s + g.pct, 0) / grouped.length) : 0
    return { companies: grouped.length, pending: pendingDocs, verified: verifiedDocs, expiring: expiringDocs, expired: expiredDocs, avg }
  }, [grouped])

  function pctColor(p) { return p >= 75 ? C.green : p >= 40 ? '#fbbf24' : '#f87171' }

  // clickable stat card -> sets filter
  const StatCard = ({ label, val, color, filterKey }) => {
    const active = filterKey && filter === filterKey
    return (
      <div onClick={() => filterKey && setFilter(filterKey)}
        style={{ background: C.card, border: `0.5px solid ${active ? (color || C.green) : C.border}`, borderRadius: 9, padding: '9px 11px', cursor: filterKey ? 'pointer' : 'default', boxShadow: active ? `0 0 0 1px ${color || C.green}` : 'none', transition: 'all .15s' }}>
        <div style={{ fontSize: 8, color: C.muted, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: color || C.text, marginTop: 1 }}>{val}</div>
      </div>
    )
  }

  const ExpiryBadge = ({ g, light }) => {
    if (g.hasExpired) return <span style={{ background: 'rgba(248,113,113,0.18)', color: '#f87171', fontSize: 8.5, fontWeight: 700, padding: '2px 7px', borderRadius: 99 }}><i className="ti ti-alert-triangle" style={{ fontSize: 9 }} /> Expired</span>
    if (g.minDays !== null && g.minDays <= EXPIRY_SOON_DAYS) return <span style={{ background: 'rgba(251,146,60,0.18)', color: '#fb923c', fontSize: 8.5, fontWeight: 700, padding: '2px 7px', borderRadius: 99 }}><i className="ti ti-clock" style={{ fontSize: 9 }} /> {g.minDays}d</span>
    if (g.minDays !== null) return <span style={{ background: 'rgba(74,222,128,0.1)', color: '#86efac', fontSize: 8.5, fontWeight: 700, padding: '2px 7px', borderRadius: 99 }}><i className="ti ti-clock" style={{ fontSize: 9 }} /> {g.minDays}d</span>
    return null
  }

  const CompanyCard = ({ g }) => {
    const fully = g.pending === 0 && g.verified > 0
    return (
      <div style={{ background: C.card, border: `0.5px solid ${g.hasExpired ? 'rgba(248,113,113,0.3)' : C.border}`, borderRadius: 11, padding: 11 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: g.comp.logo_url ? 'transparent' : (PLAN_GRAD[g.comp.plan] || PLAN_GRAD.free), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: '#fff', flexShrink: 0, overflow: 'hidden' }}>
            {g.comp.logo_url ? <img src={g.comp.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (g.comp.name?.[0]?.toUpperCase() || '?')}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.comp.name || '—'}</div>
            <div style={{ fontSize: 9, color: C.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(g.comp.area || g.comp.location || 'Dubai')} · {(g.comp.plan || 'free').charAt(0).toUpperCase() + (g.comp.plan || 'free').slice(1)}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: pctColor(g.pct) }}>{g.pct}%</span>
          <span style={{ fontSize: 8.5, color: C.muted }}>{g.verified}/{g.totalMaster}</span>
        </div>
        <div style={{ height: 5, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 8 }}>
          <div style={{ height: '100%', width: `${g.pct}%`, background: 'linear-gradient(90deg,#0099cc,#22c55e)' }} />
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 9 }}>
          <span style={{ background: fully ? 'rgba(74,222,128,0.18)' : 'rgba(251,191,36,0.18)', color: fully ? '#4ade80' : '#fbbf24', fontSize: 8.5, fontWeight: 700, padding: '2px 7px', borderRadius: 99 }}>{fully ? 'Verified' : `${g.pending} pending`}</span>
          <ExpiryBadge g={g} />
        </div>
        <button onClick={() => setActiveCompany(g)} style={{ width: '100%', padding: 6, borderRadius: 7, border: fully && !g.hasExpired ? `0.5px solid ${C.border}` : 'none', background: fully && !g.hasExpired ? 'transparent' : C.green, color: fully && !g.hasExpired ? C.sub : '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Review →</button>
      </div>
    )
  }

  const CompanyRow = ({ g }) => {
    const fully = g.pending === 0 && g.verified > 0
    return (
      <div style={{ background: C.card, border: `0.5px solid ${g.hasExpired ? 'rgba(248,113,113,0.3)' : C.border}`, borderRadius: 11, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: g.comp.logo_url ? 'transparent' : (PLAN_GRAD[g.comp.plan] || PLAN_GRAD.free), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: '#fff', flexShrink: 0, overflow: 'hidden' }}>
          {g.comp.logo_url ? <img src={g.comp.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (g.comp.name?.[0]?.toUpperCase() || '?')}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{g.comp.name || '—'}</div>
          <div style={{ fontSize: 10.5, color: C.sub }}>{(g.comp.area || g.comp.location || 'Dubai')} · {(g.comp.plan || 'free').charAt(0).toUpperCase() + (g.comp.plan || 'free').slice(1)}</div>
        </div>
        <ExpiryBadge g={g} />
        <div style={{ width: 110, flexShrink: 0 }}>
          <div style={{ height: 5, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${g.pct}%`, background: 'linear-gradient(90deg,#0099cc,#22c55e)' }} />
          </div>
        </div>
        <span style={{ fontSize: 14, fontWeight: 800, color: pctColor(g.pct), width: 44, textAlign: 'right', flexShrink: 0 }}>{g.pct}%</span>
        <span style={{ flexShrink: 0, background: fully ? 'rgba(74,222,128,0.18)' : 'rgba(251,191,36,0.18)', color: fully ? '#4ade80' : '#fbbf24', fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 99, width: 78, textAlign: 'center' }}>{fully ? 'Verified' : `${g.pending} pending`}</span>
        <button onClick={() => setActiveCompany(g)} style={{ flexShrink: 0, padding: '7px 16px', borderRadius: 8, border: 'none', background: C.green, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Review →</button>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: 0 }}>Document Verification</h1>
        <p style={{ fontSize: 13, color: C.sub, margin: '4px 0 0' }}>Review documents by company. Click a stat to filter. Approve only after checking every detail.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 7, marginBottom: 12 }} className="docv-stats">
        <StatCard label="Companies" val={stats.companies} filterKey="all" />
        <StatCard label="Pending" val={stats.pending} color="#fbbf24" filterKey="pending" />
        <StatCard label="Verified" val={stats.verified} color="#4ade80" filterKey="verified" />
        <StatCard label="Expiring" val={stats.expiring} color="#fb923c" filterKey="expiring" />
        <StatCard label="Expired" val={stats.expired} color="#f87171" filterKey="expired" />
        <StatCard label="Avg Score" val={`${stats.avg}%`} />
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: C.card, border: `0.5px solid ${C.border}`, borderRadius: 8, padding: '6px 10px', flex: 1, minWidth: 110 }}>
          <i className="ti ti-search" style={{ fontSize: 11, color: C.muted }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search company…" style={{ border: 'none', background: 'none', outline: 'none', fontSize: 11, color: C.text, width: '100%' }} />
        </div>
        {[['pending','Has Pending','#4ade80'],['verified','Verified','#4ade80'],['expiring','Expiring','#fb923c'],['expired','Expired','#f87171'],['all','All','#4ade80']].map(([k, l, col]) => (
          <button key={k} onClick={() => setFilter(k)} style={{ padding: '5px 11px', borderRadius: 8, border: `0.5px solid ${filter===k ? col : C.border}`, background: filter===k ? col+'22' : C.card, color: filter===k ? col : C.sub, fontSize: 10.5, fontWeight: 600, cursor: 'pointer' }}>{l}</button>
        ))}
        <select value={planFilter} onChange={e => setPlanFilter(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8, border: `0.5px solid ${C.border}`, background: C.card, color: C.sub, fontSize: 10.5, fontWeight: 600, cursor: 'pointer', outline: 'none' }}>
          <option value="all">All Plans</option><option value="free">Free</option><option value="silver">Silver</option><option value="gold">Gold</option><option value="platinum">Platinum</option>
        </select>
        <div style={{ display: 'flex', gap: 2, background: C.card, border: `0.5px solid ${C.border}`, borderRadius: 8, padding: 3 }}>
          <button onClick={() => setView('grid')} style={{ width: 26, height: 24, borderRadius: 6, border: 'none', background: view==='grid' ? 'rgba(34,197,94,0.15)' : 'transparent', color: view==='grid' ? '#4ade80' : C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="ti ti-layout-grid" style={{ fontSize: 13 }} /></button>
          <button onClick={() => setView('list')} style={{ width: 26, height: 24, borderRadius: 6, border: 'none', background: view==='list' ? 'rgba(34,197,94,0.15)' : 'transparent', color: view==='list' ? '#4ade80' : C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="ti ti-list" style={{ fontSize: 13 }} /></button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 50, color: C.muted }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 50, color: C.muted, background: C.card, borderRadius: 12, border: `0.5px solid ${C.border}` }}>No companies in this view.</div>
      ) : view === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }} className="docv-grid">
          {filtered.map(g => <CompanyCard key={g.company_id} g={g} />)}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(g => <CompanyRow key={g.company_id} g={g} />)}
        </div>
      )}

      {activeCompany && (
        <CompanyDocsModal group={activeCompany} docMeta={docMeta} adminData={adminData} C={C} isDark={isDark} daysLeft={daysLeft} onClose={() => setActiveCompany(null)} onDone={() => { setActiveCompany(null); load() }} />
      )}

      <style>{`@media (max-width:1100px){.docv-grid{grid-template-columns:repeat(2,1fr)!important}.docv-stats{grid-template-columns:repeat(3,1fr)!important}}@media (max-width:560px){.docv-grid{grid-template-columns:1fr!important}.docv-stats{grid-template-columns:repeat(2,1fr)!important}}`}</style>
    </div>
  )
}

/* ---------- Company docs list modal ---------- */
function CompanyDocsModal({ group, docMeta, adminData, C, isDark, daysLeft, onClose, onDone }) {
  const [reviewDoc, setReviewDoc] = useState(null)
  const metaMap = {}; docMeta.forEach(m => { metaMap[m.doc_key] = m })
  const STAT = {
    pending:  { label: 'Pending',  bg: 'rgba(251,191,36,0.15)',  fg: '#fbbf24' },
    verified: { label: 'Verified', bg: 'rgba(74,222,128,0.15)',  fg: '#4ade80' },
    rejected: { label: 'Rejected', bg: 'rgba(248,113,113,0.15)', fg: '#f87171' },
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.card, borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto', padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: C.text, margin: 0 }}>{group.comp.name}</h3>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', background: C.bg2, border: `0.5px solid ${C.border}`, color: C.sub, cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>
        <p style={{ fontSize: 12, color: C.sub, margin: '0 0 16px' }}>{group.comp.area || group.comp.location || 'Dubai'} · {group.pct}% verified · {group.docs.length} uploaded</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {group.docs.map(d => {
            const meta = metaMap[d.doc_key]
            const st = STAT[d.status] || STAT.pending
            const dl = daysLeft(d.doc_expiry)
            return (
              <div key={d.id} style={{ background: C.bg2, border: `0.5px solid ${C.border}`, borderRadius: 10, padding: '11px 13px', display: 'flex', alignItems: 'center', gap: 11 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: C.card, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: C.muted, flexShrink: 0 }}><i className="ti ti-file-certificate" /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{meta?.label || d.doc_key}</div>
                  <div style={{ fontSize: 11, color: C.sub }}>No. {d.doc_number || '—'}
                    {dl !== null && <span style={{ marginLeft: 6, color: dl < 0 ? '#f87171' : dl <= 30 ? '#fb923c' : C.muted, fontWeight: 600 }}>{dl < 0 ? '· Expired' : `· ${dl}d left`}</span>}
                  </div>
                </div>
                <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: st.bg, color: st.fg }}>{st.label}</span>
                <button onClick={() => setReviewDoc(d)} style={{ flexShrink: 0, padding: '6px 13px', borderRadius: 8, border: 'none', background: C.green, color: '#fff', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>Review</button>
              </div>
            )
          })}
        </div>
      </div>

      {reviewDoc && (
        <ReviewModal row={reviewDoc} meta={metaMap[reviewDoc.doc_key]} company={group.comp} adminData={adminData} C={C} isDark={isDark} onClose={() => setReviewDoc(null)} onDone={() => { setReviewDoc(null); onDone() }} />
      )}
    </div>
  )
}

/* ---------- Forced verification modal ---------- */
function ReviewModal({ row, meta, company, adminData, C, isDark, onClose, onDone }) {
  const [chkNumber, setChkNumber] = useState(false)
  const [chkExpiry, setChkExpiry] = useState(false)
  const [chkGenuine, setChkGenuine] = useState(false)
  const [chkTerms, setChkTerms] = useState(false)
  const [saving, setSaving] = useState(false)

  const allChecked = chkNumber && chkExpiry && chkGenuine && chkTerms
  const isPdf = row.file_url && row.file_url.toLowerCase().endsWith('.pdf')

  function expiryStr() {
    if (!row.doc_expiry) return '—'
    return new Date(row.doc_expiry).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }
  async function approve() {
    if (!allChecked) return
    setSaving(true)
    const { error } = await supabase.from('company_documents').update({ status: 'verified', verified_at: new Date().toISOString(), verified_by: adminData?.full_name || adminData?.email || 'admin' }).eq('id', row.id)
    setSaving(false); if (!error) onDone()
  }
  async function reject() {
    setSaving(true)
    const { error } = await supabase.from('company_documents').update({ status: 'rejected', verified_at: new Date().toISOString(), verified_by: adminData?.full_name || adminData?.email || 'admin' }).eq('id', row.id)
    setSaving(false); if (!error) onDone()
  }

  const lbl = { fontSize: 11, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }
  const val = { fontSize: 14, color: C.text, fontWeight: 700, marginTop: 2 }
  const CheckRow = ({ checked, set, children }) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', borderRadius: 9, border: `0.5px solid ${checked ? C.green : C.border}`, background: checked ? 'rgba(34,197,94,0.08)' : C.bg2, cursor: 'pointer', marginBottom: 8 }}>
      <input type="checkbox" checked={checked} onChange={e => set(e.target.checked)} style={{ width: 17, height: 17, accentColor: C.green, cursor: 'pointer' }} />
      <span style={{ fontSize: 12.5, color: C.text, fontWeight: 500 }}>{children}</span>
    </label>
  )

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.card, borderRadius: 16, width: '100%', maxWidth: 540, maxHeight: '92vh', overflowY: 'auto', padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: C.text, margin: 0 }}>{meta?.label || row.doc_key}</h3>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', background: C.bg2, border: `0.5px solid ${C.border}`, color: C.sub, cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>

        <div style={{ background: '#000', borderRadius: 10, overflow: 'hidden', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
          {row.file_url ? (
            isPdf
              ? <a href={row.file_url} target="_blank" rel="noopener noreferrer" style={{ padding: 30, color: '#4ade80', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}><i className="ti ti-file-text" /> Open PDF in new tab</a>
              : <img src={row.file_url} alt="" style={{ maxWidth: '100%', maxHeight: 280, objectFit: 'contain' }} />
          ) : <span style={{ color: '#666', fontSize: 13, padding: 30 }}>No file uploaded</span>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div><div style={lbl}>Company</div><div style={val}>{company?.name || '—'}</div></div>
          <div><div style={lbl}>Document Number</div><div style={val}>{row.doc_number || '—'}</div></div>
          <div><div style={lbl}>Expiry Date</div><div style={val}>{expiryStr()}</div></div>
          <div><div style={lbl}>Submitted</div><div style={val}>{new Date(row.uploaded_at).toLocaleDateString('en-GB')}</div></div>
        </div>

        <div style={{ background: 'rgba(251,191,36,0.1)', border: '0.5px solid rgba(251,191,36,0.3)', borderRadius: 9, padding: '10px 12px', marginBottom: 14, fontSize: 12, color: isDark ? '#fcd34d' : '#92400e', lineHeight: 1.5 }}>
          <i className="ti ti-alert-triangle" /> Carefully match every detail against the actual document before approving.
        </div>

        <CheckRow checked={chkNumber} set={setChkNumber}>Document number matches the file</CheckRow>
        <CheckRow checked={chkExpiry} set={setChkExpiry}>Expiry date matches the file</CheckRow>
        <CheckRow checked={chkGenuine} set={setChkGenuine}>Document is genuine and clearly readable</CheckRow>
        <CheckRow checked={chkTerms} set={setChkTerms}>I have checked all the details and documents before approval</CheckRow>

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={reject} disabled={saving} style={{ flex: 1, padding: 12, borderRadius: 9, border: '0.5px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.12)', color: '#f87171', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Reject</button>
          <button onClick={approve} disabled={!allChecked || saving} style={{ flex: 2, padding: 12, borderRadius: 9, border: 'none', background: allChecked ? C.green : (isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'), color: allChecked ? '#fff' : C.muted, fontSize: 13, fontWeight: 700, cursor: allChecked ? 'pointer' : 'not-allowed', transition: 'all .2s' }}>
            {saving ? 'Saving…' : allChecked ? '✓ Approve & Verify' : 'Tick all to approve'}
          </button>
        </div>
      </div>
    </div>
  )
}
