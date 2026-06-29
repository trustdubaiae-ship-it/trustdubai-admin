import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const CHECKLIST_FIELDS = [
  { key: 'company_name',  label: 'Company Name',      icon: '🏢' },
  { key: 'trade_license', label: 'Trade License PDF',  icon: '📄' },
  { key: 'tl_number',     label: 'TL Number',          icon: '🔢' },
  { key: 'tl_expiry',     label: 'TL Expiry Date',     icon: '📅', checkExpiry: true },
  { key: 'category',      label: 'Business Category',  icon: '🏷️' },
  { key: 'phone',         label: 'Phone Number',       icon: '📞' },
  { key: 'email',         label: 'Email Address',      icon: '✉️' },
]

const SOCIAL_FIELDS = [
  { key: 'instagram', label: 'Instagram',  icon: '📸', placeholder: '@handle or full URL' },
  { key: 'google',    label: 'Google Biz', icon: '🔍', placeholder: 'Google Maps / Business URL' },
  { key: 'website',   label: 'Website',    icon: '🌐', placeholder: 'https://...' },
  { key: 'facebook',  label: 'Facebook',   icon: '👍', placeholder: 'Facebook page URL' },
]

const PRIORITY_CONFIG = {
  low:    { label: '🟢 Low',    color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0', desc: 'Verify later' },
  medium: { label: '🟡 Medium', color: '#f59e0b', bg: '#fffbeb', border: '#fcd34d', desc: 'This week' },
  high:   { label: '🔴 High',   color: '#ef4444', bg: '#fef2f2', border: '#fca5a5', desc: 'Verify now' },
}

function buildApprovalEmail(app) {
  return {
    subject: `🎉 Welcome to Quvera — ${app.company_name} is now Verified!`,
    body: `Dear ${app.owner_name || app.company_name},

We are pleased to inform you that your application to join Quvera has been reviewed and approved.

Your business profile is now live on the Quvera platform. Customers in Dubai can now discover and connect with your services.

━━━━━━━━━━━━━━━━━━━━━━━━
Business Name: ${app.company_name}
Category: ${app.category || '—'}
Verified on: ${new Date().toLocaleDateString('en-AE', { day: 'numeric', month: 'long', year: 'numeric' })}
━━━━━━━━━━━━━━━━━━━━━━━━

What's next?
- Log in to your Quvera business dashboard to complete your profile
- Add photos, services, and business hours
- Start receiving enquiries from verified customers

Welcome aboard,
The Quvera Team
support@quvera.ae`,
  }
}

function buildRejectionEmail(app, reason, checklist, clNote) {
  const rejectedFields = CHECKLIST_FIELDS.filter(f => checklist[f.key] === 'rejected')
  const checklistSection = rejectedFields.length > 0
    ? '\nDocuments / Fields requiring attention:\n' + rejectedFields.map(f => {
        const note = clNote[f.key] ? ` — ${clNote[f.key]}` : ''
        return `  ✗ ${f.label}${note}`
      }).join('\n')
    : ''
  return {
    subject: `Quvera Application Update — ${app.company_name}`,
    body: `Dear ${app.owner_name || app.company_name},

Thank you for applying to list your business on Quvera.

After reviewing your application, we are unable to approve your registration at this time.

━━━━━━━━━━━━━━━━━━━━━━━━
Reason: ${reason || 'Does not meet our listing requirements'}
${checklistSection}
━━━━━━━━━━━━━━━━━━━━━━━━

You are welcome to re-apply once the issues have been resolved.

Regards,
The Quvera Team
support@quvera.ae`,
  }
}

function initChecklist(existing) {
  const base = {}
  CHECKLIST_FIELDS.forEach(f => { base[f.key] = existing?.[f.key] ?? 'pending' })
  return base
}

function initSocial(existing) {
  const base = {}
  SOCIAL_FIELDS.forEach(f => {
    base[f.key] = { value: existing?.[f.key]?.value ?? '', verified: existing?.[f.key]?.verified ?? false }
  })
  return base
}

function isExpiryWarning(dateStr) {
  if (!dateStr) return false
  return (new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24) < 90
}

function isExpired(dateStr) {
  if (!dateStr) return false
  return new Date(dateStr) < new Date()
}

function copyToClipboard(text) {
  navigator.clipboard?.writeText(text).catch(() => {})
}

const statusColor = { accepted: '#10b981', rejected: '#ef4444', pending: '#9ca3af' }
const statusBg    = { accepted: '#ecfdf5', rejected: '#fef2f2', pending: '#f9fafb' }
const statusLabel = { accepted: '✓ OK', rejected: '✗ Reject', pending: '— Pending' }

export default function ApplicationsPage() {
  const [apps, setApps]                     = useState([])
  const [loading, setLoading]               = useState(true)
  const [filter, setFilter]                 = useState('pending')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [rejectingId, setRejectingId]       = useState(null)
  const [rejectReason, setRejectReason]     = useState('')
  const [processing, setProcessing]         = useState(false)
  const [reviewMode, setReviewMode]         = useState('easy')
  const [checklists, setChecklists]         = useState({})
  const [clNotes, setClNotes]               = useState({})
  const [socials, setSocials]               = useState({})
  const [priorities, setPriorities]         = useState({})
  const [expandedId, setExpandedId]         = useState(null)
  const [emailModal, setEmailModal]         = useState(null)

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'

  useEffect(() => { fetchApps() }, [filter])
  useEffect(() => { fetchReviewMode() }, [])

  async function fetchReviewMode() {
    const { data } = await supabase.from('admin_settings').select('value').eq('key', 'review_mode').single()
    if (data) setReviewMode(data.value)
  }

  async function toggleReviewMode() {
    const newMode = reviewMode === 'easy' ? 'strict' : 'easy'
    setReviewMode(newMode)
    await supabase.from('admin_settings').update({ value: newMode, updated_at: new Date().toISOString() }).eq('key', 'review_mode')
  }

  async function fetchApps() {
    setLoading(true)
    try {
      const { data = [] } = await supabase
        .from('company_applications').select('*')
        .eq('status', filter).order('applied_at', { ascending: false })
      setApps(data)
      const cl = {}, clN = {}, sc = {}, pr = {}
      data.forEach(app => {
        cl[app.id]  = initChecklist(app.checklist_results)
        clN[app.id] = app.checklist_notes || {}
        sc[app.id]  = initSocial(app.social_verification)
        pr[app.id]  = app.priority || 'low'
      })
      setChecklists(cl); setClNotes(clN); setSocials(sc); setPriorities(pr)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  function cycleStatus(appId, fieldKey) {
    setChecklists(prev => {
      const cur  = prev[appId]?.[fieldKey] ?? 'pending'
      const next = cur === 'pending' ? 'accepted' : cur === 'accepted' ? 'rejected' : 'pending'
      return { ...prev, [appId]: { ...prev[appId], [fieldKey]: next } }
    })
  }

  function setNote(appId, fieldKey, val) {
    setClNotes(prev => ({ ...prev, [appId]: { ...prev[appId], [fieldKey]: val } }))
  }

  function canApprove(appId) {
    const cl = checklists[appId] || {}
    const allAccepted = CHECKLIST_FIELDS.every(f => cl[f.key] === 'accepted')
    const hasRejected = CHECKLIST_FIELDS.some(f => cl[f.key] === 'rejected')
    return reviewMode === 'strict' ? allAccepted : !hasRejected
  }

  function setSocialValue(appId, platform, value) {
    setSocials(prev => ({ ...prev, [appId]: { ...prev[appId], [platform]: { ...prev[appId]?.[platform], value } } }))
  }

  function toggleSocialVerified(appId, platform) {
    setSocials(prev => {
      const cur = prev[appId]?.[platform]?.verified ?? false
      return { ...prev, [appId]: { ...prev[appId], [platform]: { ...prev[appId]?.[platform], verified: !cur } } }
    })
  }

  async function saveSocials(appId) {
    const { error } = await supabase.from('company_applications').update({ social_verification: socials[appId] }).eq('id', appId)
    if (error) alert('Save failed: ' + error.message)
    else alert('✅ Saved!')
  }

  async function savePriority(appId, priority) {
    setPriorities(prev => ({ ...prev, [appId]: priority }))
    await supabase.from('company_applications').update({ priority }).eq('id', appId)
  }

  async function approve(app) {
    setProcessing(true)
    const cl = checklists[app.id] || {}

    const email = (app.email || '').trim().toLowerCase()

    // 1. Update application status
    const { error } = await supabase.from('company_applications').update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      checklist_results: cl,
      checklist_notes: clNotes[app.id] || {},
      social_verification: socials[app.id] || {},
      reviewed_by: 'Admin',
    }).eq('id', app.id)

    if (error) { alert('Error: ' + error.message); setProcessing(false); return }

    // SAFETY: agar email hi nahi hai to company row mat banao (warna blank-email duplicate ban jaata hai)
    if (!email) {
      setProcessing(false)
      alert('⚠️ Application approved, but no email is on file — so no company account was created. Add an email to this application, then approve again to create the business portal account.')
      const tpl = buildApprovalEmail(app)
      setEmailModal({ app, type: 'approval', ...tpl })
      fetchApps()
      return
    }

    const slug = app.company_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

    // 30-day free trial starting at activation. While the Launch Plan master switch
    // is ON, a future trial_expires_at gives the company the premium tier free; it
    // auto-reverts to its real plan when the date passes. Days come from the Launch
    // Plan config (fallback 30). Harmless if the switch is off (just ignored).
    const { data: lpCfg } = await supabase
      .from('platform_settings')
      .select('launch_plan_days')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const trialDays = Number(lpCfg?.launch_plan_days) || 30
    const trialExpires = new Date(Date.now() + trialDays * 864e5).toISOString()

    // 2. Check if company already exists by owner_email (pending row created at List Biz)
    const { data: existing } = await supabase
      .from('companies')
      .select('id')
      .ilike('owner_email', email)
      .maybeSingle()

    if (existing) {
      // 3a. Company pending row already exists → UPDATE to approved (full unlock)
      const { error: updErr } = await supabase.from('companies').update({
        status: 'approved',
        is_verified: false,
        category: app.category || '',
        location: app.location || '',
        phone: app.phone || '',
        whatsapp: app.whatsapp || app.phone || '',
        trial_expires_at: trialExpires,   // 30-day free trial from activation
        // carry the partner referral over so the partner gets credited
        ...(app.referred_by_partner_id ? { referred_by_partner_id: app.referred_by_partner_id } : {}),
      }).eq('id', existing.id)
      if (updErr) alert('Application approved but company update failed: ' + updErr.message)
    } else {
      // 3b. No company row → INSERT approved
      const { error: insertError } = await supabase.from('companies').insert({
        name: app.company_name,
        category: app.category || '',
        location: app.location || '',
        area: app.location || '',
        phone: app.phone || '',
        whatsapp: app.whatsapp || app.phone || '',
        email: email,
        business_email: email,
        owner_email: email,
        description: app.description || '',
        website: app.website || '',
        slug,
        status: 'approved',
        plan: 'free',
        trial_expires_at: trialExpires,   // 30-day free trial from activation
        is_verified: false,
        created_at: new Date().toISOString(),
        // carry the partner referral over so the partner gets credited
        referred_by_partner_id: app.referred_by_partner_id || null,
      })
      if (insertError) alert('Application approved but company insert failed: ' + insertError.message)
    }

    setProcessing(false)
    const tpl = buildApprovalEmail(app)
    setEmailModal({ app, type: 'approval', ...tpl })
    fetchApps()
  }

  async function reject(app) {
    if (!rejectReason.trim()) { alert('Please enter rejection reason'); return }
    setProcessing(true)
    const cl = checklists[app.id] || {}
    const email = (app.email || '').trim().toLowerCase()
    const { error } = await supabase.from('company_applications').update({
      status: 'rejected', rejection_reason: rejectReason,
      reviewed_at: new Date().toISOString(),
      checklist_results: cl, checklist_notes: clNotes[app.id] || {},
      social_verification: socials[app.id] || {}, reviewed_by: 'Admin',
    }).eq('id', app.id)
    if (error) { alert('Error: ' + error.message); setProcessing(false); return }

    // also mark companies pending row as rejected (so portal shows rejected state)
    if (email) {
      await supabase.from('companies').update({
        status: 'rejected',
        rejection_reason: rejectReason,
      }).ilike('owner_email', email)
    }

    setRejectingId(null); setProcessing(false)
    const tpl = buildRejectionEmail(app, rejectReason, cl, clNotes[app.id] || {})
    setRejectReason('')
    setEmailModal({ app, type: 'rejection', ...tpl })
    fetchApps()
  }

  const text      = isDark ? '#f1f5f9' : '#111827'
  const textSub   = isDark ? '#94a3b8' : '#6b7280'
  const cardBg    = isDark ? '#1e293b' : '#ffffff'
  const borderCol = isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'
  const bgRow     = isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb'

  const filteredApps = priorityFilter === 'all' ? apps : apps.filter(a => (priorities[a.id] || 'low') === priorityFilter)
  const priorityCounts = { high: 0, medium: 0, low: 0 }
  apps.forEach(a => { const p = priorities[a.id] || 'low'; priorityCounts[p]++ })

  return (
    <div style={{ maxWidth: 1100 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: text }}>Business Applications</h1>
          <p style={{ color: textSub, fontSize: 14 }}>Review and approve company registration requests</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: textSub }}>Mode:</span>
          <button onClick={toggleReviewMode} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: reviewMode === 'strict' ? (isDark ? 'rgba(251,191,36,0.15)' : '#fef3c7') : (isDark ? 'rgba(59,130,246,0.15)' : '#dbeafe'), color: reviewMode === 'strict' ? '#f59e0b' : '#3b82f6' }}>
            {reviewMode === 'strict' ? '🔒 Strict' : '✓ Easy'}
          </button>
        </div>
      </div>

      {/* Priority Summary Cards */}
      {filter === 'pending' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
          {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
            <div key={key} onClick={() => setPriorityFilter(priorityFilter === key ? 'all' : key)}
              style={{ background: priorityFilter === key ? cfg.bg : cardBg, border: '2px solid ' + (priorityFilter === key ? cfg.border : borderCol), borderRadius: 12, padding: '14px 16px', cursor: 'pointer', transition: 'all 0.15s' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: cfg.color }}>{priorityCounts[key]}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: text }}>{cfg.label}</div>
              <div style={{ fontSize: 11, color: textSub }}>{cfg.desc}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid ' + borderCol }}>
        {['pending', 'approved', 'rejected'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 500, fontSize: 13, textTransform: 'capitalize', borderBottom: filter === f ? '2px solid #03C1F5' : '2px solid transparent', color: filter === f ? '#03C1F5' : textSub }}>
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: textSub }}>
          <div style={{ width: 36, height: 36, border: '3px solid #03C1F5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          Loading...
        </div>
      ) : filteredApps.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: textSub }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <div style={{ fontWeight: 600, color: text }}>No {filter} applications</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filteredApps.map(app => (
            <AppCard
              key={app.id}
              app={app}
              filter={filter}
              reviewMode={reviewMode}
              checklist={checklists[app.id] || {}}
              clNote={clNotes[app.id] || {}}
              social={socials[app.id] || {}}
              priority={priorities[app.id] || 'low'}
              canApprove={canApprove(app.id)}
              isExpanded={expandedId === app.id}
              rejectingId={rejectingId}
              rejectReason={rejectReason}
              processing={processing}
              isDark={isDark}
              onToggleExpand={() => setExpandedId(expandedId === app.id ? null : app.id)}
              onCycleStatus={(k) => cycleStatus(app.id, k)}
              onSetNote={(k, v) => setNote(app.id, k, v)}
              onSocialValue={(p, v) => setSocialValue(app.id, p, v)}
              onToggleSocialVerified={(p) => toggleSocialVerified(app.id, p)}
              onSaveSocials={() => saveSocials(app.id)}
              onPriorityChange={(p) => savePriority(app.id, p)}
              onApprove={() => approve(app)}
              onReject={() => reject(app)}
              onStartReject={() => { setRejectingId(app.id); setRejectReason('') }}
              onCancelReject={() => { setRejectingId(null); setRejectReason('') }}
              onRejectReasonChange={setRejectReason}
            />
          ))}
        </div>
      )}

      {emailModal && <EmailModal {...emailModal} onClose={() => setEmailModal(null)} />}
    </div>
  )
}

function AppCard({
  app, filter, reviewMode, checklist, clNote, social, priority, canApprove,
  isExpanded, rejectingId, rejectReason, processing, isDark,
  onToggleExpand, onCycleStatus, onSetNote, onSocialValue,
  onToggleSocialVerified, onSaveSocials, onPriorityChange,
  onApprove, onReject, onStartReject, onCancelReject, onRejectReasonChange,
}) {
  const [activeTab, setActiveTab] = useState('checklist')

  const text      = isDark ? '#f1f5f9' : '#111827'
  const textSub   = isDark ? '#94a3b8' : '#6b7280'
  const textMuted = isDark ? '#475569' : '#9ca3af'
  const cardBg    = isDark ? '#1e293b' : '#ffffff'
  const borderCol = isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'
  const bgRow     = isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb'

  const allAccepted     = CHECKLIST_FIELDS.every(f => checklist[f.key] === 'accepted')
  const rejectedFields  = CHECKLIST_FIELDS.filter(f => checklist[f.key] === 'rejected')
  const pendingFields   = CHECKLIST_FIELDS.filter(f => checklist[f.key] === 'pending')
  const verifiedSocials = SOCIAL_FIELDS.filter(f => social[f.key]?.verified).length
  const tlUrl = 'https://ribdorraxxhfbfkjhpie.supabase.co/storage/v1/object/public/trade-licenses/' + app.tl_pdf_url
  const pCfg  = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.low

  return (
    <div style={{ background: cardBg, border: '1px solid ' + borderCol, borderRadius: 14, padding: 20, boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.2)' : '0 1px 4px rgba(0,0,0,0.06)' }}>

      {/* Top Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: text }}>{app.company_name}</div>
            <span style={{ background: pCfg.bg, color: pCfg.color, fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 99, border: '1px solid ' + pCfg.border }}>{pCfg.label}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[app.category, app.location].filter(Boolean).map(t => (
              <span key={t} style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6', color: isDark ? '#94a3b8' : '#374151', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99 }}>{t}</span>
            ))}
            {verifiedSocials > 0 && <span style={{ background: isDark ? 'rgba(16,185,129,0.15)' : '#ecfdf5', color: '#10b981', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99 }}>✓ {verifiedSocials} Social Verified</span>}
            {rejectedFields.length > 0 && <span style={{ background: isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2', color: '#ef4444', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99 }}>✗ {rejectedFields.length} Rejected</span>}
            {pendingFields.length > 0 && filter === 'pending' && <span style={{ background: isDark ? 'rgba(156,163,175,0.15)' : '#f9fafb', color: textMuted, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99 }}>⏳ {pendingFields.length} Pending</span>}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <span style={{ fontSize: 11, color: textMuted }}>{new Date(app.applied_at).toLocaleDateString('en-AE')}</span>
          {app.reviewed_by && <span style={{ fontSize: 11, color: textSub }}>By: {app.reviewed_by}</span>}
          {filter === 'pending' && (
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                <button key={key} onClick={() => onPriorityChange(key)} title={cfg.label} style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid ' + (priority === key ? cfg.color : borderCol), background: priority === key ? cfg.bg : 'transparent', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {key === 'high' ? '🔴' : key === 'medium' ? '🟡' : '🟢'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pending Document Notes */}
      {filter === 'pending' && (rejectedFields.length > 0 || pendingFields.length > 0) && (
        <div style={{ background: isDark ? 'rgba(239,68,68,0.08)' : '#fff7f7', border: '1px solid ' + (isDark ? 'rgba(239,68,68,0.2)' : '#fca5a5'), borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', marginBottom: 8 }}>📋 Pending Document Notes</div>
          {rejectedFields.map(f => (
            <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: '#ef4444', fontWeight: 600 }}>✗</span>
              <span style={{ color: text, fontWeight: 500 }}>{f.icon} {f.label}</span>
              {clNote[f.key] && <span style={{ color: textSub }}>— {clNote[f.key]}</span>}
            </div>
          ))}
          {pendingFields.map(f => (
            <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: textMuted, fontWeight: 600 }}>⏳</span>
              <span style={{ color: textSub }}>{f.icon} {f.label}</span>
              {clNote[f.key] && <span style={{ color: textMuted }}>— {clNote[f.key]}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Info Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        {[
          ['👤 Owner', app.owner_name],
          ['📞 Phone', app.phone],
          ['✉️ Email', app.email],
          ['💬 WhatsApp', app.whatsapp],
          ['🔢 TL Number', app.tl_number],
          ['📅 TL Expiry', app.tl_expiry_date],
        ].filter(([, v]) => v).map(([l, v]) => {
          const isExpiring = l.includes('Expiry') && isExpiryWarning(v)
          const expired    = l.includes('Expiry') && isExpired(v)
          return (
            <div key={l} style={{ background: expired ? (isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2') : isExpiring ? (isDark ? 'rgba(245,158,11,0.1)' : '#fffbeb') : bgRow, borderRadius: 8, padding: '8px 10px', border: '1px solid ' + (expired ? (isDark ? 'rgba(239,68,68,0.2)' : '#fca5a5') : isExpiring ? (isDark ? 'rgba(245,158,11,0.2)' : '#fcd34d') : borderCol) }}>
              <div style={{ fontSize: 11, color: textMuted, marginBottom: 2 }}>{l}</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: expired ? '#ef4444' : text }}>
                {v}
                {expired && <span style={{ marginLeft: 6, fontSize: 10, color: '#ef4444', fontWeight: 700 }}>EXPIRED</span>}
                {isExpiring && !expired && <span style={{ marginLeft: 6, fontSize: 10, color: '#f59e0b', fontWeight: 700 }}>EXPIRING SOON</span>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Trade License */}
      {app.tl_pdf_url && (
        <div style={{ marginBottom: 12 }}>
          <a href={tlUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff', color: '#3b82f6', borderRadius: 8, fontSize: 13, fontWeight: 500, textDecoration: 'none', border: '1px solid ' + (isDark ? 'rgba(59,130,246,0.2)' : '#bfdbfe') }}>
            📄 View Trade License PDF
          </a>
        </div>
      )}

      {/* Description */}
      {app.description && (
        <div style={{ background: bgRow, borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 13, color: textSub, lineHeight: 1.6, border: '1px solid ' + borderCol }}>
          {app.description}
        </div>
      )}

      {/* Rejection Reason */}
      {app.rejection_reason && (
        <div style={{ background: isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 13, color: '#ef4444' }}>
          <strong>Rejection reason:</strong> {app.rejection_reason}
        </div>
      )}

      {/* Verification Panel */}
      {filter === 'pending' && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '8px 0', marginBottom: isExpanded ? 10 : 0 }} onClick={onToggleExpand}>
            <span style={{ fontSize: 13, fontWeight: 600, color: text, display: 'flex', alignItems: 'center', gap: 8 }}>
              🔍 Verification Panel
              {allAccepted && <span style={{ color: '#10b981', fontSize: 12 }}>✓ Complete</span>}
            </span>
            <span style={{ fontSize: 12, color: textMuted }}>{isExpanded ? '▲ Hide' : '▼ Show'}</span>
          </div>

          {isExpanded && (
            <div style={{ border: '1px solid ' + borderCol, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'flex', borderBottom: '1px solid ' + borderCol, background: bgRow }}>
                {[{ id: 'checklist', label: '📋 Document Checklist' }, { id: 'social', label: '🌐 Social Media' }].map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ padding: '10px 20px', fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 500, color: activeTab === tab.id ? text : textSub, background: activeTab === tab.id ? cardBg : 'transparent', border: 'none', borderBottom: activeTab === tab.id ? '2px solid #03C1F5' : '2px solid transparent', cursor: 'pointer' }}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === 'checklist' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: bgRow }}>
                      {['Field', 'Submitted Value', 'Status', 'Action', 'Notes'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: textSub, borderBottom: '1px solid ' + borderCol }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {CHECKLIST_FIELDS.map(({ key, label, icon, checkExpiry }) => {
                      const s    = checklist[key] ?? 'pending'
                      const val  = getFieldValue(app, key)
                      const warn = checkExpiry && isExpiryWarning(app.tl_expiry_date)
                      const exp  = checkExpiry && isExpired(app.tl_expiry_date)
                      return (
                        <tr key={key} style={{ background: s === 'accepted' ? (isDark ? 'rgba(16,185,129,0.08)' : '#f0fdf4') : s === 'rejected' ? (isDark ? 'rgba(239,68,68,0.08)' : '#fef2f2') : 'transparent', borderBottom: '1px solid ' + borderCol }}>
                          <td style={{ padding: '8px 12px', fontWeight: 500, color: text }}>{icon} {label}</td>
                          <td style={{ padding: '8px 12px', color: val ? textSub : textMuted, fontSize: 12 }}>
                            {val || <em>—</em>}
                            {exp  && <span style={{ marginLeft: 6, fontSize: 10, background: isDark ? 'rgba(239,68,68,0.2)' : '#fef2f2', color: '#ef4444', padding: '1px 6px', borderRadius: 99, fontWeight: 700 }}>EXPIRED</span>}
                            {warn && !exp && <span style={{ marginLeft: 6, fontSize: 10, background: isDark ? 'rgba(245,158,11,0.2)' : '#fffbeb', color: '#f59e0b', padding: '1px 6px', borderRadius: 99, fontWeight: 700 }}>EXPIRING SOON</span>}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 99, fontSize: 12, fontWeight: 500, background: statusBg[s], color: statusColor[s] }}>{statusLabel[s]}</span>
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <button onClick={() => onCycleStatus(key)} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid ' + borderCol, background: isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb', color: text, fontSize: 12, cursor: 'pointer' }}>
                              {s === 'accepted' ? 'Reject' : s === 'rejected' ? 'Clear' : 'Accept'}
                            </button>
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <input type="text" value={clNote[key] || ''} onChange={e => onSetNote(key, e.target.value)} placeholder="Add note..." style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid ' + borderCol, fontSize: 12, color: text, width: '100%', minWidth: 120, outline: 'none', background: isDark ? 'rgba(255,255,255,0.05)' : '#fafafa' }} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}

              {activeTab === 'social' && (
                <div style={{ padding: 16 }}>
                  <p style={{ fontSize: 12, color: textMuted, marginBottom: 14 }}>Enter and verify the business's social media presence.</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {SOCIAL_FIELDS.map(({ key, label, icon, placeholder }) => {
                      const sv = social[key] || { value: '', verified: false }
                      return (
                        <div key={key} style={{ display: 'grid', gridTemplateColumns: '110px 1fr auto auto', alignItems: 'center', gap: 10, padding: '10px 12px', background: sv.verified ? (isDark ? 'rgba(16,185,129,0.08)' : '#f0fdf4') : bgRow, borderRadius: 8, border: '1px solid ' + (sv.verified ? (isDark ? 'rgba(16,185,129,0.2)' : '#a7f3d0') : borderCol) }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: text }}>{icon} {label}</div>
                          <input type="text" value={sv.value} onChange={e => onSocialValue(key, e.target.value)} placeholder={placeholder} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid ' + borderCol, fontSize: 13, outline: 'none', background: isDark ? 'rgba(255,255,255,0.05)' : 'white', color: text }} />
                          {sv.value && <a href={sv.value.startsWith('http') ? sv.value : '#'} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#3b82f6', textDecoration: 'none', whiteSpace: 'nowrap' }}>🔗 Open</a>}
                          <button onClick={() => onToggleSocialVerified(key)} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', background: sv.verified ? '#10b981' : (isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb'), color: sv.verified ? 'white' : textSub }}>
                            {sv.verified ? '✓ Verified' : 'Mark Verified'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                  <button onClick={onSaveSocials} style={{ marginTop: 14, padding: '8px 18px', background: '#03C1F5', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>💾 Save Social Verification</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      {filter === 'pending' && (
        rejectingId === app.id ? (
          <div>
            <textarea value={rejectReason} onChange={e => onRejectReasonChange(e.target.value)} placeholder="Enter rejection reason..." autoFocus style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #ef4444', borderRadius: 8, fontSize: 13, marginBottom: 8, minHeight: 80, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', background: isDark ? '#0f172a' : '#fff', color: text }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onReject} disabled={processing} style={{ padding: '8px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                {processing ? 'Rejecting...' : 'Confirm Reject'}
              </button>
              <button onClick={onCancelReject} style={{ padding: '8px 16px', background: isDark ? 'rgba(255,255,255,0.1)' : '#f3f4f6', color: text, border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={onApprove} disabled={processing || !canApprove} style={{ padding: '9px 20px', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: canApprove ? 'pointer' : 'not-allowed', background: canApprove ? '#10b981' : (isDark ? 'rgba(255,255,255,0.1)' : '#d1d5db'), color: canApprove ? 'white' : textMuted }}>
              ✅ Approve
            </button>
            <button onClick={onStartReject} style={{ padding: '9px 20px', background: isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              ❌ Reject
            </button>
            {!canApprove && reviewMode === 'strict' && <span style={{ fontSize: 12, color: textMuted }}>All fields must be accepted first</span>}
            {allAccepted && <span style={{ fontSize: 12, color: '#10b981', fontWeight: 500 }}>✓ Ready to approve</span>}
          </div>
        )
      )}
    </div>
  )
}

function EmailModal({ app, type, subject, body, onClose }) {
  const [editedBody, setEditedBody]       = useState(body)
  const [editedSubject, setEditedSubject] = useState(subject)
  const [copied, setCopied]               = useState(false)
  const [sent, setSent]                   = useState(false)
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
  const isApproval = type === 'approval'

  function handleCopy() {
    copyToClipboard(`Subject: ${editedSubject}\n\n${editedBody}`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  function handleMailto() {
    window.open(`mailto:${app.email || ''}?subject=${encodeURIComponent(editedSubject)}&body=${encodeURIComponent(editedBody)}`, '_blank')
    setSent(true)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: isDark ? '#1e293b' : 'white', borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', border: '1px solid ' + (isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb') }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid ' + (isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'), display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isApproval ? (isDark ? 'rgba(16,185,129,0.1)' : '#f0fdf4') : (isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2'), borderRadius: '16px 16px 0 0' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: isDark ? '#f1f5f9' : '#111827', marginBottom: 2 }}>{isApproval ? '✅ Approval Email Ready' : '❌ Rejection Email Ready'}</div>
            <div style={{ fontSize: 13, color: isDark ? '#94a3b8' : '#6b7280' }}>To: {app.company_name} — {app.email || 'No email on file'}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: isDark ? '#94a3b8' : '#9ca3af' }}>✕</button>
        </div>
        <div style={{ padding: '12px 24px 0', borderBottom: '1px solid ' + (isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6') }}>
          <label style={{ fontSize: 12, color: isDark ? '#475569' : '#9ca3af', fontWeight: 600 }}>SUBJECT</label>
          <input value={editedSubject} onChange={e => setEditedSubject(e.target.value)} style={{ display: 'block', width: '100%', padding: '8px 0', fontSize: 14, fontWeight: 600, color: isDark ? '#f1f5f9' : '#111827', border: 'none', outline: 'none', background: 'transparent', boxSizing: 'border-box' }} />
        </div>
        <div style={{ flex: 1, padding: '12px 24px', overflowY: 'auto' }}>
          <label style={{ fontSize: 12, color: isDark ? '#475569' : '#9ca3af', fontWeight: 600, display: 'block', marginBottom: 6 }}>EMAIL BODY</label>
          <textarea value={editedBody} onChange={e => setEditedBody(e.target.value)} style={{ width: '100%', minHeight: 280, padding: '12px', border: '1px solid ' + (isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb'), borderRadius: 8, fontSize: 13, lineHeight: 1.7, color: isDark ? '#f1f5f9' : '#374151', fontFamily: 'monospace', resize: 'vertical', outline: 'none', boxSizing: 'border-box', background: isDark ? 'rgba(255,255,255,0.03)' : '#fff' }} />
        </div>
        <div style={{ padding: '14px 24px', borderTop: '1px solid ' + (isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'), display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={handleMailto} style={{ padding: '9px 20px', background: isApproval ? '#10b981' : '#ef4444', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>📧 Open in Mail App</button>
          <button onClick={handleCopy} style={{ padding: '9px 20px', background: isDark ? 'rgba(255,255,255,0.1)' : '#f3f4f6', color: isDark ? '#f1f5f9' : '#374151', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>{copied ? '✓ Copied!' : '📋 Copy Email'}</button>
          {sent && <span style={{ fontSize: 13, color: '#10b981', fontWeight: 500 }}>✓ Email client opened</span>}
          <button onClick={onClose} style={{ marginLeft: 'auto', padding: '9px 16px', background: 'none', color: isDark ? '#94a3b8' : '#9ca3af', border: '1px solid ' + (isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb'), borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Skip</button>
        </div>
      </div>
    </div>
  )
}

function getFieldValue(app, key) {
  const map = {
    company_name:  app.company_name,
    trade_license: app.tl_pdf_url ? '✓ Uploaded' : null,
    tl_number:     app.tl_number,
    tl_expiry:     app.tl_expiry_date,
    category:      app.category,
    phone:         app.phone,
    email:         app.email,
  }
  return map[key] || null
}
