// trustdubai-admin/src/pages/Analytics.jsx
import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { supabase } from '../supabase'

/* ============================================================================
   TrustDubai — Analytics Overview (Premium)
   AI-Powered Traffic Intelligence Platform
   Real data: profile_views_log, lead_form_views, sponsor_analytics, companies
   Props: setPage, theme, adminData
============================================================================ */

export default function Analytics({ setPage, theme = 'dark', adminData }) {
  const isDark = theme !== 'light'
  const [vw, setVw] = useState(typeof window !== 'undefined' ? window.innerWidth : 1400)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState(30) // 7 | 30 | 90
  const [isFull, setIsFull] = useState(false)
  const [scale, setScale] = useState(1)
  const rootRef = useRef(null)
  const contentRef = useRef(null)

  const [kpi, setKpi] = useState({ views: 0, viewsChg: 0, unique: 0, uniqueChg: 0, leadViews: 0, leadChg: 0, sponsorImp: 0, sponsorChg: 0 })
  const [trend, setTrend] = useState([])
  const [topCos, setTopCos] = useState([])
  const [countries, setCountries] = useState([])
  const [devices, setDevices] = useState([])
  const [leadCats, setLeadCats] = useState([])
  const [sources, setSources] = useState([])
  const [sponsor, setSponsor] = useState({ imp: 0, clicks: 0, leads: 0 })
  const [feed, setFeed] = useState([])
  const [insights, setInsights] = useState([])
  const [realtime, setRealtime] = useState(0)

  const mobile = vw < 760
  const tablet = vw >= 760 && vw < 1200

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth)
    window.addEventListener('resize', onResize)
    const onFs = () => setIsFull(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => { window.removeEventListener('resize', onResize); document.removeEventListener('fullscreenchange', onFs) }
  }, [])

  useEffect(() => { loadAll() }, [range])

  // Fullscreen: scale content so the whole dashboard fits one screen — no scroll
  useLayoutEffect(() => {
    if (!isFull) { setScale(1); return }
    const calc = () => {
      const el = contentRef.current
      if (!el) return
      const top = el.getBoundingClientRect().top
      const availH = window.innerHeight - top - 14
      const h = el.scrollHeight
      const s = h > 0 ? Math.min(1, availH / h) : 1
      setScale(s > 0.2 ? s : 1)
    }
    calc()
    const t1 = setTimeout(calc, 80)
    const t2 = setTimeout(calc, 300)
    window.addEventListener('resize', calc)
    return () => { window.removeEventListener('resize', calc); clearTimeout(t1); clearTimeout(t2) }
  }, [isFull, vw, loading, trend, feed, topCos, countries, devices, leadCats, sources, sponsor])

  function toggleFull() {
    const el = rootRef.current
    if (!document.fullscreenElement) {
      if (el?.requestFullscreen) el.requestFullscreen().catch(() => {})
    } else {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {})
    }
  }

  const FLAGS = { 'United Arab Emirates':'🇦🇪','Saudi Arabia':'🇸🇦','United Kingdom':'🇬🇧','India':'🇮🇳','United States':'🇺🇸','USA':'🇺🇸','Pakistan':'🇵🇰','Egypt':'🇪🇬','Qatar':'🇶🇦','Kuwait':'🇰🇼','Oman':'🇴🇲','Bahrain':'🇧🇭','Canada':'🇨🇦','Germany':'🇩🇪','France':'🇫🇷','Unknown':'🌐' }

  function deviceOf(ua) {
    if (!ua) return 'Desktop'
    const s = ua.toLowerCase()
    if (/ipad|tablet|kindle|playbook|silk/.test(s)) return 'Tablet'
    if (/mobi|iphone|android.*mobile|phone/.test(s)) return 'Mobile'
    if (/android/.test(s)) return 'Tablet'
    return 'Desktop'
  }

  function timeAgo(d) {
    const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
    if (s < 60) return s + 's ago'
    if (s < 3600) return Math.floor(s / 60) + ' min ago'
    if (s < 86400) return Math.floor(s / 3600) + ' hr ago'
    return Math.floor(s / 86400) + 'd ago'
  }

  async function loadAll() {
    setLoading(true)
    try {
      const now = new Date()
      const since = new Date(now.getTime() - range * 864e5).toISOString()
      const prevSince = new Date(now.getTime() - range * 2 * 864e5).toISOString()

      const [
        { data: pv },
        { data: pvPrev },
        { data: lfv },
        { data: lfvPrev },
        { data: spon },
        { data: sponPrev },
        { data: cos },
      ] = await Promise.all([
        supabase.from('profile_views_log').select('company_id, visited_at, visitor_ip, user_agent, country').gte('visited_at', since).order('visited_at', { ascending: false }),
        supabase.from('profile_views_log').select('id, visited_at, visitor_ip').gte('visited_at', prevSince).lt('visited_at', since),
        supabase.from('lead_form_views').select('source_url, category, created_at').gte('created_at', since).order('created_at', { ascending: false }),
        supabase.from('lead_form_views').select('id, created_at').gte('created_at', prevSince).lt('created_at', since),
        supabase.from('sponsor_analytics').select('company_id, event_type, source_page, created_at').gte('created_at', since).order('created_at', { ascending: false }),
        supabase.from('sponsor_analytics').select('id, event_type, created_at').gte('created_at', prevSince).lt('created_at', since),
        supabase.from('companies').select('id, name, area'),
      ])

      const views = pv || []
      const coMap = {}
      ;(cos || []).forEach(c => { coMap[c.id] = c.name })

      const totalViews = views.length
      const prevViews = (pvPrev || []).length
      const uniq = new Set(views.map(v => v.visitor_ip).filter(Boolean)).size
      const prevUniq = new Set((pvPrev || []).map(v => v.visitor_ip).filter(Boolean)).size
      const leadV = (lfv || []).length
      const prevLeadV = (lfvPrev || []).length
      const sImp = (spon || []).filter(s => s.event_type === 'view').length
      const prevSImp = (sponPrev || []).filter(s => s.event_type === 'view').length
      const pct = (cur, prev) => prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : (cur > 0 ? 100 : 0)

      setKpi({
        views: totalViews, viewsChg: pct(totalViews, prevViews),
        unique: uniq, uniqueChg: pct(uniq, prevUniq),
        leadViews: leadV, leadChg: pct(leadV, prevLeadV),
        sponsorImp: sImp, sponsorChg: pct(sImp, prevSImp),
      })

      const buckets = {}
      const days = range
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 864e5)
        buckets[d.toISOString().slice(0, 10)] = 0
      }
      views.forEach(v => { const k = (v.visited_at || '').slice(0, 10); if (k in buckets) buckets[k]++ })
      setTrend(Object.entries(buckets).map(([k, v]) => ({ label: k, v })))

      const coCount = {}
      views.forEach(v => { if (v.company_id) coCount[v.company_id] = (coCount[v.company_id] || 0) + 1 })
      const topArr = Object.entries(coCount).map(([id, c]) => ({ name: coMap[id] || 'Unknown', views: c }))
        .sort((a, b) => b.views - a.views).slice(0, 5)
      const maxCo = Math.max(1, ...topArr.map(t => t.views))
      setTopCos(topArr.map(t => ({ ...t, pct: Math.round((t.views / maxCo) * 100) })))

      const ctry = {}
      views.forEach(v => { const c = v.country || 'Unknown'; ctry[c] = (ctry[c] || 0) + 1 })
      const ctryArr = Object.entries(ctry).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 6)
      const ctryTotal = Math.max(1, ctryArr.reduce((s, c) => s + c.count, 0))
      setCountries(ctryArr.map(c => ({ ...c, pct: Math.round((c.count / ctryTotal) * 100), flag: FLAGS[c.name] || '🌐' })))

      const dev = { Mobile: 0, Desktop: 0, Tablet: 0 }
      views.forEach(v => { dev[deviceOf(v.user_agent)]++ })
      const devTotal = Math.max(1, dev.Mobile + dev.Desktop + dev.Tablet)
      setDevices([
        { name: 'Mobile', count: dev.Mobile, pct: Math.round((dev.Mobile / devTotal) * 100), color: '#22d3ee' },
        { name: 'Desktop', count: dev.Desktop, pct: Math.round((dev.Desktop / devTotal) * 100), color: '#6366f1' },
        { name: 'Tablet', count: dev.Tablet, pct: Math.round((dev.Tablet / devTotal) * 100), color: '#a855f7' },
      ])

      const catColors = ['#a855f7', '#22d3ee', '#6366f1', '#f59e0b', '#ec4899', '#10b981']
      const cat = {}
      ;(lfv || []).forEach(l => { const c = l.category || 'Uncategorized'; cat[c] = (cat[c] || 0) + 1 })
      const catArr = Object.entries(cat).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 6)
      const catTotal = Math.max(1, catArr.reduce((s, c) => s + c.count, 0))
      setLeadCats(catArr.map((c, i) => ({ ...c, pct: Math.round((c.count / catTotal) * 100), color: catColors[i % catColors.length] })))

      const src = {}
      ;(lfv || []).forEach(l => { const s = l.source_url || 'direct'; src[s] = (src[s] || 0) + 1 })
      const srcArr = Object.entries(src).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5)
      const srcTotal = Math.max(1, srcArr.reduce((s, c) => s + c.count, 0))
      setSources(srcArr.map(s => ({ name: s.name, pct: Math.round((s.count / srcTotal) * 100) })))

      const sImpAll = (spon || []).filter(s => s.event_type === 'view').length
      const sClick = (spon || []).filter(s => s.event_type === 'click').length
      const sLead = (spon || []).filter(s => s.event_type === 'quote_request').length
      setSponsor({ imp: sImpAll, clicks: sClick, leads: sLead })

      const acts = []
      views.slice(0, 12).forEach(v => acts.push({
        t: v.visited_at, country: v.country || 'Unknown', flag: FLAGS[v.country] || '🌐',
        action: `Viewed ${coMap[v.company_id] || 'a company'} profile`,
        path: '/company/' + ((coMap[v.company_id] || 'profile').toLowerCase().replace(/\s+/g, '-')), icon: 'eye',
      }))
      ;(lfv || []).slice(0, 8).forEach(l => acts.push({
        t: l.created_at, country: 'Unknown', flag: '🌐',
        action: 'Opened Lead Form', path: '/lead-form/' + ((l.category || 'general').toLowerCase().replace(/\s+/g, '-')), icon: 'form',
      }))
      ;(spon || []).slice(0, 8).forEach(s => acts.push({
        t: s.created_at, country: 'Unknown', flag: '🌐',
        action: s.event_type === 'click' ? 'Clicked Sponsor Banner' : s.event_type === 'quote_request' ? 'Requested Sponsor Quote' : 'Viewed Sponsor',
        path: '/sponsor/' + (s.source_page || 'home'), icon: 'click',
      }))
      acts.sort((a, b) => new Date(b.t) - new Date(a.t))
      setFeed(acts.slice(0, 10))

      setRealtime(views.filter(v => (Date.now() - new Date(v.visited_at).getTime()) < 30 * 60 * 1000).length)

      const ins = []
      const topCountry = ctryArr.find(c => c.name !== 'Unknown')
      if (topCountry) ins.push({ icon: 'trend', text: `Most traffic comes from ${topCountry.name} (${Math.round((topCountry.count / ctryTotal) * 100)}% of views).` })
      const mobilePct = Math.round((dev.Mobile / devTotal) * 100)
      if (devTotal > 1) ins.push({ icon: 'device', text: mobilePct >= 50 ? `Mobile dominates with ${mobilePct}% of all visits — keep the mobile UX sharp.` : `Desktop leads with ${Math.round((dev.Desktop / devTotal) * 100)}% of visits.` })
      if (topArr[0]) ins.push({ icon: 'star', text: `${topArr[0].name} is the most-viewed profile with ${topArr[0].views} views.` })
      if (sClick > 0 && sImpAll > 0) ins.push({ icon: 'spark', text: `Sponsor CTR is ${Math.round((sClick / sImpAll) * 100)}% (${sClick} clicks / ${sImpAll} impressions).` })
      if (catArr[0]) ins.push({ icon: 'cat', text: `"${catArr[0].name}" generated the most lead-form interest.` })
      if (ins.length === 0) ins.push({ icon: 'trend', text: 'Data is still building up — insights will sharpen as more visits come in.' })
      setInsights(ins.slice(0, 4))

    } catch (e) { console.error('Analytics load error:', e) }
    finally { setLoading(false) }
  }

  const C = isDark ? {
    bg: '#080a14', panel: 'rgba(18,22,40,0.7)', panelSolid: '#10131f',
    line: 'rgba(255,255,255,0.07)', soft: 'rgba(255,255,255,0.03)',
    t1: '#eef2fb', t2: '#9aa5bd', t3: '#5e6a83',
    cyan: '#22d3ee', purple: '#a855f7', indigo: '#6366f1', green: '#10b981', amber: '#f59e0b', pink: '#ec4899',
    glow: '0 0 0 1px rgba(255,255,255,0.04), 0 8px 40px rgba(34,211,238,0.06)',
  } : {
    bg: '#eef2f8', panel: '#ffffff', panelSolid: '#ffffff',
    line: '#e3e9f2', soft: '#f4f7fb',
    t1: '#0f1830', t2: '#56627a', t3: '#94a0b5',
    cyan: '#0891b2', purple: '#9333ea', indigo: '#4f46e5', green: '#059669', amber: '#d97706', pink: '#db2777',
    glow: '0 1px 2px rgba(20,40,80,0.05), 0 10px 30px rgba(20,40,80,0.06)',
  }

  const F = "'Inter','Manrope',system-ui,sans-serif"

  function Panel({ children, style, glow }) {
    return (
      <div style={{ background: C.panel, backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        border: `1px solid ${C.line}`, borderRadius: 16, padding: 16, boxShadow: glow ? C.glow : 'none', ...style }}>{children}</div>
    )
  }

  function Spark({ data, color, h = 40, w = 150 }) {
    if (!data || data.length < 2) return <div style={{ height: h }} />
    const max = Math.max(...data, 1), min = Math.min(...data)
    const rng = Math.max(1, max - min)
    const pts = data.map((d, i) => `${(i / (data.length - 1)) * w},${h - ((d - min) / rng) * (h - 4) - 2}`).join(' ')
    const id = 'sg' + color.replace('#', '')
    return (
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" /><stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient></defs>
        <polyline points={`0,${h} ${pts} ${w},${h}`} fill={`url(#${id})`} stroke="none" />
        <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    )
  }

  function Donut({ data, size = 150, thickness = 22, center }) {
    const total = Math.max(1, data.reduce((s, d) => s + d.count, 0))
    const r = (size - thickness) / 2, cx = size / 2, cy = size / 2
    const circ = 2 * Math.PI * r
    let offset = 0
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.soft} strokeWidth={thickness} />
        {data.map((d, i) => {
          const dash = (d.count / total) * circ
          const el = (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth={thickness}
              strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-offset} transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="butt" />
          )
          offset += dash
          return el
        })}
        {center}
      </svg>
    )
  }

  function fmt(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(2).replace(/\.00$/, '') + 'M'
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K'
    return String(n ?? 0)
  }

  function KpiCard({ label, value, chg, color, icon, sparkData }) {
    const up = chg >= 0
    return (
      <Panel glow style={{ position: 'relative', overflow: 'hidden', minWidth: 0 }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 90, height: 90, borderRadius: '50%', background: color, filter: 'blur(45px)', opacity: isDark ? 0.22 : 0.12 }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative' }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDark ? `${color}22` : `${color}1a`, border: `1px solid ${color}55` }}>
            <i className={`ti ${icon}`} style={{ fontSize: 19, color }} />
          </div>
          <i className="ti ti-dots" style={{ color: C.t3, fontSize: 16 }} />
        </div>
        <div style={{ fontSize: 11.5, color: C.t2, marginTop: 12, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: C.t1, letterSpacing: '-0.5px', lineHeight: 1.1, marginTop: 2 }}>{fmt(value)}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11.5, fontWeight: 700, color: up ? C.green : C.pink }}>
            <i className={`ti ${up ? 'ti-trending-up' : 'ti-trending-down'}`} style={{ fontSize: 14 }} />{Math.abs(chg)}%
          </span>
          <div style={{ width: '52%' }}><Spark data={sparkData} color={color} h={32} /></div>
        </div>
      </Panel>
    )
  }

  const Title = ({ n, children, right }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {n != null && <span style={{ fontSize: 12, fontWeight: 800, color: C.t3 }}>{n}.</span>}
        <span style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>{children}</span>
      </div>
      {right}
    </div>
  )

  const iconMap = { eye: 'ti-eye', form: 'ti-forms', click: 'ti-click', trend: 'ti-trending-up', device: 'ti-device-mobile', star: 'ti-star', spark: 'ti-sparkles', cat: 'ti-category' }

  function TrendChart() {
    const d = trend
    if (!d.length) return <div style={{ height: 210 }} />
    const W = 720, H = 210, pad = 28
    const max = Math.max(...d.map(x => x.v), 1)
    const stepX = (W - pad) / Math.max(1, d.length - 1)
    const pts = d.map((x, i) => `${pad + i * stepX},${H - 24 - (x.v / max) * (H - 50)}`).join(' ')
    const area = `${pad},${H - 24} ${pts} ${pad + (d.length - 1) * stepX},${H - 24}`
    const ticks = mobile ? 4 : 6
    return (
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.cyan} stopOpacity="0.35" /><stop offset="100%" stopColor={C.cyan} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="trendLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={C.cyan} /><stop offset="100%" stopColor={C.indigo} />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
          <line key={i} x1={pad} y1={24 + f * (H - 48)} x2={W} y2={24 + f * (H - 48)} stroke={C.line} strokeWidth="1" />
        ))}
        <polygon points={area} fill="url(#trendArea)" />
        <polyline points={pts} fill="none" stroke="url(#trendLine)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {d.map((x, i) => {
          if (i % Math.ceil(d.length / ticks) !== 0 && i !== d.length - 1) return null
          return <text key={i} x={pad + i * stepX} y={H - 6} fontSize="9" fill={C.t3} textAnchor="middle">{x.label.slice(5)}</text>
        })}
      </svg>
    )
  }

  const grid3 = mobile ? '1fr' : 'repeat(3, 1fr)'
  const mainSplit = (mobile || tablet) ? '1fr' : '1.6fr 1fr'

  return (
    <div ref={rootRef} style={{ background: C.bg, minHeight: '100%', fontFamily: F, color: C.t1, padding: mobile ? 12 : 20, position: 'relative', ...(isFull ? { height: '100vh', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' } : {}) }}>
      <style>{`@keyframes pulseDot{0%,100%{opacity:1}50%{opacity:0.3}}@keyframes spin{to{transform:rotate(360deg)}} .an-scroll::-webkit-scrollbar{width:6px}.an-scroll::-webkit-scrollbar-thumb{background:${C.line};border-radius:99px}`}</style>

      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setPage && setPage('dashboard')} title="Back"
            style={{ width: 38, height: 38, borderRadius: 11, border: `1px solid ${C.line}`, background: C.soft, color: C.t1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="ti ti-arrow-left" style={{ fontSize: 18 }} />
          </button>
          <div>
            <div style={{ fontSize: mobile ? 19 : 23, fontWeight: 800, letterSpacing: '-0.5px' }}>Analytics Overview</div>
            <div style={{ fontSize: 11.5, color: C.t2, marginTop: 1 }}>AI-Powered Traffic Intelligence Platform</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: C.soft, border: `1px solid ${C.line}`, borderRadius: 10, padding: 3 }}>
            {[7, 30, 90].map(r => (
              <button key={r} onClick={() => setRange(r)}
                style={{ border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, padding: '6px 11px', borderRadius: 7,
                  background: range === r ? `linear-gradient(135deg,${C.cyan},${C.indigo})` : 'transparent',
                  color: range === r ? '#fff' : C.t2 }}>{r}d</button>
            ))}
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: C.green, background: isDark ? 'rgba(16,185,129,0.12)' : 'rgba(5,150,105,0.1)', border: `1px solid ${C.green}44`, borderRadius: 9, padding: '7px 11px' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.green, animation: 'pulseDot 1.6s infinite' }} /> Live
          </span>
          <button onClick={toggleFull} title="Fullscreen"
            style={{ width: 38, height: 38, borderRadius: 11, border: `1px solid ${C.line}`, background: C.soft, color: C.t1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className={`ti ${isFull ? 'ti-arrows-minimize' : 'ti-arrows-maximize'}`} style={{ fontSize: 17 }} />
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: C.t2 }}>
          <div style={{ width: 34, height: 34, border: `3px solid ${C.line}`, borderTopColor: C.cyan, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          Loading analytics…
        </div>
      ) : (
        <div style={isFull ? { flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', justifyContent: 'center' } : { display: 'contents' }}>
        <div ref={contentRef} style={isFull ? { width: `${100 / scale}%`, transform: `scale(${scale})`, transformOrigin: 'top center' } : { display: 'contents' }}>
        <>
          {/* KPI ROW */}
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: 14, marginBottom: 16 }}>
            <KpiCard label="Total Profile Views" value={kpi.views} chg={kpi.viewsChg} color={C.cyan} icon="ti-eye" sparkData={trend.map(t => t.v)} />
            <KpiCard label="Unique Visitors (IP)" value={kpi.unique} chg={kpi.uniqueChg} color={C.purple} icon="ti-users" sparkData={trend.map(t => t.v)} />
            <KpiCard label="Lead Form Views" value={kpi.leadViews} chg={kpi.leadChg} color={C.indigo} icon="ti-forms" sparkData={trend.map(t => t.v)} />
            <KpiCard label="Sponsor Impressions" value={kpi.sponsorImp} chg={kpi.sponsorChg} color={C.amber} icon="ti-speakerphone" sparkData={trend.map(t => t.v)} />
          </div>

          {/* TREND + TOP | AI + FEED */}
          <div style={{ display: 'grid', gridTemplateColumns: mainSplit, gap: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
              <Panel glow>
                <Title n="5" right={<span style={{ display: 'flex', gap: 12, fontSize: 10.5, color: C.t2 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 14, height: 3, background: C.cyan, borderRadius: 9 }} /> Views</span>
                </span>}>Views Trend (Daily)</Title>
                <TrendChart />
              </Panel>

              <Panel glow>
                <Title n="6">Top Viewed Companies</Title>
                {topCos.length === 0 ? <Empty C={C} text="No profile views yet in this period." /> : topCos.map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: i < topCos.length - 1 ? 13 : 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: C.t3, width: 18 }}>{String(i + 1).padStart(2, '0')}</span>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: C.soft, border: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: C.t2, flexShrink: 0 }}>{c.name.slice(0, 2).toUpperCase()}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: C.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                        <span style={{ fontSize: 12, fontWeight: 800, color: C.t1 }}>{c.pct}%</span>
                      </div>
                      <div style={{ height: 6, background: C.soft, borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ width: `${c.pct}%`, height: '100%', background: `linear-gradient(90deg,${C.purple},${C.indigo})`, borderRadius: 99 }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: C.t2, minWidth: 48, textAlign: 'right' }}>{c.views.toLocaleString()}</span>
                  </div>
                ))}
              </Panel>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
              <Panel glow style={{ background: isDark ? 'linear-gradient(160deg,rgba(168,85,247,0.12),rgba(34,211,238,0.06))' : C.panel }}>
                <Title right={<i className="ti ti-brain" style={{ fontSize: 18, color: C.purple }} />}>
                  <span style={{ letterSpacing: '0.06em', fontSize: 12, color: C.t2, fontWeight: 800 }}>AI INSIGHTS</span>
                </Title>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                  {insights.map((ins, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${[C.green, C.purple, C.cyan, C.amber][i % 4]}22`, border: `1px solid ${[C.green, C.purple, C.cyan, C.amber][i % 4]}55` }}>
                        <i className={`ti ${iconMap[ins.icon] || 'ti-bulb'}`} style={{ fontSize: 13, color: [C.green, C.purple, C.cyan, C.amber][i % 4] }} />
                      </div>
                      <span style={{ fontSize: 12, color: C.t2, lineHeight: 1.5 }}>{ins.text}</span>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel glow>
                <Title n="12" right={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: C.green }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, animation: 'pulseDot 1.6s infinite' }} />Live</span>}>Live Visitors / Activity</Title>
                <div className="an-scroll" style={{ maxHeight: 320, overflowY: 'auto' }}>
                  {feed.length === 0 ? <Empty C={C} text="No recent activity." /> : feed.map((a, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: i < feed.length - 1 ? `1px solid ${C.line}` : 'none' }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.soft, border: `1px solid ${C.line}` }}>
                        <i className={`ti ${iconMap[a.icon]}`} style={{ fontSize: 13, color: C.cyan }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: C.t1 }}>{a.flag} {a.country}</span>
                          <span style={{ fontSize: 10, color: C.t3, whiteSpace: 'nowrap' }}>{timeAgo(a.t)}</span>
                        </div>
                        <div style={{ fontSize: 11.5, color: C.t2, marginTop: 1 }}>{a.action}</div>
                        <div style={{ fontSize: 10, color: C.t3, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.path}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </div>

          {/* COUNTRY + DEVICE + LEAD CATS */}
          <div style={{ display: 'grid', gridTemplateColumns: grid3, gap: 16, marginBottom: 16 }}>
            <Panel glow>
              <Title n="7">Country Breakdown</Title>
              {countries.length === 0 ? <Empty C={C} text="No country data yet." /> : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', width: 110, height: 110, flexShrink: 0 }}>
                    <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `radial-gradient(circle at 35% 30%, ${C.indigo}, ${C.cyan}33 60%, transparent 72%)`, filter: 'blur(2px)' }} />
                    <div style={{ position: 'absolute', inset: 8, borderRadius: '50%', border: `1px solid ${C.cyan}55`, boxShadow: `inset 0 0 22px ${C.cyan}33` }} />
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34 }}>🌍</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 130 }}>
                    {countries.map((c, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                        <span style={{ fontSize: 13 }}>{c.flag}</span>
                        <span style={{ fontSize: 12, color: C.t1, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                        <span style={{ fontSize: 12, fontWeight: 800, color: C.t1 }}>{c.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Panel>

            <Panel glow>
              <Title n="8">Device Breakdown</Title>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <Donut data={devices} size={120} thickness={20} />
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: C.t1 }}>{fmt(devices.reduce((s, d) => s + d.count, 0))}</span>
                    <span style={{ fontSize: 9, color: C.t3 }}>views</span>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  {devices.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: C.t1, flex: 1 }}>{d.name}</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: C.t1 }}>{d.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>

            <Panel glow>
              <Title n="9">Lead Forms by Category</Title>
              {leadCats.length === 0 ? <Empty C={C} text="No lead-form views yet." /> : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ flexShrink: 0 }}><Donut data={leadCats} size={120} thickness={20} /></div>
                  <div style={{ flex: 1 }}>
                    {leadCats.map((c, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                        <span style={{ width: 9, height: 9, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 11.5, color: C.t1, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                        <span style={{ fontSize: 11.5, fontWeight: 800, color: C.t1 }}>{c.pct}%</span>
                        <span style={{ fontSize: 10, color: C.t3 }}>({c.count})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Panel>
          </div>

          {/* SOURCES + SPONSOR */}
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1.3fr', gap: 16 }}>
            <Panel glow>
              <Title n="10">Top Source Pages</Title>
              {sources.length === 0 ? <Empty C={C} text="No source data yet." /> : sources.map((s, i) => (
                <div key={i} style={{ marginBottom: i < sources.length - 1 ? 11 : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: C.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: C.t1 }}>{s.pct}%</span>
                  </div>
                  <div style={{ height: 6, background: C.soft, borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${s.pct}%`, height: '100%', background: `linear-gradient(90deg,${C.cyan},${C.purple})`, borderRadius: 99 }} />
                  </div>
                </div>
              ))}
            </Panel>

            <Panel glow>
              <Title n="11">Sponsor Performance</Title>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
                {[
                  { l: 'IMPRESSIONS', v: sponsor.imp, c: C.purple },
                  { l: 'CLICKS', v: sponsor.clicks, c: C.cyan },
                  { l: 'LEADS', v: sponsor.leads, c: C.green },
                ].map((m, i) => (
                  <div key={i} style={{ background: C.soft, border: `1px solid ${C.line}`, borderRadius: 12, padding: '11px 12px' }}>
                    <div style={{ fontSize: 9.5, fontWeight: 800, color: C.t3, letterSpacing: '0.06em' }}>{m.l}</div>
                    <div style={{ fontSize: 19, fontWeight: 800, color: C.t1, marginTop: 3 }}>{m.v.toLocaleString()}</div>
                    <div style={{ height: 3, background: m.c, borderRadius: 99, marginTop: 7, opacity: 0.7 }} />
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 9.5, fontWeight: 800, color: C.t3, letterSpacing: '0.06em', marginBottom: 9 }}>CONVERSION FUNNEL</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {(() => {
                  const imp = Math.max(1, sponsor.imp)
                  const stages = [
                    { l: 'Impressions', v: sponsor.imp, sub: '100%', c: C.purple },
                    { l: 'Clicks', v: sponsor.clicks, sub: Math.round((sponsor.clicks / imp) * 100) + '%', c: C.cyan },
                    { l: 'Leads', v: sponsor.leads, sub: Math.round((sponsor.leads / imp) * 100) + '%', c: C.green },
                  ]
                  return stages.map((s, i) => (
                    <div key={i} style={{ flex: 1, background: `linear-gradient(135deg,${s.c},${s.c}aa)`, borderRadius: 10, padding: '12px 10px', color: '#fff', opacity: isDark ? 0.92 : 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.95 }}>{s.l}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, marginTop: 3 }}>{s.v.toLocaleString()}</div>
                      <div style={{ fontSize: 10, opacity: 0.85, marginTop: 1 }}>{s.sub}</div>
                    </div>
                  ))
                })()}
              </div>
            </Panel>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 18, fontSize: 11, color: C.t2 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.green }} /> All Systems Operational
              <span style={{ color: C.t3, marginLeft: 8 }}>· {realtime} active in last 30 min</span>
            </span>
            <span style={{ color: C.t3 }}>Timezone: Asia/Dubai (GMT +4) · Data by TrustDubai Engine</span>
          </div>
        </>
        </div>
        </div>
      )}
    </div>
  )
}

function Empty({ C, text }) {
  return <div style={{ fontSize: 12, color: C.t3, padding: '18px 4px', textAlign: 'center' }}>{text}</div>
}
