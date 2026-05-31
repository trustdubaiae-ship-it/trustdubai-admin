// trustdubai-admin/src/pages/SuperAdminSettings.jsx
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabase'

const GREEN = '#1d9e75'

const FEATURES = [
  { key: 'feature.ai_analysis',     label: 'AI Analysis on Reviews', desc: 'Show AI analysis under each review comment' },
  { key: 'feature.google_reviews',  label: 'Google Reviews Strip',   desc: 'Master switch for Google reviews on public profiles' },
  { key: 'feature.ai_insights',     label: 'AI Insights',            desc: 'AI insights card on business dashboard' },
  { key: 'feature.profile_insights',label: 'Profile Insights',       desc: 'Business profile insights card (visitors, ranks)' },
]

const PLANS = [
  { key: 'free',     label: 'Free' },
  { key: 'silver',   label: 'Silver' },
  { key: 'gold',     label: 'Gold' },
  { key: 'platinum', label: 'Platinum' },
]

const SOCIALS = [
  { key: 'instagram', label: 'Instagram', icon: '📸', ph: 'jaguar_interior  or  https://instagram.com/...' },
  { key: 'facebook',  label: 'Facebook',  icon: '👍', ph: 'pagename  or  https://facebook.com/...' },
  { key: 'linkedin',  label: 'LinkedIn',  icon: '💼', ph: 'company-name  or  https://linkedin.com/company/...' },
  { key: 'twitter',   label: 'Twitter / X', icon: '🐦', ph: 'handle  or  https://twitter.com/...' },
  { key: 'youtube',   label: 'YouTube',   icon: '▶️', ph: '@channel  or  https://youtube.com/...' },
]

export default function SuperAdminSettings({ theme = 'dark' }) {
  const isDark = theme === 'dark'
  const [settings, setSettings] = useState({})
  const [limits, setLimits] = useState({})
  const [socialVals, setSocialVals] = useState({})
  const [savingSocial, setSavingSocial] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data: s } = await supabase
      .from('app_settings').select('key, value').eq('section', 'features')
    const map = {}
    ;(s || []).forEach(r => { map[r.key] = r.value })
    setSettings(map)

    const { data: pl } = await supabase
      .from('plan_limits').select('plan, staff_limit')
    const lm = {}
    ;(pl || []).forEach(r => { lm[r.plan] = r.staff_limit })
    setLimits(lm)

    const { data: soc } = await supabase
      .from('app_settings').select('value').eq('key', 'trustdubai.social').maybeSingle()
    setSocialVals(soc?.value || {})

    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleFeature(key) {
    const current = settings[key]?.enabled === true
    const next = { enabled: !current }
    setSaving(key); setMsg('')

    const { data, error } = await supabase.from('app_settings')
      .update({ value: next, updated_at: new Date().toISOString() })
      .eq('key', key)
      .select()

    setSaving('')

    if (error) { setMsg('Error: ' + error.message); return }
    if (!data || data.length === 0) {
      setMsg('Save failed — no permission to update settings (is_admin check). Key: ' + key)
      return
    }
    setSettings(p => ({ ...p, [key]: next }))
    setMsg('Saved ✓')
    setTimeout(() => setMsg(''), 1500)
  }

  async function saveLimit(plan, val) {
    const n = parseInt(val, 10)
    if (isNaN(n) || n < 0) return
    setSaving(plan); setMsg('')
    const { data, error } = await supabase.from('plan_limits')
      .update({ staff_limit: n, updated_at: new Date().toISOString() })
      .eq('plan', plan)
      .select()
    setSaving('')
    if (error) { setMsg('Error: ' + error.message); return }
    if (!data || data.length === 0) { setMsg('Save failed — no permission. Plan: ' + plan); return }
    setLimits(p => ({ ...p, [plan]: n }))
    setMsg('Saved ✓')
    setTimeout(() => setMsg(''), 1500)
  }

  async function saveSocial() {
    setSavingSocial(true); setMsg('')
    // clean empty values
    const cleaned = {}
    Object.entries(socialVals).forEach(([k, v]) => { if (v && v.trim()) cleaned[k] = v.trim() })

    // upsert into app_settings (key may or may not exist yet)
    const { data, error } = await supabase.from('app_settings')
      .upsert({ key: 'trustdubai.social', value: cleaned, section: 'general', updated_at: new Date().toISOString() }, { onConflict: 'key' })
      .select()

    setSavingSocial(false)
    if (error) { setMsg('Error: ' + error.message); return }
    if (!data || data.length === 0) { setMsg('Save failed — no permission (is_admin check).'); return }
    setMsg('Social links saved ✓')
    setTimeout(() => setMsg(''), 1800)
  }

  const card = {
    background: isDark ? '#161b22' : '#fff',
    border: `0.5px solid ${isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`,
    borderRadius: 14, padding: 20, marginBottom: 20,
  }
  const txt  = isDark ? '#f0fdf4' : '#0f172a'
  const txt2 = isDark ? '#94a3b8' : '#64748b'
  const txt3 = isDark ? '#64748b' : '#94a3b8'

  if (loading) return <div style={{ padding: 24, color: txt3 }}>Loading settings…</div>

  return (
    <div style={{ maxWidth: 760 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: txt, margin: '4px 0 4px' }}>Global Settings</h1>
      <p style={{ fontSize: 13, color: txt2, marginBottom: 24 }}>
        Platform-wide defaults. Per-company overrides are managed inside each company.
      </p>

      {msg && (
        <div style={{ marginBottom: 16, fontSize: 13, fontWeight: 600, color: msg.startsWith('Error') || msg.startsWith('Save failed') ? '#f87171' : GREEN }}>{msg}</div>
      )}

      {/* FEATURE TOGGLES */}
      <div style={card}>
        <div style={{ fontSize: 12, fontWeight: 700, color: GREEN, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
          Feature Toggles
        </div>
        {FEATURES.map((f, i) => {
          const on = settings[f.key]?.enabled === true
          return (
            <div key={f.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 0', borderTop: i > 0 ? `0.5px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'}` : 'none' }}>
              <div style={{ minWidth: 0, paddingRight: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: txt }}>{f.label}</div>
                <div style={{ fontSize: 12, color: txt3, marginTop: 2 }}>{f.desc}</div>
              </div>
              <button onClick={() => toggleFeature(f.key)} disabled={saving === f.key}
                style={{ width: 46, height: 26, borderRadius: 99, border: 'none', cursor: 'pointer', flexShrink: 0,
                  background: on ? GREEN : (isDark ? '#30363d' : '#cbd5e1'), position: 'relative', transition: 'background 0.2s', opacity: saving === f.key ? 0.6 : 1 }}>
                <span style={{ position: 'absolute', top: 3, left: on ? 23 : 3, width: 20, height: 20, borderRadius: '50%',
                  background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
              </button>
            </div>
          )
        })}
      </div>

      {/* PLAN LIMITS */}
      <div style={card}>
        <div style={{ fontSize: 12, fontWeight: 700, color: GREEN, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
          Plan Staff Limits
        </div>
        <p style={{ fontSize: 12, color: txt3, marginTop: 0, marginBottom: 16 }}>
          Max staff slots each plan allows in the business portal.
        </p>
        {PLANS.map((p, i) => (
          <div key={p.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 0', borderTop: i > 0 ? `0.5px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'}` : 'none' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: txt }}>{p.label}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="number" min="0" defaultValue={limits[p.key] ?? 1}
                onBlur={(e) => { if (parseInt(e.target.value,10) !== limits[p.key]) saveLimit(p.key, e.target.value) }}
                disabled={saving === p.key}
                style={{ width: 70, padding: '7px 10px', borderRadius: 8, fontSize: 13, textAlign: 'center',
                  background: isDark ? '#0d1117' : '#f8fafc', color: txt,
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`, outline: 'none' }} />
              <span style={{ fontSize: 12, color: txt3 }}>staff</span>
            </div>
          </div>
        ))}
        <p style={{ fontSize: 11, color: txt3, marginTop: 12 }}>
          Tip: change the number and click away to save.
        </p>
      </div>

      {/* TRUSTDUBAI SOCIAL LINKS */}
      <div style={card}>
        <div style={{ fontSize: 12, fontWeight: 700, color: GREEN, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
          TrustDubai Social Links
        </div>
        <p style={{ fontSize: 12, color: txt3, marginTop: 0, marginBottom: 16 }}>
          These appear as the “Follow Us” icons in the public profile footer. Paste a full URL or just the handle/username — both work. Leave blank to hide that icon.
        </p>
        {SOCIALS.map((s, i) => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 0', borderTop: i > 0 ? `0.5px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'}` : 'none' }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, background: isDark ? '#0d1117' : '#f1f5f9', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}` }}>{s.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: txt, marginBottom: 4 }}>{s.label}</div>
              <input
                value={socialVals[s.key] || ''}
                onChange={e => setSocialVals(p => ({ ...p, [s.key]: e.target.value }))}
                placeholder={s.ph}
                style={{ width: '100%', padding: '8px 11px', borderRadius: 8, fontSize: 13,
                  background: isDark ? '#0d1117' : '#f8fafc', color: txt,
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>
        ))}
        <button onClick={saveSocial} disabled={savingSocial}
          style={{ marginTop: 16, padding: '10px 22px', background: GREEN, color: '#fff', border: 'none',
            borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: savingSocial ? 'not-allowed' : 'pointer', opacity: savingSocial ? 0.6 : 1 }}>
          {savingSocial ? 'Saving…' : 'Save Social Links'}
        </button>
      </div>
    </div>
  )
}
