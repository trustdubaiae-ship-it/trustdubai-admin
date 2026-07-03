import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const BADGE_SHAPES = [
  { id: 'circle', label: 'Circle (Instagram style)', preview: 'circle' },
  { id: 'shield', label: 'Shield', preview: 'shield' },
  { id: 'hexagon', label: 'Hexagon', preview: 'hexagon' },
  { id: 'diamond', label: 'Diamond (Current)', preview: 'diamond' },
]

function BadgePreview({ shape, color, size = 20 }) {
  if (shape === 'circle') return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="9" fill={color}/>
      <path d="M6 10L8.5 12.5L14 7" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  if (shape === 'shield') return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M10 1L13 4L17 3.2L17.2 7.2L20 9L17.2 10.8L17 14.8L13 14L10 17L7 14L3 14.8L2.8 10.8L0 9L2.8 7.2L3 3.2L7 4Z" fill={color}/>
      <path d="M6.5 9.5L8.8 11.8L13.5 7" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  if (shape === 'hexagon') return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <polygon points="10,1 18,5.5 18,14.5 10,19 2,14.5 2,5.5" fill={color}/>
      <path d="M6.5 10L8.8 12.3L13.5 7.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <rect x="3" y="3" width="14" height="14" rx="3" transform="rotate(45 10 10)" fill={color}/>
      <path d="M6.5 10L8.8 12.3L13.5 7.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export default function Plans() {
  const [plans, setPlans] = useState([])
  const [badges, setBadges] = useState([])
  const [loading, setLoading] = useState(true)
  const [editPlan, setEditPlan] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [p, b] = await Promise.all([
      supabase.from('membership_plans').select('*').order('sort_order'),
      supabase.from('verification_badges').select('*')
    ])
    setPlans(p.data || [])
    setBadges(b.data || [])
    setLoading(false)
  }

  async function savePlan(plan) {
    setSaving(true)
    await supabase.from('membership_plans').update({
      price_monthly: parseFloat(plan.price_monthly),
      max_portfolio_photos: parseInt(plan.max_portfolio_photos),
      max_team_members: parseInt(plan.max_team_members),
      can_reply_reviews: plan.can_reply_reviews,
      featured_homepage: plan.featured_homepage,
      priority_search: plan.priority_search,
      is_active: plan.is_active
    }).eq('id', plan.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    fetchAll()
    setEditPlan(null)
  }

  async function saveBadge(badge) {
    setSaving(true)
    await supabase.from('verification_badges').update({
      price: parseFloat(badge.price),
      badge_shape: badge.badge_shape,
      company_color: badge.company_color,
      employee_color: badge.employee_color,
      is_active: badge.is_active
    }).eq('id', badge.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    fetchAll()
  }

  const planColors = { Free: '#888', Silver: '#9e9e9e', Gold: '#f9a825', Platinum: '#7b1fa2' }

  const inp = { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, outline: 'none' }

  if (loading) return <p style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading...</p>

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Plans & Badges</h1>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>Manage membership plans and verification badge settings</p>
      </div>

      {saved && (
        <div style={{ background: 'var(--green-light)', color: 'var(--green)', padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 500 }}>
          ✓ Changes saved successfully!
        </div>
      )}

      {/* Membership Plans */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Membership Plans</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {plans.map(plan => (
            <div key={plan.id} style={{ background: '#fff', border: `2px solid ${planColors[plan.name] || '#eee'}`, borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: planColors[plan.name] || '#333' }}>{plan.name}</span>
                <span style={{ background: plan.is_active ? 'var(--green-light)' : 'var(--red-light)', color: plan.is_active ? 'var(--green)' : 'var(--red)', fontSize: 11, padding: '2px 7px', borderRadius: 10 }}>{plan.is_active ? 'Active' : 'Off'}</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 12 }}>
                AED {plan.price_monthly}<span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 400 }}>/mo</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.8, marginBottom: 12 }}>
                <div>📸 {plan.max_portfolio_photos === 999 ? 'Unlimited' : plan.max_portfolio_photos} photos</div>
                <div>👥 {plan.max_team_members === 999 ? 'Unlimited' : plan.max_team_members} team members</div>
                <div>{plan.can_reply_reviews ? '✓' : '✗'} Reply to reviews</div>
                <div>{plan.featured_homepage ? '✓' : '✗'} Homepage featured</div>
                <div>{plan.priority_search ? '✓' : '✗'} Priority search</div>
              </div>
              <button onClick={() => setEditPlan({ ...plan })} style={{ width: '100%', padding: '7px', background: 'var(--primary-light)', color: 'var(--primary)', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                Edit Plan
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Plan Modal */}
      {editPlan && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 420, maxWidth: 'calc(100vw - 28px)', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Edit — {editPlan.name} Plan</h2>
              <button onClick={() => setEditPlan(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text3)' }}>×</button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Monthly Price (AED)</label>
              <input type="number" value={editPlan.price_monthly} onChange={e => setEditPlan({ ...editPlan, price_monthly: e.target.value })} style={inp} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Max Portfolio Photos</label>
              <input type="number" value={editPlan.max_portfolio_photos} onChange={e => setEditPlan({ ...editPlan, max_portfolio_photos: e.target.value })} style={inp} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Max Team Members</label>
              <input type="number" value={editPlan.max_team_members} onChange={e => setEditPlan({ ...editPlan, max_team_members: e.target.value })} style={inp} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {[
                { key: 'can_reply_reviews', label: 'Reply to reviews' },
                { key: 'featured_homepage', label: 'Homepage featured' },
                { key: 'priority_search', label: 'Priority search' },
                { key: 'is_active', label: 'Plan active' },
              ].map(f => (
                <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={editPlan[f.key]} onChange={e => setEditPlan({ ...editPlan, [f.key]: e.target.checked })} />
                  {f.label}
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => savePlan(editPlan)} disabled={saving} style={{ flex: 1, padding: 10, background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button onClick={() => setEditPlan(null)} style={{ flex: 1, padding: 10, background: 'var(--bg)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Badge Settings */}
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Verification Badge Settings</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {badges.map(badge => (
            <BadgeEditor key={badge.id} badge={badge} onSave={saveBadge} saving={saving} />
          ))}
        </div>
      </div>
    </div>
  )
}

function BadgeEditor({ badge, onSave, saving }) {
  const [b, setB] = useState({ ...badge })

  const color = badge.entity_type === 'company' ? b.company_color : b.employee_color
  const setColor = v => badge.entity_type === 'company' ? setB({ ...b, company_color: v }) : setB({ ...b, employee_color: v })

  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{badge.entity_type === 'company' ? 'Company' : 'Employee'} Badge</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>AED {b.price} one-time</div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {['circle', 'shield', 'hexagon', 'diamond'].map(s => (
            <div key={s} onClick={() => setB({ ...b, badge_shape: s })} style={{ cursor: 'pointer', opacity: b.badge_shape === s ? 1 : 0.3, transform: b.badge_shape === s ? 'scale(1.2)' : 'scale(1)', transition: 'all 0.2s' }}>
              <BadgePreviewMini shape={s} color={color} />
            </div>
          ))}
        </div>
      </div>

      {/* Live Preview */}
      <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 12, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>
          {badge.entity_type === 'company' ? 'Al Noor Interiors' : 'Mohammad Irfan'}
        </span>
        <BadgePreviewMini shape={b.badge_shape} color={color} size={20} />
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>← live preview</span>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Price (AED)</label>
        <input type="number" value={b.price} onChange={e => setB({ ...b, price: e.target.value })}
          style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, outline: 'none' }} />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Badge Color</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="color" value={color} onChange={e => setColor(e.target.value)}
            style={{ width: 40, height: 36, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', padding: 2 }} />
          <input value={color} onChange={e => setColor(e.target.value)}
            style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, outline: 'none', fontFamily: 'monospace' }} />
          {/* Quick presets */}
          <div style={{ display: 'flex', gap: 4 }}>
            {['#1e8e3e', '#1a73e8', '#9c27b0', '#f9a825', '#d93025'].map(c => (
              <div key={c} onClick={() => setColor(c)} style={{ width: 20, height: 20, borderRadius: '50%', background: c, cursor: 'pointer', border: color === c ? '2px solid #333' : '1px solid transparent' }} />
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={b.is_active} onChange={e => setB({ ...b, is_active: e.target.checked })} />
          Badge active (show on profiles)
        </label>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', display: 'block', marginBottom: 8 }}>Badge Shape</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {['circle', 'shield', 'hexagon', 'diamond'].map(s => (
            <label key={s} onClick={() => setB({ ...b, badge_shape: s })} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', border: `1px solid ${b.badge_shape === s ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 6, cursor: 'pointer', background: b.badge_shape === s ? 'var(--primary-light)' : '#fff', fontSize: 12 }}>
              <BadgePreviewMini shape={s} color={color} size={16} />
              <span style={{ textTransform: 'capitalize', color: b.badge_shape === s ? 'var(--primary)' : 'var(--text2)' }}>{s}</span>
            </label>
          ))}
        </div>
      </div>

      <button onClick={() => onSave(b)} disabled={saving} style={{ width: '100%', padding: 10, background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
        {saving ? 'Saving...' : 'Save Badge Settings'}
      </button>
    </div>
  )
}

function BadgePreviewMini({ shape, color, size = 18 }) {
  if (shape === 'circle') return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="9" fill={color} />
      <path d="M6 10L8.5 12.5L14 7" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
  if (shape === 'shield') return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M10 1.5L13.5 4.5L17.5 3.5L17.7 8L20.5 9.5L17.7 11L17.5 15.5L13.5 14.5L10 17.5L6.5 14.5L2.5 15.5L2.3 11L-0.5 9.5L2.3 8L2.5 3.5L6.5 4.5Z" fill={color} />
      <path d="M6.5 9.5L8.8 11.8L13.5 7" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
  if (shape === 'hexagon') return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <polygon points="10,1 18,5.5 18,14.5 10,19 2,14.5 2,5.5" fill={color} />
      <path d="M6.5 10L8.8 12.3L13.5 7.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <rect x="3" y="3" width="14" height="14" rx="3" transform="rotate(45 10 10)" fill={color} />
      <path d="M6.5 10L8.8 12.3L13.5 7.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
