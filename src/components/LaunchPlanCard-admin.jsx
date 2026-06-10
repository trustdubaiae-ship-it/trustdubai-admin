import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

/*
  LaunchPlanCard
  -----------------------------------------------------------------------------
  One place to control the platform-wide Launch Plan (30-day free trial).
  Reads & writes the single `platform_settings` row:
      launch_plan_enabled (bool)  -> master ON / OFF
      launch_plan_days    (int)   -> trial length in days
      launch_plan_tier    (text)  -> which plan the trial unlocks (default platinum)

  Turning it OFF reverts every company currently on trial back to its REAL plan
  instantly (auth.jsx reads this switch live). The real `companies.plan` value is
  never touched, so this is always safe to toggle.

  Drop it anywhere in the admin app:
      import LaunchPlanCard from '../components/LaunchPlanCard'
      ...
      <LaunchPlanCard />
*/

const TIERS = [
  { value: 'silver',   label: 'Silver' },
  { value: 'gold',     label: 'Gold' },
  { value: 'platinum', label: 'Platinum (recommended)' },
]

export default function LaunchPlanCard() {
  const [rowId,      setRowId]      = useState(null)
  const [enabled,    setEnabled]    = useState(false)
  const [days,       setDays]       = useState(30)
  const [tier,       setTier]       = useState('platinum')
  const [trialCount, setTrialCount] = useState(0)

  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [toggling,   setToggling]   = useState(false)
  const [error,      setError]      = useState('')
  const [savedMsg,   setSavedMsg]   = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError('')
    try {
      // single settings row — fetch whatever exists (id may not be 1)
      const { data: row, error: e1 } = await supabase
        .from('platform_settings')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (e1) throw e1
      if (row) {
        setRowId(row.id)
        setEnabled(!!row.launch_plan_enabled)
        setDays(Number(row.launch_plan_days) || 30)
        setTier(row.launch_plan_tier || 'platinum')
      } else {
        setError('No platform_settings row found. Create one in Supabase first.')
      }
      await loadTrialCount()
    } catch (e) {
      console.error(e)
      setError('Could not load settings. Check console.')
    } finally {
      setLoading(false)
    }
  }

  async function loadTrialCount() {
    try {
      const { count } = await supabase
        .from('companies')
        .select('*', { count: 'exact', head: true })
        .gt('trial_expires_at', new Date().toISOString())
      setTrialCount(count || 0)
    } catch (e) { console.error(e) }
  }

  function flash(msg) {
    setSavedMsg(msg)
    setTimeout(() => setSavedMsg(''), 2500)
  }

  // Master ON/OFF — saves immediately. Confirm before turning OFF.
  async function toggleEnabled() {
    if (!rowId || toggling) return
    const next = !enabled
    if (!next) {
      const ok = window.confirm(
        'Turn OFF the Launch Plan?\n\n' +
        'Every company currently on trial will revert to its real plan immediately. ' +
        'Their actual plan is not changed — you can turn this back ON anytime.'
      )
      if (!ok) return
    }
    setToggling(true)
    setError('')
    try {
      const { error: e } = await supabase
        .from('platform_settings')
        .update({ launch_plan_enabled: next, updated_at: new Date().toISOString() })
        .eq('id', rowId)
      if (e) throw e
      setEnabled(next)
      flash(next ? 'Launch Plan is now ON' : 'Launch Plan is now OFF')
      await loadTrialCount()
    } catch (e) {
      console.error(e)
      setError('Could not update. Try again.')
    } finally {
      setToggling(false)
    }
  }

  // Save days + tier (also re-writes enabled so nothing drifts)
  async function saveSettings() {
    if (!rowId || saving) return
    const d = Math.max(1, Math.min(365, Number(days) || 30))
    setSaving(true)
    setError('')
    try {
      const { error: e } = await supabase
        .from('platform_settings')
        .update({
          launch_plan_enabled: enabled,
          launch_plan_days: d,
          launch_plan_tier: tier,
          updated_at: new Date().toISOString(),
        })
        .eq('id', rowId)
      if (e) throw e
      setDays(d)
      flash('Settings saved')
    } catch (e) {
      console.error(e)
      setError('Could not save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  // ---- styles (theme-aware via CSS vars, with light fallbacks) ----
  const card = {
    background: 'var(--bg-card, #ffffff)',
    border: '0.5px solid var(--border-default, #e5e7eb)',
    borderRadius: 14,
    padding: 18,
    maxWidth: 560,
    width: '100%',
    boxSizing: 'border-box',
  }
  const label = { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #475569)', marginBottom: 6, display: 'block' }
  const input = {
    width: '100%', padding: '10px 12px', background: 'var(--bg-secondary, #f8fafc)',
    border: '0.5px solid var(--border-default, #e5e7eb)', borderRadius: 9,
    fontSize: 14, color: 'var(--text-primary, #0f172a)', outline: 'none', boxSizing: 'border-box',
  }

  if (loading) {
    return (
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted, #94a3b8)', fontSize: 13 }}>
          <div style={{ width: 18, height: 18, border: '2px solid #0099cc', borderTopColor: 'transparent', borderRadius: '50%', animation: 'lpspin 0.8s linear infinite' }} />
          <style>{`@keyframes lpspin{to{transform:rotate(360deg)}}`}</style>
          Loading Launch Plan…
        </div>
      </div>
    )
  }

  return (
    <div style={card}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 4, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(0,153,204,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, flexShrink: 0 }}>🚀</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>Launch Plan</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted, #94a3b8)' }}>Platform-wide free trial for new members</div>
          </div>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '4px 11px', borderRadius: 99, whiteSpace: 'nowrap',
          background: enabled ? 'rgba(16,185,129,0.14)' : 'rgba(148,163,184,0.16)',
          color: enabled ? '#059669' : 'var(--text-muted, #94a3b8)',
        }}>
          {enabled ? '● Active' : '○ Off'}
        </span>
      </div>

      {/* Master toggle */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        background: 'var(--bg-secondary, #f8fafc)', border: '0.5px solid var(--border-default, #e5e7eb)',
        borderRadius: 11, padding: '12px 14px', margin: '14px 0',
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
            {enabled ? 'Trial is running' : 'Trial is paused'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)', marginTop: 2, lineHeight: 1.45 }}>
            {enabled
              ? 'New members who claim get full access automatically.'
              : 'Turning ON grants the trial to newly claimed companies.'}
          </div>
        </div>
        <button
          onClick={toggleEnabled}
          disabled={toggling || !rowId}
          aria-label="Toggle Launch Plan"
          style={{
            position: 'relative', width: 52, height: 30, borderRadius: 99, border: 'none', flexShrink: 0,
            cursor: (toggling || !rowId) ? 'default' : 'pointer',
            background: enabled ? '#10b981' : 'var(--border-default, #cbd5e1)',
            opacity: toggling ? 0.6 : 1, transition: 'background 0.2s',
          }}>
          <span style={{
            position: 'absolute', top: 3, left: enabled ? 25 : 3, width: 24, height: 24, borderRadius: '50%',
            background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left 0.2s',
          }} />
        </button>
      </div>

      {/* Settings */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
        <div>
          <label style={label}>Trial length (days)</label>
          <input
            type="number" min={1} max={365} value={days}
            onChange={e => setDays(e.target.value)}
            style={input}
          />
        </div>
        <div>
          <label style={label}>Unlocks plan</label>
          <select value={tier} onChange={e => setTier(e.target.value)} style={input}>
            {TIERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>

      {/* Live trial count */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 9, background: 'rgba(0,153,204,0.08)',
        border: '0.5px solid rgba(0,153,204,0.25)', borderRadius: 9, padding: '10px 13px', marginBottom: 14,
      }}>
        <i className="ti ti-rocket" style={{ fontSize: 16, color: '#0099cc' }} />
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary, #475569)' }}>
          <b style={{ color: '#0099cc' }}>{trialCount}</b> {trialCount === 1 ? 'company is' : 'companies are'} on an active trial right now
        </div>
        <button onClick={loadTrialCount}
          style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#0099cc', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
          <i className="ti ti-refresh" style={{ fontSize: 13 }} /> Refresh
        </button>
      </div>

      {error && <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 10 }}>{error}</div>}

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={saveSettings} disabled={saving || !rowId}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '10px 18px', background: '#0099cc', color: '#fff', border: 'none',
            borderRadius: 9, fontSize: 13.5, fontWeight: 700, cursor: (saving || !rowId) ? 'default' : 'pointer', opacity: saving ? 0.7 : 1,
          }}>
          {saving
            ? <><div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'lpspin 0.8s linear infinite' }} /><style>{`@keyframes lpspin{to{transform:rotate(360deg)}}`}</style> Saving…</>
            : <><i className="ti ti-device-floppy" style={{ fontSize: 15 }} /> Save settings</>}
        </button>
        {savedMsg && (
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#059669', display: 'flex', alignItems: 'center', gap: 5 }}>
            <i className="ti ti-check" style={{ fontSize: 14 }} /> {savedMsg}
          </span>
        )}
      </div>

      <div style={{ fontSize: 10.5, color: 'var(--text-muted, #94a3b8)', marginTop: 14, lineHeight: 1.55, borderTop: '0.5px solid var(--border-default, #e5e7eb)', paddingTop: 12 }}>
        Turning OFF instantly reverts everyone on trial to their real plan — actual plans are never changed,
        so you can switch it back ON anytime. Trials also expire and revert on their own automatically.
      </div>
    </div>
  )
}
