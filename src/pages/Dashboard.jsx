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

function MiniSparkline({ data, color, height = 28 }) {
  if (!data || data.length < 2) {
    return (
      <svg width="80" height={height}>
        <line x1="0" y1={height/2} x2="80" y2={height/2} stroke={color} strokeWidth="1.5" opacity="0.3" strokeDasharray="3,2"/>
      </svg>
    )
  }
  const max = Math.max(...data), min = Math.min(...data), range = max - min || 1
  const w = 80
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${height - ((v - min) / range) * (height - 4) - 2}`).join(' ')
  return (
    <svg width={w} height={height} style={{ overflow: 'visible' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8"/>
      <circle cx={w} cy={height - ((data[data.length-1] - min) / range) * (height-4) - 2} r="2.5" fill={color}/>
    </svg>
  )
}

function CircularGauge({ value = 90 }) {
  const r = 35, cx = 45, cy = 45
  const circ = 2 * Math.PI * r
  const safe = (value / 100) * circ
  const warn = ((100 - value) * 0.6 / 100) * circ
  const viol = ((100 - value) * 0.4 / 100) * circ
  return (
    <svg width="90" height="90" viewBox="0 0 90 90">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8"/>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#4ade80" strokeWidth="8"
        strokeDasharray={`${safe} ${circ - safe}`} strokeDashoffset={circ * 0.25} strokeLinecap="round"/>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#fbbf24" strokeWidth="8"
        strokeDasharray={`${warn} ${circ - warn}`} strokeDashoffset={circ * 0.25 - safe} strokeLinecap="round"/>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f87171" strokeWidth="8"
        strokeDasharray={`${viol} ${circ - viol}`} strokeDashoffset={circ * 0.25 - safe - warn} strokeLinecap="round"/>
      <text x={cx} y={cy - 4} textAnchor="middle" fill="#4ade80" fontSize="14" fontWeight="700">{value}%</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="#374151" fontSize="7">Safe</text>
    </svg>
  )
}

export default function Dashboard({ setPage, setPlanFilter }) {
  const [stats,         setStats]         = useState({ companies:0, customers:0, reviews:0, trustScore:0, reports:0, verified:0, avgRating:'0.0' })
  const [planDist,      setPlanDist]      = useState({ free:0, silver:0, gold:0, platinum:0 })
  const [recentApps,    setRecentApps]    = useState([])
  const [topCompanies,  setTopCompanies]  = useState([])
  const [recentReviews, setRecentReviews] = useState([])
  const [activityData,  setActivityData]  = useState([])
  const [loading,       setLoading]       = useState(true)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    try {
      const [
        { count: totalCo },
        { count: totalRev },
        { count: totalCustomers },
        { count: verifiedCo },
        { count: pendingApps },
        { data: planData },
        { data: appsData },
        { data: topData },
        { data: revData },
        { data: ratData },
      ] = await Promise.all([
        supabase.from('companies').select('*', { count:'exact', head:true }).eq('status','approved'),
        supabase.from('reviews').select('*', { count:'exact', head:true }).eq('is_approved',true),
        supabase.from('customers').select('*', { count:'exact', head:true }),
        supabase.from('companies').select('*', { count:'exact', head:true }).eq('status','approved').eq('is_verified',true),
        supabase.from('company_applications').select('*', { count:'exact', head:true }).eq('status','pending'),
        supabase.from('companies').select('plan').eq('status','approved'),
        supabase.from('company_applications').select('*').order('submitted_at',{ ascending:false }).limit(5),
        supabase.from('companies').select('name,avg_rating,total_reviews,plan,area,category').eq('status','approved').order('avg_rating',{ ascending:false }).limit(5),
        supabase.from('reviews').select('id,reviewer_name,rating,review_text,created_at,companies(name)').eq('is_approved',true).order('created_at',{ ascending:false }).limit(5),
        supabase.from('reviews').select('rating').eq('is_approved',true),
      ])

      const avg = ratData?.length > 0
        ? (ratData.reduce((s,r) => s + r.rating, 0) / ratData.length).toFixed(1)
        : '0.0'

      const score = Math.min(100, Math.round(
        (verifiedCo / Math.max(totalCo, 1)) * 40 +
        (parseFloat(avg) / 5) * 40 +
        Math.min((totalRev || 0) / 100, 1) * 20
      ))

      setStats({
        companies:  totalCo || 0,
        customers:  totalCustomers || 0,
        reviews:    totalRev || 0,
        trustScore: score,
        reports:    pendingApps || 0,
        verified:   verifiedCo || 0,
        avgRating:  avg,
      })

      const dist = { free:0, silver:0, gold:0, platinum:0 }
      ;(planData || []).forEach(c => {
        const p = (c.plan || 'free').toLowerCase()
        if (dist[p] !== undefined) dist[p]++
        else dist.free++
      })
      setPlanDist(dist)
      setActivityData([2,5,3,8,6,12,9,15,11,18,14,20,16,22, totalCo || 1])
      setRecentApps(appsData || [])
      setTopCompanies(topData || [])
      setRecentReviews(revData || [])
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'80vh' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:36, height:36, border:'3px solid #4ade80', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 12px' }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ fontSize:13, color:'#374151' }}>Loading dashboard...</div>
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth:1300, color:'#f0fdf4' }}>

      {/* TOP BAR */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, paddingBottom:12, borderBottom:'0.5px solid rgba(255,255,255,0.07)' }}>
        <div style={{ flex:1, maxWidth:300, background:'#161b22', border:'0.5px solid rgba(255,255,255,0.08)', borderRadius:8, padding:'6px 12px', display:'flex', alignItems:'center', gap:7 }}>
          <i className="ti ti-search" style={{ fontSize:12, color:'#374151' }}/>
          <span style={{ fontSize:10, color:'#1f2937' }}>Search TrustDubai...</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ background:'#161b22', border:'0.5px solid rgba(255,255,255,0.07)', borderRadius:8, padding:'5px 10px', fontSize:9, color:'#4b5563', display:'flex', alignItems:'center', gap:5 }}>
            <i className="ti ti-calendar" style={{ fontSize:10 }}/>
            {new Date().toLocaleDateString('en-AE',{ month:'long', year:'numeric' })}
            <i className="ti ti-chevron-down" style={{ fontSize:9 }}/>
          </div>
          <div style={{ position:'relative' }}>
            <i className="ti ti-bell" style={{ fontSize:16, color:'#4b5563' }}/>
            <div style={{ position:'absolute', top:-2, right:-2, width:7, height:7, background:'#ef4444', borderRadius:'50%', border:'1.5px solid #0d1117' }}/>
          </div>
          <i className="ti ti-mail" style={{ fontSize:16, color:'#4b5563' }}/>
          <i className="ti ti-settings" style={{ fontSize:16, color:'#4b5563' }}/>
          <div style={{ display:'flex', alignItems:'center', gap:7, background:'#161b22', border:'0.5px solid rgba(255,255,255,0.07)', borderRadius:8, padding:'5px 10px' }}>
            <div style={{ width:22, height:22, borderRadius:'50%', background:'linear-gradient(135deg,#0f6e56,#1d9e75)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color:'#fff' }}>N</div>
            <div>
              <div style={{ fontSize:9, fontWeight:600, color:'#f0fdf4' }}>Nadeem Ali</div>
              <div style={{ fontSize:7.5, color:'#1d9e75' }}>Platform Lead</div>
            </div>
            <i className="ti ti-chevron-down" style={{ fontSize:10, color:'#374151' }}/>
          </div>
        </div>
      </div>

      {/* 5 STAT CARDS */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, marginBottom:14 }}>
        {[
          { label:'Total Customers',  value:stats.customers,  icon:'ti-users',          color:'#38bdf8', trend:[0,1,2,3,4,5],           change:'+0%',    page:'users' },
          { label:'Total Businesses', value:stats.companies,  icon:'ti-building-store', color:'#4ade80', trend:activityData,             change:'+1',     page:'companies' },
          { label:'Total Reviews',    value:stats.reviews,    icon:'ti-star',           color:'#fbbf24', trend:[0,0,0,0,0,0],            change:'+0%',    page:'reviews' },
          { label:'Trust Score',      value:stats.trustScore, icon:'ti-shield-check',   color:'#4ade80', trend:[10,15,20,25,28,stats.trustScore], change:'trend ↗', page:'trust_score', isScore:true },
          { label:'Active Reports',   value:stats.reports,    icon:'ti-flag',           color:'#f87171', trend:[3,2,4,3,2,stats.reports], change:'-0%',   page:'reports' },
        ].map((card,i) => (
          <div key={i}
            onClick={() => setPage && setPage(card.page)}
            style={{ background:'#161b22', border:'0.5px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'12px 14px', cursor:'pointer', transition:'all 0.15s', position:'relative', overflow:'hidden' }}
            onMouseEnter={e=>{ e.currentTarget.style.borderColor=card.color+'44'; e.currentTarget.style.transform='translateY(-1px)' }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor='rgba(255,255,255,0.07)'; e.currentTarget.style.transform='none' }}
          >
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <div style={{ width:32, height:32, borderRadius:8, background:card.color+'18', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <i className={`ti ${card.icon}`} style={{ fontSize:15, color:card.color }}/>
              </div>
              <span style={{ fontSize:8.5, color: i===1||i===3?'#4ade80': i===4?'#f87171':'#374151', fontWeight:600 }}>{card.change}</span>
            </div>
            <div style={{ fontSize:8.5, color:'#374151', marginBottom:4 }}>{card.label}</div>
            <div style={{ fontSize:20, fontWeight:700, color:'#f0fdf4', lineHeight:1, marginBottom:6 }}>
              {card.isScore
                ? <>{card.value}<span style={{ fontSize:11, color:'#374151' }}>/100</span></>
                : <AnimatedNumber value={card.value}/>
              }
            </div>
            <MiniSparkline data={card.trend} color={card.color} height={28}/>
          </div>
        ))}
      </div>

      {/* ACTIVITY CHART + REVIEW MOD STATUS */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 240px', gap:10, marginBottom:10 }}>

        <div style={{ background:'#161b22', border:'0.5px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'12px 14px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <span style={{ fontSize:10, fontWeight:700, color:'#f0fdf4', letterSpacing:'0.04em', textTransform:'uppercase' }}>Platform Activity Overview</span>
            <div style={{ display:'flex', gap:12 }}>
              {[['#38bdf8','Customers',stats.customers],['#4ade80','Reviews',stats.reviews],['#fbbf24','Businesses',stats.companies],['#f87171','Reports',stats.reports]].map(([c,l,v]) => (
                <div key={l} style={{ display:'flex', alignItems:'center', gap:4, fontSize:8.5, color:'#6b7280' }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:c }}/>
                  {l} <span style={{ color:c, fontWeight:600 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ position:'relative', height:110 }}>
            <div style={{ position:'absolute', left:0, top:0, bottom:18, display:'flex', flexDirection:'column', justifyContent:'space-between', width:24 }}>
              {['100','50','0'].map(l => <span key={l} style={{ fontSize:7, color:'#1f2937' }}>{l}</span>)}
            </div>
            <div style={{ position:'absolute', left:26, right:0, top:0, bottom:18 }}>
              <svg width="100%" height="100%" viewBox="0 0 500 92" preserveAspectRatio="none">
                {[0,46,92].map(y => <line key={y} x1="0" y1={y} x2="500" y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="0.5"/>)}
                <path d="M0,90 50,88 100,86 150,80 200,72 250,65 300,55 350,45 400,38 450,30 500,22 L500,92 L0,92 Z" fill="rgba(74,222,128,0.05)"/>
                <polyline points="0,90 50,88 100,86 150,80 200,72 250,65 300,55 350,45 400,38 450,30 500,22" fill="none" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="0,91 500,91" fill="none" stroke="#fbbf24" strokeWidth="1" strokeLinecap="round" strokeDasharray="3,2"/>
                <polyline points="0,91 500,91" fill="none" stroke="#38bdf8" strokeWidth="1" strokeLinecap="round" strokeDasharray="2,3"/>
                <polyline points="0,88 50,87 100,88 150,86 200,87 250,85 300,86 350,84 400,85 450,83 500,82" fill="none" stroke="#f87171" strokeWidth="1" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={{ position:'absolute', left:26, right:0, bottom:0, display:'flex', justifyContent:'space-between' }}>
              {['May 01','May 08','May 15','May 22','May 30'].map(l => <span key={l} style={{ fontSize:7, color:'#1f2937' }}>{l}</span>)}
            </div>
          </div>
        </div>

        <div style={{ background:'#161b22', border:'0.5px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'12px 14px' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#f0fdf4', letterSpacing:'0.04em', textTransform:'uppercase', marginBottom:10 }}>Review Mod. Status</div>
          <div style={{ display:'flex', justifyContent:'center', marginBottom:8 }}>
            <CircularGauge value={stats.reviews > 0 ? 90 : 100}/>
          </div>
          <div style={{ display:'flex', justifyContent:'space-around', marginBottom:10 }}>
            {[['5%','#fbbf24','Warnings'],['2%','#f87171','Violations'],['3%','#374151','Flagged']].map(([v,c,l]) => (
              <div key={l} style={{ textAlign:'center' }}>
                <div style={{ fontSize:11, fontWeight:700, color:c }}>{v}</div>
                <div style={{ fontSize:7.5, color:'#374151' }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ borderTop:'0.5px solid rgba(255,255,255,0.06)', paddingTop:8 }}>
            {[['Reviews Scanned',stats.reviews,'#f0fdf4'],['Auto-Flagged',0,'#fbbf24'],['Auto-Removed',0,'#f87171']].map(([l,v,c]) => (
              <div key={l} style={{ display:'flex', justifyContent:'space-between', fontSize:8.5, marginBottom:4 }}>
                <span style={{ color:'#374151' }}>{l}</span>
                <span style={{ color:c, fontWeight:600 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* 4 ACTION CARDS */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:10 }}>
        {[
          { label:'Pending Verifications', icon:'ti-shield-check',   color:'#4ade80', value:stats.reports, action:'applications' },
          { label:'Moderation Queue',      icon:'ti-stack',          color:'#38bdf8', value:0, sub:'items' },
          { label:'Open Disputes',         icon:'ti-message-report', color:'#f87171', value:0, action:'disputes' },
          { label:'System Alerts',         icon:'ti-alert-triangle', color:'#fbbf24', value:null, critical:0, warning:1 },
        ].map((card,i) => (
          <div key={i}
            onClick={() => card.action && setPage && setPage(card.action)}
            style={{ background:'#161b22', border:`0.5px solid ${card.color}33`, borderRadius:10, padding:'12px 14px', cursor:card.action?'pointer':'default', display:'flex', alignItems:'center', justifyContent:'space-between', transition:'all 0.15s' }}
            onMouseEnter={e=>{ if(card.action) e.currentTarget.style.borderColor=card.color+'66' }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor=card.color+'33' }}
          >
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5 }}>
                <i className={`ti ${card.icon}`} style={{ fontSize:13, color:card.color }}/>
                <span style={{ fontSize:9, color:card.color }}>{card.label}</span>
              </div>
              {card.value !== null ? (
                <div style={{ fontSize:22, fontWeight:700, color:'#f0fdf4' }}>
                  <AnimatedNumber value={card.value}/>
                  {card.sub && <span style={{ fontSize:10, color:'#374151', marginLeft:4 }}>{card.sub}</span>}
                </div>
              ) : (
                <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
                  <span style={{ fontSize:22, fontWeight:700, color:'#f87171' }}>{card.critical}</span>
                  <span style={{ fontSize:9, color:'#374151' }}>Critical</span>
                  <span style={{ fontSize:18, fontWeight:700, color:'#fbbf24' }}>{card.warning}</span>
                  <span style={{ fontSize:9, color:'#374151' }}>Warning</span>
                </div>
              )}
            </div>
            <div style={{ background:card.color+'18', color:card.color, fontSize:13, fontWeight:700, padding:'6px 10px', borderRadius:7 }}>
              {card.value !== null ? card.value : card.critical + card.warning}
            </div>
          </div>
        ))}
      </div>

      {/* VERIFICATION TABLE + PLATFORM HEALTH */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>

        <div style={{ background:'#161b22', border:'0.5px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'12px 14px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <span style={{ fontSize:10, fontWeight:700, color:'#f0fdf4', letterSpacing:'0.04em', textTransform:'uppercase' }}>Verification Requests</span>
            <span onClick={() => setPage && setPage('applications')} style={{ fontSize:8, color:'#0099cc', cursor:'pointer' }}>Table →</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 80px 70px 70px', gap:8, padding:'5px 10px', borderBottom:'0.5px solid rgba(255,255,255,0.08)', fontSize:8.5, fontWeight:700, color:'#1f2937', letterSpacing:'0.05em', textTransform:'uppercase' }}>
            <span>Business</span><span>Category</span><span>Date</span><span>Status</span>
          </div>
          {recentApps.length === 0 ? (
            <div style={{ textAlign:'center', padding:'20px 0', fontSize:11, color:'#1f2937' }}>No applications yet</div>
          ) : recentApps.slice(0,4).map((app,i) => (
            <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 80px 70px 70px', gap:8, padding:'7px 10px', borderBottom:'0.5px solid rgba(255,255,255,0.04)', fontSize:9, color:'#6b7280', alignItems:'center' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ width:22, height:22, borderRadius:6, background:'rgba(56,189,248,0.12)', color:'#38bdf8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, fontWeight:700, flexShrink:0 }}>
                  {(app.company_name||'?')[0].toUpperCase()}
                </div>
                <span style={{ color:'#d1d5db', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{app.company_name||'Unknown'}</span>
              </div>
              <span>{app.category||'—'}</span>
              <span>{app.submitted_at ? new Date(app.submitted_at).toLocaleDateString('en-AE',{ month:'short', day:'numeric' }) : '—'}</span>
              <span style={{ background: app.status==='approved'?'rgba(74,222,128,0.12)': app.status==='rejected'?'rgba(248,113,113,0.12)':'rgba(251,191,36,0.12)', color: app.status==='approved'?'#4ade80': app.status==='rejected'?'#f87171':'#fbbf24', padding:'2px 6px', borderRadius:99, fontSize:8, fontWeight:700, display:'inline-block' }}>
                {app.status||'Pending'}
              </span>
            </div>
          ))}
        </div>

        <div style={{ background:'#161b22', border:'0.5px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'12px 14px' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#f0fdf4', letterSpacing:'0.04em', textTransform:'uppercase', marginBottom:10 }}>Platform Health Monitor</div>
          {[
            { label:'Supabase DB',    status:'Online 99.9%', color:'#4ade80', pct:99 },
            { label:'Auth Service',   status:'Stable 8ms',   color:'#4ade80', pct:96 },
            { label:'Storage',        status:'12% Used',     color:'#fbbf24', pct:12 },
            { label:'Edge Functions', status:'Active 12ms',  color:'#4ade80', pct:98 },
            { label:'Vercel CDN',     status:'Optimized',    color:'#4ade80', pct:100 },
          ].map(h => (
            <div key={h.label} style={{ marginBottom:9 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                <span style={{ fontSize:9.5, color:'#6b7280' }}>{h.label}</span>
                <span style={{ fontSize:9, color:h.color, fontWeight:600 }}>{h.status}</span>
              </div>
              <div style={{ height:3, background:'rgba(255,255,255,0.06)', borderRadius:99, overflow:'hidden' }}>
                <div style={{ height:'100%', width:h.pct+'%', background:h.color, borderRadius:99 }}/>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* REVIEW MODERATION QUEUE */}
      <div style={{ background:'#161b22', border:'0.5px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'12px 14px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
          <span style={{ fontSize:10, fontWeight:700, color:'#f0fdf4', letterSpacing:'0.04em', textTransform:'uppercase' }}>Review Moderation Queue</span>
          <span onClick={() => setPage && setPage('reviews')} style={{ fontSize:8, color:'#0099cc', cursor:'pointer' }}>View all →</span>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 100px 90px 80px 100px', gap:8, padding:'5px 10px', borderBottom:'0.5px solid rgba(255,255,255,0.08)', fontSize:8.5, fontWeight:700, color:'#1f2937', letterSpacing:'0.05em', textTransform:'uppercase' }}>
          <span>Content Preview</span><span>Author</span><span>AI Confidence</span><span>Type</span><span>Actions</span>
        </div>
        {recentReviews.length === 0 ? (
          <div style={{ padding:'16px 10px', fontSize:9, color:'#1f2937' }}>No reviews in moderation queue.</div>
        ) : recentReviews.slice(0,3).map((r,i) => (
          <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 100px 90px 80px 100px', gap:8, padding:'7px 10px', borderBottom:'0.5px solid rgba(255,255,255,0.04)', fontSize:9, color:'#6b7280', alignItems:'center' }}>
            <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'#9ca3af' }}>
              {(r.review_text||'').slice(0,50)}...
            </span>
            <span>@{(r.reviewer_name||'anon').replace(/\s/g,'').toLowerCase()}</span>
            <div>
              <div style={{ fontSize:9, color:'#4ade80', marginBottom:2 }}>94%</div>
              <div style={{ height:4, background:'rgba(255,255,255,0.06)', borderRadius:99, overflow:'hidden' }}>
                <div style={{ width:'94%', height:'100%', background:'#4ade80', borderRadius:99 }}/>
              </div>
            </div>
            <span style={{ background:'rgba(74,222,128,0.1)', color:'#4ade80', padding:'1px 5px', borderRadius:4, fontSize:8, fontWeight:600 }}>Safe</span>
            <div style={{ display:'flex', gap:4 }}>
              <span style={{ background:'rgba(74,222,128,0.12)', color:'#4ade80', borderRadius:4, padding:'2px 7px', fontSize:8, fontWeight:600, cursor:'pointer' }}>Approve</span>
              <span style={{ background:'rgba(239,68,68,0.1)', color:'#f87171', borderRadius:4, padding:'2px 7px', fontSize:8, fontWeight:600, cursor:'pointer' }}>Reject</span>
            </div>
          </div>
        ))}
      </div>

      {/* REFRESH */}
      <div style={{ textAlign:'center', marginTop:14 }}>
        <button onClick={fetchAll}
          style={{ padding:'8px 20px', background:'rgba(74,222,128,0.08)', border:'0.5px solid rgba(74,222,128,0.2)', borderRadius:20, fontSize:11, color:'#4ade80', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6, fontWeight:500 }}>
          <i className="ti ti-refresh" style={{ fontSize:13 }}/> Refresh Data
        </button>
      </div>

    </div>
  )
}
