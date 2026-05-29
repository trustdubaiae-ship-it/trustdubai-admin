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

function CircularGauge({ value = 90 }) {
  const r = 35, cx = 45, cy = 45, circ = 2*Math.PI*r
  const safe = (value/100)*circ
  const warn = ((100-value)*0.6/100)*circ
  const viol = ((100-value)*0.4/100)*circ
  return (
    <svg width="100" height="100" viewBox="0 0 90 90">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8"/>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#4ade80" strokeWidth="8" strokeDasharray={`${safe} ${circ-safe}`} strokeDashoffset={circ*0.25} strokeLinecap="round"/>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#fbbf24" strokeWidth="8" strokeDasharray={`${warn} ${circ-warn}`} strokeDashoffset={circ*0.25-safe} strokeLinecap="round"/>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f87171" strokeWidth="8" strokeDasharray={`${viol} ${circ-viol}`} strokeDashoffset={circ*0.25-safe-warn} strokeLinecap="round"/>
      <text x={cx} y={cy-4} textAnchor="middle" fill="#4ade80" fontSize="15" fontWeight="700">{value}%</text>
      <text x={cx} y={cy+10} textAnchor="middle" fill="#374151" fontSize="7">Safe Content</text>
    </svg>
  )
}

function Clock({ isDark }) {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const hh = String(time.getHours()).padStart(2,'0')
  const mm = String(time.getMinutes()).padStart(2,'0')
  const ss = String(time.getSeconds()).padStart(2,'0')
  return (
    <div style={{ background: isDark?'#161b22':'#ffffff', border:`0.5px solid ${isDark?'rgba(255,255,255,0.1)':'#e2e8f0'}`, borderRadius:12, padding:'12px 20px', textAlign:'center', minWidth:200 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginBottom:4 }}>
        <i className="ti ti-clock" style={{ fontSize:12, color:'#4ade80' }}/>
        <span style={{ fontSize:9, color: isDark?'#374151':'#94a3b8', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase' }}>Dubai Time (GMT+4)</span>
      </div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
        {[hh, mm, ss].map((unit, i) => (
          <span key={i} style={{ display:'flex', alignItems:'center', gap:4 }}>
            <span style={{ background: isDark?'#0d1117':'#f0f4f8', border:`1px solid ${isDark?'rgba(74,222,128,0.2)':'#d1fae5'}`, borderRadius:8, padding:'6px 10px', fontSize:24, fontWeight:700, color:'#4ade80', letterSpacing:2, fontVariantNumeric:'tabular-nums', minWidth:50, textAlign:'center', display:'inline-block' }}>{unit}</span>
            {i < 2 && <span style={{ fontSize:22, fontWeight:700, color:'#4ade80', opacity:0.6 }}>:</span>}
          </span>
        ))}
      </div>
      <div style={{ fontSize:10, color: isDark?'#374151':'#94a3b8', marginTop:6 }}>
        {time.toLocaleDateString('en-AE',{ weekday:'long', day:'numeric', month:'long', year:'numeric' })}
      </div>
    </div>
  )
}

export default function Dashboard({ setPage, setPlanFilter, theme }) {
  const isDark = theme === 'dark'
  const [stats,         setStats]         = useState({ companies:0, customers:0, reviews:0, trustScore:0, reports:0, verified:0, avgRating:'0.0', today:0, thisMonth:0, employees:0 })
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
        { count: monthCount },
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
        supabase.from('companies').select('*',{count:'exact',head:true}).gte('created_at',new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString()),
      ])

      const avg = ratData?.length > 0 ? (ratData.reduce((s,r)=>s+r.rating,0)/ratData.length).toFixed(1) : '0.0'
      const score = Math.min(100,Math.round((verifiedCo/Math.max(totalCo,1))*40+(parseFloat(avg)/5)*40+Math.min((totalRev||0)/100,1)*20))

      setStats({ companies:totalCo||0, customers:totalCust||0, reviews:totalRev||0, trustScore:score, reports:pendingApps||0, verified:verifiedCo||0, avgRating:avg, today:todayCount||0, thisMonth:monthCount||0 })

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

  // Theme colors
  const C = {
    text:    isDark ? '#f0fdf4'               : '#0f172a',
    text2:   isDark ? '#6b7280'               : '#475569',
    text3:   isDark ? '#374151'               : '#94a3b8',
    border:  isDark ? 'rgba(255,255,255,0.07)': '#e2e8f0',
    card:    isDark ? '#161b22'               : '#ffffff',
    bg:      isDark ? '#0d1117'               : '#f0f4f8',
    bg2:     isDark ? '#0a0f1e'               : '#f8fafc',
    row:     isDark ? 'rgba(255,255,255,0.03)': '#f8fafc',
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

  const cardStyle = { background:C.card, border:`0.5px solid ${C.border}`, borderRadius:12, padding:'14px 16px', boxShadow: isDark?'0 4px 24px rgba(0,0,0,0.2)':'0 1px 8px rgba(0,0,0,0.06)' }

  return (
    <div style={{ maxWidth:1300, color:C.text, fontFamily:'DM Sans, sans-serif' }}>

      {/* TOP BAR */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18, paddingBottom:14, borderBottom:`0.5px solid ${C.border}` }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:C.text, letterSpacing:'-0.3px', fontFamily:'DM Sans, sans-serif' }}>Dashboard Overview</h1>
          <p style={{ fontSize:11, color:C.text2, marginTop:3, fontFamily:'DM Sans, sans-serif' }}>Super Admin · Monitor and manage TrustDubai platform</p>
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
          <Clock isDark={isDark} />
        </div>
      </div>

      {/* 5 STAT CARDS */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, marginBottom:14 }}>
        {[
          { label:'Total Customers',  value:stats.customers,  icon:'ti-users',          color:'#38bdf8', trend:[0,1,2,3,4,5],                    change:'+0%',   page:'users' },
          { label:'Total Businesses', value:stats.companies,  icon:'ti-building-store', color:'#4ade80', trend:activityData,                      change:`+${stats.today} today`, page:'companies' },
          { label:'Total Reviews',    value:stats.reviews,    icon:'ti-star',           color:'#fbbf24', trend:[0,0,0,0,0,0],                     change:'+0%',   page:'reviews' },
          { label:'Trust Score',      value:stats.trustScore, icon:'ti-shield-check',   color:'#4ade80', trend:[10,15,20,25,28,stats.trustScore],  change:'trend ↗', page:'trust_score', isScore:true },
          { label:'Active Reports',   value:stats.reports,    icon:'ti-flag',           color:'#f87171', trend:[3,2,4,3,2,stats.reports],          change:'-0%',   page:'reports' },
        ].map((card,i) => (
          <div key={i}
            onClick={() => setPage && setPage(card.page)}
            style={{ ...cardStyle, cursor:'pointer', transition:'all 0.15s', position:'relative', overflow:'hidden' }}
            onMouseEnter={e=>{ e.currentTarget.style.borderColor=card.color+'55'; e.currentTarget.style.transform='translateY(-2px)' }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor=C.border; e.currentTarget.style.transform='none' }}
          >
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <div style={{ width:34, height:34, borderRadius:9, background:card.color+'18', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <i className={`ti ${card.icon}`} style={{ fontSize:16, color:card.color }}/>
              </div>
              <span style={{ fontSize:9, color: i===1||i===3?'#4ade80':i===4?'#f87171':C.text3, fontWeight:600 }}>{card.change}</span>
            </div>
            <div style={{ fontSize:9, color:C.text2, marginBottom:5, fontFamily:'DM Sans, sans-serif' }}>{card.label}</div>
            <div style={{ fontSize:22, fontWeight:700, color:C.text, lineHeight:1, marginBottom:8, fontFamily:'DM Sans, sans-serif' }}>
              {card.isScore ? <>{card.value}<span style={{ fontSize:12, color:C.text3 }}>/100</span></> : <AnimatedNumber value={card.value}/>}
            </div>
            <MiniSparkline data={card.trend} color={card.color} height={28}/>
          </div>
        ))}
      </div>

      {/* 4 PLAN CARDS */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }}>
        {Object.entries(PLAN_CONFIG).map(([key,p]) => (
          <div key={key}
            onClick={() => { if(setPage && setPlanFilter) { setPlanFilter(key); setPage('companies') } }}
            style={{ ...cardStyle, cursor:'pointer', display:'flex', alignItems:'center', gap:14, transition:'all 0.15s', border:`1.5px solid ${C.border}` }}
            onMouseEnter={e=>{ e.currentTarget.style.borderColor=p.color; e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow=`0 4px 20px ${p.color}33` }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor=C.border; e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow=isDark?'0 4px 24px rgba(0,0,0,0.2)':'0 1px 8px rgba(0,0,0,0.06)' }}
          >
            <div style={{ width:46, height:46, borderRadius:12, background:p.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <i className={`ti ${p.icon}`} style={{ fontSize:22, color:p.color }}/>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:28, fontWeight:700, color:C.text, lineHeight:1, fontFamily:'DM Sans, sans-serif' }}><AnimatedNumber value={planDist[key]}/></div>
              <div style={{ fontSize:12, fontWeight:600, color:p.color, marginTop:3, fontFamily:'DM Sans, sans-serif' }}>{p.label}</div>
              <div style={{ fontSize:11, color:C.text3, fontFamily:'DM Sans, sans-serif' }}>{p.price===0?'Free plan':`AED ${p.price}/mo`}</div>
            </div>
            <span style={{ fontSize:11, color:p.color, opacity:0.7 }}>→</span>
          </div>
        ))}
      </div>

      {/* ACTIVITY CHART + REVIEW MOD */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 260px', gap:12, marginBottom:14 }}>

        <div style={cardStyle}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <span style={{ fontSize:11, fontWeight:700, color:C.text, letterSpacing:'0.04em', textTransform:'uppercase', fontFamily:'DM Sans, sans-serif' }}>Platform Activity Overview</span>
            <div style={{ display:'flex', gap:12 }}>
              {[['#38bdf8','Customers',stats.customers],['#4ade80','Reviews',stats.reviews],['#fbbf24','Businesses',stats.companies],['#f87171','Reports',stats.reports]].map(([c,l,v]) => (
                <div key={l} style={{ display:'flex', alignItems:'center', gap:4, fontSize:9, color:C.text2, fontFamily:'DM Sans, sans-serif' }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:c }}/>{l} <span style={{ color:c, fontWeight:600 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ position:'relative', height:120 }}>
            <div style={{ position:'absolute', left:0, top:0, bottom:20, display:'flex', flexDirection:'column', justifyContent:'space-between', width:26 }}>
              {['100','50','0'].map(l => <span key={l} style={{ fontSize:8, color:C.text3, fontFamily:'DM Sans, sans-serif' }}>{l}</span>)}
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
              {['May 01','May 08','May 15','May 22','May 30'].map(l => <span key={l} style={{ fontSize:8, color:C.text3, fontFamily:'DM Sans, sans-serif' }}>{l}</span>)}
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize:11, fontWeight:700, color:C.text, letterSpacing:'0.04em', textTransform:'uppercase', marginBottom:12, fontFamily:'DM Sans, sans-serif' }}>Review Mod. Status</div>
          <div style={{ display:'flex', justifyContent:'center', marginBottom:10 }}>
            <CircularGauge value={stats.reviews > 0 ? 90 : 100}/>
          </div>
          <div style={{ display:'flex', justifyContent:'space-around', marginBottom:10 }}>
            {[['5%','#fbbf24','Warnings'],['2%','#f87171','Violations'],['3%',C.text3,'Flagged']].map(([v,c,l]) => (
              <div key={l} style={{ textAlign:'center' }}>
                <div style={{ fontSize:13, fontWeight:700, color:c, fontFamily:'DM Sans, sans-serif' }}>{v}</div>
                <div style={{ fontSize:8, color:C.text3, fontFamily:'DM Sans, sans-serif' }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ borderTop:`0.5px solid ${C.border}`, paddingTop:10 }}>
            {[['Reviews Scanned',stats.reviews,C.text],['Auto-Flagged',0,'#fbbf24'],['Auto-Removed',0,'#f87171']].map(([l,v,c]) => (
              <div key={l} style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:5, fontFamily:'DM Sans, sans-serif' }}>
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
          { label:'Moderation Queue',      icon:'ti-stack',          color:'#38bdf8', value:0, sub:'items' },
          { label:'Open Disputes',         icon:'ti-message-report', color:'#f87171', value:0, action:'disputes' },
          { label:'System Alerts',         icon:'ti-alert-triangle', color:'#fbbf24', value:null, critical:0, warning:1 },
        ].map((card,i) => (
          <div key={i}
            onClick={() => card.action && setPage && setPage(card.action)}
            style={{ ...cardStyle, cursor:card.action?'pointer':'default', display:'flex', alignItems:'center', justifyContent:'space-between', border:`0.5px solid ${card.color}33`, transition:'all 0.15s' }}
            onMouseEnter={e=>{ if(card.action) e.currentTarget.style.borderColor=card.color+'77' }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor=card.color+'33' }}
          >
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                <i className={`ti ${card.icon}`} style={{ fontSize:14, color:card.color }}/>
                <span style={{ fontSize:10, color:card.color, fontWeight:500, fontFamily:'DM Sans, sans-serif' }}>{card.label}</span>
              </div>
              {card.value !== null ? (
                <div style={{ fontSize:26, fontWeight:700, color:C.text, fontFamily:'DM Sans, sans-serif' }}>
                  <AnimatedNumber value={card.value}/>
                  {card.sub && <span style={{ fontSize:11, color:C.text3, marginLeft:5, fontFamily:'DM Sans, sans-serif' }}>{card.sub}</span>}
                </div>
              ) : (
                <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
                  <span style={{ fontSize:26, fontWeight:700, color:'#f87171', fontFamily:'DM Sans, sans-serif' }}>{card.critical}</span>
                  <span style={{ fontSize:10, color:C.text3, fontFamily:'DM Sans, sans-serif' }}>Critical</span>
                  <span style={{ fontSize:22, fontWeight:700, color:'#fbbf24', fontFamily:'DM Sans, sans-serif' }}>{card.warning}</span>
                  <span style={{ fontSize:10, color:C.text3, fontFamily:'DM Sans, sans-serif' }}>Warning</span>
                </div>
              )}
            </div>
            <div style={{ background:card.color+'18', color:card.color, fontSize:16, fontWeight:700, padding:'8px 12px', borderRadius:9, fontFamily:'DM Sans, sans-serif' }}>
              {card.value !== null ? card.value : card.critical+card.warning}
            </div>
          </div>
        ))}
      </div>

      {/* PLAN DISTRIBUTION + CATEGORY DISTRIBUTION */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>

        <div style={cardStyle}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <h3 style={{ fontSize:13, fontWeight:600, color:C.text, fontFamily:'DM Sans, sans-serif' }}>Plan Distribution</h3>
            <span style={{ fontSize:10, color:C.text3, background:C.row, padding:'3px 10px', borderRadius:20, border:`0.5px solid ${C.border}`, fontFamily:'DM Sans, sans-serif' }}>{stats.companies} total</span>
          </div>
          {Object.entries(PLAN_CONFIG).map(([key,p]) => {
            const count = planDist[key]
            const total = Object.values(planDist).reduce((a,b)=>a+b,0) || 1
            return (
              <div key={key} style={{ marginBottom:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:p.color }}/>
                    <span style={{ fontSize:12, fontWeight:500, color:C.text, fontFamily:'DM Sans, sans-serif' }}>{p.label}</span>
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <span style={{ fontSize:13, fontWeight:700, color:C.text, fontFamily:'DM Sans, sans-serif' }}>{count}</span>
                    <span style={{ fontSize:11, color:C.text3, minWidth:36, textAlign:'right', fontFamily:'DM Sans, sans-serif' }}>{Math.round(count/total*100)}%</span>
                  </div>
                </div>
                <div style={{ height:7, background:isDark?'rgba(255,255,255,0.06)':'#f1f5f9', borderRadius:4, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:(count/total*100)+'%', background:p.color, borderRadius:4, transition:'width 1.2s ease' }}/>
                </div>
              </div>
            )
          })}
          <div style={{ marginTop:14, padding:'10px 14px', background:isDark?'rgba(74,222,128,0.06)':'#f0fdf4', borderRadius:10, display:'flex', justifyContent:'space-between', border:`0.5px solid ${isDark?'rgba(74,222,128,0.15)':'#a7f3d0'}` }}>
            <span style={{ fontSize:12, color:C.text2, fontFamily:'DM Sans, sans-serif' }}>Monthly Revenue</span>
            <span style={{ fontSize:13, fontWeight:700, color:'#4ade80', fontFamily:'DM Sans, sans-serif' }}>
              AED {(planDist.silver*149+planDist.gold*349+planDist.platinum*699).toLocaleString()}/mo
            </span>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <h3 style={{ fontSize:13, fontWeight:600, color:C.text, fontFamily:'DM Sans, sans-serif' }}>Category Distribution</h3>
            <span style={{ fontSize:10, color:C.text3, background:C.row, padding:'3px 10px', borderRadius:20, border:`0.5px solid ${C.border}`, fontFamily:'DM Sans, sans-serif' }}>Live companies</span>
          </div>
          {catDist.length === 0 ? (
            <div style={{ textAlign:'center', padding:'30px 0' }}>
              <i className="ti ti-chart-donut" style={{ fontSize:36, color:C.text3, display:'block', marginBottom:8 }}/>
              <p style={{ color:C.text3, fontSize:13, fontFamily:'DM Sans, sans-serif' }}>No data yet</p>
            </div>
          ) : catDist.map(([cat,count],i) => (
            <div key={cat} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:13 }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:catColors[i], flexShrink:0 }}/>
              <span style={{ fontSize:12, flex:1, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:'DM Sans, sans-serif' }}>{cat}</span>
              <div style={{ width:90, height:6, background:isDark?'rgba(255,255,255,0.06)':'#f1f5f9', borderRadius:3 }}>
                <div style={{ height:'100%', width:(count/Math.max(...catDist.map(c=>c[1]))*100)+'%', background:catColors[i], borderRadius:3 }}/>
              </div>
              <span style={{ fontSize:12, fontWeight:700, color:C.text, minWidth:20, textAlign:'right', fontFamily:'DM Sans, sans-serif' }}>{count}</span>
            </div>
          ))}
        </div>

      </div>

      {/* VERIFICATION TABLE + PLATFORM HEALTH */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>

        <div style={cardStyle}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <span style={{ fontSize:12, fontWeight:700, color:C.text, letterSpacing:'0.04em', textTransform:'uppercase', fontFamily:'DM Sans, sans-serif' }}>Verification Requests</span>
            <span onClick={()=>setPage&&setPage('applications')} style={{ fontSize:9, color:'#0099cc', cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>Table →</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 80px 70px 70px', gap:8, padding:'5px 10px', borderBottom:`0.5px solid ${C.border}`, fontSize:9, fontWeight:700, color:C.text3, letterSpacing:'0.05em', textTransform:'uppercase', fontFamily:'DM Sans, sans-serif' }}>
            <span>Business</span><span>Category</span><span>Date</span><span>Status</span>
          </div>
          {recentApps.length === 0 ? (
            <div style={{ textAlign:'center', padding:'20px 0', fontSize:11, color:C.text3, fontFamily:'DM Sans, sans-serif' }}>No applications yet</div>
          ) : recentApps.slice(0,4).map((app,i) => (
            <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 80px 70px 70px', gap:8, padding:'8px 10px', borderBottom:`0.5px solid ${C.border}`, fontSize:10, color:C.text2, alignItems:'center', fontFamily:'DM Sans, sans-serif' }}>
              <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                <div style={{ width:24, height:24, borderRadius:6, background:'rgba(56,189,248,0.12)', color:'#38bdf8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, flexShrink:0, fontFamily:'DM Sans, sans-serif' }}>
                  {(app.company_name||'?')[0].toUpperCase()}
                </div>
                <span style={{ color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:'DM Sans, sans-serif' }}>{app.company_name||'Unknown'}</span>
              </div>
              <span style={{ fontFamily:'DM Sans, sans-serif' }}>{app.category||'—'}</span>
              <span style={{ fontFamily:'DM Sans, sans-serif' }}>{app.submitted_at ? new Date(app.submitted_at).toLocaleDateString('en-AE',{month:'short',day:'numeric'}) : '—'}</span>
              <span style={{ background: app.status==='approved'?'rgba(74,222,128,0.12)':app.status==='rejected'?'rgba(248,113,113,0.12)':'rgba(251,191,36,0.12)', color: app.status==='approved'?'#4ade80':app.status==='rejected'?'#f87171':'#fbbf24', padding:'2px 7px', borderRadius:99, fontSize:9, fontWeight:700, display:'inline-block', fontFamily:'DM Sans, sans-serif' }}>
                {app.status||'Pending'}
              </span>
            </div>
          ))}
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize:12, fontWeight:700, color:C.text, letterSpacing:'0.04em', textTransform:'uppercase', marginBottom:12, fontFamily:'DM Sans, sans-serif' }}>Platform Health Monitor</div>
          {[
            { label:'Supabase DB',    status:'Online 99.9%', color:'#4ade80', pct:99 },
            { label:'Auth Service',   status:'Stable 8ms',   color:'#4ade80', pct:96 },
            { label:'Storage',        status:'12% Used',     color:'#fbbf24', pct:12 },
            { label:'Edge Functions', status:'Active 12ms',  color:'#4ade80', pct:98 },
            { label:'Vercel CDN',     status:'Optimized',    color:'#4ade80', pct:100 },
          ].map(h => (
            <div key={h.label} style={{ marginBottom:11 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ fontSize:11, color:C.text2, fontFamily:'DM Sans, sans-serif' }}>{h.label}</span>
                <span style={{ fontSize:10, color:h.color, fontWeight:600, fontFamily:'DM Sans, sans-serif' }}>{h.status}</span>
              </div>
              <div style={{ height:4, background:isDark?'rgba(255,255,255,0.06)':'#f1f5f9', borderRadius:99, overflow:'hidden' }}>
                <div style={{ height:'100%', width:h.pct+'%', background:h.color, borderRadius:99 }}/>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* RECENT REGISTRATIONS + TOP RATED */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>

        <div style={cardStyle}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <h3 style={{ fontSize:13, fontWeight:600, color:C.text, fontFamily:'DM Sans, sans-serif' }}>Recent Registrations</h3>
            <span style={{ background:isDark?'rgba(251,191,36,0.12)':'#fef9e7', color:'#fbbf24', fontSize:10, fontWeight:600, padding:'3px 10px', borderRadius:20, fontFamily:'DM Sans, sans-serif' }}>
              {recentRegs.filter(r=>r.status==='pending').length} pending
            </span>
          </div>
          {recentRegs.length === 0 ? (
            <div style={{ textAlign:'center', padding:'30px 0' }}>
              <i className="ti ti-clipboard-list" style={{ fontSize:36, color:C.text3, display:'block', marginBottom:8 }}/>
              <p style={{ color:C.text3, fontSize:13, fontFamily:'DM Sans, sans-serif' }}>No registrations yet</p>
            </div>
          ) : recentRegs.map(r => (
            <div key={r.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:`0.5px solid ${C.border}` }}>
              <div style={{ width:36, height:36, borderRadius:10, background:isDark?'rgba(74,222,128,0.1)':'#f0fdf4', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#4ade80', flexShrink:0, fontFamily:'DM Sans, sans-serif' }}>
                {r.company_name?.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:500, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:'DM Sans, sans-serif' }}>{r.company_name}</div>
                <div style={{ fontSize:10, color:C.text2, fontFamily:'DM Sans, sans-serif' }}>{r.category} · {r.area}</div>
              </div>
              <span style={{ background: r.status==='pending'?(isDark?'rgba(251,191,36,0.12)':'#fef9e7'):(isDark?'rgba(74,222,128,0.12)':'#f0fdf4'), color: r.status==='pending'?'#fbbf24':'#4ade80', fontSize:10, fontWeight:600, padding:'3px 8px', borderRadius:8, fontFamily:'DM Sans, sans-serif' }}>{r.status}</span>
            </div>
          ))}
        </div>

        <div style={cardStyle}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <h3 style={{ fontSize:13, fontWeight:600, color:C.text, fontFamily:'DM Sans, sans-serif' }}>Top Rated Companies</h3>
            <span style={{ fontSize:10, color:C.text3, background:C.row, padding:'3px 10px', borderRadius:20, border:`0.5px solid ${C.border}`, fontFamily:'DM Sans, sans-serif' }}>By rating</span>
          </div>
          {topCompanies.length === 0 ? (
            <div style={{ textAlign:'center', padding:'30px 0' }}>
              <i className="ti ti-trophy" style={{ fontSize:36, color:C.text3, display:'block', marginBottom:8 }}/>
              <p style={{ color:C.text3, fontSize:13, fontFamily:'DM Sans, sans-serif' }}>No companies yet</p>
            </div>
          ) : topCompanies.map((c,i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:`0.5px solid ${C.border}` }}>
              <div style={{ width:26, height:26, borderRadius:'50%', background: i===0?(isDark?'rgba(251,191,36,0.15)':'#fef9e7'):C.row, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color: i===0?'#fbbf24':C.text3, border:`0.5px solid ${C.border}`, fontFamily:'DM Sans, sans-serif' }}>
                {i+1}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:500, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:5, fontFamily:'DM Sans, sans-serif' }}>
                  {c.name}
                  {c.is_verified && <i className="ti ti-rosette-discount-check" style={{ fontSize:13, color:'#4ade80' }}/>}
                </div>
                <div style={{ fontSize:10, color:C.text2, fontFamily:'DM Sans, sans-serif' }}>{c.category} · {c.total_reviews||0} reviews</div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:3, background:isDark?'rgba(251,191,36,0.1)':'#fef9e7', padding:'3px 9px', borderRadius:8 }}>
                <span style={{ color:'#fbbf24', fontSize:12 }}>★</span>
                <span style={{ fontSize:13, fontWeight:700, color:'#fbbf24', fontFamily:'DM Sans, sans-serif' }}>{c.avg_rating||'0.0'}</span>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* REVIEW MODERATION QUEUE */}
      <div style={{ ...cardStyle, marginBottom:14 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
          <span style={{ fontSize:12, fontWeight:700, color:C.text, letterSpacing:'0.04em', textTransform:'uppercase', fontFamily:'DM Sans, sans-serif' }}>Review Moderation Queue</span>
          <span onClick={()=>setPage&&setPage('reviews')} style={{ fontSize:9, color:'#0099cc', cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>View all →</span>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 110px 100px 80px 110px', gap:8, padding:'5px 10px', borderBottom:`0.5px solid ${C.border}`, fontSize:9, fontWeight:700, color:C.text3, letterSpacing:'0.05em', textTransform:'uppercase', fontFamily:'DM Sans, sans-serif' }}>
          <span>Content Preview</span><span>Author</span><span>AI Confidence</span><span>Type</span><span>Actions</span>
        </div>
        {recentReviews.length === 0 ? (
          <div style={{ padding:'16px 10px', fontSize:10, color:C.text3, fontFamily:'DM Sans, sans-serif' }}>No reviews in moderation queue.</div>
        ) : recentReviews.slice(0,3).map((r,i) => (
          <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 110px 100px 80px 110px', gap:8, padding:'8px 10px', borderBottom:`0.5px solid ${C.border}`, fontSize:10, color:C.text2, alignItems:'center', fontFamily:'DM Sans, sans-serif' }}>
            <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:C.text }}>{(r.review_text||'').slice(0,50)}...</span>
            <span>@{(r.reviewer_name||'anon').replace(/\s/g,'').toLowerCase()}</span>
            <div>
              <div style={{ fontSize:9, color:'#4ade80', marginBottom:2, fontFamily:'DM Sans, sans-serif' }}>94%</div>
              <div style={{ height:4, background:isDark?'rgba(255,255,255,0.06)':'#f1f5f9', borderRadius:99 }}>
                <div style={{ width:'94%', height:'100%', background:'#4ade80', borderRadius:99 }}/>
              </div>
            </div>
            <span style={{ background:'rgba(74,222,128,0.1)', color:'#4ade80', padding:'2px 6px', borderRadius:4, fontSize:9, fontWeight:600, fontFamily:'DM Sans, sans-serif' }}>Safe</span>
            <div style={{ display:'flex', gap:5 }}>
              <span style={{ background:'rgba(74,222,128,0.12)', color:'#4ade80', borderRadius:5, padding:'3px 8px', fontSize:9, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>Approve</span>
              <span style={{ background:'rgba(239,68,68,0.1)', color:'#f87171', borderRadius:5, padding:'3px 8px', fontSize:9, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>Reject</span>
            </div>
          </div>
        ))}
      </div>

      {/* LATEST REVIEWS */}
      <div style={cardStyle}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <h3 style={{ fontSize:13, fontWeight:600, color:C.text, fontFamily:'DM Sans, sans-serif' }}>Latest Reviews</h3>
          <span style={{ fontSize:10, color:C.text3, background:C.row, padding:'3px 10px', borderRadius:20, border:`0.5px solid ${C.border}`, fontFamily:'DM Sans, sans-serif' }}>Last 5</span>
        </div>
        {recentReviews.length === 0 ? (
          <div style={{ textAlign:'center', padding:'30px 0' }}>
            <i className="ti ti-message" style={{ fontSize:36, color:C.text3, display:'block', marginBottom:8 }}/>
            <p style={{ color:C.text3, fontSize:13, fontFamily:'DM Sans, sans-serif' }}>No reviews yet</p>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10 }}>
            {recentReviews.map(r => (
              <div key={r.id} style={{ background:C.row, borderRadius:12, padding:14, border:`0.5px solid ${C.border}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                  <span style={{ color:'#fbbf24', fontSize:13 }}>{'★'.repeat(r.rating)}<span style={{ color:C.border }}>{'★'.repeat(5-r.rating)}</span></span>
                  <span style={{ fontSize:10, color:C.text3, fontFamily:'DM Sans, sans-serif' }}>{new Date(r.created_at).toLocaleDateString('en-AE',{month:'short',day:'numeric'})}</span>
                </div>
                <div style={{ fontSize:12, fontWeight:600, color:C.text, marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:'DM Sans, sans-serif' }}>{r.companies?.name||'Unknown'}</div>
                <div style={{ fontSize:11, color:C.text2, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', lineHeight:1.5, fontFamily:'DM Sans, sans-serif' }}>{r.review_text}</div>
                <div style={{ fontSize:10, color:C.text3, marginTop:8, paddingTop:8, borderTop:`0.5px solid ${C.border}`, fontFamily:'DM Sans, sans-serif' }}>— {r.reviewer_name}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* REFRESH */}
      <div style={{ textAlign:'center', marginTop:16 }}>
        <button onClick={fetchAll}
          style={{ padding:'9px 24px', background:isDark?'rgba(74,222,128,0.08)':'#f0fdf4', border:`0.5px solid ${isDark?'rgba(74,222,128,0.2)':'#a7f3d0'}`, borderRadius:20, fontSize:12, color:'#4ade80', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:7, fontWeight:500, fontFamily:'DM Sans, sans-serif' }}>
          <i className="ti ti-refresh" style={{ fontSize:14 }}/> Refresh Data
        </button>
      </div>

    </div>
  )
}
