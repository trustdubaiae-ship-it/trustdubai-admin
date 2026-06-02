import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const PAGE = 20

export default function TeamVerification({ theme, adminData }) {
  const isDark = theme === 'dark'
  const [members, setMembers] = useState([])
  const [companies, setCompanies] = useState({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [visible, setVisible] = useState(PAGE)
  const [busy, setBusy] = useState(null)
  const [numOk, setNumOk] = useState(false)
  const [expOk, setExpOk] = useState(false)
  const [docSide, setDocSide] = useState('front')

  const text    = isDark ? '#f1f5f9' : '#111827'
  const textSub = isDark ? '#94a3b8' : '#6b7280'
  const cardBg  = isDark ? '#161b22' : '#ffffff'
  const listBg  = isDark ? '#0f1419' : '#f8fafc'
  const border  = isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'
  const selBg   = isDark ? 'rgba(0,153,204,0.12)' : '#e9f5fb'
  const fieldBg = isDark ? '#0d1117' : '#f8fafc'
  const chipBg  = isDark ? 'rgba(255,255,255,0.06)' : '#eef2f6'
  const BRAND = '#0099cc'

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
    await load()
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
    await load()
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

  // filtered list
  const q = search.trim().toLowerCase()
  const filtered = members.filter(m => {
    // status/expiry filter
    let passFilter = false
    if (filter === 'all') passFilter = true
    else if (filter === 'expiring') { const e = expiryInfo(m.eid_expiry); passFilter = !!(e && !e.expired && e.days <= 54) }
    else if (filter === 'expired')  { const e = expiryInfo(m.eid_expiry); passFilter = !!(e && e.expired) }
    else passFilter = (m.eid_status || 'pending') === filter
    if (!passFilter) return false
    // search
    if (q) {
      const co = companies[m.company_id]
      const hay = `${m.name || ''} ${m.role || ''} ${co?.name || ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
  const shown = filtered.slice(0, visible)

  const counts = {
    pending:  members.filter(m => (m.eid_status||'pending') === 'pending').length,
    verified: members.filter(m => m.eid_status === 'verified').length,
    rejected: members.filter(m => m.eid_status === 'rejected').length,
    expiring: members.filter(m => { const e = expiryInfo(m.eid_expiry); return e && !e.expired && e.days <= 54 }).length,
    expired:  members.filter(m => { const e = expiryInfo(m.eid_expiry); return e && e.expired }).length,
    all:      members.length,
  }

  // auto-select first when list changes
  useEffect(() => {
    if (filtered.length && !filtered.find(m => m.id === selectedId)) setSelectedId(filtered[0].id)
    if (!filtered.length) setSelectedId(null)
  }, [filter, search, members])

  // reset checks + side when selection changes
  useEffect(() => { setNumOk(false); setExpOk(false); setDocSide('front') }, [selectedId])

  const STATUS = {
    pending:  { label:'Pending',  bg:'rgba(251,191,36,0.15)',  fg:'#f59e0b' },
    verified: { label:'Verified', bg:'rgba(34,197,94,0.15)',   fg:'#22c55e' },
    rejected: { label:'Rejected', bg:'rgba(248,113,113,0.15)', fg:'#f87171' },
  }

  const TABS = [
    ['pending', 'Pending'], ['verified', 'Verified'], ['rejected', 'Rejected'],
    ['expiring', 'Expiring'], ['expired', 'Expired'], ['all', 'All'],
  ]

  if (loading) return (
    <div style={{ textAlign:'center', padding:60, color:textSub }}>
      <div style={{ width:36, height:36, border:'3px solid #4ade80', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 12px' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      Loading team members...
    </div>
  )

  const selected = members.find(m => m.id === selectedId) || null
  const bothOk = numOk && expOk

  return (
    <div style={{ padding:24, maxWidth:1100 }}>
      <div style={{ marginBottom:16 }}>
        <h1 style={{ fontSize:22, fontWeight:700, color:text, marginBottom:4 }}>Team Verification</h1>
        <p style={{ color:textSub, fontSize:14 }}>Review Emirates ID documents and verify client-facing team members.</p>
      </div>

      {/* SEARCH + TABS */}
      <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap', marginBottom:14 }}>
        <div style={{ flex:1, minWidth:200, display:'flex', alignItems:'center', gap:8, background:fieldBg, border:`1px solid ${border}`, borderRadius:8, padding:'8px 12px' }}>
          <i className="ti ti-search" style={{ fontSize:16, color:textSub }} />
          <input value={search} onChange={e => { setSearch(e.target.value); setVisible(PAGE) }}
            placeholder="Search member, role or company…"
            style={{ flex:1, border:'none', outline:'none', background:'transparent', color:text, fontSize:13 }} />
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {TABS.map(([k, l]) => {
            const active = filter === k
            return (
              <button key={k} onClick={() => { setFilter(k); setVisible(PAGE) }}
                style={{ border:'none', cursor:'pointer', fontSize:12, fontWeight:600, padding:'7px 12px', borderRadius:20,
                  background: active ? 'rgba(0,153,204,0.15)' : chipBg, color: active ? BRAND : textSub }}>
                {l}{k !== 'all' ? ` · ${counts[k]}` : ''}
              </button>
            )
          })}
        </div>
      </div>

      {/* SPLIT PANE */}
      <div style={{ display:'grid', gridTemplateColumns:'250px 1fr', border:`1px solid ${border}`, borderRadius:14, overflow:'hidden', background:cardBg, minHeight:460 }}>

        {/* LEFT LIST */}
        <div style={{ borderRight:`1px solid ${border}`, background:listBg, maxHeight:660, overflowY:'auto' }}>
          {shown.length === 0 && <div style={{ padding:20, color:textSub, fontSize:13 }}>No members in this view.</div>}
          {shown.map(m => {
            const sel = m.id === selectedId
            const co = companies[m.company_id]
            const e = expiryInfo(m.eid_expiry)
            return (
              <div key={m.id} onClick={() => setSelectedId(m.id)}
                style={{ padding:'11px 14px', borderBottom:`1px solid ${border}`, cursor:'pointer', display:'flex', gap:10, alignItems:'center',
                  borderLeft: sel ? `3px solid ${BRAND}` : '3px solid transparent', background: sel ? selBg : 'transparent' }}>
                <div style={{ width:36, height:36, borderRadius:9, background: m.photo_url ? 'transparent' : BRAND, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:14, flexShrink:0, overflow:'hidden' }}>
                  {m.photo_url ? <img src={m.photo_url} alt={m.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : (m.name?.[0]?.toUpperCase() || '?')}
                </div>
                <div style={{ minWidth:0, flex:1 }}>
                  <div style={{ fontSize:13, fontWeight: sel ? 700 : 600, color:text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.name}</div>
                  <div style={{ fontSize:11, color:textSub, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.role || '—'} · {co?.name || 'Unknown'}</div>
                  {e
                    ? <div style={{ fontSize:10, marginTop:2, fontWeight:600, color: e.expired ? '#f87171' : e.days <= 54 ? '#f59e0b' : textSub }}>{e.expired ? 'EID expired' : `EID expires in ${e.days}d`}</div>
                    : <div style={{ fontSize:10, marginTop:2, color:textSub }}>No EID date</div>}
                </div>
              </div>
            )
          })}
          {filtered.length > visible && (
            <div onClick={() => setVisible(v => v + PAGE)} style={{ padding:13, textAlign:'center', cursor:'pointer', fontSize:12, fontWeight:600, color:BRAND }}>
              Load more ({visible} of {filtered.length})
            </div>
          )}
        </div>

        {/* RIGHT DETAIL */}
        <div style={{ padding:18, maxHeight:660, overflowY:'auto' }}>
          {!selected ? (
            <div style={{ color:textSub, fontSize:14, padding:30, textAlign:'center' }}>Select a member from the list.</div>
          ) : (() => {
            const e = expiryInfo(selected.eid_expiry)
            const st = STATUS[selected.eid_status || 'pending']
            const co = companies[selected.company_id]
            const sideUrl = docSide === 'front' ? selected.eid_url : selected.eid_back_url
            const hasEid = !!selected.eid_url
            return (
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14, gap:8, flexWrap:'wrap' }}>
                  <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                    <div style={{ width:44, height:44, borderRadius:11, background: selected.photo_url ? 'transparent' : BRAND, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:16, overflow:'hidden' }}>
                      {selected.photo_url ? <img src={selected.photo_url} alt={selected.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : (selected.name?.[0]?.toUpperCase() || '?')}
                    </div>
                    <div>
                      <div style={{ fontSize:16, fontWeight:700, color:text }}>{selected.name}</div>
                      <div style={{ fontSize:12, color:textSub }}>{selected.role || '—'} · <span style={{ textTransform:'capitalize' }}>{selected.member_type}</span> · {co?.name || 'Unknown'}</div>
                    </div>
                  </div>
                  <span style={{ fontSize:11, fontWeight:700, padding:'4px 11px', borderRadius:16, background:st.bg, color:st.fg, flexShrink:0 }}>{st.label}</span>
                </div>

                {!hasEid ? (
                  <div style={{ padding:30, textAlign:'center', color:textSub, fontSize:13, border:`1px dashed ${border}`, borderRadius:10 }}>
                    No Emirates ID uploaded by this member.
                  </div>
                ) : (
                  <>
                    {/* Front/Back toggle */}
                    <div style={{ display:'flex', gap:6, marginBottom:10 }}>
                      {[['front','Front'],['back','Back']].map(([k,l]) => (
                        <button key={k} onClick={() => setDocSide(k)}
                          style={{ flex:1, padding:'7px 0', borderRadius:7, border:'none', fontSize:12, fontWeight:600, cursor:'pointer',
                            background: docSide===k ? BRAND : chipBg, color: docSide===k ? '#fff' : textSub }}>
                          {l}{k==='back' && !selected.eid_back_url ? ' (none)' : ''}
                        </button>
                      ))}
                    </div>

                    {/* Document image — ATM card ratio */}
                    <div style={{ aspectRatio:'1.586 / 1', background:'#000', borderRadius:10, overflow:'hidden', marginBottom:14, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {sideUrl ? (
                        sideUrl.toLowerCase().endsWith('.pdf')
                          ? <iframe src={sideUrl} title="EID" style={{ width:'100%', height:'100%', border:'none' }} />
                          : <img src={sideUrl} alt="Emirates ID" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      ) : (
                        <div style={{ color:'#888', fontSize:13, padding:30 }}>No {docSide} image uploaded</div>
                      )}
                    </div>

                    {/* Entered data + checks */}
                    <div style={{ background:fieldBg, border:`1px solid ${border}`, borderRadius:10, padding:14, marginBottom:14 }}>
                      <div style={{ fontSize:11.5, color:'#f59e0b', fontWeight:700, marginBottom:10 }}>
                        ⚠ Verify the ID number and expiry below against the photo above.
                      </div>

                      <div style={{ marginBottom:10 }}>
                        <div style={{ fontSize:11, color:textSub, marginBottom:3 }}>EID Number (entered by company)</div>
                        <div style={{ fontSize:16, fontWeight:700, color:text, letterSpacing:'0.5px', fontFamily:'monospace' }}>{selected.eid_number || '— not provided —'}</div>
                        <label style={{ display:'flex', alignItems:'center', gap:8, marginTop:7, cursor:'pointer', fontSize:13, color:text, fontWeight:600 }}>
                          <input type="checkbox" checked={numOk} onChange={ev => setNumOk(ev.target.checked)} style={{ width:18, height:18, accentColor:'#22c55e' }} />
                          ID number matches the photo
                        </label>
                      </div>

                      <div style={{ borderTop:`1px solid ${border}`, paddingTop:10 }}>
                        <div style={{ fontSize:11, color:textSub, marginBottom:3 }}>EID Expiry (entered by company)</div>
                        <div style={{ fontSize:16, fontWeight:700, color:text }}>
                          {fmtDate(selected.eid_expiry)}
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
                      <button onClick={() => approve(selected)} disabled={!bothOk || busy===selected.id}
                        title={bothOk ? '' : 'Tick both checks first'}
                        style={{ flex:1, padding:12, borderRadius:9, border:'none',
                          background: bothOk ? '#22c55e' : (isDark ? '#30363d' : '#cbd5e1'),
                          color: bothOk ? '#fff' : textSub, fontWeight:700, fontSize:13,
                          cursor: bothOk ? 'pointer' : 'not-allowed', opacity: busy===selected.id?0.5:1 }}>
                        {busy===selected.id ? '...' : bothOk ? '✓ Approve & Verify' : '✓ Approve (tick both first)'}
                      </button>
                      <button onClick={() => reject(selected)} disabled={busy===selected.id}
                        style={{ flex:1, padding:12, borderRadius:9, border:`1px solid ${border}`, background:'transparent', color:'#f87171', fontWeight:600, fontSize:13, cursor:'pointer' }}>
                        Reject
                      </button>
                    </div>
                  </>
                )}
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
