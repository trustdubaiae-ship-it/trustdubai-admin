import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'

const PLAN_GRAD = {
  free:     'linear-gradient(135deg,#6b7280,#4b5563)',
  silver:   'linear-gradient(135deg,#94a3b8,#64748b)',
  gold:     'linear-gradient(135deg,#e8b84b,#c9952a)',
  platinum: 'linear-gradient(135deg,#8b5cf6,#6d28d9)',
}
const EXPIRY_SOON_DAYS = 30
const PAGE = 20

export default function DocumentVerification({ theme, adminData }) {
  const isDark = theme === 'dark'
  const [docMeta, setDocMeta] = useState([])
  const [allDocs, setAllDocs] = useState([])
  const [companies, setCompanies] = useState({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [planFilter, setPlanFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [visible, setVisible] = useState(PAGE)
  const [reviewDoc, setReviewDoc] = useState(null)

  const C = {
    card:   isDark ? '#161b22' : '#ffffff',
    listBg: isDark ? '#0f1419' : '#f8fafc',
    border: isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0',
    text:   isDark ? '#f0fdf4' : '#0f172a',
    sub:    isDark ? '#9ca3af' : '#64748b',
    muted:  isDark ? '#6b7280' : '#94a3b8',
    bg2:    isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
    selBg:  isDark ? 'rgba(0,153,204,0.12)' : '#e9f5fb',
    chipBg: isDark ? 'rgba(255,255,255,0.06)' : '#eef2f6',
    green:  '#22c55e',
  }
  const BRAND = '#0099cc'

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

  // group by company
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

  const shown = filtered.slice(0, visible)

  const counts = useMemo(() => {
    let pending = 0, verified = 0, expiring = 0, expired = 0
    grouped.forEach(g => {
      if (g.pending > 0) pending++
      if (g.pending === 0 && g.verified > 0) verified++
      if (g.expiringCount > 0) expiring++
      if (g.hasExpired) expired++
    })
    return { pending, verified, expiring, expired, all: grouped.length }
  }, [grouped])

  // auto-select first when list changes
  useEffect(() => {
    if (filtered.length && !filtered.find(g => g.company_id === selectedId)) setSelectedId(filtered[0].company_id)
    if (!filtered.length) setSelectedId(null)
  }, [filter, search, planFilter, grouped])

  function pctColor(p) { return p >= 75 ? C.green : p >= 40 ? '#fbbf24' : '#f87171' }

  const TABS = [
    ['pending', 'Pending'], ['verified', 'Verified'],
    ['expiring', 'Expiring'], ['expired', 'Expired'], ['all', 'All'],
  ]

  const STAT = {
    pending:  { label: 'Pending',  bg: 'rgba(251,191,36,0.15)',  fg: '#fbbf24' },
    verified: { label: 'Verified', bg: 'rgba(74,222,128,0.15)',  fg: '#4ade80' },
    rejected: { label: 'Rejected', bg: 'rgba(248,113,113,0.15)', fg: '#f87171' },
  }

  const metaMap = {}; docMeta.forEach(m => { metaMap[m.doc_key] = m })
  const selected = grouped.find(g => g.company_id === selectedId) || null

  if (loading) return <div style={{ padding: 24, color: C.sub }}>Loading…</div>

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: 0 }}>Document Verification</h1>
        <p style={{ fontSize: 13, color: C.sub, margin: '4px 0 0' }}>Review documents by company. Approve only after checking every detail.</p>
      </div>

      {/* SEARCH + TABS + PLAN */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 180, display: 'flex', alignItems: 'center', gap: 8, background: C.listBg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px' }}>
          <i className="ti ti-search" style={{ fontSize: 16, color: C.muted }} />
          <input value={search} onChange={e => { setSearch(e.target.value); setVisible(PAGE) }} placeholder="Search company…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: C.text, fontSize: 13 }} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TABS.map(([k, l]) => {
            const active = filter === k
            return (
              <button key={k} onClick={() => { setFilter(k); setVisible(PAGE) }}
                style={{ border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: '7px 12px', borderRadius: 20,
                  background: active ? 'rgba(0,153,204,0.15)' : C.chipBg, color: active ? BRAND : C.sub }}>
                {l}{k !== 'all' ? ` · ${counts[k]}` : ''}
              </button>
            )
          })}
        </div>
        <select value={planFilter} onChange={e => { setPlanFilter(e.target.value); setVisible(PAGE) }}
          style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.sub, fontSize: 12, fontWeight: 600, cursor: 'pointer', outline: 'none' }}>
          <option value="all">All Plans</option><option value="free">Free</option><option value="silver">Silver</option><option value="gold">Gold</option><option value="platinum">Platinum</option>
        </select>
      </div>

      {/* SPLIT PANE */}
      <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', background: C.card, minHeight: 460 }}>

        {/* LEFT LIST */}
        <div style={{ borderRight: `1px solid ${C.border}`, background: C.listBg, maxHeight: 660, overflowY: 'auto' }}>
          {shown.length === 0 && <div style={{ padding: 20, color: C.muted, fontSize: 13 }}>No companies in this view.</div>}
          {shown.map(g => {
            const sel = g.company_id === selectedId
            const statusLine = g.hasExpired ? `${g.docs.filter(d => daysLeft(d.doc_expiry) !== null && daysLeft(d.doc_expiry) < 0).length} expired`
              : g.pending > 0 ? `${g.pending} pending`
              : g.verified > 0 ? 'All verified' : '—'
            const statusColor = g.hasExpired ? '#f87171' : g.pending > 0 ? '#f59e0b' : C.muted
            return (
              <div key={g.company_id} onClick={() => setSelectedId(g.company_id)}
                style={{ padding: '11px 14px', borderBottom: `1px solid ${C.border}`, cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center',
                  borderLeft: sel ? `3px solid ${BRAND}` : '3px solid transparent', background: sel ? C.selBg : 'transparent' }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: g.comp.logo_url ? 'transparent' : (PLAN_GRAD[g.comp.plan] || PLAN_GRAD.free), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: '#fff', flexShrink: 0, overflow: 'hidden' }}>
                  {g.comp.logo_url ? <img src={g.comp.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (g.comp.name?.[0]?.toUpperCase() || '?')}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: sel ? 700 : 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.comp.name || '—'}</div>
                  <div style={{ fontSize: 11, color: C.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(g.comp.area || g.comp.location || 'Dubai')} · {(g.comp.plan || 'free').charAt(0).toUpperCase() + (g.comp.plan || 'free').slice(1)} · {g.pct}%</div>
                  <div style={{ fontSize: 10, marginTop: 2, fontWeight: 600, color: statusColor }}>{statusLine}</div>
                </div>
              </div>
            )
          })}
          {filtered.length > visible && (
            <div onClick={() => setVisible(v => v + PAGE)} style={{ padding: 13, textAlign: 'center', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: BRAND }}>
              Load more ({visible} of {filtered.length})
            </div>
          )}
        </div>

        {/* RIGHT — company docs */}
        <div style={{ padding: 18, maxHeight: 660, overflowY: 'auto' }}>
          {!selected ? (
            <div style={{ color: C.muted, fontSize: 14, padding: 30, textAlign: 'center' }}>Select a company from the list.</div>
          ) : (
            <div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: selected.comp.logo_url ? 'transparent' : (PLAN_GRAD[selected.comp.plan] || PLAN_GRAD.free), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, color: '#fff', overflow: 'hidden' }}>
                  {selected.comp.logo_url ? <img src={selected.comp.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (selected.comp.name?.[0]?.toUpperCase() || '?')}
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{selected.comp.name || '—'}</div>
                  <div style={{ fontSize: 12, color: C.sub }}>{(selected.comp.area || selected.comp.location || 'Dubai')} · {(selected.comp.plan || 'free').charAt(0).toUpperCase() + (selected.comp.plan || 'free').slice(1)} · {selected.pct}% verified · {selected.docs.length} uploaded</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {selected.docs.map(d => {
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
          )}
        </div>
      </div>

      {reviewDoc && selected && (
        <ReviewModal row={reviewDoc} meta={metaMap[reviewDoc.doc_key]} company={selected.comp} adminData={adminData} C={C} isDark={isDark} onClose={() => setReviewDoc(null)} onDone={() => { setReviewDoc(null); load() }} />
      )}
    </div>
  )
}

/* ---------- Forced verification modal (4 checks) ---------- */
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
