// trustdubai-admin/src/pages/Analytics.jsx
import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { supabase } from '../supabase'

/* ============================================================================
   TrustDubai — AI Command Center
   Real-time insights & analytics for the TrustDubai platform.
   Real data: profile_views_log, lead_form_views, lead_submissions,
              sponsor_analytics, visitor_sessions, companies, categories
   Props: setPage, theme, adminData
============================================================================ */

const REFRESH_MS = 30000 // auto-refresh every 30s (silent, no spinner)

export default function Analytics({ setPage, theme = 'dark', adminData }) {
  const isDark = theme !== 'light'
  const [vw, setVw] = useState(typeof window !== 'undefined' ? window.innerWidth : 1400)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false) // true while any fetch runs → spins the Refresh icon
  const [range, setRange] = useState(30)
  const [isFull, setIsFull] = useState(false)
  const [scale, setScale] = useState(1)
  const [clock, setClock] = useState('')
  const [catView, setCatView] = useState('all') // category filter for Top Categories
  const [lastSync, setLastSync] = useState(null) // when data was last refreshed
  const rootRef = useRef(null)
  const contentRef = useRef(null)
  const rangeRef = useRef(range) // always-fresh range for the polling timer

  const [kpi, setKpi] = useState({
    views: 0, viewsChg: 0, unique: 0, uniqueChg: 0, leadViews: 0, leadChg: 0,
    sponsorImp: 0, sponsorChg: 0, returning: 0, returningChg: 0, growth: 0,
  })
  const [trend, setTrend] = useState([])
  const [topCos, setTopCos] = useState([])
  const [countries, setCountries] = useState([])
  const [devices, setDevices] = useState([])
  const [catsInternal, setCatsInternal] = useState([])
  const [sources, setSources] = useState([])
  const [sponsor, setSponsor] = useState({ imp: 0, clicks: 0, leads: 0, ctr: 0 })
  const [funnel, setFunnel] = useState({ views: 0, started: 0, submitted: 0, contacted: 0 })
  const [heatmap, setHeatmap] = useState([]) // 7 x 24 grid
  const [sessionStats, setSessionStats] = useState({ totalVisits: 0, avgTime: 0, pagesPerVisit: 0, bounce: 0, leadConv: 0 })
  const [feed, setFeed] = useState([])
  const [insights, setInsights] = useState([])
  const [recommendation, setRecommendation] = useState('')
  const [realtime, setRealtime] = useState(0)
  const [supply, setSupply] = useState({ total: 0, verified: 0, claimed: 0, members: 0, listed: 0, plans: { free: 0, silver: 0, gold: 0, platinum: 0 } })

  const mobile = vw < 760
  const tablet = vw >= 760 && vw < 1200

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth)
    window.addEventListener('resize', onResize)
    const onFs = () => setIsFull(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    const tick = () => setClock(new Date().toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Dubai' }))
    tick(); const ci = setInterval(tick, 1000)
    return () => { window.removeEventListener('resize', onResize); document.removeEventListener('fullscreenchange', onFs); clearInterval(ci) }
  }, [])

  // Initial load + reload when range changes (shows spinner)
  useEffect(() => { rangeRef.current = range; loadAll() }, [range])

  // AUTO-REFRESH: silently re-fetch every REFRESH_MS, and when the tab regains focus.
  // Silent = no full-screen spinner, just fresh numbers + a spinning Refresh icon + "Updated" timestamp.
  useEffect(() => {
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return // skip when tab hidden
      loadAll(true)
    }, REFRESH_MS)
    const onFocus = () => loadAll(true)
    window.addEventListener('focus', onFocus)
    return () => { clearInterval(id); window.removeEventListener('focus', onFocus) }
  }, [])

  // Fullscreen auto-resolution: content fills the FULL width and is squished
  // vertically so the whole board fits on ONE screen — no scroll, no side gaps.
  useLayoutEffect(() => {
    if (!isFull) { setScale(1); return }
    const calc = () => {
      const el = contentRef.current
      if (!el) return
      const top = el.getBoundingClientRect().top
      const availH = window.innerHeight - top - 16
      const h = el.scrollHeight
      if (h <= 0) return
      setScale(Math.max(0.4, Math.min(1.4, availH / h)))
    }
    calc()
    const raf = requestAnimationFrame(calc)
    const t1 = setTimeout(calc, 80), t2 = setTimeout(calc, 350), t3 = setTimeout(calc, 700)
    window.addEventListener('resize', calc)
    return () => { window.removeEventListener('resize', calc); cancelAnimationFrame(raf); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [isFull, vw, loading, trend, feed, heatmap, supply, catsInternal])

  function toggleFull() {
    const el = rootRef.current
    if (!document.fullscreenElement) { if (el?.requestFullscreen) el.requestFullscreen().catch(() => {}) }
    else { if (document.exitFullscreen) document.exitFullscreen().catch(() => {}) }
  }

  const FLAGS = { 'United Arab Emirates':'🇦🇪','Saudi Arabia':'🇸🇦','United Kingdom':'🇬🇧','India':'🇮🇳','United States':'🇺🇸','USA':'🇺🇸','Pakistan':'🇵🇰','Egypt':'🇪🇬','Qatar':'🇶🇦','Kuwait':'🇰🇼','Oman':'🇴🇲','Bahrain':'🇧🇭','Canada':'🇨🇦','Germany':'🇩🇪','France':'🇫🇷','Unknown':'🌐' }
  const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

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

  function fmtDuration(sec) {
    if (!sec || sec < 0) return '00:00'
    const m = Math.floor(sec / 60), s = Math.round(sec % 60)
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0')
  }

  async function loadAll(silent = false) {
    if (!silent) setLoading(true)
    setRefreshing(true)
    try {
      const r = rangeRef.current
      const now = new Date()
      const since = new Date(now.getTime() - r * 864e5).toISOString()
      const prevSince = new Date(now.getTime() - r * 2 * 864e5).toISOString()

      const [
        { data: pv }, { data: pvPrev }, { data: lfv }, { data: lfvPrev },
        { data: spon }, { data: sponPrev }, { data: subs }, { data: cos },
        { data: sess }, { data: sessPrev },
      ] = await Promise.all([
        supabase.from('profile_views_log').select('company_id, visited_at, visitor_ip, user_agent, country').gte('visited_at', since).order('visited_at', { ascending: false }),
        supabase.from('profile_views_log').select('id, visited_at, visitor_ip').gte('visited_at', prevSince).lt('visited_at', since),
        supabase.from('lead_form_views').select('source_url, category, created_at').gte('created_at', since).order('created_at', { ascending: false }),
        supabase.from('lead_form_views').select('id, created_at').gte('created_at', prevSince).lt('created_at', since),
        supabase.from('sponsor_analytics').select('company_id, event_type, source_page, created_at, lead_name').gte('created_at', since).order('created_at', { ascending: false }),
        supabase.from('sponsor_analytics').select('id, event_type, created_at').gte('created_at', prevSince).lt('created_at', since),
        supabase.from('lead_submissions').select('id, status, created_at, follow_up_date').gte('created_at', since),
        supabase.from('companies').select('id, name, area, category').limit(5000),
        supabase.from('visitor_sessions').select('visitor_ip, country, page_count, duration_sec, started_at').gte('started_at', since),
        supabase.from('visitor_sessions').select('id, visitor_ip').gte('started_at', prevSince).lt('started_at', since),
      ])

      const views = pv || []
      const sessions = sess || []
      const coMap = {}, catMap = {}
      ;(cos || []).forEach(c => { coMap[c.id] = c.name; catMap[c.id] = c.category || 'Uncategorized' })

      const pct = (cur, prev) => prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : (cur > 0 ? 100 : 0)

      // KPI
      const totalViews = views.length
      const prevViews = (pvPrev || []).length
      const uniq = new Set(views.map(v => v.visitor_ip).filter(Boolean)).size
      const prevUniq = new Set((pvPrev || []).map(v => v.visitor_ip).filter(Boolean)).size
      const leadV = (lfv || []).length
      const prevLeadV = (lfvPrev || []).length
      const sImp = (spon || []).filter(s => s.event_type === 'view').length
      const prevSImp = (sponPrev || []).filter(s => s.event_type === 'view').length

      // Returning visitors: IPs seen more than once across views+sessions
      const ipCount = {}
      views.forEach(v => { if (v.visitor_ip) ipCount[v.visitor_ip] = (ipCount[v.visitor_ip] || 0) + 1 })
      sessions.forEach(s => { if (s.visitor_ip) ipCount[s.visitor_ip] = (ipCount[s.visitor_ip] || 0) + 1 })
      const ipKeys = Object.keys(ipCount)
      const returningCount = ipKeys.filter(k => ipCount[k] > 1).length
      const returningPct = ipKeys.length > 0 ? Math.round((returningCount / ipKeys.length) * 100) : 0

      // Growth score (0-100): blend of activity signals
      const growth = Math.min(100, Math.round(
        Math.min(totalViews / 50, 1) * 30 +
        Math.min(leadV / 20, 1) * 25 +
        Math.min(uniq / 30, 1) * 25 +
        (returningPct / 100) * 20
      ))

      setKpi({
        views: totalViews, viewsChg: pct(totalViews, prevViews),
        unique: uniq, uniqueChg: pct(uniq, prevUniq),
        leadViews: leadV, leadChg: pct(leadV, prevLeadV),
        sponsorImp: sImp, sponsorChg: pct(sImp, prevSImp),
        returning: returningPct, returningChg: pct(returningCount, (sessPrev || []).length),
        growth,
      })

      // Trend (daily)
      const buckets = {}
      for (let i = r - 1; i >= 0; i--) buckets[new Date(now.getTime() - i * 864e5).toISOString().slice(0, 10)] = 0
      views.forEach(v => { const k = (v.visited_at || '').slice(0, 10); if (k in buckets) buckets[k]++ })
      setTrend(Object.entries(buckets).map(([k, v]) => ({ label: k, v })))

      // Top companies
      const coCount = {}
      views.forEach(v => { if (v.company_id) coCount[v.company_id] = (coCount[v.company_id] || 0) + 1 })
      const topArr = Object.entries(coCount).map(([id, c]) => ({ name: coMap[id] || 'Unknown', views: c }))
        .sort((a, b) => b.views - a.views).slice(0, 5)
      const maxCo = Math.max(1, ...topArr.map(t => t.views))
      setTopCos(topArr.map(t => ({ ...t, pct: Math.round((t.views / maxCo) * 100) })))

      // Country (from views + sessions)
      const ctry = {}
      views.forEach(v => { const c = v.country || 'Unknown'; ctry[c] = (ctry[c] || 0) + 1 })
      sessions.forEach(s => { if (s.country) ctry[s.country] = (ctry[s.country] || 0) + 1 })
      const ctryArr = Object.entries(ctry).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 6)
      const ctryTotal = Math.max(1, ctryArr.reduce((s, c) => s + c.count, 0))
      setCountries(ctryArr.map(c => ({ ...c, pct: Math.round((c.count / ctryTotal) * 100), flag: FLAGS[c.name] || '🌐' })))

      // Device
      const dev = { Mobile: 0, Desktop: 0, Tablet: 0 }
      views.forEach(v => { dev[deviceOf(v.user_agent)]++ })
      const devTotal = Math.max(1, dev.Mobile + dev.Desktop + dev.Tablet)
      setDevices([
        { name: 'Mobile', count: dev.Mobile, pct: Math.round((dev.Mobile / devTotal) * 100), color: '#22d3ee' },
        { name: 'Desktop', count: dev.Desktop, pct: Math.round((dev.Desktop / devTotal) * 100), color: '#6366f1' },
        { name: 'Tablet', count: dev.Tablet, pct: Math.round((dev.Tablet / devTotal) * 100), color: '#a855f7' },
      ])

      // Top Categories (internal): views by company category + lead-form categories
      const cat = {}
      views.forEach(v => { const c = catMap[v.company_id] || 'Uncategorized'; cat[c] = (cat[c] || 0) + 1 })
      ;(lfv || []).forEach(l => { const c = l.category || 'Uncategorized'; cat[c] = (cat[c] || 0) + 1 })
      const catArr = Object.entries(cat).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10)
      const catTotal = Math.max(1, catArr.reduce((s, c) => s + c.count, 0))
      const catColors = ['#f59e0b', '#a855f7', '#22d3ee', '#6366f1', '#ec4899', '#10b981', '#f97316', '#8b5cf6', '#14b8a6', '#eab308']
      setCatsInternal(catArr.map((c, i) => ({ ...c, pct: Math.round((c.count / catTotal) * 100), color: catColors[i % catColors.length] })))

      // Sources
      const src = {}
      ;(lfv || []).forEach(l => { const s = l.source_url || 'direct'; src[s] = (src[s] || 0) + 1 })
      const srcArr = Object.entries(src).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5)
      const srcTotal = Math.max(1, srcArr.reduce((s, c) => s + c.count, 0))
      setSources(srcArr.map(s => ({ name: s.name, pct: Math.round((s.count / srcTotal) * 100) })))

      // Sponsor
      const sImpAll = sImp
      const sClick = (spon || []).filter(s => s.event_type === 'click').length
      const sLead = (spon || []).filter(s => s.event_type === 'quote_request').length
      setSponsor({ imp: sImpAll, clicks: sClick, leads: sLead, ctr: sImpAll > 0 ? Math.round((sClick / sImpAll) * 1000) / 10 : 0 })

      // Lead funnel: form views -> started (we approximate started=submitted*1.6) -> submitted -> contacted
      const subsArr = subs || []
      const submitted = subsArr.length
      const contacted = subsArr.filter(s => s.status && s.status !== 'new').length
      const started = Math.max(submitted, Math.round(leadV * 0.55)) // form opened -> started typing
      setFunnel({ views: leadV, started, submitted, contacted })

      // Hourly heatmap (7 days x 24 hours) from views + sessions
      const grid = Array.from({ length: 7 }, () => Array(24).fill(0))
      const addToGrid = (dateStr) => {
        const d = new Date(dateStr); if (isNaN(d)) return
        let wd = d.getDay(); wd = wd === 0 ? 6 : wd - 1 // Mon=0..Sun=6
        grid[wd][d.getHours()]++
      }
      views.forEach(v => addToGrid(v.visited_at))
      sessions.forEach(s => addToGrid(s.started_at))
      const maxCell = Math.max(1, ...grid.flat())
      setHeatmap(grid.map(row => row.map(c => ({ count: c, intensity: c / maxCell }))))

      // Session stats
      const totalVisits = sessions.length
      const avgTime = totalVisits > 0 ? Math.round(sessions.reduce((s, x) => s + (x.duration_sec || 0), 0) / totalVisits) : 0
      const pagesPerVisit = totalVisits > 0 ? Math.round((sessions.reduce((s, x) => s + (x.page_count || 1), 0) / totalVisits) * 100) / 100 : 0
      const bounceCount = sessions.filter(s => (s.page_count || 1) <= 1).length
      const bounce = totalVisits > 0 ? Math.round((bounceCount / totalVisits) * 1000) / 10 : 0
      const leadConv = totalVisits > 0 ? Math.round((submitted / totalVisits) * 1000) / 10 : 0
      setSessionStats({ totalVisits, avgTime, pagesPerVisit, bounce, leadConv })

      // Live activity feed
      const acts = []
      views.slice(0, 16).forEach(v => acts.push({
        t: v.visited_at, country: v.country || 'Unknown', flag: FLAGS[v.country] || '🌐',
        title: `Visitor from ${v.country || 'Unknown'}`, sub: `Viewed ${coMap[v.company_id] || 'a company'} profile`, icon: 'eye',
      }))
      ;(lfv || []).slice(0, 8).forEach(l => acts.push({
        t: l.created_at, country: 'Unknown', flag: '📋',
        title: 'Lead Form Opened', sub: (l.category || 'General') + ' category', icon: 'form',
      }))
      ;(spon || []).slice(0, 8).forEach(s => acts.push({
        t: s.created_at, country: 'Unknown', flag: '📢',
        title: s.event_type === 'click' ? 'Sponsor Click' : s.event_type === 'quote_request' ? 'Sponsor Lead' : 'Sponsor Impression',
        sub: s.source_page || 'Banner displayed', icon: 'click',
      }))
      acts.sort((a, b) => new Date(b.t) - new Date(a.t))
      setFeed(acts.slice(0, 12))

      setRealtime(views.filter(v => (Date.now() - new Date(v.visited_at).getTime()) < 30 * 60 * 1000).length)

      // AI insights + recommendation
      const ins = []
      const topCountry = ctryArr.find(c => c.name !== 'Unknown')
      if (topCountry) ins.push({ icon: 'trend', color: '#10b981', text: `${topCountry.name} traffic is ${Math.round((topCountry.count / ctryTotal) * 100)}% of all visits.` })
      if (catArr[0]) ins.push({ icon: 'cat', color: '#f59e0b', text: `${catArr[0].name} category generated the most interest.` })
      const mobilePct = Math.round((dev.Mobile / devTotal) * 100)
      if (devTotal > 1) ins.push({ icon: 'device', color: '#6366f1', text: `Mobile visitors represent ${mobilePct}% of all traffic.` })
      if (sImpAll > 0) ins.push({ icon: 'spark', color: '#ec4899', text: `Sponsor CTR is ${sImpAll > 0 ? Math.round((sClick / sImpAll) * 100) : 0}% this period.` })
      if (ins.length === 0) ins.push({ icon: 'trend', color: '#10b981', text: 'Data is building up — insights sharpen as traffic grows.' })
      setInsights(ins.slice(0, 4))
      setRecommendation(catArr[0]
        ? `Increase exposure for top-performing listings in ${catArr[0].name}${catArr[1] ? ' and ' + catArr[1].name : ''} categories.`
        : 'Onboard more verified companies to boost category coverage and lead flow.')

      // ---- Platform Supply (company composition) — counts via head:true (no 1000-row cap) ----
      const supBase = () => supabase.from('companies').select('*', { count: 'exact', head: true }).eq('status', 'approved')
      const [tot, ver, clm, mem, lst, pFree, pSilver, pGold, pPlat] = await Promise.all([
        supBase(),
        supBase().in('verification_level', ['license', 'full']),
        supBase().eq('claimed', true),
        supBase().or('is_imported.eq.false,claimed.eq.true'),
        supBase().eq('is_imported', true).eq('claimed', false),
        supBase().eq('plan', 'free'),
        supBase().eq('plan', 'silver'),
        supBase().eq('plan', 'gold'),
        supBase().eq('plan', 'platinum'),
      ])
      setSupply({
        total: tot.count || 0,
        verified: ver.count || 0,
        claimed: clm.count || 0,
        members: mem.count || 0,
        listed: lst.count || 0,
        plans: { free: pFree.count || 0, silver: pSilver.count || 0, gold: pGold.count || 0, platinum: pPlat.count || 0 },
      })

      setLastSync(new Date())

    } catch (e) { console.error('Analytics load error:', e) }
    finally { setLoading(false); setRefreshing(false) }
  }

  const C = isDark ? {
    bg: '#070b16', panel: 'rgba(16,21,38,0.72)', panel2: 'rgba(22,28,48,0.9)',
    line: 'rgba(255,255,255,0.07)', soft: 'rgba(255,255,255,0.03)',
    t1: '#eef2fb', t2: '#9aa5bd', t3: '#5e6a83',
    cyan: '#22d3ee', purple: '#a855f7', indigo: '#6366f1', green: '#10b981', amber: '#f59e0b', pink: '#ec4899', orange: '#f97316', red: '#f87171',
    glow: '0 0 0 1px rgba(255,255,255,0.04), 0 8px 40px rgba(99,102,241,0.07)',
  } : {
    bg: '#eef2f8', panel: '#ffffff', panel2: '#ffffff',
    line: '#e3e9f2', soft: '#f4f7fb',
    t1: '#0f1830', t2: '#56627a', t3: '#94a0b5',
    cyan: '#0891b2', purple: '#9333ea', indigo: '#4f46e5', green: '#059669', amber: '#d97706', pink: '#db2777', orange: '#ea580c', red: '#dc2626',
    glow: '0 1px 2px rgba(20,40,80,0.05), 0 10px 30px rgba(20,40,80,0.06)',
  }
  const F = "'Inter','Manrope',system-ui,sans-serif"

  function Panel({ children, style, glow }) {
    return <div style={{ background: C.panel, backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', border: `1px solid ${C.line}`, borderRadius: 16, padding: 16, boxShadow: glow ? C.glow : 'none', ...style }}>{children}</div>
  }
  function fmt(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(2).replace(/\.00$/, '') + 'M'
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K'
    return String(n ?? 0)
  }
  function pctOf(n, total) { return total > 0 ? Math.round((n / total) * 100) : 0 }
  function Spark({ data, color, h = 32, w = 150 }) {
    if (!data || data.length < 2) return <div style={{ height: h }} />
    const max = Math.max(...data, 1), min = Math.min(...data), rng = Math.max(1, max - min)
    const pts = data.map((d, i) => `${(i / (data.length - 1)) * w},${h - ((d - min) / rng) * (h - 4) - 2}`).join(' ')
    const id = 'sg' + color.replace('#', '')
    return (
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.35" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
        <polyline points={`0,${h} ${pts} ${w},${h}`} fill={`url(#${id})`} stroke="none" />
        <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    )
  }
  function Donut({ data, size = 130, thickness = 20 }) {
    const total = Math.max(1, data.reduce((s, d) => s + d.count, 0))
    const r = (size - thickness) / 2, cx = size / 2, cy = size / 2, circ = 2 * Math.PI * r
    let offset = 0
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.soft} strokeWidth={thickness} />
        {data.map((d, i) => {
          const dash = (d.count / total) * circ
          const el = <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth={thickness} strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-offset} transform={`rotate(-90 ${cx} ${cy})`} />
          offset += dash
          return el
        })}
      </svg>
    )
  }
  const iconMap = { eye: 'ti-eye', form: 'ti-forms', click: 'ti-click', trend: 'ti-trending-up', device: 'ti-device-mobile', star: 'ti-star', spark: 'ti-sparkles', cat: 'ti-category' }

  function KpiCard({ label, value, suffix, chg, color, icon, sparkData, sub }) {
    const up = (chg ?? 0) >= 0
    return (
      <Panel glow style={{ position: 'relative', overflow: 'hidden', minWidth: 0 }}>
        <div style={{ position: 'absolute', top: -28, right: -28, width: 88, height: 88, borderRadius: '50%', background: color, filter: 'blur(45px)', opacity: isDark ? 0.22 : 0.12 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDark ? `${color}22` : `${color}1a`, border: `1px solid ${color}55` }}>
            <i className={`ti ${icon}`} style={{ fontSize: 15, color }} />
          </div>
          <span style={{ fontSize: 10, color: C.t2, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</span>
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: C.t1, letterSpacing: '-0.5px', lineHeight: 1.1, marginTop: 10 }}>{value}{suffix && <span style={{ fontSize: 14, color: C.t2 }}>{suffix}</span>}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
          <div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, color: up ? C.green : C.red }}>
              <i className={`ti ${up ? 'ti-trending-up' : 'ti-trending-down'}`} style={{ fontSize: 13 }} />{Math.abs(chg ?? 0)}%
            </span>
            {sub && <div style={{ fontSize: 8.5, color: C.t3, marginTop: 1 }}>{sub}</div>}
          </div>
          {sparkData && <div style={{ width: '46%' }}><Spark data={sparkData} color={color} h={28} /></div>}
        </div>
      </Panel>
    )
  }

  const Title = ({ children, right }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <span style={{ fontSize: 12.5, fontWeight: 800, color: C.t1, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{children}</span>
      {right}
    </div>
  )

  function TrendChart() {
    const d = trend
    if (!d.length) return <div style={{ height: 200 }} />
    const W = 720, H = 200, pad = 30
    const max = Math.max(...d.map(x => x.v), 1)
    const stepX = (W - pad) / Math.max(1, d.length - 1)
    const pts = d.map((x, i) => `${pad + i * stepX},${H - 24 - (x.v / max) * (H - 50)}`).join(' ')
    const area = `${pad},${H - 24} ${pts} ${pad + (d.length - 1) * stepX},${H - 24}`
    const ticks = mobile ? 4 : 6
    return (
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="tArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.indigo} stopOpacity="0.4" /><stop offset="100%" stopColor={C.indigo} stopOpacity="0" /></linearGradient>
          <linearGradient id="tLine" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor={C.cyan} /><stop offset="100%" stopColor={C.purple} /></linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => <line key={i} x1={pad} y1={24 + f * (H - 48)} x2={W} y2={24 + f * (H - 48)} stroke={C.line} strokeWidth="1" />)}
        <polygon points={area} fill="url(#tArea)" />
        <polyline points={pts} fill="none" stroke="url(#tLine)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {d.map((x, i) => { if (i % Math.ceil(d.length / ticks) !== 0 && i !== d.length - 1) return null; return <text key={i} x={pad + i * stepX} y={H - 6} fontSize="9" fill={C.t3} textAnchor="middle">{x.label.slice(5)}</text> })}
      </svg>
    )
  }

  function exportCSV() {
    const rows = []
    rows.push(['TrustDubai Analytics Export', new Date().toLocaleString('en-AE')])
    rows.push([])
    rows.push(['KPIs'])
    rows.push(['Profile Views', kpi.views]); rows.push(['Unique Visitors', kpi.unique])
    rows.push(['Lead Form Views', kpi.leadViews]); rows.push(['Sponsor Impressions', kpi.sponsorImp])
    rows.push(['Returning %', kpi.returning]); rows.push(['Growth Score', kpi.growth])
    rows.push([])
    rows.push(['Session Stats'])
    rows.push(['Total Visits', sessionStats.totalVisits]); rows.push(['Avg Time (sec)', sessionStats.avgTime])
    rows.push(['Pages per Visit', sessionStats.pagesPerVisit]); rows.push(['Bounce Rate %', sessionStats.bounce]); rows.push(['Lead Conversion %', sessionStats.leadConv])
    rows.push([])
    rows.push(['Top Companies', 'Views']); topCos.forEach(c => rows.push([c.name, c.views]))
    rows.push([])
    rows.push(['Top Categories (Internal)', 'Share %', 'Count']); catsInternal.forEach(c => rows.push([c.name, c.pct, c.count]))
    rows.push([])
    rows.push(['Country', 'Share %']); countries.forEach(c => rows.push([c.name, c.pct]))
    const csv = rows.map(r => r.map(x => `"${String(x ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `trustdubai-analytics-${new Date().toISOString().slice(0, 10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  const grid3 = mobile ? '1fr' : 'repeat(3, 1fr)'
  const COLORS4 = [C.green, C.amber, C.indigo, C.pink]

  // ===================== DASHBOARD =====================
  const dashboard = (
    <>
      {/* KPI ROW (6) */}
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr 1fr' : tablet ? 'repeat(3,1fr)' : 'repeat(6,1fr)', gap: 12, marginBottom: 14 }}>
        <KpiCard label="Profile Views" value={fmt(kpi.views)} chg={kpi.viewsChg} color={C.cyan} icon="ti-eye" sparkData={trend.map(t => t.v)} sub={`vs prev ${range}d`} />
        <KpiCard label="Unique Visitors" value={fmt(kpi.unique)} chg={kpi.uniqueChg} color={C.purple} icon="ti-users" sparkData={trend.map(t => t.v)} sub="by IP" />
        <KpiCard label="Lead Form Views" value={fmt(kpi.leadViews)} chg={kpi.leadChg} color={C.indigo} icon="ti-clipboard-list" sparkData={trend.map(t => t.v)} sub={`vs prev ${range}d`} />
        <KpiCard label="Sponsor Impr." value={fmt(kpi.sponsorImp)} chg={kpi.sponsorChg} color={C.amber} icon="ti-speakerphone" sparkData={trend.map(t => t.v)} sub={`vs prev ${range}d`} />
        <KpiCard label="Returning" value={kpi.returning} suffix="%" chg={kpi.returningChg} color={C.green} icon="ti-refresh" sub="repeat visitors" />
        <KpiCard label="Growth Score" value={kpi.growth} suffix="/100" chg={0} color={C.pink} icon="ti-rocket" sub={kpi.growth >= 70 ? 'Excellent' : kpi.growth >= 40 ? 'Healthy' : 'Building'} />
      </div>

      {/* PLATFORM SUPPLY — company composition (live counts) */}
      <Panel glow style={{ marginBottom: 14 }}>
        <Title right={<span style={{ fontSize: 9, color: C.t3 }}>Live counts · count:exact</span>}>Platform Supply</Title>
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(2,1fr)' : 'repeat(5,1fr)', gap: 10, marginBottom: 14 }}>
          {[
            { l: 'Total Companies', v: supply.total, c: C.cyan, icon: 'ti-building-store', sub: null },
            { l: 'Verified', v: supply.verified, c: C.green, icon: 'ti-rosette-discount-check', sub: pctOf(supply.verified, supply.total) },
            { l: 'Claimed', v: supply.claimed, c: C.purple, icon: 'ti-discount-check', sub: pctOf(supply.claimed, supply.total) },
            { l: 'Active Members', v: supply.members, c: C.indigo, icon: 'ti-users-group', sub: pctOf(supply.members, supply.total) },
            { l: 'Listed (unclaimed)', v: supply.listed, c: C.amber, icon: 'ti-list-search', sub: pctOf(supply.listed, supply.total) },
          ].map((m, i) => (
            <div key={i} style={{ background: C.soft, border: `1px solid ${C.line}`, borderRadius: 12, padding: '12px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                <div style={{ width: 26, height: 26, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${m.c}22`, border: `1px solid ${m.c}55` }}>
                  <i className={`ti ${m.icon}`} style={{ fontSize: 13, color: m.c }} />
                </div>
                <span style={{ fontSize: 9, fontWeight: 800, color: C.t3, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{m.l}</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: C.t1, letterSpacing: '-0.5px' }}>{fmt(m.v)}</div>
              {m.sub != null && <div style={{ fontSize: 9.5, color: C.t3, marginTop: 2 }}>{m.sub}% of total</div>}
            </div>
          ))}
        </div>
        {/* Plan mix */}
        <div style={{ fontSize: 9.5, fontWeight: 800, color: C.t3, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>Plan Mix</div>
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(2,1fr)', gap: mobile ? 0 : 18 }}>
          {(() => {
            const plans = [
              { k: 'free', l: 'Free', c: C.t3 },
              { k: 'silver', l: 'Silver', c: '#94a3b8' },
              { k: 'gold', l: 'Gold', c: C.amber },
              { k: 'platinum', l: 'Platinum', c: C.purple },
            ]
            const ptot = Math.max(1, plans.reduce((s, p) => s + (supply.plans[p.k] || 0), 0))
            return plans.map((p, i) => {
              const v = supply.plans[p.k] || 0
              const pc = Math.round((v / ptot) * 100)
              return (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 10.5, color: C.t2 }}>{p.l}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 800, color: C.t1 }}>{fmt(v)} <span style={{ fontSize: 9, color: C.t3 }}>({pc}%)</span></span>
                  </div>
                  <div style={{ height: 6, background: C.soft, borderRadius: 99, overflow: 'hidden' }}><div style={{ width: `${pc}%`, height: '100%', background: p.c, borderRadius: 99 }} /></div>
                </div>
              )
            })
          })()}
        </div>
      </Panel>

      {/* TREND + AI INSIGHTS */}
      <div style={{ display: 'grid', gridTemplateColumns: (mobile || tablet) ? '1fr' : '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <Panel glow>
          <Title right={<span style={{ fontSize: 10.5, color: C.t2 }}>{range} Days</span>}>Views Trend (Daily)</Title>
          <TrendChart />
        </Panel>
        <Panel glow style={{ background: isDark ? 'linear-gradient(150deg,rgba(99,102,241,0.14),rgba(168,85,247,0.06))' : C.panel }}>
          <Title right={<i className="ti ti-robot" style={{ fontSize: 18, color: C.purple }} />}>AI Insights Engine</Title>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {insights.map((ins, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${ins.color}22`, border: `1px solid ${ins.color}55` }}>
                  <i className={`ti ${iconMap[ins.icon] || 'ti-bulb'}`} style={{ fontSize: 12, color: ins.color }} />
                </div>
                <span style={{ fontSize: 12, color: C.t2, lineHeight: 1.5 }}>{ins.text}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 13, padding: 12, borderRadius: 12, background: C.soft, border: `1px solid ${C.line}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
              <i className="ti ti-bulb" style={{ fontSize: 14, color: C.cyan }} />
              <span style={{ fontSize: 10, fontWeight: 800, color: C.cyan, letterSpacing: '0.06em' }}>RECOMMENDATION</span>
            </div>
            <div style={{ fontSize: 12, color: C.t1, lineHeight: 1.5 }}>{recommendation}</div>
          </div>
        </Panel>
      </div>

      {/* COUNTRY + DEVICE + TOP COMPANIES + TOP CATEGORIES */}
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : tablet ? '1fr 1fr' : 'repeat(4,1fr)', gap: 14, marginBottom: 14 }}>
        <Panel glow>
          <Title>Country Breakdown</Title>
          {countries.length === 0 ? <Empty C={C} text="No data yet." /> : (
            <>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                <div style={{ position: 'relative' }}>
                  <Donut data={countries.map((c, i) => ({ count: c.count, color: [C.indigo, C.cyan, C.purple, C.amber, C.pink, C.green][i % 6] }))} size={110} thickness={18} />
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: C.t1 }}>{countries[0]?.pct}%</div>
                </div>
              </div>
              {countries.slice(0, 5).map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: [C.indigo, C.cyan, C.purple, C.amber, C.pink][i % 5], flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: C.t1, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.flag} {c.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: C.t1 }}>{c.pct}%</span>
                </div>
              ))}
            </>
          )}
        </Panel>

        <Panel glow>
          <Title>Device Breakdown</Title>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <div style={{ position: 'relative' }}>
              <Donut data={devices} size={120} thickness={20} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 17, fontWeight: 800, color: C.t1 }}>{devices[1]?.pct || 0}%</span>
                <span style={{ fontSize: 8.5, color: C.t3 }}>{devices.slice().sort((a,b)=>b.count-a.count)[0]?.name || 'Desktop'}</span>
              </div>
            </div>
          </div>
          {devices.map((d, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
              <span style={{ fontSize: 11.5, color: C.t1, flex: 1 }}>{d.name}</span>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: C.t1 }}>{d.pct}%</span>
            </div>
          ))}
        </Panel>

        <Panel glow>
          <Title>Top Viewed Companies</Title>
          {topCos.length === 0 ? <Empty C={C} text="No views yet." /> : topCos.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: C.t3, width: 12 }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>{c.name}</div>
                <div style={{ height: 5, background: C.soft, borderRadius: 99, overflow: 'hidden' }}><div style={{ width: `${c.pct}%`, height: '100%', background: `linear-gradient(90deg,${C.purple},${C.indigo})`, borderRadius: 99 }} /></div>
              </div>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: C.t2, minWidth: 38, textAlign: 'right' }}>{fmt(c.views)}</span>
            </div>
          ))}
        </Panel>

        <Panel glow>
          <Title right={<span style={{ fontSize: 9, color: C.t3 }}>Internal</span>}>Top Categories</Title>
          {catsInternal.length === 0 ? <Empty C={C} text="No category data yet." /> : catsInternal.slice(0, 5).map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: C.t3, width: 12 }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>{c.name}</div>
                <div style={{ height: 5, background: C.soft, borderRadius: 99, overflow: 'hidden' }}><div style={{ width: `${c.pct}%`, height: '100%', background: c.color, borderRadius: 99 }} /></div>
              </div>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: C.t2, minWidth: 34, textAlign: 'right' }}>{c.pct}%</span>
            </div>
          ))}
        </Panel>
      </div>

      {/* LEAD FUNNEL + SPONSOR + HOURLY HEATMAP + SOURCES */}
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : tablet ? '1fr 1fr' : '1fr 1.1fr 1.1fr 1fr', gap: 14, marginBottom: 14, alignItems: 'start' }}>
        <Panel glow>
          <Title>Lead Funnel</Title>
          {(() => {
            const stages = [
              { l: 'Lead Form Views', v: funnel.views, c: C.indigo },
              { l: 'Form Started', v: funnel.started, c: C.purple },
              { l: 'Form Submitted', v: funnel.submitted, c: C.pink },
              { l: 'Contacted', v: funnel.contacted, c: C.green },
            ]
            const top = Math.max(1, funnel.views)
            return stages.map((s, i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 10.5, color: C.t2 }}>{s.l}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: C.t1 }}>{fmt(s.v)} <span style={{ fontSize: 9, color: C.t3 }}>({Math.round((s.v / top) * 100)}%)</span></span>
                </div>
                <div style={{ height: 7, background: C.soft, borderRadius: 99, overflow: 'hidden' }}><div style={{ width: `${Math.round((s.v / top) * 100)}%`, height: '100%', background: s.c, borderRadius: 99 }} /></div>
              </div>
            ))
          })()}
          <div style={{ marginTop: 8, textAlign: 'center', fontSize: 10, color: C.t3 }}>Conversion <b style={{ color: C.green }}>{funnel.views > 0 ? Math.round((funnel.submitted / funnel.views) * 100) : 0}%</b></div>
        </Panel>

        <Panel glow>
          <Title>Sponsor Performance</Title>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
            {[{ l: 'IMPRESSIONS', v: fmt(sponsor.imp), c: C.purple }, { l: 'CLICKS', v: fmt(sponsor.clicks), c: C.cyan }, { l: 'CTR', v: sponsor.ctr + '%', c: C.amber }, { l: 'LEADS', v: fmt(sponsor.leads), c: C.green }].map((m, i) => (
              <div key={i} style={{ background: C.soft, border: `1px solid ${C.line}`, borderRadius: 10, padding: '9px 10px' }}>
                <div style={{ fontSize: 8.5, fontWeight: 800, color: C.t3, letterSpacing: '0.05em' }}>{m.l}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.t1, marginTop: 2 }}>{m.v}</div>
                <div style={{ height: 3, background: m.c, borderRadius: 99, marginTop: 6, opacity: 0.7 }} />
              </div>
            ))}
          </div>
        </Panel>

        <Panel glow>
          <Title>Hourly Visitor Heatmap</Title>
          {heatmap.length === 0 ? <Empty C={C} text="No data yet." /> : (
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: 7.5, color: C.t3, paddingTop: 16, height: 192 }}>
                {['00','06','12','18','23'].map(h => <span key={h}>{h}</span>)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3, marginBottom: 4 }}>
                  {DAYS.map(d => <span key={d} style={{ fontSize: 7.5, color: C.t3, textAlign: 'center' }}>{d}</span>)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
                  {DAYS.map((_, dayIdx) => (
                    <div key={dayIdx} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {Array.from({ length: 24 }).map((_, h) => {
                        const cell = heatmap[dayIdx]?.[h] || { intensity: 0, count: 0 }
                        const op = cell.intensity === 0 ? 0.06 : 0.2 + cell.intensity * 0.8
                        return <div key={h} title={`${DAYS[dayIdx]} ${h}:00 — ${cell.count} visits`} style={{ height: 7, borderRadius: 2, background: C.indigo, opacity: op }} />
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Panel>

        <Panel glow>
          <Title>Top Source Pages</Title>
          {sources.length === 0 ? <Empty C={C} text="No source data yet." /> : sources.map((s, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 10.5, color: C.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                <span style={{ fontSize: 10.5, fontWeight: 800, color: C.t1 }}>{s.pct}%</span>
              </div>
              <div style={{ height: 5, background: C.soft, borderRadius: 99, overflow: 'hidden' }}><div style={{ width: `${s.pct}%`, height: '100%', background: `linear-gradient(90deg,${C.cyan},${C.indigo})`, borderRadius: 99 }} /></div>
            </div>
          ))}
        </Panel>
      </div>

      {/* SESSION STATS STRIP */}
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr 1fr' : 'repeat(5,1fr)', gap: 12, marginBottom: 14 }}>
        {[
          { l: 'TOTAL VISITS', v: fmt(sessionStats.totalVisits), c: C.cyan, icon: 'ti-users-group' },
          { l: 'AVG. TIME ON SITE', v: fmtDuration(sessionStats.avgTime), c: C.purple, icon: 'ti-clock' },
          { l: 'PAGES PER VISIT', v: sessionStats.pagesPerVisit, c: C.indigo, icon: 'ti-files' },
          { l: 'BOUNCE RATE', v: sessionStats.bounce + '%', c: C.amber, icon: 'ti-arrow-bounce' },
          { l: 'LEAD CONVERSION', v: sessionStats.leadConv + '%', c: C.green, icon: 'ti-target-arrow' },
        ].map((m, i) => (
          <Panel key={i} glow style={{ textAlign: 'center' }}>
            <i className={`ti ${m.icon}`} style={{ fontSize: 16, color: m.c }} />
            <div style={{ fontSize: 22, fontWeight: 800, color: C.t1, marginTop: 6, letterSpacing: '-0.5px' }}>{m.v}</div>
            <div style={{ fontSize: 8.5, fontWeight: 700, color: C.t3, letterSpacing: '0.05em', marginTop: 2 }}>{m.l}</div>
          </Panel>
        ))}
      </div>

      {/* TOP CATEGORIES (GLOBAL) — API placeholder */}
      <Panel glow style={{ marginBottom: 14, borderStyle: 'dashed' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <i className="ti ti-world-search" style={{ fontSize: 16, color: C.amber }} />
          <span style={{ fontSize: 12.5, fontWeight: 800, color: C.t1, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Top Categories (Global)</span>
          <span style={{ fontSize: 8.5, fontWeight: 800, background: `${C.amber}22`, color: C.amber, padding: '2px 7px', borderRadius: 5, border: `1px solid ${C.amber}55` }}>NEW</span>
          <span style={{ fontSize: 10, color: C.t3 }}>Global search-volume data for Dubai/UAE (via DataForSEO)</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(2,1fr)' : 'repeat(5,1fr)', gap: 10 }}>
          {['Interior Design', 'Renovation', 'AC Service', 'Plumbing', 'Painting'].map((c, i) => (
            <div key={i} style={{ background: C.soft, border: `1px solid ${C.line}`, borderRadius: 12, padding: '14px 10px', textAlign: 'center' }}>
              <i className="ti ti-search" style={{ fontSize: 18, color: C.t3 }} />
              <div style={{ fontSize: 10.5, color: C.t2, marginTop: 7, fontWeight: 600 }}>{c}</div>
              <div style={{ fontSize: 9, color: C.t3, marginTop: 3 }}>Coming Soon</div>
            </div>
          ))}
        </div>
      </Panel>

      {/* footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, fontSize: 11, color: C.t2 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: C.green }} /> All Systems Operational · {realtime} active in last 30 min</span>
        <span style={{ color: C.t3 }}>Timezone: Asia/Dubai (GMT +4) · Data by TrustDubai Engine</span>
      </div>
    </>
  )

  return (
    <div ref={rootRef} style={{ background: C.bg, minHeight: '100%', fontFamily: F, color: C.t1, padding: mobile ? 12 : 18, position: 'relative', ...(isFull ? { height: '100vh', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' } : {}) }}>
      <style>{`@keyframes pulseDot{0%,100%{opacity:1}50%{opacity:0.3}}@keyframes spin{to{transform:rotate(360deg)}} .an-scroll::-webkit-scrollbar{width:6px}.an-scroll::-webkit-scrollbar-thumb{background:${C.line};border-radius:99px}`}</style>

      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setPage && setPage('dashboard')} title="Back"
            style={{ width: 38, height: 38, borderRadius: 11, border: `1px solid ${C.line}`, background: C.soft, color: C.t1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="ti ti-arrow-left" style={{ fontSize: 18 }} />
          </button>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: 'linear-gradient(135deg,#6366f1,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className="ti ti-sparkles" style={{ fontSize: 20, color: '#fff' }} />
          </div>
          <div>
            <div style={{ fontSize: mobile ? 18 : 22, fontWeight: 800, letterSpacing: '-0.5px' }}>AI Command Center</div>
            <div style={{ fontSize: 11, color: C.t2, marginTop: 1 }}>Real-time insights & analytics for TrustDubai Platform</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: C.soft, border: `1px solid ${C.line}`, borderRadius: 10, padding: 3 }}>
            {[7, 30, 90].map(r => (
              <button key={r} onClick={() => setRange(r)} style={{ border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, padding: '6px 11px', borderRadius: 7, background: range === r ? `linear-gradient(135deg,${C.indigo},${C.purple})` : 'transparent', color: range === r ? '#fff' : C.t2 }}>{r}d</button>
            ))}
          </div>
          <button onClick={() => loadAll(true)} title="Refresh now" disabled={refreshing}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: C.t1, background: C.soft, border: `1px solid ${C.line}`, borderRadius: 10, padding: '8px 12px', cursor: refreshing ? 'wait' : 'pointer' }}>
            <i className="ti ti-refresh" style={{ fontSize: 15, display: 'inline-block', animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} /> Refresh
          </button>
          <button onClick={exportCSV} title="Export CSV"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: C.t1, background: C.soft, border: `1px solid ${C.line}`, borderRadius: 10, padding: '8px 12px', cursor: 'pointer' }}>
            <i className="ti ti-download" style={{ fontSize: 15 }} /> Export CSV
          </button>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: C.green }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.green, animation: 'pulseDot 1.6s infinite' }} /> Live
          </span>
          <span style={{ fontSize: 10.5, color: C.t3, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }} title="Data auto-refreshes every 30s">
            {lastSync ? `Updated ${lastSync.toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Dubai' })}` : '—'}
          </span>
          <span style={{ fontSize: 11.5, color: C.t2, fontVariantNumeric: 'tabular-nums', minWidth: 78 }}>{clock}</span>
          <button onClick={toggleFull} title="Fullscreen"
            style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${C.line}`, background: C.soft, color: C.t1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className={`ti ${isFull ? 'ti-arrows-minimize' : 'ti-arrows-maximize'}`} style={{ fontSize: 16 }} />
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: C.t2 }}>
          <div style={{ width: 34, height: 34, border: `3px solid ${C.line}`, borderTopColor: C.purple, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          Loading command center…
        </div>
      ) : (
        <div style={isFull ? { flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' } : {}}>
          <div ref={contentRef} style={isFull ? { width: '100%', transform: `scaleY(${scale})`, transformOrigin: 'top center' } : {}}>
            <div style={{ display: 'grid', gridTemplateColumns: (mobile || tablet) ? '1fr' : '1fr 300px', gap: 14, alignItems: 'start' }}>
              <div style={{ minWidth: 0 }}>{dashboard}</div>

              {/* RIGHT RAIL — LIVE ACTIVITY */}
              <Panel glow style={{ display: 'flex', flexDirection: 'column', maxHeight: isFull ? 'none' : 880 }}>
                <Title right={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: C.green }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, animation: 'pulseDot 1.6s infinite' }} />Live</span>}>Live Activity Feed</Title>
                <div className="an-scroll" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                  {feed.length === 0 ? <Empty C={C} text="No recent activity." /> : feed.map((a, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, padding: '9px 0', borderBottom: i < feed.length - 1 ? `1px solid ${C.line}` : 'none' }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.soft, border: `1px solid ${C.line}`, fontSize: 13 }}>{a.flag}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: C.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</span>
                          <span style={{ fontSize: 9.5, color: C.t3, whiteSpace: 'nowrap', flexShrink: 0 }}>{timeAgo(a.t)}</span>
                        </div>
                        <div style={{ fontSize: 10.5, color: C.t2, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Empty({ C, text }) {
  return <div style={{ fontSize: 12, color: C.t3, padding: '18px 4px', textAlign: 'center' }}>{text}</div>
}
