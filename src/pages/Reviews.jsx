import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Reviews() {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [starFilter, setStarFilter] = useState(0)

  useEffect(() => { fetchReviews() }, [])

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

  const starCounts = [1, 2, 3, 4, 5].map(s => ({
    star: s,
    count: reviews.filter(r => r.rating === s).length
  }))

  const filtered = reviews
    .filter(r => filter === 'all' ? true : filter === 'approved' ? r.is_approved : !r.is_approved)
    .filter(r => starFilter === 0 ? true : r.rating === starFilter)

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Reviews</h1>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>Moderate all platform reviews</p>
      </div>

      {/* Star Rating Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
        {starCounts.map(({ star, count }) => (
          <div key={star} onClick={() => setStarFilter(starFilter === star ? 0 : star)} style={{
            background: starFilter === star ? '#fef9ed' : '#fff',
            border: '1px solid ' + (starFilter === star ? '#e8b84b' : 'var(--border)'),
            borderRadius: 10, padding: '12px 14px', cursor: 'pointer', textAlign: 'center'
          }}>
            <div style={{ fontSize: 20, color: '#e8b84b' }}>{'★'.repeat(star)}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: starFilter === star ? '#e8b84b' : 'var(--text)', marginTop: 4 }}>{count}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{star} star{star > 1 ? 's' : ''}</div>
          </div>
        ))}
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Total Reviews', value: reviews.length, color: '#1a73e8' },
          { label: 'Approved', value: reviews.filter(r => r.is_approved).length, color: '#1e8e3e' },
          { label: 'Hidden', value: reviews.filter(r => !r.is_approved).length, color: '#d93025' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {['all', 'approved', 'pending'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '10px 20px', border: 'none', background: 'none',
            borderBottom: filter === f ? '2px solid var(--primary)' : '2px solid transparent',
            color: filter === f ? 'var(--primary)' : 'var(--text2)',
            fontWeight: 500, fontSize: 13, textTransform: 'capitalize', cursor: 'pointer'
          }}>{f} ({reviews.filter(r => f === 'all' ? true : f === 'approved' ? r.is_approved : !r.is_approved).length})</button>
        ))}
        {starFilter > 0 && (
          <button onClick={() => setStarFilter(0)} style={{
            padding: '10px 16px', border: 'none', background: 'none',
            color: '#e8b84b', fontWeight: 500, fontSize: 13, cursor: 'pointer',
            borderBottom: '2px solid #e8b84b', marginLeft: 'auto'
          }}>
            {'★'.repeat(starFilter)} filter × clear
          </button>
        )}
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Loading...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(r => (
            <div key={r.id} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: 'var(--primary)', flexShrink: 0 }}>
                    {(r.reviewer_name || 'A')[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{r.reviewer_name || 'Anonymous'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                      {r.companies?.name || 'Unknown'} · {r.companies?.category}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#e8b84b', fontSize: 14 }}>
                    {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {new Date(r.created_at).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <span style={{
                    background: r.is_approved ? 'var(--green-light)' : '#fef2f2',
                    color: r.is_approved ? 'var(--green)' : '#ef4444',
                    fontSize: 11, padding: '2px 8px', borderRadius: 10
                  }}>
                    {r.is_approved ? 'Approved' : 'Hidden'}
                  </span>
                  {r.owner_reply && (
                    <span style={{ background: '#eff6ff', color: '#1a73e8', fontSize: 11, padding: '2px 8px', borderRadius: 10 }}>
                      💬 Replied
                    </span>
                  )}
                </div>
              </div>

              {r.review_text && (
                <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 10, lineHeight: 1.6, paddingLeft: 46 }}>
                  {r.review_text}
                </p>
              )}

              {/* Show owner reply if exists */}
              {r.owner_reply && (
                <div style={{ background: '#f0fdf4', border: '1px solid #a7f3d0', borderRadius: 8, padding: '10px 12px', marginBottom: 10, marginLeft: 46 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#065f46', marginBottom: 4 }}>
                    ✅ Company Reply · {r.owner_reply_at ? new Date(r.owner_reply_at).toLocaleDateString('en-AE', { day: 'numeric', month: 'short' }) : ''}
                  </div>
                  <p style={{ fontSize: 13, color: '#374151', margin: 0, lineHeight: 1.6 }}>{r.owner_reply}</p>
                </div>
              )}

              {/* Admin actions — only Approve/Hide/Delete */}
              <div style={{ display: 'flex', gap: 8, paddingLeft: 46 }}>
                <button onClick={() => toggle(r.id, r.is_approved)} style={{
                  padding: '5px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  background: r.is_approved ? '#fef9ed' : 'var(--green-light)',
                  color: r.is_approved ? '#92400e' : 'var(--green)'
                }}>
                  {r.is_approved ? 'Hide' : 'Approve'}
                </button>
                <button onClick={() => del(r.id)} style={{
                  padding: '5px 14px', borderRadius: 6, border: 'none', fontSize: 12, cursor: 'pointer',
                  background: '#fef2f2', color: '#ef4444'
                }}>
                  Delete
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p style={{ textAlign: 'center', padding: 40, color: 'var(--text3)', fontSize: 13 }}>
              No reviews {starFilter > 0 ? 'with ' + starFilter + ' stars' : ''}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
