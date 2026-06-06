import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

/* ============================== helpers ============================== */
function AnimatedNumber({ value, prefix = '', suffix = '', duration = 900 }) {
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
  return <span>{prefix}{Math.round(display).toLocaleString()}{suffix}</span>
}

function Sparkline({ data, color, width = 80, height = 28 }) {
  if (!data || data.length < 2) return <svg width={width} height={height}><line x1="0" y1={height/2} x2={width} y2={height/2} stroke={color} strokeWidth="1.5" opacity="0.25" strokeDasharray="3,3"/></svg>
  const max = Math.max(...data), min = Math.min(...data), range = max - min || 1
  const pts = data.map((v,i) => `${(i/(data.length-1))*width},${height-((v-min)/range)*(height-6)-3}`).join(' ')
  const lastY = height-((data[data.length-1]-min)/range)*(height-6)-3
  const gid = 'aspk' + color.replace('#','')
  return (
    <svg width={width} height={height} style={{ overflow:'visible' }}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.25"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
      <polygon points={`0,${height} ${pts} ${width},${height}`} fill={`url(#${gid})`}/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={width} cy={lastY} r="2.5" fill={color}/>
    </svg>
  )
}

function Donut({ segments, total, label, size = 140, isDark }) {
  const r = size/2 - 16, cx = size/2, cy = size/2, circ = 2*Math.PI*r
  let offset = 0
  const sum = segments.reduce((s,x)=>s+x.value,0) || 1
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={isDark?'rgba(255,255,255,0.05)':'#eef2f7'} strokeWidth="13"/>
      {segments.map((seg,i) => {
        const dash = (seg.value/sum)*circ
        const el = <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth="13" strokeDasharray={`${dash} ${circ-dash}`} strokeDashoffset={-offset} transform={`rotate(-90 ${cx} ${cy})`}/>
        offset += dash
        return el
      })}
      <text x={cx} y={cy-3} textAnchor="middle" fontSize="18" fontWeight="700" fill={isDark?'#f1f5f9':'#0f172a'}>{total}</text>
      <text x={cx} y={cy+14} textAnchor="middle" fontSize="9" fill={isDark?'#6b7280':'#94a3b8'}>{label}</text>
    </svg>
  )
}

function LineChart({ data, color, isDark, height = 170 }) {
  if (!data || data.length < 2) return <div style={{ height, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:isDark?'#6b7280':'#94a3b8' }}>Not enough data yet</div>
  const w = 1000, h = 220, pad = 8
  const max = Math.max(...data, 1)
  const x = i => (i/(data.length-1))*w
  const y = v => h - (v/max)*(h-pad*2) - pad
  const line = data.map((v,i)=>`${x(i)},${y(v)}`).join(' ')
  const lastX = x(data.length-1), lastY = y(data[data.length-1])
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs><linearGradient id="aLine" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.2"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
      {[0,0.5,1].map(f => <line key={f} x1="0" y1={h*f} x2={w} y2={h*f} stroke={isDark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.05)'} strokeWidth="1"/>)}
      <polygon points={`0,${h} ${line} ${w},${h}`} fill="url(#aLine)"/>
      <polyline points={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
      <circle cx={lastX} cy={lastY} r="5" fill={color} stroke={isDark?'#141921':'#fff'} strokeWidth="2"/>
    </svg>
  )
}

function Clock({ isDark }) {
  const ref = useRef(null)
  useEffect(() => {
    const tick = () => { if (ref.current) ref.current.textContent = new Date().toLocaleTimeString('en-AE',{hour:'2-digit',minute:'2-digit',second:'2-digit'}) + ' · GMT+4' }
    tick(); const t = setInterval(tick,1000); return () => clearInterval(t)
  }, [])
  return <span ref={ref} style={{ fontSize:11, fontVariantNumeric:'tabular-nums' }}/>
}

function timeAgo(d) {
  const s = Math.floor((Date.now() - new Date(d).getTime())/1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s/60); if (m < 60) return `${m} min ago`
  const h = Math.floor(m/60); if (h < 24) return `${h} hr ago`
  const days = Math.floor(h/24); return `${days} day${days>1?'s':''} ago`
}

function deviceOf(ua) {
  if (!ua) return 'Unknown'
  const s = ua.toLowerCase()
  if (/ipad|tablet/.test(s)) return 'Tablet'
  if (/mobi|iphone/.test(s)) return 'Mobile'
  if (/android/.test(s)) return /mobile/.test(s) ? 'Mobile' : 'Tablet'
  if (/windows|macintosh|linux|cros/.test(s)) return 'Desktop'
  return 'Other'
}

const DEVICE_COLOR = { Mobile:'#22c55e', Desktop:'#3b82f6', Tablet:'#a855f7', Other:'#94a3b8', Unknown:'#64748b' }
const CAT_COLORS = ['#22c55e','#3b82f6','#a855f7','#f59e0b','#ec4899','#06b6d4','#ef4444','#14b8a6']

/* ============================== main ============================== */
export default function Analytics({ setPage, theme, adminData }) {
  const isDark = theme !== 'light'
  const [vw, setVw] = useState(typeof window !== 'undefined' ? window.innerWidth : 1280)
  useEffect(() => { const r = () => setVw(window.innerWidth); window.addEventListener('resize', r); return () => window.removeEventListener('resize', r) }, [])
  const mobile = vw < 768
  const tablet = vw >= 768 && vw < 1200

  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState(30)
  const [kpi, setKpi] = useState({ views:0, viewsDelta:0, unique:0, formViews:0, sponsorEvents:0 })
  const [viewSpark, setViewSpark] = useState([])
  const [trend, setTrend] = useState([])
  const [topCompanies, setTopCompanies] = useState([])
  const [countries, setCountries] = useState([])
  const [devices, setDevices] = useState([])
  const [formCats, setFormCats] = useState([])
  const [sourcePages, setSourcePages] = useState([])
  const [sponsorPerf, setSponsorPerf] = useState([])
  const [recent, setRecent] = useState([])

  useEffect(() => { fetchAll() }, [range])

  async function fetchAll() {
    setLoading(true)
    try {
      const now = new Date()
      const iso = (n) => new Date(now.getTime() - n*864e5).toISOString()
      const span = Math.max(range, 60)

      const [
        { data: pv }, { data: lfv }, { data: sa }, { data: coRows },
      ] = await Promise.all([
        supabase.from('profile_views_log').select('company_id,visited_at,visitor_ip,user_agent,country').gte('visited_at', iso(span)),
        supabase.from('lead_form_views').select('form_id,source_url,category,created_at').gte('created_at', iso(span)),
        supabase.from('sponsor_analytics').select('company_id,event_type,source_page,created_at').gte('created_at', iso(span)),
        supabase.from('companies').select('id,name'),
      ])

      const PV = pv || [], LFV = lfv || [], SA = sa || []
      const coName = {}; (coRows||[]).forEach(c => { coName[c.id]=c.name })

      // window filter to selected range
      const inRange = (d) => new Date(d).getTime() >= now.getTime() - range*864e5
      const PVr = PV.filter(r => inRange(r.visited_at))
      const LFVr = LFV.filter(r => inRange(r.created_at))
      const SAr = SA.filter(r => inRange(r.created_at))

      // KPIs
      const views = PVr.length
      const uniqueIps = new Set(PVr.map(r => r.visitor_ip).filter(Boolean)).size
      const formViews = LFVr.length
      const sponsorEvents = SAr.length

      // delta: this range vs previous range
      const cur = PV.filter(r => { const t=new Date(r.visited_at).getTime(); return t >= now.getTime()-range*864e5 }).length
      const prev = PV.filter(r => { const t=new Date(r.visited_at).getTime(); return t < now.getTime()-range*864e5 && t >= now.getTime()-range*2*864e5 }).length
      const viewsDelta = prev===0 ? (cur>0?100:0) : ((cur-prev)/prev)*100

      // sparkline (14d) + trend (range days)
      const sparkN = 14
      const spark = {}; for (let i=sparkN-1;i>=0;i--) spark[iso(i).slice(0,10)]=0
      const tr = {}; for (let i=range-1;i>=0;i--) tr[iso(i).slice(0,10)]=0
      PV.forEach(r => { const k=(r.visited_at||'').slice(0,10); if(spark[k]!==undefined)spark[k]++; if(tr[k]!==undefined)tr[k]++ })
      setViewSpark(Object.values(spark)); setTrend(Object.values(tr))

      // top viewed companies
      const coMap = {}
      PVr.forEach(r => { if(r.company_id) coMap[r.company_id]=(coMap[r.company_id]||0)+1 })
      setTopCompanies(Object.entries(coMap).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([id,value]) => ({ name: coName[id]||'Unknown', value })))

      // country breakdown
      const cMap = {}
      PVr.forEach(r => { const c=(r.country||'Unknown'); cMap[c]=(cMap[c]||0)+1 })
      setCountries(Object.entries(cMap).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([name,value],i) => ({ name, value, color:CAT_COLORS[i%CAT_COLORS.length] })))

      // device breakdown
      const dMap = {}
      PVr.forEach(r => { const d=deviceOf(r.user_agent); dMap[d]=(dMap[d]||0)+1 })
      setDevices(Object.entries(dMap).sort((a,b)=>b[1]-a[1]).map(([name,value]) => ({ name, value, color:DEVICE_COLOR[name]||'#64748b' })))

      // lead forms by category
      const catMap = {}
      LFVr.forEach(r => { const c=(r.category||'Uncategorized'); catMap[c]=(catMap[c]||0)+1 })
      setFormCats(Object.entries(catMap).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([name,value],i) => ({ name, value, color:CAT_COLORS[i%CAT_COLORS.length] })))

      // top source pages (lead form source_url + sponsor source_page)
      const srcMap = {}
      const cleanUrl = (u) => { if(!u) return 'Direct'; try { const x=new URL(u); return (x.hostname+x.pathname).replace(/\/$/,'') } catch { return u.replace(/^https?:\/\//,'').slice(0,40) } }
      LFVr.forEach(r => { const s=cleanUrl(r.source_url); srcMap[s]=(srcMap[s]||0)+1 })
      SAr.forEach(r => { const s=cleanUrl(r.source_page); srcMap[s]=(srcMap[s]||0)+1 })
      setSourcePages(Object.entries(srcMap).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([name,value]) => ({ name, value })))

      // sponsor performance by event_type
      const evMap = {}
      SAr.forEach(r => { const e=(r.event_type||'event'); evMap[e]=(evMap[e]||0)+1 })
      const evColor = { impression:'#3b82f6', view:'#3b82f6', click:'#f59e0b', lead:'#22c55e', call:'#a855f7' }
      setSponsorPerf(Object.entries(evMap).sort((a,b)=>b[1]-a[1]).map(([name,value]) => ({ name: name.charAt(0).toUpperCase()+name.slice(1), value, color:evColor[name.toLowerCase()]||'#06b6d4' })))

      // recent visitors feed
      const feed = PVr.slice().sort((a,b)=>new Date(b.visited_at)-new Date(a.visited_at)).slice(0,6).map(r => ({
        text: `${coName[r.company_id]||'A profile'} viewed${r.country?' from '+r.country:''}`,
        sub: deviceOf(r.user_agent),
        time: r.visited_at,
        color: DEVICE_COLOR[deviceOf(r.user_agent)]||'#22c55e',
      }))
      setRecent(feed)

      setKpi({ views, viewsDelta, unique:uniqueIps, formViews, sponsorEvents })
    } catch (e) { console.error('Analytics fetch error:', e) }
    finally { setLoading(false) }
  }

  const C = {
    text:   isDark ? '#f1f5f9' : '#0f172a',
    text2:  isDark ? '#9ca3af' : '#475569',
    text3:  isDark ? '#6b7280' : '#94a3b8',
    border: isDark ? 'rgba(255,255,255,0.07)' : '#e8edf3',
    card:   isDark ? '#141921' : '#ffffff',
    row:    isDark ? 'rgba(255,255,255,0.03)' : '#f6f8fb',
    shadow: isDark ? '0 4px 24px rgba(0,0,0,0.3)' : '0 1px 10px rgba(15,40,80,0.05)',
    bar:    isDark ? 'rgba(255,255,255,0.06)' : '#eef2f7',
    green:'#22c55e', blue:'#3b82f6', purple:'#a855f7', gold:'#f59e0b', cyan:'#06b6d4', pink:'#ec4899', red:'#ef4444',
  }
  const cardStyle = { background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:'16px 18px', boxShadow:C.shadow }
  const H = ({ children, right }) => (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, gap:8 }}>
      <span style={{ fontSize:14, fontWeight:700, color:C.text }}>{children}</span>{right}
    </div>
  )
  const grid = (m,t,d) => ({ display:'grid', gridTemplateColumns: mobile?m:tablet?t:d, gap:14 })
  const fmtPct = (p) => `${p>=0?'+':''}${p.toFixed(1)}%`

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'80vh' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:38, height:38, border:`3px solid ${C.green}`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 12px' }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ fontSize:13, color:C.text3 }}>Loading Analytics...</div>
      </div>
    </div>
  )

  const KPIS = [
    { label:'Profile Views',   value:kpi.views,         icon:'ti-eye',          color:C.green,  delta:kpi.viewsDelta, spark:viewSpark },
    { label:'Unique Visitors', value:kpi.unique,        icon:'ti-users',        color:C.blue },
    { label:'Lead Form Views', value:kpi.formViews,     icon:'ti-clipboard-list', color:C.purple },
    { label:'Sponsor Events',  value:kpi.sponsorEvents, icon:'ti-ad',           color:C.gold },
  ]
  const maxCo = Math.max(...topCompanies.map(c=>c.value), 1)
  const maxSrc = Math.max(...sourcePages.map(s=>s.value), 1)
  const maxSp = Math.max(...sponsorPerf.map(s=>s.value), 1)
  const countrySum = countries.reduce((s,x)=>s+x.value,0)||1
  const deviceSum = devices.reduce((s,x)=>s+x.value,0)||1
  const catSum = formCats.reduce((s,x)=>s+x.value,0)||1

  return (
    <div style={{ color:C.text, maxWidth:1400 }}>

      {/* HEADER */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12, marginBottom:18 }}>
        <div>
          <h1 style={{ fontSize: mobile?20:24, fontWeight:800, color:C.text, margin:0, display:'flex', alignItems:'center', gap:9 }}>
            <i className="ti ti-chart-line" style={{ color:C.green }}/> Analytics
          </h1>
          <p style={{ fontSize:13, color:C.text2, marginTop:4 }}>Traffic, profile views &amp; visitor insights.</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          <div style={{ display:'flex', background:C.card, border:`1px solid ${C.border}`, borderRadius:10, overflow:'hidden' }}>
            {[7,30,90].map(d => (
              <button key={d} onClick={()=>setRange(d)} style={{ padding:'8px 12px', fontSize:12, fontWeight:600, border:'none', cursor:'pointer', background: range===d?C.green:'transparent', color: range===d?'#fff':C.text2 }}>{d}d</button>
            ))}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6, background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:'8px 12px', color:C.text2 }}>
            <i className="ti ti-clock" style={{ fontSize:13, color:C.green }}/>
            <Clock isDark={isDark}/>
          </div>
          <button onClick={fetchAll} style={{ display:'flex', alignItems:'center', gap:6, background:C.green, color:'#fff', border:'none', borderRadius:10, padding:'9px 16px', fontSize:13, fontWeight:600, cursor:'pointer' }}>
            <i className="ti ti-refresh" style={{ fontSize:14 }}/> Refresh
          </button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div style={{ ...grid('repeat(2,1fr)','repeat(4,1fr)','repeat(4,1fr)'), marginBottom:14 }}>
        {KPIS.map((s,i) => (
          <div key={i} style={{ ...cardStyle, transition:'all .15s' }}
            onMouseEnter={e=>{ e.currentTarget.style.borderColor=s.color+'66'; e.currentTarget.style.transform='translateY(-2px)' }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor=C.border; e.currentTarget.style.transform='none' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:11 }}>
              <span style={{ fontSize:12, color:C.text2, fontWeight:500 }}>{s.label}</span>
              <div style={{ width:32, height:32, borderRadius:9, background:s.color+'1e', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <i className={`ti ${s.icon}`} style={{ fontSize:16, color:s.color }}/>
              </div>
            </div>
            <div style={{ fontSize:26, fontWeight:800, color:C.text, lineHeight:1 }}>
              <AnimatedNumber value={s.value}/>
            </div>
            {s.delta !== undefined ? (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:7 }}>
                <span style={{ fontSize:11, fontWeight:600, color: s.delta>=0?C.green:C.red, display:'flex', alignItems:'center', gap:2 }}>
                  <i className={`ti ${s.delta>=0?'ti-trending-up':'ti-trending-down'}`} style={{ fontSize:12 }}/>{fmtPct(s.delta)}
                </span>
                {s.spark && <Sparkline data={s.spark} color={s.color} width={60} height={26}/>}
              </div>
            ) : <div style={{ height:8 }}/>}
          </div>
        ))}
      </div>

      {/* ROW: Views Trend | Recent visitors */}
      <div style={{ ...grid('1fr','1fr','1.7fr 1fr'), marginBottom:14 }}>
        <div style={cardStyle}>
          <H right={<span style={{ fontSize:10, color:C.text3, background:C.row, padding:'3px 10px', borderRadius:20, border:`1px solid ${C.border}` }}>{range} days</span>}>Profile Views Trend</H>
          <LineChart data={trend} color={C.green} isDark={isDark} height={mobile?160:200}/>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:8, fontSize:9, color:C.text3 }}>
            <span>{range}d ago</span><span>{Math.round(range/2)}d ago</span><span>Today</span>
          </div>
        </div>
        <div style={cardStyle}>
          <H right={<span style={{ fontSize:10, color:C.green, display:'flex', alignItems:'center', gap:4 }}><span style={{ width:7, height:7, borderRadius:'50%', background:C.green }}/>Live</span>}>Recent Visitors</H>
          {recent.length===0 ? <div style={{ textAlign:'center', padding:'30px 0', color:C.text3, fontSize:12 }}>No visits yet</div> : recent.map((a,i) => (
            <div key={i} style={{ display:'flex', gap:10, padding:'9px 0', borderBottom: i<recent.length-1?`1px solid ${C.border}`:'none' }}>
              <div style={{ width:30, height:30, borderRadius:8, background:a.color+'1e', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <i className="ti ti-eye" style={{ fontSize:14, color:a.color }}/>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:11.5, color:C.text, lineHeight:1.4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.text}</div>
                <div style={{ fontSize:10, color:C.text3, marginTop:1 }}>{a.sub} · {timeAgo(a.time)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ROW: Top companies | Country | Device */}
      <div style={{ ...grid('1fr','1fr 1fr','1.2fr 1fr 1fr'), marginBottom:14 }}>
        <div style={cardStyle}>
          <H right={<span onClick={()=>setPage&&setPage('companies')} style={{ fontSize:11, color:C.green, cursor:'pointer', fontWeight:600 }}>All</span>}>Most Viewed Profiles</H>
          {topCompanies.length===0 ? <div style={{ textAlign:'center', padding:'30px 0', color:C.text3, fontSize:12 }}>No views yet</div> : topCompanies.map((c,i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
              <span style={{ fontSize:11, fontWeight:700, color:C.text3, width:14 }}>{i+1}</span>
              <span style={{ flex:'0 0 38%', fontSize:11.5, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name}</span>
              <div style={{ flex:1, height:6, background:C.bar, borderRadius:99, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${(c.value/maxCo)*100}%`, background:C.green, borderRadius:99 }}/>
              </div>
              <span style={{ fontSize:12, fontWeight:700, color:C.text, minWidth:28, textAlign:'right' }}>{c.value}</span>
            </div>
          ))}
        </div>

        <div style={cardStyle}>
          <H>Visitors by Country</H>
          {countries.length===0 ? <div style={{ textAlign:'center', padding:'30px 0', color:C.text3, fontSize:12 }}>No data yet</div> : (
            <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap', justifyContent:'center' }}>
              <Donut segments={countries} total={kpi.views} label="Views" isDark={isDark} size={mobile?120:130}/>
              <div style={{ flex:1, minWidth:100 }}>
                {countries.slice(0,5).map((c,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:7, fontSize:11 }}>
                    <span style={{ width:8, height:8, borderRadius:'50%', background:c.color, flexShrink:0 }}/>
                    <span style={{ color:C.text2, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name}</span>
                    <span style={{ color:C.text, fontWeight:700 }}>{Math.round(c.value/countrySum*100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={cardStyle}>
          <H>Device Breakdown</H>
          {devices.length===0 ? <div style={{ textAlign:'center', padding:'30px 0', color:C.text3, fontSize:12 }}>No data yet</div> : (
            <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap', justifyContent:'center' }}>
              <Donut segments={devices} total={kpi.views} label="Views" isDark={isDark} size={mobile?120:130}/>
              <div style={{ flex:1, minWidth:100 }}>
                {devices.map((c,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:7, fontSize:11 }}>
                    <span style={{ width:8, height:8, borderRadius:'50%', background:c.color, flexShrink:0 }}/>
                    <span style={{ color:C.text2, flex:1 }}>{c.name}</span>
                    <span style={{ color:C.text, fontWeight:700 }}>{Math.round(c.value/deviceSum*100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ROW: Lead Forms by Category | Top Source Pages | Sponsor Performance */}
      <div style={grid('1fr','1fr 1fr','1fr 1.2fr 1fr')}>
        <div style={cardStyle}>
          <H>Lead Forms by Category</H>
          {formCats.length===0 ? <div style={{ textAlign:'center', padding:'30px 0', color:C.text3, fontSize:12 }}>No form views yet</div> : (
            <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap', justifyContent:'center' }}>
              <Donut segments={formCats} total={kpi.formViews} label="Views" isDark={isDark} size={mobile?120:130}/>
              <div style={{ flex:1, minWidth:100 }}>
                {formCats.map((c,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:7, fontSize:11 }}>
                    <span style={{ width:8, height:8, borderRadius:'50%', background:c.color, flexShrink:0 }}/>
                    <span style={{ color:C.text2, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name}</span>
                    <span style={{ color:C.text, fontWeight:700 }}>{c.value}</span>
                    <span style={{ color:C.text3, fontSize:9.5 }}>({Math.round(c.value/catSum*100)}%)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={cardStyle}>
          <H>Top Source Pages</H>
          {sourcePages.length===0 ? <div style={{ textAlign:'center', padding:'30px 0', color:C.text3, fontSize:12 }}>No source data yet</div> : sourcePages.map((s,i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
              <i className="ti ti-link" style={{ fontSize:12, color:C.cyan, flexShrink:0 }}/>
              <span style={{ flex:1, fontSize:11, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.name}</span>
              <div style={{ width:46, height:5, background:C.bar, borderRadius:99, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${(s.value/maxSrc)*100}%`, background:C.cyan, borderRadius:99 }}/>
              </div>
              <span style={{ fontSize:11.5, fontWeight:700, color:C.text, minWidth:24, textAlign:'right' }}>{s.value}</span>
            </div>
          ))}
        </div>

        <div style={cardStyle}>
          <H>Sponsor Performance</H>
          {sponsorPerf.length===0 ? <div style={{ textAlign:'center', padding:'30px 0', color:C.text3, fontSize:12 }}>No sponsor data yet</div> : (
            <div style={{ display:'flex', alignItems:'flex-end', gap:12, height:150, paddingTop:10 }}>
              {sponsorPerf.map((c,i) => (
                <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:5, height:'100%', justifyContent:'flex-end' }}>
                  <span style={{ fontSize:12, fontWeight:700, color:C.text }}>{c.value}</span>
                  <div style={{ width:'60%', maxWidth:34, height:`${Math.max(6,(c.value/maxSp)*100)}%`, background:c.color, borderRadius:'6px 6px 0 0' }}/>
                  <span style={{ fontSize:9.5, color:C.text3, textAlign:'center' }}>{c.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
