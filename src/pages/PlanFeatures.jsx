import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const PLANS = ['free', 'silver', 'gold', 'platinum']
const PLAN_LABEL = { free:'Free', silver:'Silver', gold:'Gold', platinum:'Platinum' }
const PLAN_COLOR = { free:'#6b7280', silver:'#64748b', gold:'#d97706', platinum:'#8b5cf6' }

export default function PlanFeatures() {
  const [features, setFeatures]   = useState([])
  const [matrix, setMatrix]       = useState({})   // matrix[feature_key][plan] = {enabled, limit_value}
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [dirty, setDirty]         = useState(false)
  const [savedMsg, setSavedMsg]   = useState('')
  const [showAdd, setShowAdd]     = useState(false)
  const [newFeat, setNewFeat]     = useState({ feature_key:'', name:'', type:'toggle', category:'general' })

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: feats } = await supabase.from('features').select('*').eq('is_active', true).order('sort_order')
    const { data: pf }    = await supabase.from('plan_features').select('*')
    const m = {}
    ;(feats || []).forEach(f => {
      m[f.feature_key] = {}
      PLANS.forEach(p => { m[f.feature_key][p] = { enabled:false, limit_value:0 } })
    })
    ;(pf || []).forEach(row => {
      if (m[row.feature_key]) m[row.feature_key][row.plan_name] = { enabled: row.enabled, limit_value: row.limit_value }
    })
    setFeatures(feats || [])
    setMatrix(m)
    setLoading(false)
    setDirty(false)
  }

  function toggleCell(fkey, plan) {
    setMatrix(prev => ({ ...prev, [fkey]: { ...prev[fkey], [plan]: { ...prev[fkey][plan], enabled: !prev[fkey][plan].enabled } } }))
    setDirty(true)
  }

  function setLimit(fkey, plan, val) {
    const n = parseInt(val) || 0
    setMatrix(prev => ({ ...prev, [fkey]: { ...prev[fkey], [plan]: { enabled:true, limit_value: n } } }))
    setDirty(true)
  }

  async function saveAll() {
    setSaving(true)
    const rows = []
    features.forEach(f => {
      PLANS.forEach(p => {
        const cell = matrix[f.feature_key][p]
        rows.push({
          plan_name: p,
          feature_key: f.feature_key,
          enabled: f.type === 'limit' ? (cell.limit_value > 0) : cell.enabled,
          limit_value: f.type === 'limit' ? cell.limit_value : 0,
        })
      })
    })
    const { error } = await supabase.from('plan_features').upsert(rows, { onConflict: 'plan_name,feature_key' })
    setSaving(false)
    if (error) { alert('Save failed: ' + error.message); return }
    setDirty(false)
    setSavedMsg('✓ All changes saved')
    setTimeout(() => setSavedMsg(''), 2500)
  }

  async function addFeature() {
    const key = newFeat.feature_key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
    if (!key || !newFeat.name.trim()) { alert('Enter key and name'); return }
    const maxSort = features.reduce((m, f) => Math.max(m, f.sort_order || 0), 0)
    const { error } = await supabase.from('features').insert({
      feature_key: key, name: newFeat.name.trim(), type: newFeat.type,
      category: newFeat.category || 'general', sort_order: maxSort + 1, is_active: true,
    })
    if (error) { alert('Add failed: ' + error.message); return }
    // seed plan_features rows for all plans (off by default)
    const seed = PLANS.map(p => ({ plan_name:p, feature_key:key, enabled:false, limit_value:0 }))
    await supabase.from('plan_features').upsert(seed, { onConflict: 'plan_name,feature_key' })
    setShowAdd(false)
    setNewFeat({ feature_key:'', name:'', type:'toggle', category:'general' })
    load()
  }

  async function deleteFeature(fkey) {
    if (!confirm('Delete this feature from all plans? This cannot be undone.')) return
    await supabase.from('plan_features').delete().eq('feature_key', fkey)
    await supabase.from('features').delete().eq('feature_key', fkey)
    load()
  }

  const text    = isDark ? '#f1f5f9' : '#111827'
  const textSub = isDark ? '#94a3b8' : '#6b7280'
  const cardBg  = isDark ? '#161b22' : '#ffffff'
  const border  = isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'
  const rowAlt  = isDark ? 'rgba(255,255,255,0.02)' : '#f9fafb'

  if (loading) return (
    <div style={{ textAlign:'center', padding:60, color:textSub }}>
      <div style={{ width:36, height:36, border:'3px solid #4ade80', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 12px' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      Loading feature matrix...
    </div>
  )

  return (
    <div style={{ maxWidth:1000 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:text, marginBottom:4 }}>Plan Features</h1>
          <p style={{ color:textSub, fontSize:14 }}>Tick what each plan includes. Changes apply everywhere automatically.</p>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {savedMsg && <span style={{ fontSize:13, color:'#10b981', fontWeight:600 }}>{savedMsg}</span>}
          <button onClick={() => setShowAdd(true)}
            style={{ padding:'8px 14px', borderRadius:8, border:`1px solid ${border}`, background:cardBg, color:text, fontSize:13, fontWeight:600, cursor:'pointer' }}>
            + Add Feature
          </button>
          <button onClick={saveAll} disabled={!dirty || saving}
            style={{ padding:'8px 18px', borderRadius:8, border:'none', background: dirty ? '#10b981' : (isDark?'rgba(255,255,255,0.1)':'#d1d5db'), color: dirty ? '#fff' : textSub, fontSize:13, fontWeight:700, cursor: dirty ? 'pointer' : 'default' }}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Matrix table */}
      <div style={{ background:cardBg, border:`1px solid ${border}`, borderRadius:14, overflow:'hidden', overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, minWidth:640 }}>
          <thead>
            <tr style={{ background:rowAlt }}>
              <th style={{ textAlign:'left', padding:'12px 16px', color:textSub, fontWeight:600, borderBottom:`1px solid ${border}` }}>Feature</th>
              {PLANS.map(p => (
                <th key={p} style={{ textAlign:'center', padding:'12px 10px', borderBottom:`1px solid ${border}`, minWidth:90 }}>
                  <span style={{ color:PLAN_COLOR[p], fontWeight:700, fontSize:13 }}>{PLAN_LABEL[p]}</span>
                </th>
              ))}
              <th style={{ width:40, borderBottom:`1px solid ${border}` }}></th>
            </tr>
          </thead>
          <tbody>
            {features.map((f, i) => (
              <tr key={f.feature_key} style={{ background: i%2 ? rowAlt : 'transparent' }}>
                <td style={{ padding:'10px 16px', borderBottom:`1px solid ${border}` }}>
                  <div style={{ fontWeight:600, color:text }}>{f.name}</div>
                  <div style={{ fontSize:10.5, color:textSub, marginTop:1 }}>
                    {f.type === 'limit' ? '🔢 Number limit' : '✓ On / Off'} · <code style={{ fontSize:10 }}>{f.feature_key}</code>
                  </div>
                </td>
                {PLANS.map(p => {
                  const cell = matrix[f.feature_key]?.[p] || { enabled:false, limit_value:0 }
                  return (
                    <td key={p} style={{ textAlign:'center', padding:'8px 10px', borderBottom:`1px solid ${border}` }}>
                      {f.type === 'limit' ? (
                        <input type="number" min="0" value={cell.limit_value}
                          onChange={e => setLimit(f.feature_key, p, e.target.value)}
                          style={{ width:60, padding:'5px 6px', textAlign:'center', borderRadius:6, border:`1px solid ${border}`, background: isDark?'rgba(255,255,255,0.05)':'#fff', color:text, fontSize:13, outline:'none' }} />
                      ) : (
                        <button onClick={() => toggleCell(f.feature_key, p)}
                          style={{ width:28, height:28, borderRadius:7, border:'none', cursor:'pointer', fontSize:14, fontWeight:700,
                            background: cell.enabled ? '#10b981' : (isDark?'rgba(255,255,255,0.07)':'#e5e7eb'),
                            color: cell.enabled ? '#fff' : textSub }}>
                          {cell.enabled ? '✓' : '–'}
                        </button>
                      )}
                    </td>
                  )
                })}
                <td style={{ textAlign:'center', borderBottom:`1px solid ${border}` }}>
                  <button onClick={() => deleteFeature(f.feature_key)} title="Delete feature"
                    style={{ background:'none', border:'none', cursor:'pointer', color:'#ef4444', fontSize:14 }}>
                    <i className="ti ti-trash"/>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize:12, color:textSub, marginTop:12 }}>
        Tip: For limits (Portfolio Photos, Team Members) enter a number — 0 means disabled. Use 999 for "unlimited".
      </p>

      {/* Add Feature modal */}
      {showAdd && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 }}>
          <div style={{ background:cardBg, borderRadius:14, width:'100%', maxWidth:440, padding:24, border:`1px solid ${border}` }}>
            <h3 style={{ fontSize:17, fontWeight:700, color:text, marginBottom:16 }}>Add New Feature</h3>

            <label style={{ fontSize:12, color:textSub, fontWeight:600, display:'block', marginBottom:5 }}>Feature Name *</label>
            <input value={newFeat.name} onChange={e => setNewFeat(s => ({ ...s, name:e.target.value }))} placeholder="e.g. CRM Access"
              style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:`1px solid ${border}`, background:isDark?'rgba(255,255,255,0.05)':'#fff', color:text, fontSize:13, marginBottom:14, boxSizing:'border-box', outline:'none' }} />

            <label style={{ fontSize:12, color:textSub, fontWeight:600, display:'block', marginBottom:5 }}>Feature Key (code) *</label>
            <input value={newFeat.feature_key} onChange={e => setNewFeat(s => ({ ...s, feature_key:e.target.value }))} placeholder="e.g. crm_access"
              style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:`1px solid ${border}`, background:isDark?'rgba(255,255,255,0.05)':'#fff', color:text, fontSize:13, marginBottom:4, boxSizing:'border-box', outline:'none', fontFamily:'monospace' }} />
            <div style={{ fontSize:11, color:textSub, marginBottom:14 }}>lowercase, no spaces (use _). Used in code.</div>

            <label style={{ fontSize:12, color:textSub, fontWeight:600, display:'block', marginBottom:5 }}>Type</label>
            <select value={newFeat.type} onChange={e => setNewFeat(s => ({ ...s, type:e.target.value }))}
              style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:`1px solid ${border}`, background:isDark?'rgba(255,255,255,0.05)':'#fff', color:text, fontSize:13, marginBottom:20, boxSizing:'border-box', outline:'none' }}>
              <option value="toggle">Toggle (On / Off)</option>
              <option value="limit">Limit (Number)</option>
            </select>

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={addFeature}
                style={{ flex:1, padding:'10px', borderRadius:8, border:'none', background:'#10b981', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                Add Feature
              </button>
              <button onClick={() => setShowAdd(false)}
                style={{ flex:1, padding:'10px', borderRadius:8, border:`1px solid ${border}`, background:'transparent', color:text, fontWeight:600, fontSize:13, cursor:'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
