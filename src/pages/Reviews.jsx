import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

/* ----------------------------------------------------------------------
   FAKE / SUSPICIOUS REVIEW DETECTION  (client-side, no DB change)
   Analyses the full review list and returns, per review:
     { score, level: 'none'|'low'|'medium'|'high', reasons: [] }
   Signals & weights:
     - Duplicate / copy-paste text ............ 3
     - Same reviewer reviewed same company 2+ . 3
     - Burst: company got 3+ reviews in 24h ... 2
     - Reviewer spamming platform (3+ in 7d) .. 2
     - Extreme rating (1 or 5) + no text ...... 2
     - Unverified client ...................... 1
   Levels:  0 none · 1-2 low · 3-4 medium · 5+ high
---------------------------------------------------------------------- */
function reviewerKey(r) {
  return (r.customer_id || r.reviewer_phone || r.reviewer_email || r.reviewer_name || '').toString().trim().toLowerCase()
}
function normText(t) {
  return (t || '').toLowerCase().replace(/\s+/g, ' ').trim()
}
function analyzeReviews(reviews) {
  const out = {}
  const DAY = 24 * 60 * 60 * 1000

  // pre-index
  const textCount = {}            // normalized text -> count
  reviews.forEach(r => {
    const t = normText(r.review_text)
    if (t.length >= 8) textCount[t] = (textCount[t] || 0) + 1
  })

  reviews.forEach(r => {
    const reasons = []
    let score = 0
    const rTime = new Date(r.created_at).getTime()
    const key = reviewerKey(r)
    const t = normText(r.review_text)

    // 1) Duplicate / copy-paste text
    if (t.length >= 8 && textCount[t] > 1) { score += 3; reasons.push('Duplicate text used on multiple reviews') }

    // 2) Same reviewer reviewed the SAME company more than once
    if (key) {
      const sameCompanySameUser = reviews.filter(x => x.company_id === r.company_id && reviewerKey(x) === key).length
      if (sameCompanySameUser > 1) { score += 3; reasons.push('Same reviewer posted multiple reviews for this company') }
    }

    // 3) Burst — this company got 3+ reviews within 24h of this one
    const burst = reviews.filter(x => x.company_id === r.company_id && Math.abs(new Date(x.created_at).getTime() - rTime) <= DAY).length
    if (burst >= 3) { score += 2; reasons.push(`Burst: ${burst} reviews on this company within 24h`) }

    // 4) Reviewer spamming platform-wide — 3+ reviews in 7 days
    if (key) {
      const recentByUser = reviews.filter(x => reviewerKey(x) === key && Math.abs(new Date(x.created_at).getTime() - rTime) <= 7 * DAY).length
      if (recentByUser >= 3) { score += 2; reasons.push(`Reviewer posted ${recentByUser} reviews in 7 days`) }
    }

    // 5) Extreme rating with no written text
    if ((r.rating === 1 || r.rating === 5) && t.length === 0) { score += 2; reasons.push('Extreme rating with no written feedback') }

    // 6) Unverified client (soft signal)
    if (r.is_verified_client === false) { score += 1; reasons.push('Reviewer is not a verified client') }

    let level = 'none'
    if (score >= 5) level = 'high'
    else if (score >= 3) level = 'medium'
    else if (score >= 1) level = 'low'

    out[r.id] = { score, level, reasons }
  })
  return out
}

const LEVEL_STYLE = {
  high:   { label: 'High risk',   color: '#dc2626', bg: 'rgba(220,38,38,0.14)',  icon: 'ti-alert-octagon' },
  medium: { label: 'Suspicious',  color: '#d97706', bg: 'rgba(217,119,6,0.14)',  icon: 'ti-alert-triangle' },
  low:    { label: 'Low signal',  color: '#64748b', bg: 'rgba(100,116,139,0.14)', icon: 'ti-info-circle' },
}

export default function Reviews() {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [starFilter, setStarFilter] = useState(0)
  const [search, setSearch] = useState('')
  const [flaggedOnly, setFlaggedOnly] = useState(false)
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

  // run detection on the full set
  const flags = analyzeReviews(reviews)
  const flaggedCount = reviews.filter(r => (flags[r.id]?.level === 'medium' || flags[r.id]?.level === 'high')).length

  const starCounts = [1,2,3,4,5].map(s => ({
    star: s,
    count: reviews.filter(r => r.rating === s).length
  }))

  let filtered = reviews
    .filter(r => filter === 'all' ? true : filter === 'approved' ? r.is_approved : !r.is_approved)
    .filter(r => starFilter === 0 ? true : r.rating === starFilter)
    .filter(r => !flaggedOnly ? true : (flags[r.id]?.level === 'medium' || flags[r.id]?.level === 'high'))
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Total Reviews', value: reviews.length,                          color: '#1a73e8', icon: 'ti-message', click: () => { setFilter('all'); setFlaggedOnly(false) } },
          { label: 'Approved',      value: reviews.filter(r => r.is_approved).length,  color: '#1e8e3e', icon: 'ti-circle-check', click: () => { setFilter('approved'); setFlaggedOnly(false) } },
          { label: 'Hidden',        value: reviews.filter(r => !r.is_approved).length, color: '#ef4444', icon: 'ti-eye-off', click: () => { setFilter('pending'); setFlaggedOnly(false) } },
          { label: 'Flagged',       value: flaggedCount, color: '#d97706', icon: 'ti-alert-triangle', click: () => { setFilter('all'); setFlaggedOnly(true) } },
        ].map(s => {
          const active = s.label === 'Flagged' && flaggedOnly
          return (
            <div key={s.label} onClick={s.click} style={{ background: active ? (isDark ? 'rgba(217,119,6,0.12)' : '#fffbeb') : cardBg, border: '1px solid ' + (active ? '#d97706' : borderCol), borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'all 0.15s' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid ' + borderCol }}>
                <i className={'ti ' + s.icon} style={{ fontSize: 18, color: s.color }} />
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 12, color: textSub, marginTop: 2 }}>{s.label}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Flagged-only banner */}
      {flaggedOnly && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: isDark ? 'rgba(217,119,6,0.1)' : '#fffbeb', border: '1px solid ' + (isDark ? 'rgba(217,119,6,0.3)' : '#fcd34d'), borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
          <i className="ti ti-shield-check" style={{ fontSize: 18, color: '#d97706' }} />
          <span style={{ fontSize: 12.5, color: textSub, flex: 1 }}>
            Showing <b style={{ color: text }}>{flaggedCount}</b> review{flaggedCount !== 1 ? 's' : ''} flagged as suspicious. These are <b>signals, not proof</b> — review each before hiding.
          </span>
          <button onClick={() => setFlaggedOnly(false)} style={{ fontSize: 12, color: '#d97706', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
            ✕ Show all
          </button>
        </div>
      )}

      {/* Search + Filter Tabs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search reviewer, review text, company..."
          style={{ flex: 1, minWidth: 200, padding: '8px 12px', border: '1px solid ' + borderCol, borderRadius: 8, fontSize: 13, background: cardBg, color: text, outline: 'none', boxSizing: 'border-box' }}
        />
        {starFilter > 0 && (
          <button onClick={() => setStarFilter(0)} style={{ padding: '8px 14px', border: '1px solid #f9a825', background: isDark ? 'rgba(248,168,37,0.1)' : '#fef9e7', color: '#f9a825', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {'★'.repeat(starFilter)} × clear
          </button>
        )}
        <button onClick={() => setFlaggedOnly(v => !v)} style={{ padding: '8px 14px', border: '1px solid ' + (flaggedOnly ? '#d97706' : borderCol), background: flaggedOnly ? (isDark ? 'rgba(217,119,6,0.12)' : '#fffbeb') : cardBg, color: flaggedOnly ? '#d97706' : textSub, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
          <i className="ti ti-alert-triangle" style={{ fontSize: 14 }} /> Flagged only
        </button>
      </div>

      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid ' + borderCol, overflowX: 'auto' }}>
        {[
          { id: 'all',      label: 'All',      count: reviews.length },
          { id: 'approved', label: 'Approved', count: reviews.filter(r => r.is_approved).length },
          { id: 'pending',  label: 'Hidden',   count: reviews.filter(r => !r.is_approved).length },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
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
          {filtered.map(r => {
            const fl = flags[r.id] || { level: 'none', reasons: [], score: 0 }
            const ls = LEVEL_STYLE[fl.level]
            return (
              <div key={r.id} style={{ background: cardBg, border: '1px solid ' + (fl.level === 'high' ? 'rgba(220,38,38,0.4)' : fl.level === 'medium' ? 'rgba(217,119,6,0.35)' : borderCol), borderRadius: 14, padding: '16px 20px', boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.2)' : '0 1px 4px rgba(0,0,0,0.04)' }}>

                {/* Review Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: isDark ? 'rgba(3,193,245,0.15)' : '#e0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#03C1F5', flexShrink: 0 }}>
                      {(r.reviewer_name || 'A')[0].toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: text, display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                        {r.reviewer_name || 'Anonymous'}
                        {r.is_verified_client && <span style={{ fontSize: 10, fontWeight: 600, color: '#1e8e3e', background: isDark ? 'rgba(30,142,62,0.15)' : '#e6f4ea', padding: '1px 7px', borderRadius: 10 }}>✓ Verified client</span>}
                      </div>
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

                {/* Suspicion flag panel */}
                {fl.level !== 'none' && ls && (
                  <div style={{ marginLeft: 48, marginBottom: 10, background: ls.bg, border: '1px solid ' + ls.color + '55', borderRadius: 8, padding: '8px 11px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: fl.reasons.length ? 5 : 0 }}>
                      <i className={'ti ' + ls.icon} style={{ fontSize: 14, color: ls.color }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: ls.color }}>{ls.label}</span>
                      <span style={{ fontSize: 10.5, color: textMuted }}>· detection score {fl.score}</span>
                    </div>
                    {fl.reasons.length > 0 && (
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {fl.reasons.map((rs, i) => (
                          <li key={i} style={{ fontSize: 11.5, color: textSub, lineHeight: 1.5 }}>{rs}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Review Text */}
                {r.review_text && (
                  <p style={{ fontSize: 13, color: textSub, lineHeight: 1.6, margin: '0 0 10px 48px' }}>
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
            )
          })}
        </div>
      )}
    </div>
  )
}
