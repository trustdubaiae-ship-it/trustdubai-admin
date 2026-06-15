// trustdubai-admin/src/pages/AdminInbox.jsx
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabase'

const CAT_LABEL = {
  support:'Support', document_query:'Document Query', complaint:'Complaint',
  other:'Other', announcement:'Announcement', document:'Document', system:'System',
}
const CAT_COLOR = {
  support:        { bg:'#dbeafe', fg:'#1d4ed8' },
  document_query: { bg:'#fef3c7', fg:'#b45309' },
  complaint:      { bg:'#fee2e2', fg:'#b91c1c' },
  other:          { bg:'#e5e7eb', fg:'#6b7280' },
  announcement:   { bg:'#e0e7ff', fg:'#4338ca' },
  document:       { bg:'#dcfce7', fg:'#15803d' },
  system:         { bg:'#f3e8ff', fg:'#7e22ce' },
}
const STATUS_BADGE = {
  open:     { label:'Open',     bg:'#dbeafe', fg:'#1d4ed8' },
  resolved: { label:'Resolved', bg:'#dcfce7', fg:'#15803d' },
  closed:   { label:'Closed',   bg:'#e5e7eb', fg:'#6b7280' },
}
const STATUS_OPTS = ['open','resolved','closed']

const FILTERS = [
  { key:'all',            label:'All' },
  { key:'unread',         label:'Unread' },
  { key:'open',           label:'Open' },
  { key:'resolved',       label:'Resolved' },
  { key:'closed',         label:'Closed' },
  { key:'support',        label:'Support' },
  { key:'document_query', label:'Document Query' },
  { key:'complaint',      label:'Complaint' },
  { key:'other',          label:'Other' },
]
const STATUS_KEYS = ['open','resolved','closed']
const CAT_KEYS    = ['support','document_query','complaint','other']

const PAGE_SIZE = 50

export default function AdminInbox({ theme, adminData }) {
  const isDark = theme === 'dark'
  const [messages, setMessages] = useState([])
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('unread')   // default: Unread
  const [fromFilter, setFromFilter] = useState('companies') // companies | sent | all
  const [search, setSearch] = useState('')
  const [activeRoot, setActiveRoot] = useState(null)
  const [showCompose, setShowCompose] = useState(false)
  const [limit, setLimit] = useState(PAGE_SIZE)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('inbox_messages')
      .select('*')
      .order('created_at', { ascending:true })
    setMessages(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    supabase.from('companies').select('id,name').order('name')
      .then(({ data }) => setCompanies(data || []))
  }, [])

  const companyName = (id) => companies.find(c => c.id === id)?.name || 'Unknown company'

  // group into threads
  const rootOf = (m) => m.parent_id || m.id
  const threadsMap = {}
  for (const m of messages) {
    const rid = rootOf(m)
    if (!threadsMap[rid]) threadsMap[rid] = []
    threadsMap[rid].push(m)
  }
  let threads = Object.entries(threadsMap).map(([rid, arr]) => {
    const all = arr.slice().sort((a,b) => new Date(a.created_at) - new Date(b.created_at))
    const root = all.find(m => !m.parent_id) || all[0]
    const last = all[all.length - 1]
    const anyUnread = all.some(m => m.direction === 'to_admin' && !m.read_by_admin)
    return { rootId:rid, root, last, all, anyUnread }
  })
  threads.sort((a,b) => new Date(b.last.created_at) - new Date(a.last.created_at))

  // apply filters
  let filtered = threads.filter(t => {
    // from filter
    if (fromFilter === 'companies' && t.root.direction !== 'to_admin') return false
    if (fromFilter === 'sent'      && t.root.direction !== 'to_company') return false
    // status/category/unread filter
    if (filter === 'all') {}
    else if (filter === 'unread') { if (!t.anyUnread) return false }
    else if (STATUS_KEYS.includes(filter)) { if (t.root.status !== filter) return false }
    else if (CAT_KEYS.includes(filter)) { if (t.root.category !== filter) return false }
    // search
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      const hay = (companyName(t.root.company_id) + ' ' + (t.root.subject||'')).toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  const totalFiltered = filtered.length
  const visible = filtered.slice(0, limit)
  const unreadCount = threads.filter(t => t.anyUnread).length

  async function openThread(t) {
    setActiveRoot(t.rootId)
    const toMark = t.all.filter(m => m.direction === 'to_admin' && !m.read_by_admin)
    if (toMark.length > 0) {
      const ids = toMark.map(m => m.id)
      const nowIso = new Date().toISOString()
      await supabase.from('inbox_messages')
        .update({ read_by_admin:true, admin_read_at:nowIso }).in('id', ids)
      setMessages(p => p.map(m => ids.includes(m.id) ? { ...m, read_by_admin:true, admin_read_at:nowIso } : m))
    }
  }

  const openThreadData = activeRoot ? threads.find(t => t.rootId === activeRoot) : null

  // theme tokens
  const card    = isDark ? '#161b22' : '#ffffff'
  const card2   = isDark ? '#0d1117' : '#f8fafc'
  const border  = isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'
  const txt     = isDark ? '#e6edf3' : '#0f172a'
  const txt2    = isDark ? '#9ca3af' : '#64748b'
  const txt3    = isDark ? '#6b7280' : '#94a3b8'
  const BRAND   = '#1d9e75'

  if (loading) return <div style={{ padding:32, color:txt2 }}>Loading inbox…</div>

  return (
    <div style={{ maxWidth:1100, margin:'0 auto' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:700, color:txt }}>
            Inbox / Messages {unreadCount>0 && <span style={{ fontSize:13, color:BRAND }}>({unreadCount} unread)</span>}
          </div>
          <div style={{ fontSize:13, color:txt2 }}>Conversations with all companies</div>
        </div>
        <button onClick={() => setShowCompose(true)}
          style={{ padding:'9px 16px', borderRadius:9, border:'none', color:'#fff', fontWeight:600, fontSize:13, background:BRAND, cursor:'pointer' }}>
          + Compose
        </button>
      </div>

      {/* Filter tabs (single row, wraps) */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:12, marginBottom:8 }}>
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => { setFilter(f.key); setLimit(PAGE_SIZE) }}
            style={{ padding:'5px 12px', borderRadius:99, fontSize:12, fontWeight:600, cursor:'pointer',
              border: filter===f.key ? 'none' : `0.5px solid ${border}`,
              background: filter===f.key ? BRAND : 'transparent',
              color: filter===f.key ? '#fff' : txt2 }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Search + From filter */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14 }}>
        <div style={{ flex:1, minWidth:180, display:'flex', alignItems:'center', gap:6, border:`0.5px solid ${border}`, borderRadius:9, padding:'7px 11px', background:card }}>
          <i className="ti ti-search" style={{ fontSize:15, color:txt3 }}/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search company or subject…"
            style={{ border:'none', outline:'none', background:'transparent', fontSize:12, color:txt, width:'100%' }} />
        </div>
        <select value={fromFilter} onChange={e => { setFromFilter(e.target.value); setLimit(PAGE_SIZE) }}
          style={{ border:`0.5px solid ${border}`, borderRadius:9, padding:'7px 11px', fontSize:12, color:txt, background:card, cursor:'pointer' }}>
          <option value="companies">From: Companies</option>
          <option value="sent">From: Sent by us</option>
          <option value="all">From: All</option>
        </select>
      </div>

      {/* Split view */}
      <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:12, alignItems:'start' }}>

        {/* Thread list */}
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {visible.length === 0 ? (
            <div style={{ background:card2, borderRadius:12, padding:32, textAlign:'center', color:txt3, fontSize:13 }}>
              <i className="ti ti-mail-off" style={{ fontSize:26, display:'block', marginBottom:6 }}/>
              No messages
            </div>
          ) : visible.map(t => {
            const m = t.root
            const sb = STATUS_BADGE[m.status] || STATUS_BADGE.open
            const cc = CAT_COLOR[m.category] || CAT_COLOR.other
            const isActive = t.rootId === activeRoot
            return (
              <div key={t.rootId} onClick={() => openThread(t)}
                style={{ background:card, cursor:'pointer', borderRadius:9, padding:'10px 11px',
                  border: isActive ? `2px solid ${BRAND}` : (t.anyUnread ? `0.5px solid ${BRAND}` : `0.5px solid ${border}`) }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6 }}>
                  <span style={{ fontSize:13, fontWeight:t.anyUnread?700:600, color:txt, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {companyName(m.company_id)}
                  </span>
                  {t.anyUnread && <span style={{ width:7, height:7, borderRadius:'50%', background:BRAND, flexShrink:0 }}/>}
                </div>
                <div style={{ fontSize:12, color:txt, marginTop:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{m.subject}</div>
                <div style={{ fontSize:11, color:txt2, marginTop:5, display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                  {m.category && <span style={{ background:cc.bg, color:cc.fg, padding:'1px 7px', borderRadius:99 }}>{CAT_LABEL[m.category]||m.category}</span>}
                  <span style={{ background:sb.bg, color:sb.fg, padding:'1px 7px', borderRadius:99 }}>{sb.label}</span>
                  <span>{new Date(t.last.created_at).toLocaleDateString('en-GB')}</span>
                </div>
              </div>
            )
          })}

          {totalFiltered > limit && (
            <button onClick={() => setLimit(l => l + PAGE_SIZE)}
              style={{ padding:'8px', borderRadius:9, border:`0.5px dashed ${border}`, background:'transparent', color:txt2, fontSize:12, cursor:'pointer' }}>
              Load more ({totalFiltered - limit} more)
            </button>
          )}
        </div>

        {/* Conversation pane */}
        <div style={{ background:card, border:`0.5px solid ${border}`, borderRadius:12, padding:14, minHeight:360 }}>
          {!openThreadData ? (
            <div style={{ height:360, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:txt3 }}>
              <i className="ti ti-mail-opened" style={{ fontSize:30, marginBottom:8 }}/>
              <div style={{ fontSize:13 }}>Select a conversation to view</div>
            </div>
          ) : (
            <ConversationPane thread={openThreadData} companyName={companyName} adminData={adminData}
              isDark={isDark} card2={card2} border={border} txt={txt} txt2={txt2} txt3={txt3} BRAND={BRAND}
              onChanged={load} />
          )}
        </div>
      </div>

      {showCompose && (
        <ComposeModal companies={companies} adminData={adminData} isDark={isDark}
          card={card} card2={card2} border={border} txt={txt} txt2={txt2} BRAND={BRAND}
          onClose={() => setShowCompose(false)} onSent={() => { setShowCompose(false); load() }} />
      )}
    </div>
  )
}

/* ---------- Conversation pane ---------- */
function ConversationPane({ thread, companyName, adminData, isDark, card2, border, txt, txt2, txt3, BRAND, onChanged }) {
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')
  const [status, setStatus] = useState(thread.root.status || 'open')
  const root = thread.root

  useEffect(() => { setStatus(thread.root.status || 'open') }, [thread.rootId])

  async function sendReply() {
    setErr('')
    if (!reply.trim()) { setErr('Reply cannot be empty.'); return }
    setSending(true)
    const subject = root.subject?.startsWith('Re: ') ? root.subject : `Re: ${root.subject}`
    const { error } = await supabase.from('inbox_messages').insert({
      company_id: root.company_id,
      direction: 'to_company',
      sender_type: 'admin',
      category: root.category || 'support',
      subject,
      body: reply.trim(),
      parent_id: thread.rootId,
      status,
    })
    setSending(false)
    if (error) { setErr(error.message); return }
    setReply('')
    onChanged()
  }

  async function changeStatus(newStatus) {
    setStatus(newStatus)
    // update all messages in this thread to the new status
    const ids = thread.all.map(m => m.id)
    await supabase.from('inbox_messages').update({ status:newStatus }).in('id', ids)
    onChanged()
  }

  return (
    <div style={{ display:'flex', flexDirection:'column' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8, borderBottom:`0.5px solid ${border}`, paddingBottom:10 }}>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:700, color:txt }}>{companyName(root.company_id)}</div>
          <div style={{ fontSize:12, color:txt2 }}>{root.subject}{root.category ? ` · ${root.category}` : ''}</div>
        </div>
        <select value={status} onChange={e => changeStatus(e.target.value)}
          style={{ border:`0.5px solid ${border}`, borderRadius:8, padding:'5px 9px', fontSize:12, color:txt, background:card2, cursor:'pointer', flexShrink:0, textTransform:'capitalize' }}>
          {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:9, padding:'12px 2px', maxHeight:360, overflowY:'auto' }}>
        {thread.all.map(m => {
          const fromCompany = m.direction === 'to_admin'
          return (
            <div key={m.id} style={{
              alignSelf: fromCompany ? 'flex-start' : 'flex-end', maxWidth:'82%',
              background: fromCompany ? card2 : 'rgba(29,158,117,0.12)',
              border:`0.5px solid ${border}`, borderRadius:10, padding:'8px 11px' }}>
              <div style={{ fontSize:11, fontWeight:700, color: fromCompany ? txt2 : BRAND, marginBottom:3 }}>
                {fromCompany ? companyName(m.company_id) : (m.sender_type==='system' ? 'System' : 'Quvera')}
              </div>
              {m.body && <div style={{ fontSize:13, color:txt, whiteSpace:'pre-wrap' }}>{m.body}</div>}
              <div style={{ fontSize:10, color:txt3, marginTop:4 }}>{new Date(m.created_at).toLocaleString('en-GB')}</div>
            </div>
          )
        })}
      </div>

      <div style={{ borderTop:`0.5px solid ${border}`, paddingTop:10 }}>
        <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
          <textarea value={reply} onChange={e => setReply(e.target.value)} rows={2}
            placeholder="Type a reply to this company…"
            style={{ flex:1, border:`0.5px solid ${border}`, borderRadius:9, padding:'8px 10px', fontSize:13, color:txt, background:card2, outline:'none', resize:'vertical', boxSizing:'border-box' }} />
          <button onClick={sendReply} disabled={sending}
            style={{ padding:'9px 16px', borderRadius:9, border:'none', color:'#fff', fontWeight:600, fontSize:13, background:BRAND, cursor:'pointer', opacity:sending?0.5:1, flexShrink:0 }}>
            {sending ? '…' : 'Send'}
          </button>
        </div>
        {err && <p style={{ fontSize:12, color:'#f87171', margin:'8px 0 0' }}>{err}</p>}
      </div>
    </div>
  )
}

/* ---------- Compose to company / all ---------- */
function ComposeModal({ companies, adminData, isDark, card, card2, border, txt, txt2, BRAND, onClose, onSent }) {
  const [target, setTarget] = useState('')   // '' = none, 'ALL' = all, else company id
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')

  async function send() {
    setErr('')
    if (!target) { setErr('Please select a company.'); return }
    if (!subject.trim()) { setErr('Subject is required.'); return }
    setSending(true)

    const base = {
      direction: 'to_company',
      sender_type: 'admin',
      category: 'announcement',
      subject: subject.trim(),
      body: body.trim() || null,
      parent_id: null,
      status: 'open',
    }

    let rows
    if (target === 'ALL') {
      rows = companies.map(c => ({ ...base, company_id: c.id }))
    } else {
      rows = [{ ...base, company_id: target }]
    }

    const { error } = await supabase.from('inbox_messages').insert(rows)
    setSending(false)
    if (error) { setErr(error.message); return }
    onSent()
  }

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:60, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:card, borderRadius:16, width:'100%', maxWidth:460, padding:20, border:`0.5px solid ${border}` }}>
        <h4 style={{ fontWeight:700, color:txt, marginTop:0, marginBottom:16 }}>Send Message to Company</h4>

        <label style={{ fontSize:12, color:txt2, display:'block' }}>To</label>
        <select value={target} onChange={e => setTarget(e.target.value)}
          style={{ width:'100%', marginTop:4, marginBottom:14, border:`0.5px solid ${border}`, borderRadius:9, padding:'9px 12px', fontSize:13, color:txt, background:card2, boxSizing:'border-box' }}>
          <option value="">Select company…</option>
          <option value="ALL">📢 All Companies</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <label style={{ fontSize:12, color:txt2, display:'block' }}>Subject</label>
        <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject"
          style={{ width:'100%', marginTop:4, marginBottom:14, border:`0.5px solid ${border}`, borderRadius:9, padding:'9px 12px', fontSize:13, color:txt, background:card2, boxSizing:'border-box' }} />

        <label style={{ fontSize:12, color:txt2, display:'block' }}>Message</label>
        <textarea value={body} onChange={e => setBody(e.target.value)} rows={4} placeholder="Write your message…"
          style={{ width:'100%', marginTop:4, marginBottom:14, border:`0.5px solid ${border}`, borderRadius:9, padding:'9px 12px', fontSize:13, color:txt, background:card2, boxSizing:'border-box', resize:'vertical' }} />

        {err && <p style={{ fontSize:12, color:'#f87171', marginBottom:12 }}>{err}</p>}

        <button onClick={send} disabled={sending}
          style={{ width:'100%', padding:'11px', borderRadius:9, border:'none', color:'#fff', fontWeight:600, background:BRAND, cursor:'pointer', opacity:sending?0.5:1 }}>
          {sending ? 'Sending…' : (target === 'ALL' ? 'Send to All Companies' : 'Send Message')}
        </button>
      </div>
    </div>
  )
}
