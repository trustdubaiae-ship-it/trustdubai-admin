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

// Launch Plan — which plan the platform-wide free trial unlocks
const LP_TIERS = [
  { key: 'silver',   label: 'Silver' },
  { key: 'gold',     label: 'Gold' },
  { key: 'platinum', label: 'Platinum (recommended)' },
]

export default function SuperAdminSettings({ theme = 'dark' }) {
  const isDark = theme === 'dark'
  const [settings, setSettings] = useState({})
  const [limits, setLimits] = useState({})
  const [socialVals, setSocialVals] = useState({})
  const [savingSocial, setSavingSocial] = useState(false)
  const [policyTerms, setPolicyTerms] = useState([])
  const [savingPolicy, setSavingPolicy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  const [msg, setMsg] = useState('')

  // ── Launch Plan state (platform_settings) ──
  const [lpRowId, setLpRowId]         = useState(null)
  const [lpEnabled, setLpEnabled]     = useState(false)
  const [lpDays, setLpDays]           = useState(30)
  const [lpTier, setLpTier]           = useState('platinum')
  const [lpTrialCount, setLpTrialCount] = useState(0)
  const [lpToggling, setLpToggling]   = useState(false)
  const [lpSaving, setLpSaving]       = useState(false)

  // ── Require login for quote requests (lead gate) ──
  const [reqLogin, setReqLogin]                 = useState(false)
  const [reqLoginToggling, setReqLoginToggling] = useState(false)

  // ── Spin feature (admin lead recruiting tool) ──
  const [spinOn, setSpinOn]               = useState(true)
  const [spinToggling, setSpinToggling]   = useState(false)

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

    const { data: pol } = await supabase
      .from('app_settings').select('value').eq('key', 'trustdubai.policy').maybeSingle()
    setPolicyTerms(pol?.value?.terms || [])

    // Launch Plan — single platform_settings row + live trial count
    const { data: ps } = await supabase
      .from('platform_settings').select('*')
      .order('updated_at', { ascending: false }).limit(1).maybeSingle()
    if (ps) {
      setLpRowId(ps.id)
      setLpEnabled(!!ps.launch_plan_enabled)
      setLpDays(Number(ps.launch_plan_days) || 30)
      setLpTier(ps.launch_plan_tier || 'platinum')
      setReqLogin(ps.require_login_for_quotes === true)
      setSpinOn(ps.spin_enabled !== false)
    }
    const { count: tc } = await supabase
      .from('companies').select('*', { count: 'exact', head: true })
      .gt('trial_expires_at', new Date().toISOString())
    setLpTrialCount(tc || 0)

    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleFeature(key) {
    const current = settings[key]?.enabled === true
    const next = { enabled: !current }
    setSaving(key); setMsg('')
    const { data, error } = await supabase.from('app_settings')
      .update({ value: next, updated_at: new Date().toISOString() })
      .eq('key', key).select()
    setSaving('')
    if (error) { setMsg('Error: ' + error.message); return }
    if (!data || data.length === 0) { setMsg('Save failed — no permission (is_admin check). Key: ' + key); return }
    setSettings(p => ({ ...p, [key]: next }))
    setMsg('Saved ✓'); setTimeout(() => setMsg(''), 1500)
  }

  async function saveLimit(plan, val) {
    const n = parseInt(val, 10)
    if (isNaN(n) || n < 0) return
    setSaving(plan); setMsg('')
    const { data, error } = await supabase.from('plan_limits')
      .update({ staff_limit: n, updated_at: new Date().toISOString() })
      .eq('plan', plan).select()
    setSaving('')
    if (error) { setMsg('Error: ' + error.message); return }
    if (!data || data.length === 0) { setMsg('Save failed — no permission. Plan: ' + plan); return }
    setLimits(p => ({ ...p, [plan]: n }))
    setMsg('Saved ✓'); setTimeout(() => setMsg(''), 1500)
  }

  async function saveSocial() {
    setSavingSocial(true); setMsg('')
    const cleaned = {}
    Object.entries(socialVals).forEach(([k, v]) => { if (v && v.trim()) cleaned[k] = v.trim() })
    const { data, error } = await supabase.from('app_settings')
      .upsert({ key: 'trustdubai.social', value: cleaned, section: 'general', updated_at: new Date().toISOString() }, { onConflict: 'key' })
      .select()
    setSavingSocial(false)
    if (error) { setMsg('Error: ' + error.message); return }
    if (!data || data.length === 0) { setMsg('Save failed — no permission (is_admin check).'); return }
    setMsg('Social links saved ✓'); setTimeout(() => setMsg(''), 1800)
  }

  function updateTerm(i, field, val) {
    setPolicyTerms(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: val } : t))
  }
  function addTerm() { setPolicyTerms(prev => [...prev, { title: '', text: '' }]) }
  function removeTerm(i) {
    if (!confirm('Remove this term?')) return
    setPolicyTerms(prev => prev.filter((_, idx) => idx !== i))
  }
  async function savePolicy() {
    const cleaned = policyTerms
      .map(t => ({ title: (t.title || '').trim(), text: (t.text || '').trim() }))
      .filter(t => t.title || t.text)
    setSavingPolicy(true); setMsg('')
    const value = { version: '1.0', updated_at: new Date().toISOString().slice(0, 10), terms: cleaned }
    const { data, error } = await supabase.from('app_settings')
      .upsert({ key: 'trustdubai.policy', value, section: 'general', updated_at: new Date().toISOString() }, { onConflict: 'key' })
      .select()
    setSavingPolicy(false)
    if (error) { setMsg('Error: ' + error.message); return }
    if (!data || data.length === 0) { setMsg('Save failed — no permission.'); return }
    setPolicyTerms(cleaned)
    setMsg('Policy saved ✓ — updated everywhere'); setTimeout(() => setMsg(''), 2200)
  }

  // ── Launch Plan handlers ──
  async function loadTrialCount() {
    const { count } = await supabase
      .from('companies').select('*', { count: 'exact', head: true })
      .gt('trial_expires_at', new Date().toISOString())
    setLpTrialCount(count || 0)
  }

  async function toggleLaunch() {
    if (!lpRowId || lpToggling) return
    const next = !lpEnabled
    if (!next && !confirm(
      'Turn OFF the Launch Plan?\n\n' +
      'Every company currently on trial reverts to its real plan immediately. ' +
      'Real plans are never changed — you can turn it back ON anytime.'
    )) return
    setLpToggling(true); setMsg('')
    const { data, error } = await supabase.from('platform_settings')
      .update({ launch_plan_enabled: next, updated_at: new Date().toISOString() })
      .eq('id', lpRowId).select()
    setLpToggling(false)
    if (error) { setMsg('Error: ' + error.message); return }
    if (!data || data.length === 0) { setMsg('Save failed — no permission (is_admin check).'); return }
    setLpEnabled(next)
    loadTrialCount()
    setMsg(next ? 'Launch Plan is now ON ✓' : 'Launch Plan is now OFF ✓'); setTimeout(() => setMsg(''), 1800)
  }

  async function saveLaunch() {
    if (!lpRowId || lpSaving) return
    const d = Math.max(1, Math.min(365, parseInt(lpDays, 10) || 30))
    setLpSaving(true); setMsg('')
    const { data, error } = await supabase.from('platform_settings')
      .update({
        launch_plan_enabled: lpEnabled,
        launch_plan_days: d,
        launch_plan_tier: lpTier,
        updated_at: new Date().toISOString(),
      })
      .eq('id', lpRowId).select()
    setLpSaving(false)
    if (error) { setMsg('Error: ' + error.message); return }
    if (!data || data.length === 0) { setMsg('Save failed — no permission.'); return }
    setLpDays(d)
    setMsg('Launch Plan saved ✓'); setTimeout(() => setMsg(''), 1800)
  }

  // ── Require-login toggle ──
  async function toggleRequireLogin() {
    if (!lpRowId || reqLoginToggling) return
    const next = !reqLogin
    setReqLoginToggling(true); setMsg('')
    const { data, error } = await supabase.from('platform_settings')
      .update({ require_login_for_quotes: next, updated_at: new Date().toISOString() })
      .eq('id', lpRowId).select()
    setReqLoginToggling(false)
    if (error) { setMsg('Error: ' + error.message); return }
    if (!data || data.length === 0) { setMsg('Save failed — no permission (is_admin check).'); return }
    setReqLogin(next)
    setMsg(next ? 'Login is now REQUIRED for quotes ✓' : 'Quotes are now open — no login needed ✓'); setTimeout(() => setMsg(''), 2000)
  }

  // ── Spin toggle ──
  async function toggleSpin() {
    if (!lpRowId || spinToggling) return
    const next = !spinOn
    setSpinToggling(true); setMsg('')
    const { data, error } = await supabase.from('platform_settings')
      .update({ spin_enabled: next, updated_at: new Date().toISOString() })
      .eq('id', lpRowId).select()
    setSpinToggling(false)
    if (error) { setMsg('Error: ' + error.message); return }
    if (!data || data.length === 0) { setMsg('Save failed — no permission (is_admin check).'); return }
    setSpinOn(next)
    setMsg(next ? 'Spin tool is now ON ✓' : 'Spin tool is now OFF ✓'); setTimeout(() => setMsg(''), 1800)
  }

  const txt  = isDark ? '#f0fdf4' : '#0f172a'
  const txt2 = isDark ? '#94a3b8' : '#64748b'
  const txt3 = isDark ? '#64748b' : '#94a3b8'
  const cardBg = isDark ? '#161b22' : '#fff'
  const cardBorder = isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0'
  const lineBorder = isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'
  const inputBase = {
    background: isDark ? '#0d1117' : '#f8fafc', color: txt,
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`, outline: 'none', boxSizing: 'border-box',
  }
  const card = { background: cardBg, border: `0.5px solid ${cardBorder}`, borderRadius: 14, padding: 18 }
  const sectionTitle = { fontSize: 12, fontWeight: 700, color: GREEN, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }

  if (loading) return <div style={{ padding: 24, color: txt3 }}>Loading settings…</div>

  return (
    <div style={{ maxWidth: 1100 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: txt, margin: '4px 0 4px' }}>Global Settings</h1>
      <p style={{ fontSize: 13, color: txt2, marginBottom: 20 }}>
        Platform-wide defaults. Per-company overrides are managed inside each company.
      </p>

      {msg && (
        <div style={{ marginBottom: 16, fontSize: 13, fontWeight: 600, color: msg.startsWith('Error') || msg.startsWith('Save failed') ? '#f87171' : GREEN }}>{msg}</div>
      )}

      <style>{`
        .set-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; align-items:start; }
        @media (max-width:860px){ .set-grid{ grid-template-columns:1fr; } }
        .set-policy-grid { display:grid; grid-template-columns:1fr; gap:10px; }
        .lp-row { display:flex; gap:12px; flex-wrap:wrap; }
        .lp-row > div { flex:1 1 150px; min-width:140px; }
      `}</style>

      {/* ───────── LAUNCH PLAN (platform-wide free trial control) ───────── */}
      <div style={{ ...card, marginBottom: 16, border: `0.5px solid ${lpEnabled ? GREEN : cardBorder}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: isDark ? 'rgba(29,158,117,0.18)' : 'rgba(29,158,117,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, flexShrink: 0 }}>🚀</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: txt }}>Launch Plan</div>
              <div style={{ fontSize: 11.5, color: txt3, marginTop: 1 }}>Platform-wide free trial for newly claimed companies</div>
            </div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 11px', borderRadius: 99, whiteSpace: 'nowrap',
            background: lpEnabled ? 'rgba(29,158,117,0.16)' : (isDark ? '#30363d' : '#f1f5f9'),
            color: lpEnabled ? GREEN : txt3 }}>
            {lpEnabled ? '● Active' : '○ Off'}
          </span>
        </div>

        {/* master toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          background: isDark ? '#0d1117' : '#f8fafc', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
          borderRadius: 11, padding: '12px 14px', margin: '14px 0' }}>
          <div style={{ minWidth: 0, paddingRight: 10 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: txt }}>{lpEnabled ? 'Trial is running' : 'Trial is paused'}</div>
            <div style={{ fontSize: 11, color: txt3, marginTop: 2, lineHeight: 1.45 }}>
              {lpEnabled
                ? 'New members who claim their company get full access automatically.'
                : 'Turn ON to grant the trial to newly claimed companies.'}
            </div>
          </div>
          <button onClick={toggleLaunch} disabled={lpToggling || !lpRowId}
            style={{ position: 'relative', width: 52, height: 30, borderRadius: 99, border: 'none', flexShrink: 0,
              cursor: (lpToggling || !lpRowId) ? 'default' : 'pointer',
              background: lpEnabled ? GREEN : (isDark ? '#30363d' : '#cbd5e1'), opacity: lpToggling ? 0.6 : 1, transition: 'background 0.2s' }}>
            <span style={{ position: 'absolute', top: 3, left: lpEnabled ? 25 : 3, width: 24, height: 24, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left 0.2s' }} />
          </button>
        </div>

        {/* days + tier */}
        <div className="lp-row" style={{ marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: txt2, marginBottom: 6 }}>Trial length (days)</div>
            <input type="number" min="1" max="365" value={lpDays}
              onChange={e => setLpDays(e.target.value)}
              style={{ width: '100%', padding: '9px 11px', borderRadius: 8, fontSize: 13, ...inputBase }} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: txt2, marginBottom: 6 }}>Unlocks plan</div>
            <select value={lpTier} onChange={e => setLpTier(e.target.value)}
              style={{ width: '100%', padding: '9px 11px', borderRadius: 8, fontSize: 13, ...inputBase }}>
              {LP_TIERS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
        </div>

        {/* live trial count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: isDark ? 'rgba(29,158,117,0.1)' : 'rgba(29,158,117,0.08)',
          border: `1px solid ${isDark ? 'rgba(29,158,117,0.3)' : 'rgba(29,158,117,0.25)'}`, borderRadius: 9, padding: '10px 13px', marginBottom: 14 }}>
          <span style={{ fontSize: 15 }}>🚀</span>
          <div style={{ fontSize: 12.5, color: txt2 }}>
            <b style={{ color: GREEN }}>{lpTrialCount}</b> {lpTrialCount === 1 ? 'company is' : 'companies are'} on an active trial right now
          </div>
          <button onClick={loadTrialCount}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: GREEN, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
            Refresh
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={saveLaunch} disabled={lpSaving || !lpRowId}
            style={{ padding: '9px 20px', background: GREEN, color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700,
              cursor: (lpSaving || !lpRowId) ? 'not-allowed' : 'pointer', opacity: lpSaving ? 0.6 : 1 }}>
            {lpSaving ? 'Saving…' : 'Save settings'}
          </button>
          <span style={{ fontSize: 11, color: txt3 }}>
            Turning OFF reverts everyone on trial instantly — real plans are never touched.
          </span>
        </div>
      </div>

      {/* ───────── LEAD GATE — require login before quote requests ───────── */}
      <div style={{ ...card, marginBottom: 16, border: `0.5px solid ${reqLogin ? GREEN : cardBorder}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: isDark ? 'rgba(29,158,117,0.18)' : 'rgba(29,158,117,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, flexShrink: 0 }}>🔐</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: txt }}>Login for Quote Requests</div>
              <div style={{ fontSize: 11.5, color: txt3, marginTop: 1 }}>Whether visitors must sign in before requesting quotes</div>
            </div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 11px', borderRadius: 99, whiteSpace: 'nowrap',
            background: reqLogin ? 'rgba(29,158,117,0.16)' : (isDark ? '#30363d' : '#f1f5f9'),
            color: reqLogin ? GREEN : txt3 }}>
            {reqLogin ? '● Login required' : '○ Open (no login)'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          background: isDark ? '#0d1117' : '#f8fafc', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
          borderRadius: 11, padding: '12px 14px', marginTop: 14 }}>
          <div style={{ minWidth: 0, paddingRight: 10 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: txt }}>{reqLogin ? 'Visitors must sign in first' : 'Anyone can request a quote'}</div>
            <div style={{ fontSize: 11, color: txt3, marginTop: 2, lineHeight: 1.45 }}>
              {reqLogin
                ? 'Customers sign in with Google before the quote form opens. Higher-quality leads, but more friction.'
                : 'No sign-in needed — the form opens directly (name, phone, area). Less friction, more leads. Recommended at launch.'}
            </div>
          </div>
          <button onClick={toggleRequireLogin} disabled={reqLoginToggling || !lpRowId}
            style={{ position: 'relative', width: 52, height: 30, borderRadius: 99, border: 'none', flexShrink: 0,
              cursor: (reqLoginToggling || !lpRowId) ? 'default' : 'pointer',
              background: reqLogin ? GREEN : (isDark ? '#30363d' : '#cbd5e1'), opacity: reqLoginToggling ? 0.6 : 1, transition: 'background 0.2s' }}>
            <span style={{ position: 'absolute', top: 3, left: reqLogin ? 25 : 3, width: 24, height: 24, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left 0.2s' }} />
          </button>
        </div>
      </div>

      {/* ───────── SPIN TOOL — admin lead-recruiting feature ───────── */}
      <div style={{ ...card, marginBottom: 16, border: `0.5px solid ${spinOn ? GREEN : cardBorder}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: isDark ? 'rgba(29,158,117,0.18)' : 'rgba(29,158,117,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, flexShrink: 0 }}>🎡</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: txt }}>Spin Tool</div>
              <div style={{ fontSize: 11.5, color: txt3, marginTop: 1 }}>Lead-recruiting tool in Lead Management (find &amp; call companies)</div>
            </div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 11px', borderRadius: 99, whiteSpace: 'nowrap',
            background: spinOn ? 'rgba(29,158,117,0.16)' : (isDark ? '#30363d' : '#f1f5f9'),
            color: spinOn ? GREEN : txt3 }}>
            {spinOn ? '● On' : '○ Off'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          background: isDark ? '#0d1117' : '#f8fafc', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
          borderRadius: 11, padding: '12px 14px', marginTop: 14 }}>
          <div style={{ minWidth: 0, paddingRight: 10 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: txt }}>{spinOn ? 'Spin button is visible on leads' : 'Spin button is hidden'}</div>
            <div style={{ fontSize: 11, color: txt3, marginTop: 2, lineHeight: 1.45 }}>
              {spinOn
                ? 'Admins can spin a lead to find matching companies, call them and mark claimed/declined.'
                : 'The Spin button is removed from Lead Management until you turn this back on.'}
            </div>
          </div>
          <button onClick={toggleSpin} disabled={spinToggling || !lpRowId}
            style={{ position: 'relative', width: 52, height: 30, borderRadius: 99, border: 'none', flexShrink: 0,
              cursor: (spinToggling || !lpRowId) ? 'default' : 'pointer',
              background: spinOn ? GREEN : (isDark ? '#30363d' : '#cbd5e1'), opacity: spinToggling ? 0.6 : 1, transition: 'background 0.2s' }}>
            <span style={{ position: 'absolute', top: 3, left: spinOn ? 25 : 3, width: 24, height: 24, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left 0.2s' }} />
          </button>
        </div>
      </div>

      <div className="set-grid">

        {/* FEATURE TOGGLES */}
        <div style={card}>
          <div style={sectionTitle}>Feature Toggles</div>
          {FEATURES.map((f, i) => {
            const on = settings[f.key]?.enabled === true
            return (
              <div key={f.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '11px 0', borderTop: i > 0 ? `0.5px solid ${lineBorder}` : 'none' }}>
                <div style={{ minWidth: 0, paddingRight: 12 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: txt }}>{f.label}</div>
                  <div style={{ fontSize: 11.5, color: txt3, marginTop: 2 }}>{f.desc}</div>
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
          <div style={{ ...sectionTitle, marginBottom: 6 }}>Plan Staff Limits</div>
          <p style={{ fontSize: 12, color: txt3, marginTop: 0, marginBottom: 14 }}>
            Max staff slots each plan allows in the business portal.
          </p>
          {PLANS.map((p, i) => (
            <div key={p.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '9px 0', borderTop: i > 0 ? `0.5px solid ${lineBorder}` : 'none' }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: txt }}>{p.label}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="number" min="0" defaultValue={limits[p.key] ?? 1}
                  onBlur={(e) => { if (parseInt(e.target.value,10) !== limits[p.key]) saveLimit(p.key, e.target.value) }}
                  disabled={saving === p.key}
                  style={{ width: 64, padding: '7px 10px', borderRadius: 8, fontSize: 13, textAlign: 'center', ...inputBase }} />
                <span style={{ fontSize: 12, color: txt3 }}>staff</span>
              </div>
            </div>
          ))}
          <p style={{ fontSize: 11, color: txt3, marginTop: 12 }}>Tip: change the number and click away to save.</p>
        </div>

        {/* SOCIAL LINKS */}
        <div style={card}>
          <div style={{ ...sectionTitle, marginBottom: 6 }}>Quvera Social Links</div>
          <p style={{ fontSize: 12, color: txt3, marginTop: 0, marginBottom: 14 }}>
            Appear as “Follow Us” icons in the public profile footer. Full URL or handle — both work. Blank = hidden.
          </p>
          {SOCIALS.map((s, i) => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 0', borderTop: i > 0 ? `0.5px solid ${lineBorder}` : 'none' }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, background: isDark ? '#0d1117' : '#f1f5f9', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}` }}>{s.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: txt, marginBottom: 3 }}>{s.label}</div>
                <input
                  value={socialVals[s.key] || ''}
                  onChange={e => setSocialVals(p => ({ ...p, [s.key]: e.target.value }))}
                  placeholder={s.ph}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 8, fontSize: 12.5, ...inputBase }} />
              </div>
            </div>
          ))}
          <button onClick={saveSocial} disabled={savingSocial}
            style={{ marginTop: 14, padding: '9px 20px', background: GREEN, color: '#fff', border: 'none',
              borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: savingSocial ? 'not-allowed' : 'pointer', opacity: savingSocial ? 0.6 : 1 }}>
            {savingSocial ? 'Saving…' : 'Save Social Links'}
          </button>
        </div>

        {/* TERMS & POLICY */}
        <div style={card}>
          <div style={{ ...sectionTitle, marginBottom: 6 }}>Terms & Policy</div>
          <p style={{ fontSize: 12, color: txt3, marginTop: 0, marginBottom: 14 }}>
            Edit once here — updates everywhere (registration, EID upload, business listing).
          </p>

          {policyTerms.length === 0 && (
            <div style={{ fontSize: 13, color: txt3, padding: '10px 0' }}>No terms yet. Click “Add Term”.</div>
          )}

          <div className="set-policy-grid">
            {policyTerms.map((t, i) => (
              <div key={i} style={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`, borderRadius: 11, padding: 12, background: isDark ? '#0d1117' : '#f8fafc' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: GREEN, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                  <input
                    value={t.title || ''}
                    onChange={e => updateTerm(i, 'title', e.target.value)}
                    placeholder="Term title"
                    style={{ flex: 1, padding: '7px 10px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, ...inputBase, background: cardBg }} />
                  <button onClick={() => removeTerm(i)} title="Remove"
                    style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`, background: 'transparent', color: '#f87171', cursor: 'pointer', flexShrink: 0, fontSize: 13 }}>🗑️</button>
                </div>
                <textarea
                  value={t.text || ''}
                  onChange={e => updateTerm(i, 'text', e.target.value)}
                  placeholder="Term text…"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 12, minHeight: 56, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5, ...inputBase, background: cardBg }} />
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            <button onClick={addTerm}
              style={{ padding: '8px 15px', background: 'transparent', color: GREEN, border: `1px solid ${GREEN}`, borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
              + Add Term
            </button>
            <button onClick={savePolicy} disabled={savingPolicy}
              style={{ padding: '8px 20px', background: GREEN, color: '#fff', border: 'none', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: savingPolicy ? 'not-allowed' : 'pointer', opacity: savingPolicy ? 0.6 : 1 }}>
              {savingPolicy ? 'Saving…' : 'Save Policy'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
