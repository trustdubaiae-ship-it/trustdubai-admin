// trustdubai-admin/src/pages/SubscriptionManager.jsx
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'

/* =========================================================================
   SUBSCRIPTION MANAGER  ·  Super Admin only
   Tab 1: Plans & Rights  (this build)
   Tab 2: Add-on Services (placeholder — next)
   Tab 3: Company Manager (placeholder — next)
   100% DB-driven from: plans, feature_registry, addon_services.
   ========================================================================= */

export default function SubscriptionManager({ theme, adminData }) {
  const isDark = theme !== 'light'
  const isSuperAdmin = adminData?.role === 'superadmin' || adminData?.role === 'super_admin'

  const [tab, setTab] = useState('plans')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const [features, setFeatures] = useState([])   // feature_registry
  const [plans, setPlans] = useState([])         // plans
  const [curKey, setCurKey] = useState(null)     // selected plan_key

  const [addons, setAddons] = useState([])       // addon_services
  const [companies, setCompanies] = useState([]) // companies (lite)
  const [coSearch, setCoSearch] = useState('')
  const [coId, setCoId] = useState(null)         // selected company id

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [{ data: fr }, { data: pl }, { data: ad }, { data: co }] = await Promise.all([
        supabase.from('feature_registry').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('plans').select('*').order('sort_order'),
        supabase.from('addon_services').select('*').order('sort_order'),
        supabase.from('companies').select('id,name,plan,plan_expires_at,addons,overrides,logo_url,is_verified').order('name'),
      ])
      setFeatures(fr || [])
      setPlans((pl || []).map(p => ({ ...p, limits: p.limits || {}, rights: p.rights || {} })))
      setAddons((ad || []).map(a => ({ ...a, unlocks: a.unlocks || [] })))
      setCompanies((co || []).map(c => ({ ...c, addons: c.addons || {}, overrides: c.overrides || {} })))
      if (pl && pl.length) setCurKey(prev => prev || pl[0].plan_key)
    } catch (e) { console.error('SubMgr load', e) }
    finally { setLoading(false) }
  }

  const cur = useMemo(() => plans.find(p => p.plan_key === curKey) || null, [plans, curKey])

  function patchCur(patch) {
    setPlans(ps => ps.map(p => p.plan_key === curKey ? { ...p, ...patch } : p))
  }
  function setRight(key, val) {
    if (!cur) return
    patchCur({ rights: { ...cur.rights, [key]: val } })
  }
  function setLimit(key, val) {
    if (!cur) return
    patchCur({ limits: { ...cur.limits, [key]: val } })
  }

  async function savePlan() {
    if (!cur) return
    setSaving(true)
    try {
      const { error } = await supabase.from('plans').update({
        actual_price: Number(cur.actual_price) || 0,
        price: Number(cur.price) || 0,
        yearly_discount_pct: Number(cur.yearly_discount_pct) || 0,
        trial_days: Number(cur.trial_days) || 0,
        card_required: !!cur.card_required,
        limits: cur.limits,
        rights: cur.rights,
        updated_at: new Date().toISOString(),
      }).eq('plan_key', cur.plan_key)
      if (error) throw error
      showToast('Saved ✓')
    } catch (e) { console.error(e); showToast('Save failed — ' + (e.message || 'error')) }
    finally { setSaving(false) }
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2200) }

  /* ---------- Tab 2: Add-on Services ---------- */
  function patchAddon(key, patch) {
    setAddons(as => as.map(a => a.addon_key === key ? { ...a, ...patch } : a))
  }
  async function saveAddon(a) {
    setSaving(true)
    try {
      const { error } = await supabase.from('addon_services').update({
        name: a.name,
        price: Number(a.price) || 0,
        billing: a.billing || 'monthly',
        description: a.description || '',
        is_active: !!a.is_active,
      }).eq('addon_key', a.addon_key)
      if (error) throw error
      showToast(a.name + ' saved ✓')
    } catch (e) { console.error(e); showToast('Save failed — ' + (e.message || 'error')) }
    finally { setSaving(false) }
  }

  /* ---------- Tab 3: Company Manager ---------- */
  const company = useMemo(() => companies.find(c => c.id === coId) || null, [companies, coId])
  function patchCompany(patch) {
    setCompanies(cs => cs.map(c => c.id === coId ? { ...c, ...patch } : c))
  }
  function toggleCompanyAddon(key) {
    if (!company) return
    patchCompany({ addons: { ...company.addons, [key]: !company.addons[key] } })
  }
  function setOverride(key, val) {
    if (!company) return
    patchCompany({ overrides: { ...company.overrides, [key]: val } })
  }
  async function saveCompany() {
    if (!company) return
    setSaving(true)
    try {
      const { error } = await supabase.from('companies').update({
        plan: company.plan,
        plan_expires_at: company.plan_expires_at || null,
        addons: company.addons,
        overrides: company.overrides,
        is_verified: !!company.is_verified,
      }).eq('id', company.id)
      if (error) throw error
      showToast(company.name + ' saved ✓')
    } catch (e) { console.error(e); showToast('Save failed — ' + (e.message || 'error')) }
    finally { setSaving(false) }
  }

  /* ---------- theme ---------- */
  const C = {
    text:  isDark ? '#f1f5f9' : '#0f172a',
    text2: isDark ? '#94a3b8' : '#64748b',
    text3: isDark ? '#6b7280' : '#94a3b8',
    border:isDark ? 'rgba(255,255,255,0.08)' : '#e5e9f0',
    card:  isDark ? '#141921' : '#ffffff',
    card2: isDark ? '#0f141b' : '#f8fafc',
    bg:    isDark ? '#0a0e14' : '#f4f6fa',
    green: '#22c55e', track: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
    info:  isDark ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.08)',
  }
  const input = { width:'100%', padding:'8px 10px', borderRadius:8, border:`1px solid ${C.border}`, background:C.card2, color:C.text, fontSize:13, outline:'none', boxSizing:'border-box' }
  const lbl = { fontSize:11, color:C.text2, display:'block', marginBottom:4 }
  const card = { background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:'16px 18px' }

  if (!isSuperAdmin) return (
    <div style={{ padding:40, textAlign:'center', color:C.text2 }}>
      <i className="ti ti-lock" style={{ fontSize:34, color:C.text3, display:'block', marginBottom:10 }}/>
      <div style={{ fontSize:16, fontWeight:700, color:C.text, marginBottom:6 }}>Super Admin only</div>
      <div style={{ fontSize:13 }}>You don't have access to the Subscription Manager.</div>
    </div>
  )

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>
      <div style={{ width:36, height:36, border:`3px solid ${C.green}`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin .8s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const off = cur && cur.actual_price > cur.price && cur.actual_price > 0
    ? Math.round((1 - cur.price / cur.actual_price) * 100) : 0
  const yearly = cur ? Math.round((Number(cur.price)||0) * 12 * (1 - (Number(cur.yearly_discount_pct)||0) / 100)) : 0

  // group features by category for the rights/limits editor
  const byCat = {}
  features.forEach(f => { (byCat[f.category] = byCat[f.category] || []).push(f) })
  const cats = Object.keys(byCat)

  const limitFeatures = features.filter(f => f.type === 'limit')

  return (
    <div style={{ width:'100%', maxWidth:1200, margin:'0 auto', color:C.text }}>
      {/* header */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4, flexWrap:'wrap' }}>
        <div style={{ width:32, height:32, borderRadius:9, background:C.green+'22', color:C.green, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <i className="ti ti-adjustments" style={{ fontSize:17 }}/>
        </div>
        <h1 style={{ fontSize:20, fontWeight:800, margin:0 }}>Subscription Manager</h1>
        <span style={{ fontSize:10, color:C.text3, border:`1px solid ${C.border}`, padding:'2px 8px', borderRadius:99 }}>Super Admin only</span>
      </div>
      <p style={{ fontSize:13, color:C.text2, margin:'2px 0 16px' }}>Define plans, pricing, limits and rights. Saved to the database — no re-coding to change.</p>

      {/* tabs */}
      <div style={{ display:'flex', gap:4, borderBottom:`1px solid ${C.border}`, marginBottom:18, flexWrap:'wrap' }}>
        {[['plans','Plans & Rights'],['addons','Add-on Services'],['companies','Company Manager']].map(([k,label]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ background:'none', border:'none', cursor:'pointer', fontSize:13, fontWeight:tab===k?600:500,
              color: tab===k?C.text:C.text3, padding:'9px 13px',
              borderBottom: tab===k?`2px solid ${C.green}`:'2px solid transparent' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ===================== TAB 2: ADD-ON SERVICES ===================== */}
      {tab === 'addons' && (
        addons.length === 0 ? (
          <div style={{ ...card, color:C.text2 }}>No add-ons found. Run the Step 1 SQL seed.</div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:14 }}>
            {addons.map(a => {
              const unlockLabels = (a.unlocks || []).map(k => {
                const f = features.find(ff => ff.feature_key === k); return f ? f.label : k
              })
              return (
                <div key={a.addon_key} style={{ ...card }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                    <div style={{ width:38, height:38, borderRadius:10, background:C.green+'18', color:C.green, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <i className={`ti ${a.icon || 'ti-puzzle'}`} style={{ fontSize:19 }}/>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <input value={a.name} onChange={e=>patchAddon(a.addon_key,{name:e.target.value})} style={{ ...input, fontWeight:700, padding:'5px 8px' }}/>
                    </div>
                    <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:C.text2, cursor:'pointer', flexShrink:0 }}>
                      <input type="checkbox" checked={!!a.is_active} onChange={e=>patchAddon(a.addon_key,{is_active:e.target.checked})}/> Active
                    </label>
                  </div>

                  <label style={lbl}>Description</label>
                  <input value={a.description||''} onChange={e=>patchAddon(a.addon_key,{description:e.target.value})} style={{ ...input, marginBottom:10 }}/>

                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
                    <div><label style={lbl}>Price (AED)</label><input type="number" value={a.price} onChange={e=>patchAddon(a.addon_key,{price:e.target.value})} style={input}/></div>
                    <div><label style={lbl}>Billing</label>
                      <select value={a.billing} onChange={e=>patchAddon(a.addon_key,{billing:e.target.value})} style={input}>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                        <option value="one_time">One-time</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ fontSize:11, color:C.text3, marginBottom:5 }}>Unlocks {unlockLabels.length} features:</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:14 }}>
                    {unlockLabels.map((l,i)=>(
                      <span key={i} style={{ fontSize:10.5, color:C.text2, background:C.card2, border:`1px solid ${C.border}`, borderRadius:6, padding:'2px 7px' }}>{l}</span>
                    ))}
                  </div>

                  <button onClick={()=>saveAddon(a)} disabled={saving}
                    style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:6, background:C.green, color:'#fff', border:'none', borderRadius:9, padding:'9px', fontSize:13, fontWeight:600, cursor:saving?'wait':'pointer', opacity:saving?0.7:1 }}>
                    <i className="ti ti-check" style={{ fontSize:14 }}/> Save
                  </button>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* ===================== TAB 3: COMPANY MANAGER ===================== */}
      {tab === 'companies' && (
        <div style={{ display:'grid', gridTemplateColumns:'minmax(0,260px) minmax(0,1fr)', gap:16, alignItems:'start' }}>
          {/* company list */}
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:7, background:C.card2, border:`1px solid ${C.border}`, borderRadius:9, padding:'7px 10px', marginBottom:8 }}>
              <i className="ti ti-search" style={{ fontSize:14, color:C.text3 }}/>
              <input placeholder="Search company..." value={coSearch} onChange={e=>setCoSearch(e.target.value)}
                style={{ border:'none', background:'none', outline:'none', fontSize:12.5, width:'100%', color:C.text }}/>
            </div>
            <div style={{ maxHeight:'70vh', overflowY:'auto', display:'flex', flexDirection:'column', gap:3 }}>
              {companies.filter(c => !coSearch || (c.name||'').toLowerCase().includes(coSearch.toLowerCase())).map(c => {
                const on = c.id === coId
                const ic = (c.name||'?').split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()
                const pc = plans.find(p => p.plan_key === c.plan)
                return (
                  <div key={c.id} onClick={()=>setCoId(c.id)}
                    style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 9px', borderRadius:9, cursor:'pointer',
                      background: on?C.info:'transparent', border: on?`1px solid ${C.green}`:`1px solid transparent` }}>
                    <span style={{ width:28, height:28, borderRadius:7, background:C.card2, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:C.text2, flexShrink:0, overflow:'hidden' }}>
                      {c.logo_url ? <img src={c.logo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : ic}
                    </span>
                    <span style={{ flex:1, minWidth:0, fontSize:12.5, color:C.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.name}</span>
                    <span style={{ fontSize:9, fontWeight:700, padding:'1px 7px', borderRadius:99, textTransform:'capitalize', color:pc?.color||C.text3, background:(pc?.color||C.text3)+'1f' }}>{c.plan||'free'}</span>
                  </div>
                )
              })}
              {companies.length === 0 && <div style={{ fontSize:12.5, color:C.text3, padding:10 }}>No companies found.</div>}
            </div>
          </div>

          {/* company panel */}
          {!company ? (
            <div style={{ ...card, textAlign:'center', padding:'48px 20px', color:C.text2 }}>
              <i className="ti ti-building-store" style={{ fontSize:30, color:C.text3, display:'block', marginBottom:10 }}/>
              <div style={{ fontSize:14, color:C.text2 }}>Select a company to manage its subscription.</div>
            </div>
          ) : (() => {
            const planObj = plans.find(p => p.plan_key === company.plan)
            const planPrice = Number(planObj?.price) || 0
            const addonTotal = addons.reduce((s,a) => s + (company.addons[a.addon_key] && a.is_active ? (Number(a.price)||0) : 0), 0)
            return (
              <div style={{ ...card }}>
                <div style={{ display:'flex', alignItems:'center', gap:11, marginBottom:16 }}>
                  <span style={{ width:44, height:44, borderRadius:11, background:C.card2, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:700, color:C.text2, overflow:'hidden', flexShrink:0 }}>
                    {company.logo_url ? <img src={company.logo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : (company.name||'?').split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()}
                  </span>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:16, fontWeight:700, color:C.text }}>{company.name}</div>
                    <div style={{ fontSize:11.5, color:C.text2 }}>Company ID #{company.id}</div>
                  </div>
                </div>

                {/* plan */}
                <div style={{ fontSize:11, color:C.text3, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>Plan</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:18 }}>
                  <div><label style={lbl}>Current plan</label>
                    <select value={company.plan||'free'} onChange={e=>patchCompany({plan:e.target.value})} style={{ ...input, textTransform:'capitalize' }}>
                      {plans.map(p => <option key={p.plan_key} value={p.plan_key}>{p.name}</option>)}
                    </select>
                  </div>
                  <div><label style={lbl}>Expiry date</label>
                    <input type="date" value={(company.plan_expires_at||'').slice(0,10)} onChange={e=>patchCompany({plan_expires_at:e.target.value})} style={input}/>
                  </div>
                </div>

                {/* add-ons */}
                <div style={{ fontSize:11, color:C.text3, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6 }}>Add-on services</div>
                {addons.map(a => {
                  const on = !!company.addons[a.addon_key]
                  return (
                    <div key={a.addon_key} onClick={()=>toggleCompanyAddon(a.addon_key)}
                      style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 2px', borderBottom:`1px solid ${C.border}`, cursor:'pointer', opacity:a.is_active?1:0.5 }}>
                      <i className={`ti ${a.icon||'ti-puzzle'}`} style={{ fontSize:17, color:C.text2 }}/>
                      <span style={{ flex:1, fontSize:13, color:C.text }}>{a.name}{!a.is_active && <span style={{ fontSize:9.5, color:C.text3 }}> (inactive)</span>}</span>
                      <span style={{ fontSize:11.5, color:C.text2 }}>AED {(Number(a.price)||0).toLocaleString()}/{a.billing==='one_time'?'once':a.billing==='yearly'?'yr':'mo'}</span>
                      <span style={{ width:34, height:18, borderRadius:99, background:on?C.green:C.track, position:'relative', flexShrink:0, transition:'.15s' }}>
                        <span style={{ position:'absolute', top:2, left:on?18:2, width:14, height:14, borderRadius:'50%', background:'#fff', transition:'.15s' }}/>
                      </span>
                    </div>
                  )
                })}

                {/* overrides */}
                <div style={{ fontSize:11, color:C.text3, textTransform:'uppercase', letterSpacing:'.05em', margin:'16px 0 8px' }}>Overrides</div>
                <label style={{ display:'flex', alignItems:'center', gap:9, fontSize:13, color:C.text, marginBottom:10, cursor:'pointer' }}>
                  <input type="checkbox" checked={!!company.is_verified} onChange={e=>patchCompany({is_verified:e.target.checked})}/> Verified badge (manual override)
                </label>
                <div style={{ display:'flex', alignItems:'center', gap:10, fontSize:13, color:C.text, marginBottom:16 }}>
                  Extra staff slots
                  <input type="number" value={company.overrides.extra_staff ?? 0} onChange={e=>setOverride('extra_staff', parseInt(e.target.value)||0)} style={{ ...input, width:80 }}/>
                  <span style={{ fontSize:11, color:C.text3 }}>beyond plan limit</span>
                </div>

                {/* billing */}
                <div style={{ background:C.card2, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:6 }}>
                  <span style={{ fontSize:12.5, color:C.text2 }}>Monthly billing</span>
                  <span style={{ fontSize:18, fontWeight:800, color:C.green }}>AED {(planPrice+addonTotal).toLocaleString()}<span style={{ fontSize:12, color:C.text2 }}>/mo</span></span>
                </div>
                <div style={{ fontSize:11, color:C.text3, marginBottom:16 }}>{planObj?.name||'Plan'} {planPrice.toLocaleString()} + add-ons {addonTotal.toLocaleString()}</div>

                <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                  <button onClick={saveCompany} disabled={saving}
                    style={{ display:'flex', alignItems:'center', gap:6, background:C.green, color:'#fff', border:'none', borderRadius:10, padding:'10px 18px', fontSize:14, fontWeight:600, cursor:saving?'wait':'pointer', opacity:saving?0.7:1 }}>
                    <i className="ti ti-check" style={{ fontSize:15 }}/> {saving?'Saving…':'Save'}
                  </button>
                  {toast && <span style={{ fontSize:13, color: toast.includes('fail')?'#ef4444':C.green, fontWeight:600 }}>{toast}</span>}
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* ===================== TAB 1: PLANS & RIGHTS ===================== */}
      {tab === 'plans' && (
        !cur ? (
          <div style={{ ...card, color:C.text2 }}>No plans found. Run the Step 1 SQL seed.</div>
      ) : (
        <>
          {/* plan selector */}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:18 }}>
            {plans.map(p => {
              const on = p.plan_key === curKey
              return (
                <button key={p.plan_key} onClick={() => setCurKey(p.plan_key)}
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:600,
                    background: on ? C.info : 'transparent', color: on ? C.green : C.text2,
                    border: on ? `2px solid ${C.green}` : `1px solid ${C.border}` }}>
                  <i className={`ti ${p.badge_icon || 'ti-building'}`} style={{ fontSize:14, color:p.color }}/> {p.name}
                </button>
              )
            })}
          </div>

          {/* pricing */}
          <div style={{ ...card, marginBottom:16 }}>
            <div style={{ fontSize:11, color:C.text3, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:12 }}>Pricing — {cur.name}</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:10 }}>
              <div><label style={lbl}>Actual rate</label><input type="number" style={input} value={cur.actual_price} onChange={e=>patchCur({actual_price:e.target.value})}/></div>
              <div><label style={lbl}>Price (pays)</label><input type="number" style={input} value={cur.price} onChange={e=>patchCur({price:e.target.value})}/></div>
              <div><label style={lbl}>Yearly disc %</label><input type="number" style={input} value={cur.yearly_discount_pct} onChange={e=>patchCur({yearly_discount_pct:e.target.value})}/></div>
              <div><label style={lbl}>Trial days</label><input type="number" style={input} value={cur.trial_days} onChange={e=>patchCur({trial_days:e.target.value})}/></div>
            </div>
            <label style={{ display:'flex', alignItems:'center', gap:9, fontSize:13, color:C.text, marginTop:12, cursor:'pointer' }}>
              <input type="checkbox" checked={!!cur.card_required} onChange={e=>patchCur({card_required:e.target.checked})}/> Card required to start trial (auto-charge after)
            </label>
            <div style={{ marginTop:12, fontSize:12.5, color:C.text2, lineHeight:1.6 }}>
              Monthly: <b style={{color:C.text}}>AED {(Number(cur.price)||0).toLocaleString()}</b>
              {off>0 && <span> (was {(Number(cur.actual_price)||0).toLocaleString()}, <span style={{color:C.green}}>{off}% off</span>)</span>}
              {' · '}Yearly: <b style={{color:C.text}}>AED {yearly.toLocaleString()}</b>{(Number(cur.yearly_discount_pct)||0)>0 && <span style={{color:C.green}}> ({cur.yearly_discount_pct}% off)</span>}
              {(Number(cur.trial_days)||0)>0 && <span> · {cur.trial_days}-day free trial{cur.card_required?' (card req.)':''}</span>}
            </div>
          </div>

          {/* limits */}
          {limitFeatures.length > 0 && (
            <div style={{ ...card, marginBottom:16 }}>
              <div style={{ fontSize:11, color:C.text3, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:12 }}>Limits</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:10 }}>
                {limitFeatures.map(f => (
                  <div key={f.feature_key}>
                    <label style={lbl}>{f.label}</label>
                    <input type="number" style={input} value={cur.limits[f.feature_key] ?? 0}
                      onChange={e=>setLimit(f.feature_key, parseInt(e.target.value)||0)}/>
                  </div>
                ))}
              </div>
              <div style={{ fontSize:10.5, color:C.text3, marginTop:8 }}>Tip: 0 = disabled, 999 = unlimited.</div>
            </div>
          )}

          {/* rights by category */}
          <div style={{ ...card }}>
            <div style={{ fontSize:11, color:C.text3, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6 }}>Rights — toggle what {cur.name} includes</div>
            {cats.map(catName => {
              const toggles = byCat[catName].filter(f => f.type !== 'limit')
              if (toggles.length === 0) return null
              return (
                <div key={catName} style={{ marginTop:14 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:C.text2, marginBottom:4 }}>{catName}</div>
                  {toggles.map(f => {
                    const on = !!cur.rights[f.feature_key]
                    const isAddon = f.type === 'addon'
                    return (
                      <div key={f.feature_key} onClick={()=> !isAddon && setRight(f.feature_key, !on)}
                        style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 2px', borderBottom:`1px solid ${C.border}`, cursor: isAddon?'default':'pointer', opacity: isAddon?0.6:1 }}>
                        <span style={{ flex:1, fontSize:13, color:C.text }}>{f.label}
                          {isAddon && <span style={{ fontSize:9, fontWeight:700, color:'#f59e0b', background:'rgba(245,158,11,0.14)', padding:'1px 6px', borderRadius:6, marginLeft:7 }}>ADD-ON</span>}
                        </span>
                        {isAddon ? (
                          <span style={{ fontSize:10.5, color:C.text3 }}>sold separately</span>
                        ) : (
                          <span style={{ width:34, height:18, borderRadius:99, background: on?C.green:C.track, position:'relative', flexShrink:0, transition:'.15s' }}>
                            <span style={{ position:'absolute', top:2, left: on?18:2, width:14, height:14, borderRadius:'50%', background:'#fff', transition:'.15s' }}/>
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>

          {/* save bar */}
          <div style={{ display:'flex', gap:10, marginTop:18, alignItems:'center' }}>
            <button onClick={savePlan} disabled={saving}
              style={{ display:'flex', alignItems:'center', gap:6, background:C.green, color:'#fff', border:'none', borderRadius:10, padding:'10px 18px', fontSize:14, fontWeight:600, cursor: saving?'wait':'pointer', opacity: saving?0.7:1 }}>
              <i className="ti ti-check" style={{ fontSize:15 }}/> {saving?'Saving…':'Save changes'}
            </button>
            <button onClick={load}
              style={{ background:'transparent', color:C.text2, border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 16px', fontSize:14, fontWeight:600, cursor:'pointer' }}>
              Reset
            </button>
            {toast && <span style={{ fontSize:13, color: toast.includes('fail')?'#ef4444':C.green, fontWeight:600 }}>{toast}</span>}
          </div>
        </>
        )
      )}
    </div>
  )
}
