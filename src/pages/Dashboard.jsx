import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

function AnimatedNumber({ value, duration = 1000 }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    let start = 0
    const step = value / (duration / 16)
    const timer = setInterval(() => {
      start += step
      if (start >= value) { setDisplay(value); clearInterval(timer) }
      else setDisplay(Math.floor(start))
    }, 16)
    return () => clearInterval(timer)
  }, [value])
  return <span>{display}</span>
}

function MiniSparkline({ data, color }) {
  if (!data || data.length < 2) return null
  const max = Math.max(...data), min = Math.min(...data), range = max - min || 1
  const w = 80, h = 32
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ')
  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
      <circle cx={w} cy={h - ((data[data.length - 1] - min) / range) * h} r="3" fill={color} />
    </svg>
  )
}

export default function Dashboard({ setPage, setPlanFilter }) {
  const [stats, setStats] = useState({ total: 0, verified: 0, today: 0, thisMonth: 0, reviews: 0, employees: 0, avgRating: 0 })
  const [planDist, setPlanDist] = useState({ free: 0, silver: 0, gold: 0, platinum: 0 })
  const [catDist, setCatDist] = useState([])
  const [recentRegs, setRecentRegs] = useState([])
  const [recentReviews, setRecentReviews] = useState([])
  const [topCompanies, setTopCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [time, setTime] = useState(new Date())
  const [, forceUpdate] = useState(0)

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'

  useEffect(() => {
    fetchAll()
    const t = setInterval(() => setTime(new Date()), 1000)
    const observer = new MutationObserver(() => forceUpdate(n => n + 1))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => { clearInterval(t); observer.disconnect() }
  }, [])

  async function fetchAll() {
    setLoading(true)
    const [plansRes, catsRes, regsRes, reviewsRes, topRes, empRes] = await Promise.all([
      supabase.from('companies').select('plan, plan_name, is_verified, avg_rating, total_reviews'),
      supabase.from('companies').select('category').eq('status', 'approved'),
      supabase.from('company_registrations').select('*').order('submitted_at', { ascending: false }).limit(5),
      supabase.from('reviews').select('*, companies(name)').order('created_at', { ascending: false }).limit(5),
      supabase.from('companies').select('name, avg_rating, total_reviews, category, is_verified').eq('status', 'approved').order('avg_rating', { ascending: false }).limit(5),
      supabase.from('employees').select('id', { count: 'exact', head: true }),
    ])

    const companies = plansRes.data || []
    const thisMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

    const [todayRes, monthRes, totalRes, avgRes] = await Promise.all([
      supabase.from('companies').select('id', { count: 'exact', head: true }).gte('created_at', new Date().toISOString().split('T')[0]),
      supabase.from('companies').select('id', { count: 'exact', head: true }).gte('created_at', thisMonthStart),
      supabase.from('companies').select('id', { count: 'exact', head: true }),
      supabase.from('reviews').select('rating'),
    ])

    const ratings = avgRes.data || []
    const avgRating = ratings.length ? (ratings.reduce((s, r) => s + r.rating, 0) / ratings.length).toFixed(1) : 0

    setStats({
      total: totalRes.count || 0,
      verified: companies.filter(c => c.is_verified).length,
      today: todayRes.count || 0,
      thisMonth: monthRes.count || 0,
      reviews: ratings.length,
      employees: empRes.count || 0,
      avgRating
    })

    const dist = { free: 0, silver: 0, gold: 0, platinum: 0 }
    companies.forEach(c => {
      const p = (c.plan || c.plan_name || 'free').toLowerCase()
      if (dist[p] !== undefined) dist[p]++
      else dist.free++
    })
    setPlanDist(dist)

    const cats = {}
    ;(catsRes.data || []).forEach(c => { cats[c.category] = (cats[c.category] || 0) + 1 })
    setCatDist(Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 6))

    setRecentRegs(regsRes.data || [])
    setRecentReviews(reviewsRes.data || [])
    setTopCompanies(topRes.data || [])
    setLoading(false)
  }

  const PLAN_CONFIG = {
    free:     { label: 'Free',     color: '#6b7280', bg: isDark ? 'rgba(107,114,128,0.15)' : '#f3f4f6', icon: 'ti-building',  price: 0 },
    silver:   { label: 'Silver',   color: '#94a3b8', bg: isDark ? 'rgba(148,163,184,0.15)' : '#f1f5f9', icon: 'ti-medal',     price: 149 },
    gold:     { label: 'Gold',     color: '#e8b84b', bg: isDark ? 'rgba(232,184,75,0.15)'  : '#fffdf7', icon: 'ti-star',      price: 349 },
    platinum: { label: 'Platinum', color: '#8b5cf6', bg: isDark ? 'rgba(139,92,246,0.15)'  : '#f5f3ff', icon: 'ti-diamond',   price: 699 },
  }

  const catColors = ['#1a73e8', '#1e8e3e', '#f9a825', '#d93025', '#9c27b0', '#00897b']
  const text = isDark ? '#f1f5f9' : '#0f172a'
  const textSub = isDark ? '#94a3b8' : '#64748b'
  const textMuted = isDark ? '#475569' : '#94a3b8'
  const borderCol = isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0'
  const bgRow = isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc'
  const cardStyle = { background: isDark ? '#1e293b' : '#ffffff', border: '1px solid ' + borderCol, borderRadius: 16, padding: 20, boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.2)' : '0 1px 8px rgba(0,0,0,0.04)' }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #03C1F5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <div style={{ fontSize: 14, color: textSub }}>Loading dashboard...</div>
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth: 1200 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: text, letterSpacing: '-0.3px' }}>Dashboard Overview</h1>
          <p style={{ fontSize: 13, color: textSub, marginTop: 4 }}>Monitor and manage the entire TrustDubai platform</p>
        </div>
        <div style={{ textAlign: 'right', background: isDark ? '#1e293b' : '#fff', border: '1px solid ' + borderCol, borderRadius: 12, padding: '10px 16px' }}>
          <div style={{ fontSize: 24, fontWeight: 300, color: '#03C1F5', fontVariantNumeric: 'tabular-nums', letterSpacing: 1 }}>
            {time.toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>
            {new Date().toLocaleDateString('en-AE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <div style={{ fontSize: 10, color: textMuted }}>Dubai Time (GMT+4)</div>
        </div>
      </div>

      {/* Row 1 — Total + Verified + Secondary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 14 }}>
        {[
          { label: 'Total Companies', value: stats.total, icon: 'ti-building', color: '#1a73e8', bg: isDark ? 'rgba(26,115,232,0.15)' : '#e8f0fe', sub: stats.today + ' added today', trend: [0, stats.thisMonth * 0.2, stats.thisMonth * 0.5, stats.thisMonth * 0.8, stats.thisMonth], onClick: () => { if(setPage) setPage('companies') } },
          { label: 'Verified Companies', value: stats.verified, icon: 'ti-shield-check', color: '#1e8e3e', bg: isDark ? 'rgba(30,142,62,0.15)' : '#e6f4ea', sub: (stats.total ? Math.round(stats.verified / stats.total * 100) : 0) + '% of total', onClick: () => { if(setPage) setPage('companies') } },
          { label: 'Total Reviews', value: stats.reviews, icon: 'ti-message', color: '#d93025', bg: isDark ? 'rgba(217,48,37,0.15)' : '#fce8e6', sub: 'Platform rating: ' + stats.avgRating + '★', onClick: () => { if(setPage) setPage('reviews') } },
          { label: 'Platform Rating', value: stats.avgRating, icon: 'ti-star', color: '#f9a825', bg: isDark ? 'rgba(249,168,37,0.15)' : '#fef9e7', sub: stats.reviews + ' total reviews', isRating: true },
        ].map((card, i) => (
          <div key={i}
            onClick={card.onClick}
            style={{ background: isDark ? '#1e293b' : '#ffffff', border: '1px solid ' + borderCol, borderRadius: 16, padding: 20, position: 'relative', overflow: 'hidden', cursor: card.onClick ? 'pointer' : 'default', transition: 'transform 0.15s, box-shadow 0.15s', boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.2)' : '0 1px 8px rgba(0,0,0,0.06)' }}
            onMouseEnter={e => { if(card.onClick) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = isDark ? '0 8px 32px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.1)' }}}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = isDark ? '0 4px 24px rgba(0,0,0,0.2)' : '0 1px 8px rgba(0,0,0,0.06)' }}
          >
            <div style={{ position: 'absolute', top: -10, right: -10, width: 70, height: 70, background: card.color, borderRadius: '50%', opacity: 0.08 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className={'ti ' + card.icon} style={{ fontSize: 20, color: card.color }} />
              </div>
              {card.trend && <MiniSparkline data={card.trend} color={card.color} />}
            </div>
            <div style={{ fontSize: 30, fontWeight: 700, color: text, lineHeight: 1, letterSpacing: '-0.5px' }}>
              {card.isRating ? card.value : <AnimatedNumber value={card.value} />}
              {card.isRating && <span style={{ fontSize: 16, color: '#f9a825', marginLeft: 4 }}>★</span>}
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, color: textSub, marginTop: 6 }}>{card.label}</div>
            <div style={{ fontSize: 11, color: card.color, marginTop: 4, fontWeight: 500 }}>{card.sub}</div>
            {card.onClick && <div style={{ position: 'absolute', bottom: 12, right: 14, fontSize: 11, color: card.color, opacity: 0.6 }}>View →</div>}
          </div>
        ))}
      </div>

      {/* Row 2 — 4 Plan Cards (clickable → Companies with filter) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {Object.entries(PLAN_CONFIG).map(([key, p]) => (
          <div key={key}
            onClick={() => { if (setPage && setPlanFilter) { setPlanFilter(key); setPage('companies') } }}
            style={{ background: isDark ? '#1e293b' : '#fff', border: '2px solid ' + (isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0'), borderRadius: 14, padding: '16px 18px', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 14 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = p.color; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 20px ' + p.color + '33' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
          >
            <div style={{ width: 44, height: 44, borderRadius: 12, background: p.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className={'ti ' + p.icon} style={{ fontSize: 22, color: p.color }} />
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 700, color: text, lineHeight: 1 }}>
                <AnimatedNumber value={planDist[key]} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: p.color, marginTop: 3 }}>{p.label}</div>
              <div style={{ fontSize: 11, color: textMuted }}>{p.price === 0 ? 'Free plan' : 'AED ' + p.price + '/mo'}</div>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: 11, color: p.color, opacity: 0.7 }}>View →</div>
          </div>
        ))}
      </div>

      {/* Row 3 — Plan Distribution + Category Distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: text }}>Plan Distribution</h3>
            <span style={{ fontSize: 11, color: textMuted, background: bgRow, padding: '3px 10px', borderRadius: 20, border: '1px solid ' + borderCol }}>{stats.total} total</span>
          </div>
          {Object.entries(PLAN_CONFIG).map(([key, p]) => {
            const count = planDist[key]
            const total = Object.values(planDist).reduce((a, b) => a + b, 0) || 1
            return (
              <div key={key} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: text }}>{p.label}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: text }}>{count}</span>
                    <span style={{ fontSize: 11, color: textMuted, minWidth: 36, textAlign: 'right' }}>{Math.round(count / total * 100)}%</span>
                  </div>
                </div>
                <div style={{ height: 7, background: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: (count / total * 100) + '%', background: p.color, borderRadius: 4, transition: 'width 1.2s ease' }} />
                </div>
              </div>
            )
          })}
          <div style={{ marginTop: 16, padding: '10px 14px', background: isDark ? 'rgba(3,193,245,0.08)' : '#f0fdff', borderRadius: 10, display: 'flex', justifyContent: 'space-between', border: '1px solid ' + (isDark ? 'rgba(3,193,245,0.15)' : '#bae6fd') }}>
            <span style={{ fontSize: 12, color: textSub }}>Revenue potential</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#03C1F5' }}>
              AED {(planDist.silver * 149 + planDist.gold * 349 + planDist.platinum * 699).toLocaleString()}/mo
            </span>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: text }}>Category Distribution</h3>
            <span style={{ fontSize: 11, color: textMuted, background: bgRow, padding: '3px 10px', borderRadius: 20, border: '1px solid ' + borderCol }}>Live companies</span>
          </div>
          {catDist.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <i className="ti ti-chart-donut" style={{ fontSize: 36, color: textMuted, display: 'block', marginBottom: 8 }} />
              <p style={{ color: textMuted, fontSize: 13 }}>No data yet</p>
            </div>
          ) : catDist.map(([cat, count], i) => (
            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: catColors[i], flexShrink: 0 }} />
              <span style={{ fontSize: 13, flex: 1, color: text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat}</span>
              <div style={{ width: 90, height: 6, background: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9', borderRadius: 3 }}>
                <div style={{ height: '100%', width: (count / Math.max(...catDist.map(c => c[1])) * 100) + '%', background: catColors[i], borderRadius: 3 }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: text, minWidth: 20, textAlign: 'right' }}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Row 4 — Recent Registrations + Top Rated */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: text }}>Recent Registrations</h3>
            <span style={{ background: isDark ? 'rgba(232,184,75,0.15)' : '#fef9e7', color: '#e8b84b', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>
              {recentRegs.filter(r => r.status === 'pending').length} pending
            </span>
          </div>
          {recentRegs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <i className="ti ti-clipboard-list" style={{ fontSize: 36, color: textMuted, display: 'block', marginBottom: 8 }} />
              <p style={{ color: textMuted, fontSize: 13 }}>No registrations yet</p>
            </div>
          ) : recentRegs.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid ' + borderCol }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: isDark ? 'rgba(3,193,245,0.15)' : '#e0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#03C1F5', flexShrink: 0 }}>
                {r.company_name?.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.company_name}</div>
                <div style={{ fontSize: 11, color: textSub }}>{r.category} · {r.area}</div>
              </div>
              <span style={{ background: r.status === 'pending' ? (isDark ? 'rgba(232,184,75,0.15)' : '#fef9e7') : (isDark ? 'rgba(30,142,62,0.15)' : '#e6f4ea'), color: r.status === 'pending' ? '#e8b84b' : '#1e8e3e', fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 8 }}>{r.status}</span>
            </div>
          ))}
        </div>

        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: text }}>Top Rated Companies</h3>
            <span style={{ fontSize: 11, color: textMuted, background: bgRow, padding: '3px 10px', borderRadius: 20, border: '1px solid ' + borderCol }}>By rating</span>
          </div>
          {topCompanies.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <i className="ti ti-trophy" style={{ fontSize: 36, color: textMuted, display: 'block', marginBottom: 8 }} />
              <p style={{ color: textMuted, fontSize: 13 }}>No companies yet</p>
            </div>
          ) : topCompanies.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid ' + borderCol }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: i === 0 ? (isDark ? 'rgba(232,184,75,0.2)' : '#fef9e7') : bgRow, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: i === 0 ? '#e8b84b' : textMuted, border: '1px solid ' + borderCol }}>
                {i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}>
                  {c.name}
                  {c.is_verified && <i className="ti ti-rosette-discount-check" style={{ fontSize: 14, color: '#1e8e3e' }} />}
                </div>
                <div style={{ fontSize: 11, color: textSub }}>{c.category} · {c.total_reviews || 0} reviews</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, background: isDark ? 'rgba(249,168,37,0.1)' : '#fef9e7', padding: '3px 8px', borderRadius: 8 }}>
                <span style={{ color: '#f9a825', fontSize: 12 }}>★</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#e8b84b' }}>{c.avg_rating || '0.0'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Latest Reviews */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: text }}>Latest Reviews</h3>
          <span style={{ fontSize: 11, color: textMuted, background: bgRow, padding: '3px 10px', borderRadius: 20, border: '1px solid ' + borderCol }}>Last 5</span>
        </div>
        {recentReviews.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <i className="ti ti-message" style={{ fontSize: 36, color: textMuted, display: 'block', marginBottom: 8 }} />
            <p style={{ color: textMuted, fontSize: 13 }}>No reviews yet</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
            {recentReviews.map(r => (
              <div key={r.id} style={{ background: bgRow, borderRadius: 12, padding: 14, border: '1px solid ' + borderCol }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ color: '#f9a825', fontSize: 13 }}>{'★'.repeat(r.rating)}<span style={{ color: borderCol }}>{'★'.repeat(5 - r.rating)}</span></span>
                  <span style={{ fontSize: 10, color: textMuted }}>{new Date(r.created_at).toLocaleDateString('en-AE', { month: 'short', day: 'numeric' })}</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: text, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.companies?.name || 'Unknown'}</div>
                <div style={{ fontSize: 11, color: textSub, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.5 }}>{r.review_text}</div>
                <div style={{ fontSize: 10, color: textMuted, marginTop: 8, paddingTop: 8, borderTop: '1px solid ' + borderCol }}>— {r.reviewer_name}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', marginTop: 20 }}>
        <button onClick={fetchAll} style={{ padding: '9px 22px', background: isDark ? 'rgba(3,193,245,0.1)' : '#f0fdff', border: '1px solid ' + (isDark ? 'rgba(3,193,245,0.2)' : '#bae6fd'), borderRadius: 20, fontSize: 12, color: '#03C1F5', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
          <i className="ti ti-refresh" style={{ fontSize: 14 }} /> Refresh Data
        </button>
      </div>
    </div>
  )
}
