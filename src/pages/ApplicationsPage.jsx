import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const CHECKLIST_FIELDS = [
  { key: 'company_name',  label: 'Company Name' },
  { key: 'trade_license', label: 'Trade License PDF' },
  { key: 'tl_number',     label: 'TL Number' },
  { key: 'tl_expiry',     label: 'TL Expiry Date' },
  { key: 'category',      label: 'Business Category' },
  { key: 'phone',         label: 'Phone Number' },
  { key: 'email',         label: 'Email Address' },
]

function initChecklist(existing) {
  const base = {}
  CHECKLIST_FIELDS.forEach(f => { base[f.key] = existing?.[f.key] ?? 'pending' })
  return base
}

export default function ApplicationsPage() {
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [rejectingId, setRejectingId] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [processing, setProcessing] = useState(false)
  const [reviewMode, setReviewMode] = useState('easy')
  const [checklists, setChecklists] = useState({})
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => { fetchApps() }, [filter])
  useEffect(() => { fetchReviewMode() }, [])

  async function fetchReviewMode() {
    const { data } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'review_mode')
      .single()
    if (data) setReviewMode(data.value)
  }

  async function toggleReviewMode() {
    const newMode = reviewMode === 'easy' ? 'strict' : 'easy'
    setReviewMode(newMode)
    await supabase
      .from('admin_settings')
      .update({ value: newMode, updated_at: new Date().toISOString() })
      .eq('key', 'review_mode')
  }

  async function fetchApps() {
    setLoading(true)
    try {
      const result = await supabase
        .from('company_applications')
        .select('*')
        .eq('status', filter)
        .order('applied_at', { ascending: false })
      const data = result.data || []
      setApps(data)
      const cl = {}
      data.forEach(app => { cl[app.id] = initChecklist(app.checklist_results) })
      setChecklists(cl)
    } catch(e) {
      console.error('fetch error:', e)
    } finally {
      setLoading(false)
    }
  }

  function cycleStatus(appId, fieldKey) {
    setChecklists(prev => {
      const current = prev[appId]?.[fieldKey] ?? 'pending'
      const next = current === 'pending' ? 'accepted' : current === 'accepted' ? 'rejected' : 'pending'
      return { ...prev, [appId]: { ...prev[appId], [fieldKey]: next } }
    })
  }

  function canApprove(appId) {
    const cl = checklists[appId] || {}
    const allAccepted = CHECKLIST_FIELDS.every(f => cl[f.key] === 'accepted')
    const hasRejected = CHECKLIST_FIELDS.some(f => cl[f.key] === 'rejected')
    return reviewMode === 'strict' ? allAccepted : !hasRejected
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
        reviewed_by: 'Admin',
      })
      .eq('id', app.id)

    if (error) { alert('Error: ' + error.message); setProcessing(false); return }
    alert('✅ ' + app.company_name + ' approved!')
    setProcessing(false)
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
        reviewed_by: 'Admin',
      })
      .eq('id', app.id)

    if (error) { alert('Error: ' + error.message); setProcessing(false); return }
    setRejectingId(null)
    setRejectReason('')
    alert('❌ ' + app.company_name + ' rejected.')
    setProcessing(false)
    fetchApps()
  }

  const statusColor = { accepted: '#10b981', rejected: '#ef4444', pending: '#9ca3af' }
  const statusBg    = { accepted: '#ecfdf5', rejected: '#fef2f2', pending: '#f9fafb' }
  const statusLabel = { accepted: '✓ Accepted', rejected: '✗ Rejected', pending: '— Pending' }

  return (
    <div style={{ padding: 28 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: '#111827' }}>Business Applications</h1>
          <p style={{ color: '#6b7280', fontSize: 14 }}>Review and approve company registration requests</p>
        </div>

        {/* Easy / Strict Mode Toggle */}
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
            {reviewMode === 'strict'
              ? 'All fields must be accepted before approving'
              : 'Approve anytime — no rejected fields'}
          </span>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['pending', 'approved', 'rejected'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontWeight: 600, fontSize: 13, textTransform: 'capitalize',
            background: filter === f ? '#e8b84b' : '#f3f4f6',
            color: filter === f ? '#0d1117' : '#6b7280'
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
          {apps.map(app => {
            const cl = checklists[app.id] || {}
            const allAccepted = CHECKLIST_FIELDS.every(f => cl[f.key] === 'accepted')
            const approveOk = canApprove(app.id)
            const isExpanded = expandedId === app.id

            return (
              <div key={app.id} style={{
                background: 'white', border: '1px solid #e5e7eb',
                borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
              }}>
                {/* App Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{app.company_name}</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[app.category, app.location].filter(Boolean).map(t => (
                        <span key={t} style={{ background: '#f3f4f6', color: '#374151', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99 }}>{t}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>{new Date(app.applied_at).toLocaleDateString('en-AE')}</span>
                    {app.reviewed_by && (
                      <span style={{ fontSize: 11, color: '#6b7280' }}>Reviewed by: {app.reviewed_by}</span>
                    )}
                  </div>
                </div>

                {/* Company Details */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                  {[['👤 Owner', app.owner_name], ['📞 Phone', app.phone], ['✉️ Email', app.email],
                    ['💬 WhatsApp', app.whatsapp], ['🔢 TL Number', app.tl_number],
                    ['📅 TL Expiry', app.tl_expiry_date]
                  ].filter(([,v]) => v).map(([l, v]) => (
                    <div key={l} style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>{l}</div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{v}</div>
                    </div>
                  ))}
                </div>

                {/* Trade License PDF */}
                {app.tl_pdf_url && (
                  <div style={{ marginBottom: 12 }}>
                    
                      href={`https://ribdorraxxhfbfkjhpie.supabase.co/storage/v1/object/sign/trade-licenses/${app.tl_pdf_url}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: '#eff6ff', color: '#1d4ed8', borderRadius: 8, fontSize: 13, fontWeight: 500, textDecoration: 'none' }}
                    >
                      📄 View Trade License PDF
                    </a>
                  </div>
                )}

                {app.description && (
                  <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                    {app.description}
                  </div>
                )}

                {app.rejection_reason && (
                  <div style={{ background: '#fef2f2', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 13, color: '#991b1b' }}>
                    <strong>Rejection reason:</strong> {app.rejection_reason}
                  </div>
                )}

                {/* Checklist — only for pending */}
                {filter === 'pending' && (
                  <div style={{ marginBottom: 14 }}>
                    <div
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: isExpanded ? 10 : 0 }}
                      onClick={() => setExpandedId(isExpanded ? null : app.id)}
                    >
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                        📋 Document Checklist
                        {allAccepted && <span style={{ marginLeft: 8, color: '#10b981' }}>✓ All accepted</span>}
                      </span>
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>{isExpanded ? '▲ Hide' : '▼ Show'}</span>
                    </div>

                    {isExpanded && (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: '#f9fafb' }}>
                            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Field</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Status</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {CHECKLIST_FIELDS.map(({ key, label }) => {
                            const s = cl[key] ?? 'pending'
                            return (
                              <tr key={key} style={{ background: s === 'accepted' ? '#f0fdf4' : s === 'rejected' ? '#fef2f2' : '#fff', borderBottom: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '8px 12px' }}>{label}</td>
                                <td style={{ padding: '8px 12px' }}>
                                  <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 99, fontSize: 12, fontWeight: 500, background: statusBg[s], color: statusColor[s] }}>
                                    {statusLabel[s]}
                                  </span>
                                </td>
                                <td style={{ padding: '8px 12px' }}>
                                  <button
                                    onClick={() => cycleStatus(app.id, key)}
                                    style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb', color: '#374151', fontSize: 12, cursor: 'pointer' }}
                                  >
                                    {s === 'accepted' ? 'Reject' : s === 'rejected' ? 'Clear' : 'Accept'}
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {/* Approve / Reject Buttons */}
                {filter === 'pending' && (
                  rejectingId === app.id ? (
                    <div>
                      <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                        placeholder="Enter rejection reason..."
                        style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #ef4444', borderRadius: 8, fontSize: 13, marginBottom: 8, minHeight: 80, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} autoFocus />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => reject(app)} disabled={processing}
                          style={{ padding: '8px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                          {processing ? 'Rejecting...' : 'Confirm Reject'}
                        </button>
                        <button onClick={() => { setRejectingId(null); setRejectReason('') }}
                          style={{ padding: '8px 16px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button
                        onClick={() => approve(app)}
                        disabled={processing || !approveOk}
                        style={{
                          padding: '9px 20px', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: approveOk ? 'pointer' : 'not-allowed',
                          background: approveOk ? '#10b981' : '#d1d5db',
                          color: approveOk ? 'white' : '#9ca3af',
                        }}>
                        ✅ Approve
                      </button>
                      <button onClick={() => setRejectingId(app.id)}
                        style={{ padding: '9px 20px', background: '#fef2f2', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                        ❌ Reject
                      </button>
                      {!approveOk && reviewMode === 'strict' && (
                        <span style={{ fontSize: 12, color: '#9ca3af' }}>All fields must be accepted first</span>
                      )}
                      {allAccepted && (
                        <span style={{ fontSize: 12, color: '#10b981', fontWeight: 500 }}>✓ All fields accepted — ready to approve</span>
                      )}
                    </div>
                  )
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
