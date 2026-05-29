import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Reviews() {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [starFilter, setStarFilter] = useState(0)
  const [search, setSearch] = useState('')
  const [, forceUpdate] = useState(0)

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'

  useEffect(() => {
    fetchReviews()
    const observer = new MutationObserver(() => forceUpdate(n => n + 1))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  async function fetchReviews() {
    setLoading(true)
    const { data } = await supabase
      .from('reviews')
      .select('*, companies(name, category)')
      .order('created_at', { ascending: false })
    setReviews(data || [])
    setLoading(false)
  }

  async function toggle(id, cur) {
    await supabase.from('reviews').update({ is_approved: !cur }).eq('id', id)
    fetchReviews()
  }

  async function del(id) {
    if (!confirm('Delete this review?')) return
    await supabase.from('reviews').delete().eq('id', id)
    fetchReviews()
  }

  const text      = isDark ? '#f1f5f9' : '#0f172a'
  const textSub   = isDark ? '#94a3b8' : '#64748b'
  const textMuted = isDark ? '#475569' : '#94a3b8'
  const cardBg    = isDark ? '#1e293b' : '#ffffff'
  const borderCol = isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'
  const bgRow     = isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc'

  const starCounts = [1,2,3,4,5].map(s => ({
    star: s,
    count: reviews.filter(r => r.rating === s).length
  }))

  let filtered = reviews
    .filter(r => filter === 'all' ? true : filter === 'approved' ? r.is_approved : !r.is_approved)
    .filter(r => starFilter === 0 ? true : r.rating === starFilter)
    .filter(r => search === '' ? true :
      r.reviewer_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.review_text?.toLowerCase().includes(search.toLowerCase()) ||
      r.companies?.name?.toLowerCase().includes(search.toLowerCase())
    )

  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : '0.0'

  return (
    <div style={{ maxWidth: 960 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: text, marginBottom: 4 }}>Reviews</h1>
          <p style={{ fontSize: 13, color: textSub }}>Moderate all platform reviews</p>
        </div>
        <div style={{ background: cardBg, border: '1px solid ' + borderCol, borderRadius: 12, padding: '10px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#f9a825', lineHeight: 1 }}>{avgRating}</div>
          <div style={{ color: '#f9a825', fontSize: 14 }}>{'★'.repeat(Math.round(avgRating))}{'☆'.repeat(5 - Math.round(avgRating))}</div>
          <div style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>Platform avg</div>
        </div>
      </div>

      {/* Star Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 16 }}>
        {starCounts.map(({ star, count }) => (
          <div key={star} onClick={() => setStarFilter(starFilter === star ? 0 : star)} style={{
            background: starFilter === star ? (isDark ? 'rgba(248,168,37,0.15)' : '#fef9e7') : cardBg,
            border: '1px solid ' + (starFilter === star ? '#f9a825' : borderCol),
            borderRadius: 12, padding: '12px 14px', cursor: 'pointer', textAlign: 'center',
            transition: 'all 0.15s',
          }}
            onMouseEnter={e => { if (starFilter !== star) e.currentTarget.style.borderColor = '#f9a825' }}
            onMouseLeave={e => { if (starFilter !== star) e.currentTarget.style.borderColor = borderCol }}
          >
            <div style={{ fontSize: 16, color: '#f9a825' }}>{'★'.repeat(star)}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: starFilter === star ? '#f9a825' : text, marginTop: 4 }}>{count}</div>
            <div style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>{star} star{star > 1 ? 's' : ''}</div>
          </div>
        ))}
      </div>

      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Total Reviews', value: reviews.length,                          color: '#1a73e8', icon: 'ti-message' },
          { label: 'Approved',      value: reviews.filter(r => r.is_approved).length,  color: '#1e8e3e', icon: 'ti-circle-check' },
          { label: 'Hidden',        value: reviews.filter(r => !r.is_approved).length, color: '#ef4444', icon: 'ti-eye-off' },
        ].map(s => (
          <div key={s.label} style={{ background: cardBg, border: '1px solid ' + borderCol, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid ' + borderCol }}>
              <i className={'ti ' + s.icon} style={{ fontSize: 18, color: s.color }} />
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: textSub, marginTop: 2 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search + Filter Tabs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search reviewer, review text, company..."
          style={{ flex: 1, padding: '8px 12px', border: '1px solid ' + borderCol, borderRadius: 8, fontSize: 13, background: cardBg, color: text, outline: 'none' }}
        />
        {starFilter > 0 && (
          <button onClick={() => setStarFilter(0)} style={{ padding: '8px 14px', border: '1px solid #f9a825', background: isDark ? 'rgba(248,168,37,0.1)' : '#fef9e7', color: '#f9a825', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {'★'.repeat(starFilter)} × clear
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid ' + borderCol }}>
        {[
          { id: 'all',      label: 'All',      count: reviews.length },
          { id: 'approved', label: 'Approved', count: reviews.filter(r => r.is_approved).length },
          { id: 'pending',  label: 'Hidden',   count: reviews.filter(r => !r.is_approved).length },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
            borderBottom: filter === f.id ? '2px solid #03C1F5' : '2px solid transparent',
            color: filter === f.id ? '#03C1F5' : textSub, fontWeight: 500, fontSize: 13,
          }}>
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ width: 36, height: 36, border: '3px solid #03C1F5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          <p style={{ color: textMuted, fontSize: 13 }}>Loading reviews...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <i className="ti ti-message-off" style={{ fontSize: 48, color: textMuted, display: 'block', marginBottom: 12 }} />
          <p style={{ color: textMuted, fontSize: 14 }}>No reviews found</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(r => (
            <div key={r.id} style={{ background: cardBg, border: '1px solid ' + borderCol, borderRadius: 14, padding: '16px 20px', boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.2)' : '0 1px 4px rgba(0,0,0,0.04)' }}>

              {/* Review Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: isDark ? 'rgba(3,193,245,0.15)' : '#e0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#03C1F5', flexShrink: 0 }}>
                    {(r.reviewer_name || 'A')[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: text }}>{r.reviewer_name || 'Anonymous'}</div>
                    <div style={{ fontSize: 11, color: textSub, marginTop: 1 }}>
                      {r.companies?.name || 'Unknown'}{r.companies?.category ? ' · ' + r.companies.category : ''}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <div style={{ color: '#f9a825', fontSize: 14 }}>
                    {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                  </div>
                  <span style={{ fontSize: 11, color: textMuted }}>
                    {new Date(r.created_at).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <span style={{
                    background: r.is_approved ? (isDark ? 'rgba(30,142,62,0.15)' : '#e6f4ea') : (isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2'),
                    color: r.is_approved ? '#1e8e3e' : '#ef4444',
                    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10
                  }}>
                    {r.is_approved ? '✓ Approved' : '⊘ Hidden'}
                  </span>
                  {r.owner_reply && (
                    <span style={{ background: isDark ? 'rgba(26,115,232,0.15)' : '#eff6ff', color: '#1a73e8', fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 10 }}>
                      💬 Replied
                    </span>
                  )}
                </div>
              </div>

              {/* Review Text */}
              {r.review_text && (
                <p style={{ fontSize: 13, color: textSub, marginBottom: 10, lineHeight: 1.6, paddingLeft: 48, margin: '0 0 10px 48px' }}>
                  "{r.review_text}"
                </p>
              )}

              {/* Owner Reply */}
              {r.owner_reply && (
                <div style={{ background: isDark ? 'rgba(16,185,129,0.08)' : '#f0fdf4', border: '1px solid ' + (isDark ? 'rgba(16,185,129,0.2)' : '#a7f3d0'), borderRadius: 8, padding: '10px 12px', marginBottom: 10, marginLeft: 48 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#10b981', marginBottom: 4 }}>
                    💬 Company Reply · {r.owner_reply_at ? new Date(r.owner_reply_at).toLocaleDateString('en-AE', { day: 'numeric', month: 'short' }) : ''}
                  </div>
                  <p style={{ fontSize: 13, color: textSub, margin: 0, lineHeight: 1.6 }}>{r.owner_reply}</p>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, paddingLeft: 48 }}>
                <button onClick={() => toggle(r.id, r.is_approved)} style={{
                  padding: '5px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  background: r.is_approved ? (isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2') : (isDark ? 'rgba(16,185,129,0.1)' : '#e6f4ea'),
                  color: r.is_approved ? '#ef4444' : '#1e8e3e'
                }}>
                  {r.is_approved ? 'Hide' : 'Approve'}
                </button>
                <button onClick={() => del(r.id)} style={{
                  padding: '5px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  background: isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2', color: '#ef4444'
                }}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
