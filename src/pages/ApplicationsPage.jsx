import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

// ─── Checklist Fields ────────────────────────────────────────────────────────
const CHECKLIST_FIELDS = [
  { key: 'company_name',  label: 'Company Name',        icon: '🏢' },
  { key: 'trade_license', label: 'Trade License PDF',   icon: '📄' },
  { key: 'tl_number',     label: 'TL Number',           icon: '🔢' },
  { key: 'tl_expiry',     label: 'TL Expiry Date',      icon: '📅', checkExpiry: true },
  { key: 'category',      label: 'Business Category',   icon: '🏷️' },
  { key: 'phone',         label: 'Phone Number',        icon: '📞' },
  { key: 'email',         label: 'Email Address',       icon: '✉️' },
]

const SOCIAL_FIELDS = [
  { key: 'instagram', label: 'Instagram',  icon: '📸', placeholder: '@handle or full URL' },
  { key: 'google',    label: 'Google Biz', icon: '🔍', placeholder: 'Google Maps / Business URL' },
  { key: 'website',   label: 'Website',    icon: '🌐', placeholder: 'https://...' },
  { key: 'facebook',  label: 'Facebook',   icon: '👍', placeholder: 'Facebook page URL' },
]

// ─── Email Templates ─────────────────────────────────────────────────────────
function buildApprovalEmail(app) {
  return {
    subject: `🎉 Welcome to TrustDubai — ${app.company_name} is now Verified!`,
    body: `Dear ${app.owner_name || app.company_name},

We are pleased to inform you that your application to join TrustDubai has been reviewed and approved.

Your business profile is now live on the TrustDubai platform. Customers in Dubai can now discover and connect with your services.

━━━━━━━━━━━━━━━━━━━━━━━━
Business Name: ${app.company_name}
Category: ${app.category || '—'}
Verified on: ${new Date().toLocaleDateString('en-AE', { day: 'numeric', month: 'long', year: 'numeric' })}
━━━━━━━━━━━━━━━━━━━━━━━━

What's next?
- Log in to your TrustDubai business dashboard to complete your profile
- Add photos, services, and business hours
- Start receiving enquiries from verified customers

If you have any questions, feel free to reach out to our support team.

Welcome aboard,
The TrustDubai Team
support@trustdubai.ae`,
  }
}

function buildRejectionEmail(app, reason) {
  return {
    subject: `TrustDubai Application Update — ${app.company_name}`,
    body: `Dear ${app.owner_name || app.company_name},

Thank you for applying to list your business on TrustDubai.

After reviewing your application, we regret to inform you that we are unable to approve your registration at this time.

━━━━━━━━━━━━━━━━━━━━━━━━
Reason: ${reason || 'Does not meet our listing requirements'}
━━━━━━━━━━━━━━━━━━━━━━━━

You are welcome to re-apply once the issue has been resolved. If you believe this decision was made in error, please contact us with supporting documents.

Regards,
The TrustDubai Team
support@trustdubai.ae`,
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function initChecklist(existing) {
  const base = {}
  CHECKLIST_FIELDS.forEach(f => { base[f.key] = existing?.[f.key] ?? 'pending' })
  return base
}

function initSocial(existing) {
  const base = {}
  SOCIAL_FIELDS.forEach(f => {
    base[f.key] = {
      value: existing?.[f.key]?.value ?? '',
      verified: existing?.[f.key]?.verified ?? false,
    }
  })
  return base
}

function isExpiryWarning(dateStr) {
  if (!dateStr) return false
  const expiry = new Date(dateStr)
  const today = new Date()
  const diffDays = (expiry - today) / (1000 * 60 * 60 * 24)
  return diffDays < 90
}

function isExpired(dateStr) {
  if (!dateStr) return false
  return new Date(dateStr) < new Date()
}

function copyToClipboard(text) {
  navigator.clipboard?.writeText(text).catch(() => {})
}

// ─── Status Colors ────────────────────────────────────────────────────────────
const statusColor  = { accepted: '#10b981', rejected: '#ef4444', pending: '#9ca3af' }
const statusBg     = { accepted: '#ecfdf5', rejected: '#fef2f2', pending: '#f9fafb' }
const statusLabel  = { accepted: '✓ OK',    rejected: '✗ Reject', pending: '— Pending' }

// ═══════════════════════════════════════════════════════════════════════════════
export default function ApplicationsPage() {
  const [apps, setApps]               = useState([])
  const [loading, setLoading]         = useState(true)
  const [filter, setFilter]           = useState('pending')
  const [rejectingId, setRejectingId] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [processing, setProcessing]   = useState(false)
  const [reviewMode, setReviewMode]   = useState('easy')

  const [checklists, setChecklists]   = useState({})
  const [clNotes, setClNotes]         = useState({})
  const [socials, setSocials]         = useState({})
  const [expandedId, setExpandedId]   = useState(null)
  const [emailModal, setEmailModal]   = useState(null)

  useEffect(() => { fetchApps() },       [filter])
  useEffect(() => { fetchReviewMode() }, [])

  async function fetchReviewMode() {
    const { data } = await supabase
      .from('admin_settings').select('value').eq('key', 'review_mode').single()
    if (data) setReviewMode(data.value)
  }

  async function toggleReviewMode() {
    const newMode = reviewMode === 'easy' ? 'strict' : 'easy'
    setReviewMode(newMode)
    await supabase.from('admin_settings')
      .update({ value: newMode, updated_at: new Date().toISOString() })
      .eq('key', 'review_mode')
  }

  async function fetchApps() {
    setLoading(true)
    try {
      const { data = [] } = await supabase
        .from('company_applications')
        .select('*')
        .eq('status', filter)
        .order('applied_at', { ascending: false })
      setApps(data)
      const cl = {}, clN = {}, sc = {}
      data.forEach(app => {
        cl[app.id]  = initChecklist(app.checklist_results)
        clN[app.id] = app.checklist_notes || {}
        sc[app.id]  = initSocial(app.social_verification)
      })
      setChecklists(cl)
      setClNotes(clN)
      setSocials(sc)
    } catch (e) {
      console.error('fetch error:', e)
    } finally {
      setLoading(false)
    }
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
    setSocials(prev => ({
      ...prev,
      [appId]: { ...prev[appId], [platform]: { ...prev[appId]?.[platform], value } }
    }))
  }

  function toggleSocialVerified(appId, platform) {
    setSocials(prev => {
      const cur = prev[appId]?.[platform]?.verified ?? false
      return {
        ...prev,
        [appId]: { ...prev[appId], [platform]: { ...prev[appId]?.[platform], verified: !cur } }
      }
    })
  }

  async function saveSocials(appId) {
    const { error } = await supabase
      .from('company_applications')
      .update({ social_verification: socials[appId] })
      .eq('id', appId)
    if (error) alert('Save failed: ' + error.message)
    else alert('✅ Social media verification saved!')
  }

  async function approve(app) {
    setProcessing(true)
    const cl = checklists[app.id] || {}
    const { error } = await supabase
      .from('company_applications')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        checklist_results: cl,
        checklist_notes: clNotes[app.id] || {},
        social_verification: socials[app.id] || {},
        reviewed_by: 'Admin',
      })
      .eq('id', app.id)
    if (error) { alert('Error: ' + error.message); setProcessing(false); return }
    setProcessing(false)
    const tpl = buildApprovalEmail(app)
    setEmailModal({ app, type: 'approval', ...tpl })
    fetchApps()
  }

  async function reject(app) {
    if (!rejectReason.trim()) { alert('Please enter rejection reason'); return }
    setProcessing(true)
    const cl = checklists[app.id] || {}
    const { error } = await supabase
      .from('company_applications')
      .update({
        status: 'rejected',
        rejection_reason: rejectReason,
        reviewed_at: new Date().toISOString(),
        checklist_results: cl,
        checklist_notes: clNotes[app.id] || {},
        social_verification: socials[app.id] || {},
        reviewed_by: 'Admin',
      })
      .eq('id', app.id)
    if (error) { alert('Error: ' + error.message); setProcessing(false); return }
    setRejectingId(null)
    setProcessing(false)
    const tpl = buildRejectionEmail(app, rejectReason)
    setRejectReason('')
    setEmailModal({ app, type: 'rejection', ...tpl })
    fetchApps()
  }

  return (
    <div style={{ padding: 28, fontFamily: "'DM Sans', sans-serif" }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: '#111827' }}>Business Applications</h1>
          <p style={{ color: '#6b7280', fontSize: 14 }}>Review and approve company registration requests</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: '#6b7280' }}>Review Mode:</span>
          <button onClick={toggleReviewMode} style={{
            padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontWeight: 600, fontSize: 13,
            background: reviewMode === 'strict' ? '#fef3c7' : '#dbeafe',
            color: reviewMode === 'strict' ? '#92400e' : '#1d4ed8',
          }}>
            {reviewMode === 'strict' ? '🔒 Strict Mode' : '✓ Easy Mode'}
          </button>
          <span style={{ fontSize: 11, color: '#9ca3af', maxWidth: 160 }}>
            {reviewMode === 'strict' ? 'All fields must be accepted' : 'No rejected fields needed'}
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['pending', 'approved', 'rejected'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontWeight: 600, fontSize: 13, textTransform: 'capitalize',
            background: filter === f ? '#e8b84b' : '#f3f4f6',
            color: filter === f ? '#0d1117' : '#6b7280',
          }}>{f}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Loading...</div>
      ) : apps.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <div style={{ fontWeight: 600 }}>No {filter} applications</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {apps.map(app => <AppCard
            key={app.id}
            app={app}
            filter={filter}
            reviewMode={reviewMode}
            checklist={checklists[app.id] || {}}
            clNote={clNotes[app.id] || {}}
            social={socials[app.id] || {}}
            canApprove={canApprove(app.id)}
            isExpanded={expandedId === app.id}
            rejectingId={rejectingId}
            rejectReason={rejectReason}
            processing={processing}
            onToggleExpand={() => setExpandedId(expandedId === app.id ? null : app.id)}
            onCycleStatus={(k) => cycleStatus(app.id, k)}
            onSetNote={(k, v) => setNote(app.id, k, v)}
            onSocialValue={(p, v) => setSocialValue(app.id, p, v)}
            onToggleSocialVerified={(p) => toggleSocialVerified(app.id, p)}
            onSaveSocials={() => saveSocials(app.id)}
            onApprove={() => approve(app)}
            onReject={() => reject(app)}
            onStartReject={() => { setRejectingId(app.id); setRejectReason('') }}
            onCancelReject={() => { setRejectingId(null); setRejectReason('') }}
            onRejectReasonChange={setRejectReason}
          />)}
        </div>
      )}

      {emailModal && (
        <EmailModal
          {...emailModal}
          onClose={() => setEmailModal(null)}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// AppCard Component
// ═══════════════════════════════════════════════════════════════════════════════
function AppCard({
  app, filter, reviewMode,
  checklist, clNote, social, canApprove,
  isExpanded, rejectingId, rejectReason, processing,
  onToggleExpand, onCycleStatus, onSetNote,
  onSocialValue, onToggleSocialVerified, onSaveSocials,
  onApprove, onReject, onStartReject, onCancelReject, onRejectReasonChange,
}) {
  const [activeTab, setActiveTab] = useState('checklist')
  const allAccepted = CHECKLIST_FIELDS.every(f => checklist[f.key] === 'accepted')
  const tlUrl = 'https://ribdorraxxhfbfkjhpie.supabase.co/storage/v1/object/public/trade-licenses/' + app.tl_pdf_url
  const verifiedSocials = SOCIAL_FIELDS.filter(f => social[f.key]?.verified).length

  return (
    <div style={{
      background: 'white', border: '1px solid #e5e7eb',
      borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      {/* Top Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{app.company_name}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[app.category, app.location].filter(Boolean).map(t => (
              <span key={t} style={{ background: '#f3f4f6', color: '#374151', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99 }}>{t}</span>
            ))}
            {verifiedSocials > 0 && (
              <span style={{ background: '#ecfdf5', color: '#059669', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99 }}>
                ✓ {verifiedSocials} Social Verified
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>{new Date(app.applied_at).toLocaleDateString('en-AE')}</span>
          {app.reviewed_by && <span style={{ fontSize: 11, color: '#6b7280' }}>Reviewed by: {app.reviewed_by}</span>}
        </div>
      </div>

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
            <div key={l} style={{
              background: expired ? '#fef2f2' : isExpiring ? '#fffbeb' : '#f9fafb',
              borderRadius: 8, padding: '8px 10px',
              border: expired ? '1px solid #fca5a5' : isExpiring ? '1px solid #fcd34d' : '1px solid transparent',
            }}>
              <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>{l}</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: expired ? '#dc2626' : '#111827' }}>
                {v}
                {expired    && <span style={{ marginLeft: 6, fontSize: 10, color: '#dc2626', fontWeight: 700 }}>EXPIRED</span>}
                {isExpiring && !expired && <span style={{ marginLeft: 6, fontSize: 10, color: '#d97706', fontWeight: 700 }}>EXPIRING SOON</span>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Trade License Link */}
      {app.tl_pdf_url && (
        <div style={{ marginBottom: 12 }}>
          <a href={tlUrl} target="_blank" rel="noopener noreferrer" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', background: '#eff6ff', color: '#1d4ed8',
            borderRadius: 8, fontSize: 13, fontWeight: 500, textDecoration: 'none',
          }}>
            📄 View Trade License PDF
          </a>
        </div>
      )}

      {/* Description */}
      {app.description && (
        <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
          {app.description}
        </div>
      )}

      {/* Rejection Reason */}
      {app.rejection_reason && (
        <div style={{ background: '#fef2f2', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 13, color: '#991b1b' }}>
          <strong>Rejection reason:</strong> {app.rejection_reason}
        </div>
      )}

      {/* Verification Panel */}
      {filter === 'pending' && (
        <div style={{ marginBottom: 14 }}>
          <div
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: isExpanded ? 10 : 0, padding: '6px 0' }}
            onClick={onToggleExpand}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'flex', alignItems: 'center', gap: 8 }}>
              🔍 Verification Panel
              {allAccepted && <span style={{ color: '#10b981', fontSize: 12 }}>✓ Checklist complete</span>}
              {verifiedSocials > 0 && <span style={{ color: '#059669', fontSize: 12 }}>· {verifiedSocials} social{verifiedSocials > 1 ? 's' : ''} verified</span>}
            </span>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>{isExpanded ? '▲ Hide' : '▼ Show'}</span>
          </div>

          {isExpanded && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
              {/* Tab Bar */}
              <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                {[
                  { id: 'checklist', label: '📋 Document Checklist' },
                  { id: 'social',    label: '🌐 Social Media' },
                ].map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                    padding: '10px 20px', fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 500,
                    color: activeTab === tab.id ? '#0d1117' : '#6b7280',
                    background: activeTab === tab.id ? 'white' : 'transparent',
                    border: 'none', borderBottom: activeTab === tab.id ? '2px solid #e8b84b' : '2px solid transparent',
                    cursor: 'pointer',
                  }}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Checklist Tab */}
              {activeTab === 'checklist' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      <th style={thStyle}>Field</th>
                      <th style={thStyle}>Submitted Value</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Action</th>
                      <th style={thStyle}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CHECKLIST_FIELDS.map(({ key, label, icon, checkExpiry }) => {
                      const s    = checklist[key] ?? 'pending'
                      const val  = getFieldValue(app, key)
                      const warn = checkExpiry && isExpiryWarning(app.tl_expiry_date)
                      const exp  = checkExpiry && isExpired(app.tl_expiry_date)
                      return (
                        <tr key={key} style={{
                          background: s === 'accepted' ? '#f0fdf4' : s === 'rejected' ? '#fef2f2' : '#fff',
                          borderBottom: '1px solid #f3f4f6',
                        }}>
                          <td style={{ padding: '8px 12px', fontWeight: 500 }}>{icon} {label}</td>
                          <td style={{ padding: '8px 12px', color: val ? '#374151' : '#9ca3af', fontSize: 12 }}>
                            {val || <em>—</em>}
                            {exp  && <span style={{ marginLeft: 6, fontSize: 10, background: '#fef2f2', color: '#dc2626', padding: '1px 6px', borderRadius: 99, fontWeight: 700 }}>EXPIRED</span>}
                            {warn && !exp && <span style={{ marginLeft: 6, fontSize: 10, background: '#fffbeb', color: '#d97706', padding: '1px 6px', borderRadius: 99, fontWeight: 700 }}>EXPIRING SOON</span>}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <span style={{
                              display: 'inline-block', padding: '2px 10px', borderRadius: 99,
                              fontSize: 12, fontWeight: 500,
                              background: statusBg[s], color: statusColor[s],
                            }}>
                              {statusLabel[s]}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <button onClick={() => onCycleStatus(key)} style={{
                              padding: '4px 12px', borderRadius: 6, border: '1px solid #e5e7eb',
                              background: '#f9fafb', color: '#374151', fontSize: 12, cursor: 'pointer',
                            }}>
                              {s === 'accepted' ? 'Reject' : s === 'rejected' ? 'Clear' : 'Accept'}
                            </button>
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <input
                              type="text"
                              value={clNote[key] || ''}
                              onChange={e => onSetNote(key, e.target.value)}
                              placeholder="Add note..."
                              style={{
                                padding: '4px 8px', borderRadius: 6, border: '1px solid #e5e7eb',
                                fontSize: 12, color: '#374151', width: '100%', minWidth: 120,
                                outline: 'none', background: '#fafafa',
                              }}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}

              {/* Social Tab */}
              {activeTab === 'social' && (
                <div style={{ padding: 16 }}>
                  <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 14 }}>
                    Enter and verify the business's social media presence. Toggle verified once you've confirmed the account is real and active.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {SOCIAL_FIELDS.map(({ key, label, icon, placeholder }) => {
                      const sv = social[key] || { value: '', verified: false }
                      return (
                        <div key={key} style={{
                          display: 'grid', gridTemplateColumns: '110px 1fr auto auto',
                          alignItems: 'center', gap: 10,
                          padding: '10px 12px',
                          background: sv.verified ? '#f0fdf4' : '#f9fafb',
                          borderRadius: 8,
                          border: sv.verified ? '1px solid #a7f3d0' : '1px solid #e5e7eb',
                        }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{icon} {label}</div>
                          <input
                            type="text"
                            value={sv.value}
                            onChange={e => onSocialValue(key, e.target.value)}
                            placeholder={placeholder}
                            style={{
                              padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db',
                              fontSize: 13, outline: 'none', background: 'white',
                            }}
                          />
                          {sv.value && (
                            <a href={sv.value.startsWith('http') ? sv.value : '#'} target="_blank" rel="noopener noreferrer"
                              style={{ fontSize: 12, color: '#1d4ed8', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                              🔗 Open
                            </a>
                          )}
                          <button
                            onClick={() => onToggleSocialVerified(key)}
                            style={{
                              padding: '5px 12px', borderRadius: 6, border: 'none',
                              fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                              background: sv.verified ? '#10b981' : '#e5e7eb',
                              color: sv.verified ? 'white' : '#6b7280',
                            }}>
                            {sv.verified ? '✓ Verified' : 'Mark Verified'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                  <button onClick={onSaveSocials} style={{
                    marginTop: 14, padding: '8px 18px', background: '#0d1117', color: 'white',
                    border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer',
                  }}>
                    💾 Save Social Verification
                  </button>
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
            <textarea
              value={rejectReason}
              onChange={e => onRejectReasonChange(e.target.value)}
              placeholder="Enter rejection reason..."
              style={{
                width: '100%', padding: '10px 12px', border: '1.5px solid #ef4444',
                borderRadius: 8, fontSize: 13, marginBottom: 8, minHeight: 80,
                resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box',
              }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onReject} disabled={processing} style={{
                padding: '8px 16px', background: '#ef4444', color: 'white',
                border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer',
              }}>
                {processing ? 'Rejecting...' : 'Confirm Reject'}
              </button>
              <button onClick={onCancelReject} style={{
                padding: '8px 16px', background: '#f3f4f6', color: '#374151',
                border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer',
              }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={onApprove}
              disabled={processing || !canApprove}
              style={{
                padding: '9px 20px', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13,
                cursor: canApprove ? 'pointer' : 'not-allowed',
                background: canApprove ? '#10b981' : '#d1d5db',
                color: canApprove ? 'white' : '#9ca3af',
              }}>
              ✅ Approve
            </button>
            <button onClick={onStartReject} style={{
              padding: '9px 20px', background: '#fef2f2', color: '#ef4444',
              border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8,
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}>
              ❌ Reject
            </button>
            {!canApprove && reviewMode === 'strict' && (
              <span style={{ fontSize: 12, color: '#9ca3af' }}>All fields must be accepted first</span>
            )}
            {allAccepted && (
              <span style={{ fontSize: 12, color: '#10b981', fontWeight: 500 }}>✓ Ready to approve</span>
            )}
          </div>
        )
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Email Modal Component
// ═══════════════════════════════════════════════════════════════════════════════
function EmailModal({ app, type, subject, body, onClose }) {
  const [editedBody, setEditedBody]       = useState(body)
  const [editedSubject, setEditedSubject] = useState(subject)
  const [copied, setCopied]               = useState(false)
  const [sent, setSent]                   = useState(false)

  function handleCopy() {
    copyToClipboard(`Subject: ${editedSubject}\n\n${editedBody}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleMailto() {
    const to  = app.email || ''
    const url = `mailto:${to}?subject=${encodeURIComponent(editedSubject)}&body=${encodeURIComponent(editedBody)}`
    window.open(url, '_blank')
    setSent(true)
  }

  const isApproval = type === 'approval'

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
    }}>
      <div style={{
        background: 'white', borderRadius: 16, width: '100%', maxWidth: 640,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '18px 24px', borderBottom: '1px solid #e5e7eb',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: isApproval ? '#f0fdf4' : '#fef2f2', borderRadius: '16px 16px 0 0',
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#111827', marginBottom: 2 }}>
              {isApproval ? '✅ Approval Email Ready' : '❌ Rejection Email Ready'}
            </div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>
              To: {app.company_name} — {app.email || 'No email on file'}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af', lineHeight: 1,
          }}>✕</button>
        </div>

        {/* Subject */}
        <div style={{ padding: '12px 24px 0', borderBottom: '1px solid #f3f4f6' }}>
          <label style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>SUBJECT</label>
          <input
            value={editedSubject}
            onChange={e => setEditedSubject(e.target.value)}
            style={{
              display: 'block', width: '100%', padding: '8px 0', fontSize: 14, fontWeight: 600,
              color: '#111827', border: 'none', outline: 'none', background: 'transparent',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Body */}
        <div style={{ flex: 1, padding: '12px 24px', overflowY: 'auto' }}>
          <label style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600, display: 'block', marginBottom: 6 }}>EMAIL BODY</label>
          <textarea
            value={editedBody}
            onChange={e => setEditedBody(e.target.value)}
            style={{
              width: '100%', minHeight: 280, padding: '12px', border: '1px solid #e5e7eb',
              borderRadius: 8, fontSize: 13, lineHeight: 1.7, color: '#374151',
              fontFamily: 'monospace', resize: 'vertical', outline: 'none', boxSizing: 'border-box',
            }}
          />
          {!app.email && (
            <div style={{ marginTop: 8, padding: '8px 12px', background: '#fffbeb', borderRadius: 6, fontSize: 12, color: '#92400e' }}>
              ⚠️ No email address on file — copy the email and send manually.
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px', borderTop: '1px solid #e5e7eb',
          display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
        }}>
          <button onClick={handleMailto} style={{
            padding: '9px 20px', background: isApproval ? '#10b981' : '#ef4444',
            color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer',
          }}>
            📧 Open in Mail App
          </button>
          <button onClick={handleCopy} style={{
            padding: '9px 20px', background: '#f3f4f6', color: '#374151',
            border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer',
          }}>
            {copied ? '✓ Copied!' : '📋 Copy Email'}
          </button>
          {sent && <span style={{ fontSize: 13, color: '#10b981', fontWeight: 500 }}>✓ Email client opened</span>}
          <button onClick={onClose} style={{
            marginLeft: 'auto', padding: '9px 16px', background: 'none', color: '#9ca3af',
            border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, cursor: 'pointer',
          }}>
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const thStyle = {
  padding: '8px 12px', textAlign: 'left', fontWeight: 600,
  color: '#374151', borderBottom: '1px solid #e5e7eb', background: '#f9fafb',
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
