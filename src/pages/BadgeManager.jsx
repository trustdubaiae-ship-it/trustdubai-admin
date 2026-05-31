// trustdubai-admin/src/pages/BadgeManager.jsx
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'

const GREEN = '#1d9e75'

// Badge presets — admin click karke quickly fill kar sake
const PRESETS = [
  { type: 'trusted_local', title: 'Trusted Local Brand',   subtitle: 'Verified Excellence by TrustDubai', style: 'gold', icon: '🎖️' },
  { type: 'excellence',    title: 'Excellence Award 2026',  subtitle: 'Top Rated in Category',             style: 'navy', icon: '🏆' },
  { type: 'elite',         title: 'TrustDubai Elite',       subtitle: 'Premium Verified Member',           style: 'red',  icon: '⭐' },
  { type: 'top_rated',     title: 'Top Rated',              subtitle: 'Highest customer ratings',          style: 'gold', icon: '🥇' },
  { type: 'verified_pro',  title: 'Verified Professional',  subtitle: 'ID & License confirmed',            style: 'navy', icon: '✅' },
  { type: 'fast_response', title: 'Fast Responder',         subtitle: 'Replies within hours',              style: 'gold', icon: '⚡' },
]

const STYLES = [
  { key: 'gold', label: 'Gold',  color: '#c9a227' },
  { key: 'navy', label: 'Navy',  color: '#1a3a5c' },
  { key: 'red',  label: 'Red',   color: '#b01e2e' },
]

const ICONS = ['🎖️', '🏆', '⭐', '🥇', '✅', '⚡', '💎', '👑', '🛡️', '🌟', '🔥', '💪']

export default function BadgeManager({ theme = 'dark' }) {
  const isDark = theme === 'dark'
  const [companies, setCompanies] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)   // selected company
  const [badges, setBadges] = useState([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [adminEmail, setAdminEmail] = useState('')

  // new badge form
  const [form, setForm] = useState({ title: '', subtitle: '', style: 'gold', icon: '🎖️', badge_type: 'custom' })
  const [saving, setSaving] = useState(false)

  const txt  = isDark ? '#f0fdf4' : '#0f172a'
  const txt2 = isDark ? '#94a3b8' : '#64748b'
  const txt3 = isDark ? '#64748b' : '#94a3b8'
  const cardBg = isDark ? '#161b22' : '#fff'
  const border = isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0'
  const inputBg = isDark ? '#0d1117' : '#f8fafc'

  const card = { background: cardBg, border: `0.5px solid ${border}`, borderRadius: 14, padding: 20, marginBottom: 20 }
  const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13, background: inputBg, color: txt, border: `1px solid ${border}`, outline: 'none', boxSizing: 'border-box' }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAdminEmail(data?.user?.email || ''))
    loadCompanies('')
  }, [])

  const loadCompanies = useCallback(async (q) => {
    let query = supabase.from('companies').select('id, name, slug, plan, logo_url, is_verified').eq('status', 'approved').order('name').limit(20)
    if (q && q.trim()) query = query.ilike('name', `%${q.trim()}%`)
    const { data } = await query
    setCompanies(data || [])
  }, [])

  async function selectCompany(c) {
    setSelected(c); setMsg(''); setLoading(true)
    const { data } = await supabase.from('company_badges').select('*').eq('company_id', c.id).order('display_order')
    setBadges(data || [])
    setLoading(false)
  }

  function flash(m) { setMsg(m); setTimeout(() => setMsg(''), 2000) }

  function applyPreset(p) {
    setForm({ title: p.title, subtitle: p.subtitle, style: p.style, icon: p.icon, badge_type: p.type })
  }

  async function addBadge() {
    if (!selected) return
    if (!form.title.trim()) { flash('Error: Title required'); return }
    setSaving(true)
    const { data, error } = await supabase.from('company_badges').insert({
      company_id: selected.id,
      badge_type: form.badge_type || 'custom',
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || null,
      style: form.style,
      icon: form.icon,
      awarded_by: adminEmail,
      is_active: true,
      display_order: badges.length + 1,
    }).select()
    setSaving(false)
    if (error) { flash('Error: ' + error.message); return }
    if (!data || !data.length) { flash('Save failed — no permission (is_admin check)'); return }
    setBadges(b => [...b, data[0]])
    setForm({ title: '', subtitle: '', style: 'gold', icon: '🎖️', badge_type: 'custom' })
    flash('Badge awarded ✓')
  }

  async function toggleActive(b) {
    const { data, error } = await supabase.from('company_badges')
      .update({ is_active: !b.is_active }).eq('id', b.id).select()
    if (error) { flash('Error: ' + error.message); return }
    if (data && data.length) setBadges(arr => arr.map(x => x.id === b.id ? data[0] : x))
  }

  async function removeBadge(b) {
    if (!confirm(`Remove "${b.title}" from ${selected.name}?`)) return
    const { error } = await supabase.from('company_badges').delete().eq('id', b.id)
    if (error) { flash('Error: ' + error.message); return }
    setBadges(arr => arr.filter(x => x.id !== b.id))
    flash('Badge removed ✓')
  }

  const styleColor = (s) => (STYLES.find(x => x.key === s) || STYLES[0]).color

  return (
    <div style={{ maxWidth: 1000 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: txt, margin: '4px 0 4px' }}>🏅 Achievements & Badges</h1>
      <p style={{ fontSize: 13, color: txt2, marginBottom: 24 }}>
        Award trust badges to companies. These appear on the company's public profile (Achievement & Badge tab).
      </p>

      {msg && <div style={{ marginBottom: 16, fontSize: 13, fontWeight: 600, color: msg.startsWith('Error') || msg.startsWith('Save failed') ? '#f87171' : GREEN }}>{msg}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }}>

        {/* LEFT: company picker */}
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 700, color: GREEN, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Select Company</div>
          <input value={search} onChange={e => { setSearch(e.target.value); loadCompanies(e.target.value) }} placeholder="Search company name..." style={{ ...inputStyle, marginBottom: 12 }} />
          <div style={{ maxHeight: 440, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {companies.length === 0 && <div style={{ fontSize: 12, color: txt3, padding: 12, textAlign: 'center' }}>No companies found</div>}
            {companies.map(c => {
              const active = selected?.id === c.id
              const init = c.name?.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
              return (
                <div key={c.id} onClick={() => selectCompany(c)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: 9, borderRadius: 9, cursor: 'pointer', background: active ? (isDark ? 'rgba(74,222,128,0.1)' : 'rgba(22,163,74,0.07)') : 'transparent', border: `1px solid ${active ? GREEN + '55' : 'transparent'}` }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: GREEN + '22', color: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, overflow: 'hidden' }}>{c.logo_url ? <img src={c.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : init}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: txt, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                    <div style={{ fontSize: 10, color: txt3 }}>{(c.plan || 'free').toUpperCase()}{c.is_verified ? ' · ✓ Verified' : ''}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* RIGHT: badge manager */}
        <div>
          {!selected ? (
            <div style={{ ...card, textAlign: 'center', padding: 50, color: txt3, fontSize: 14 }}>
              ← Select a company to manage its badges
            </div>
          ) : (
            <>
              {/* Current badges */}
              <div style={card}>
                <div style={{ fontSize: 12, fontWeight: 700, color: GREEN, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Current Badges — {selected.name}</div>
                <p style={{ fontSize: 12, color: txt3, marginTop: 0, marginBottom: 16 }}>{loading ? 'Loading...' : `${badges.length} badge(s) awarded`}</p>
                {badges.length === 0 && !loading && <div style={{ fontSize: 13, color: txt3, padding: 16, textAlign: 'center', border: `1px dashed ${border}`, borderRadius: 10 }}>No badges yet. Award one below.</div>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
                  {badges.map(b => {
                    const bc = styleColor(b.style)
                    return (
                      <div key={b.id} style={{ border: `2px solid ${bc}`, borderRadius: 12, padding: 14, textAlign: 'center', opacity: b.is_active ? 1 : 0.45, position: 'relative', background: isDark ? bc + '14' : bc + '08' }}>
                        <div style={{ fontSize: 26 }}>{b.icon}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: txt, marginTop: 4 }}>{b.title}</div>
                        {b.subtitle && <div style={{ fontSize: 9.5, color: txt2, marginTop: 3, fontStyle: 'italic' }}>{b.subtitle}</div>}
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 10 }}>
                          <button onClick={() => toggleActive(b)} style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, border: `1px solid ${border}`, background: 'transparent', color: b.is_active ? GREEN : txt3, cursor: 'pointer', fontWeight: 600 }}>{b.is_active ? '● Active' : '○ Hidden'}</button>
                          <button onClick={() => removeBadge(b)} style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(248,113,113,0.4)', background: 'transparent', color: '#f87171', cursor: 'pointer' }}>Remove</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Award new badge */}
              <div style={card}>
                <div style={{ fontSize: 12, fontWeight: 700, color: GREEN, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>Award New Badge</div>

                {/* presets */}
                <div style={{ fontSize: 11, color: txt2, marginBottom: 8 }}>Quick presets (click to fill):</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 18 }}>
                  {PRESETS.map(p => (
                    <button key={p.type} onClick={() => applyPreset(p)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 8, border: `1px solid ${styleColor(p.style)}66`, background: 'transparent', color: txt, fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>
                      <span>{p.icon}</span> {p.title}
                    </button>
                  ))}
                </div>

                {/* form */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: txt, display: 'block', marginBottom: 6 }}>Title *</label>
                    <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Trusted Local Brand" style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: txt, display: 'block', marginBottom: 6 }}>Subtitle</label>
                    <input value={form.subtitle} onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))} placeholder="e.g. Verified Excellence" style={inputStyle} />
                  </div>
                </div>

                <div style={{ marginTop: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: txt, display: 'block', marginBottom: 6 }}>Card Color</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {STYLES.map(s => (
                      <button key={s.key} onClick={() => setForm(f => ({ ...f, style: s.key }))} style={{ flex: 1, padding: '9px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, border: `2px solid ${form.style === s.key ? s.color : border}`, background: form.style === s.key ? s.color + '18' : 'transparent', color: s.color }}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: txt, display: 'block', marginBottom: 6 }}>Icon</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {ICONS.map(ic => (
                      <button key={ic} onClick={() => setForm(f => ({ ...f, icon: ic }))} style={{ width: 38, height: 38, borderRadius: 8, fontSize: 18, cursor: 'pointer', border: `2px solid ${form.icon === ic ? GREEN : border}`, background: form.icon === ic ? GREEN + '18' : 'transparent' }}>{ic}</button>
                    ))}
                  </div>
                </div>

                {/* preview + submit */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 20, paddingTop: 16, borderTop: `0.5px solid ${border}` }}>
                  <div style={{ border: `2px solid ${styleColor(form.style)}`, borderRadius: 12, padding: '14px 18px', textAlign: 'center', minWidth: 150, background: isDark ? styleColor(form.style) + '14' : styleColor(form.style) + '08' }}>
                    <div style={{ fontSize: 24 }}>{form.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: txt, marginTop: 4 }}>{form.title || 'Badge Title'}</div>
                    {form.subtitle && <div style={{ fontSize: 9.5, color: txt2, marginTop: 3, fontStyle: 'italic' }}>{form.subtitle}</div>}
                  </div>
                  <button onClick={addBadge} disabled={saving} style={{ padding: '11px 26px', background: GREEN, color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                    {saving ? 'Awarding...' : '🏅 Award Badge'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
