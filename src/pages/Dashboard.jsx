import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

/* ============================== helpers ============================== */
function AnimatedNumber({ value, decimals = 0, duration = 900 }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    let raf
    const target = parseFloat(value) || 0
    const t0 = performance.now()
    const step = (t) => {
      const p = Math.min((t - t0) / duration, 1)
      const e = 1 - Math.pow(1 - p, 3)
      setDisplay(target * e)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <span>{decimals ? display.toFixed(decimals) : Math.round(display).toLocaleString()}</span>
}

function Sparkline({ data, color, width = 90, height = 32 }) {
  if (!data || data.length < 2) {
    return <svg width={width} height={height}><line x1="0" y1={height/2} x2={width} y2={height/2} stroke={color} strokeWidth="1.5" opacity="0.25" strokeDasharray="3,3"/></svg>
  }
  const max = Math.max(...data), min = Math.min(...data), range = max - min || 1
  const pts = data.map((v,i) => `${(i/(data.length-1))*width},${height-((v-min)/range)*(height-6)-3}`).join(' ')
  const areaPts = `0,${height} ${pts} ${width},${height}`
  const lastY = height-((data[data.length-1]-min)/range)*(height-6)-3
  const gid = 'spk' + color.replace('#','')
  return (
    <svg width={width} height={height} style={{ overflow:'visible' }}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.25"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
      <polygon points={areaPts} fill={`url(#${gid})`}/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={width} cy={lastY} r="2.5" fill={color}/>
    </svg>
  )
}

function Donut({ segments, total, label, size = 150, isDark }) {
  const r = size/2 - 16, cx = size/2, cy = size/2, circ = 2*Math.PI*r
  let offset = 0
  const sum = segments.reduce((s,x)=>s+x.value,0) || 1
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={isDark?'rgba(255,255,255,0.05)':'#f1f5f9'} strokeWidth="14"/>
      {segments.map((seg,i) => {
        const frac = seg.value/sum
        const dash = frac*circ
        const el = <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth="14" strokeDasharray={`${dash} ${circ-dash}`} strokeDashoffset={-offset} transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="butt"/>
        offset += dash
        return el
      })}
      <text x={cx} y={cy-4} textAnchor="middle" fontSize="20" fontWeight="700" fill={isDark?'#f1f5f9':'#0f172a'}>{total}</text>
      <text x={cx} y={cy+14} textAnchor="middle" fontSize="9" fill={isDark?'#6b7280':'#94a3b8'}>{label}</text>
    </svg>
  )
}

function DualLineChart({ series, color1, color2, isDark, height = 180 }) {
  // series: [{ a, b }] where a=count, b=rating(0-5 scaled)
  if (!series || series.length < 2) return <div style={{ height, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:isDark?'#6b7280':'#94a3b8' }}>Not enough data yet</div>
  const w = 1000, h = 220, pad = 8
  const aVals = series.map(s=>s.a), bVals = series.map(s=>s.b)
  const aMax = Math.max(...aVals, 1), bMax = Math.max(...bVals, 1)
  const x = i => (i/(series.length-1))*(w)
  const ya = v => h - (v/aMax)*(h-pad*2) - pad
  const yb = v => h - (v/bMax)*(h-pad*2) - pad
  const lineA = series.map((s,i)=>`${x(i)},${ya(s.a)}`).join(' ')
  const lineB = series.map((s,i)=>`${x(i)},${yb(s.b)}`).join(' ')
  const areaA = `0,${h} ${lineA} ${w},${h}`
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display:'block' }}>
      <defs><linearGradient id="lcA" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color1} stopOpacity="0.18"/><stop offset="100%" stopColor={color1} stopOpacity="0"/></linearGradient></defs>
      {[0,0.5,1].map(f => <line key={f} x1="0" y1={h*f} x2={w} y2={h*f} stroke={isDark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.05)'} strokeWidth="1"/>)}
      <polygon points={areaA} fill="url(#lcA)"/>
      <polyline points={lineA} fill="none" stroke={color1} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
      <polyline points={lineB} fill="none" stroke={color2} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
    </svg>
  )
}

function BarChart({ data, color, isDark, height = 170 }) {
  // data: [{ label, value }]
  if (!data || data.length === 0) return <div style={{ height, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:isDark?'#6b7280':'#94a3b8' }}>No data yet</div>
  const max = Math.max(...data.map(d=>d.value), 1)
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:10, height, padding:'0 4px' }}>
      {data.map((d,i) => (
        <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:6, height:'100%', justifyContent:'flex-end' }}>
          <div style={{ fontSize:10, fontWeight:700, color:isDark?'#9ca3af':'#64748b' }}>{d.value}</div>
          <div style={{ width:'70%', maxWidth:34, height:`${Math.max(4,(d.value/max)*(height-40))}px`, background:`linear-gradient(180deg, ${color}, ${color}aa)`, borderRadius:'6px 6px 0 0', transition:'height 1s cubic-bezier(.3,1,.4,1)' }}/>
          <div style={{ fontSize:9, color:isDark?'#6b7280':'#94a3b8' }}>{d.label}</div>
        </div>
      ))}
    </div>
  )
}

function Clock({ isDark }) {
  const ref = useRef(null)
  useEffect(() => {
    const tick = () => { if (ref.current) ref.current.textContent = new Date().toLocaleTimeString('en-AE',{hour:'2-digit',minute:'2-digit',second:'2-digit'}) + ' · GMT+4' }
    tick(); const t = setInterval(tick,1000); return () => clearInterval(t)
  }, [])
  return <span ref={ref} style={{ fontSize:11, color:isDark?'#9ca3af':'#64748b', fontVariantNumeric:'tabular-nums' }}/>
}

function timeAgo(d) {
  const s = Math.floor((Date.now() - new Date(d).getTime())/1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s/60); if (m < 60) return `${m} min ago`
  const h = Math.floor(m/60); if (h < 24) return `${h} hr ago`
  const days = Math.floor(h/24); return `${days} day${days>1?'s':''} ago`
}

/* ============================== main ============================== */
export default function Dashboard({ setPage, setPlanFilter, theme, adminData }) {
  const isDark = theme !== 'light'  // default dark (mockup is dark)
  const adminName = adminData?.name || adminData?.full_name || 'Admin'

  // vw only used for chart numeric sizing (heights/donut/sparkline). Layout = pure CSS media queries.
  const [vw, setVw] = useState(typeof window !== 'undefined' ? window.innerWidth : 1280)
  useEffect(() => { const r = () => setVw(window.innerWidth); window.addEventListener('resize', r); return () => window.removeEventListener('resize', r) }, [])
  const mobile = vw < 768

  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    reviews:0, companies:0, customers:0, enquiries:0, avgRating:'0.0',
    pendingReviews:0, pendingBiz:0, reportedReviews:0, unreadEnquiries:0,
  })
  const [delta, setDelta] = useState({ reviews:0, companies:0, customers:0, enquiries:0, rating:0 })
  const [spark, setSpark] = useState({ reviews:[], companies:[], customers:[], enquiries:[], rating:[] })
  const [reviewSeries, setReviewSeries] = useState([])
  const [catSegments, setCatSegments] = useState([])
  const [recentReviews, setRecentReviews] = useState([])
  const [growth, setGrowth] = useState([])
  const [demo, setDemo] = useState({ nationality:[], gender:[] })
  const [activity, setActivity] = useState([])

  useEffect(() => { fetchAll() }, [])

  function pctChange(now, prev) {
    if (prev === 0) return now > 0 ? 100 : 0
    return ((now - prev) / prev) * 100
  }

  async function fetchAll() {
    setLoading(true)
    try {
      const now = new Date()
      const iso = (n) => new Date(now.getTime() - n*864e5).toISOString()

      const [
        { count: cReviews }, { count: cCompanies }, { count: cCustomers },
        { count: cEnquiries }, { data: ratingRows },
        { count: pendReviews }, { count: pendBiz },
        { data: revRows }, { data: coRows }, { data: custRows }, { data: enqRows },
        { data: recentRev }, { data: catRows },
      ] = await Promise.all([
        supabase.from('reviews').select('*',{count:'exact',head:true}).eq('is_approved',true),
        supabase.from('companies').select('*',{count:'exact',head:true}).eq('status','approved'),
        supabase.from('customers').select('*',{count:'exact',head:true}),
        supabase.from('lead_submissions').select('*',{count:'exact',head:true}),
        supabase.from('reviews').select('rating').eq('is_approved',true),
        supabase.from('reviews').select('*',{count:'exact',head:true}).eq('is_approved',false),
        supabase.from('company_applications').select('*',{count:'exact',head:true}).eq('status','pending'),
        supabase.from('reviews').select('created_at,rating').gte('created_at', iso(60)),
        supabase.from('companies').select('created_at').eq('status','approved').gte('created_at', iso(190)),
        supabase.from('customers').select('created_at,nationality,gender').gte('created_at', iso(60)),
        supabase.from('lead_submissions').select('created_at').gte('created_at', iso(60)),
        supabase.from('reviews').select('id,reviewer_name,rating,review_text,created_at,companies(name,category)').eq('is_approved',true).order('created_at',{ascending:false}).limit(5),
        supabase.from('companies').select('category').eq('status','approved'),
      ])

      const avg = ratingRows?.length ? (ratingRows.reduce((s,r)=>s+r.rating,0)/ratingRows.length).toFixed(1) : '0.0'

      // counts in window helper
      const inWin = (rows, fromDays, toDays) => (rows||[]).filter(r => {
        const t = new Date(r.created_at).getTime()
        return t >= now.getTime()-fromDays*864e5 && t < now.getTime()-toDays*864e5
      }).length

      // 30d vs prior-30d deltas (real)
      const dRev = pctChange(inWin(revRows,30,0), inWin(revRows,60,30))
      const dCust = pctChange(inWin(custRows,30,0), inWin(custRows,60,30))
      const dEnq = pctChange(inWin(enqRows,30,0), inWin(enqRows,60,30))
      const dCo = pctChange(inWin(coRows,30,0), inWin(coRows,60,30))

      // sparklines: daily counts last 14 days
      const dailyCounts = (rows) => {
        const days = {}
        for (let i=13;i>=0;i--) days[iso(i).slice(0,10)] = 0
        ;(rows||[]).forEach(r => { const k = (r.created_at||'').slice(0,10); if (days[k]!==undefined) days[k]++ })
        return Object.values(days)
      }

      // review series last 30 days (count + avg rating per day)
      const rs = []
      for (let i=29;i>=0;i--) {
        const day = iso(i).slice(0,10)
        const dayRows = (revRows||[]).filter(r => (r.created_at||'').slice(0,10)===day)
        const cnt = dayRows.length
        const rAvg = cnt ? dayRows.reduce((s,r)=>s+r.rating,0)/cnt : 0
        rs.push({ a: cnt, b: rAvg })
      }
      setReviewSeries(rs)

      // category donut (companies grouped by category, top 5 + others)
      const catMap = {}
      ;(catRows||[]).forEach(c => { const k = c.category||'Other'; catMap[k]=(catMap[k]||0)+1 })
      const sortedCats = Object.entries(catMap).sort((a,b)=>b[1]-a[1])
      const top = sortedCats.slice(0,5)
      const otherTotal = sortedCats.slice(5).reduce((s,[,v])=>s+v,0)
      const palette = ['#22c55e','#3b82f6','#ec4899','#f59e0b','#a855f7','#64748b']
      const segs = top.map(([name,value],i)=>({ name, value, color: palette[i] }))
      if (otherTotal>0) segs.push({ name:'Others', value:otherTotal, color: palette[5] })
      setCatSegments(segs)

      // businesses growth — last 6 months
      const months = []
      for (let i=5;i>=0;i--) {
        const dt = new Date(now.getFullYear(), now.getMonth()-i, 1)
        const key = dt.toISOString().slice(0,7)
        const label = dt.toLocaleDateString('en-AE',{month:'short'})
        const value = (coRows||[]).filter(c => (c.created_at||'').slice(0,7)===key).length
        months.push({ label, value })
      }
      setGrowth(months)

      // demographics (reads new columns; empty until collected)
      const natMap = {}, genMap = {}
      ;(custRows||[]).forEach(c => {
        if (c.nationality) natMap[c.nationality] = (natMap[c.nationality]||0)+1
        if (c.gender) genMap[c.gender] = (genMap[c.gender]||0)+1
      })
      const natArr = Object.entries(natMap).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,value])=>({name,value}))
      const genArr = Object.entries(genMap).map(([name,value])=>({name,value}))
      setDemo({ nationality:natArr, gender:genArr })

      // activity feed — merge recent companies + reviews
      const feed = []
      ;(recentRev||[]).forEach(r => feed.push({ type:'review', icon:'ti-star', color:'#f59e0b', text:`New review for "${r.companies?.name||'a business'}"`, time:r.created_at }))
      ;(coRows||[]).slice(-4).forEach(c => feed.push({ type:'biz', icon:'ti-building-store', color:'#22c55e', text:`New business registered`, time:c.created_at }))
      feed.sort((a,b)=> new Date(b.time) - new Date(a.time))
      setActivity(feed.slice(0,6))

      setStats({
        reviews: cReviews||0, companies: cCompanies||0, customers: cCustomers||0,
        enquiries: cEnquiries||0, avgRating: avg,
        pendingReviews: pendReviews||0, pendingBiz: pendBiz||0,
        reportedReviews: 0, unreadEnquiries: inWin(enqRows,30,0),
      })
      setDelta({ reviews:dRev, companies:dCo, customers:dCust, enquiries:dEnq, rating:0 })
      setSpark({
        reviews: dailyCounts(revRows), companies: dailyCounts(coRows),
        customers: dailyCounts(custRows), enquiries: dailyCounts(enqRows),
        rating: rs.map(s=>s.b),
      })
      setRecentReviews(recentRev||[])
    } catch (e) { console.error('Dashboard fetch error:', e) }
    finally { setLoading(false) }
  }

  /* ---------- theme tokens ---------- */
  const C = {
    text:   isDark ? '#f1f5f9' : '#0f172a',
    text2:  isDark ? '#9ca3af' : '#475569',
    text3:  isDark ? '#6b7280' : '#94a3b8',
    border: isDark ? 'rgba(255,255,255,0.07)' : '#e5e9f0',
    card:   isDark ? '#141921' : '#ffffff',
    bg:     isDark ? '#0a0e14' : '#f4f6fa',
    row:    isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
    shadow: isDark ? '0 4px 24px rgba(0,0,0,0.3)' : '0 1px 10px rgba(0,0,0,0.05)',
    bar:    isDark ? 'rgba(255,255,255,0.06)' : '#eef2f7',
    green:'#22c55e', blue:'#3b82f6', purple:'#a855f7', gold:'#f59e0b', cyan:'#06b6d4', pink:'#ec4899', red:'#ef4444',
  }
  const cardStyle = { background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:'16px 18px', boxShadow:C.shadow, minWidth:0 }
  const H = ({ children, right }) => (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, gap:8 }}>
      <span style={{ fontSize:14, fontWeight:700, color:C.text }}>{children}</span>{right}
    </div>
  )

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'80vh' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:38, height:38, border:`3px solid ${C.green}`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 12px' }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ fontSize:13, color:C.text3 }}>Loading dashboard...</div>
      </div>
    </div>
  )

  const STAT_CARDS = [
    { label:'Total Reviews',    value:stats.reviews,    icon:'ti-star',           color:C.green,  delta:delta.reviews,    spark:spark.reviews,    page:'reviews' },
    { label:'Total Businesses', value:stats.companies,  icon:'ti-building-store', color:C.blue,   delta:delta.companies,  spark:spark.companies,  page:'companies' },
    { label:'Total Users',      value:stats.customers,  icon:'ti-users',          color:C.purple, delta:delta.customers,  spark:spark.customers,  page:'users' },
    { label:'Avg. Rating',      value:stats.avgRating,  icon:'ti-star-filled',    color:C.gold,   delta:delta.rating,     spark:spark.rating,     isRating:true },
    { label:'Enquiries',        value:stats.enquiries,  icon:'ti-headset',        color:C.cyan,   delta:delta.enquiries,  spark:spark.enquiries,  page:'leads' },
  ]

  const ALERTS = [
    { label:'Pending Reviews',   value:stats.pendingReviews,  icon:'ti-clock',          color:C.gold,  page:'reviews' },
    { label:'Pending Businesses',value:stats.pendingBiz,      icon:'ti-building',       color:C.blue,  page:'applications' },
    { label:'Reported Reviews',  value:stats.reportedReviews, icon:'ti-flag',           color:C.red,   page:'reviews' },
    { label:'Unread Enquiries',  value:stats.unreadEnquiries, icon:'ti-message',        color:C.purple,page:'leads' },
  ]

  const fmtPct = (p) => `${p>=0?'+':''}${p.toFixed(1)}%`

  return (
    <div className="cc-root" style={{ color:C.text, width:'100%', maxWidth:1500, margin:'0 auto' }}>
      <style>{CC_CSS}</style>

      {/* HEADER */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12, marginBottom:18 }}>
        <div style={{ minWidth:0 }}>
          <h1 style={{ fontSize: mobile?20:24, fontWeight:800, color:C.text, margin:0 }}>Welcome back, {adminName}! 👋</h1>
          <p style={{ fontSize:13, color:C.text2, marginTop:4 }}>Here's what's happening with your platform today.</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:'8px 12px' }}>
            <i className="ti ti-calendar" style={{ fontSize:13, color:C.green }}/>
            <Clock isDark={isDark}/>
          </div>
          <button onClick={fetchAll} style={{ display:'flex', alignItems:'center', gap:6, background:C.green, color:'#fff', border:'none', borderRadius:10, padding:'9px 16px', fontSize:13, fontWeight:600, cursor:'pointer' }}>
            <i className="ti ti-refresh" style={{ fontSize:14 }}/> Refresh
          </button>
        </div>
      </div>

      {/* 5 STAT CARDS */}
      <div className="cc-grid-stats" style={{ marginBottom:14 }}>
        {STAT_CARDS.map((s,i) => (
          <div key={i} onClick={()=> s.page && setPage && setPage(s.page)}
            style={{ ...cardStyle, cursor: s.page?'pointer':'default', transition:'all .15s' }}
            onMouseEnter={e=>{ e.currentTarget.style.borderColor=s.color+'66'; e.currentTarget.style.transform='translateY(-2px)' }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor=C.border; e.currentTarget.style.transform='none' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <span style={{ fontSize:12, color:C.text2, fontWeight:500 }}>{s.label}</span>
              <div style={{ width:34, height:34, borderRadius:10, background:s.color+'1e', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <i className={`ti ${s.icon}`} style={{ fontSize:17, color:s.color }}/>
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:4 }}>
              <span style={{ fontSize:26, fontWeight:800, color:C.text, lineHeight:1 }}>
                {s.isRating ? <AnimatedNumber value={s.value} decimals={1}/> : <AnimatedNumber value={s.value}/>}
              </span>
              {s.isRating && <span style={{ color:C.gold, fontSize:13 }}>{'★'.repeat(Math.round(parseFloat(s.value)))}</span>}
            </div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6 }}>
              {!s.isRating ? (
                <span style={{ fontSize:11, fontWeight:600, color: s.delta>=0?C.green:C.red, display:'flex', alignItems:'center', gap:2 }}>
                  <i className={`ti ${s.delta>=0?'ti-trending-up':'ti-trending-down'}`} style={{ fontSize:12 }}/>
                  {fmtPct(s.delta)} <span style={{ color:C.text3, fontWeight:400 }}>30d</span>
                </span>
              ) : <span style={{ fontSize:11, color:C.text3 }}>across {stats.reviews} reviews</span>}
              <Sparkline data={s.spark} color={s.color} width={mobile?60:80} height={28}/>
            </div>
          </div>
        ))}
      </div>

      {/* ROW 2: Reviews chart | Categories donut | Recent reviews */}
      <div className="cc-grid-row2" style={{ marginBottom:14 }}>
        {/* Reviews & Ratings Overview */}
        <div className="cc-row2-main" style={cardStyle}>
          <H right={<div style={{ display:'flex', gap:12, fontSize:11 }}>
            <span style={{ display:'flex', alignItems:'center', gap:5, color:C.text2 }}><span style={{ width:9, height:9, borderRadius:'50%', background:C.green }}/>Reviews</span>
            <span style={{ display:'flex', alignItems:'center', gap:5, color:C.text2 }}><span style={{ width:9, height:9, borderRadius:'50%', background:C.purple }}/>Ratings</span>
          </div>}>Reviews &amp; Ratings Overview</H>
          <DualLineChart series={reviewSeries} color1={C.green} color2={C.purple} isDark={isDark} height={mobile?150:190}/>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:8, fontSize:9, color:C.text3 }}>
            <span>30 days ago</span><span>15 days ago</span><span>Today</span>
          </div>
        </div>

        {/* Top Service Categories */}
        <div style={cardStyle}>
          <H>Top Service Categories</H>
          {catSegments.length===0 ? (
            <div style={{ textAlign:'center', padding:'30px 0', color:C.text3, fontSize:12 }}>No categories yet</div>
          ) : (
            <div style={{ display:'flex', alignItems:'center', gap:14, flexWrap:'wrap', justifyContent:'center' }}>
              <Donut segments={catSegments} total={stats.companies} label="Businesses" isDark={isDark} size={mobile?130:140}/>
              <div style={{ flex:1, minWidth:120 }}>
                {catSegments.map((seg,i) => {
                  const sum = catSegments.reduce((s,x)=>s+x.value,0)||1
                  return (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:7, marginBottom:8, fontSize:11.5 }}>
                      <span style={{ width:9, height:9, borderRadius:'50%', background:seg.color, flexShrink:0 }}/>
                      <span style={{ color:C.text2, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{seg.name}</span>
                      <span style={{ color:C.text, fontWeight:700 }}>{Math.round(seg.value/sum*100)}%</span>
                      <span style={{ color:C.text3, fontSize:10 }}>({seg.value})</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Recent Reviews */}
        <div style={cardStyle}>
          <H right={<span onClick={()=>setPage&&setPage('reviews')} style={{ fontSize:11, color:C.green, cursor:'pointer', fontWeight:600 }}>View All</span>}>Recent Reviews</H>
          {recentReviews.length===0 ? (
            <div style={{ textAlign:'center', padding:'30px 0', color:C.text3, fontSize:12 }}>No reviews yet</div>
          ) : recentReviews.map(r => (
            <div key={r.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:`1px solid ${C.border}` }}>
              <div style={{ width:34, height:34, borderRadius:9, background:C.green+'1e', color:C.green, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, flexShrink:0 }}>
                {(r.companies?.name||'?')[0].toUpperCase()}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12.5, fontWeight:600, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.companies?.name||'Unknown'}</div>
                <div style={{ fontSize:10.5, color:C.text3 }}>{r.companies?.category||'—'} · {timeAgo(r.created_at)}</div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ color:C.gold, fontSize:11 }}>{'★'.repeat(r.rating)}</div>
                <div style={{ fontSize:11, fontWeight:700, color:C.text }}>{r.rating}.0</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ROW 3: Businesses growth | Demographics | Activity feed */}
      <div className="cc-grid-row3" style={{ marginBottom:14 }}>
        {/* Businesses Growth */}
        <div style={cardStyle}>
          <H right={<span style={{ fontSize:10, color:C.text3, background:C.row, padding:'3px 10px', borderRadius:20, border:`1px solid ${C.border}` }}>6 months</span>}>Businesses Growth</H>
          <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:10, flexWrap:'wrap' }}>
            <span style={{ fontSize:24, fontWeight:800, color:C.text }}><AnimatedNumber value={stats.companies}/></span>
            <span style={{ fontSize:11, color:C.text3 }}>total businesses</span>
            <span style={{ fontSize:11, fontWeight:600, color: delta.companies>=0?C.green:C.red, marginLeft:'auto' }}>{fmtPct(delta.companies)}</span>
          </div>
          <BarChart data={growth} color={C.green} isDark={isDark} height={mobile?140:160}/>
        </div>

        {/* User Demographics */}
        <div style={cardStyle}>
          <H right={<span onClick={()=>setPage&&setPage('users')} style={{ fontSize:11, color:C.green, cursor:'pointer', fontWeight:600 }}>View Details</span>}>User Demographics</H>
          {(demo.nationality.length===0 && demo.gender.length===0) ? (
            <div style={{ textAlign:'center', padding:'24px 12px' }}>
              <i className="ti ti-chart-pie" style={{ fontSize:32, color:C.text3, display:'block', marginBottom:8 }}/>
              <div style={{ fontSize:12, color:C.text2, fontWeight:600, marginBottom:3 }}>Collecting data…</div>
              <div style={{ fontSize:10.5, color:C.text3, lineHeight:1.5 }}>Nationality &amp; gender will appear here once users start sharing it at sign-in.</div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize:10.5, color:C.text3, fontWeight:600, marginBottom:8, textTransform:'uppercase', letterSpacing:'0.04em' }}>By Nationality</div>
              {demo.nationality.map((n,i) => {
                const sum = demo.nationality.reduce((s,x)=>s+x.value,0)||1
                return (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7 }}>
                    <span style={{ fontSize:11, color:C.text2, width:80, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{n.name}</span>
                    <div style={{ flex:1, height:6, background:C.bar, borderRadius:99, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${Math.round(n.value/sum*100)}%`, background:C.green, borderRadius:99 }}/>
                    </div>
                    <span style={{ fontSize:11, fontWeight:700, color:C.text, width:34, textAlign:'right' }}>{Math.round(n.value/sum*100)}%</span>
                  </div>
                )
              })}
              {demo.gender.length>0 && (
                <div style={{ marginTop:12, paddingTop:12, borderTop:`1px solid ${C.border}`, display:'flex', gap:16, justifyContent:'center' }}>
                  {demo.gender.map((g,i) => {
                    const sum = demo.gender.reduce((s,x)=>s+x.value,0)||1
                    return <div key={i} style={{ textAlign:'center' }}><div style={{ fontSize:18, fontWeight:800, color:i===0?C.blue:C.pink }}>{Math.round(g.value/sum*100)}%</div><div style={{ fontSize:10, color:C.text3 }}>{g.name}</div></div>
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Platform Activity */}
        <div style={cardStyle}>
          <H right={<span style={{ fontSize:10, color:C.green, display:'flex', alignItems:'center', gap:4 }}><span style={{ width:7, height:7, borderRadius:'50%', background:C.green, display:'inline-block' }}/>Live</span>}>Platform Activity</H>
          {activity.length===0 ? (
            <div style={{ textAlign:'center', padding:'30px 0', color:C.text3, fontSize:12 }}>No recent activity</div>
          ) : activity.map((a,i) => (
            <div key={i} style={{ display:'flex', gap:10, padding:'9px 0', borderBottom: i<activity.length-1?`1px solid ${C.border}`:'none' }}>
              <div style={{ width:30, height:30, borderRadius:8, background:a.color+'1e', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <i className={`ti ${a.icon}`} style={{ fontSize:14, color:a.color }}/>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:11.5, color:C.text, lineHeight:1.4 }}>{a.text}</div>
                <div style={{ fontSize:10, color:C.text3, marginTop:2 }}>{timeAgo(a.time)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* BOTTOM: 4 alert cards */}
      <div className="cc-grid-alerts">
        {ALERTS.map((a,i) => (
          <div key={i} onClick={()=>setPage&&setPage(a.page)}
            style={{ ...cardStyle, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, borderColor:a.color+'33', transition:'all .15s' }}
            onMouseEnter={e=>{ e.currentTarget.style.borderColor=a.color+'88'; e.currentTarget.style.transform='translateY(-2px)' }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor=a.color+'33'; e.currentTarget.style.transform='none' }}>
            <div style={{ display:'flex', alignItems:'center', gap:11, minWidth:0 }}>
              <div style={{ width:42, height:42, borderRadius:11, background:a.color+'1e', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <i className={`ti ${a.icon}`} style={{ fontSize:19, color:a.color }}/>
              </div>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:22, fontWeight:800, color:C.text, lineHeight:1 }}><AnimatedNumber value={a.value}/></div>
                <div style={{ fontSize:11, color:C.text2, marginTop:3 }}>{a.label}</div>
              </div>
            </div>
            <span style={{ fontSize:11, color:a.color, fontWeight:600, whiteSpace:'nowrap', flexShrink:0 }}>View All →</span>
          </div>
        ))}
      </div>

    </div>
  )
}

/* ====================== RESPONSIVE LAYOUT (CSS) ======================
   Pure CSS media queries — fixes resolution across phone/tablet/iPad/
   laptop/desktop/big PC. Data logic above is untouched.
   ==================================================================== */
const CC_CSS = `
.cc-root *{box-sizing:border-box;}
.cc-grid-stats{display:grid;gap:14px;grid-template-columns:repeat(5,1fr);}
.cc-grid-row2{display:grid;gap:14px;grid-template-columns:1.6fr 1fr 1fr;}
.cc-grid-row3{display:grid;gap:14px;grid-template-columns:repeat(3,1fr);}
.cc-grid-alerts{display:grid;gap:14px;grid-template-columns:repeat(4,1fr);}
.cc-grid-stats>*,.cc-grid-row2>*,.cc-grid-row3>*,.cc-grid-alerts>*{min-width:0;}

/* laptop / small desktop */
@media (max-width:1280px){
  .cc-grid-stats{grid-template-columns:repeat(3,1fr);}
  .cc-grid-row2{grid-template-columns:1fr 1fr;}
  .cc-row2-main{grid-column:span 2;}
  .cc-grid-row3{grid-template-columns:repeat(2,1fr);}
  .cc-grid-alerts{grid-template-columns:repeat(2,1fr);}
}
/* tablet / iPad portrait */
@media (max-width:900px){
  .cc-grid-row3{grid-template-columns:1fr;}
}
/* large phone / small tablet */
@media (max-width:768px){
  .cc-grid-stats{grid-template-columns:repeat(2,1fr);}
  .cc-grid-row2{grid-template-columns:1fr;}
  .cc-row2-main{grid-column:auto;}
}
/* phone */
@media (max-width:480px){
  .cc-grid-alerts{grid-template-columns:1fr;}
}
/* small phone */
@media (max-width:380px){
  .cc-grid-stats{grid-template-columns:1fr;}
}
/* big PC — keep cards from stretching too wide */
@media (min-width:1700px){
  .cc-grid-stats{gap:16px;}
}
`
