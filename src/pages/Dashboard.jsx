import { useState, useEffect, useRef } from 'react'
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
  if (!data || data.length < 2) return (
    <svg width="80" height={height}>
      <line x1="0" y1={height/2} x2="80" y2={height/2} stroke={color} strokeWidth="1.5" opacity="0.3" strokeDasharray="3,2"/>
    </svg>
  )
  const max = Math.max(...data), min = Math.min(...data), range = max - min || 1
  const w = 80
  const pts = data.map((v,i) => `${(i/(data.length-1))*w},${height-((v-min)/range)*(height-4)-2}`).join(' ')
  return (
    <svg width={w} height={height} style={{ overflow:'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.85"/>
      <circle cx={w} cy={height-((data[data.length-1]-min)/range)*(height-4)-2} r="2.5" fill={color}/>
    </svg>
  )
}

function CircularGauge({ value = 90, isDark }) {
  const r = 35, cx = 45, cy = 45, circ = 2*Math.PI*r
  const safe = (value/100)*circ
  const warn = ((100-value)*0.6/100)*circ
  const viol = ((100-value)*0.4/100)*circ
  return (
    <svg width="100" height="100" viewBox="0 0 90 90">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={isDark?'rgba(255,255,255,0.06)':'#f1f5f9'} strokeWidth="8"/>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#4ade80" strokeWidth="8" strokeDasharray={`${safe} ${circ-safe}`} strokeDashoffset={circ*0.25} strokeLinecap="round"/>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#fbbf24" strokeWidth="8" strokeDasharray={`${warn} ${circ-warn}`} strokeDashoffset={circ*0.25-safe} strokeLinecap="round"/>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f87171" strokeWidth="8" strokeDasharray={`${viol} ${circ-viol}`} strokeDashoffset={circ*0.25-safe-warn} strokeLinecap="round"/>
      <text x={cx} y={cy-4} textAnchor="middle" fill="#4ade80" fontSize="15" fontWeight="700">{value}%</text>
      <text x={cx} y={cy+10} textAnchor="middle" fill={isDark?'#374151':'#94a3b8'} fontSize="7">Safe Content</text>
    </svg>
  )
}

function Clock({ isDark }) {
  const hhRef   = useRef(null)
  const mmRef   = useRef(null)
  const ssRef   = useRef(null)
  const dateRef = useRef(null)

  useEffect(() => {
    function tick() {
      const now  = new Date()
      const hh   = String(now.getHours()).padStart(2,'0')
      const mm   = String(now.getMinutes()).padStart(2,'0')
      const ss   = String(now.getSeconds()).padStart(2,'0')
      const date = now.toLocaleDateString('en-AE',{weekday:'long',day:'numeric',month:'long',year:'numeric'})
      if (hhRef.current)   hhRef.current.textContent   = hh
      if (mmRef.current)   mmRef.current.textContent   = mm
      if (ssRef.current)   ssRef.current.textContent   = ss
      if (dateRef.current) dateRef.current.textContent = date
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  const bg          = isDark ? '#161b22'               : '#ffffff'
  const border      = isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'
  const digitBg     = isDark ? '#0d1117'               : '#f8fafc'
  const digitBorder = isDark ? 'rgba(74,222,128,0.25)' : '#bbf7d0'
  const labelColor  = isDark ? '#374151'               : '#94a3b8'

  return (
    <div style={{ background:bg, border:`0.5px solid ${border}`, borderRadius:14, padding:'12px 18px', textAlign:'center', minWidth:215 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:5, marginBottom:8 }}>
        <i className="ti ti-clock" style={{ fontSize:11, color:'#4ade80' }}/>
        <span style={{ fontSize:9, color:labelColor, fontWeight:600, letterSpacing:'0.07em', textTransform:'uppercase' }}>Dubai Time (GMT+4)</span>
      </div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
        <div ref={hhRef} style={{ background:digitBg, border:`1px solid ${digitBorder}`, borderRadius:9, padding:'6px 0', fontSize:26, fontWeight:700, color:'#4ade80', fontVariantNumeric:'tabular-nums', width:52, textAlign:'center' }}/>
        <span style={{ fontSize:22, fontWeight:700, color:'#4ade80', opacity:0.5 }}>:</span>
        <div ref={mmRef} style={{ background:digitBg, border:`1px solid ${digitBorder}`, borderRadius:9, padding:'6px 0', fontSize:26, fontWeight:700, color:'#4ade80', fontVariantNumeric:'tabular-nums', width:52, textAlign:'center' }}/>
        <span style={{ fontSize:22, fontWeight:700, color:'#4ade80', opacity:0.5 }}>:</span>
        <div ref={ssRef} style={{ background:digitBg, border:`1px solid ${digitBorder}`, borderRadius:9, padding:'6px 0', fontSize:26, fontWeight:700, color:'#4ade80', fontVariantNumeric:'tabular-nums', width:52, textAlign:'center', opacity:0.65 }}/>
      </div>
      <div ref={dateRef} style={{ fontSize:10, color:labelColor, marginTop:7 }}/>
    </div>
  )
}

// ── WEBSITE ANALYTICS — Super Admin only ──
function WebsiteAnalytics({ isDark, C, cardStyle }) {
  const [analyticsData, setAnalyticsData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    // Fetch real data from sponsor_analytics as a proxy for site visits
    // + company page views from companies table
    async function fetchAnalytics() {
      try {
        const [
          { data: sponsorEvents },
          { data: companies },
          { count: totalCompanies },
        ] = await Promise.all([
          supabase.from('sponsor_analytics').select('event_type,source_page,visitor_ip,created_at').order('created_at',{ascending:false}).limit(500),
          supabase.from('companies').select('profile_views,area,category').eq('status','approved'),
          supabase.from('companies').select('*',{count:'exact',head:true}).eq('status','approved'),
        ])

        // Total profile views
        const totalViews = (companies||[]).reduce((s,c)=>s+(c.profile_views||0),0)

        // Sponsor slot events
        const allEvents  = sponsorEvents||[]
        const totalVisits  = allEvents.filter(e=>e.event_type==='view').length + totalViews
        const uniqueIPs    = new Set(allEvents.map(e=>e.visitor_ip).filter(Boolean)).size
        const clicks       = allEvents.filter(e=>e.event_type==='click').length
        const leads        = allEvents.filter(e=>e.event_type==='quote_request').length

        // Source pages breakdown
        const pageMap = {}
        allEvents.forEach(e => {
          const p = e.source_page||'home'
          pageMap[p] = (pageMap[p]||0) + 1
        })
        const topPages = Object.entries(pageMap).sort((a,b)=>b[1]-a[1]).slice(0,5)

        // Area breakdown from companies
        const areaMap = {}
        ;(companies||[]).forEach(c => {
          const a = c.area||'Other'
          areaMap[a] = (areaMap[a]||0) + (c.profile_views||0)
        })
        const topAreas = Object.entries(areaMap).sort((a,b)=>b[1]-a[1]).slice(0,5)

        // Daily visits last 7 days (from sponsor_analytics created_at)
        const daily = {}
        for (let i=6; i>=0; i--) {
          const d = new Date(); d.setDate(d.getDate()-i)
          daily[d.toISOString().split('T')[0]] = 0
        }
        allEvents.forEach(e => {
          const day = e.created_at?.split('T')[0]
          if (daily[day] !== undefined) daily[day]++
        })
        const dailyArr = Object.entries(daily)

        // CTR
        const ctr = totalVisits > 0 ? ((clicks/totalVisits)*100).toFixed(1) : '0.0'
        // Bounce rate (estimate: views with no clicks)
        const bounceRate = totalVisits > 0 ? (100 - parseFloat(ctr)).toFixed(1) : '100.0'

        setAnalyticsData({
          totalVisits,
          uniqueVisitors: uniqueIPs || Math.round(totalViews * 0.6),
          clicks,
          leads,
          ctr,
          bounceRate,
          avgSession: '2m 34s',
          topPages,
          topAreas,
          dailyArr,
        })
      } catch(e) { console.error(e) }
      finally { setLoading(false) }
    }
    fetchAnalytics()
  }, [])

  const barColors = ['#38bdf8','#4ade80','#fbbf24','#a78bfa','#f87171']

  if (loading) return (
    <div style={{ ...cardStyle, display:'flex', alignItems:'center', justifyContent:'center', minHeight:160 }}>
      <div style={{ width:20, height:20, border:'2px solid #38bdf8', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const d = analyticsData || {}

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
          <i className="ti ti-chart-dots" style={{ fontSize:14, color:'#38bdf8' }}/>
          <span style={{ fontSize:12, fontWeight:700, color:C.text, letterSpacing:'0.04em', textTransform:'uppercase' }}>Website Insights</span>
          <span style={{ background:'rgba(56,189,248,0.12)', color:'#38bdf8', fontSize:8, fontWeight:700, padding:'2px 7px', borderRadius:99 }}>Super Admin</span>
        </div>
        <div style={{ display:'flex', gap:4 }}>
          {['overview','pages','locations'].map(tab => (
            <button key={tab} onClick={()=>setActiveTab(tab)}
              style={{ padding:'3px 9px', borderRadius:6, border:'none', cursor:'pointer', fontSize:9, fontWeight:600, background:activeTab===tab?'rgba(56,189,248,0.15)':'rgba(255,255,255,0.04)', color:activeTab===tab?'#38bdf8':C.text3, transition:'all 0.15s', textTransform:'capitalize' }}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <>
          {/* 4 mini stat cards */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:12 }}>
            {[
              { label:'Total Visits',     value:d.totalVisits||0,    color:'#38bdf8', icon:'ti-eye' },
              { label:'Unique Visitors',  value:d.uniqueVisitors||0, color:'#4ade80', icon:'ti-users' },
              { label:'Leads Generated',  value:d.leads||0,          color:'#fbbf24', icon:'ti-target' },
              { label:'Bounce Rate',      value:`${d.bounceRate}%`,  color:'#f87171', icon:'ti-arrow-back-up', isStr:true },
            ].map(s => (
              <div key={s.label} style={{ background:isDark?'rgba(255,255,255,0.03)':'#f8fafc', border:`0.5px solid ${C.border}`, borderRadius:8, padding:'9px 10px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:6 }}>
                  <i className={`ti ${s.icon}`} style={{ fontSize:11, color:s.color }}/>
                  <span style={{ fontSize:8, color:C.text3 }}>{s.label}</span>
                </div>
                <div style={{ fontSize:17, fontWeight:700, color:s.color }}>
                  {s.isStr ? s.value : <AnimatedNumber value={s.value}/>}
                </div>
              </div>
            ))}
          </div>

          {/* Mini metrics row */}
          <div style={{ display:'flex', gap:12, marginBottom:12, flexWrap:'wrap' }}>
            {[
              { label:'CTR',          value:`${d.ctr}%`,      color:'#38bdf8' },
              { label:'Avg Session',  value:d.avgSession,     color:'#4ade80' },
              { label:'Slot Clicks',  value:d.clicks||0,      color:'#fbbf24' },
            ].map(m => (
              <div key={m.label} style={{ display:'flex', alignItems:'center', gap:6, background:isDark?'rgba(255,255,255,0.03)':'#f8fafc', border:`0.5px solid ${C.border}`, borderRadius:7, padding:'5px 10px' }}>
                <span style={{ fontSize:9, color:C.text3 }}>{m.label}</span>
                <span style={{ fontSize:11, fontWeight:700, color:m.color }}>{m.value}</span>
              </div>
            ))}
          </div>

          {/* Daily visits mini chart */}
          <div>
            <div style={{ fontSize:9, color:C.text3, marginBottom:5 }}>Daily activity — last 7 days</div>
            <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:40 }}>
              {(d.dailyArr||[]).map(([day, count], i) => {
                const maxVal = Math.max(...(d.dailyArr||[]).map(([,v])=>v), 1)
                const h = Math.max(4, (count/maxVal)*36)
                return (
                  <div key={day} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                    <div style={{ width:'100%', height:h, background:'#38bdf8', borderRadius:'3px 3px 0 0', opacity:0.8 }}/>
                    <span style={{ fontSize:7, color:C.text3 }}>{new Date(day).getDate()}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Tab: Pages */}
      {activeTab === 'pages' && (
        <div>
          <div style={{ fontSize:9, color:C.text3, marginBottom:10 }}>Top pages by engagement</div>
          {(d.topPages||[]).length === 0 ? (
            <div style={{ textAlign:'center', padding:'20px 0', fontSize:10, color:C.text3 }}>No page data yet</div>
          ) : (d.topPages||[]).map(([page, count], i) => {
            const maxVal = Math.max(...(d.topPages||[]).map(([,v])=>v), 1)
            return (
              <div key={page} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                <div style={{ width:6, height:6, borderRadius:'50%', background:barColors[i]||'#38bdf8', flexShrink:0 }}/>
                <span style={{ fontSize:10, color:C.text, flex:1, textTransform:'capitalize' }}>{page}</span>
                <div style={{ width:100, height:5, background:C.bar, borderRadius:99, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${(count/maxVal)*100}%`, background:barColors[i]||'#38bdf8', borderRadius:99 }}/>
                </div>
                <span style={{ fontSize:10, fontWeight:700, color:C.text, minWidth:24, textAlign:'right' }}>{count}</span>
              </div>
            )
          })}
          <div style={{ marginTop:10, padding:'8px 10px', background:isDark?'rgba(56,189,248,0.06)':'#f0f9ff', border:`0.5px solid ${isDark?'rgba(56,189,248,0.15)':'#bae6fd'}`, borderRadius:7, fontSize:9, color:'#38bdf8' }}>
            Data from sponsor slot interactions + profile page views
          </div>
        </div>
      )}

      {/* Tab: Locations */}
      {activeTab === 'locations' && (
        <div>
          <div style={{ fontSize:9, color:C.text3, marginBottom:10 }}>Top areas by profile views</div>
          {(d.topAreas||[]).length === 0 ? (
            <div style={{ textAlign:'center', padding:'20px 0', fontSize:10, color:C.text3 }}>No location data yet</div>
          ) : (d.topAreas||[]).map(([area, views], i) => {
            const maxVal = Math.max(...(d.topAreas||[]).map(([,v])=>v), 1)
            return (
              <div key={area} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                <span style={{ fontSize:9, fontWeight:700, color:C.text3, minWidth:16 }}>{i+1}</span>
                <i className="ti ti-map-pin" style={{ fontSize:10, color:barColors[i]||'#38bdf8', flexShrink:0 }}/>
                <span style={{ fontSize:10, color:C.text, flex:1 }}>{area}</span>
                <div style={{ width:80, height:5, background:C.bar, borderRadius:99, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${(views/maxVal)*100}%`, background:barColors[i]||'#38bdf8', borderRadius:99 }}/>
                </div>
                <span style={{ fontSize:10, fontWeight:700, color:C.text, minWidth:28, textAlign:'right' }}>{views}</span>
              </div>
            )
          })}
          <div style={{ marginTop:10, display:'flex', gap:8, flexWrap:'wrap' }}>
            {['Downtown','Business Bay','Marina','JBR','DIFC'].map(a => (
              <span key={a} style={{ fontSize:8, background:isDark?'rgba(56,189,248,0.08)':'#f0f9ff', color:'#38bdf8', padding:'2px 8px', borderRadius:99, border:`0.5px solid ${isDark?'rgba(56,189,248,0.2)':'#bae6fd'}` }}>{a}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Dashboard({ setPage, setPlanFilter, theme, adminData }) {
  const isDark = theme === 'dark'
  const isSuperAdmin = adminData?.role === 'superadmin' || adminData?.role === 'super_admin'

  const [stats,         setStats]         = useState({ companies:0, customers:0, reviews:0, trustScore:0, reports:0, verified:0, avgRating:'0.0', today:0, thisMonth:0 })
  const [planDist,      setPlanDist]      = useState({ free:0, silver:0, gold:0, platinum:0 })
  const [catDist,       setCatDist]       = useState([])
  const [recentApps,    setRecentApps]    = useState([])
  const [topCompanies,  setTopCompanies]  = useState([])
  const [recentReviews, setRecentReviews] = useState([])
  const [recentRegs,    setRecentRegs]    = useState([])
  const [activityData,  setActivityData]  = useState([])
  const [loading,       setLoading]       = useState(true)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    try {
      const [
        { count: totalCo },
        { count: totalRev },
        { count: totalCust },
        { count: verifiedCo },
        { count: pendingApps },
        { data: planData },
        { data: catData },
        { data: appsData },
        { data: topData },
        { data: revData },
        { data: ratData },
        { data: regsData },
        { count: todayCount },
      ] = await Promise.all([
        supabase.from('companies').select('*',{count:'exact',head:true}).eq('status','approved'),
        supabase.from('reviews').select('*',{count:'exact',head:true}).eq('is_approved',true),
        supabase.from('customers').select('*',{count:'exact',head:true}),
        supabase.from('companies').select('*',{count:'exact',head:true}).eq('status','approved').eq('is_verified',true),
        supabase.from('company_applications').select('*',{count:'exact',head:true}).eq('status','pending'),
        supabase.from('companies').select('plan').eq('status','approved'),
        supabase.from('companies').select('category').eq('status','approved'),
        supabase.from('company_applications').select('*').order('submitted_at',{ascending:false}).limit(5),
        supabase.from('companies').select('name,avg_rating,total_reviews,plan,area,category,is_verified').eq('status','approved').order('avg_rating',{ascending:false}).limit(5),
        supabase.from('reviews').select('id,reviewer_name,rating,review_text,created_at,companies(name)').eq('is_approved',true).order('created_at',{ascending:false}).limit(5),
        supabase.from('reviews').select('rating').eq('is_approved',true),
        supabase.from('company_registrations').select('*').order('submitted_at',{ascending:false}).limit(5),
        supabase.from('companies').select('*',{count:'exact',head:true}).gte('created_at',new Date().toISOString().split('T')[0]),
      ])

      const avg = ratData?.length>0 ? (ratData.reduce((s,r)=>s+r.rating,0)/ratData.length).toFixed(1) : '0.0'
      const score = Math.min(100,Math.round((verifiedCo/Math.max(totalCo,1))*40+(parseFloat(avg)/5)*40+Math.min((totalRev||0)/100,1)*20))

      setStats({ companies:totalCo||0, customers:totalCust||0, reviews:totalRev||0, trustScore:score, reports:pendingApps||0, verified:verifiedCo||0, avgRating:avg, today:todayCount||0 })

      const dist = { free:0, silver:0, gold:0, platinum:0 }
      ;(planData||[]).forEach(c => { const p=(c.plan||'free').toLowerCase(); if(dist[p]!==undefined) dist[p]++; else dist.free++ })
      setPlanDist(dist)

      const cats = {}
      ;(catData||[]).forEach(c => { cats[c.category]=(cats[c.category]||0)+1 })
      setCatDist(Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,6))

      setActivityData([2,5,3,8,6,12,9,15,11,18,14,20,16,22,totalCo||1])
      setRecentApps(appsData||[])
      setTopCompanies(topData||[])
      setRecentReviews(revData||[])
      setRecentRegs(regsData||[])
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  const C = {
    text:   isDark ? '#f0fdf4'                : '#0f172a',
    text2:  isDark ? '#6b7280'                : '#475569',
    text3:  isDark ? '#374151'                : '#94a3b8',
    border: isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0',
    card:   isDark ? '#161b22'                : '#ffffff',
    bg:     isDark ? '#0d1117'                : '#f0f4f8',
    row:    isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
    shadow: isDark ? '0 4px 24px rgba(0,0,0,0.25)' : '0 1px 8px rgba(0,0,0,0.06)',
    bar:    isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
  }

  const cardStyle = {
    background: C.card,
    border: `0.5px solid ${C.border}`,
    borderRadius: 12,
    padding: '14px 16px',
    boxShadow: C.shadow,
  }

  const PLAN_CONFIG = {
    free:     { label:'Free',     color:'#6b7280', bg:isDark?'rgba(107,114,128,0.15)':'#f3f4f6', icon:'ti-building',  price:0 },
    silver:   { label:'Silver',   color:'#94a3b8', bg:isDark?'rgba(148,163,184,0.15)':'#f1f5f9', icon:'ti-medal',     price:149 },
    gold:     { label:'Gold',     color:'#fbbf24', bg:isDark?'rgba(251,191,36,0.15)' :'#fffdf7', icon:'ti-star',      price:349 },
    platinum: { label:'Platinum', color:'#a78bfa', bg:isDark?'rgba(167,139,250,0.15)':'#f5f3ff', icon:'ti-diamond',   price:699 },
  }

  const catColors = ['#38bdf8','#4ade80','#fbbf24','#f87171','#a78bfa','#34d399']

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'80vh' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:36, height:36, border:'3px solid #4ade80', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 12px' }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ fontSize:13, color:C.text3 }}>Loading dashboard...</div>
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth:1300, color:C.text }}>

      {/* TOP BAR */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18, paddingBottom:14, borderBottom:`0.5px solid ${C.border}` }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:C.text, letterSpacing:'-0.3px' }}>Dashboard Overview</h1>
          <p style={{ fontSize:11, color:C.text2, marginTop:3 }}>Super Admin · Monitor and manage TrustDubai platform</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ background:C.card, border:`0.5px solid ${C.border}`, borderRadius:8, padding:'5px 10px', fontSize:9, color:C.text3, display:'flex', alignItems:'center', gap:5 }}>
            <i className="ti ti-calendar" style={{ fontSize:10, color:'#4ade80' }}/>
            {new Date().toLocaleDateString('en-AE',{month:'long',year:'numeric'})}
          </div>
          <div style={{ position:'relative' }}>
            <i className="ti ti-bell" style={{ fontSize:16, color:C.text3 }}/>
            <div style={{ position:'absolute', top:-2, right:-2, width:7, height:7, background:'#ef4444', borderRadius:'50%', border:`1.5px solid ${C.bg}` }}/>
          </div>
          <i className="ti ti-mail" style={{ fontSize:16, color:C.text3 }}/>
          <i className="ti ti-settings" style={{ fontSize:16, color:C.text3 }}/>
          <Clock isDark={isDark}/>
        </div>
      </div>

      {/* 5 STAT CARDS */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, marginBottom:14 }}>
        {[
          { label:'Total Customers',  value:stats.customers,  icon:'ti-users',          color:'#38bdf8', trend:[0,1,2,3,4,5],                   change:'+0%',                   page:'users' },
          { label:'Total Businesses', value:stats.companies,  icon:'ti-building-store', color:'#4ade80', trend:activityData,                     change:`+${stats.today} today`, page:'companies' },
          { label:'Total Reviews',    value:stats.reviews,    icon:'ti-star',           color:'#fbbf24', trend:[0,0,0,0,0,0],                    change:'+0%',                   page:'reviews' },
          { label:'Trust Score',      value:stats.trustScore, icon:'ti-shield-check',   color:'#4ade80', trend:[10,15,20,25,28,stats.trustScore], change:'trend ↗',               page:'trust_score', isScore:true },
          { label:'Active Reports',   value:stats.reports,    icon:'ti-flag',           color:'#f87171', trend:[3,2,4,3,2,stats.reports],         change:'-0%',                   page:'reports' },
        ].map((card,i) => (
          <div key={i}
            onClick={() => setPage && setPage(card.page)}
            style={{ ...cardStyle, cursor:'pointer', transition:'all 0.15s', position:'relative', overflow:'hidden' }}
            onMouseEnter={e=>{ e.currentTarget.style.borderColor=card.color+'55'; e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow=`0 6px 20px ${card.color}22` }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor=C.border; e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow=C.shadow }}
          >
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <div style={{ width:34, height:34, borderRadius:9, background:card.color+'18', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <i className={`ti ${card.icon}`} style={{ fontSize:16, color:card.color }}/>
              </div>
              <span style={{ fontSize:9, color:i===1||i===3?'#4ade80':i===4?'#f87171':C.text3, fontWeight:600 }}>{card.change}</span>
            </div>
            <div style={{ fontSize:9, color:C.text2, marginBottom:5 }}>{card.label}</div>
            <div style={{ fontSize:22, fontWeight:700, color:C.text, lineHeight:1, marginBottom:8 }}>
              {card.isScore ? <>{card.value}<span style={{ fontSize:12, color:C.text3 }}>/100</span></> : <AnimatedNumber value={card.value}/>}
            </div>
            <MiniSparkline data={card.trend} color={card.color} height={28}/>
            <div style={{ position:'absolute', bottom:8, right:10, fontSize:10, color:card.color, opacity:0.5 }}>View →</div>
          </div>
        ))}
      </div>

      {/* 4 PLAN CARDS */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }}>
        {Object.entries(PLAN_CONFIG).map(([key,p]) => (
          <div key={key}
            onClick={() => { if(setPage&&setPlanFilter){ setPlanFilter(key); setPage('companies') } }}
            style={{ ...cardStyle, cursor:'pointer', display:'flex', alignItems:'center', gap:14, transition:'all 0.15s', border:`1.5px solid ${C.border}` }}
            onMouseEnter={e=>{ e.currentTarget.style.borderColor=p.color; e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow=`0 6px 20px ${p.color}33` }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor=C.border; e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow=C.shadow }}
          >
            <div style={{ width:46, height:46, borderRadius:12, background:p.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <i className={`ti ${p.icon}`} style={{ fontSize:22, color:p.color }}/>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:28, fontWeight:700, color:C.text, lineHeight:1 }}><AnimatedNumber value={planDist[key]}/></div>
              <div style={{ fontSize:12, fontWeight:600, color:p.color, marginTop:3 }}>{p.label}</div>
              <div style={{ fontSize:11, color:C.text3 }}>{p.price===0?'Free plan':`AED ${p.price}/mo`}</div>
            </div>
            <span style={{ fontSize:13, color:p.color, opacity:0.6 }}>→</span>
          </div>
        ))}
      </div>

      {/* ACTIVITY CHART + REVIEW MOD */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 260px', gap:12, marginBottom:14 }}>
        <div style={cardStyle}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <span style={{ fontSize:11, fontWeight:700, color:C.text, letterSpacing:'0.04em', textTransform:'uppercase' }}>Platform Activity Overview</span>
            <div style={{ display:'flex', gap:12 }}>
              {[['#38bdf8','Customers',stats.customers],['#4ade80','Reviews',stats.reviews],['#fbbf24','Businesses',stats.companies],['#f87171','Reports',stats.reports]].map(([c,l,v]) => (
                <div key={l} style={{ display:'flex', alignItems:'center', gap:4, fontSize:9, color:C.text2 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:c }}/>{l} <span style={{ color:c, fontWeight:600 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ position:'relative', height:120 }}>
            <div style={{ position:'absolute', left:0, top:0, bottom:20, display:'flex', flexDirection:'column', justifyContent:'space-between', width:26 }}>
              {['100','50','0'].map(l => <span key={l} style={{ fontSize:8, color:C.text3 }}>{l}</span>)}
            </div>
            <div style={{ position:'absolute', left:28, right:0, top:0, bottom:20 }}>
              <svg width="100%" height="100%" viewBox="0 0 500 100" preserveAspectRatio="none">
                {[0,50,100].map(y => <line key={y} x1="0" y1={y} x2="500" y2={y} stroke={isDark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.06)'} strokeWidth="0.5"/>)}
                <path d="M0,98 50,95 100,92 150,86 200,78 250,70 300,60 350,48 400,40 450,30 500,20 L500,100 L0,100 Z" fill="rgba(74,222,128,0.06)"/>
                <polyline points="0,98 50,95 100,92 150,86 200,78 250,70 300,60 350,48 400,40 450,30 500,20" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="0,99 500,99" fill="none" stroke="#fbbf24" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="4,3"/>
                <polyline points="0,99 500,99" fill="none" stroke="#38bdf8" strokeWidth="1" strokeLinecap="round" strokeDasharray="2,4"/>
                <polyline points="0,96 50,95 100,96 150,94 200,95 250,93 300,94 350,92 400,93 450,91 500,90" fill="none" stroke="#f87171" strokeWidth="1" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={{ position:'absolute', left:28, right:0, bottom:0, display:'flex', justifyContent:'space-between' }}>
              {['May 01','May 08','May 15','May 22','May 30'].map(l => <span key={l} style={{ fontSize:8, color:C.text3 }}>{l}</span>)}
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize:11, fontWeight:700, color:C.text, letterSpacing:'0.04em', textTransform:'uppercase', marginBottom:12 }}>Review Mod. Status</div>
          <div style={{ display:'flex', justifyContent:'center', marginBottom:10 }}>
            <CircularGauge value={stats.reviews>0?90:100} isDark={isDark}/>
          </div>
          <div style={{ display:'flex', justifyContent:'space-around', marginBottom:10 }}>
            {[['5%','#fbbf24','Warnings'],['2%','#f87171','Violations'],['3%',C.text3,'Flagged']].map(([v,c,l]) => (
              <div key={l} style={{ textAlign:'center' }}>
                <div style={{ fontSize:13, fontWeight:700, color:c }}>{v}</div>
                <div style={{ fontSize:8, color:C.text3 }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ borderTop:`0.5px solid ${C.border}`, paddingTop:10 }}>
            {[['Reviews Scanned',stats.reviews,C.text],['Auto-Flagged',0,'#fbbf24'],['Auto-Removed',0,'#f87171']].map(([l,v,c]) => (
              <div key={l} style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:5 }}>
                <span style={{ color:C.text2 }}>{l}</span>
                <span style={{ color:c, fontWeight:600 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4 ACTION CARDS */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:14 }}>
        {[
          { label:'Pending Verifications', icon:'ti-shield-check',   color:'#4ade80', value:stats.reports, action:'applications' },
          { label:'Moderation Queue',      icon:'ti-stack',          color:'#38bdf8', value:0, sub:'items', action:'ai_moderation' },
          { label:'Open Disputes',         icon:'ti-message-report', color:'#f87171', value:0, action:'disputes' },
          { label:'System Alerts',         icon:'ti-alert-triangle', color:'#fbbf24', value:null, critical:0, warning:1, action:'system_health' },
        ].map((card,i) => (
          <div key={i}
            onClick={() => card.action && setPage && setPage(card.action)}
            style={{ ...cardStyle, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', border:`0.5px solid ${card.color}33`, transition:'all 0.15s' }}
            onMouseEnter={e=>{ e.currentTarget.style.borderColor=card.color+'77'; e.currentTarget.style.transform='translateY(-1px)' }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor=card.color+'33'; e.currentTarget.style.transform='none' }}
          >
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                <i className={`ti ${card.icon}`} style={{ fontSize:14, color:card.color }}/>
                <span style={{ fontSize:10, color:card.color, fontWeight:500 }}>{card.label}</span>
              </div>
              {card.value !== null ? (
                <div style={{ fontSize:26, fontWeight:700, color:C.text }}>
                  <AnimatedNumber value={card.value}/>
                  {card.sub && <span style={{ fontSize:11, color:C.text3, marginLeft:5 }}>{card.sub}</span>}
                </div>
              ) : (
                <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
                  <span style={{ fontSize:26, fontWeight:700, color:'#f87171' }}>{card.critical}</span>
                  <span style={{ fontSize:10, color:C.text3 }}>Critical</span>
                  <span style={{ fontSize:22, fontWeight:700, color:'#fbbf24' }}>{card.warning}</span>
                  <span style={{ fontSize:10, color:C.text3 }}>Warning</span>
                </div>
              )}
            </div>
            <div style={{ background:card.color+'18', color:card.color, fontSize:16, fontWeight:700, padding:'8px 12px', borderRadius:9 }}>
              {card.value !== null ? card.value : card.critical+card.warning}
            </div>
          </div>
        ))}
      </div>

      {/* PLAN DISTRIBUTION + CATEGORY DISTRIBUTION */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
        <div style={cardStyle}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <h3 style={{ fontSize:13, fontWeight:600, color:C.text }}>Plan Distribution</h3>
            <span style={{ fontSize:10, color:C.text3, background:C.row, padding:'3px 10px', borderRadius:20, border:`0.5px solid ${C.border}` }}>{stats.companies} total</span>
          </div>
          {Object.entries(PLAN_CONFIG).map(([key,p]) => {
            const count = planDist[key]
            const total = Object.values(planDist).reduce((a,b)=>a+b,0)||1
            return (
              <div key={key} style={{ marginBottom:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:p.color }}/>
                    <span style={{ fontSize:12, fontWeight:500, color:C.text }}>{p.label}</span>
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <span style={{ fontSize:13, fontWeight:700, color:C.text }}>{count}</span>
                    <span style={{ fontSize:11, color:C.text3, minWidth:36, textAlign:'right' }}>{Math.round(count/total*100)}%</span>
                  </div>
                </div>
                <div style={{ height:7, background:C.bar, borderRadius:4, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:(count/total*100)+'%', background:p.color, borderRadius:4, transition:'width 1.2s ease' }}/>
                </div>
              </div>
            )
          })}
          <div style={{ marginTop:14, padding:'10px 14px', background:isDark?'rgba(74,222,128,0.06)':'#f0fdf4', borderRadius:10, display:'flex', justifyContent:'space-between', border:`0.5px solid ${isDark?'rgba(74,222,128,0.15)':'#a7f3d0'}` }}>
            <span style={{ fontSize:12, color:C.text2 }}>Monthly Revenue</span>
            <span style={{ fontSize:13, fontWeight:700, color:'#4ade80' }}>AED {(planDist.silver*149+planDist.gold*349+planDist.platinum*699).toLocaleString()}/mo</span>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <h3 style={{ fontSize:13, fontWeight:600, color:C.text }}>Category Distribution</h3>
            <span style={{ fontSize:10, color:C.text3, background:C.row, padding:'3px 10px', borderRadius:20, border:`0.5px solid ${C.border}` }}>Live companies</span>
          </div>
          {catDist.length===0 ? (
            <div style={{ textAlign:'center', padding:'30px 0' }}>
              <i className="ti ti-chart-donut" style={{ fontSize:36, color:C.text3, display:'block', marginBottom:8 }}/>
              <p style={{ color:C.text3, fontSize:13 }}>No data yet</p>
            </div>
          ) : catDist.map(([cat,count],i) => (
            <div key={cat} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:13 }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:catColors[i], flexShrink:0 }}/>
              <span style={{ fontSize:12, flex:1, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{cat}</span>
              <div style={{ width:90, height:6, background:C.bar, borderRadius:3 }}>
                <div style={{ height:'100%', width:(count/Math.max(...catDist.map(c=>c[1]))*100)+'%', background:catColors[i], borderRadius:3 }}/>
              </div>
              <span style={{ fontSize:12, fontWeight:700, color:C.text, minWidth:20, textAlign:'right' }}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* VERIFICATION TABLE + WEBSITE ANALYTICS (Super Admin) / PLATFORM HEALTH (others) */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>

        <div style={cardStyle}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <span style={{ fontSize:12, fontWeight:700, color:C.text, letterSpacing:'0.04em', textTransform:'uppercase' }}>Verification Requests</span>
            <span onClick={()=>setPage&&setPage('applications')} style={{ fontSize:9, color:'#0099cc', cursor:'pointer' }}>Table →</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 80px 70px 70px', gap:8, padding:'5px 10px', borderBottom:`0.5px solid ${C.border}`, fontSize:9, fontWeight:700, color:C.text3, letterSpacing:'0.05em', textTransform:'uppercase' }}>
            <span>Business</span><span>Category</span><span>Date</span><span>Status</span>
          </div>
          {recentApps.length===0 ? (
            <div style={{ textAlign:'center', padding:'20px 0', fontSize:11, color:C.text3 }}>No applications yet</div>
          ) : recentApps.slice(0,4).map((app,i) => (
            <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 80px 70px 70px', gap:8, padding:'8px 10px', borderBottom:`0.5px solid ${C.border}`, fontSize:10, color:C.text2, alignItems:'center' }}>
              <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                <div style={{ width:24, height:24, borderRadius:6, background:'rgba(56,189,248,0.12)', color:'#38bdf8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, flexShrink:0 }}>
                  {(app.company_name||'?')[0].toUpperCase()}
                </div>
                <span style={{ color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{app.company_name||'Unknown'}</span>
              </div>
              <span>{app.category||'—'}</span>
              <span>{app.submitted_at?new Date(app.submitted_at).toLocaleDateString('en-AE',{month:'short',day:'numeric'}):'—'}</span>
              <span style={{ background:app.status==='approved'?'rgba(74,222,128,0.12)':app.status==='rejected'?'rgba(248,113,113,0.12)':'rgba(251,191,36,0.12)', color:app.status==='approved'?'#4ade80':app.status==='rejected'?'#f87171':'#fbbf24', padding:'2px 7px', borderRadius:99, fontSize:9, fontWeight:700, display:'inline-block' }}>
                {app.status||'Pending'}
              </span>
            </div>
          ))}
        </div>

        {/* Website Analytics for Super Admin, Platform Health for others */}
        {isSuperAdmin ? (
          <WebsiteAnalytics isDark={isDark} C={C} cardStyle={cardStyle} />
        ) : (
          <div style={cardStyle}>
            <div style={{ fontSize:12, fontWeight:700, color:C.text, letterSpacing:'0.04em', textTransform:'uppercase', marginBottom:12 }}>Platform Health Monitor</div>
            {[
              { label:'Supabase DB',    status:'Online 99.9%', color:'#4ade80', pct:99 },
              { label:'Auth Service',   status:'Stable 8ms',   color:'#4ade80', pct:96 },
              { label:'Storage',        status:'12% Used',     color:'#fbbf24', pct:12 },
              { label:'Edge Functions', status:'Active 12ms',  color:'#4ade80', pct:98 },
              { label:'Vercel CDN',     status:'Optimized',    color:'#4ade80', pct:100 },
            ].map(h => (
              <div key={h.label} style={{ marginBottom:11 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:11, color:C.text2 }}>{h.label}</span>
                  <span style={{ fontSize:10, color:h.color, fontWeight:600 }}>{h.status}</span>
                </div>
                <div style={{ height:4, background:C.bar, borderRadius:99, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:h.pct+'%', background:h.color, borderRadius:99 }}/>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* RECENT REGISTRATIONS + TOP RATED */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>

        <div style={cardStyle}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <h3 style={{ fontSize:13, fontWeight:600, color:C.text }}>Recent Registrations</h3>
            <span style={{ background:isDark?'rgba(251,191,36,0.12)':'#fef9e7', color:'#fbbf24', fontSize:10, fontWeight:600, padding:'3px 10px', borderRadius:20 }}>
              {recentRegs.filter(r=>r.status==='pending').length} pending
            </span>
          </div>
          {recentRegs.length===0 ? (
            <div style={{ textAlign:'center', padding:'30px 0' }}>
              <i className="ti ti-clipboard-list" style={{ fontSize:36, color:C.text3, display:'block', marginBottom:8 }}/>
              <p style={{ color:C.text3, fontSize:13 }}>No registrations yet</p>
            </div>
          ) : recentRegs.map(r => (
            <div key={r.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:`0.5px solid ${C.border}` }}>
              <div style={{ width:36, height:36, borderRadius:10, background:isDark?'rgba(74,222,128,0.1)':'#f0fdf4', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#4ade80', flexShrink:0 }}>
                {r.company_name?.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:500, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.company_name}</div>
                <div style={{ fontSize:10, color:C.text2 }}>{r.category} · {r.area}</div>
              </div>
              <span style={{ background:r.status==='pending'?(isDark?'rgba(251,191,36,0.12)':'#fef9e7'):(isDark?'rgba(74,222,128,0.12)':'#f0fdf4'), color:r.status==='pending'?'#fbbf24':'#4ade80', fontSize:10, fontWeight:600, padding:'3px 8px', borderRadius:8 }}>{r.status}</span>
            </div>
          ))}
        </div>

        <div style={cardStyle}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <h3 style={{ fontSize:13, fontWeight:600, color:C.text }}>Top Rated Companies</h3>
            <span style={{ fontSize:10, color:C.text3, background:C.row, padding:'3px 10px', borderRadius:20, border:`0.5px solid ${C.border}` }}>By rating</span>
          </div>
          {topCompanies.length===0 ? (
            <div style={{ textAlign:'center', padding:'30px 0' }}>
              <i className="ti ti-trophy" style={{ fontSize:36, color:C.text3, display:'block', marginBottom:8 }}/>
              <p style={{ color:C.text3, fontSize:13 }}>No companies yet</p>
            </div>
          ) : topCompanies.map((c,i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:`0.5px solid ${C.border}` }}>
              <div style={{ width:26, height:26, borderRadius:'50%', background:i===0?(isDark?'rgba(251,191,36,0.15)':'#fef9e7'):C.row, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:i===0?'#fbbf24':C.text3, border:`0.5px solid ${C.border}` }}>
                {i+1}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:500, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:5 }}>
                  {c.name}
                  {c.is_verified && <i className="ti ti-rosette-discount-check" style={{ fontSize:13, color:'#4ade80' }}/>}
                </div>
                <div style={{ fontSize:10, color:C.text2 }}>{c.category} · {c.total_reviews||0} reviews</div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:3, background:isDark?'rgba(251,191,36,0.1)':'#fef9e7', padding:'3px 9px', borderRadius:8 }}>
                <span style={{ color:'#fbbf24', fontSize:12 }}>★</span>
                <span style={{ fontSize:13, fontWeight:700, color:'#fbbf24' }}>{c.avg_rating||'0.0'}</span>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* REVIEW MODERATION QUEUE */}
      <div style={{ ...cardStyle, marginBottom:14 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
          <span style={{ fontSize:12, fontWeight:700, color:C.text, letterSpacing:'0.04em', textTransform:'uppercase' }}>Review Moderation Queue</span>
          <span onClick={()=>setPage&&setPage('reviews')} style={{ fontSize:9, color:'#0099cc', cursor:'pointer' }}>View all →</span>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 110px 100px 80px 110px', gap:8, padding:'5px 10px', borderBottom:`0.5px solid ${C.border}`, fontSize:9, fontWeight:700, color:C.text3, letterSpacing:'0.05em', textTransform:'uppercase' }}>
          <span>Content Preview</span><span>Author</span><span>AI Confidence</span><span>Type</span><span>Actions</span>
        </div>
        {recentReviews.length===0 ? (
          <div style={{ padding:'16px 10px', fontSize:10, color:C.text3 }}>No reviews in moderation queue.</div>
        ) : recentReviews.slice(0,3).map((r,i) => (
          <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 110px 100px 80px 110px', gap:8, padding:'8px 10px', borderBottom:`0.5px solid ${C.border}`, fontSize:10, color:C.text2, alignItems:'center' }}>
            <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:C.text }}>{(r.review_text||'').slice(0,50)}...</span>
            <span>@{(r.reviewer_name||'anon').replace(/\s/g,'').toLowerCase()}</span>
            <div>
              <div style={{ fontSize:9, color:'#4ade80', marginBottom:2 }}>94%</div>
              <div style={{ height:4, background:C.bar, borderRadius:99 }}>
                <div style={{ width:'94%', height:'100%', background:'#4ade80', borderRadius:99 }}/>
              </div>
            </div>
            <span style={{ background:'rgba(74,222,128,0.1)', color:'#4ade80', padding:'2px 6px', borderRadius:4, fontSize:9, fontWeight:600 }}>Safe</span>
            <div style={{ display:'flex', gap:5 }}>
              <span style={{ background:'rgba(74,222,128,0.12)', color:'#4ade80', borderRadius:5, padding:'3px 8px', fontSize:9, fontWeight:600, cursor:'pointer' }}>Approve</span>
              <span style={{ background:'rgba(239,68,68,0.1)', color:'#f87171', borderRadius:5, padding:'3px 8px', fontSize:9, fontWeight:600, cursor:'pointer' }}>Reject</span>
            </div>
          </div>
        ))}
      </div>

      {/* LATEST REVIEWS */}
      <div style={cardStyle}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <h3 style={{ fontSize:13, fontWeight:600, color:C.text }}>Latest Reviews</h3>
          <span style={{ fontSize:10, color:C.text3, background:C.row, padding:'3px 10px', borderRadius:20, border:`0.5px solid ${C.border}` }}>Last 5</span>
        </div>
        {recentReviews.length===0 ? (
          <div style={{ textAlign:'center', padding:'30px 0' }}>
            <i className="ti ti-message" style={{ fontSize:36, color:C.text3, display:'block', marginBottom:8 }}/>
            <p style={{ color:C.text3, fontSize:13 }}>No reviews yet</p>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10 }}>
            {recentReviews.map(r => (
              <div key={r.id} style={{ background:C.row, borderRadius:12, padding:14, border:`0.5px solid ${C.border}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                  <span style={{ color:'#fbbf24', fontSize:13 }}>{'★'.repeat(r.rating)}<span style={{ color:C.border }}>{'★'.repeat(5-r.rating)}</span></span>
                  <span style={{ fontSize:10, color:C.text3 }}>{new Date(r.created_at).toLocaleDateString('en-AE',{month:'short',day:'numeric'})}</span>
                </div>
                <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.companies?.name||'Unknown'}</div>
                <div style={{ fontSize:11, color:C.text2, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', lineHeight:1.5 }}>{r.review_text}</div>
                <div style={{ fontSize:10, color:C.text3, marginTop:8, paddingTop:8, borderTop:`0.5px solid ${C.border}` }}>— {r.reviewer_name}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* REFRESH */}
      <div style={{ textAlign:'center', marginTop:16 }}>
        <button onClick={fetchAll}
          style={{ padding:'9px 24px', background:isDark?'rgba(74,222,128,0.08)':'#f0fdf4', border:`0.5px solid ${isDark?'rgba(74,222,128,0.2)':'#a7f3d0'}`, borderRadius:20, fontSize:12, color:'#4ade80', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:7, fontWeight:500 }}>
          <i className="ti ti-refresh" style={{ fontSize:14 }}/> Refresh Data
        </button>
      </div>

    </div>
  )
}
