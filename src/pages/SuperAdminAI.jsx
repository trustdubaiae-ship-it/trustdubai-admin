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

export default function SuperAdminAI({ theme }) {
  const dark = theme !== 'light'
  const [msgs, setMsgs] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [snap, setSnap] = useState(null)
  const endRef = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, busy])
  useEffect(() => { send(QUICK[0].prompt) }, []) // eslint-disable-line

  async function send(text) {
    const q = (text ?? input).trim()
    if (!q || busy) return
    const next = [...msgs, { role: 'user', text: q }]
    setMsgs(next); setInput(''); setBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke('admin-ai', { body: { messages: next.map(m => ({ role: m.role, text: m.text })) } })
      if (error) {
        let m = 'Could not reach the AI — deploy the "admin-ai" function.'
        try { m = (await error.context.json())?.error || m } catch { m = error.message || m }
        setMsgs([...next, { role: 'assistant', text: '⚠️ ' + m }])
      } else if (data?.reply) {
        if (data.snapshot && !data.snapshot.error) setSnap(data.snapshot)
        setMsgs([...next, { role: 'assistant', text: data.reply }])
      } else {
        setMsgs([...next, { role: 'assistant', text: '⚠️ ' + (data?.error || 'No response') }])
      }
    } catch (e) {
      setMsgs([...next, { role: 'assistant', text: '⚠️ ' + (e?.message || e) }])
    } finally { setBusy(false) }
  }

  const bg = dark ? '#0f172a' : '#f8fafc'
  const cardBg = dark ? '#1e293b' : '#fff'
  const text = dark ? '#e2e8f0' : '#0f172a'
  const sub = dark ? '#94a3b8' : '#64748b'
  const border = dark ? '#334155' : '#e2e8f0'

  const stat = (label, value, color) => (
    <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 11, padding: '11px 13px', flex: '1 1 120px', minWidth: 0 }}>
      <div style={{ fontSize: 10.5, color: sub, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 800, color, marginTop: 3, letterSpacing: '-.4px' }}>{value}</div>
    </div>
  )

  return (
    <div style={{ padding: 'clamp(14px,3vw,28px)', background: bg, minHeight: '100vh', color: text }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ width: 46, height: 46, borderRadius: 13, background: 'linear-gradient(135deg,#00D4FF,#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}><i className="ti ti-brain" style={{ fontSize: 24 }} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 21, fontWeight: 800, margin: 0 }}>Quvera AI Manager</h1>
          <div style={{ fontSize: 12.5, color: sub }}>Your AI chief-of-staff — analyzes the whole platform, accounts, growth & content</div>
        </div>
      </div>

      {snap && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          {stat('Companies', snap.companies?.approved ?? '—', '#0099cc')}
          {stat('Paying (MRR)', AED(snap.revenue?.estimated_MRR || 0), '#22c55e')}
          {stat('Leads (7d)', snap.leads?.last_7_days ?? '—', '#8B5CF6')}
          {stat('To review', snap.pending_actions?.applications_to_review ?? '—', '#f59e0b')}
          {stat('Avg rating', snap.reviews?.avg_rating ?? '—', '#eab308')}
        </div>
      )}

      {/* quick actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {QUICK.map(q => (
          <button key={q.label} onClick={() => send(q.prompt)} disabled={busy}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '8px 13px', borderRadius: 9, border: `1px solid ${border}`, background: cardBg, color: text, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
            <i className={'ti ' + q.icon} style={{ color: '#00b4d8' }} /> {q.label}
          </button>
        ))}
      </div>

      {/* chat */}
      <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 14, display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 320px)', minHeight: 360, overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {msgs.map((m, i) => (
            <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%' }}>
              <div style={{ fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', padding: '11px 14px', borderRadius: m.role === 'user' ? '13px 13px 4px 13px' : '13px 13px 13px 4px', background: m.role === 'user' ? '#0099cc' : (dark ? '#0f172a' : '#f1f5f9'), color: m.role === 'user' ? '#fff' : text, border: m.role === 'user' ? 'none' : `1px solid ${border}` }}>{m.text}</div>
            </div>
          ))}
          {busy && <div style={{ alignSelf: 'flex-start', fontSize: 12.5, color: sub, padding: '6px 12px' }}><i className="ti ti-loader-2" style={{ animation: 'spin 1s linear infinite' }} /> Analyzing the platform…<style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>}
          <div ref={endRef} />
        </div>
        <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: `1px solid ${border}` }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Ask anything about the business — revenue, leads, growth, a social post…" disabled={busy}
            style={{ flex: 1, minWidth: 0, padding: '11px 14px', borderRadius: 10, border: `1px solid ${border}`, background: dark ? '#0f172a' : '#fff', color: text, fontSize: 13.5, outline: 'none' }} />
          <button onClick={() => send()} disabled={busy || !input.trim()} style={{ padding: '0 18px', borderRadius: 10, background: '#0099cc', color: '#fff', border: 'none', cursor: (busy || !input.trim()) ? 'default' : 'pointer', fontSize: 16, fontWeight: 700, opacity: (busy || !input.trim()) ? 0.6 : 1 }}><i className="ti ti-send" /></button>
        </div>
      </div>

      <div style={{ fontSize: 11, color: sub, marginTop: 12, lineHeight: 1.5 }}>The AI analyzes live platform data and recommends actions — it does not change anything on its own. You stay in control.</div>
    </div>
  )
}
