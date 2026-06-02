import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const QTYPE = [
  { value: 'text',        label: 'Short text',        icon: 'ti-typography' },
  { value: 'textarea',    label: 'Long text',         icon: 'ti-align-left' },
  { value: 'dropdown',    label: 'Dropdown (single)', icon: 'ti-select' },
  { value: 'multiselect', label: 'Multi-choice',      icon: 'ti-checkbox' },
  { value: 'number',      label: 'Number',            icon: 'ti-123' },
  { value: 'phone',       label: 'Phone',             icon: 'ti-phone' },
  { value: 'email',       label: 'Email',             icon: 'ti-mail' },
  { value: 'yesno',       label: 'Yes / No',          icon: 'ti-toggle-left' },
]
const hasOptions = t => t === 'dropdown' || t === 'multiselect'

const SUGGESTED = [
  { key: 'service_category', question: 'Service category',    type: 'dropdown',    icon: 'ti-category',  options: [], help: 'Auto-filled from your live categories on the public site.' },
  { key: 'services_needed',  question: 'Services needed',     type: 'multiselect', icon: 'ti-checkbox',  options: ['Design','Renovation','Fit-out','MEP','Joinery','Flooring','Painting'], help: 'User can pick more than one.' },
  { key: 'area',             question: 'Area / Location',     type: 'dropdown',    icon: 'ti-map-pin',   options: ['Downtown','Business Bay','Marina','JBR','Palm Jumeirah','DIFC','Jumeirah','Deira','Other'] },
  { key: 'budget',           question: 'Budget range',        type: 'dropdown',    icon: 'ti-coin',      options: ['Under AED 50,000','AED 50,000 – 150,000','AED 150,000 – 500,000','Above AED 500,000'] },
  { key: 'timeline',         question: 'Timeline / urgency',  type: 'dropdown',    icon: 'ti-clock',     options: ['Immediately','Within 1 month','1–3 months','Just exploring'] },
  { key: 'property_type',    question: 'Property type',       type: 'dropdown',    icon: 'ti-home',      options: ['Apartment','Villa','Office','Retail','Other'] },
  { key: 'description',      question: 'Project description',  type: 'textarea',    icon: 'ti-file-text', options: [], placeholder: 'Tell us about your project...' },
]

export default function LeadForms({ theme }) {
  const isDark = theme === 'dark'
  const [forms, setForms] = useState([])
  const [questions, setQuestions] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [panel, setPanel] = useState(null)   // 'quick' | 'custom' | null
  const [preview, setPreview] = useState(false)

  const text    = isDark ? '#f1f5f9' : '#111827'
  const textSub = isDark ? '#94a3b8' : '#6b7280'
  const cardBg  = isDark ? '#161b22' : '#ffffff'
  const listBg  = isDark ? '#0f1419' : '#f8fafc'
  const border  = isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'
  const selBg   = isDark ? 'rgba(0,153,204,0.12)' : '#e9f5fb'
  const fieldBg = isDark ? '#0d1117' : '#f8fafc'
  const statBg  = isDark ? 'rgba(255,255,255,0.03)' : '#f1f5f9'
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
    } else { setQuestions({}) }
    setLoading(false)
  }

  useEffect(() => {
    if (forms.length && !forms.find(f => f.id === selectedId)) setSelectedId(forms[0].id)
    if (!forms.length) setSelectedId(null)
  }, [forms])

  useEffect(() => { setPanel(null); setPreview(false) }, [selectedId])

  async function createForm() {
    setBusy(true)
    const { data, error } = await supabase.from('lead_forms').insert({
      title: 'New Lead Form', is_platform: true, is_active: false, company_id: null,
    }).select().single()
    setBusy(false)
    if (error) { alert('Failed: ' + error.message); return }
    await load(); setSelectedId(data.id)
  }

  async function duplicateForm(src) {
    setBusy(true)
    const { data: nf, error } = await supabase.from('lead_forms').insert({
      title: src.title + ' (copy)', description: src.description || null, is_platform: true, is_active: false, company_id: null,
    }).select().single()
    if (error) { setBusy(false); alert('Failed: ' + error.message); return }
    const srcQs = questions[src.id] || []
    if (srcQs.length) {
      const rows = srcQs.map((q, i) => ({
        form_id: nf.id, question: q.question, type: q.type, options: q.options || null,
        required: q.required, order_num: i, placeholder: q.placeholder || null, help_text: q.help_text || null,
      }))
      await supabase.from('lead_form_questions').insert(rows)
    }
    setBusy(false)
    await load(); setSelectedId(nf.id)
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
    load()
  }

  async function saveTitle(id, title) {
    await supabase.from('lead_forms').update({ title }).eq('id', id)
    setForms(prev => prev.map(f => f.id === id ? { ...f, title } : f))
  }
  async function saveDesc(id, description) {
    await supabase.from('lead_forms').update({ description }).eq('id', id)
    setForms(prev => prev.map(f => f.id === id ? { ...f, description } : f))
  }

  async function addQuestion(formId, q) {
    const order = (questions[formId] || []).length
    const { error } = await supabase.from('lead_form_questions').insert({
      form_id: formId, question: q.question, type: q.type,
      options: hasOptions(q.type) && q.options?.length ? q.options : null,
      required: q.required ?? false, order_num: order,
      placeholder: q.placeholder || null, help_text: q.help || q.help_text || null,
    })
    if (error) { alert('Failed: ' + error.message); return }
    load()
  }

  async function deleteQuestion(qid) { await supabase.from('lead_form_questions').delete().eq('id', qid); load() }
  async function toggleRequired(qid, cur) { await supabase.from('lead_form_questions').update({ required: !cur }).eq('id', qid); load() }

  async function moveQuestion(formId, idx, dir) {
    const list = [...(questions[formId] || [])]
    const j = idx + dir
    if (j < 0 || j >= list.length) return
    ;[list[idx], list[j]] = [list[j], list[idx]]
    for (let k = 0; k < list.length; k++) await supabase.from('lead_form_questions').update({ order_num: k }).eq('id', list[k].id)
    load()
  }

  function convPct(f) {
    if (!f.view_count) return 0
    return Math.round((f.submit_count || 0) / f.view_count * 100)
  }
  const typeLabel = t => QTYPE.find(x => x.value === t)?.label || t
  const typeIcon  = t => QTYPE.find(x => x.value === t)?.icon || 'ti-help'

  if (loading) return (
    <div style={{ textAlign:'center', padding:60, color:textSub }}>
      <div style={{ width:36, height:36, border:`3px solid ${GREEN}`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 12px' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      Loading lead forms...
    </div>
  )

  const selected = forms.find(f => f.id === selectedId) || null
  const qs = selected ? (questions[selected.id] || []) : []
  const usedQuestions = qs.map(q => q.question.toLowerCase())
  const reqCount = qs.filter(q => q.required).length

  return (
    <div style={{ maxWidth:1100 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:text, marginBottom:4 }}>Lead Forms</h1>
          <p style={{ color:textSub, fontSize:14 }}>Build multiple forms, activate the one users should fill.</p>
        </div>
        <button onClick={createForm} disabled={busy}
          style={{ padding:'8px 16px', background:GREEN, color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>
          + Create new form
        </button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'250px 1fr', border:`1px solid ${border}`, borderRadius:14, overflow:'hidden', background:cardBg, minHeight:500 }}>

        {/* LEFT LIST */}
        <div style={{ borderRight:`1px solid ${border}`, background:listBg, maxHeight:720, overflowY:'auto' }}>
          {forms.length === 0 && <div style={{ padding:20, color:textSub, fontSize:13 }}>No forms yet. Click "Create new form".</div>}
          {forms.map(f => {
            const sel = f.id === selectedId
            const qCount = (questions[f.id] || []).length
            return (
              <div key={f.id} onClick={() => setSelectedId(f.id)}
                style={{ padding:'11px 14px', borderBottom:`1px solid ${border}`, cursor:'pointer', display:'flex', gap:10, alignItems:'center',
                  borderLeft: sel ? `3px solid ${BRAND}` : '3px solid transparent', background: sel ? selBg : 'transparent' }}>
                <i className="ti ti-forms" style={{ fontSize:20, color: f.is_active ? GREEN : textSub, flexShrink:0 }} />
                <div style={{ minWidth:0, flex:1 }}>
                  <div style={{ fontSize:13, fontWeight: sel ? 700 : 600, color:text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.title}</div>
                  <div style={{ fontSize:10, color:textSub }}>{qCount} question{qCount!==1?'s':''} · {f.submit_count||0} leads</div>
                </div>
                <span style={{ fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:10, flexShrink:0,
                  background: f.is_active ? 'rgba(34,197,94,0.15)' : 'rgba(148,163,184,0.15)',
                  color: f.is_active ? GREEN : textSub }}>
                  {f.is_active ? '● Active' : 'Inactive'}
                </span>
              </div>
            )
          })}
        </div>

        {/* RIGHT DETAIL */}
        <div style={{ padding:18, maxHeight:720, overflowY:'auto' }}>
          {!selected ? (
            <div style={{ color:textSub, fontSize:14, padding:30, textAlign:'center' }}>Select a form, or create a new one.</div>
          ) : (
            <div>
              {/* Header */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16, gap:10, flexWrap:'wrap' }}>
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:text }}>{selected.title}</div>
                  <div style={{ fontSize:12, color: selected.is_active ? GREEN : textSub, marginTop:2 }}>
                    {selected.is_active ? '● Active · users see this form' : 'Inactive · not shown to users'}
                  </div>
                </div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  <button onClick={() => setPreview(p => !p)}
                    style={{ fontSize:12, padding:'7px 12px', borderRadius:8, border:`1px solid ${border}`, background: preview ? selBg : 'transparent', color: preview ? BRAND : textSub, fontWeight:600, cursor:'pointer' }}>
                    <i className="ti ti-eye" style={{ marginRight:4 }} />{preview ? 'Editing' : 'Preview'}
                  </button>
                  <button onClick={() => duplicateForm(selected)} disabled={busy}
                    style={{ fontSize:12, padding:'7px 12px', borderRadius:8, border:`1px solid ${border}`, background:'transparent', color:textSub, fontWeight:600, cursor:'pointer' }}>
                    <i className="ti ti-copy" style={{ marginRight:4 }} />Duplicate
                  </button>
                  {!selected.is_active && (
                    <button onClick={() => activateForm(selected.id)} disabled={busy}
                      style={{ fontSize:12, padding:'7px 14px', borderRadius:8, border:'none', background:GREEN, color:'#fff', fontWeight:700, cursor:'pointer' }}>
                      Activate
                    </button>
                  )}
                  <button onClick={() => deleteForm(selected.id)}
                    style={{ fontSize:12, padding:'7px 12px', borderRadius:8, border:`1px solid ${border}`, background:'transparent', color:'#ef4444', fontWeight:600, cursor:'pointer' }}>
                    Delete
                  </button>
                </div>
              </div>

              {/* Analytics */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8, marginBottom:18 }}>
                <div style={{ background:statBg, borderRadius:8, padding:'10px 12px' }}>
                  <div style={{ fontSize:11, color:textSub }}>Views</div>
                  <div style={{ fontSize:20, fontWeight:700, color:text }}>{selected.view_count || 0}</div>
                </div>
                <div style={{ background:statBg, borderRadius:8, padding:'10px 12px' }}>
                  <div style={{ fontSize:11, color:textSub }}>Submissions</div>
                  <div style={{ fontSize:20, fontWeight:700, color:text }}>{selected.submit_count || 0}</div>
                </div>
                <div style={{ background:statBg, borderRadius:8, padding:'10px 12px' }}>
                  <div style={{ fontSize:11, color:textSub }}>Conversion</div>
                  <div style={{ fontSize:20, fontWeight:700, color: convPct(selected) >= 40 ? GREEN : convPct(selected) >= 15 ? '#f59e0b' : textSub }}>{convPct(selected)}%</div>
                </div>
                <div style={{ background:statBg, borderRadius:8, padding:'10px 12px' }}>
                  <div style={{ fontSize:11, color:textSub }}>Questions</div>
                  <div style={{ fontSize:20, fontWeight:700, color:text }}>{qs.length}<span style={{ fontSize:11, color:textSub, fontWeight:400 }}> · {reqCount} req</span></div>
                </div>
              </div>

              {preview ? (
                /* ---- LIVE PREVIEW ---- */
                <div style={{ border:`1px solid ${border}`, borderRadius:12, padding:18, background:fieldBg }}>
                  <div style={{ fontSize:11, color:textSub, marginBottom:12, textTransform:'uppercase', letterSpacing:'0.04em' }}>Preview — how users see it</div>
                  <div style={{ fontSize:17, fontWeight:700, color:text, marginBottom:4 }}>{selected.title}</div>
                  {selected.description && <div style={{ fontSize:13, color:textSub, marginBottom:14 }}>{selected.description}</div>}
                  {qs.length === 0 && <div style={{ fontSize:13, color:textSub }}>No questions yet.</div>}
                  {qs.map(q => (
                    <div key={q.id} style={{ marginBottom:14 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:text, marginBottom:5 }}>{q.question}{q.required && <span style={{ color:'#ef4444' }}> *</span>}</div>
                      {q.help_text && <div style={{ fontSize:11, color:textSub, marginBottom:5 }}>{q.help_text}</div>}
                      <PreviewField q={q} border={border} text={text} textSub={textSub} cardBg={cardBg} BRAND={BRAND} />
                    </div>
                  ))}
                  <div style={{ marginTop:8, padding:'9px', background:'rgba(0,153,204,0.08)', borderRadius:8, fontSize:11, color:BRAND }}>
                    Name &amp; phone captured from the user's account automatically.
                  </div>
                </div>
              ) : (
                /* ---- EDITOR ---- */
                <div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
                    <div>
                      <div style={{ fontSize:11, color:textSub, marginBottom:4 }}>Form title</div>
                      <input value={selected.title} onChange={e => saveTitle(selected.id, e.target.value)}
                        style={{ width:'100%', padding:'9px 12px', border:`1px solid ${border}`, borderRadius:8, fontSize:13, fontWeight:600, background:fieldBg, color:text, outline:'none', boxSizing:'border-box' }} />
                    </div>
                    <div>
                      <div style={{ fontSize:11, color:textSub, marginBottom:4 }}>Subtitle (optional)</div>
                      <input value={selected.description || ''} onChange={e => saveDesc(selected.id, e.target.value)} placeholder="e.g. Get 3 free quotes in minutes"
                        style={{ width:'100%', padding:'9px 12px', border:`1px solid ${border}`, borderRadius:8, fontSize:13, background:fieldBg, color:text, outline:'none', boxSizing:'border-box' }} />
                    </div>
                  </div>

                  <div style={{ fontSize:11, color:textSub, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:8 }}>Questions</div>

                  {qs.length === 0 && <div style={{ padding:18, textAlign:'center', color:textSub, fontSize:13, border:`1px dashed ${border}`, borderRadius:10, marginBottom:10 }}>No questions yet. Add from quick-add or create custom.</div>}

                  {qs.map((q, i) => (
                    <div key={q.id} style={{ border:`1px solid ${border}`, borderRadius:10, padding:'10px 12px', marginBottom:7, display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
                        <button onClick={() => moveQuestion(selected.id, i, -1)} disabled={i===0} style={{ background:'none', border:'none', cursor: i===0?'default':'pointer', color: i===0?border:textSub, padding:0, fontSize:12 }}><i className="ti ti-chevron-up" /></button>
                        <button onClick={() => moveQuestion(selected.id, i, 1)} disabled={i===qs.length-1} style={{ background:'none', border:'none', cursor: i===qs.length-1?'default':'pointer', color: i===qs.length-1?border:textSub, padding:0, fontSize:12 }}><i className="ti ti-chevron-down" /></button>
                      </div>
                      <i className={`ti ${typeIcon(q.type)}`} style={{ fontSize:16, color:textSub, flexShrink:0 }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:text }}>{q.question}</div>
                        <div style={{ fontSize:10, color:textSub }}>
                          {typeLabel(q.type)}
                          {q.options && Array.isArray(q.options) && q.options.length ? ` · ${q.options.length} options` : ''}
                        </div>
                      </div>
                      <button onClick={() => toggleRequired(q.id, q.required)}
                        style={{ fontSize:10, padding:'3px 9px', borderRadius:10, border:`1px solid ${border}`, cursor:'pointer',
                          background: q.required ? 'rgba(34,197,94,0.12)' : 'transparent', color: q.required ? GREEN : textSub }}>
                        {q.required ? 'Required' : 'Optional'}
                      </button>
                      <button onClick={() => deleteQuestion(q.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#ef4444', fontSize:14 }}><i className="ti ti-trash" /></button>
                    </div>
                  ))}

                  <div style={{ display:'flex', gap:10, marginTop:12 }}>
                    <div onClick={() => setPanel(p => p==='quick'?null:'quick')}
                      style={{ flex:1, border:`1px dashed ${panel==='quick' ? BRAND : border}`, borderRadius:10, padding:'9px', display:'flex', alignItems:'center', justifyContent:'center', gap:6, color:BRAND, fontSize:12, fontWeight:600, cursor:'pointer' }}>
                      <i className="ti ti-bolt" /> Quick add fields
                    </div>
                    <div onClick={() => setPanel(p => p==='custom'?null:'custom')}
                      style={{ flex:1, border:`1px dashed ${panel==='custom' ? BRAND : border}`, borderRadius:10, padding:'9px', display:'flex', alignItems:'center', justifyContent:'center', gap:6, color:BRAND, fontSize:12, fontWeight:600, cursor:'pointer' }}>
                      <i className="ti ti-plus" /> Custom question
                    </div>
                  </div>

                  {panel === 'quick' && (
                    <div style={{ marginTop:10, border:`1px solid ${border}`, borderRadius:10, padding:12 }}>
                      <div style={{ fontSize:11, color:textSub, marginBottom:8 }}>Tap to add</div>
                      {SUGGESTED.map(s => {
                        const added = usedQuestions.includes(s.question.toLowerCase())
                        return (
                          <div key={s.key} onClick={() => { if (!added) addQuestion(selected.id, { question:s.question, type:s.type, options:s.options, required: s.key==='service_category', placeholder:s.placeholder, help:s.help }) }}
                            style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 11px', border:`1px solid ${border}`, borderRadius:8, marginBottom:7, cursor: added?'default':'pointer', opacity: added?0.55:1 }}>
                            <i className={`ti ${s.icon}`} style={{ fontSize:16, color: added?textSub:BRAND }} />
                            <span style={{ fontSize:12, color:text, flex:1 }}>{s.question}</span>
                            <span style={{ fontSize:10, color:textSub }}>{typeLabel(s.type)}</span>
                            <i className={`ti ${added ? 'ti-check' : 'ti-plus'}`} style={{ fontSize:15, color: added?GREEN:BRAND }} />
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {panel === 'custom' && (
                    <div style={{ marginTop:10 }}>
                      <CustomQuestionAdder onAdd={(q) => { addQuestion(selected.id, q); setPanel(null) }} border={border} text={text} textSub={textSub} fieldBg={fieldBg} BRAND={BRAND} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------- Preview field renderer ---------- */
function PreviewField({ q, border, text, textSub, cardBg, BRAND }) {
  const base = { width:'100%', padding:'9px 12px', border:`1px solid ${border}`, borderRadius:8, fontSize:13, background:cardBg, color:text, boxSizing:'border-box' }
  if (q.type === 'textarea') return <div style={{ ...base, minHeight:60, color:textSub }}>{q.placeholder || 'Long answer...'}</div>
  if (q.type === 'dropdown') return <div style={{ ...base, color:textSub, display:'flex', justifyContent:'space-between' }}><span>Select...</span><i className="ti ti-chevron-down" /></div>
  if (q.type === 'multiselect') return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
      {(q.options || []).map(o => <span key={o} style={{ fontSize:12, padding:'5px 11px', border:`1px solid ${border}`, borderRadius:99, color:text }}>{o}</span>)}
    </div>
  )
  if (q.type === 'yesno') return (
    <div style={{ display:'flex', gap:8 }}>
      {['Yes','No'].map(o => <span key={o} style={{ fontSize:12, padding:'7px 18px', border:`1px solid ${border}`, borderRadius:8, color:text }}>{o}</span>)}
    </div>
  )
  return <div style={{ ...base, color:textSub }}>{q.placeholder || (q.type==='phone'?'+971...':q.type==='email'?'you@email.com':q.type==='number'?'0':'Your answer')}</div>
}

/* ---------- Custom question adder ---------- */
function CustomQuestionAdder({ onAdd, border, text, textSub, fieldBg, BRAND }) {
  const [q, setQ] = useState('')
  const [type, setType] = useState('text')
  const [opts, setOpts] = useState('')
  const [ph, setPh] = useState('')
  const [help, setHelp] = useState('')
  const [req, setReq] = useState(false)

  function submit() {
    if (!q.trim()) { alert('Enter question text'); return }
    const options = hasOptions(type) ? opts.split(',').map(s => s.trim()).filter(Boolean) : []
    if (hasOptions(type) && options.length === 0) { alert('Add at least one option'); return }
    onAdd({ question: q.trim(), type, options, required: req, placeholder: ph.trim() || null, help: help.trim() || null })
    setQ(''); setType('text'); setOpts(''); setPh(''); setHelp(''); setReq(false)
  }

  const inp = { width:'100%', padding:'8px 10px', border:`1px solid ${border}`, borderRadius:7, fontSize:13, background:fieldBg, color:text, outline:'none', boxSizing:'border-box', marginBottom:8 }

  return (
    <div style={{ border:`1px solid ${border}`, borderRadius:10, padding:13 }}>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Question text" style={inp} />
      <div style={{ display:'flex', gap:8, marginBottom:8 }}>
        <select value={type} onChange={e => setType(e.target.value)}
          style={{ flex:1, padding:'8px 10px', border:`1px solid ${border}`, borderRadius:7, fontSize:13, background:fieldBg, color:text, outline:'none' }}>
          {QTYPE.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:text, cursor:'pointer', whiteSpace:'nowrap' }}>
          <input type="checkbox" checked={req} onChange={e => setReq(e.target.checked)} style={{ width:16, height:16, accentColor:'#22c55e' }} /> Required
        </label>
      </div>
      {hasOptions(type) && (
        <input value={opts} onChange={e => setOpts(e.target.value)} placeholder="Options, comma separated (e.g. Kitchen, Bathroom, Flooring)" style={inp} />
      )}
      <input value={ph} onChange={e => setPh(e.target.value)} placeholder="Placeholder / hint (optional)" style={inp} />
      <input value={help} onChange={e => setHelp(e.target.value)} placeholder="Help text below question (optional)" style={inp} />
      <button onClick={submit} style={{ padding:'7px 16px', background:BRAND, color:'#fff', border:'none', borderRadius:7, fontSize:13, fontWeight:600, cursor:'pointer' }}>Add question</button>
    </div>
  )
}
