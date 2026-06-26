import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { marginalCommission } from '../lib/commission'

// Partner Program settings — global progressive (marginal) commission slabs by
// referral count, plus payout rules. Commission is marginal like tax brackets:
// referrals 1-25 earn the 1-25 rate, 26-50 earn the 26-50 rate, and so on.
export default function PartnerProgram({ theme }) {
  const dark = theme !== 'light'
  const [slabs, setSlabs] = useState([])
  const [settings, setSettings] = useState({ min_payout: 100, claims_per_month: 2, plan_price: 799, plan_discount_pct: 0 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [sample, setSample] = useState(30)

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const [cRes, sRes] = await Promise.all([
      supabase.from('qv_commission_tiers').select('*').order('sort', { ascending: true }),
      supabase.from('qv_settings').select('*'),
    ])
    setSlabs((cRes.data || []).map(r => ({ min_referrals: r.min_referrals, max_referrals: r.max_referrals, commission_pct: r.commission_pct })))
    if (sRes.data) { const m = {}; sRes.data.forEach(r => { m[r.key] = Number(r.value) }); setSettings(s => ({ ...s, ...m })) }
    setLoading(false)
  }

  function updateSlab(i, field, val) {
    setSlabs(prev => prev.map((s, j) => j === i ? { ...s, [field]: val === '' ? (field === 'max_referrals' ? null : '') : Number(val) } : s)); setMsg('')
  }
  function addSlab() {
    setSlabs(prev => {
      const last = prev[prev.length - 1]
      const start = last ? (last.max_referrals != null ? Number(last.max_referrals) + 1 : Number(last.min_referrals) + 1) : 1
      return [...prev, { min_referrals: start, max_referrals: null, commission_pct: 0 }]
    }); setMsg('')
  }
  function removeSlab(i) { setSlabs(prev => prev.filter((_, j) => j !== i)); setMsg('') }

  async function saveSlabs() {
    // light validation
    const clean = slabs.map(s => ({ min_referrals: Number(s.min_referrals) || 0, max_referrals: s.max_referrals == null || s.max_referrals === '' ? null : Number(s.max_referrals), commission_pct: Number(s.commission_pct) || 0 }))
    for (let i = 0; i < clean.length; i++) {
      const s = clean[i]
      if (s.max_referrals != null && s.max_referrals < s.min_referrals) { setMsg('⚠ A slab\'s "to" cannot be less than its "from" (row ' + (i + 1) + ').'); return }
      if (i > 0) { const prev = clean[i - 1]; if (prev.max_referrals == null) { setMsg('⚠ Only the LAST slab can be unlimited (leave "to" blank).'); return } }
    }
    setSaving(true); setMsg('')
    try {
      // replace all rows
      await supabase.from('qv_commission_tiers').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      const rows = clean.map((s, i) => ({ ...s, sort: i }))
      if (rows.length) { const { error } = await supabase.from('qv_commission_tiers').insert(rows); if (error) throw error }
      setMsg('Saved ✓'); await load()
    } catch (e) { setMsg('Could not save: ' + (e?.message || e)) } finally { setSaving(false) }
  }
  async function saveSetting(key, value) {
    const v = Number(value); if (!Number.isFinite(v)) return
    await supabase.from('qv_settings').upsert({ key, value: v }, { onConflict: 'key' })
    setSettings(s => ({ ...s, [key]: v }))
  }

  const bg = dark ? '#0f172a' : '#f8fafc'
  const cardBg = dark ? '#1e293b' : '#fff'
  const text = dark ? '#e2e8f0' : '#0f172a'
  const sub = dark ? '#94a3b8' : '#64748b'
  const border = dark ? '#334155' : '#e2e8f0'
  const inp = { padding: '7px 9px', borderRadius: 7, border: `1px solid ${border}`, background: dark ? '#0f172a' : '#fff', color: text, fontSize: 13 }

  const calc = marginalCommission(sample, slabs)

  return (
    <div style={{ padding: 'clamp(14px,3vw,28px)', background: bg, minHeight: '100vh', color: text }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}><i className="ti ti-adjustments-dollar" /> Partner Program</h1>
        <div style={{ fontSize: 13, color: sub, marginTop: 2 }}>Commission slabs &amp; payout rules — set manually</div>
      </div>

      {loading ? <div style={{ color: sub, padding: 20 }}>Loading…</div> : (
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))' }}>

          {/* Partner plan price (single plan) */}
          {(() => {
            const orig = Number(settings.plan_price) || 0
            const disc = Number(settings.plan_discount_pct) || 0
            const eff = Math.round(orig * (1 - disc / 100) * 100) / 100
            return (
              <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 12, padding: 16, gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Partner plan price</div>
                <div style={{ fontSize: 12, color: sub, marginBottom: 14, lineHeight: 1.5 }}>One plan for every partner. Set the original price and a discount — partners are charged the discounted amount monthly (+ 5% VAT).</div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <label style={{ fontSize: 12, color: sub }}>Original price (AED)
                    <input type="number" defaultValue={orig} onBlur={e => saveSetting('plan_price', e.target.value)} style={{ ...inp, display: 'block', marginTop: 5, width: 130 }} />
                  </label>
                  <label style={{ fontSize: 12, color: sub }}>Discount %
                    <input type="number" defaultValue={disc} onBlur={e => saveSetting('plan_discount_pct', e.target.value)} style={{ ...inp, display: 'block', marginTop: 5, width: 110 }} />
                  </label>
                  <div style={{ padding: '8px 16px', borderRadius: 10, background: dark ? 'rgba(22,163,74,0.14)' : '#f0fdf4', border: `1px solid ${dark ? 'rgba(22,163,74,0.3)' : '#bbf7d0'}` }}>
                    <div style={{ fontSize: 11, color: sub }}>Partner pays</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#16a34a' }}>
                      AED {eff.toLocaleString('en-AE')}<span style={{ fontSize: 12, fontWeight: 600, color: sub }}>/mo</span>
                      {disc > 0 && <span style={{ fontSize: 12, color: sub, textDecoration: 'line-through', marginLeft: 8 }}>AED {orig.toLocaleString('en-AE')}</span>}
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Commission slabs */}
          <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 12, padding: 16, gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Commission slabs (by active paying referrals)</div>
            <div style={{ fontSize: 12, color: sub, marginBottom: 14, lineHeight: 1.5 }}>
              <b>Marginal</b> — like tax brackets. A partner with referrals in higher slabs earns the higher rate only on the referrals that fall in that slab (not on all of them). Leave the top slab's <b>“To”</b> blank for unlimited.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 40px', gap: 8, fontSize: 11, color: sub, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 6 }}>
              <span>From (referral #)</span><span>To (blank = ∞)</span><span>Commission %</span><span />
            </div>
            {slabs.map((s, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 40px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <input type="number" value={s.min_referrals ?? ''} onChange={e => updateSlab(i, 'min_referrals', e.target.value)} style={inp} />
                <input type="number" placeholder="∞" value={s.max_referrals ?? ''} onChange={e => updateSlab(i, 'max_referrals', e.target.value)} style={inp} />
                <input type="number" value={s.commission_pct ?? ''} onChange={e => updateSlab(i, 'commission_pct', e.target.value)} style={inp} />
                <button onClick={() => removeSlab(i)} title="Remove" style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16 }}><i className="ti ti-trash" /></button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
              <button onClick={addSlab} style={{ padding: '7px 13px', borderRadius: 8, border: `1px solid ${border}`, background: 'transparent', color: text, cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}><i className="ti ti-plus" /> Add slab</button>
              <button onClick={saveSlabs} disabled={saving} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#0099cc', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving…' : 'Save slabs'}</button>
              {msg && <span style={{ fontSize: 12.5, color: msg.includes('✓') ? '#16a34a' : '#f59e0b' }}>{msg}</span>}
            </div>
          </div>

          {/* Live example */}
          <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Example calculator</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 12.5, color: sub }}>A partner with</span>
              <input type="number" value={sample} onChange={e => setSample(Math.max(0, Number(e.target.value) || 0))} style={{ ...inp, width: 80 }} />
              <span style={{ fontSize: 12.5, color: sub }}>active paying referrals</span>
            </div>
            {calc.breakdown.map((b, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '4px 0', borderBottom: `1px solid ${border}` }}>
                <span style={{ color: sub }}>#{b.min}–{b.max == null ? '∞' : b.max} · {b.count} ref × {b.pct}%</span>
                <span style={{ fontWeight: 600 }}>{(b.count * b.pct).toFixed(0)} pts</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginTop: 8 }}>
              <span>Blended rate</span><span style={{ color: '#16a34a' }}>{calc.blendedPct.toFixed(1)}%</span>
            </div>
            <div style={{ fontSize: 11, color: sub, marginTop: 6, lineHeight: 1.5 }}>“Blended rate” is the average commission across all {sample} referrals. It’s what each referral effectively earns on average.</div>
          </div>

          {/* Payout rules */}
          <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Payout rules</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ fontSize: 12.5, color: sub }}>Minimum payout (AED)
                <input type="number" defaultValue={settings.min_payout} onBlur={e => saveSetting('min_payout', e.target.value)} style={{ ...inp, display: 'block', marginTop: 5, width: 140 }} />
              </label>
              <label style={{ fontSize: 12.5, color: sub }}>Payout claims allowed per month
                <input type="number" defaultValue={settings.claims_per_month} onBlur={e => saveSetting('claims_per_month', e.target.value)} style={{ ...inp, display: 'block', marginTop: 5, width: 140 }} />
              </label>
            </div>
            <div style={{ fontSize: 11, color: sub, marginTop: 12, lineHeight: 1.5 }}>Partners request payouts; you transfer by bank and mark them paid on the <b>Partners</b> page. Payouts are manual.</div>
          </div>

        </div>
      )}
    </div>
  )
}
