import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const STATUS_CONFIG = {
  pending:  { label:'Pending',  color:'#fbbf24', bg:'rgba(251,191,36,0.12)'  },
  active:   { label:'Active',   color:'#4ade80', bg:'rgba(74,222,128,0.12)'  },
  rejected: { label:'Rejected', color:'#f87171', bg:'rgba(248,113,113,0.12)' },
  expired:  { label:'Expired',  color:'#6b7280', bg:'rgba(107,114,128,0.12)' },
}
const DURATION_LABELS = { 1:'1 Month', 3:'3 Months', 6:'6 Months' }

function calcFinal(price, discPct) {
  if (!discPct || discPct <= 0) return price
  return Math.round(price * (1 - discPct / 100))
}

export default function SponsorSlotsPage() {
  const [slots,       setSlots]       = useState([])
  const [analytics,   setAnalytics]   = useState({})
  const [pricing,     setPricing]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [activeTab,   setActiveTab]   = useState('slots')
  const [editPrice,   setEditPrice]   = useState(null)
  const [discountMap, setDiscountMap] = useState({})
  const [showApprove, setShowApprove] = useState(null)
  const [approveForm, setApproveForm] = useState({ slot_number:1, price_aed:'', starts_at:'' })

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    try {
      const [slotsRes, pricingRes] = await Promise.all([
        supabase.from('sponsor_slots').select('*, companies(name,category,area,plan,logo_url)').order('created_at',{ascending:false}),
        supabase.from('sponsor_slot_pricing').select('*').order('duration_months'),
      ])
      setSlots(slotsRes.data||[])
      setPricing(pricingRes.data||[])

      // Init discount map from DB
      const initDisc = {}
      ;(pricingRes.data||[]).forEach(p => {
        initDisc[p.id] = { pct: p.discount_pct||0, custom:'' }
      })
      setDiscountMap(initDisc)

      const slotIds = (slotsRes.data||[]).map(s=>s.id)
      if (slotIds.length > 0) {
        const { data: aData } = await supabase.from('sponsor_analytics').select('slot_id,event_type').in('slot_id', slotIds)
        const grouped = {}
        ;(aData||[]).forEach(a => {
          if (!grouped[a.slot_id]) grouped[a.slot_id] = { view:0, click:0, quote_request:0 }
          grouped[a.slot_id][a.event_type] = (grouped[a.slot_id][a.event_type]||0)+1
        })
        setAnalytics(grouped)
      }
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function handleApprove(slot) {
    if (!approveForm.price_aed || !approveForm.starts_at) { alert('Price aur start date required!'); return }
    const startsAt  = new Date(approveForm.starts_at)
    const expiresAt = new Date(startsAt)
    expiresAt.setMonth(expiresAt.getMonth() + slot.duration_months)
    const { error } = await supabase.from('sponsor_slots').update({
      status:      'active',
      slot_number: parseInt(approveForm.slot_number),
      price_aed:   parseInt(approveForm.price_aed),
      starts_at:   startsAt.toISOString(),
      expires_at:  expiresAt.toISOString(),
      paid_at:     new Date().toISOString(),
    }).eq('id', slot.id)
    if (!error) { setShowApprove(null); fetchAll() }
    else alert('Error: '+error.message)
  }

  async function handleReject(id) {
    const note = prompt('Rejection reason (optional):')
    await supabase.from('sponsor_slots').update({ status:'rejected', admin_note:note||'' }).eq('id', id)
    fetchAll()
  }

  async function handleDeactivate(id) {
    if (!confirm('Deactivate this slot?')) return
    await supabase.from('sponsor_slots').update({ status:'expired' }).eq('id', id)
    fetchAll()
  }

  async function handleUpdatePrice(pricing_id, price_aed, description, discount_pct) {
    await supabase.from('sponsor_slot_pricing').update({
      price_aed:    parseInt(price_aed),
      description,
      discount_pct: parseInt(discount_pct)||0,
      updated_at:   new Date().toISOString(),
    }).eq('id', pricing_id)
    setEditPrice(null)
    fetchAll()
  }

  const activeSlots  = slots.filter(s=>s.status==='active').length
  const pendingSlots = slots.filter(s=>s.status==='pending').length
  const totalRevenue = slots.filter(s=>s.paid_at).reduce((s,sl)=>s+(sl.price_aed||0),0)
  const totalClicks  = Object.values(analytics).reduce((s,a)=>s+(a.click||0),0)
  const totalLeads   = Object.values(analytics).reduce((s,a)=>s+(a.quote_request||0),0)

  const C = {
    text:   '#f0fdf4',
    text2:  '#6b7280',
    text3:  '#374151',
    border: 'rgba(255,255,255,0.07)',
    card:   '#161b22',
    bg:     '#0d1117',
  }
  const cardS = { background:C.card, border:`0.5px solid ${C.border}`, borderRadius:12, padding:'14px 16px' }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>
      <div style={{ width:32, height:32, border:'3px solid #4ade80', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ maxWidth:1200, color:C.text }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:C.text, letterSpacing:'-0.3px' }}>Sponsor Slots</h1>
          <p style={{ fontSize:11, color:C.text2, marginTop:3 }}>Manage sponsored placements on trustdubai.ae</p>
        </div>
        <button onClick={fetchAll} style={{ padding:'7px 14px', background:'rgba(74,222,128,0.08)', border:'0.5px solid rgba(74,222,128,0.2)', borderRadius:8, fontSize:11, color:'#4ade80', cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
          <i className="ti ti-refresh" style={{ fontSize:13 }}/> Refresh
        </button>
      </div>

      {/* Slot Overview */}
      <div style={{ ...cardS, marginBottom:16 }}>
        <div style={{ fontSize:11, fontWeight:700, color:C.text, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:12 }}>Slot Overview</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:14 }}>
          {[1,2,3].map(n => {
            const slot = slots.find(s=>s.slot_number===n && s.status==='active')
            return (
              <div key={n} style={{ background:slot?'rgba(74,222,128,0.06)':'rgba(255,255,255,0.03)', border:`0.5px solid ${slot?'rgba(74,222,128,0.3)':'rgba(255,255,255,0.07)'}`, borderRadius:10, padding:'12px 14px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:C.text }}>Slot {n}</span>
                  <span style={{ background:slot?'rgba(74,222,128,0.12)':'rgba(255,255,255,0.06)', color:slot?'#4ade80':'#374151', fontSize:9, fontWeight:700, padding:'2px 8px', borderRadius:99 }}>
                    {slot?'OCCUPIED':'AVAILABLE'}
                  </span>
                </div>
                {slot ? (
                  <>
                    <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:3 }}>{slot.companies?.name}</div>
                    <div style={{ fontSize:10, color:C.text2, marginBottom:6 }}>{slot.companies?.category}</div>
                    <div style={{ display:'flex', gap:10, fontSize:9 }}>
                      <span style={{ color:'#38bdf8' }}>{analytics[slot.id]?.click||0} clicks</span>
                      <span style={{ color:'#fbbf24' }}>{analytics[slot.id]?.quote_request||0} leads</span>
                    </div>
                    <div style={{ fontSize:9, color:C.text3, marginTop:4 }}>
                      Expires: {slot.expires_at?new Date(slot.expires_at).toLocaleDateString('en-AE',{day:'numeric',month:'short',year:'numeric'}):'—'}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize:10, color:C.text3 }}>No active sponsor</div>
                )}
              </div>
            )
          })}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10 }}>
          {[
            { label:'Active Slots',     value:`${activeSlots}/3`, color:'#4ade80' },
            { label:'Pending Requests', value:pendingSlots,       color:'#fbbf24' },
            { label:'Total Revenue',    value:`AED ${totalRevenue.toLocaleString()}`, color:'#4ade80' },
            { label:'Total Clicks',     value:totalClicks,        color:'#38bdf8' },
            { label:'Total Leads',      value:totalLeads,         color:'#fbbf24' },
          ].map(s => (
            <div key={s.label} style={{ background:'rgba(255,255,255,0.03)', borderRadius:8, padding:'10px 12px', textAlign:'center' }}>
              <div style={{ fontSize:18, fontWeight:700, color:s.color }}>{s.value}</div>
              <div style={{ fontSize:9, color:C.text3, marginTop:3 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:14 }}>
        {[
          { id:'slots',   label:'All Requests' },
          { id:'active',  label:'Active Slots' },
          { id:'pricing', label:'Pricing Settings' },
          { id:'leads',   label:'Leads from Slots' },
        ].map(tab => (
          <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
            style={{ padding:'7px 14px', borderRadius:8, border:'none', cursor:'pointer', fontSize:11, fontWeight:600, background:activeTab===tab.id?'rgba(74,222,128,0.15)':'rgba(255,255,255,0.04)', color:activeTab===tab.id?'#4ade80':'#6b7280', transition:'all 0.15s' }}>
            {tab.label}
            {tab.id==='slots' && pendingSlots>0 && <span style={{ marginLeft:6, background:'rgba(248,113,113,0.2)', color:'#f87171', fontSize:9, padding:'1px 5px', borderRadius:99, fontWeight:700 }}>{pendingSlots}</span>}
          </button>
        ))}
      </div>

      {/* Tab: All Requests */}
      {activeTab==='slots' && (
        <div style={cardS}>
          <div style={{ fontSize:11, fontWeight:700, color:C.text, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:12 }}>All Sponsor Requests</div>
          {slots.length===0 ? (
            <div style={{ textAlign:'center', padding:'30px 0', color:C.text3, fontSize:12 }}>No requests yet</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {slots.map(slot => {
                const a  = analytics[slot.id]||{}
                const sc = STATUS_CONFIG[slot.status]||STATUS_CONFIG.pending
                return (
                  <div key={slot.id} style={{ background:'rgba(255,255,255,0.03)', border:`0.5px solid ${slot.status==='pending'?'rgba(251,191,36,0.2)':'rgba(255,255,255,0.06)'}`, borderRadius:10, padding:'12px 14px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:9, flex:1, minWidth:200 }}>
                        <div style={{ width:36, height:36, borderRadius:9, background:'rgba(232,184,75,0.15)', color:'#fbbf24', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, flexShrink:0 }}>
                          {(slot.companies?.name||'?')[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize:12, fontWeight:700, color:C.text }}>{slot.companies?.name||'Unknown'}</div>
                          <div style={{ fontSize:10, color:C.text2 }}>{slot.companies?.category} · {slot.companies?.plan} plan</div>
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:16, flexWrap:'wrap', alignItems:'center' }}>
                        <div style={{ textAlign:'center' }}>
                          <div style={{ fontSize:9, color:C.text3 }}>Duration</div>
                          <div style={{ fontSize:11, fontWeight:600, color:C.text }}>{DURATION_LABELS[slot.duration_months]||'—'}</div>
                        </div>
                        <div style={{ textAlign:'center' }}>
                          <div style={{ fontSize:9, color:C.text3 }}>Price</div>
                          <div style={{ fontSize:11, fontWeight:600, color:'#4ade80' }}>{slot.price_aed?`AED ${slot.price_aed}`:'Not set'}</div>
                        </div>
                        <div style={{ textAlign:'center' }}>
                          <div style={{ fontSize:9, color:C.text3 }}>Slot</div>
                          <div style={{ fontSize:11, fontWeight:600, color:'#38bdf8' }}>{slot.slot_number?`#${slot.slot_number}`:'—'}</div>
                        </div>
                        {slot.status==='active' && <>
                          <div style={{ textAlign:'center' }}><div style={{ fontSize:9, color:C.text3 }}>Clicks</div><div style={{ fontSize:11, fontWeight:600, color:'#38bdf8' }}>{a.click||0}</div></div>
                          <div style={{ textAlign:'center' }}><div style={{ fontSize:9, color:C.text3 }}>Views</div><div style={{ fontSize:11, fontWeight:600, color:'#6366f1' }}>{a.view||0}</div></div>
                          <div style={{ textAlign:'center' }}><div style={{ fontSize:9, color:C.text3 }}>Leads</div><div style={{ fontSize:11, fontWeight:600, color:'#fbbf24' }}>{a.quote_request||0}</div></div>
                        </>}
                        <div style={{ textAlign:'center' }}>
                          <div style={{ fontSize:9, color:C.text3 }}>Date</div>
                          <div style={{ fontSize:10, color:C.text2 }}>{new Date(slot.created_at).toLocaleDateString('en-AE',{day:'numeric',month:'short'})}</div>
                        </div>
                        <span style={{ background:sc.bg, color:sc.color, fontSize:9, fontWeight:700, padding:'3px 8px', borderRadius:99 }}>{sc.label}</span>
                      </div>
                      <div style={{ display:'flex', gap:6 }}>
                        {slot.status==='pending' && <>
                          <button onClick={()=>{ setShowApprove(slot); setApproveForm({ slot_number:[1,2,3].find(n=>!slots.find(s=>s.slot_number===n&&s.status==='active'))||1, price_aed:pricing.find(p=>p.duration_months===slot.duration_months)?.price_aed||'', starts_at:new Date().toISOString().split('T')[0] }) }}
                            style={{ padding:'5px 12px', background:'rgba(74,222,128,0.15)', color:'#4ade80', border:'0.5px solid rgba(74,222,128,0.3)', borderRadius:7, fontSize:10, fontWeight:600, cursor:'pointer' }}>Approve</button>
                          <button onClick={()=>handleReject(slot.id)}
                            style={{ padding:'5px 12px', background:'rgba(248,113,113,0.1)', color:'#f87171', border:'0.5px solid rgba(248,113,113,0.2)', borderRadius:7, fontSize:10, fontWeight:600, cursor:'pointer' }}>Reject</button>
                        </>}
                        {slot.status==='active' && (
                          <button onClick={()=>handleDeactivate(slot.id)}
                            style={{ padding:'5px 12px', background:'rgba(248,113,113,0.1)', color:'#f87171', border:'0.5px solid rgba(248,113,113,0.2)', borderRadius:7, fontSize:10, fontWeight:600, cursor:'pointer' }}>Deactivate</button>
                        )}
                      </div>
                    </div>
                    {slot.message && (
                      <div style={{ marginTop:8, padding:'7px 10px', background:'rgba(255,255,255,0.03)', borderRadius:7, fontSize:10, color:C.text2, borderLeft:'2px solid rgba(255,255,255,0.1)' }}>
                        "{slot.message}"
                      </div>
                    )}
                    {slot.status==='active' && slot.starts_at && slot.expires_at && (
                      <div style={{ marginTop:8 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:C.text3, marginBottom:3 }}>
                          <span>{new Date(slot.starts_at).toLocaleDateString('en-AE',{day:'numeric',month:'short'})}</span>
                          <span style={{ color:new Date(slot.expires_at)<new Date()?'#f87171':'#4ade80' }}>
                            {new Date(slot.expires_at)<new Date()?'Expired':`Expires ${new Date(slot.expires_at).toLocaleDateString('en-AE',{day:'numeric',month:'short',year:'numeric'})}`}
                          </span>
                        </div>
                        <div style={{ height:3, background:'rgba(255,255,255,0.06)', borderRadius:99, overflow:'hidden' }}>
                          <div style={{ height:'100%', background:'#4ade80', borderRadius:99, width:`${Math.min(100,Math.max(0,(new Date()-new Date(slot.starts_at))/(new Date(slot.expires_at)-new Date(slot.starts_at))*100))}%` }}/>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Active Slots */}
      {activeTab==='active' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
          {[1,2,3].map(n => {
            const slot = slots.find(s=>s.slot_number===n && s.status==='active')
            const a = slot?(analytics[slot.id]||{}):{};
            return (
              <div key={n} style={cardS}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                  <span style={{ fontSize:13, fontWeight:700, color:C.text }}>Slot {n}</span>
                  <span style={{ background:slot?'rgba(74,222,128,0.12)':'rgba(255,255,255,0.06)', color:slot?'#4ade80':'#374151', fontSize:9, fontWeight:700, padding:'3px 8px', borderRadius:99 }}>
                    {slot?'ACTIVE':'AVAILABLE'}
                  </span>
                </div>
                {slot ? (
                  <>
                    <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:12 }}>
                      <div style={{ width:40, height:40, borderRadius:10, background:'rgba(232,184,75,0.15)', color:'#fbbf24', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:700 }}>
                        {(slot.companies?.name||'?')[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize:12, fontWeight:700, color:C.text }}>{slot.companies?.name}</div>
                        <div style={{ fontSize:10, color:C.text2 }}>{slot.companies?.category}</div>
                      </div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:12 }}>
                      {[['Clicks',a.click||0,'#38bdf8'],['Views',a.view||0,'#6366f1'],['Leads',a.quote_request||0,'#fbbf24']].map(([l,v,c]) => (
                        <div key={l} style={{ background:'rgba(255,255,255,0.03)', borderRadius:7, padding:8, textAlign:'center' }}>
                          <div style={{ fontSize:16, fontWeight:700, color:c }}>{v}</div>
                          <div style={{ fontSize:9, color:C.text3 }}>{l}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize:10, color:C.text2, marginBottom:4 }}>Revenue: <span style={{ color:'#4ade80', fontWeight:600 }}>AED {slot.price_aed||0}</span></div>
                    <div style={{ fontSize:10, color:C.text2, marginBottom:8 }}>Expires: {slot.expires_at?new Date(slot.expires_at).toLocaleDateString('en-AE',{day:'numeric',month:'short',year:'numeric'}):'—'}</div>
                    <div style={{ height:3, background:'rgba(255,255,255,0.06)', borderRadius:99, overflow:'hidden', marginBottom:10 }}>
                      <div style={{ height:'100%', background:'#4ade80', borderRadius:99, width:`${Math.min(100,Math.max(0,(new Date()-new Date(slot.starts_at))/(new Date(slot.expires_at)-new Date(slot.starts_at))*100))}%` }}/>
                    </div>
                    <button onClick={()=>handleDeactivate(slot.id)} style={{ width:'100%', padding:'6px', background:'rgba(248,113,113,0.1)', color:'#f87171', border:'0.5px solid rgba(248,113,113,0.2)', borderRadius:7, fontSize:10, fontWeight:600, cursor:'pointer' }}>
                      Deactivate
                    </button>
                  </>
                ) : (
                  <div style={{ textAlign:'center', padding:'20px 0' }}>
                    <i className="ti ti-ad-2" style={{ fontSize:28, color:'#1f2937', display:'block', marginBottom:8 }}/>
                    <div style={{ fontSize:11, color:C.text3 }}>No sponsor in this slot</div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Tab: Pricing Settings — WITH DISCOUNT */}
      {activeTab==='pricing' && (
        <div style={cardS}>
          <div style={{ fontSize:11, fontWeight:700, color:C.text, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:14 }}>Slot Pricing Settings</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
            {pricing.map(p => {
              const disc      = discountMap[p.id] || { pct:p.discount_pct||0, custom:'' }
              const activePct = disc.pct
              const finalPrice= calcFinal(p.price_aed, activePct)
              const saving    = p.price_aed - finalPrice

              return (
                <div key={p.id} style={{ background:'rgba(255,255,255,0.03)', border:'0.5px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'14px 16px' }}>
                  <div style={{ fontSize:12, fontWeight:700, color:C.text, marginBottom:10 }}>
                    {DURATION_LABELS[p.duration_months]}
                  </div>

                  {editPrice===p.id ? (
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      <div>
                        <div style={{ fontSize:9, color:C.text3, marginBottom:3 }}>Base Price (AED)</div>
                        <input type="number" defaultValue={p.price_aed} id={`price-${p.id}`}
                          style={{ width:'100%', padding:'7px 10px', background:'rgba(255,255,255,0.06)', border:'0.5px solid rgba(255,255,255,0.12)', borderRadius:7, fontSize:12, color:C.text, outline:'none' }}/>
                      </div>
                      <div>
                        <div style={{ fontSize:9, color:C.text3, marginBottom:3 }}>Description</div>
                        <input type="text" defaultValue={p.description} id={`desc-${p.id}`}
                          style={{ width:'100%', padding:'7px 10px', background:'rgba(255,255,255,0.06)', border:'0.5px solid rgba(255,255,255,0.12)', borderRadius:7, fontSize:11, color:C.text, outline:'none' }}/>
                      </div>
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={()=>handleUpdatePrice(p.id, document.getElementById(`price-${p.id}`).value, document.getElementById(`desc-${p.id}`).value, activePct)}
                          style={{ flex:1, padding:'6px', background:'rgba(74,222,128,0.15)', color:'#4ade80', border:'none', borderRadius:7, fontSize:10, fontWeight:600, cursor:'pointer' }}>Save</button>
                        <button onClick={()=>setEditPrice(null)}
                          style={{ flex:1, padding:'6px', background:'rgba(255,255,255,0.06)', color:C.text2, border:'none', borderRadius:7, fontSize:10, fontWeight:600, cursor:'pointer' }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Price display */}
                      <div style={{ display:'flex', alignItems:'baseline', gap:6, marginBottom:8 }}>
                        {activePct>0 ? (
                          <>
                            <div style={{ fontSize:12, color:C.text3, textDecoration:'line-through' }}>AED {p.price_aed}</div>
                            <div style={{ fontSize:22, fontWeight:700, color:'#4ade80' }}>AED {finalPrice}</div>
                          </>
                        ) : (
                          <div style={{ fontSize:22, fontWeight:700, color:'#4ade80' }}>AED {p.price_aed}</div>
                        )}
                      </div>

                      {/* Discount selector */}
                      <div style={{ marginBottom:10 }}>
                        <div style={{ fontSize:9, color:C.text3, marginBottom:5 }}>Discount</div>
                        <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:6 }}>
                          {[0,10,20,30].map(pct => (
                            <button key={pct}
                              onClick={()=>setDiscountMap(prev=>({...prev,[p.id]:{pct,custom:''}}))}
                              style={{ padding:'3px 8px', borderRadius:99, border:'none', cursor:'pointer', fontSize:9, fontWeight:600, background:activePct===pct?'rgba(74,222,128,0.2)':'rgba(255,255,255,0.06)', color:activePct===pct?'#4ade80':C.text3, transition:'all 0.15s' }}>
                              {pct===0?'None':`${pct}%`}
                            </button>
                          ))}
                          <div style={{ display:'flex', alignItems:'center', gap:3 }}>
                            <input type="number" min="0" max="99" placeholder="Custom"
                              value={disc.custom}
                              onChange={e=>{
                                const v=parseInt(e.target.value)||0
                                setDiscountMap(prev=>({...prev,[p.id]:{pct:v,custom:e.target.value}}))
                              }}
                              style={{ width:58, padding:'3px 6px', background:'rgba(255,255,255,0.06)', border:`0.5px solid ${disc.custom?'rgba(74,222,128,0.3)':'rgba(255,255,255,0.1)'}`, borderRadius:99, fontSize:9, color:C.text, outline:'none', textAlign:'center' }}/>
                            <span style={{ fontSize:9, color:C.text3 }}>%</span>
                          </div>
                        </div>
                        {activePct>0 && (
                          <div style={{ background:'rgba(74,222,128,0.08)', border:'0.5px solid rgba(74,222,128,0.15)', borderRadius:6, padding:'5px 8px', fontSize:9, color:'#4ade80', display:'flex', justifyContent:'space-between' }}>
                            <span>{activePct}% off applied</span>
                            <span>Customer saves AED {saving}</span>
                          </div>
                        )}
                      </div>

                      <div style={{ fontSize:10, color:C.text2, marginBottom:10, lineHeight:1.5 }}>{p.description}</div>

                      <div style={{ display:'flex', gap:5 }}>
                        <button onClick={()=>setEditPrice(p.id)}
                          style={{ flex:1, padding:'6px', background:'rgba(255,255,255,0.06)', color:C.text2, border:'0.5px solid rgba(255,255,255,0.07)', borderRadius:7, fontSize:10, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
                          <i className="ti ti-edit" style={{ fontSize:11 }}/> Edit
                        </button>
                        {activePct>0 && (
                          <button onClick={()=>handleUpdatePrice(p.id, p.price_aed, p.description, activePct)}
                            style={{ flex:1, padding:'6px', background:'rgba(74,222,128,0.15)', color:'#4ade80', border:'0.5px solid rgba(74,222,128,0.25)', borderRadius:7, fontSize:10, fontWeight:600, cursor:'pointer' }}>
                            Save Discount
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
          <div style={{ marginTop:14, padding:'10px 14px', background:'rgba(74,222,128,0.06)', border:'0.5px solid rgba(74,222,128,0.15)', borderRadius:8, fontSize:10, color:'#4ade80' }}>
            Discounts apply to new requests only. Active slots are not affected.
          </div>
        </div>
      )}

      {/* Tab: Leads */}
      {activeTab==='leads' && <LeadsTab slots={slots} C={C}/>}

      {/* Approve Modal */}
      {showApprove && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200 }}>
          <div style={{ background:'#161b22', border:'0.5px solid rgba(255,255,255,0.1)', borderRadius:14, padding:24, width:380 }}>
            <div style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:4 }}>Approve Sponsor Slot</div>
            <div style={{ fontSize:11, color:C.text2, marginBottom:16 }}>{showApprove.companies?.name} · {DURATION_LABELS[showApprove.duration_months]}</div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div>
                <div style={{ fontSize:10, color:C.text3, marginBottom:4 }}>Assign Slot Number</div>
                <select value={approveForm.slot_number} onChange={e=>setApproveForm({...approveForm,slot_number:e.target.value})}
                  style={{ width:'100%', padding:'8px 10px', background:'rgba(255,255,255,0.06)', border:'0.5px solid rgba(255,255,255,0.12)', borderRadius:8, fontSize:11, color:C.text, outline:'none' }}>
                  {[1,2,3].map(n=>{
                    const occ=slots.find(s=>s.slot_number===n&&s.status==='active')
                    return <option key={n} value={n} style={{ background:'#161b22' }}>Slot {n}{occ?` (${occ.companies?.name})`:'  (Available)'}</option>
                  })}
                </select>
              </div>
              <div>
                <div style={{ fontSize:10, color:C.text3, marginBottom:4 }}>Price (AED)</div>
                <input type="number" value={approveForm.price_aed} onChange={e=>setApproveForm({...approveForm,price_aed:e.target.value})}
                  placeholder={`Suggested: AED ${pricing.find(p=>p.duration_months===showApprove.duration_months)?.price_aed||''}`}
                  style={{ width:'100%', padding:'8px 10px', background:'rgba(255,255,255,0.06)', border:'0.5px solid rgba(255,255,255,0.12)', borderRadius:8, fontSize:11, color:C.text, outline:'none' }}/>
                {/* Show discounted suggestion */}
                {(() => {
                  const pp = pricing.find(p=>p.duration_months===showApprove.duration_months)
                  if (pp?.discount_pct > 0) {
                    const final = calcFinal(pp.price_aed, pp.discount_pct)
                    return <div style={{ fontSize:9, color:'#4ade80', marginTop:3 }}>Discounted price ({pp.discount_pct}% off): AED {final}</div>
                  }
                  return null
                })()}
              </div>
              <div>
                <div style={{ fontSize:10, color:C.text3, marginBottom:4 }}>Start Date</div>
                <input type="date" value={approveForm.starts_at} onChange={e=>setApproveForm({...approveForm,starts_at:e.target.value})}
                  style={{ width:'100%', padding:'8px 10px', background:'rgba(255,255,255,0.06)', border:'0.5px solid rgba(255,255,255,0.12)', borderRadius:8, fontSize:11, color:C.text, outline:'none' }}/>
              </div>
              {approveForm.starts_at && (
                <div style={{ padding:'8px 10px', background:'rgba(74,222,128,0.06)', border:'0.5px solid rgba(74,222,128,0.15)', borderRadius:7, fontSize:10, color:'#4ade80' }}>
                  Expires: {(() => { const d=new Date(approveForm.starts_at); d.setMonth(d.getMonth()+showApprove.duration_months); return d.toLocaleDateString('en-AE',{day:'numeric',month:'long',year:'numeric'}) })()}
                </div>
              )}
            </div>
            <div style={{ display:'flex', gap:8, marginTop:16 }}>
              <button onClick={()=>handleApprove(showApprove)} style={{ flex:1, padding:'9px', background:'rgba(74,222,128,0.15)', color:'#4ade80', border:'0.5px solid rgba(74,222,128,0.3)', borderRadius:8, fontSize:11, fontWeight:600, cursor:'pointer' }}>
                Confirm Approval
              </button>
              <button onClick={()=>setShowApprove(null)} style={{ flex:1, padding:'9px', background:'rgba(255,255,255,0.06)', color:C.text2, border:'none', borderRadius:8, fontSize:11, fontWeight:600, cursor:'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function LeadsTab({ slots, C }) {
  const [leads,   setLeads]   = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    async function fetch() {
      const { data } = await supabase.from('sponsor_analytics').select('*, sponsor_slots(slot_number,companies(name))').eq('event_type','quote_request').order('created_at',{ascending:false})
      setLeads(data||[]); setLoading(false)
    }
    fetch()
  }, [])
  if (loading) return <div style={{ textAlign:'center', padding:'30px', color:C.text3 }}>Loading...</div>
  return (
    <div style={{ background:C.card, border:`0.5px solid ${C.border}`, borderRadius:12, padding:'14px 16px' }}>
      <div style={{ fontSize:11, fontWeight:700, color:C.text, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:12 }}>Leads from Sponsor Slots ({leads.length})</div>
      {leads.length===0 ? (
        <div style={{ textAlign:'center', padding:'30px 0', color:C.text3, fontSize:12 }}>No leads yet</div>
      ) : leads.map(lead => (
        <div key={lead.id} style={{ background:'rgba(255,255,255,0.03)', border:'0.5px solid rgba(255,255,255,0.06)', borderRadius:9, padding:'10px 12px', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap', marginBottom:8 }}>
          <div style={{ flex:1, minWidth:160 }}>
            <div style={{ fontSize:12, fontWeight:600, color:C.text }}>{lead.lead_name||'Anonymous'}</div>
            <div style={{ fontSize:10, color:C.text2, marginTop:2 }}>{lead.lead_phone||'No phone'}</div>
          </div>
          <div style={{ flex:2, minWidth:200, fontSize:10, color:C.text2, lineHeight:1.5 }}>{lead.lead_message||'No message'}</div>
          <div style={{ textAlign:'center' }}><div style={{ fontSize:9, color:C.text3 }}>Company</div><div style={{ fontSize:10, fontWeight:600, color:'#fbbf24' }}>{lead.sponsor_slots?.companies?.name||'—'}</div></div>
          <div style={{ textAlign:'center' }}><div style={{ fontSize:9, color:C.text3 }}>Slot</div><div style={{ fontSize:10, fontWeight:600, color:'#38bdf8' }}>#{lead.sponsor_slots?.slot_number||'—'}</div></div>
          <div style={{ fontSize:9, color:C.text3 }}>{new Date(lead.created_at).toLocaleDateString('en-AE',{day:'numeric',month:'short',year:'numeric'})}</div>
        </div>
      ))}
    </div>
  )
}
