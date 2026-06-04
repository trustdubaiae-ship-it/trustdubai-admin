import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Distribution({ theme }) {
  const [templates, setTemplates]   = useState([])
  const [selected, setSelected]     = useState(null)
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [recentDist, setRecentDist] = useState([])
  const [stats, setStats]           = useState({ total: 0, today: 0, companies: 0 })
  const [toast, setToast]           = useState('')
  const [quotas, setQuotas]         = useState([])
  const [quotaSaving, setQuotaSaving] = useState(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const { data: tpls } = await supabase
        .from('distribution_templates')
        .select('*')
        .order('created_at', { ascending: true })
      setTemplates(tpls || [])
      const active = (tpls || []).find(t => t.is_active) || (tpls || [])[0]
      setSelected(active || null)

      const { data: dist } = await supabase
        .from('lead_distributions')
        .select('id, rank, status, assigned_at, lead_id, company_id, companies(name), lead_submissions(name)')
        .order('assigned_at', { ascending: false })
        .limit(15)
      setRecentDist(dist || [])

      const { count: total } = await supabase
        .from('lead_distributions')
        .select('*', { count: 'exact', head: true })
      const todayStart = new Date(); todayStart.setHours(0,0,0,0)
      const { count: today } = await supabase
        .from('lead_distributions')
        .select('*', { count: 'exact', head: true })
        .gte('assigned_at', todayStart.toISOString())
      const { data: distinctCo } = await supabase
        .from('lead_distributions')
        .select('company_id')
      const uniqueCos = new Set((distinctCo || []).map(d => d.company_id)).size
      setStats({ total: total || 0, today: today || 0, companies: uniqueCos })

      // plan quota (super-admin editable)
      const { data: planRows } = await supabase
        .from('plan_limits')
        .select('plan, display_name, monthly_lead_quota')
        .order('monthly_lead_quota', { ascending: true })
      setQuotas(planRows || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  function flash(msg) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  async function activateTemplate(id) {
    setSaving(true)
    try {
      await supabase.from('distribution_templates').update({ is_active: false }).neq('id', id)
      await supabase.from('distribution_templates').update({ is_active: true }).eq('id', id)
      await loadAll()
      flash('Template activated')
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  async function updateField(field, value) {
    if (!selected) return
    setSelected({ ...selected, [field]: value })
    setSaving(true)
    try {
      await supabase.from('distribution_templates').update({ [field]: value }).eq('id', selected.id)
      setTemplates(prev => prev.map(t => t.id === selected.id ? { ...t, [field]: value } : t))
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  async function updateQuota(plan, value) {
    const v = value === '' ? '' : Math.max(0, parseInt(value) || 0)
    setQuotas(prev => prev.map(q => q.plan === plan ? { ...q, monthly_lead_quota: v } : q))
  }
  async function saveQuota(plan) {
    const row = quotas.find(q => q.plan === plan)
    if (!row) return
    const v = parseInt(row.monthly_lead_quota) || 0
    setQuotaSaving(plan)
    try {
      await supabase.from('plan_limits').update({ monthly_lead_quota: v }).eq('plan', plan)
      setQuotas(prev => prev.map(q => q.plan === plan ? { ...q, monthly_lead_quota: v } : q))
      flash(`${row.display_name || plan} quota saved`)
    } catch (e) { console.error(e); flash('Save failed') }
    finally { setQuotaSaving(null) }
  }

  const isDark = theme === 'dark'
  const bg       = isDark ? '#0f1623' : '#f7f9fc'
  const card     = isDark ? '#161f2e' : '#ffffff'
  const border   = isDark ? '#243044' : '#e6ebf2'
  const text     = isDark ? '#e8eef7' : '#1a2332'
  const muted    = isDark ? '#8a98ad' : '#6b7787'
  const accent   = '#0099cc'

  const planMeta = {
    free:     { color:'#6b7787', bg:isDark?'#1c2433':'#f1f5f9' },
    silver:   { color:'#5b6b8a', bg:isDark?'#1c2840':'#eef2f9' },
    gold:     { color:'#b8860b', bg:isDark?'#2a2410':'#fef9ed' },
    platinum: { color:'#7c3aed', bg:isDark?'#241c3a':'#f3effe' },
  }

  const statusColors = {
    assigned:    { bg:'#e0f9ff', color:'#0077aa' },
    viewed:      { bg:'#ede9fe', color:'#5b21b6' },
    contacted:   { bg:'#fef3c7', color:'#92400e' },
    quoted:      { bg:'#dbeafe', color:'#1e40af' },
    won:         { bg:'#d1fae5', color:'#065f46' },
    lost:        { bg:'#fee2e2', color:'#991b1b' },
    transferred: { bg:'#f3f4f6', color:'#374151' },
  }

  function Toggle({ on, onChange, disabled }) {
    return (
      <button onClick={() => !disabled && onChange(!on)}
        style={{ width:42, height:24, borderRadius:99, border:'none', cursor:disabled?'default':'pointer',
          background: on ? '#10b981' : (isDark?'#2a3850':'#cbd5e1'), position:'relative', transition:'all 0.15s', opacity:disabled?0.5:1 }}>
        <div style={{ width:18, height:18, background:'#fff', borderRadius:'50%', position:'absolute', top:3,
          left: on ? 21 : 3, transition:'all 0.15s' }} />
      </button>
    )
  }

  if (loading) {
    return <div style={{ padding:40, textAlign:'center', color:muted }}>Loading distribution engine...</div>
  }

  return (
    <div style={{ background:bg, minHeight:'100vh', padding:'20px 24px' }}>
      {toast && (
        <div style={{ position:'fixed', top:20, right:20, background:'#10b981', color:'#fff', padding:'10px 18px', borderRadius:9, fontSize:13, fontWeight:600, zIndex:1000 }}>{toast}</div>
      )}

      <div style={{ marginBottom:6 }}>
        <h1 style={{ fontSize:22, fontWeight:700, color:text, margin:0 }}>Lead Distribution</h1>
        <p style={{ fontSize:13, color:muted, margin:'4px 0 0' }}>Control how platform leads reach companies — the engine.</p>
      </div>

      {/* stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12, margin:'18px 0' }}>
        {[
          { label:'Total Distributed', value:stats.total, icon:'ti-send' },
          { label:'Today', value:stats.today, icon:'ti-calendar' },
          { label:'Companies Reached', value:stats.companies, icon:'ti-building' },
        ].map(s => (
          <div key={s.label} style={{ background:card, border:`1px solid ${border}`, borderRadius:12, padding:'14px 16px' }}>
            <div style={{ fontSize:12, color:muted, marginBottom:4, display:'flex', alignItems:'center', gap:6 }}>
              <i className={`ti ${s.icon}`} style={{ fontSize:14, color:accent }} /> {s.label}
            </div>
            <div style={{ fontSize:26, fontWeight:700, color:text }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'300px 1fr', gap:16 }}>

        {/* LEFT — templates list */}
        <div>
          <div style={{ fontSize:11, color:muted, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:8, fontWeight:700 }}>Templates</div>
          {templates.map(t => (
            <div key={t.id} onClick={() => setSelected(t)}
              style={{ background:card, border:`1.5px solid ${selected?.id===t.id ? accent : border}`, borderRadius:11, padding:'12px 14px', marginBottom:8, cursor:'pointer' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:3 }}>
                <span style={{ fontSize:14, fontWeight:700, color:text }}>{t.name}</span>
                {t.is_active && <span style={{ fontSize:9, fontWeight:700, background:'#d1fae5', color:'#065f46', padding:'2px 8px', borderRadius:99 }}>ACTIVE</span>}
              </div>
              <div style={{ fontSize:11, color:muted, lineHeight:1.4 }}>{t.description}</div>
              {!t.is_active && (
                <button onClick={(e) => { e.stopPropagation(); activateTemplate(t.id) }} disabled={saving}
                  style={{ marginTop:8, fontSize:11, fontWeight:600, color:accent, background:'transparent', border:`1px solid ${accent}`, borderRadius:7, padding:'4px 10px', cursor:'pointer' }}>
                  Set Active
                </button>
              )}
            </div>
          ))}
        </div>

        {/* RIGHT — selected template rules */}
        {selected && (
          <div style={{ background:card, border:`1px solid ${border}`, borderRadius:12, padding:'18px 20px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
              <h2 style={{ fontSize:17, fontWeight:700, color:text, margin:0 }}>{selected.name}</h2>
              {selected.is_active
                ? <span style={{ fontSize:10, fontWeight:700, background:'#d1fae5', color:'#065f46', padding:'3px 10px', borderRadius:99 }}>ACTIVE ENGINE</span>
                : <span style={{ fontSize:10, fontWeight:600, background:border, color:muted, padding:'3px 10px', borderRadius:99 }}>INACTIVE</span>
              }
            </div>
            <p style={{ fontSize:12.5, color:muted, margin:'0 0 18px' }}>{selected.description}</p>

            {/* Engine */}
            <div style={{ fontSize:11, color:muted, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:8, fontWeight:700 }}>Engine</div>

            <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', border:`1px solid ${border}`, borderRadius:10, marginBottom:10 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:600, color:text }}>Leads per company</div>
                <div style={{ fontSize:12, color:muted }}>How many top companies each lead goes to</div>
              </div>
              <input type="number" min={1} max={10} value={selected.leads_per_company || 3}
                onChange={e => updateField('leads_per_company', parseInt(e.target.value) || 1)}
                style={{ width:56, padding:'7px', textAlign:'center', fontSize:15, fontWeight:700, color:accent, background:bg, border:`1px solid ${border}`, borderRadius:8, outline:'none' }} />
            </div>

            <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', border:`1px solid ${border}`, borderRadius:10, marginBottom:18 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:600, color:text }}>Fair rotation</div>
                <div style={{ fontSize:12, color:muted }}>Spread leads evenly (don't overload top companies)</div>
              </div>
              <Toggle on={selected.fair_rotation} onChange={v => updateField('fair_rotation', v)} />
            </div>

            {/* Matching rules */}
            <div style={{ fontSize:11, color:muted, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:8, fontWeight:700 }}>Matching Rules</div>

            {[
              { key:'match_category', icon:'ti-category', label:'Match by category', sub:'Lead category must match company category', locked:true },
              { key:'match_area',     icon:'ti-map-pin',  label:'Match by area',     sub:'Lead area must match company service area' },
              { key:'match_budget',   icon:'ti-coin',     label:'Match by budget',   sub:'Lead budget within company range (needs structured budget — off for now)' },
              { key:'respect_quota',  icon:'ti-gauge',    label:'Respect monthly quota', sub:'Stop sending once plan limit reached' },
            ].map(r => (
              <div key={r.key} style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 14px', border:`1px solid ${border}`, borderRadius:9, marginBottom:7 }}>
                <i className={`ti ${r.icon}`} style={{ fontSize:16, color: selected[r.key] ? accent : muted }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13.5, fontWeight:600, color:text }}>{r.label}</div>
                  <div style={{ fontSize:11.5, color:muted }}>{r.sub}</div>
                </div>
                <Toggle on={selected[r.key]} onChange={v => updateField(r.key, v)} disabled={r.locked} />
              </div>
            ))}

            {/* Quality gates — toggle + optional number */}
            {[
              { onKey:'min_trust_enabled', valKey:'min_trust_value', icon:'ti-shield-check', label:'Minimum trust score', sub:'Only send to companies at or above this trust score', max:100, step:1 },
              { onKey:'min_rating_enabled', valKey:'min_rating_value', icon:'ti-star', label:'Minimum rating', sub:'Only send to companies at or above this star rating', max:5, step:0.5 },
              { onKey:'min_value_enabled', valKey:null, icon:'ti-coin', label:'Minimum job value', sub:'Only send a lead to companies whose minimum job value is at or below the lead budget (each company sets its own minimum)' },
            ].map(r => (
              <div key={r.onKey} style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 14px', border:`1px solid ${border}`, borderRadius:9, marginBottom:7 }}>
                <i className={`ti ${r.icon}`} style={{ fontSize:16, color: selected[r.onKey] ? accent : muted }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13.5, fontWeight:600, color:text }}>{r.label}</div>
                  <div style={{ fontSize:11.5, color:muted }}>{r.sub}</div>
                </div>
                {r.valKey && selected[r.onKey] && (
                  <input type="number" min={0} max={r.max} step={r.step}
                    value={selected[r.valKey] ?? 0}
                    onChange={e => updateField(r.valKey, parseFloat(e.target.value) || 0)}
                    style={{ width:56, padding:'6px', textAlign:'center', fontSize:14, fontWeight:700, color:accent, background:bg, border:`1px solid ${border}`, borderRadius:8, outline:'none' }} />
                )}
                <Toggle on={selected[r.onKey]} onChange={v => updateField(r.onKey, v)} />
              </div>
            ))}

            {/* Ranking */}
            <div style={{ fontSize:11, color:muted, textTransform:'uppercase', letterSpacing:'0.04em', margin:'18px 0 8px', fontWeight:700 }}>Ranking Order (who gets it first)</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:7, marginBottom:4 }}>
              {[
                ...(selected.fair_rotation ? ['Fewest leads first (fair)'] : []),
                'Plan tier','Trust score','Rating',
                ...(selected.min_trust_enabled ? [`Min trust ${selected.min_trust_value||0}`] : []),
                ...(selected.min_rating_enabled ? [`Min rating ${selected.min_rating_value||0}★`] : []),
                ...(selected.min_value_enabled ? ['Min job value'] : []),
              ].map((r,i) => (
                <span key={r} style={{ fontSize:12, padding:'5px 12px', borderRadius:99, background: i===0 && selected.fair_rotation ? '#d1fae5' : '#e0f9ff', color: i===0 && selected.fair_rotation ? '#065f46' : '#0077aa', border:`1px solid ${i===0 && selected.fair_rotation ? '#a7f3d0' : '#b3d9f0'}` }}>{r}</span>
              ))}
            </div>

            {/* small internal note */}
            <div style={{ marginTop:14, fontSize:11.5, color:muted, display:'flex', alignItems:'center', gap:6 }}>
              <i className="ti ti-info-circle" style={{ fontSize:13, color:accent }} />
              Performance-based — full no-guarantee terms shown to companies at plan purchase.
            </div>
          </div>
        )}
      </div>

      {/* ===== Monthly Lead Quota per Plan (super-admin) ===== */}
      <div style={{ marginTop:20 }}>
        <div style={{ fontSize:11, color:muted, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:8, fontWeight:700 }}>Monthly Lead Quota per Plan</div>
        <div style={{ background:card, border:`1px solid ${border}`, borderRadius:12, padding:'16px 18px' }}>
          <p style={{ fontSize:12.5, color:muted, margin:'0 0 14px' }}>
            Max leads each plan receives per calendar month. Resets automatically on the 1st. The engine only enforces this when a template's <b>Respect monthly quota</b> toggle is ON.
          </p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:12 }}>
            {quotas.length === 0 ? (
              <div style={{ fontSize:13, color:muted }}>No plans found in plan_limits.</div>
            ) : quotas.map(q => {
              const pm = planMeta[q.plan] || planMeta.free
              return (
                <div key={q.plan} style={{ border:`1px solid ${border}`, borderRadius:10, padding:'13px 14px', background:bg }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                    <span style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.03em', color:pm.color, background:pm.bg, padding:'3px 10px', borderRadius:99 }}>
                      {q.display_name || q.plan}
                    </span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <input
                      type="number" min={0}
                      value={q.monthly_lead_quota ?? ''}
                      onChange={e => updateQuota(q.plan, e.target.value)}
                      style={{ width:70, padding:'8px', textAlign:'center', fontSize:16, fontWeight:700, color:accent, background:card, border:`1px solid ${border}`, borderRadius:8, outline:'none' }} />
                    <span style={{ fontSize:12, color:muted }}>leads / month</span>
                    <div style={{ flex:1 }} />
                    <button
                      onClick={() => saveQuota(q.plan)}
                      disabled={quotaSaving === q.plan}
                      style={{ fontSize:12, fontWeight:600, color:'#fff', background:accent, border:'none', borderRadius:7, padding:'7px 13px', cursor:'pointer', opacity: quotaSaving===q.plan?0.6:1 }}>
                      {quotaSaving === q.plan ? '...' : 'Save'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Recent distributions */}
      <div style={{ marginTop:20 }}>
        <div style={{ fontSize:11, color:muted, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:8, fontWeight:700 }}>Recent Distributions</div>
        <div style={{ background:card, border:`1px solid ${border}`, borderRadius:12, overflow:'hidden' }}>
          {recentDist.length === 0 ? (
            <div style={{ padding:24, textAlign:'center', color:muted, fontSize:13 }}>No leads distributed yet.</div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:bg }}>
                  <th style={{ textAlign:'left', padding:'10px 14px', color:muted, fontWeight:600, fontSize:11 }}>Lead</th>
                  <th style={{ textAlign:'left', padding:'10px 14px', color:muted, fontWeight:600, fontSize:11 }}>Company</th>
                  <th style={{ textAlign:'center', padding:'10px 14px', color:muted, fontWeight:600, fontSize:11 }}>Rank</th>
                  <th style={{ textAlign:'center', padding:'10px 14px', color:muted, fontWeight:600, fontSize:11 }}>Status</th>
                  <th style={{ textAlign:'right', padding:'10px 14px', color:muted, fontWeight:600, fontSize:11 }}>When</th>
                </tr>
              </thead>
              <tbody>
                {recentDist.map(d => {
                  const sc = statusColors[d.status] || statusColors.assigned
                  return (
                    <tr key={d.id} style={{ borderTop:`1px solid ${border}` }}>
                      <td style={{ padding:'10px 14px', color:text, fontWeight:600 }}>{d.lead_submissions?.name || '—'}</td>
                      <td style={{ padding:'10px 14px', color:text }}>{d.companies?.name || '—'}</td>
                      <td style={{ padding:'10px 14px', textAlign:'center', color:muted }}>#{d.rank}</td>
                      <td style={{ padding:'10px 14px', textAlign:'center' }}>
                        <span style={{ fontSize:10.5, fontWeight:700, background:sc.bg, color:sc.color, padding:'3px 9px', borderRadius:99 }}>{d.status}</span>
                      </td>
                      <td style={{ padding:'10px 14px', textAlign:'right', color:muted, fontSize:11.5 }}>
                        {d.assigned_at ? new Date(d.assigned_at).toLocaleDateString('en-AE', { day:'numeric', month:'short' }) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
