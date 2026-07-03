import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

import { CATEGORIES as CATS } from '../lib/categories'

const PLANS = {
  free:     { label: 'Free',     color: '#6b7280', bg: '#f3f4f6', price: 0 },
  silver:   { label: 'Silver',   color: '#94a3b8', bg: '#f1f5f9', price: 149 },
  gold:     { label: 'Gold',     color: '#e8b84b', bg: '#fffdf7', price: 349 },
  platinum: { label: 'Platinum', color: '#8b5cf6', bg: '#f5f3ff', price: 699 },
}

const DURATIONS = [
  { id: '1month',  label: '1 Month',  months: 1,  defaultDiscount: 0 },
  { id: '3month',  label: '3 Months', months: 3,  defaultDiscount: 0 },
  { id: '6month',  label: '6 Months', months: 6,  defaultDiscount: 0 },
  { id: '1year',   label: '1 Year',   months: 12, defaultDiscount: 20 },
]

function formatExpiry(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr), now = new Date()
  const diffDays = Math.ceil((d - now) / (1000 * 60 * 60 * 24))
  if (diffDays < 0)   return { label: 'Expired',          color: '#ef4444', days: diffDays }
  if (diffDays <= 7)  return { label: diffDays + 'd left', color: '#f59e0b', days: diffDays }
  if (diffDays <= 30) return { label: diffDays + 'd left', color: '#3b82f6', days: diffDays }
  return { label: diffDays + 'd left', color: '#10b981', days: diffDays }
}

function perfBadge(score) {
  const s = Number(score) || 0
  if (s >= 3)  return { color: '#0f6e56', bg: '#e1f5ee', icon: 'ti-trending-up' }
  if (s >= 1)  return { color: '#854f0b', bg: '#faeeda', icon: 'ti-arrow-up-right' }
  return { color: '#888780', bg: '#f1efe8', icon: 'ti-minus' }
}

/* Robust boolean parse — DB columns may be boolean OR text ("true"/"false") */
function truthy(v) {
  return v === true || v === 1 || v === 'true' || v === 't' || v === '1' || v === 'yes'
}

/* Source provenance badge — Google import vs Portal-registered vs Claimed import */
function sourceBadge(c) {
  if (!truthy(c.is_imported)) return { t: 'Registered', color: '#1e8e3e', bg: '#e6f4ea', bgDark: 'rgba(30,142,62,0.18)', icon: 'ti-user-plus' }
  if (truthy(c.claimed))      return { t: 'Claimed',    color: '#1d4ed8', bg: '#dbeafe', bgDark: 'rgba(29,78,216,0.18)',  icon: 'ti-discount-check' }
  return                     { t: 'Google',     color: '#a16207', bg: '#fef9c3', bgDark: 'rgba(161,98,7,0.20)',   icon: 'ti-brand-google' }
}

/* Verification level chip — listed / license-verified / fully verified */
function levelChip(c) {
  const lv = c.verification_level || (truthy(c.is_verified) ? 'full' : 'listed')
  if (lv === 'full')    return { t: 'Fully Verified',    color: '#03C1F5' }
  if (lv === 'license') return { t: 'License-Verified',  color: '#0f6e56' }
  return                       { t: 'Listed',            color: '#94a3b8' }
}

function Modal({ title, onClose, children, wide }) {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
      <div style={{ background: isDark ? '#1e293b' : '#fff', borderRadius: 16, padding: 24, width: wide ? 700 : 520, maxHeight: '90vh', overflowY: 'auto', border: '1px solid ' + (isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0') }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: isDark ? '#f1f5f9' : '#0f172a' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: isDark ? '#94a3b8' : '#64748b', lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, value, onChange }) {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: isDark ? '#94a3b8' : '#64748b', display: 'block', marginBottom: 4, textTransform: 'capitalize' }}>{label}</label>
      <input value={value || ''} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid ' + (isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'), borderRadius: 8, fontSize: 13, outline: 'none', background: isDark ? '#0f172a' : '#fff', color: isDark ? '#f1f5f9' : '#0f172a' }} />
    </div>
  )
}

export default function Companies({ initialPlanFilter }) {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
  const [, forceUpdate] = useState(0)
  const [source, setSource] = useState('portal')   // 'portal' | 'imported'
  const [tab, setTab] = useState('all')             // sub-filter; meaning depends on source
  const [viewMode, setViewMode] = useState('list')
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState(initialPlanFilter || 'all')
  const [editC, setEditC] = useState(null)
  const [detailC, setDetailC] = useState(null)
  const [addModal, setAddModal] = useState(false)
  const [planModal, setPlanModal] = useState(null)
  const [selectedPlan, setSelectedPlan] = useState('free')
  const [duration, setDuration] = useState('1month')
  const [discount, setDiscount] = useState(0)
  const [savingPlan, setSavingPlan] = useState(false)
  const [adminData, setAdminData] = useState(null)
  const [portalTotal, setPortalTotal] = useState(0)
  const [importedTotal, setImportedTotal] = useState(0)
  const [newC, setNewC] = useState({ name: '', category: '', area: '', phone: '', whatsapp: '', email: '', description: '' })
  const [partnerMap, setPartnerMap] = useState({})   // partner id -> { code, name } for "Referred by"

  // Map referred_by_partner_id -> partner code/name (admin-safe RPC, gated by is_admin)
  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc('admin_partner_overview')
      const m = {}; (data || []).forEach(p => { m[p.id] = { code: p.code, name: p.name } }); setPartnerMap(m)
    })()
  }, [])

  useEffect(() => {
    fetchAdminData()
    const observer = new MutationObserver(() => forceUpdate(n => n + 1))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  // Re-fetch whenever the active source changes (DB-side filter avoids the 1000-row cap)
  useEffect(() => { fetchAll() }, [source])

  useEffect(() => {
    if (initialPlanFilter) { setPlanFilter(initialPlanFilter); setSource('portal') }
  }, [initialPlanFilter])

  function switchSource(s) {
    setSource(s)
    setTab('all')
    if (s === 'imported') setPlanFilter('all')   // plan filter is meaningless for unmonetized imports
  }

  async function fetchAdminData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase.from('admin_users').select('*').eq('email', user.email).single()
      setAdminData(data)
    }
  }

  async function fetchAll() {
    setLoading(true)
    // Imported side = strictly is_imported true. Portal side = everything else
    // (false OR null OR empty) so no real company is ever missed.
    // is.true / not.is.true work for BOTH boolean and text columns reliably.
    const [{ count: iTotal }, { count: total }] = await Promise.all([
      supabase.from('companies').select('*', { count: 'exact', head: true }).eq('is_imported', true),
      supabase.from('companies').select('*', { count: 'exact', head: true }),
    ])
    const imp = iTotal || 0
    const all = total || 0
    setImportedTotal(imp)
    setPortalTotal(Math.max(all - imp, 0))
    // Load rows for the ACTIVE source only — avoids the 1000-row cap
    let qy = supabase.from('companies').select('*')
    if (source === 'imported') qy = qy.eq('is_imported', true)
    else                       qy = qy.not('is_imported', 'eq', true)   // false / null / empty
    const { data, error } = await qy.order('created_at', { ascending: false }).range(0, 1999)
    if (error) console.error('Companies fetch error:', error)
    setCompanies(data || [])
    setLoading(false)
  }

  async function update(id, updates) {
    await supabase.from('companies').update(updates).eq('id', id)
    fetchAll(); setEditC(null)
  }

  async function del(id) {
    if (!confirm('Delete this company?')) return
    await supabase.from('companies').delete().eq('id', id)
    fetchAll()
  }

  async function addNew() {
    await supabase.from('companies').insert({ ...newC, status: 'approved', is_imported: false })
    setAddModal(false)
    setNewC({ name: '', category: '', area: '', phone: '', whatsapp: '', email: '', description: '' })
    fetchAll()
  }

  function openPlanModal(company) {
    setPlanModal(company)
    setSelectedPlan(company.plan || 'free')
    setDuration('1month'); setDiscount(0)
  }

  const durObj = DURATIONS.find(d => d.id === duration) || DURATIONS[0]
  const planPrice = PLANS[selectedPlan]?.price || 0
  const months = durObj.months
  const baseTotal = planPrice * months
  const discountAmount = Math.round(baseTotal * (discount / 100))
  const finalTotal = baseTotal - discountAmount

  function getExpiryDate() {
    const d = new Date(); d.setMonth(d.getMonth() + months); return d.toISOString()
  }
  function getExpiryLabel() {
    return new Date(getExpiryDate()).toLocaleDateString('en-AE', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  async function savePlan() {
    if (!planModal || !selectedPlan) return
    setSavingPlan(true)
    const expiryDate = selectedPlan === 'free' ? null : getExpiryDate()
    await supabase.from('companies').update({
      plan: selectedPlan,
      plan_started_at: new Date().toISOString(),
      plan_expires_at: expiryDate
    }).eq('id', planModal.id)

    if (selectedPlan !== 'free') {
      const { data: accountsUsers } = await supabase.from('admin_users').select('id').eq('role', 'accounts').eq('is_active', true)
      const { data: superAdmins } = await supabase.from('admin_users').select('id').in('role', ['super_admin', 'superadmin']).eq('is_active', true)
      for (const r of [...(accountsUsers || []), ...(superAdmins || [])]) {
        await supabase.from('notifications').insert({
          user_id: r.id, type: 'payment_pending',
          title: '💰 Payment Confirmation Required',
          message: `${planModal.name} assigned ${PLANS[selectedPlan]?.label} plan for ${durObj.label}. Total: AED ${finalTotal}.`,
          data: { company_id: planModal.id, company_name: planModal.name, plan: selectedPlan, duration: durObj.label, months, final_total: finalTotal, expires_at: expiryDate, assigned_by: adminData?.full_name || 'Admin' },
          is_read: false,
        })
      }
    }
    setSavingPlan(false); setPlanModal(null); fetchAll()
    alert(selectedPlan === 'free' ? '✅ Plan set to Free!' : `✅ Plan saved! Accounts notified for AED ${finalTotal}.`)
  }

  /* ── SOURCE SPLIT — Google-imported vs Portal-registered never mix ── */
  const portalCos   = companies.filter(c => !truthy(c.is_imported))
  const importedCos = companies.filter(c => truthy(c.is_imported))
  const sourceList  = source === 'imported' ? importedCos : portalCos

  /* Sub-filter within the chosen source */
  let baseList = sourceList
  if (source === 'portal') {
    if (tab === 'pending')  baseList = sourceList.filter(c => c.status === 'pending' || c.status === 'under_review')
    if (tab === 'approved') baseList = sourceList.filter(c => c.status === 'approved')
    if (tab === 'rejected') baseList = sourceList.filter(c => c.status === 'rejected')
  } else {
    if (tab === 'unclaimed') baseList = sourceList.filter(c => !truthy(c.claimed))
    if (tab === 'claimed')   baseList = sourceList.filter(c => truthy(c.claimed))
  }

  let displayList = baseList
  if (planFilter !== 'all') displayList = displayList.filter(c => (c.plan || 'free') === planFilter)
  if (search) displayList = displayList.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.category?.toLowerCase().includes(search.toLowerCase()) ||
    c.area?.toLowerCase().includes(search.toLowerCase())
  )

  // top performer (highest performance_score among displayed, must be > 0)
  const topPerformerId = (() => {
    let best = null, bestScore = 0
    for (const c of displayList) {
      const s = Number(c.performance_score) || 0
      if (s > bestScore) { bestScore = s; best = c.id }
    }
    return best
  })()

  const text      = isDark ? '#f1f5f9' : '#0f172a'
  const textSub   = isDark ? '#94a3b8' : '#64748b'
  const textMuted = isDark ? '#475569' : '#94a3b8'
  const borderCol = isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'
  const cardBg    = isDark ? '#1e293b' : '#ffffff'
  const bgRow     = isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc'

  const btn = (color, bg) => ({ padding: '5px 12px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer', color, background: bg })
  const initials   = (name) => name?.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
  const avatarColors = ['#1a73e8', '#1e8e3e', '#d93025', '#f9a825', '#9c27b0', '#00897b']
  const avatarColor  = (name) => avatarColors[name?.charCodeAt(0) % avatarColors.length] || '#1a73e8'

  // Plan counts based on current source+subtab list
  const planCounts = {
    all:      baseList.length,
    free:     baseList.filter(c => (c.plan || 'free') === 'free').length,
    silver:   baseList.filter(c => (c.plan || 'free') === 'silver').length,
    gold:     baseList.filter(c => (c.plan || 'free') === 'gold').length,
    platinum: baseList.filter(c => (c.plan || 'free') === 'platinum').length,
  }

  // quick stats (based on current source+subtab list)
  const payingCount   = baseList.filter(c => (c.plan || 'free') !== 'free').length
  const perfList      = baseList.map(c => Number(c.performance_score) || 0)
  const avgPerf       = perfList.length ? (perfList.reduce((a, b) => a + b, 0) / perfList.length) : 0
  const expiringCount = baseList.filter(c => {
    const e = formatExpiry(c.plan_expires_at)
    return e && e.days >= 0 && e.days <= 7
  }).length

  // sub-tab counts (computed from full source list, before subtab filter)
  const portalCounts = {
    all:      portalCos.length,
    pending:  portalCos.filter(c => c.status === 'pending' || c.status === 'under_review').length,
    approved: portalCos.filter(c => c.status === 'approved').length,
    rejected: portalCos.filter(c => c.status === 'rejected').length,
  }
  const importedCounts = {
    all:       importedCos.length,
    unclaimed: importedCos.filter(c => !truthy(c.claimed)).length,
    claimed:   importedCos.filter(c => truthy(c.claimed)).length,
  }

  const SUBTABS = source === 'portal'
    ? [
        { id: 'all',      label: 'All',      count: portalCounts.all },
        { id: 'pending',  label: 'Pending',  count: portalCounts.pending },
        { id: 'approved', label: 'Approved', count: portalCounts.approved },
        { id: 'rejected', label: 'Rejected', count: portalCounts.rejected },
      ]
    : [
        { id: 'all',       label: 'All',       count: importedCounts.all },
        { id: 'unclaimed', label: 'Unclaimed', count: importedCounts.unclaimed },
        { id: 'claimed',   label: 'Claimed',   count: importedCounts.claimed },
      ]

  const PLAN_CARDS = [
    { key: 'all',      label: 'All',      color: '#03C1F5', bg: isDark ? 'rgba(3,193,245,0.12)'   : '#e0f9ff' },
    { key: 'free',     label: 'Free',     color: '#6b7280', bg: isDark ? 'rgba(107,114,128,0.12)' : '#f3f4f6' },
    { key: 'silver',   label: 'Silver',   color: '#94a3b8', bg: isDark ? 'rgba(148,163,184,0.12)' : '#f1f5f9' },
    { key: 'gold',     label: 'Gold',     color: '#e8b84b', bg: isDark ? 'rgba(232,184,75,0.12)'  : '#fffdf7' },
    { key: 'platinum', label: 'Platinum', color: '#8b5cf6', bg: isDark ? 'rgba(139,92,246,0.12)'  : '#f5f3ff' },
  ]

  const QUICK_STATS = [
    { label: 'Paying',    value: payingCount,            icon: 'ti-cash',        color: '#10b981' },
    { label: 'Avg perf.', value: avgPerf.toFixed(1),     icon: 'ti-trending-up', color: '#10b981' },
    { label: 'Expiring',  value: expiringCount,          icon: 'ti-clock',       color: '#f59e0b' },
  ]

  const SOURCE_CARDS = [
    { key: 'portal',   label: 'Portal Registered', sub: 'Signed up on Quvera', count: portalTotal,   color: '#1e8e3e', bg: isDark ? 'rgba(30,142,62,0.12)' : '#e6f4ea', icon: 'ti-user-plus' },
    { key: 'imported', label: 'Google Imported',   sub: 'Auto-added listings',     count: importedTotal, color: '#a16207', bg: isDark ? 'rgba(161,98,7,0.14)' : '#fef9c3', icon: 'ti-brand-google' },
  ]

  return (
    <div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: text }}>Companies</h1>
          <p style={{ fontSize: 13, color: textSub, marginTop: 4 }}>
            {source === 'imported' ? 'Google-imported listings' : 'Portal-registered businesses'} · {displayList.length} shown
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', background: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9', borderRadius: 8, padding: 3, border: '1px solid ' + borderCol }}>
            {[
              { id: 'list', icon: 'ti-list' },
              { id: 'card', icon: 'ti-layout-grid' },
              { id: 'icon', icon: 'ti-apps' },
            ].map(v => (
              <button key={v.id} onClick={() => setViewMode(v.id)} style={{ width: 32, height: 32, border: 'none', borderRadius: 6, cursor: 'pointer', background: viewMode === v.id ? (isDark ? '#334155' : '#fff') : 'transparent', color: viewMode === v.id ? '#03C1F5' : textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                <i className={'ti ' + v.icon} style={{ fontSize: 15 }} />
              </button>
            ))}
          </div>
          <button onClick={() => setAddModal(true)} style={{ padding: '8px 16px', background: '#03C1F5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>+ Add Company</button>
        </div>
      </div>

      {/* SOURCE TOGGLE — Portal vs Google (the two never mix) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        {SOURCE_CARDS.map(s => {
          const active = source === s.key
          return (
            <div key={s.key} onClick={() => switchSource(s.key)}
              style={{
                background: active ? s.bg : cardBg,
                border: '2px solid ' + (active ? s.color : borderCol),
                borderRadius: 14, padding: '14px 18px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 14, transition: 'all 0.15s',
                boxShadow: active ? '0 4px 14px ' + s.color + '26' : 'none',
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = s.color; e.currentTarget.style.transform = 'translateY(-1px)' } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = borderCol; e.currentTarget.style.transform = 'none' } }}
            >
              <div style={{ width: 46, height: 46, borderRadius: 12, background: s.color + (isDark ? '26' : '1e'), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={'ti ' + s.icon} style={{ fontSize: 22, color: s.color }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: active ? s.color : text }}>{s.label}</div>
                <div style={{ fontSize: 11, color: textSub, marginTop: 1 }}>{s.sub}</div>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: active ? s.color : text, lineHeight: 1, flexShrink: 0 }}>{s.count}</div>
            </div>
          )
        })}
      </div>

      {/* Plan filter + quick stats — only for Portal (imports are unmonetized) */}
      {source === 'portal' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 12 }}>
            {PLAN_CARDS.map(p => (
              <div key={p.key}
                onClick={() => setPlanFilter(p.key)}
                style={{
                  background: planFilter === p.key ? p.bg : cardBg,
                  border: '2px solid ' + (planFilter === p.key ? p.color : borderCol),
                  borderRadius: 12, padding: '12px 14px', cursor: 'pointer',
                  textAlign: 'center', transition: 'all 0.15s',
                  boxShadow: planFilter === p.key ? '0 4px 12px ' + p.color + '33' : 'none',
                }}
                onMouseEnter={e => { if (planFilter !== p.key) { e.currentTarget.style.borderColor = p.color; e.currentTarget.style.transform = 'translateY(-1px)' } }}
                onMouseLeave={e => { if (planFilter !== p.key) { e.currentTarget.style.borderColor = borderCol; e.currentTarget.style.transform = 'none' } }}
              >
                <div style={{ fontSize: 24, fontWeight: 700, color: planFilter === p.key ? p.color : text, lineHeight: 1 }}>
                  {planCounts[p.key]}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: planFilter === p.key ? p.color : textSub, marginTop: 5 }}>
                  {p.label}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            {QUICK_STATS.map(s => (
              <div key={s.label} style={{ flex: 1, minWidth: 120, background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc', border: '1px solid ' + borderCol, borderRadius: 10, padding: '9px 13px', display: 'flex', alignItems: 'center', gap: 9 }}>
                <i className={'ti ' + s.icon} style={{ fontSize: 16, color: s.color }} />
                <div><span style={{ fontSize: 15, fontWeight: 700, color: text }}>{s.value}</span> <span style={{ fontSize: 11, color: textSub }}>{s.label}</span></div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Imported claim-summary strip */}
      {source === 'imported' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, background: isDark ? 'rgba(161,98,7,0.10)' : '#fffbeb', border: '1px solid ' + (isDark ? 'rgba(161,98,7,0.25)' : '#fde68a'), borderRadius: 10, padding: '11px 16px', flexWrap: 'wrap' }}>
          <i className="ti ti-info-circle" style={{ fontSize: 17, color: '#a16207' }} />
          <span style={{ fontSize: 12.5, color: text }}>
            Imported listings show publicly as <strong>Listed</strong> until an owner claims them.
          </span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 14, fontSize: 12.5, flexWrap: 'wrap' }}>
            <span style={{ color: textSub }}>Unclaimed: <strong style={{ color: text }}>{importedCounts.unclaimed}</strong></span>
            <span style={{ color: textSub }}>Claimed: <strong style={{ color: '#1d4ed8' }}>{importedCounts.claimed}</strong></span>
          </span>
        </div>
      )}

      {/* Search Filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search company, category, area..."
          style={{ flex: 1, padding: '8px 12px', border: '1px solid ' + borderCol, borderRadius: 8, fontSize: 13, background: cardBg, color: text, outline: 'none' }}
        />
      </div>

      {/* Sub-tabs (status for Portal · claim-state for Google) */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid ' + borderCol, flexWrap: 'wrap' }}>
        {SUBTABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '10px 20px', border: 'none', background: 'none', borderBottom: tab === t.id ? '2px solid #03C1F5' : '2px solid transparent', color: tab === t.id ? '#03C1F5' : textSub, fontWeight: 500, fontSize: 13, cursor: 'pointer' }}>
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ width: 36, height: 36, border: '3px solid #03C1F5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          <p style={{ color: textMuted, fontSize: 13 }}>Loading companies...</p>
        </div>
      ) : displayList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <i className="ti ti-building-off" style={{ fontSize: 48, color: textMuted, display: 'block', marginBottom: 12 }} />
          <p style={{ color: textMuted, fontSize: 14 }}>No companies found</p>
        </div>
      ) : (
        <>
          {/* LIST VIEW */}
          {viewMode === 'list' && (
            <div style={{ background: cardBg, border: '1px solid ' + borderCol, borderRadius: 12, overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 820, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: bgRow }}>
                    {['Company', 'Category', 'Source', 'Plan', 'Performance', 'Expiry', 'Status', 'Referred by', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: textSub, borderBottom: '1px solid ' + borderCol }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayList.map(c => {
                    const plan   = PLANS[c.plan || 'free'] || PLANS.free
                    const expiry = formatExpiry(c.plan_expires_at)
                    const score  = Number(c.performance_score) || 0
                    const pb     = perfBadge(score)
                    const sb     = sourceBadge(c)
                    const isTop  = c.id === topPerformerId
                    return (
                      <tr key={c.id} style={{ borderBottom: '1px solid ' + borderCol, cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.background = bgRow}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '12px 16px' }} onClick={() => setDetailC(c)}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 8, background: avatarColor(c.name) + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: avatarColor(c.name), flexShrink: 0 }}>
                              {initials(c.name)}
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: text, display: 'flex', alignItems: 'center', gap: 5 }}>
                                {c.name}
                                {isTop && <span style={{ fontSize: 10, color: '#0f6e56', background: isDark ? 'rgba(29,158,117,0.2)' : '#e1f5ee', padding: '1px 6px', borderRadius: 99 }}>Top</span>}
                              </div>
                              <div style={{ fontSize: 11, color: textMuted }}>{c.owner_email || (c.is_imported ? 'No owner yet' : '—')}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: textSub }} onClick={() => setDetailC(c)}>{c.category}</td>
                        <td style={{ padding: '12px 16px' }} onClick={() => setDetailC(c)}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: isDark ? sb.bgDark : sb.bg, color: sb.color, fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 99 }}>
                            <i className={'ti ' + sb.icon} style={{ fontSize: 12 }} /> {sb.t}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }} onClick={() => setDetailC(c)}>
                          <span style={{ background: plan.bg, color: plan.color, fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 99 }}>{plan.label}</span>
                        </td>
                        <td style={{ padding: '12px 16px' }} onClick={() => setDetailC(c)}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: isDark ? pb.color + '22' : pb.bg, color: pb.color, fontSize: 13, fontWeight: 600, padding: '4px 11px', borderRadius: 99 }}>
                            <i className={'ti ' + pb.icon} style={{ fontSize: 14 }} /> {score.toFixed(1)}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }} onClick={() => setDetailC(c)}>
                          {!c.plan_expires_at ? <span style={{ fontSize: 12, color: textMuted }}>—</span> : expiry ? <span style={{ fontSize: 12, fontWeight: 500, color: expiry.color }}>{expiry.days < 0 ? '⚠️ ' : ''}{expiry.label}</span> : null}
                        </td>
                        <td style={{ padding: '12px 16px' }} onClick={() => setDetailC(c)}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <span style={{ background: c.status === 'approved' ? (isDark ? 'rgba(30,142,62,0.2)' : '#e6f4ea') : (isDark ? 'rgba(232,184,75,0.2)' : '#fef9ed'), color: c.status === 'approved' ? '#1e8e3e' : '#92400e', fontSize: 11, padding: '2px 8px', borderRadius: 10, display: 'inline-block' }}>{c.status}</span>
                            {truthy(c.is_verified) && <span style={{ background: isDark ? 'rgba(3,193,245,0.15)' : '#e0f9ff', color: '#03C1F5', fontSize: 11, padding: '2px 8px', borderRadius: 10, display: 'inline-block' }}>✓ Verified</span>}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }} onClick={() => setDetailC(c)}>
                          {(() => { const rp = c.referred_by_partner_id ? partnerMap[c.referred_by_partner_id] : null
                            return rp
                              ? <span title={rp.name || ''} style={{ fontSize: 11.5, fontWeight: 700, color: '#7c3aed', background: isDark ? 'rgba(124,58,237,0.16)' : '#f5f3ff', padding: '3px 9px', borderRadius: 99, fontFamily: 'monospace' }}>{rp.code}</span>
                              : (c.referred_by_partner_id ? <span style={{ fontSize: 11, color: textMuted, fontFamily: 'monospace' }} title={c.referred_by_partner_id}>linked</span> : <span style={{ fontSize: 12, color: textMuted }}>—</span>) })()}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                            <button onClick={e => { e.stopPropagation(); setEditC(c) }} style={btn('#03C1F5', isDark ? 'rgba(3,193,245,0.1)' : '#e0f9ff')}>Edit</button>
                            <button onClick={e => { e.stopPropagation(); update(c.id, { is_verified: !truthy(c.is_verified) }) }} style={btn('#1e8e3e', isDark ? 'rgba(30,142,62,0.1)' : '#e6f4ea')}>{truthy(c.is_verified) ? 'Unverify' : 'Verify'}</button>
                            <button onClick={e => { e.stopPropagation(); openPlanModal(c) }} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer', background: plan.bg, color: plan.color }}>Plan</button>
                            <button onClick={e => { e.stopPropagation(); del(c.id) }} style={btn('#ef4444', isDark ? 'rgba(239,68,68,0.1)' : '#fce8e6')}>Del</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* CARD VIEW */}
          {viewMode === 'card' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {displayList.map(c => {
                const plan   = PLANS[c.plan || 'free'] || PLANS.free
                const expiry = formatExpiry(c.plan_expires_at)
                const score  = Number(c.performance_score) || 0
                const pb     = perfBadge(score)
                const sb     = sourceBadge(c)
                return (
                  <div key={c.id} onClick={() => setDetailC(c)}
                    style={{ background: cardBg, border: '1px solid ' + borderCol, borderRadius: 14, padding: 18, cursor: 'pointer', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = isDark ? '0 8px 24px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.08)' }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                      <div style={{ width: 48, height: 48, borderRadius: 12, background: avatarColor(c.name) + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: avatarColor(c.name), flexShrink: 0 }}>
                        {initials(c.name)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: textSub, marginTop: 2 }}>{c.category}</div>
                        {c.area && <div style={{ fontSize: 11, color: textMuted }}>📍 {c.area}</div>}
                      </div>
                      <span style={{ background: plan.bg, color: plan.color, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99, flexShrink: 0 }}>{plan.label}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: isDark ? sb.bgDark : sb.bg, color: sb.color, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 8 }}>
                        <i className={'ti ' + sb.icon} style={{ fontSize: 12 }} /> {sb.t}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: isDark ? pb.color + '22' : pb.bg, color: pb.color, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 8 }}>
                        <i className={'ti ' + pb.icon} style={{ fontSize: 12 }} /> {score.toFixed(1)}
                      </span>
                      <span style={{ background: c.status === 'approved' ? (isDark ? 'rgba(30,142,62,0.2)' : '#e6f4ea') : (isDark ? 'rgba(232,184,75,0.2)' : '#fef9ed'), color: c.status === 'approved' ? '#1e8e3e' : '#92400e', fontSize: 11, padding: '2px 8px', borderRadius: 8 }}>{c.status}</span>
                      {truthy(c.is_verified) && <span style={{ background: isDark ? 'rgba(3,193,245,0.15)' : '#e0f9ff', color: '#03C1F5', fontSize: 11, padding: '2px 8px', borderRadius: 8 }}>✓ Verified</span>}
                      {expiry && c.plan !== 'free' && <span style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc', color: expiry.color, fontSize: 11, padding: '2px 8px', borderRadius: 8 }}>{expiry.label}</span>}
                    </div>
                    {c.avg_rating > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12 }}>
                        <span style={{ color: '#f9a825', fontSize: 13 }}>★</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: text }}>{c.avg_rating}</span>
                        <span style={{ fontSize: 11, color: textMuted }}>({c.total_reviews || 0} reviews)</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => setEditC(c)} style={{ ...btn('#03C1F5', isDark ? 'rgba(3,193,245,0.1)' : '#e0f9ff'), flex: 1 }}>Edit</button>
                      <button onClick={() => openPlanModal(c)} style={{ flex: 1, padding: '5px 12px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer', background: plan.bg, color: plan.color }}>Plan</button>
                      <button onClick={() => del(c.id)} style={{ ...btn('#ef4444', isDark ? 'rgba(239,68,68,0.1)' : '#fce8e6'), flex: 1 }}>Del</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ICON VIEW */}
          {viewMode === 'icon' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
              {displayList.map(c => {
                const plan = PLANS[c.plan || 'free'] || PLANS.free
                const score = Number(c.performance_score) || 0
                const pb = perfBadge(score)
                const sb = sourceBadge(c)
                return (
                  <div key={c.id} onClick={() => setDetailC(c)}
                    style={{ background: cardBg, border: '1px solid ' + borderCol, borderRadius: 12, padding: 16, cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s', position: 'relative' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = plan.color; e.currentTarget.style.transform = 'scale(1.03)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = borderCol; e.currentTarget.style.transform = 'scale(1)' }}
                  >
                    <span title={sb.t} style={{ position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: '50%', background: isDark ? sb.bgDark : sb.bg, color: sb.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className={'ti ' + sb.icon} style={{ fontSize: 11 }} />
                    </span>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: avatarColor(c.name) + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: avatarColor(c.name), margin: '0 auto 10px' }}>
                      {initials(c.name)}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                    <div style={{ fontSize: 10, color: textSub, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.category}</div>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                      <span style={{ background: plan.bg, color: plan.color, fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 99 }}>{plan.label}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: isDark ? pb.color + '22' : pb.bg, color: pb.color, fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 99 }}>
                        <i className={'ti ' + pb.icon} style={{ fontSize: 11 }} /> {score.toFixed(1)}
                      </span>
                    </div>
                    {c.is_verified && <div style={{ fontSize: 10, color: '#1e8e3e', marginTop: 3 }}>✓ Verified</div>}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Company Detail Modal */}
      {detailC && (
        <Modal title={detailC.name} onClose={() => setDetailC(null)} wide>
          {(() => {
            const plan   = PLANS[detailC.plan || 'free'] || PLANS.free
            const expiry = formatExpiry(detailC.plan_expires_at)
            const score  = Number(detailC.performance_score) || 0
            const pb     = perfBadge(score)
            const sb     = sourceBadge(detailC)
            const lc     = levelChip(detailC)
            const isDk   = document.documentElement.getAttribute('data-theme') === 'dark'
            const t  = isDk ? '#f1f5f9' : '#0f172a'
            const ts = isDk ? '#94a3b8' : '#64748b'
            const bc = isDk ? 'rgba(255,255,255,0.08)' : '#e2e8f0'
            const row = (label, value) => value ? (
              <div style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid ' + bc }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: ts, minWidth: 120 }}>{label}</span>
                <span style={{ fontSize: 13, color: t }}>{value}</span>
              </div>
            ) : null
            return (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, padding: 16, background: isDk ? 'rgba(255,255,255,0.03)' : '#f8fafc', borderRadius: 12 }}>
                  <div style={{ width: 60, height: 60, borderRadius: 14, background: avatarColor(detailC.name) + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: avatarColor(detailC.name), flexShrink: 0 }}>
                    {initials(detailC.name)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: t }}>{detailC.name}</div>
                    <div style={{ fontSize: 13, color: ts, marginTop: 2 }}>{detailC.category}{detailC.area ? ' · ' + detailC.area : ''}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: isDk ? sb.bgDark : sb.bg, color: sb.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99 }}>
                        <i className={'ti ' + sb.icon} style={{ fontSize: 12 }} /> {sb.t}
                      </span>
                      <span style={{ background: isDk ? 'rgba(255,255,255,0.06)' : '#f1f5f9', color: lc.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99 }}>{lc.t}</span>
                      <span style={{ background: plan.bg, color: plan.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99 }}>{plan.label}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: isDk ? pb.color + '22' : pb.bg, color: pb.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99 }}>
                        <i className={'ti ' + pb.icon} style={{ fontSize: 12 }} /> {score.toFixed(1)} performance
                      </span>
                      <span style={{ background: detailC.status === 'approved' ? (isDk ? 'rgba(30,142,62,0.2)' : '#e6f4ea') : (isDk ? 'rgba(232,184,75,0.2)' : '#fef9ed'), color: detailC.status === 'approved' ? '#1e8e3e' : '#92400e', fontSize: 11, padding: '3px 10px', borderRadius: 99 }}>{detailC.status}</span>
                      {truthy(detailC.is_verified) && <span style={{ background: isDk ? 'rgba(3,193,245,0.15)' : '#e0f9ff', color: '#03C1F5', fontSize: 11, padding: '3px 10px', borderRadius: 99 }}>✓ Verified</span>}
                    </div>
                  </div>
                  {detailC.avg_rating > 0 && (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 28, fontWeight: 700, color: t }}>{detailC.avg_rating}</div>
                      <div style={{ color: '#f9a825' }}>{'★'.repeat(Math.round(detailC.avg_rating))}</div>
                      <div style={{ fontSize: 11, color: ts }}>{detailC.total_reviews || 0} reviews</div>
                    </div>
                  )}
                </div>
                <div style={{ marginBottom: 16 }}>
                  {row('Source', truthy(detailC.is_imported) ? (truthy(detailC.claimed) ? 'Google import · Claimed by owner' : 'Google import · Unclaimed') : 'Portal registration')}
                  {row('Phone', detailC.phone)}
                  {row('WhatsApp', detailC.whatsapp)}
                  {row('Email', detailC.email || detailC.owner_email)}
                  {row('Location', detailC.area || detailC.location)}
                  {row('Category', detailC.category)}
                  {row('Performance Score', score.toFixed(1) + ' / 10')}
                  {row('Referred by', (() => { const rp = detailC.referred_by_partner_id ? partnerMap[detailC.referred_by_partner_id] : null; return rp ? `${rp.code}${rp.name ? ' · ' + rp.name : ''}` : (detailC.referred_by_partner_id ? 'Partner linked' : null) })())}
                  {row('Slug / URL', detailC.slug ? 'quvera.ae/' + detailC.slug : null)}
                  {row('Plan', plan.label + (detailC.plan_expires_at ? ' · ' + (expiry?.label || '') : ''))}
                  {row('Plan Started', detailC.plan_started_at ? new Date(detailC.plan_started_at).toLocaleDateString('en-AE') : null)}
                  {row('Plan Expires', detailC.plan_expires_at ? new Date(detailC.plan_expires_at).toLocaleDateString('en-AE', { day: 'numeric', month: 'long', year: 'numeric' }) : null)}
                  {row('Registered', new Date(detailC.created_at).toLocaleDateString('en-AE', { day: 'numeric', month: 'long', year: 'numeric' }))}
                  {detailC.description && (
                    <div style={{ padding: '10px 0', borderBottom: '1px solid ' + bc }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: ts, display: 'block', marginBottom: 4 }}>Description</span>
                      <span style={{ fontSize: 13, color: t, lineHeight: 1.6 }}>{detailC.description}</span>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setDetailC(null); setEditC(detailC) }} style={{ flex: 1, padding: 10, background: '#03C1F5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>✏️ Edit</button>
                  <button onClick={() => { setDetailC(null); openPlanModal(detailC) }} style={{ flex: 1, padding: 10, background: plan.bg, color: plan.color, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>💎 Change Plan</button>
                  <button onClick={() => { update(detailC.id, { is_verified: !truthy(detailC.is_verified) }); setDetailC(null) }} style={{ flex: 1, padding: 10, background: isDk ? 'rgba(30,142,62,0.15)' : '#e6f4ea', color: '#1e8e3e', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                    {truthy(detailC.is_verified) ? '✓ Unverify' : '✓ Verify'}
                  </button>
                  {detailC.slug && (
                    <button onClick={() => window.open('https://quvera.ae/' + detailC.slug, '_blank')} style={{ padding: '10px 14px', background: isDk ? 'rgba(255,255,255,0.05)' : '#f1f5f9', color: ts, border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>🔗 View</button>
                  )}
                </div>
              </div>
            )
          })()}
        </Modal>
      )}

      {/* Plan Modal */}
      {planModal && (
        <Modal title={'Change Plan — ' + planModal.name} onClose={() => setPlanModal(null)}>
          <div style={{ marginBottom: 16, padding: '10px 14px', background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc', borderRadius: 8, fontSize: 13, color: text }}>
            Current: <strong style={{ color: PLANS[planModal.plan || 'free']?.color }}>{PLANS[planModal.plan || 'free']?.label}</strong>
            {planModal.plan_expires_at && <span style={{ marginLeft: 8, fontSize: 12, color: formatExpiry(planModal.plan_expires_at)?.color }}>· {formatExpiry(planModal.plan_expires_at)?.label}</span>}
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: textSub, marginBottom: 8 }}>1. Select Plan</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {Object.entries(PLANS).map(([key, p]) => (
                <div key={key} onClick={() => { setSelectedPlan(key); if (key === 'free') setDiscount(0) }} style={{ padding: '12px 14px', border: '2px solid ' + (selectedPlan === key ? p.color : borderCol), borderRadius: 10, cursor: 'pointer', background: selectedPlan === key ? p.bg : 'transparent', textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: p.color }}>{p.label}</div>
                  <div style={{ fontSize: 12, color: textMuted, marginTop: 2 }}>{p.price === 0 ? 'Free' : 'AED ' + p.price + '/mo'}</div>
                </div>
              ))}
            </div>
          </div>
          {selectedPlan && selectedPlan !== 'free' && (
            <>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: textSub, marginBottom: 8 }}>2. Duration</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                  {DURATIONS.map(d => (
                    <div key={d.id} onClick={() => { setDuration(d.id); setDiscount(d.defaultDiscount) }} style={{ padding: '10px 8px', border: '2px solid ' + (duration === d.id ? '#03C1F5' : borderCol), borderRadius: 8, cursor: 'pointer', background: duration === d.id ? (isDark ? 'rgba(3,193,245,0.1)' : '#e0f9ff') : 'transparent', textAlign: 'center', position: 'relative' }}>
                      {d.defaultDiscount > 0 && <div style={{ position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)', background: '#1e8e3e', color: '#fff', fontSize: 8, fontWeight: 700, padding: '1px 6px', borderRadius: 99 }}>{d.defaultDiscount}% OFF</div>}
                      <div style={{ fontSize: 12, fontWeight: 700, color: duration === d.id ? '#03C1F5' : text }}>{d.label}</div>
                      <div style={{ fontSize: 11, color: textMuted }}>AED {planPrice * d.months}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: textSub, marginBottom: 8 }}>3. Discount %</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <input type="number" min="0" max="100" value={discount} onChange={e => setDiscount(Math.min(100, Math.max(0, Number(e.target.value))))} style={{ width: 70, padding: 8, border: '1px solid ' + borderCol, borderRadius: 6, fontSize: 16, fontWeight: 700, textAlign: 'center', background: isDark ? '#0f172a' : '#fff', color: text }} />
                  {[0, 5, 10, 15, 20].map(d => (
                    <button key={d} onClick={() => setDiscount(d)} style={{ padding: '5px 10px', border: '1px solid ' + (discount === d ? '#03C1F5' : borderCol), borderRadius: 6, fontSize: 12, cursor: 'pointer', background: discount === d ? (isDark ? 'rgba(3,193,245,0.1)' : '#e0f9ff') : 'transparent', color: discount === d ? '#03C1F5' : textSub, fontWeight: discount === d ? 600 : 400 }}>{d}%</button>
                  ))}
                </div>
              </div>
              <div style={{ background: isDark ? 'rgba(30,142,62,0.1)' : '#f0fdf4', border: '1px solid ' + (isDark ? 'rgba(52,211,153,0.2)' : '#a7f3d0'), borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#065f46', marginBottom: 10 }}>💰 Price Summary</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: text, marginBottom: 6 }}>
                  <span>{PLANS[selectedPlan]?.label} × {months}mo</span><span>AED {baseTotal}</span>
                </div>
                {discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#059669', marginBottom: 6 }}><span>Discount ({discount}%)</span><span>− AED {discountAmount}</span></div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, borderTop: '1px solid ' + (isDark ? 'rgba(52,211,153,0.2)' : '#a7f3d0'), paddingTop: 8, marginTop: 6 }}>
                  <span style={{ color: '#065f46' }}>Total</span><span style={{ color: '#059669' }}>AED {finalTotal}</span>
                </div>
                <div style={{ fontSize: 11, color: textMuted, marginTop: 6 }}>Expires: <strong>{getExpiryLabel()}</strong></div>
              </div>
            </>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={savePlan} disabled={savingPlan} style={{ flex: 1, padding: 10, background: savingPlan ? textMuted : '#03C1F5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {savingPlan ? 'Saving...' : selectedPlan === 'free' ? '✅ Set to Free' : '📤 Save & Notify'}
            </button>
            <button onClick={() => setPlanModal(null)} style={{ flex: 1, padding: 10, background: 'transparent', color: textSub, border: '1px solid ' + borderCol, borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          </div>
        </Modal>
      )}

      {/* Edit Modal */}
      {editC && (
        <Modal title="Edit Company" onClose={() => setEditC(null)}>
          {['name', 'area', 'phone', 'whatsapp', 'email', 'description'].map(f => (
            <Field key={f} label={f} value={editC[f]} onChange={v => setEditC({ ...editC, [f]: v })} />
          ))}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: textSub, display: 'block', marginBottom: 4 }}>Category</label>
            <select value={editC.category || ''} onChange={e => setEditC({ ...editC, category: e.target.value })} style={{ width: '100%', padding: '8px 10px', border: '1px solid ' + borderCol, borderRadius: 8, fontSize: 13, background: isDark ? '#0f172a' : '#fff', color: text }}>
              {CATS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={() => update(editC.id, editC)} style={{ flex: 1, padding: 10, background: '#03C1F5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Save</button>
            <button onClick={() => setEditC(null)} style={{ flex: 1, padding: 10, background: 'transparent', color: textSub, border: '1px solid ' + borderCol, borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          </div>
        </Modal>
      )}

      {/* Add Modal */}
      {addModal && (
        <Modal title="Add New Company" onClose={() => setAddModal(false)}>
          {['name', 'area', 'phone', 'whatsapp', 'email', 'description'].map(f => (
            <Field key={f} label={f} value={newC[f]} onChange={v => setNewC({ ...newC, [f]: v })} />
          ))}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: textSub, display: 'block', marginBottom: 4 }}>Category</label>
            <select value={newC.category} onChange={e => setNewC({ ...newC, category: e.target.value })} style={{ width: '100%', padding: '8px 10px', border: '1px solid ' + borderCol, borderRadius: 8, fontSize: 13, background: isDark ? '#0f172a' : '#fff', color: text }}>
              <option value="">Select category</option>
              {CATS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={addNew} style={{ flex: 1, padding: 10, background: '#03C1F5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Add Company</button>
            <button onClick={() => setAddModal(false)} style={{ flex: 1, padding: 10, background: 'transparent', color: textSub, border: '1px solid ' + borderCol, borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
