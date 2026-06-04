// trustdubai-admin/src/pages/ControlWall.jsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

/* =========================================================================
   TrustDubai — CONTROL WALL
   One full-screen board = Command Center + Revenue Engine combined.
   • Scale-to-fit: designed on a fixed 1600x900 canvas, auto-scaled to ANY
     screen (TV / desktop / laptop / tablet / phone) — no scroll ever.
   • Light + dark toggle (persisted) · Back button · Live auto-refresh (30s).
   ========================================================================= */

// ---- EDITABLE: plan prices in AED / month (Gold confirmed = 299) ----
const PLAN_PRICES = { free: 0, silver: 99, gold: 299, platinum: 599 }

const REFRESH_MS = 30000
const BASE_W = 1600, BASE_H = 900

/* ------------------------------ helpers -------------------------------- */
const pick = (o, ks) => { for (const k of ks) if (o && o[k]!==undefined && o[k]!==null && o[k]!=='') return o[k]; return null }
const norm = v => String(v||'').trim().toLowerCase()
const normStatus = raw => { const s=norm(raw); if(!s)return'new'; if(/contact|reach|call/.test(s))return'contacted'; if(/quot|propos|estimat|sent/.test(s))return'quoted'; if(/negoti|discuss/.test(s))return'negotiation'; if(/won|success|convert|deal/.test(s)&&!/lost/.test(s))return'won'; if(/lost|reject|dead|drop|junk|spam/.test(s))return'lost'; return'new' }
const normSource = raw => { const s=norm(raw); if(!s)return'Other'; if(/meta|facebook|fb|insta|ig/.test(s))return'Meta Ads'; if(/whats|wa\b/.test(s))return'WhatsApp'; if(/form|web|site|landing/.test(s))return'Form'; if(/manual|admin|direct|walk/.test(s))return'Manual'; if(/google|ppc/.test(s))return'Google'; return raw?String(raw).charAt(0).toUpperCase()+String(raw).slice(1):'Other' }
const normTemp = raw => { const s=norm(raw); if(/hot|high/.test(s))return'hot'; if(/warm|med/.test(s))return'warm'; if(/cold|low/.test(s))return'cold'; return '' }
const normCat = raw => { const s=norm(raw); if(/resid|home|villa|apart/.test(s))return'Residential'; if(/commerc|office|retail|shop/.test(s))return'Commercial'; if(/indus|ware|factory/.test(s))return'Industrial'; if(/reno|fitout|fit-out|refurb/.test(s))return'Renovation'; return raw?String(raw).charAt(0).toUpperCase()+String(raw).slice(1):'Other' }
const parseBudget = raw => { if(raw==null)return 0; const d=String(raw).replace(/[, ]/g,'').match(/\d+/g); return d?Math.max(...d.map(Number)):0 }
const startOfDay = d => { const x=new Date(d); x.setHours(0,0,0,0); return x }
const daysBetween = (a,b) => Math.floor((a-b)/864e5)
const pctChange = (n,p) => p===0 ? (n>0?100:0) : Math.round(((n-p)/p)*100)
const timeAgo = s => { if(!s)return''; const d=(Date.now()-new Date(s).getTime())/1000; if(d<60)return'just now'; if(d<3600)return`${Math.floor(d/60)}m ago`; if(d<86400)return`${Math.floor(d/3600)}h ago`; if(d<604800)return`${Math.floor(d/86400)}d ago`; return new Date(s).toLocaleDateString() }
const fmtN = n => (n||0).toLocaleString()
const fmtMoney = n => { n=n||0; if(n>=1e6)return'AED '+(n/1e6).toFixed(1)+'M'; if(n>=1e3)return'AED '+(n/1e3).toFixed(1)+'K'; return 'AED '+Math.round(n) }
const aiScore = l => { let s=0; const t=normTemp(pick(l,['temperature','temp','priority'])); s+=t==='hot'?40:t==='warm'?25:t==='cold'?10:15; const c=pick(l,['created_at','createdAt']); const dys=c?daysBetween(Date.now(),new Date(c).getTime()):999; s+=dys<=3?25:dys<=7?20:dys<=14?15:dys<=30?10:5; const src=normSource(pick(l,['source','lead_source'])); s+=(src==='Meta Ads'||src==='Form')?20:src==='WhatsApp'?15:src==='Manual'?10:12; const b=parseBudget(pick(l,['budget','budget_range','amount'])); s+=b>=1e5?15:b>=5e4?12:b>=2e4?8:b>0?5:6; return Math.min(100,s) }

/* --------------------------- chart atoms ------------------------------- */
function Spark({ data, color, w=120, h=30 }) {
  if (!data || data.length<2) return <svg width={w} height={h}><line x1="0" y1={h/2} x2={w} y2={h/2} stroke={color} strokeWidth="1.5" opacity="0.25" strokeDasharray="3,3"/></svg>
  const max=Math.max(...data), min=Math.min(...data), rng=max-min||1
  const pts=data.map((v,i)=>`${(i/(data.length-1))*w},${h-((v-min)/rng)*(h-6)-3}`).join(' ')
  const gid='g'+color.replace('#','')+w
  return <svg width={w} height={h} style={{ overflow:'visible' }}>
    <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.25"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
    <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#${gid})`}/>
    <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
}

function Donut({ segs, total, label, size=110, C }) {
  const stroke=15, r=(size-stroke)/2, c=2*Math.PI*r
  const sum=segs.reduce((a,d)=>a+d.value,0)||1; let acc=0
  return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink:0 }}>
    <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.track} strokeWidth={stroke}/>
    {segs.map((d,i)=>{ const len=(d.value/sum)*c; const el=<circle key={i} cx={size/2} cy={size/2} r={r} fill="none" stroke={d.color} strokeWidth={stroke} strokeDasharray={`${Math.max(len-2,0)} ${c}`} strokeDashoffset={-acc} transform={`rotate(-90 ${size/2} ${size/2})`}/>; acc+=len; return el })}
    <text x="50%" y="46%" textAnchor="middle" style={{ fontSize:17, fontWeight:800, fill:C.text }}>{fmtN(total)}</text>
    <text x="50%" y="61%" textAnchor="middle" style={{ fontSize:8.5, fill:C.text3 }}>{label}</text>
  </svg>
}

function DualLine({ series, c1, c2, C, h=120 }) {
  if (!series || series.length<2) return <div style={{ height:h, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:C.text3 }}>Not enough data</div>
  const w=1000, pad=6
  const aMax=Math.max(...series.map(s=>s.a),1), bMax=Math.max(...series.map(s=>s.b),1)
  const x=i=>(i/(series.length-1))*w, ya=v=>h-(v/aMax)*(h-pad*2)-pad, yb=v=>h-(v/bMax)*(h-pad*2)-pad
  const la=series.map((s,i)=>`${x(i)},${ya(s.a)}`).join(' '), lb=series.map((s,i)=>`${x(i)},${yb(s.b)}`).join(' ')
  return <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display:'block' }}>
    <defs><linearGradient id="dlA" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={c1} stopOpacity="0.18"/><stop offset="100%" stopColor={c1} stopOpacity="0"/></linearGradient></defs>
    {[0,0.5,1].map((f,i)=><line key={i} x1="0" y1={h*f} x2={w} y2={h*f} stroke={C.track} strokeWidth="1"/>)}
    <polygon points={`0,${h} ${la} ${w},${h}`} fill="url(#dlA)"/>
    <polyline points={la} fill="none" stroke={c1} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
    <polyline points={lb} fill="none" stroke={c2} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
  </svg>
}

function VBars({ rows, C, h=110, suffix='' }) {
  const max=Math.max(1,...rows.map(r=>r.value))
  return <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-around', gap:6, height:h }}>
    {rows.map((r,i)=>(
      <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, flex:1, height:'100%', justifyContent:'flex-end' }}>
        <span style={{ fontSize:10.5, fontWeight:700, color:C.text }}>{r.value}{suffix}</span>
        <div style={{ width:'58%', maxWidth:30, flex:1, display:'flex', alignItems:'flex-end' }}>
          <div style={{ width:'100%', height:`${(r.value/max)*100}%`, minHeight:3, background:r.color, borderRadius:'5px 5px 0 0' }}/>
        </div>
        <span style={{ fontSize:9, color:C.text3, fontWeight:600 }}>{r.label}</span>
      </div>
    ))}
    {rows.length===0 && <div style={{ color:C.text3, fontSize:11, margin:'auto' }}>No data</div>}
  </div>
}

function Funnel({ stages, C }) {
  const max=Math.max(1,...stages.map(s=>s.value)), total=stages[0]?.value||1
  return <div style={{ display:'flex', flexDirection:'column', gap:6, justifyContent:'center', height:'100%' }}>
    {stages.map((s,i)=>(
      <div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ fontSize:10, color:C.text3, width:62, flexShrink:0 }}>{s.label}</span>
        <div style={{ flex:1, background:C.track, borderRadius:5, height:16, overflow:'hidden' }}>
          <div style={{ width:`${Math.max((s.value/max)*100,6)}%`, height:'100%', background:s.color, borderRadius:5 }}/>
        </div>
        <span style={{ fontSize:10.5, fontWeight:700, color:C.text, width:58, textAlign:'right', flexShrink:0 }}>{fmtN(s.value)} <em style={{ color:C.text3, fontStyle:'normal', fontWeight:500, fontSize:9 }}>({Math.round(s.value/total*100)}%)</em></span>
      </div>
    ))}
  </div>
}

function Gauge({ value, C }) {
  const r=44, cx=58, cy=58, a0=Math.PI, a1=0, ang=a0+(value/100)*(a1-a0)
  const pt=an=>[cx+r*Math.cos(an), cy+r*Math.sin(an)]
  const [sx,sy]=pt(a0),[ex,ey]=pt(a1),[vx,vy]=pt(ang)
  const color=value>=80?'#22c55e':value>=50?'#f59e0b':'#ef4444'
  return <svg width="116" height="72" viewBox="0 0 116 72">
    <defs><linearGradient id="gg" x1="0" x2="1"><stop offset="0%" stopColor="#ef4444"/><stop offset="50%" stopColor="#f59e0b"/><stop offset="100%" stopColor="#22c55e"/></linearGradient></defs>
    <path d={`M ${sx} ${sy} A ${r} ${r} 0 0 1 ${ex} ${ey}`} fill="none" stroke={C.track} strokeWidth="10" strokeLinecap="round"/>
    <path d={`M ${sx} ${sy} A ${r} ${r} 0 ${value>50?1:0} 1 ${vx} ${vy}`} fill="none" stroke="url(#gg)" strokeWidth="10" strokeLinecap="round"/>
    <text x="58" y="50" textAnchor="middle" style={{ fontSize:22, fontWeight:800, fill:color }}>{value}</text>
    <text x="58" y="64" textAnchor="middle" style={{ fontSize:8.5, fill:C.text3 }}>Average Score</text>
  </svg>
}

/* ============================== MAIN ==================================== */
export default function ControlWall({ onBack, theme: initialTheme }) {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('td-wall-theme') || initialTheme || 'dark' } catch { return initialTheme || 'dark' }
  })
  const isDark = theme !== 'light'
  const toggleTheme = () => setTheme(t => { const n = t==='dark'?'light':'dark'; try{localStorage.setItem('td-wall-theme',n)}catch{} return n })

  const [scale, setScale] = useState(1)
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth/BASE_W, window.innerHeight/BASE_H))
    fit(); window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit)
  }, [])

  const [d, setD] = useState(null)
  const [updated, setUpdated] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setRefreshing(true)
    const safe = async (fn) => { try { return await fn() } catch (e) { console.warn('wall query', e); return null } }
    const now = Date.now()

    const reviews   = (await safe(() => supabase.from('reviews').select('*').limit(5000).then(r=>r.data))) || []
    const companies = (await safe(() => supabase.from('companies').select('*').limit(5000).then(r=>r.data))) || []
    const customers = (await safe(() => supabase.from('customers').select('id,created_at,nationality,gender').limit(10000).then(r=>r.data))) || []
    const leads     = (await safe(() => supabase.from('lead_submissions').select('*').limit(10000).then(r=>r.data))) || []
    const distRows  = await safe(() => supabase.from('lead_distributions').select('id').limit(10000).then(r=>r.data))
    const inbox     = await safe(() => supabase.from('inbox_messages').select('id,is_read,read').limit(10000).then(r=>r.data))

    const compName = {}; companies.forEach(c => { compName[c.id] = c.name || c.company_name || 'Company' })

    const avgRating = reviews.length ? (reviews.reduce((s,r)=>s+(r.rating||0),0)/reviews.length).toFixed(1) : '0.0'
    const inWin = (rows, from, to) => (rows||[]).filter(r=>{ const t=pick(r,['created_at','createdAt'])?new Date(pick(r,['created_at','createdAt'])).getTime():0; return t>=now-from*864e5 && t<now-to*864e5 }).length
    const dailyN = rows => { const a=[]; for(let i=13;i>=0;i--){ const day=startOfDay(now-i*864e5).getTime(), nx=day+864e5; a.push((rows||[]).filter(r=>{const t=pick(r,['created_at','createdAt'])?new Date(pick(r,['created_at','createdAt'])).getTime():0; return t>=day&&t<nx}).length) } return a }

    // status / leads
    const sc={new:0,contacted:0,quoted:0,negotiation:0,won:0,lost:0}; leads.forEach(l=>sc[normStatus(pick(l,['status','stage']))]++)
    const totalLeads=leads.length, won=sc.won, conversion=totalLeads?Math.round((won/totalLeads)*100):0
    const hot=leads.filter(l=>normTemp(pick(l,['temperature','temp','priority']))==='hot').length
    const today=startOfDay(now).getTime()
    let followDue=0; leads.forEach(l=>{ const f=pick(l,['follow_up_date','followup_date','next_follow_up']); if(!f)return; const st=normStatus(pick(l,['status'])); if(st==='won'||st==='lost')return; if(startOfDay(new Date(f)).getTime()<=today)followDue++ })
    const distributed = distRows ? distRows.length : leads.filter(l=>normStatus(pick(l,['status']))!=='new').length

    // source / category
    const srcMap={}; leads.forEach(l=>{ const s=normSource(pick(l,['source','lead_source'])); srcMap[s]=(srcMap[s]||0)+1 })
    const SRC_C={'Meta Ads':'#3b82f6','WhatsApp':'#22c55e','Manual':'#f59e0b','Form':'#8b5cf6','Google':'#06b6d4','Other':'#94a3b8'}
    const sources=Object.entries(srcMap).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([label,value])=>({label,value,color:SRC_C[label]||'#94a3b8'}))
    const catMap={}; leads.forEach(l=>{ const c=normCat(pick(l,['project_type','category','service'])); catMap[c]=(catMap[c]||0)+1 })
    const CAT_C={Residential:'#3b82f6',Commercial:'#22c55e',Industrial:'#8b5cf6',Renovation:'#f59e0b',Other:'#94a3b8'}
    const cats=Object.entries(catMap).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([label,value])=>({label,value,color:CAT_C[label]||'#94a3b8'}))

    // pipeline
    const pipeline=[
      { label:'New', value:sc.new, color:'#3b82f6' },
      { label:'Contacted', value:sc.contacted, color:'#06b6d4' },
      { label:'Quoted', value:sc.quoted, color:'#f59e0b' },
      { label:'Won / Lost', value:sc.won+sc.lost, color:'#22c55e' },
    ]
    // lead status donut
    const statusDonut=[
      { label:'New', value:sc.new, color:'#3b82f6' },
      { label:'Contacted', value:sc.contacted, color:'#06b6d4' },
      { label:'Quoted', value:sc.quoted, color:'#22c55e' },
      { label:'Won', value:sc.won, color:'#16a34a' },
      { label:'Lost', value:sc.lost, color:'#ef4444' },
    ].filter(s=>s.value>0)

    // leads trend 30d
    const trend=[]; for(let i=29;i>=0;i--){ const day=startOfDay(now-i*864e5).getTime(), nx=day+864e5; trend.push({ a:leads.filter(l=>{const t=pick(l,['created_at'])?new Date(pick(l,['created_at'])).getTime():0; return t>=day&&t<nx}).length, b:0 }) }

    // reviews 30d (count + avg rating)
    const rTrend=[]; for(let i=29;i>=0;i--){ const day=startOfDay(now-i*864e5).getTime(), nx=day+864e5; const dr=reviews.filter(r=>{const t=r.created_at?new Date(r.created_at).getTime():0; return t>=day&&t<nx}); rTrend.push({ a:dr.length, b:dr.length?dr.reduce((s,r)=>s+(r.rating||0),0)/dr.length:0 }) }

    // top companies by leads
    const lc={}; leads.forEach(l=>{ const id=pick(l,['company_id','companyId']); if(id)lc[id]=(lc[id]||0)+1 })
    const topCompanies=Object.entries(lc).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([id,v])=>({ name:compName[id]||'Company', value:v }))

    // heatmap 5wk follow-ups
    const heat=[]; for(let wk=4;wk>=0;wk--){ const row=[]; for(let dy=0;dy<7;dy++){ const base=startOfDay(now-(wk*7+(6-dy))*864e5).getTime(), nx=base+864e5; row.push(leads.filter(l=>{const f=pick(l,['follow_up_date','followup_date']); if(!f)return false; const t=startOfDay(new Date(f)).getTime(); return t>=base&&t<nx}).length) } heat.push(row) }
    const heatMax=Math.max(1,...heat.flat())

    // categories (company service categories)
    const svcMap={}; companies.forEach(c=>{ const cat=pick(c,['category','service_category','industry']); if(cat){const k=String(cat); svcMap[k]=(svcMap[k]||0)+1} })
    const SVC_C=['#22c55e','#8b5cf6','#3b82f6','#f59e0b','#94a3b8']
    const svcCats=Object.entries(svcMap).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([label,value],i)=>({label,value,color:SVC_C[i%SVC_C.length]}))

    // businesses growth 6mo
    const months=[]; const nd=new Date()
    for(let i=5;i>=0;i--){ const dt=new Date(nd.getFullYear(),nd.getMonth()-i,1); const key=dt.toISOString().slice(0,7); months.push({ label:dt.toLocaleDateString('en-AE',{month:'short'})+' '+String(dt.getFullYear()).slice(2), value:companies.filter(c=>(c.created_at||'').slice(0,7)<=key).length }) }

    // plan revenue
    const planCount={free:0,silver:0,gold:0,platinum:0}; companies.forEach(c=>{ const p=norm(c.plan)||'free'; if(planCount[p]!==undefined)planCount[p]++ })
    const planRev={}; Object.keys(planCount).forEach(p=>planRev[p]=planCount[p]*(PLAN_PRICES[p]||0))
    const mrr=Object.values(planRev).reduce((a,b)=>a+b,0)

    // ai score
    const scores=leads.map(aiScore); const avgScore=scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length):0
    const scoreBuckets=[
      { label:'Hot (80-100)', value:scores.filter(s=>s>=80).length, color:'#ef4444' },
      { label:'Warm (50-79)', value:scores.filter(s=>s>=50&&s<80).length, color:'#f59e0b' },
      { label:'Cold (0-49)',  value:scores.filter(s=>s<50).length, color:'#3b82f6' },
    ]

    // conversion by source
    const convBySrc=sources.map(s=>{ const t=leads.filter(l=>normSource(pick(l,['source','lead_source']))===s.label).length; const w=leads.filter(l=>normSource(pick(l,['source','lead_source']))===s.label && normStatus(pick(l,['status']))==='won').length; return { label:s.label.replace(' Ads',''), value:t?Math.round((w/t)*100):0, color:s.color } })

    // recent reviews
    const recentReviews=[...reviews].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,4).map(r=>({ name:pick(r,['reviewer_name','customer_name','name'])||'Anonymous', text:pick(r,['comment','review','message','text'])||'', rating:r.rating||0, time:r.created_at }))

    // platform activity (reviews + businesses + users)
    const act=[]
    reviews.slice(-3).forEach(r=>act.push({ icon:'ti-star', color:'#f59e0b', text:`New review submitted by ${pick(r,['reviewer_name','name'])||'a user'}`, time:r.created_at }))
    companies.slice(-3).forEach(c=>act.push({ icon:'ti-building', color:'#3b82f6', text:`New business added: ${c.name||'Business'}`, time:c.created_at }))
    customers.slice(-3).forEach(c=>act.push({ icon:'ti-user-plus', color:'#22c55e', text:`User signed up`, time:c.created_at }))
    act.sort((a,b)=>new Date(b.time)-new Date(a.time))

    // live lead activity
    const liveLeads=[...leads].sort((a,b)=>new Date(pick(b,['created_at']))-new Date(pick(a,['created_at']))).slice(0,5).map(l=>({ src:normSource(pick(l,['source','lead_source'])), name:pick(l,['name','customer_name','full_name'])||'New lead', area:pick(l,['area','location','city'])||'', time:pick(l,['created_at']) }))

    // demographics
    const hasDemo=customers.some(c=>c.nationality||c.gender)
    // geographic
    const areaMap={}; leads.forEach(l=>{ const a=pick(l,['area','location','city']); if(a){const k=String(a); areaMap[k]=(areaMap[k]||0)+1} })
    const areas=Object.entries(areaMap).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,value])=>({name,value}))

    // pending / reported
    const pendingReviews=reviews.filter(r=>{ const s=norm(pick(r,['status'])); return s==='pending'||r.approved===false||r.is_approved===false }).length
    const reportedReviews=reviews.filter(r=>r.is_reported===true||r.reported===true||norm(pick(r,['status']))==='reported').length
    const pendingBiz=companies.filter(c=>norm(c.status)==='pending').length
    const unreadEnq=inbox ? inbox.filter(m=>m.is_read===false||m.read===false).length : sc.new

    setD({
      stats:{ totalReviews:reviews.length, totalBusinesses:companies.length, totalUsers:customers.length, avgRating, enquiries:totalLeads,
              totalLeads, conversion, hot, followDue, distributed, mrr },
      delta:{ reviews:pctChange(inWin(reviews,30,0),inWin(reviews,60,30)), business:pctChange(inWin(companies,30,0),inWin(companies,60,30)),
              users:pctChange(inWin(customers,30,0),inWin(customers,60,30)), leads:pctChange(inWin(leads,30,0),inWin(leads,60,30)) },
      spark:{ reviews:dailyN(reviews), business:dailyN(companies), users:dailyN(customers), leads:dailyN(leads) },
      rTrend, trend, sources, cats, pipeline, statusDonut, topCompanies, heat, heatMax, svcCats, months,
      planCount, planRev, mrr, avgScore, scoreBuckets, convBySrc, recentReviews, act:act.slice(0,5), liveLeads, hasDemo, areas,
      pendingReviews, reportedReviews, pendingBiz, unreadEnq, followToday: leads.filter(l=>{const f=pick(l,['follow_up_date']); if(!f)return false; return startOfDay(new Date(f)).getTime()===today}).length,
      followOverdue: leads.filter(l=>{const f=pick(l,['follow_up_date']); if(!f)return false; const st=normStatus(pick(l,['status'])); if(st==='won'||st==='lost')return false; return startOfDay(new Date(f)).getTime()<today}).length,
    })
    setUpdated(new Date()); setRefreshing(false)
  }, [])

  useEffect(() => { load(); const t=setInterval(load, REFRESH_MS); return () => clearInterval(t) }, [load])

  const goBack = () => { if (onBack) onBack(); else if (window.history.length>1) window.history.back(); else window.location.hash='dashboard' }

  /* ---------- theme tokens ---------- */
  const C = isDark ? {
    page:'#070b12', card:'#0f1521', card2:'#141b29', border:'rgba(255,255,255,0.07)', track:'rgba(255,255,255,0.08)',
    text:'#f1f5f9', text2:'#94a3b8', text3:'#64748b', topbar:'#0b111c',
  } : {
    page:'#eef1f6', card:'#ffffff', card2:'#f8fafc', border:'#e6eaf1', track:'#eef2f7',
    text:'#0f172a', text2:'#64748b', text3:'#94a3b8', topbar:'#ffffff',
  }
  const G={green:'#22c55e',blue:'#3b82f6',purple:'#8b5cf6',amber:'#f59e0b',cyan:'#06b6d4',red:'#ef4444',pink:'#ec4899'}
  const card={ background:C.card, border:`1px solid ${C.border}`, borderRadius:13, padding:'9px 11px', display:'flex', flexDirection:'column', minWidth:0, overflow:'hidden' }
  const Title=({children,right})=>(<div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6, gap:6 }}><span style={{ fontSize:12, fontWeight:700, color:C.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{children}</span>{right}</div>)
  const delChip=v=>(<span style={{ fontSize:9.5, fontWeight:700, color:v>=0?G.green:G.red }}>{v>=0?'↑':'↓'} {Math.abs(v)}% <span style={{ color:C.text3, fontWeight:500 }}>30d</span></span>)

  if (!d) return (
    <div style={{ position:'fixed', inset:0, background:C.page, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:14 }}>
      <div style={{ width:40, height:40, border:`3px solid ${G.green}`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin .8s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ fontSize:13, color:C.text3 }}>Loading Control Wall…</div>
    </div>
  )

  const stat = (icon,tint,label,value,delta,spark,sub) => (
    <div style={{ ...card, padding:'8px 10px', justifyContent:'center' }}>
      <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:3 }}>
        <span style={{ width:26, height:26, borderRadius:7, background:tint+'22', color:tint, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i className={`ti ${icon}`} style={{ fontSize:14 }}/></span>
        <span style={{ fontSize:10, color:C.text2, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{label}</span>
      </div>
      <div style={{ fontSize:21, fontWeight:800, color:C.text, lineHeight:1.05 }}>{value}</div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:4, marginTop:2 }}>
        {delta!=null ? delChip(delta) : <span style={{ fontSize:9.5, color:C.text3 }}>{sub}</span>}
        {spark && <Spark data={spark} color={tint} w={56} h={20}/>}
      </div>
    </div>
  )

  const heatColor=cnt=>{ if(cnt===0)return C.track; const r=cnt/d.heatMax; if(r>0.66)return G.red; if(r>0.33)return G.amber; return G.green }

  return (
    <div style={{ position:'fixed', inset:0, background:C.page, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:BASE_W, height:BASE_H, transform:`scale(${scale})`, transformOrigin:'center center', display:'flex', flexDirection:'column', gap:9, padding:16, color:C.text, fontFamily:"'Inter',system-ui,sans-serif", boxSizing:'border-box' }}>

        {/* TOP BAR */}
        <div style={{ flex:'0 0 46px', display:'flex', alignItems:'center', justifyContent:'space-between', background:C.topbar, border:`1px solid ${C.border}`, borderRadius:12, padding:'0 14px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button onClick={goBack} title="Back" style={{ display:'flex', alignItems:'center', gap:6, background:C.card2, border:`1px solid ${C.border}`, color:C.text, borderRadius:9, padding:'6px 12px', fontSize:12, fontWeight:600, cursor:'pointer' }}><i className="ti ti-arrow-left" style={{ fontSize:15 }}/> Back</button>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:28, height:28, borderRadius:8, background:`linear-gradient(135deg,${G.green},#15803d)`, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff' }}><i className="ti ti-brain" style={{ fontSize:16 }}/></div>
              <div>
                <div style={{ fontSize:14, fontWeight:800, lineHeight:1 }}>TrustDubai</div>
                <div style={{ fontSize:9, color:C.text3 }}>Control Wall · Command + Revenue</div>
              </div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:9 }}>
            <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:G.green, background:G.green+'18', borderRadius:8, padding:'4px 9px', fontWeight:600 }}><span style={{ width:7, height:7, borderRadius:'50%', background:G.green }}/>Live</span>
            <span style={{ fontSize:10.5, color:C.text3 }}>Updated {updated?updated.toLocaleTimeString('en-AE',{hour:'2-digit',minute:'2-digit'}):'—'}</span>
            <button onClick={load} title="Refresh" style={{ width:30, height:30, borderRadius:8, background:C.card2, border:`1px solid ${C.border}`, color:C.text2, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><i className="ti ti-refresh" style={{ fontSize:15, animation:refreshing?'spin .8s linear infinite':'none' }}/></button>
            <button onClick={toggleTheme} title="Toggle theme" style={{ width:30, height:30, borderRadius:8, background:C.card2, border:`1px solid ${C.border}`, color:C.text2, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><i className={`ti ${isDark?'ti-sun':'ti-moon'}`} style={{ fontSize:15 }}/></button>
          </div>
        </div>

        {/* STATS (5 command + 5 revenue) */}
        <div style={{ flex:'0 0 92px', display:'grid', gridTemplateColumns:'repeat(10,1fr)', gap:8 }}>
          {stat('ti-star',G.green,'Total Reviews',fmtN(d.stats.totalReviews),d.delta.reviews,d.spark.reviews)}
          {stat('ti-building',G.blue,'Total Businesses',fmtN(d.stats.totalBusinesses),d.delta.business,d.spark.business)}
          {stat('ti-users',G.purple,'Total Users',fmtN(d.stats.totalUsers),d.delta.users,d.spark.users)}
          {stat('ti-star-half-filled',G.amber,'Avg. Rating',`${d.stats.avgRating}`,null,null,'/ 5')}
          {stat('ti-mail',G.red,'Enquiries',fmtN(d.stats.enquiries),null,null,'all leads')}
          {stat('ti-address-book',G.cyan,'Total Leads',fmtN(d.stats.totalLeads),d.delta.leads,d.spark.leads)}
          {stat('ti-chart-line',G.blue,'Conversion',`${d.stats.conversion}%`,null,null,'won/total')}
          {stat('ti-flame',G.amber,'Hot Leads',fmtN(d.stats.hot),null,null,'priority')}
          {stat('ti-clock',G.purple,'Follow-ups Due',fmtN(d.stats.followDue),null,null,'pending')}
          {stat('ti-coin',G.green,'Est. MRR',fmtMoney(d.stats.mrr),null,null,'monthly')}
        </div>

        {/* ROW 2 */}
        <div style={{ flex:'1.55', display:'grid', gridTemplateColumns:'1.7fr 1.2fr 1.25fr 1.2fr 1.25fr 1fr', gap:9, minHeight:0 }}>
          <div style={card}>
            <Title right={<span style={{ display:'flex', gap:9, fontSize:9.5 }}><span style={{ color:C.text2, display:'flex', alignItems:'center', gap:3 }}><span style={{ width:7, height:7, borderRadius:'50%', background:G.green }}/>Reviews</span><span style={{ color:C.text2, display:'flex', alignItems:'center', gap:3 }}><span style={{ width:7, height:7, borderRadius:'50%', background:G.purple }}/>Ratings</span></span>}>Reviews &amp; Ratings Overview</Title>
            <div style={{ flex:1, minHeight:0, display:'flex', alignItems:'center' }}><DualLine series={d.rTrend} c1={G.green} c2={G.purple} C={C} h={120}/></div>
          </div>
          <div style={card}>
            <Title>Top Service Categories</Title>
            {d.svcCats.length===0 ? <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:C.text3, fontSize:11 }}>No data</div> :
            <div style={{ flex:1, display:'flex', alignItems:'center', gap:8, minHeight:0 }}>
              <Donut segs={d.svcCats} total={d.stats.totalBusinesses} label="Businesses" size={92} C={C}/>
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:4, minWidth:0 }}>
                {d.svcCats.map((s,i)=>(<div key={i} style={{ display:'flex', alignItems:'center', gap:5, fontSize:10 }}><span style={{ width:7, height:7, borderRadius:2, background:s.color, flexShrink:0 }}/><span style={{ flex:1, color:C.text2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.label}</span></div>))}
              </div>
            </div>}
          </div>
          <div style={card}>
            <Title right={<span style={{ fontSize:9.5, color:G.green, cursor:'pointer' }}>View All</span>}>Recent Reviews</Title>
            <div style={{ flex:1, overflow:'hidden' }}>
              {d.recentReviews.length===0 ? <div style={{ color:C.text3, fontSize:11, textAlign:'center', padding:14 }}>No reviews yet</div> :
              d.recentReviews.map((r,i)=>(
                <div key={i} style={{ display:'flex', alignItems:'center', gap:7, padding:'4px 0', borderBottom:i<d.recentReviews.length-1?`1px solid ${C.border}`:'none' }}>
                  <div style={{ width:24, height:24, borderRadius:6, background:G.green+'22', color:G.green, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, flexShrink:0 }}>{(r.name||'A')[0].toUpperCase()}</div>
                  <div style={{ flex:1, minWidth:0 }}><div style={{ fontSize:10.5, fontWeight:600, color:C.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{r.name}</div><div style={{ fontSize:9, color:G.amber }}>{'★'.repeat(r.rating)}</div></div>
                  <span style={{ fontSize:9, color:C.text3, flexShrink:0 }}>{timeAgo(r.time)}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={card}>
            <Title>Pipeline Funnel</Title>
            <div style={{ flex:1, minHeight:0 }}><Funnel stages={d.pipeline} C={C}/></div>
          </div>
          <div style={card}>
            <Title>Leads by Source</Title>
            <div style={{ flex:1, display:'flex', alignItems:'center', gap:8, minHeight:0 }}>
              <Donut segs={d.sources} total={d.stats.totalLeads} label="Total Leads" size={92} C={C}/>
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:3, minWidth:0 }}>
                {d.sources.map((s,i)=>{ const sum=d.sources.reduce((a,x)=>a+x.value,0)||1; return (<div key={i} style={{ display:'flex', alignItems:'center', gap:4, fontSize:9.5 }}><span style={{ width:7, height:7, borderRadius:2, background:s.color, flexShrink:0 }}/><span style={{ flex:1, color:C.text2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.label}</span><span style={{ color:C.text, fontWeight:700 }}>{Math.round(s.value/sum*100)}%</span></div>) })}
              </div>
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:7, minHeight:0 }}>
            <div style={{ ...card, flex:1, background:G.green+'12', borderColor:G.green+'33', justifyContent:'center', padding:'8px 11px' }}>
              <div style={{ fontSize:9.5, color:C.text2, fontWeight:600 }}>Due Today</div>
              <div style={{ fontSize:20, fontWeight:800, color:G.green }}>{d.followToday}</div>
            </div>
            <div style={{ ...card, flex:1, background:G.red+'12', borderColor:G.red+'33', justifyContent:'center', padding:'8px 11px' }}>
              <div style={{ fontSize:9.5, color:C.text2, fontWeight:600 }}>Overdue</div>
              <div style={{ fontSize:20, fontWeight:800, color:G.red }}>{d.followOverdue}</div>
            </div>
            <div style={{ ...card, flex:1, justifyContent:'center', padding:'7px 10px' }}>
              <div style={{ fontSize:9.5, fontWeight:700, color:G.purple, marginBottom:2 }}>✨ AI Insights</div>
              <div style={{ fontSize:9, color:C.text2, lineHeight:1.4 }}>{d.followOverdue>0?`${d.followOverdue} overdue follow-ups are high priority.`:'Follow-ups on track.'}</div>
            </div>
          </div>
        </div>

        {/* ROW 3 */}
        <div style={{ flex:'1.4', display:'grid', gridTemplateColumns:'1.25fr 1fr 1.3fr 1.25fr 1.3fr 1.45fr', gap:9, minHeight:0 }}>
          <div style={card}>
            <Title>Businesses Growth</Title>
            <div style={{ flex:1, minHeight:0, display:'flex', alignItems:'flex-end' }}><VBars rows={d.months} C={C} h={104}/></div>
          </div>
          <div style={card}>
            <Title>User Demographics</Title>
            <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:C.text3 }}>
              <i className="ti ti-world" style={{ fontSize:26, opacity:0.5 }}/>
              <div style={{ fontSize:11, marginTop:6 }}>{d.hasDemo?'Demographics':'Collecting data…'}</div>
              {!d.hasDemo && <div style={{ fontSize:9, marginTop:2 }}>Data will be available soon.</div>}
            </div>
          </div>
          <div style={card}>
            <Title right={<span style={{ fontSize:9, color:G.green, display:'flex', alignItems:'center', gap:3 }}><span style={{ width:6, height:6, borderRadius:'50%', background:G.green }}/>Live</span>}>Platform Activity</Title>
            <div style={{ flex:1, overflow:'hidden' }}>
              {d.act.map((a,i)=>(<div key={i} style={{ display:'flex', alignItems:'center', gap:7, padding:'3.5px 0' }}><span style={{ width:22, height:22, borderRadius:6, background:a.color+'22', color:a.color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i className={`ti ${a.icon}`} style={{ fontSize:12 }}/></span><span style={{ flex:1, fontSize:10, color:C.text2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{a.text}</span><span style={{ fontSize:9, color:C.text3, flexShrink:0 }}>{timeAgo(a.time)}</span></div>))}
              {d.act.length===0 && <div style={{ color:C.text3, fontSize:11, textAlign:'center', padding:14 }}>No activity</div>}
            </div>
          </div>
          <div style={card}>
            <Title>Top Companies by Leads</Title>
            <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', gap:5 }}>
              {d.topCompanies.length===0 ? <div style={{ color:C.text3, fontSize:11, textAlign:'center' }}>No data</div> :
              d.topCompanies.map((c,i)=>{ const max=d.topCompanies[0].value||1; return (<div key={i} style={{ display:'flex', alignItems:'center', gap:6, fontSize:10 }}><span style={{ color:C.text3, width:10 }}>{i+1}</span><span style={{ width:78, color:C.text2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name}</span><div style={{ flex:1, background:C.track, borderRadius:4, height:6 }}><div style={{ width:`${(c.value/max)*100}%`, height:'100%', background:G.blue, borderRadius:4 }}/></div><span style={{ fontWeight:700, color:C.text, width:26, textAlign:'right' }}>{c.value}</span></div>) })}
            </div>
          </div>
          <div style={card}>
            <Title right={<span style={{ fontSize:9, color:C.text3 }}>30 Days</span>}>Leads Trend</Title>
            <div style={{ flex:1, minHeight:0, display:'flex', alignItems:'center' }}><DualLine series={d.trend} c1={G.purple} c2={G.purple} C={C} h={100}/></div>
          </div>
          <div style={card}>
            <Title>Follow-ups Heatmap</Title>
            <div style={{ flex:1, display:'flex', flexDirection:'column', gap:3, justifyContent:'center' }}>
              <div style={{ display:'grid', gridTemplateColumns:'34px repeat(7,1fr)', gap:3, fontSize:8, color:C.text3, textAlign:'center' }}><span/>{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(x=><span key={x}>{x}</span>)}</div>
              {d.heat.map((row,wi)=>(<div key={wi} style={{ display:'grid', gridTemplateColumns:'34px repeat(7,1fr)', gap:3, alignItems:'center' }}><span style={{ fontSize:8, color:C.text3 }}>W{wi+1}</span>{row.map((c,di)=><span key={di} style={{ height:10, borderRadius:2, background:heatColor(c) }}/>)}</div>))}
              <div style={{ display:'flex', gap:9, justifyContent:'center', marginTop:3, fontSize:8.5, color:C.text3 }}>{[[G.green,'Good'],[G.amber,'Due'],[G.red,'Overdue']].map(([c,l])=><span key={l} style={{ display:'flex', alignItems:'center', gap:3 }}><i style={{ width:8, height:8, borderRadius:2, background:c }}/>{l}</span>)}</div>
            </div>
          </div>
        </div>

        {/* ROW 4 — Plan Revenue + Geographic */}
        <div style={{ flex:'1.05', display:'grid', gridTemplateColumns:'1.5fr 1fr', gap:9, minHeight:0 }}>
          <div style={card}>
            <Title>Plan Revenue (Monthly)</Title>
            <div style={{ flex:1, display:'flex', alignItems:'center', gap:10, minHeight:0 }}>
              <div style={{ flexShrink:0, paddingRight:10, borderRight:`1px solid ${C.border}` }}>
                <div style={{ fontSize:9.5, color:C.text3 }}>Total MRR</div>
                <div style={{ fontSize:24, fontWeight:800, color:C.text }}>{fmtMoney(d.mrr)}</div>
              </div>
              <div style={{ flex:1, display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:7 }}>
                {[['free','Free',G.cyan,'ti-bolt'],['silver','Silver',C.text2,'ti-medal'],['gold','Gold',G.amber,'ti-star'],['platinum','Platinum',G.purple,'ti-diamond']].map(([k,lab,col,ic])=>{ const pct=d.mrr?Math.round(d.planRev[k]/d.mrr*100):0; const hl=k==='gold'; return (
                  <div key={k} style={{ background:hl?G.amber+'14':C.card2, border:`1px solid ${hl?G.amber+'44':C.border}`, borderRadius:9, padding:'7px 8px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:9.5, color:col, fontWeight:700 }}><i className={`ti ${ic}`} style={{ fontSize:11 }}/>{lab}</div>
                    <div style={{ fontSize:15, fontWeight:800, color:C.text, marginTop:3 }}>{fmtMoney(d.planRev[k])}</div>
                    <div style={{ fontSize:8.5, color:C.text3, marginTop:1 }}>{d.planCount[k]} cos · {pct}%</div>
                  </div>
                )})}
              </div>
            </div>
          </div>
          <div style={card}>
            <Title>Geographic Leads (Top Areas)</Title>
            {d.areas.length===0 ? <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:C.text3 }}><i className="ti ti-map-pin" style={{ fontSize:24, opacity:0.5 }}/><div style={{ fontSize:11, marginTop:5 }}>Collecting data…</div></div> :
            <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', gap:5 }}>
              {d.areas.map((a,i)=>{ const max=d.areas[0].value||1; return (<div key={i} style={{ display:'flex', alignItems:'center', gap:6, fontSize:10 }}><span style={{ width:90, color:C.text2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.name}</span><div style={{ flex:1, background:C.track, borderRadius:4, height:6 }}><div style={{ width:`${(a.value/max)*100}%`, height:'100%', background:G.cyan, borderRadius:4 }}/></div><span style={{ fontWeight:700, color:C.text, width:28, textAlign:'right' }}>{a.value}</span></div>) })}
            </div>}
          </div>
        </div>

        {/* ROW 5 — Score / Status / Category / Conversion */}
        <div style={{ flex:'1.35', display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:9, minHeight:0 }}>
          <div style={card}>
            <Title>AI Lead Score</Title>
            <div style={{ flex:1, display:'flex', alignItems:'center', gap:8, minHeight:0 }}>
              <Gauge value={d.avgScore} C={C}/>
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:4 }}>{d.scoreBuckets.map((b,i)=>(<div key={i} style={{ display:'flex', alignItems:'center', gap:5, fontSize:9.5 }}><span style={{ width:7, height:7, borderRadius:'50%', background:b.color, flexShrink:0 }}/><span style={{ flex:1, color:C.text2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{b.label}</span><span style={{ color:C.text, fontWeight:700 }}>{b.value}</span></div>))}</div>
            </div>
          </div>
          <div style={card}>
            <Title>Lead Status</Title>
            <div style={{ flex:1, display:'flex', alignItems:'center', gap:8, minHeight:0 }}>
              <Donut segs={d.statusDonut} total={d.stats.totalLeads} label="Total" size={92} C={C}/>
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:3, minWidth:0 }}>{d.statusDonut.map((s,i)=>(<div key={i} style={{ display:'flex', alignItems:'center', gap:4, fontSize:9.5 }}><span style={{ width:7, height:7, borderRadius:2, background:s.color, flexShrink:0 }}/><span style={{ flex:1, color:C.text2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{s.label}</span><span style={{ color:C.text, fontWeight:700 }}>{s.value}</span></div>))}</div>
            </div>
          </div>
          <div style={card}>
            <Title>Leads by Category</Title>
            <div style={{ flex:1, display:'flex', alignItems:'center', gap:8, minHeight:0 }}>
              <Donut segs={d.cats} total={d.stats.totalLeads} label="Total" size={92} C={C}/>
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:3, minWidth:0 }}>{d.cats.map((s,i)=>{ const sum=d.cats.reduce((a,x)=>a+x.value,0)||1; return (<div key={i} style={{ display:'flex', alignItems:'center', gap:4, fontSize:9.5 }}><span style={{ width:7, height:7, borderRadius:2, background:s.color, flexShrink:0 }}/><span style={{ flex:1, color:C.text2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{s.label}</span><span style={{ color:C.text, fontWeight:700 }}>{Math.round(s.value/sum*100)}%</span></div>) })}</div>
            </div>
          </div>
          <div style={card}>
            <Title>Conversion by Source</Title>
            <div style={{ flex:1, minHeight:0, display:'flex', alignItems:'flex-end' }}><VBars rows={d.convBySrc} C={C} h={104} suffix="%"/></div>
          </div>
        </div>

        {/* ROW 6 — alerts + live feed */}
        <div style={{ flex:'1', display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 2fr', gap:9, minHeight:0 }}>
          {[['ti-clock-pause',G.green,'Pending Reviews',d.pendingReviews,'pending approval'],['ti-building-plus',G.blue,'Pending Businesses',d.pendingBiz,'pending approval'],['ti-flag',G.red,'Reported Reviews',d.reportedReviews,'reported'],['ti-mail-opened',G.purple,'Unread Enquiries',d.unreadEnq,'unread']].map(([ic,col,lab,val,sub],i)=>(
            <div key={i} style={{ ...card, justifyContent:'center', borderColor:col+'33' }}>
              <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                <span style={{ width:34, height:34, borderRadius:9, background:col+'1e', color:col, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i className={`ti ${ic}`} style={{ fontSize:17 }}/></span>
                <div><div style={{ fontSize:20, fontWeight:800, color:C.text, lineHeight:1 }}>{fmtN(val)}</div><div style={{ fontSize:9.5, color:C.text2, marginTop:2 }}>{lab}</div></div>
              </div>
              <div style={{ fontSize:9, color:col, fontWeight:600, marginTop:5 }}>{sub} →</div>
            </div>
          ))}
          <div style={card}>
            <Title right={<span style={{ fontSize:9, color:G.green, display:'flex', alignItems:'center', gap:3 }}><span style={{ width:6, height:6, borderRadius:'50%', background:G.green }}/>Live</span>}>Live Activity Feed</Title>
            <div style={{ flex:1, display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:7, overflow:'hidden' }}>
              {d.liveLeads.length===0 ? <div style={{ color:C.text3, fontSize:11, gridColumn:'1/-1', textAlign:'center', alignSelf:'center' }}>No recent leads</div> :
              d.liveLeads.map((l,i)=>{ const col={'Meta Ads':G.blue,'WhatsApp':G.green,'Form':G.purple,'Manual':G.amber,'Google':G.cyan,'Other':C.text3}[l.src]||C.text3; return (
                <div key={i} style={{ background:C.card2, border:`1px solid ${C.border}`, borderRadius:8, padding:'6px 7px', display:'flex', flexDirection:'column', gap:2, minWidth:0 }}>
                  <span style={{ width:20, height:20, borderRadius:6, background:col+'22', color:col, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i className="ti ti-bolt" style={{ fontSize:11 }}/></span>
                  <div style={{ fontSize:9, fontWeight:700, color:C.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{l.src}</div>
                  <div style={{ fontSize:8.5, color:C.text2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{l.name}</div>
                  <div style={{ fontSize:8, color:C.text3 }}>{timeAgo(l.time)}</div>
                </div>
              )})}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
