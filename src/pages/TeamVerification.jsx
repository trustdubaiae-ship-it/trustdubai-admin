import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function TeamVerification({ theme, adminData }) {
  const isDark = theme === 'dark'
  const [members, setMembers] = useState([])
  const [companies, setCompanies] = useState({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [viewDoc, setViewDoc] = useState(null)
  const [busy, setBusy] = useState(null)
  const [numOk, setNumOk] = useState(false)
  const [expOk, setExpOk] = useState(false)
  const [docSide, setDocSide] = useState('front')

  const text    = isDark ? '#f1f5f9' : '#111827'
  const textSub = isDark ? '#94a3b8' : '#6b7280'
  const cardBg  = isDark ? '#161b22' : '#ffffff'
  const border  = isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'
  const rowAlt  = isDark ? 'rgba(255,255,255,0.02)' : '#f9fafb'
  const fieldBg = isDark ? '#0d1117' : '#f8fafc'

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: tm } = await supabase
      .from('team_members')
      .select('*')
      .order('created_at', { ascending: false })
    setMembers(tm || [])
    const ids = [...new Set((tm || []).map(m => m.company_id))]
    if (ids.length) {
      const { data: cos } = await supabase.from('companies').select('id, name, slug').in('id', ids)
      const map = {}
      ;(cos || []).forEach(c => { map[c.id] = c })
      setCompanies(map)
    }
    setLoading(false)
  }

  function openDoc(m) {
    setViewDoc(m)
    setNumOk(false)
    setExpOk(false)
    setDocSide('front')
  }

  async function approve(m) {
    setBusy(m.id)
    const { error } = await supabase.from('team_members').update({
      eid_status: 'verified',
      is_verified: true,
      verified_at: new Date().toISOString(),
      verified_by: adminData?.full_name || adminData?.email || 'Admin',
    }).eq('id', m.id)
    setBusy(null)
    if (error) { alert('Failed: ' + error.message); return }
    setViewDoc(null)
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
    setViewDoc(null)
    load()
  }

  function expiryInfo(dateStr) {
    if (!dateStr) return null
    const today = new Date(); today.setHours(0,0,0,0)
    const exp = new Date(dateStr); exp.setHours(0,0,0,0)
    const days = Math.round((exp - today) / 86400000)
    return { days, expired: days < 0 }
  }
  function fmtDate(d) {
    if (!d) return '—'
    try { return new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) } catch { return d }
  }

  const filtered = members.filter(m => {
    if (filter === 'all') return true
    if (filter === 'expiring') {
      const e = expiryInfo(m.eid_expiry)
      return e && !e.expired && e.days <= 54
    }
    if (filter === 'expired') {
      const e = expiryInfo(m.eid_expiry)
      return e && e.expired
    }
    return (m.eid_status || 'pending') === filter
  })

  const counts = {
    pending:  members.filter(m => (m.eid_status||'pending') === 'pending').length,
    verified: members.filter(m => m.eid_status === 'verified').length,
    rejected: members.filter(m => m.eid_status === 'rejected').length,
    expiring: members.filter(m => { const e = expiryInfo(m.eid_expiry); return e && !e.expired && e.days <= 54 }).length,
    expired:  members.filter(m => { const e = expiryInfo(m.eid_expiry); return e && e.expired }).length,
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

  const bothOk = numOk && expOk

  return (
    <div style={{ maxWidth:1000 }}>
      <div style={{ marginBottom:18 }}>
        <h1 style={{ fontSize:22, fontWeight:700, color:text, marginBottom:4 }}>Team Verification</h1>
        <p style={{ color:textSub, fontSize:14 }}>Review Emirates ID documents and verify client-facing team members.</p>
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        {[['pending', `Pending (${counts.pending})`], ['verified', `Verified (${counts.verified})`], ['rejected', `Rejected (${counts.rejected})`], ['expiring', `Expiring (${counts.expiring})`], ['expired', `Expired (${counts.expired})`], ['all', 'All']].map(([k, l]) => (
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
            const e = expiryInfo(m.eid_expiry)
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
                  <div style={{ fontSize:11.5, color:textSub, marginTop:2 }}>🏢 {co?.name || 'Unknown company'}</div>
                  {e && (
                    <div style={{ fontSize:11, marginTop:3, fontWeight:600, color: e.expired ? '#f87171' : e.days <= 54 ? '#f59e0b' : textSub }}>
                      {e.expired ? '⚠ EID expired' : `EID expires in ${e.days} day${e.days !== 1 ? 's' : ''}`}
                    </div>
                  )}
                </div>
                <span style={{ fontSize:11, fontWeight:700, padding:'4px 10px', borderRadius:99, background:st.bg, color:st.fg, flexShrink:0 }}>{st.label}</span>
                <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                  {m.eid_url ? (
                    <button onClick={() => openDoc(m)}
                      style={{ padding:'7px 14px', borderRadius:8, border:'none', background:'#0099cc', color:'#fff', fontSize:12.5, fontWeight:700, cursor:'pointer' }}>
                      Review & Verify
                    </button>
                  ) : (
                    <span style={{ fontSize:11.5, color:textSub, fontStyle:'italic' }}>No EID</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* EID review + verify modal */}
      {viewDoc && (() => {
        const e = expiryInfo(viewDoc.eid_expiry)
        const sideUrl = docSide === 'front' ? viewDoc.eid_url : viewDoc.eid_back_url
        return (
          <div onClick={() => setViewDoc(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 }}>
            <div onClick={ev => ev.stopPropagation()} style={{ background:cardBg, borderRadius:14, maxWidth:560, width:'100%', maxHeight:'92vh', overflow:'auto', padding:20 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:text }}>{viewDoc.name}</div>
                  <div style={{ fontSize:12.5, color:textSub }}>{viewDoc.role} · {companies[viewDoc.company_id]?.name}</div>
                </div>
                <button onClick={() => setViewDoc(null)} style={{ width:34, height:34, borderRadius:9, border:'none', background:'rgba(255,255,255,0.1)', color:text, cursor:'pointer', fontSize:18 }}>✕</button>
              </div>

              {/* Front/Back toggle */}
              <div style={{ display:'flex', gap:8, marginBottom:10 }}>
                {[['front','Front'],['back','Back']].map(([k,l]) => (
                  <button key={k} onClick={() => setDocSide(k)}
                    style={{ flex:1, padding:'7px 0', borderRadius:8, border:`1px solid ${border}`, fontSize:12.5, fontWeight:600, cursor:'pointer',
                      background: docSide===k ? '#0099cc' : 'transparent', color: docSide===k ? '#fff' : textSub }}>
                    {l} {k==='back' && !viewDoc.eid_back_url ? '(none)' : ''}
                  </button>
                ))}
              </div>

              {/* Document image */}
              <div style={{ background:'#000', borderRadius:8, overflow:'hidden', marginBottom:14, minHeight:120, display:'flex', alignItems:'center', justifyContent:'center' }}>
                {sideUrl ? (
                  sideUrl.toLowerCase().endsWith('.pdf')
                    ? <iframe src={sideUrl} title="EID" style={{ width:'100%', height:'46vh', border:'none' }} />
                    : <img src={sideUrl} alt="Emirates ID" style={{ width:'100%', maxHeight:'46vh', objectFit:'contain' }} />
                ) : (
                  <div style={{ color:'#888', fontSize:13, padding:30 }}>No {docSide} image uploaded</div>
                )}
              </div>

              {/* Entered data to verify */}
              <div style={{ background:fieldBg, border:`1px solid ${border}`, borderRadius:10, padding:14, marginBottom:14 }}>
                <div style={{ fontSize:11.5, color:'#f59e0b', fontWeight:700, marginBottom:10 }}>
                  ⚠ Please verify the ID number and expiry below against the photo above.
                </div>

                {/* EID number */}
                <div style={{ marginBottom:10 }}>
                  <div style={{ fontSize:11, color:textSub, marginBottom:3 }}>EID Number (entered by company)</div>
                  <div style={{ fontSize:16, fontWeight:700, color:text, letterSpacing:'0.5px', fontFamily:'monospace' }}>{viewDoc.eid_number || '— not provided —'}</div>
                  <label style={{ display:'flex', alignItems:'center', gap:8, marginTop:7, cursor:'pointer', fontSize:13, color:text, fontWeight:600 }}>
                    <input type="checkbox" checked={numOk} onChange={ev => setNumOk(ev.target.checked)} style={{ width:18, height:18, accentColor:'#22c55e' }} />
                    ID number matches the photo
                  </label>
                </div>

                <div style={{ borderTop:`1px solid ${border}`, paddingTop:10 }}>
                  <div style={{ fontSize:11, color:textSub, marginBottom:3 }}>EID Expiry (entered by company)</div>
                  <div style={{ fontSize:16, fontWeight:700, color:text }}>
                    {fmtDate(viewDoc.eid_expiry)}
                    {e && <span style={{ fontSize:12, marginLeft:8, fontWeight:600, color: e.expired ? '#f87171' : e.days <= 54 ? '#f59e0b' : '#22c55e' }}>
                      {e.expired ? '(expired)' : `(${e.days} days left)`}
                    </span>}
                  </div>
                  <label style={{ display:'flex', alignItems:'center', gap:8, marginTop:7, cursor:'pointer', fontSize:13, color:text, fontWeight:600 }}>
                    <input type="checkbox" checked={expOk} onChange={ev => setExpOk(ev.target.checked)} style={{ width:18, height:18, accentColor:'#22c55e' }} />
                    Expiry date matches the photo
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={() => approve(viewDoc)} disabled={!bothOk || busy===viewDoc.id}
                  title={bothOk ? '' : 'Tick both checks first'}
                  style={{ flex:1, padding:12, borderRadius:9, border:'none',
                    background: bothOk ? '#22c55e' : (isDark ? '#30363d' : '#cbd5e1'),
                    color: bothOk ? '#fff' : textSub, fontWeight:700, fontSize:13,
                    cursor: bothOk ? 'pointer' : 'not-allowed', opacity: busy===viewDoc.id?0.5:1 }}>
                  {busy===viewDoc.id ? '...' : bothOk ? '✓ Approve & Verify' : '✓ Approve (tick both first)'}
                </button>
                <button onClick={() => reject(viewDoc)} disabled={busy===viewDoc.id}
                  style={{ flex:1, padding:12, borderRadius:9, border:`1px solid ${border}`, background:'transparent', color:'#f87171', fontWeight:600, fontSize:13, cursor:'pointer' }}>
                  Reject
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
