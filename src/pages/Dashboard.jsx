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
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const w = 80, h = 32
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ')
  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={(data.length - 1) / (data.length - 1) * w} cy={h - ((data[data.length - 1] - min) / range) * h} r="3" fill={color} />
    </svg>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState({ total: 0, approved: 0, verified: 0, premium: 0, today: 0, thisMonth: 0, reviews: 0, employees: 0, avgRating: 0 })
  const [planDist, setPlanDist] = useState({ Free: 0, Silver: 0, Gold: 0, Platinum: 0 })
  const [catDist, setCatDist] = useState([])
  const [recentRegs, setRecentRegs] = useState([])
  const [recentReviews, setRecentReviews] = useState([])
  const [topCompanies, setTopCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    fetchAll()
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  async function fetchAll() {
    setLoading(true)
    const [statsRes, plansRes, catsRes, regsRes, reviewsRes, topRes, empRes] = await Promise.all([
      supabase.rpc('exec_sql', { sql: 'SELECT 1' }).catch(() => null),
      supabase.from('companies').select('plan_name, is_verified, avg_rating, total_reviews'),
      supabase.from('companies').select('category').eq('status', 'approved'),
      supabase.from('company_registrations').select('*').order('submitted_at', { ascending: false }).limit(5),
      supabase.from('reviews').select('*, companies(name)').order('created_at', { ascending: false }).limit(5),
      supabase.from('companies').select('name, avg_rating, total_reviews, category, is_verified').eq('status', 'approved').order('avg_rating', { ascending: false }).limit(5),
      supabase.from('employees').select('id', { count: 'exact', head: true }),
    ])

    const companies = plansRes.data || []
    const today = new Date().toDateString()
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
      approved: companies.filter(c => c).length,
      verified: companies.filter(c => c.is_verified).length,
      premium: companies.filter(c => c.plan_name && c.plan_name !== 'Free').length,
      today: todayRes.count || 0,
      thisMonth: monthRes.count || 0,
      reviews: ratings.length,
      employees: empRes.count || 0,
      avgRating
    })

    const dist = { Free: 0, Silver: 0, Gold: 0, Platinum: 0 }
    companies.forEach(c => { const p = c.plan_name || 'Free'; if (dist[p] !== undefined) dist[p]++ })
    setPlanDist(dist)

    const cats = {}
    ;(catsRes.data || []).forEach(c => { cats[c.category] = (cats[c.category] || 0) + 1 })
    setCatDist(Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 6))

    setRecentRegs(regsRes.data || [])
    setRecentReviews(reviewsRes.data || [])
    setTopCompanies(topRes.data || [])
    setLoading(false)
  }

  const planColors = { Free: '#888', Silver: '#9e9e9e', Gold: '#f9a825', Platinum: '#9c27b0' }
  const planBgs = { Free: 'rgba(136,136,136,0.1)', Silver: 'rgba(158,158,158,0.1)', Gold: 'rgba(249,168,37,0.1)', Platinum: 'rgba(156,39,176,0.1)' }
  const totalPlan = Object.values(planDist).reduce((a, b) => a + b, 0) || 1

  const catColors = ['#1a73e8','#1e8e3e','#f9a825','#d93025','#9c27b0','#00897b']

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⟳</div>
        <div style={{ fontSize: 14, color: 'var(--text2)' }}>Loading dashboard...</div>
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth: 1200 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--text)' }}>Platform Dashboard</h1>
          <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>
            {new Date().toLocaleDateString('en-AE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 28, fontWeight: 300, color: 'var(--primary)', fontVariantNumeric: 'tabular-nums', letterSpacing: 1 }}>
            {time.toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Dubai Time (GMT+4)</div>
        </div>
      </div>

      {/* Row 1 — Primary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Total Companies', value: stats.total, icon: 'ti-building', color: '#1a73e8', bg: '#e8f0fe', sub: `${stats.today} added today`, trend: [0, stats.thisMonth * 0.3, stats.thisMonth * 0.6, stats.thisMonth * 0.8, stats.thisMonth] },
          { label: 'Verified Companies', value: stats.verified, icon: 'ti-shield-check', color: '#1e8e3e', bg: '#e6f4ea', sub: `${stats.total ? Math.round(stats.verified / stats.total * 100) : 0}% of total` },
          { label: 'Premium Members', value: stats.premium, icon: 'ti-diamond', color: '#9c27b0', bg: '#f3e5f5', sub: `${stats.total ? Math.round(stats.premium / stats.total * 100) : 0}% conversion` },
          { label: 'Platform Rating', value: stats.avgRating, icon: 'ti-star', color: '#f9a825', bg: '#fef9e7', sub: `${stats.reviews} total reviews`, isRating: true },
        ].map((card, i) => (
          <div key={i} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: 18, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, right: 0, width: 80, height: 80, background: card.bg, borderRadius: '0 14px 0 80px', opacity: 0.5 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className={`ti ${card.icon}`} style={{ fontSize: 20, color: card.color }} />
              </div>
              {card.trend && <MiniSparkline data={card.trend} color={card.color} />}
            </div>
            <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--text)', lineHeight: 1 }}>
              {card.isRating ? card.value : <AnimatedNumber value={card.value} />}
              {card.isRating && <span style={{ fontSize: 14, color: '#f9a825', marginLeft: 4 }}>★</span>}
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginTop: 4 }}>{card.label}</div>
            <div style={{ fontSize: 11, color: card.color, marginTop: 3 }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Row 2 — Secondary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Added Today', value: stats.today, icon: 'ti-calendar-plus', color: '#1a73e8' },
          { label: 'This Month', value: stats.thisMonth, icon: 'ti-trending-up', color: '#1e8e3e' },
          { label: 'Total Reviews', value: stats.reviews, icon: 'ti-message', color: '#d93025' },
          { label: 'Employees', value: stats.employees, icon: 'ti-users', color: '#00897b' },
        ].map((card, i) => (
          <div key={i} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
              <i className={`ti ${card.icon}`} style={{ fontSize: 18, color: card.color }} />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 600 }}><AnimatedNumber value={card.value} /></div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Row 3 — Plan Distribution + Category Distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Plan Distribution */}
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600 }}>Plan Distribution</h3>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>{stats.total} total</span>
          </div>
          {Object.entries(planDist).map(([plan, count]) => (
            <div key={plan} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: planColors[plan] }} />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{plan}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{count}</span>
                  <span style={{ fontSize: 11, color: 'var(--text3)', width: 36, textAlign: 'right' }}>{Math.round(count / totalPlan * 100)}%</span>
                </div>
              </div>
              <div style={{ height: 8, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${count / totalPlan * 100}%`, background: planColors[plan], borderRadius: 4, transition: 'width 1s ease' }} />
              </div>
            </div>
          ))}
          <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--bg)', borderRadius: 8, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>Revenue potential</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)' }}>
              AED {(planDist.Silver * 199 + planDist.Gold * 399 + planDist.Platinum * 699).toLocaleString()}/mo
            </span>
          </div>
        </div>

        {/* Category Distribution */}
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600 }}>Category Distribution</h3>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>Live companies</span>
          </div>
          {catDist.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: 20 }}>No data yet</p>
          ) : catDist.map(([cat, count], i) => (
            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: catColors[i], flexShrink: 0 }} />
              <span style={{ fontSize: 13, flex: 1, color: 'var(--text)' }}>{cat}</span>
              <div style={{ width: 80, height: 6, background: 'var(--bg)', borderRadius: 3 }}>
                <div style={{ height: '100%', width: `${count / Math.max(...catDist.map(c => c[1])) * 100}%`, background: catColors[i], borderRadius: 3 }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', minWidth: 20, textAlign: 'right' }}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Row 4 — Recent Activity + Top Companies */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Recent Registrations */}
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600 }}>Recent Registrations</h3>
            <span style={{ background: recentRegs.filter(r => r.status === 'pending').length > 0 ? '#fef9e7' : 'var(--green-light)', color: recentRegs.filter(r => r.status === 'pending').length > 0 ? '#f9a825' : 'var(--green)', fontSize: 11, padding: '2px 8px', borderRadius: 10 }}>
              {recentRegs.filter(r => r.status === 'pending').length} pending
            </span>
          </div>
          {recentRegs.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: 20 }}>No registrations yet</p>
          ) : recentRegs.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: 'var(--primary)', flexShrink: 0 }}>
                {r.company_name?.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.company_name}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{r.category} · {r.area}</div>
              </div>
              <span style={{ background: r.status === 'pending' ? '#fef9e7' : 'var(--green-light)', color: r.status === 'pending' ? '#f9a825' : 'var(--green)', fontSize: 10, padding: '2px 7px', borderRadius: 8, flexShrink: 0 }}>
                {r.status}
              </span>
            </div>
          ))}
        </div>

        {/* Top Rated Companies */}
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600 }}>Top Rated Companies</h3>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>By rating</span>
          </div>
          {topCompanies.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: 20 }}>No companies yet</p>
          ) : topCompanies.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: i === 0 ? '#fef9e7' : i === 1 ? 'var(--bg)' : 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: i === 0 ? '#f9a825' : 'var(--text3)', flexShrink: 0 }}>
                {i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}>
                  {c.name}
                  {c.is_verified && (
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                      <rect x="3" y="3" width="14" height="14" rx="3" transform="rotate(45 10 10)" fill="#1e8e3e"/>
                      <path d="M6.5 10L8.8 12.3L13.5 7.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{c.category} · {c.total_reviews || 0} reviews</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                <span style={{ color: '#f9a825', fontSize: 13 }}>★</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{c.avg_rating || '0.0'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Row 5 — Recent Reviews */}
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600 }}>Latest Reviews</h3>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>Last 5</span>
        </div>
        {recentReviews.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: 20 }}>No reviews yet</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
            {recentReviews.map(r => (
              <div key={r.id} style={{ background: 'var(--bg)', borderRadius: 10, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#f9a825', fontSize: 14 }}>{'★'.repeat(r.rating)}<span style={{ color: 'var(--border)' }}>{'★'.repeat(5 - r.rating)}</span></span>
                  <span style={{ fontSize: 10, color: 'var(--text3)' }}>{new Date(r.created_at).toLocaleDateString('en-AE', { month: 'short', day: 'numeric' })}</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.companies?.name || 'Unknown'}</div>
                <div style={{ fontSize: 11, color: 'var(--text2)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{r.review_text}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 6 }}>— {r.reviewer_name}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Refresh button */}
      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <button onClick={fetchAll} style={{ padding: '8px 20px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 20, fontSize: 12, color: 'var(--text2)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <i className="ti ti-refresh" style={{ fontSize: 14 }} /> Refresh Data
        </button>
      </div>
    </div>
  )
}
