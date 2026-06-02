import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const QTYPE = [
  { value: 'text',     label: 'Short text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'number',   label: 'Number' },
]

// suggested fields — quick add (options as plain arrays; category auto-filled from DB at render time on public site)
const SUGGESTED = [
  { key: 'service_category', question: 'Service category', type: 'dropdown', icon: 'ti-category', fromCategories: true, options: [] },
  { key: 'area',             question: 'Area / Location',  type: 'dropdown', icon: 'ti-map-pin', options: ['Downtown','Business Bay','Marina','JBR','Palm Jumeirah','DIFC','Jumeirah','Deira','Other'] },
  { key: 'budget',           question: 'Budget range',     type: 'dropdown', icon: 'ti-coin', options: ['Under AED 50,000','AED 50,000 – 150,000','AED 150,000 – 500,000','Above AED 500,000'] },
  { key: 'description',      question: 'Project description', type: 'textarea', icon: 'ti-file-text', options: [] },
  { key: 'timeline',         question: 'Timeline / urgency', type: 'dropdown', icon: 'ti-clock', options: ['Immediately','Within 1 month','1–3 months','Just exploring'] },
  { key: 'property_type',    question: 'Property type',    type: 'dropdown', icon: 'ti-home', options: ['Apartment','Villa','Office','Retail','Other'] },
]

export default function LeadForms({ theme }) {
  const isDark = theme === 'dark'
  const [forms, setForms] = useState([])
  const [questions, setQuestions] = useState({})   // form_id -> [questions]
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState(null)       // null = list view, else builder
  const [busy, setBusy] = useState(false)

  const text    = isDark ? '#f1f5f9' : '#111827'
  const textSub = isDark ? '#94a3b8' : '#6b7280'
  const cardBg  = isDark ? '#161b22' : '#ffffff'
  const listBg  = isDark ? '#0f1419' : '#f8fafc'
  const border  = isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'
  const fieldBg = isDark ? '#0d1117' : '#f8fafc'
  const BRAND = '#0099cc'
  const GREEN = '#22c55e'

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: f } = await supabase.from('lead_forms').select('*').eq('is_platform', true).order('created_at', { ascending: true })
    setForms(f || [])
    const ids = (f || []).map(x => x.id)
    if (ids.length) {
      const { data: q } = await supabase.from('lead_form_questions').select('*').in('form_id', ids).order('order_num', { ascending: true })
      const map = {}
      ;(q || []).forEach(row => { (map[row.form_id] = map[row.form_id] || []).push(row) })
      setQuestions(map)
    } else {
      setQuestions({})
    }
    setLoading(false)
  }

  async function createForm() {
    setBusy(true)
    const { data, error } = await supabase.from('lead_forms').insert({
      title: 'New Lead Form', is_platform: true, is_active: false, company_id: null,
    }).select().single()
    setBusy(false)
    if (error) { alert('Failed: ' + error.message); return }
    await load()
    setEditId(data.id)
  }

  async function activateForm(id) {
    setBusy(true)
    const { error } = await supabase.rpc('fn_activate_lead_form', { target: id })
    setBusy(false)
    if (error) { alert('Failed: ' + error.message); return }
    load()
  }

  async function deleteForm(id) {
    if (!confirm('Delete this form and all its questions?')) return
    await supabase.from('lead_forms').delete().eq('id', id)
    if (editId === id) setEditId(null)
    load()
  }

  async function saveTitle(id, title) {
    await supabase.from('lead_forms').update({ title }).eq('id', id)
    setForms(prev => prev.map(f => f.id === id ? { ...f, title } : f))
  }

  async function addQuestion(formId, q) {
    const existing = questions[formId] || []
    const order = existing.length
    const { error } = await supabase.from('lead_form_questions').insert({
      form_id: formId,
      question: q.question,
      type: q.type,
      options: q.options && q.options.length ? q.options : null,
      required: q.required ?? false,
      order_num: order,
    })
    if (error) { alert('Failed: ' + error.message); return }
    load()
  }

  async function deleteQuestion(qid) {
    await supabase.from('lead_form_questions').delete().eq('id', qid)
    load()
  }

  async function toggleRequired(qid, cur) {
    await supabase.from('lead_form_questions').update({ required: !cur }).eq('id', qid)
    load()
  }

  async function moveQuestion(formId, idx, dir) {
    const list = [...(questions[formId] || [])]
    const j = idx + dir
    if (j < 0 || j >= list.length) return
    ;[list[idx], list[j]] = [list[j], list[idx]]
    // rewrite order_num
    for (let k = 0; k < list.length; k++) {
      await supabase.from('lead_form_questions').update({ order_num: k }).eq('id', list[k].id)
    }
    load()
  }

  function convPct(f) {
    if (!f.view_count || f.view_count === 0) return 0
    return Math.round((f.submit_count || 0) / f.view_count * 100)
  }

  if (loading) return (
    <div style={{ textAlign:'center', padding:60, color:textSub }}>
      <div style={{ width:36, height:36, border:`3px solid ${GREEN}`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 12px' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      Loading lead forms...
    </div>
  )

  // ---------- BUILDER VIEW ----------
  if (editId) {
    const form = forms.find(f => f.id === editId)
    if (!form) { setEditId(null); return null }
    const qs = questions[editId] || []
    const usedQuestions = qs.map(q => q.question.toLowerCase())

    return (
      <div style={{ maxWidth:1000 }}>
        <button onClick={() => setEditId(null)}
          style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', color:BRAND, fontSize:13, fontWeight:600, cursor:'pointer', marginBottom:14, padding:0 }}>
          <i className="ti ti-arrow-left" /> Back to forms
        </button>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:16 }}>

          {/* Left — form + questions */}
          <div style={{ background:cardBg, border:`1px solid ${border}`, borderRadius:14, padding:18 }}>
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:11, color:textSub, marginBottom:4 }}>Form title</div>
              <input value={form.title} onChange={e => saveTitle(form.id, e.target.value)}
                style={{ width:'100%', padding:'9px 12px', border:`1px solid ${border}`, borderRadius:8, fontSize:14, fontWeight:600, background:fieldBg, color:text, outline:'none', boxSizing:'border-box' }} />
            </div>

            <div style={{ fontSize:11, color:textSub, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:8 }}>Questions</div>

            {qs.length === 0 && <div style={{ padding:20, textAlign:'center', color:textSub, fontSize:13, border:`1px dashed ${border}`, borderRadius:10, marginBottom:10 }}>No questions yet. Add from the suggested list or create custom.</div>}

            {qs.map((q, i) => (
              <div key={q.id} style={{ border:`1px solid ${border}`, borderRadius:10, padding:'11px 13px', marginBottom:8, display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                  <button onClick={() => moveQuestion(editId, i, -1)} disabled={i===0} style={{ background:'none', border:'none', cursor: i===0?'default':'pointer', color: i===0?border:textSub, padding:0, fontSize:12 }}><i className="ti ti-chevron-up" /></button>
                  <button onClick={() => moveQuestion(editId, i, 1)} disabled={i===qs.length-1} style={{ background:'none', border:'none', cursor: i===qs.length-1?'default':'pointer', color: i===qs.length-1?border:textSub, padding:0, fontSize:12 }}><i className="ti ti-chevron-down" /></button>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:text }}>{q.question}</div>
                  <div style={{ fontSize:11, color:textSub }}>
                    {QTYPE.find(t => t.value === q.type)?.label || q.type}
                    {q.options && Array.isArray(q.options) && q.options.length ? ` · ${q.options.length} options` : ''}
                    {q.required ? ' · required' : ''}
                  </div>
                </div>
                <button onClick={() => toggleRequired(q.id, q.required)}
                  style={{ fontSize:11, padding:'3px 9px', borderRadius:12, border:`1px solid ${border}`, cursor:'pointer',
                    background: q.required ? 'rgba(34,197,94,0.12)' : 'transparent', color: q.required ? GREEN : textSub }}>
                  {q.required ? 'Required' : 'Optional'}
                </button>
                <button onClick={() => deleteQuestion(q.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#ef4444', fontSize:15 }}><i className="ti ti-trash" /></button>
              </div>
            ))}

            <CustomQuestionAdder onAdd={(q) => addQuestion(editId, q)} border={border} text={text} textSub={textSub} fieldBg={fieldBg} BRAND={BRAND} />
          </div>

          {/* Right — quick add + analytics */}
          <div>
            <div style={{ background:cardBg, border:`1px solid ${border}`, borderRadius:14, padding:16, marginBottom:12 }}>
              <div style={{ fontSize:11, color:textSub, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:10 }}>Quick add fields</div>
              {SUGGESTED.map(s => {
                const added = usedQuestions.includes(s.question.toLowerCase())
                return (
                  <div key={s.key} onClick={() => { if (!added) addQuestion(editId, { question:s.question, type:s.type, options:s.options, required: s.key==='service_category' }) }}
                    style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 11px', border:`1px solid ${border}`, borderRadius:8, marginBottom:7, cursor: added?'default':'pointer', opacity: added?0.55:1 }}>
                    <i className={`ti ${s.icon}`} style={{ fontSize:16, color: added?textSub:BRAND }} />
                    <span style={{ fontSize:12, color:text, flex:1 }}>{s.question}</span>
                    <i className={`ti ${added ? 'ti-check' : 'ti-plus'}`} style={{ fontSize:15, color: added?GREEN:BRAND }} />
                  </div>
                )
              })}
              <div style={{ marginTop:8, padding:10, background:'rgba(0,153,204,0.08)', borderRadius:8, fontSize:11, color:BRAND, lineHeight:1.5 }}>
                Name &amp; phone are captured from the user account automatically — no need to add.
              </div>
            </div>

            {/* Analytics */}
            <div style={{ background:cardBg, border:`1px solid ${border}`, borderRadius:14, padding:16 }}>
              <div style={{ fontSize:11, color:textSub, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:10 }}>This form's performance</div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                <span style={{ fontSize:12, color:textSub }}>Views</span>
                <span style={{ fontSize:14, fontWeight:700, color:text }}>{form.view_count || 0}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                <span style={{ fontSize:12, color:textSub }}>Submissions</span>
                <span style={{ fontSize:14, fontWeight:700, color:text }}>{form.submit_count || 0}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontSize:12, color:textSub }}>Conversion</span>
                <span style={{ fontSize:14, fontWeight:700, color: convPct(form) >= 40 ? GREEN : convPct(form) >= 15 ? '#f59e0b' : textSub }}>{convPct(form)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ---------- LIST VIEW ----------
  return (
    <div style={{ maxWidth:1000 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:18 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:text, marginBottom:4 }}>Lead Forms</h1>
          <p style={{ color:textSub, fontSize:14 }}>Build multiple forms, activate the one users should fill.</p>
        </div>
        <button onClick={createForm} disabled={busy}
          style={{ padding:'8px 16px', background:GREEN, color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>
          + Create new form
        </button>
      </div>

      {forms.length === 0 ? (
        <div style={{ background:cardBg, border:`1px solid ${border}`, borderRadius:14, padding:50, textAlign:'center', color:textSub }}>
          No lead forms yet. Click "Create new form" to start.
        </div>
      ) : (
        <div style={{ background:cardBg, border:`1px solid ${border}`, borderRadius:14, overflow:'hidden' }}>
          {forms.map((f, i) => {
            const qCount = (questions[f.id] || []).length
            return (
              <div key={f.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 16px', borderBottom: i < forms.length-1 ? `1px solid ${border}` : 'none',
                borderLeft: f.is_active ? `3px solid ${GREEN}` : '3px solid transparent', background: f.is_active ? 'rgba(34,197,94,0.05)' : 'transparent' }}>
                <i className="ti ti-forms" style={{ fontSize:22, color: f.is_active ? GREEN : textSub }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:text }}>{f.title}</div>
                  <div style={{ fontSize:11, color:textSub }}>{qCount} question{qCount!==1?'s':''} · {f.view_count||0} views · {f.submit_count||0} submissions</div>
                </div>
                <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:12,
                  background: f.is_active ? 'rgba(34,197,94,0.15)' : 'rgba(148,163,184,0.15)',
                  color: f.is_active ? GREEN : textSub }}>
                  {f.is_active ? '● Active' : 'Inactive'}
                </span>
                {!f.is_active && (
                  <button onClick={() => activateForm(f.id)} disabled={busy}
                    style={{ fontSize:12, padding:'5px 12px', borderRadius:7, border:`1px solid ${border}`, background:'transparent', color:BRAND, fontWeight:600, cursor:'pointer' }}>
                    Activate
                  </button>
                )}
                <button onClick={() => setEditId(f.id)}
                  style={{ fontSize:12, padding:'5px 12px', borderRadius:7, border:`1px solid ${border}`, background:'transparent', color:textSub, fontWeight:600, cursor:'pointer' }}>
                  Edit
                </button>
                <button onClick={() => deleteForm(f.id)}
                  style={{ background:'none', border:'none', cursor:'pointer', color:'#ef4444', fontSize:15 }}><i className="ti ti-trash" /></button>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ marginTop:12, padding:'11px 14px', background:'rgba(0,153,204,0.08)', borderRadius:10, fontSize:12, color:BRAND, lineHeight:1.5 }}>
        Only one form can be active at a time. Activating a form automatically deactivates the others. Performance graphs appear here once leads start coming in.
      </div>
    </div>
  )
}

/* ---------- Custom question adder ---------- */
function CustomQuestionAdder({ onAdd, border, text, textSub, fieldBg, BRAND }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [type, setType] = useState('text')
  const [opts, setOpts] = useState('')
  const [req, setReq] = useState(false)

  function submit() {
    if (!q.trim()) { alert('Enter question text'); return }
    const options = (type === 'dropdown') ? opts.split(',').map(s => s.trim()).filter(Boolean) : []
    onAdd({ question: q.trim(), type, options, required: req })
    setQ(''); setType('text'); setOpts(''); setReq(false); setOpen(false)
  }

  if (!open) return (
    <div onClick={() => setOpen(true)}
      style={{ border:`1px dashed ${border}`, borderRadius:10, padding:'10px 13px', display:'flex', alignItems:'center', gap:8, color:BRAND, cursor:'pointer' }}>
      <i className="ti ti-plus" style={{ fontSize:16 }} /> <span style={{ fontSize:13, fontWeight:600 }}>Add custom question</span>
    </div>
  )

  return (
    <div style={{ border:`1px solid ${border}`, borderRadius:10, padding:13 }}>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Question text"
        style={{ width:'100%', padding:'8px 10px', border:`1px solid ${border}`, borderRadius:7, fontSize:13, background:fieldBg, color:text, outline:'none', boxSizing:'border-box', marginBottom:8 }} />
      <div style={{ display:'flex', gap:8, marginBottom:8 }}>
        <select value={type} onChange={e => setType(e.target.value)}
          style={{ flex:1, padding:'8px 10px', border:`1px solid ${border}`, borderRadius:7, fontSize:13, background:fieldBg, color:text, outline:'none' }}>
          {QTYPE.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:text, cursor:'pointer' }}>
          <input type="checkbox" checked={req} onChange={e => setReq(e.target.checked)} style={{ width:16, height:16, accentColor:'#22c55e' }} /> Required
        </label>
      </div>
      {type === 'dropdown' && (
        <input value={opts} onChange={e => setOpts(e.target.value)} placeholder="Options, comma separated (e.g. Yes, No, Maybe)"
          style={{ width:'100%', padding:'8px 10px', border:`1px solid ${border}`, borderRadius:7, fontSize:13, background:fieldBg, color:text, outline:'none', boxSizing:'border-box', marginBottom:8 }} />
      )}
      <div style={{ display:'flex', gap:8 }}>
        <button onClick={submit} style={{ padding:'7px 16px', background:BRAND, color:'#fff', border:'none', borderRadius:7, fontSize:13, fontWeight:600, cursor:'pointer' }}>Add</button>
        <button onClick={() => setOpen(false)} style={{ padding:'7px 16px', background:'transparent', color:textSub, border:`1px solid ${border}`, borderRadius:7, fontSize:13, cursor:'pointer' }}>Cancel</button>
      </div>
    </div>
  )
}
