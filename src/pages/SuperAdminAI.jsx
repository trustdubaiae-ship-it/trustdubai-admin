import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

const AED = (n) => 'AED ' + Math.round(Number(n) || 0).toLocaleString('en-AE')
const QUICK = [
  { icon: 'ti-sunrise', label: "Today's briefing", prompt: "Give me today's full platform briefing — health summary, key numbers, what needs my attention, and prioritized action items." },
  { icon: 'ti-cash', label: 'Revenue & accounts', prompt: 'Analyze our revenue and accounts — MRR/ARR, paying vs free companies, plan mix, and how to grow revenue this month.' },
  { icon: 'ti-alert-triangle', label: 'Needs attention', prompt: 'What needs my attention right now? Pending approvals, reviews to moderate, partner payouts, and any risks.' },
  { icon: 'ti-trending-up', label: 'Growth ideas', prompt: 'Give me 5 concrete growth ideas for Quvera based on our current numbers — leads, companies, partners.' },
  { icon: 'ti-brand-instagram', label: 'Social post', prompt: 'Write 3 ready-to-post social media captions (Instagram + LinkedIn) to promote Quvera to Dubai businesses, with hashtags.' },
  { icon: 'ti-report-analytics', label: 'Weekly analysis', prompt: 'Compare this week vs last — leads, new companies, reviews. What is trending up or down and why might that be?' },
]
const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.floor(Math.random() * 1e6))
const makeTitle = (s) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t ? (t.length > 40 ? t.slice(0, 40) + '…' : t) : 'New chat' }
const CACHE = 'qv_admin_ai_threads'

export default function SuperAdminAI({ theme }) {
  const dark = theme !== 'light'
  const [email, setEmail] = useState(null)
  const [threads, setThreads] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [msgs, setMsgs] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [snap, setSnap] = useState(null)
  const [vw, setVw] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)
  const [pane, setPane] = useState('chat')   // mobile: 'list' | 'chat'
  const mobile = vw < 860
  const endRef = useRef(null)

  useEffect(() => { const r = () => setVw(window.innerWidth); window.addEventListener('resize', r); return () => window.removeEventListener('resize', r) }, [])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, busy])

  useEffect(() => {
    try { const a = JSON.parse(localStorage.getItem(CACHE) || '[]'); if (Array.isArray(a)) setThreads(a) } catch { /* ignore */ }
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setEmail(user.email)
      const { data } = await supabase.from('admin_ai_threads').select('threads').eq('email', user.email).maybeSingle()
      if (data?.threads && Array.isArray(data.threads)) setThreads(data.threads)
    })()
  }, [])

  function persist(list) {
    const capped = list.slice(0, 60)
    try { localStorage.setItem(CACHE, JSON.stringify(capped)) } catch { /* ignore */ }
    if (email) supabase.from('admin_ai_threads').upsert({ email, threads: capped, updated_at: new Date().toISOString() }, { onConflict: 'email' }).then(() => {}, () => {})
  }
  function saveThread(id, list, maybeTitle) {
    const stored = list.slice(-50)
    setThreads(prev => {
      const exists = prev.some(t => t.id === id)
      let nx = exists
        ? prev.map(t => t.id === id ? { ...t, msgs: stored, updatedAt: Date.now() } : t)
        : [{ id, title: maybeTitle || makeTitle(stored.find(m => m.role === 'user')?.text), msgs: stored, updatedAt: Date.now() }, ...prev]
      nx = [...nx].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      persist(nx); return nx
    })
  }
  function newChat() { setActiveId(null); setMsgs([]); setInput(''); setPane('chat') }
  function selectThread(t) { setActiveId(t.id); setMsgs(t.msgs || []); setInput(''); setPane('chat') }
  function deleteThread(e, t) {
    e.stopPropagation()
    if (!window.confirm('Delete this chat?')) return
    const nx = threads.filter(x => x.id !== t.id); setThreads(nx); persist(nx)
    if (activeId === t.id) newChat()
  }

  async function send(text) {
    const q = (text ?? input).trim()
    if (!q || busy) return
    const next = [...msgs, { role: 'user', text: q }]
    setMsgs(next); setInput(''); setBusy(true)
    let id = activeId, title = ''
    if (!id) { id = newId(); title = makeTitle(q); setActiveId(id) }
    try {
      const { data, error } = await supabase.functions.invoke('admin-ai', { body: { messages: next.map(m => ({ role: m.role, text: m.text })) } })
      let withReply
      if (error) {
        let m = 'Could not reach the AI — deploy the "admin-ai" function.'
        try { m = (await error.context.json())?.error || m } catch { m = error.message || m }
        withReply = [...next, { role: 'assistant', text: '⚠️ ' + m }]
      } else if (data?.reply) {
        if (data.snapshot && !data.snapshot.error) setSnap(data.snapshot)
        withReply = [...next, { role: 'assistant', text: data.reply }]
      } else withReply = [...next, { role: 'assistant', text: '⚠️ ' + (data?.error || 'No response') }]
      setMsgs(withReply); saveThread(id, withReply, title)
    } catch (e) {
      const wr = [...next, { role: 'assistant', text: '⚠️ ' + (e?.message || e) }]
      setMsgs(wr); saveThread(id, wr, title)
    } finally { setBusy(false) }
  }

  const bg = dark ? '#0f172a' : '#f8fafc'
  const cardBg = dark ? '#1e293b' : '#fff'
  const text = dark ? '#e2e8f0' : '#0f172a'
  const sub = dark ? '#94a3b8' : '#64748b'
  const border = dark ? '#334155' : '#e2e8f0'
  const sunk = dark ? '#0f172a' : '#f1f5f9'

  const threadList = (
    <div style={{ width: mobile ? '100%' : 270, flexShrink: 0, background: cardBg, border: `1px solid ${border}`, borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: 10, borderBottom: `1px solid ${border}` }}>
        <button onClick={newChat} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px', borderRadius: 10, background: 'linear-gradient(135deg,#00D4FF,#8B5CF6)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}><i className="ti ti-plus" style={{ fontSize: 16 }} /> New chat</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px 10px' }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, color: sub, textTransform: 'uppercase', letterSpacing: '.5px', padding: '6px 8px' }}>History</div>
        {threads.length === 0 && <div style={{ fontSize: 12, color: sub, padding: '6px 8px' }}>No chats yet. Start a new one.</div>}
        {threads.map(t => {
          const on = activeId === t.id
          return (
            <button key={t.id} onClick={() => selectThread(t)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 9, border: 'none', background: on ? (dark ? 'rgba(0,212,255,0.14)' : '#e0f9ff') : 'transparent', cursor: 'pointer', textAlign: 'left', marginBottom: 2 }}>
              <i className="ti ti-message-2" style={{ fontSize: 15, color: on ? '#00b4d8' : sub, flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: on ? 700 : 500, color: text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</span>
              <i className="ti ti-x" onClick={(e) => deleteThread(e, t)} style={{ fontSize: 13, color: sub, flexShrink: 0, opacity: 0.7 }} />
            </button>
          )
        })}
      </div>
    </div>
  )

  const chatPane = (
    <div style={{ flex: 1, minWidth: 0, background: cardBg, border: `1px solid ${border}`, borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${border}` }}>
        {mobile && <button onClick={() => setPane('list')} style={{ background: sunk, border: 'none', width: 32, height: 32, borderRadius: 9, cursor: 'pointer', color: sub }}><i className="ti ti-arrow-left" /></button>}
        <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#00D4FF,#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}><i className="ti ti-brain" style={{ fontSize: 18 }} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: text }}>Quvera AI Manager</div>
          <div style={{ fontSize: 11, color: sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Your AI chief-of-staff · analyzes the whole platform</div>
        </div>
      </div>

      {snap && msgs.length > 0 && (
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', padding: '10px 14px', borderBottom: `1px solid ${border}` }}>
          {[['Companies', snap.companies?.approved ?? '—', '#0099cc'], ['MRR', AED(snap.revenue?.estimated_MRR || 0), '#22c55e'], ['Leads 7d', snap.leads?.last_7_days ?? '—', '#8B5CF6'], ['To review', snap.pending_actions?.applications_to_review ?? '—', '#f59e0b']].map(([l, v, c]) => (
            <div key={l} style={{ background: sunk, border: `1px solid ${border}`, borderRadius: 9, padding: '6px 11px' }}>
              <div style={{ fontSize: 9, color: sub, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.3px' }}>{l}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: c }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {msgs.length === 0 ? (
          <div style={{ margin: 'auto', maxWidth: 520, textAlign: 'center', padding: '10px 0' }}>
            <div style={{ width: 54, height: 54, borderRadius: 15, background: 'linear-gradient(135deg,#00D4FF,#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', margin: '0 auto 12px' }}><i className="ti ti-brain" style={{ fontSize: 26 }} /></div>
            <div style={{ fontSize: 15, fontWeight: 700, color: text }}>How can I help you run Quvera today?</div>
            <div style={{ fontSize: 12.5, color: sub, marginTop: 4, marginBottom: 16 }}>Ask anything, or start with one of these:</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 8 }}>
              {QUICK.map(q => (
                <button key={q.label} onClick={() => send(q.prompt)} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, padding: '11px 13px', borderRadius: 10, border: `1px solid ${border}`, background: sunk, color: text, cursor: busy ? 'default' : 'pointer', textAlign: 'left' }}>
                  <i className={'ti ' + q.icon} style={{ color: '#00b4d8', fontSize: 16 }} /> {q.label}
                </button>
              ))}
            </div>
          </div>
        ) : msgs.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%' }}>
            <div style={{ fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', padding: '11px 14px', borderRadius: m.role === 'user' ? '13px 13px 4px 13px' : '13px 13px 13px 4px', background: m.role === 'user' ? '#0099cc' : sunk, color: m.role === 'user' ? '#fff' : text, border: m.role === 'user' ? 'none' : `1px solid ${border}` }}>{m.text}</div>
          </div>
        ))}
        {busy && <div style={{ alignSelf: 'flex-start', fontSize: 12.5, color: sub, padding: '6px 12px' }}><i className="ti ti-loader-2" style={{ animation: 'spin 1s linear infinite' }} /> Analyzing the platform…<style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>}
        <div ref={endRef} />
      </div>

      <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: `1px solid ${border}` }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Ask anything — revenue, leads, growth, a social post…" disabled={busy}
          style={{ flex: 1, minWidth: 0, padding: '11px 14px', borderRadius: 10, border: `1px solid ${border}`, background: dark ? '#0f172a' : '#fff', color: text, fontSize: 13.5, outline: 'none' }} />
        <button onClick={() => send()} disabled={busy || !input.trim()} style={{ padding: '0 18px', borderRadius: 10, background: '#0099cc', color: '#fff', border: 'none', cursor: (busy || !input.trim()) ? 'default' : 'pointer', fontSize: 16, fontWeight: 700, opacity: (busy || !input.trim()) ? 0.6 : 1 }}><i className="ti ti-send" /></button>
      </div>
    </div>
  )

  return (
    <div style={{ padding: 'clamp(14px,3vw,28px)', background: bg, minHeight: '100vh', color: text }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 800, margin: 0 }}><i className="ti ti-brain" style={{ verticalAlign: '-3px', marginRight: 6, color: '#00b4d8' }} />AI Manager</h1>
          <div style={{ fontSize: 12.5, color: sub, marginTop: 2 }}>Chats are saved — pick up where you left off.</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 14, height: 'calc(100dvh - 130px)', minHeight: 440 }}>
        {(!mobile || pane === 'list') && threadList}
        {(!mobile || pane === 'chat') && chatPane}
      </div>
    </div>
  )
}
