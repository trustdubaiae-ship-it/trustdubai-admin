import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function ApplicationsPage() {
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [rejectingId, setRejectingId] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => { fetchApps() }, [filter])

  async function fetchApps() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('company_applications')
        .select('*')
        .eq('status', filter)
        .order('applied_at', { ascending: false })
      if (error) throw error
      setApps(data || [])
    } catch(e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function approve(app) {
    setProcessing(true)
    try {
      // Create company
      const { data: company, error } = await supabase.from('companies').insert({
        name: app.company_name,
        category: app.category,
        location: app.location,
        phone: app.phone,
        whatsapp: app.whatsapp,
        email: app.email,
        website: app.website,
        description: app.description,
        slug: app.slug,
        plan: 'free',
        status: 'active',
        created_at: new Date().toISOString()
      }).select().single()

      if (error) throw error

      // Update application status
      await supabase.from('company_applications').update({
        status: 'approved',
        reviewed_at: new Date().toISOString()
      }).eq('id', app.id)

      alert(`✅ ${app.company_name} approved! Company created.`)
      fetchApps()
    } catch (e) {
      alert('Error: ' + e.message)
    } finally {
      setProcessing(false)
    }
  }

  async function reject(app) {
    if (!rejectReason.trim()) { alert('Please enter rejection reason'); return }
    setProcessing(true)
    try {
      await supabase.from('company_applications').update({
        status: 'rejected',
        rejection_reason: rejectReason,
        reviewed_at: new Date().toISOString()
      }).eq('id', app.id)

      setRejectingId(null)
      setRejectReason('')
      alert(`❌ ${app.company_name} rejected.`)
      fetchApps()
    } catch (e) {
      alert('Error: ' + e.message)
    } finally {
      setProcessing(false)
    }
  }

  const counts = { pending: 0, approved: 0, rejected: 0 }

  return (
    <div style={{ padding: 28 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Business Applications</h1>
        <p style={{ color: '#6b7280', fontSize: 14 }}>Review and approve company registration requests</p>
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
          {apps.map(app => (
            <div key={app.id} style={{
              background: 'white', border: '1px solid #e5e7eb',
              borderRadius: 12, padding: 20,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{app.company_name}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[app.category, app.location].filter(Boolean).map(tag => (
                      <span key={tag} style={{ background: '#f3f4f6', color: '#374151', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99 }}>{tag}</span>
                    ))}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>
                  {new Date(app.applied_at).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
                {[
                  ['👤 Owner', app.owner_name],
                  ['📞 Phone', app.phone],
                  ['✉️ Email', app.email],
                  ['💬 WhatsApp', app.whatsapp],
                  ['🌐 Website', app.website],
                  ['📣 Source', app.how_heard],
                ].filter(([,v]) => v).map(([label, value]) => (
                  <div key={label} style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{value}</div>
                  </div>
                ))}
              </div>

              {app.description && (
                <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                  {app.description}
                </div>
              )}

              {app.rejection_reason && (
                <div style={{ background: '#fef2f2', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 13, color: '#991b1b' }}>
                  <strong>Rejection reason:</strong> {app.rejection_reason}
                </div>
              )}

              {filter === 'pending' && (
                rejectingId === app.id ? (
                  <div>
                    <textarea
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      placeholder="Enter rejection reason (will be sent to applicant)..."
                      style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #ef4444', borderRadius: 8, fontSize: 13, marginBottom: 8, minHeight: 80, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                      autoFocus
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => reject(app)} disabled={processing} style={{ padding: '8px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                        {processing ? 'Rejecting...' : 'Confirm Reject'}
                      </button>
                      <button onClick={() => { setRejectingId(null); setRejectReason('') }} style={{ padding: '8px 16px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => approve(app)} disabled={processing} style={{ padding: '9px 20px', background: '#10b981', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                      ✅ Approve
                    </button>
                    <button onClick={() => setRejectingId(app.id)} style={{ padding: '9px 20px', background: '#fef2f2', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                      ❌ Reject
                    </button>
                  </div>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}