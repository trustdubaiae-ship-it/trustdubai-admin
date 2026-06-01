import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function TeamVerification({ theme, adminData }) {
  const isDark = theme === 'dark'
  const [members, setMembers] = useState([])
  const [companies, setCompanies] = useState({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')   // pending | verified | rejected | all
  const [viewDoc, setViewDoc] = useState(null)
  const [busy, setBusy] = useState(null)

  const text    = isDark ? '#f1f5f9' : '#111827'
  const textSub = isDark ? '#94a3b8' : '#6b7280'
  const cardBg  = isDark ? '#161b22' : '#ffffff'
  const border  = isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'
  const rowAlt  = isDark ? 'rgba(255,255,255,0.02)' : '#f9fafb'

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: tm } = await supabase
      .from('team_members')
      .select('*')
      .order('created_at', { ascending: false })
    setMembers(tm || [])
    // company names
    const ids = [...new Set((tm || []).map(m => m.company_id))]
    if (ids.length) {
      const { data: cos } = await supabase.from('companies').select('id, name, slug').in('id', ids)
      const map = {}
      ;(cos || []).forEach(c => { map[c.id] = c })
      setCompanies(map)
    }
    setLoading(false)
  }

  async function verify(m) {
    setBusy(m.id)
    const { error } = await supabase.from('team_members').update({
      eid_status: 'verified',
      is_verified: true,
      verified_at: new Date().toISOString(),
      verified_by: adminData?.full_name || adminData?.email || 'Admin',
    }).eq('id', m.id)
    setBusy(null)
    if (error) { alert('Failed: ' + error.message); return }
    load()
  }

  async function reject(m) {
    if (!confirm(`Reject EID verification for ${m.name}?`)) return
    setBusy(m.id)
    const { error } = await supabase.from('team_members').update({
      eid_status: 'rejected',
      is_verified: false,
      verified_at: null,
      verified_by: null,
    }).eq('id', m.id)
    setBusy(null)
    if (error) { alert('Failed: ' + error.message); return }
    load()
  }

  const filtered = members.filter(m => {
    if (filter === 'all') return true
    return (m.eid_status || 'pending') === filter
  })

  const counts = {
    pending:  members.filter(m => (m.eid_status||'pending') === 'pending').length,
    verified: members.filter(m => m.eid_status === 'verified').length,
    rejected: members.filter(m => m.eid_status === 'rejected').length,
  }

  const STATUS = {
    pending:  { label:'Pending',  bg:'rgba(251,191,36,0.15)',  fg:'#f59e0b' },
    verified: { label:'Verified', bg:'rgba(34,197,94,0.15)',   fg:'#22c55e' },
    rejected: { label:'Rejected', bg:'rgba(248,113,113,0.15)', fg:'#f87171' },
  }

  if (loading) return (
    <div style={{ textAlign:'center', padding:60, color:textSub }}>
      <div style={{ width:36, height:36, border:'3px solid #4ade80', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 12px' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      Loading team members...
    </div>
  )

  return (
    <div style={{ maxWidth:1000 }}>
      <div style={{ marginBottom:18 }}>
        <h1 style={{ fontSize:22, fontWeight:700, color:text, marginBottom:4 }}>Team Verification</h1>
        <p style={{ color:textSub, fontSize:14 }}>Review Emirates ID documents and verify client-facing team members.</p>
      </div>

      {/* filter tabs */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        {[['pending', `Pending (${counts.pending})`], ['verified', `Verified (${counts.verified})`], ['rejected', `Rejected (${counts.rejected})`], ['all', 'All']].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            style={{ padding:'7px 14px', borderRadius:8, border:`1px solid ${border}`, fontSize:13, fontWeight:600, cursor:'pointer',
              background: filter===k ? '#4ade80' : cardBg, color: filter===k ? '#0d1117' : textSub }}>
            {l}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ background:cardBg, border:`1px solid ${border}`, borderRadius:14, padding:50, textAlign:'center', color:textSub }}>
          No {filter !== 'all' ? filter : ''} team members.
        </div>
      ) : (
        <div style={{ background:cardBg, border:`1px solid ${border}`, borderRadius:14, overflow:'hidden' }}>
          {filtered.map((m, i) => {
            const st = STATUS[m.eid_status || 'pending']
            const co = companies[m.company_id]
            return (
              <div key={m.id} style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 18px', borderBottom: i < filtered.length-1 ? `1px solid ${border}` : 'none', background: i%2 ? rowAlt : 'transparent' }}>
                <div style={{ width:46, height:46, borderRadius:11, background: m.photo_url ? 'transparent' : '#0099cc', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:17, flexShrink:0, overflow:'hidden' }}>
                  {m.photo_url ? <img src={m.photo_url} alt={m.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : (m.name?.[0]?.toUpperCase() || '?')}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, color:text, fontSize:15 }}>{m.name}</div>
                  <div style={{ fontSize:12.5, color:textSub }}>
                    {m.role || '—'} · <span style={{ textTransform:'capitalize' }}>{m.member_type}</span>
                  </div>
                  <div style={{ fontSize:11.5, color:textSub, marginTop:2 }}>
                    🏢 {co?.name || 'Unknown company'}
                  </div>
                </div>
                <span style={{ fontSize:11, fontWeight:700, padding:'4px 10px', borderRadius:99, background:st.bg, color:st.fg, flexShrink:0 }}>{st.label}</span>
                <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                  {m.eid_url ? (
                    <button onClick={() => setViewDoc(m)}
                      style={{ padding:'7px 12px', borderRadius:8, border:`1px solid ${border}`, background:cardBg, color:text, fontSize:12.5, fontWeight:600, cursor:'pointer' }}>
                      View EID
                    </button>
                  ) : (
                    <span style={{ fontSize:11.5, color:textSub, fontStyle:'italic' }}>No EID</span>
                  )}
                  {m.eid_status !== 'verified' && (
                    <button onClick={() => verify(m)} disabled={busy===m.id}
                      style={{ padding:'7px 14px', borderRadius:8, border:'none', background:'#22c55e', color:'#fff', fontSize:12.5, fontWeight:700, cursor:'pointer', opacity: busy===m.id?0.5:1 }}>
                      {busy===m.id ? '...' : 'Verify'}
                    </button>
                  )}
                  {m.eid_status !== 'rejected' && (
                    <button onClick={() => reject(m)} disabled={busy===m.id}
                      style={{ padding:'7px 12px', borderRadius:8, border:`1px solid ${border}`, background:'transparent', color:'#f87171', fontSize:12.5, fontWeight:600, cursor:'pointer' }}>
                      Reject
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* EID document viewer */}
      {viewDoc && (
        <div onClick={() => setViewDoc(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background:cardBg, borderRadius:14, maxWidth:640, width:'100%', maxHeight:'90vh', overflow:'auto', padding:20 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <div>
                <div style={{ fontSize:16, fontWeight:700, color:text }}>{viewDoc.name}</div>
                <div style={{ fontSize:12.5, color:textSub }}>{viewDoc.role} · {companies[viewDoc.company_id]?.name}</div>
              </div>
              <button onClick={() => setViewDoc(null)} style={{ width:34, height:34, borderRadius:9, border:'none', background:'rgba(255,255,255,0.1)', color:text, cursor:'pointer', fontSize:18 }}>✕</button>
            </div>
            {viewDoc.eid_url?.toLowerCase().endsWith('.pdf') ? (
              <iframe src={viewDoc.eid_url} title="EID" style={{ width:'100%', height:'70vh', border:'none', borderRadius:8 }} />
            ) : (
              <img src={viewDoc.eid_url} alt="Emirates ID" style={{ width:'100%', borderRadius:8 }} />
            )}
            <div style={{ display:'flex', gap:10, marginTop:16 }}>
              {viewDoc.eid_status !== 'verified' && (
                <button onClick={() => { verify(viewDoc); setViewDoc(null) }}
                  style={{ flex:1, padding:11, borderRadius:9, border:'none', background:'#22c55e', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                  ✓ Verify Member
                </button>
              )}
              {viewDoc.eid_status !== 'rejected' && (
                <button onClick={() => { reject(viewDoc); setViewDoc(null) }}
                  style={{ flex:1, padding:11, borderRadius:9, border:`1px solid ${border}`, background:'transparent', color:'#f87171', fontWeight:600, fontSize:13, cursor:'pointer' }}>
                  Reject
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
