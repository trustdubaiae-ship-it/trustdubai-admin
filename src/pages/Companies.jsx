import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const CATS = ['Interior Design','Renovation','Technical Contracting','Fit-Out','AC Service','Plumbing','Electrical','Cleaning','Painting','Handyman','Restaurant','Gym','Medical','Legal','Salon','Hotel','Other']

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

  const [tab, setTab] = useState('approved')
  const [viewMode, setViewMode] = useState('list') // list | card | icon
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
  const [newC, setNewC] = useState({ name: '', category: '', area: '', phone: '', whatsapp: '', email: '', description: '' })

  useEffect(() => {
    fetchAll()
    fetchAdminData()
    const observer = new MutationObserver(() => forceUpdate(n => n + 1))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (initialPlanFilter) setPlanFilter(initialPlanFilter)
  }, [initialPlanFilter])

  async function fetchAdminData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase.from('admin_users').select('*').eq('email', user.email).single()
      setAdminData(data)
    }
  }

  async function fetchAll() {
    setLoading(true)
    const { data } = await supabase.from('companies').select('*').order('created_at', { ascending: false })
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
    await supabase.from('companies').insert({ ...newC, status: 'approved' })
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
    await supabase.from('companies').update({ plan: selectedPlan, plan_started_at: new Date().toISOString(), plan_expires_at: expiryDate }).eq('id', planModal.id)

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

  const pending = companies.filter(c => c.status === 'pending' || c.status === 'under_review')
  const approved = companies.filter(c => c.status === 'approved')
  let displayList = tab === 'pending' ? pending : tab === 'approved' ? approved : companies
  if (planFilter !== 'all') displayList = displayList.filter(c => (c.plan || 'free') === planFilter)
  if (search) displayList = displayList.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()) || c.category?.toLowerCase().includes(search.toLowerCase()) || c.area?.toLowerCase().includes(search.toLowerCase()))

  const text = isDark ? '#f1f5f9' : '#0f172a'
  const textSub = isDark ? '#94a3b8' : '#64748b'
  const textMuted = isDark ? '#475569' : '#94a3b8'
  const borderCol = isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'
  const cardBg = isDark ? '#1e293b' : '#ffffff'
  const bgRow = isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc'

  const btn = (color, bg) => ({ padding: '5px 12px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer', color, background: bg })

  const initials = (name) => name?.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
  const avatarColors = ['#1a73e8', '#1e8e3e', '#d93025', '#f9a825', '#9c27b0', '#00897b']
  const avatarColor = (name) => avatarColors[name?.charCodeAt(0) % avatarColors.length] || '#1a73e8'

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: text }}>Companies</h1>
          <p style={{ fontSize: 13, color: textSub, marginTop: 4 }}>Manage all listings · {displayList.length} shown</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* View toggle */}
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

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search company, category, area..."
          style={{ flex: 1, minWidth: 200, padding: '8px 12px', border: '1px solid ' + borderCol, borderRadius: 8, fontSize: 13, background: cardBg, color: text, outline: 'none' }}
        />
        <select value={planFilter} onChange={e => setPlanFilter(e.target.value)} style={{ padding: '8px 12px', border: '1px solid ' + borderCol, borderRadius: 8, fontSize: 13, background: cardBg, color: text, outline: 'none', cursor: 'pointer' }}>
          <option value="all">All Plans</option>
          {Object.entries(PLANS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
        </select>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid ' + borderCol }}>
        {[
          { id: 'pending',  label: 'Pending (' + pending.length + ')' },
          { id: 'approved', label: 'Approved (' + approved.length + ')' },
          { id: 'all',      label: 'All (' + companies.length + ')' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '10px 20px', border: 'none', background: 'none', borderBottom: tab === t.id ? '2px solid #03C1F5' : '2px solid transparent', color: tab === t.id ? '#03C1F5' : textSub, fontWeight: 500, fontSize: 13, cursor: 'pointer' }}>
            {t.label}
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
            <div style={{ background: cardBg, border: '1px solid ' + borderCol, borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: bgRow }}>
                    {['Company', 'Category', 'Area', 'Plan', 'Expiry', 'Status', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: textSub, borderBottom: '1px solid ' + borderCol }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayList.map(c => {
                    const plan = PLANS[c.plan || 'free'] || PLANS.free
                    const expiry = formatExpiry(c.plan_expires_at)
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
                              <div style={{ fontSize: 13, fontWeight: 600, color: text }}>{c.name}</div>
                              <div style={{ fontSize: 11, color: textMuted }}>{c.owner_email}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: textSub }} onClick={() => setDetailC(c)}>{c.category}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: textSub }} onClick={() => setDetailC(c)}>{c.area || '—'}</td>
                        <td style={{ padding: '12px 16px' }} onClick={() => setDetailC(c)}>
                          <span style={{ background: plan.bg, color: plan.color, fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 99 }}>{plan.label}</span>
                        </td>
                        <td style={{ padding: '12px 16px' }} onClick={() => setDetailC(c)}>
                          {!c.plan_expires_at ? <span style={{ fontSize: 12, color: textMuted }}>—</span> : expiry ? <span style={{ fontSize: 12, fontWeight: 500, color: expiry.color }}>{expiry.days < 0 ? '⚠️ ' : ''}{expiry.label}</span> : null}
                        </td>
                        <td style={{ padding: '12px 16px' }} onClick={() => setDetailC(c)}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <span style={{ background: c.status === 'approved' ? (isDark ? 'rgba(30,142,62,0.2)' : '#e6f4ea') : (isDark ? 'rgba(232,184,75,0.2)' : '#fef9ed'), color: c.status === 'approved' ? '#1e8e3e' : '#92400e', fontSize: 11, padding: '2px 8px', borderRadius: 10, display: 'inline-block' }}>{c.status}</span>
                            {c.is_verified && <span style={{ background: isDark ? 'rgba(3,193,245,0.15)' : '#e0f9ff', color: '#03C1F5', fontSize: 11, padding: '2px 8px', borderRadius: 10, display: 'inline-block' }}>✓ Verified</span>}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                            <button onClick={e => { e.stopPropagation(); setEditC(c) }} style={btn('#03C1F5', isDark ? 'rgba(3,193,245,0.1)' : '#e0f9ff')}>Edit</button>
                            <button onClick={e => { e.stopPropagation(); update(c.id, { is_verified: !c.is_verified }) }} style={btn('#1e8e3e', isDark ? 'rgba(30,142,62,0.1)' : '#e6f4ea')}>{c.is_verified ? 'Unverify' : 'Verify'}</button>
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
                const plan = PLANS[c.plan || 'free'] || PLANS.free
                const expiry = formatExpiry(c.plan_expires_at)
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
                      <span style={{ background: c.status === 'approved' ? (isDark ? 'rgba(30,142,62,0.2)' : '#e6f4ea') : (isDark ? 'rgba(232,184,75,0.2)' : '#fef9ed'), color: c.status === 'approved' ? '#1e8e3e' : '#92400e', fontSize: 11, padding: '2px 8px', borderRadius: 8 }}>{c.status}</span>
                      {c.is_verified && <span style={{ background: isDark ? 'rgba(3,193,245,0.15)' : '#e0f9ff', color: '#03C1F5', fontSize: 11, padding: '2px 8px', borderRadius: 8 }}>✓ Verified</span>}
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
                return (
                  <div key={c.id} onClick={() => setDetailC(c)}
                    style={{ background: cardBg, border: '1px solid ' + borderCol, borderRadius: 12, padding: 16, cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = plan.color; e.currentTarget.style.transform = 'scale(1.03)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = borderCol; e.currentTarget.style.transform = 'scale(1)' }}
                  >
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: avatarColor(c.name) + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: avatarColor(c.name), margin: '0 auto 10px' }}>
                      {initials(c.name)}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                    <div style={{ fontSize: 10, color: textSub, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.category}</div>
                    <span style={{ display: 'inline-block', marginTop: 6, background: plan.bg, color: plan.color, fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 99 }}>{plan.label}</span>
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
            const plan = PLANS[detailC.plan || 'free'] || PLANS.free
            const expiry = formatExpiry(detailC.plan_expires_at)
            const isDk = document.documentElement.getAttribute('data-theme') === 'dark'
            const t = isDk ? '#f1f5f9' : '#0f172a'
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
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, padding: '16px', background: isDk ? 'rgba(255,255,255,0.03)' : '#f8fafc', borderRadius: 12 }}>
                  <div style={{ width: 60, height: 60, borderRadius: 14, background: avatarColor(detailC.name) + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: avatarColor(detailC.name), flexShrink: 0 }}>
                    {initials(detailC.name)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: t }}>{detailC.name}</div>
                    <div style={{ fontSize: 13, color: ts, marginTop: 2 }}>{detailC.category} {detailC.area ? '· ' + detailC.area : ''}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                      <span style={{ background: plan.bg, color: plan.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99 }}>{plan.label}</span>
                      <span style={{ background: detailC.status === 'approved' ? (isDk ? 'rgba(30,142,62,0.2)' : '#e6f4ea') : (isDk ? 'rgba(232,184,75,0.2)' : '#fef9ed'), color: detailC.status === 'approved' ? '#1e8e3e' : '#92400e', fontSize: 11, padding: '3px 10px', borderRadius: 99 }}>{detailC.status}</span>
                      {detailC.is_verified && <span style={{ background: isDk ? 'rgba(3,193,245,0.15)' : '#e0f9ff', color: '#03C1F5', fontSize: 11, padding: '3px 10px', borderRadius: 99 }}>✓ Verified</span>}
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

                {/* Details */}
                <div style={{ marginBottom: 16 }}>
                  {row('Phone', detailC.phone)}
                  {row('WhatsApp', detailC.whatsapp)}
                  {row('Email', detailC.email || detailC.owner_email)}
                  {row('Location', detailC.area || detailC.location)}
                  {row('Category', detailC.category)}
                  {row('Slug / URL', detailC.slug ? 'trustdubai.ae/' + detailC.slug : null)}
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

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setDetailC(null); setEditC(detailC) }} style={{ flex: 1, padding: '10px', background: '#03C1F5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>✏️ Edit</button>
                  <button onClick={() => { setDetailC(null); openPlanModal(detailC) }} style={{ flex: 1, padding: '10px', background: plan.bg, color: plan.color, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>💎 Change Plan</button>
                  <button onClick={() => { update(detailC.id, { is_verified: !detailC.is_verified }); setDetailC(null) }} style={{ flex: 1, padding: '10px', background: isDk ? 'rgba(30,142,62,0.15)' : '#e6f4ea', color: '#1e8e3e', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                    {detailC.is_verified ? '✓ Unverify' : '✓ Verify'}
                  </button>
                  {detailC.slug && (
                    <button onClick={() => window.open('https://trustdubai.ae/' + detailC.slug, '_blank')} style={{ padding: '10px 14px', background: isDk ? 'rgba(255,255,255,0.05)' : '#f1f5f9', color: ts, border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>🔗 View</button>
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
                  <input type="number" min="0" max="100" value={discount} onChange={e => setDiscount(Math.min(100, Math.max(0, Number(e.target.value))))} style={{ width: 70, padding: '8px', border: '1px solid ' + borderCol, borderRadius: 6, fontSize: 16, fontWeight: 700, textAlign: 'center', background: isDark ? '#0f172a' : '#fff', color: text }} />
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
