// trustdubai-admin/src/pages/LeadManagement.jsx
import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

const BRAND = '#0099cc'
const PAGE = 25

const DUBAI_AREAS = [
  'Downtown Dubai','Business Bay','Dubai Marina','Palm Jumeirah','Jumeirah Village Circle (JVC)',
  'Jumeirah Lake Towers (JLT)','Jumeirah','Dubai Hills Estate','Arabian Ranches','DAMAC Hills',
  'Emirates Hills','The Springs','The Meadows','The Greens','Dubai Silicon Oasis',
  'Mirdif','Al Barsha','Deira','Bur Dubai','Dubai Investment Park (DIP)',
  'Jumeirah Beach Residence (JBR)','DIFC','City Walk','Al Furjan','Discovery Gardens',
  'Motor City','Jumeirah Golf Estates','Dubailand','International City','Town Square','Other',
]

function isTestLead(c) {
  const t = (s) => (s || '').toLowerCase().includes('test')
  return t(c.name) || t(c.email) || t(c.phone)
}

function fmtDate(d) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return '—' }
}

export default function LeadManagement({ theme, adminData }) {
  const isDark = theme === 'dark'
  const [rows, setRows] = useState([])
  const [companies, setCompanies] = useState({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('all')
  const [sel, setSel] = useState([])           // selected lead ids
  const [visible, setVisible] = useState(PAGE)
  const [pendingDelete, setPendingDelete] = useState(null) // array of ids awaiting confirm

  // ── dropdown data ──
  const [cats, setCats] = useState([])          // category names
  const [assignCos, setAssignCos] = useState([]) // own / non-imported companies for assignment
  const [spinOn, setSpinOn] = useState(true)    // Spin tool master switch (platform_settings)

  // ── Add Manual Lead modal ──
  const [showAdd, setShowAdd] = useState(false)
  const [mlName, setMlName] = useState('')
  const [mlPhone, setMlPhone] = useState('')
  const [mlEmail, setMlEmail] = useState('')
  const [mlCat, setMlCat] = useState('')
  const [mlArea, setMlArea] = useState('')
  const [mlCos, setMlCos] = useState([])
  const [mlNotes, setMlNotes] = useState('')
  const [mlBusy, setMlBusy] = useState(false)
  const [mlErr, setMlErr] = useState('')

  // ── Edit lead modal ──
  const [editLead, setEditLead] = useState(null)
  const [edName, setEdName] = useState('')
  const [edPhone, setEdPhone] = useState('')
  const [edEmail, setEdEmail] = useState('')
  const [edCat, setEdCat] = useState('')
  const [edArea, setEdArea] = useState('')
  const [edNotes, setEdNotes] = useState('')
  const [edCompanies, setEdCompanies] = useState([])   // currently assigned
  const [edAddCos, setEdAddCos] = useState([])         // company ids to add
  const [edBusy, setEdBusy] = useState(false)
  const [edErr, setEdErr] = useState('')

  // ── Spin panel ──
  const [spinLead, setSpinLead] = useState(null)
  const [spinList, setSpinList] = useState([])
  const [spinIdx, setSpinIdx] = useState(0)
  const [spinHist, setSpinHist] = useState([])
  const [spinBusy, setSpinBusy] = useState(false)

  const C = {
    title: isDark ? '#f0fdf4' : '#0f172a',
    sub:   isDark ? '#94a3b8' : '#64748b',
    cardBg: isDark ? '#161b22' : '#ffffff',
    listBg: isDark ? '#0f1419' : '#f8fafc',
    cardBorder: isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0',
    rowBorder:  isDark ? 'rgba(255,255,255,0.06)' : '#eef2f6',
    selBg: isDark ? 'rgba(0,153,204,0.12)' : '#e9f5fb',
    name:  isDark ? '#f0fdf4' : '#0f172a',
    label: isDark ? '#e5e7eb' : '#334155',
    muted: isDark ? '#6b7280' : '#94a3b8',
    chipBg: isDark ? 'rgba(255,255,255,0.06)' : '#eef2f6',
    inputBg: isDark ? '#0f1419' : '#f8fafc',
    danger: '#c0392b',
    dangerBg: 'rgba(248,113,113,0.15)',
    green: '#1d9e75',
    greenBg: 'rgba(29,158,117,0.15)',
  }

  async function load() {
    setLoading(true)
    const [{ data: leads }, { data: comps }, { data: catList }, { data: aco }, { data: ps }] = await Promise.all([
      supabase.from('lead_submissions')
        .select('id, company_id, name, phone, email, status, source, created_at')
        .order('created_at', { ascending: false }),
      supabase.from('companies').select('id, name'),
      supabase.from('categories').select('name').eq('is_active', true).order('sort_order', { ascending: true }),
      supabase.from('companies').select('id, name, category').eq('is_imported', false).order('name', { ascending: true }),
      supabase.from('platform_settings').select('spin_enabled').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    ])
    const map = {}
    ;(comps || []).forEach(c => { map[c.id] = c.name })
    setCompanies(map)
    setRows(leads || [])
    setCats((catList || []).map(c => c.name))
    setAssignCos(aco || [])
    setSpinOn(ps ? ps.spin_enabled !== false : true)
    setSel([])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function toggleSel(id) {
    setSel(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function runDelete(ids) {
    if (!ids || !ids.length) return
    setBusy(true)
    const { data, error } = await supabase.rpc('fn_admin_delete_leads', { p_lead_ids: ids })
    setBusy(false)
    setPendingDelete(null)
    if (error) { alert('Error: ' + error.message); return }
    await load()
    alert(`Deleted ${data ?? ids.length} lead(s) and all related records.`)
  }

  // ── Manual lead ──
  function toggleMlCo(id) {
    setMlCos(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function submitManual() {
    if (!mlName.trim())  { setMlErr('Customer name is required'); return }
    if (!mlPhone.trim()) { setMlErr('Phone is required'); return }
    if (!mlCat)          { setMlErr('Please select a category'); return }
    if (!mlCos.length)   { setMlErr('Please choose at least one company'); return }
    setMlBusy(true); setMlErr('')
    const { error } = await supabase.rpc('fn_create_manual_lead', {
      p_name: mlName.trim(),
      p_phone: mlPhone.trim(),
      p_email: mlEmail.trim(),
      p_category: mlCat,
      p_area: mlArea,
      p_company_ids: mlCos,
      p_notes: mlNotes.trim() || null,
    })
    setMlBusy(false)
    if (error) { setMlErr('Error: ' + error.message); return }
    setShowAdd(false)
    setMlName(''); setMlPhone(''); setMlEmail(''); setMlCat(''); setMlArea(''); setMlCos([]); setMlNotes('')
    await load()
    alert('Manual lead added and assigned ✓')
  }

  // ── Edit lead ──
  async function openEdit(lead) {
    setEditLead(lead); setEdErr(''); setEdAddCos([])
    setEdName(lead.name || ''); setEdPhone(lead.phone || ''); setEdEmail(lead.email || '')
    setEdNotes(''); setEdCat(''); setEdArea(''); setEdCompanies([])
    const [{ data: full }, { data: cos }] = await Promise.all([
      supabase.from('lead_submissions').select('answers, notes').eq('id', lead.id).maybeSingle(),
      supabase.rpc('fn_lead_companies', { p_lead_id: lead.id }),
    ])
    if (full) {
      setEdNotes(full.notes || '')
      const a = full.answers || {}
      setEdCat(a['Service Category'] || '')
      setEdArea(a['_area'] || '')
    }
    setEdCompanies(Array.isArray(cos) ? cos : [])
  }

  function toggleEdAddCo(id) {
    setEdAddCos(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function removeEdCompany(companyId) {
    if (!editLead) return
    setEdBusy(true)
    await supabase.rpc('fn_unassign_lead_company', { p_lead_id: editLead.id, p_company_id: companyId })
    const { data: cos } = await supabase.rpc('fn_lead_companies', { p_lead_id: editLead.id })
    setEdCompanies(Array.isArray(cos) ? cos : [])
    setEdBusy(false)
  }

  async function submitEdit() {
    if (!editLead) return
    if (!edName.trim())  { setEdErr('Name is required'); return }
    if (!edPhone.trim()) { setEdErr('Phone is required'); return }
    setEdBusy(true); setEdErr('')
    const { error } = await supabase.rpc('fn_update_lead', {
      p_lead_id: editLead.id,
      p_name: edName.trim(),
      p_phone: edPhone.trim(),
      p_email: edEmail.trim(),
      p_category: edCat,
      p_area: edArea,
      p_notes: edNotes.trim() || null,
    })
    if (!error && edAddCos.length) {
      await supabase.rpc('fn_assign_lead_companies', { p_lead_id: editLead.id, p_company_ids: edAddCos })
    }
    setEdBusy(false)
    if (error) { setEdErr('Error: ' + error.message); return }
    setEditLead(null)
    await load()
    alert('Lead updated ✓')
  }

  // ── Spin ──
  async function openSpin(lead) {
    setSpinLead(lead); setSpinIdx(0); setSpinBusy(true); setSpinList([]); setSpinHist([])
    const [{ data: list }, { data: hist }] = await Promise.all([
      supabase.rpc('fn_spin_companies', { p_lead_id: lead.id, p_limit: 8 }),
      supabase.rpc('fn_spin_history', { p_lead_id: lead.id }),
    ])
    setSpinList(Array.isArray(list) ? list : [])
    setSpinHist(Array.isArray(hist) ? hist : [])
    setSpinBusy(false)
  }

  async function refetchSpin() {
    if (!spinLead) return
    setSpinBusy(true)
    const { data: list } = await supabase.rpc('fn_spin_companies', { p_lead_id: spinLead.id, p_limit: 8 })
    setSpinList(Array.isArray(list) ? list : [])
    setSpinIdx(0)
    setSpinBusy(false)
  }

  async function refreshHist() {
    if (!spinLead) return
    const { data: hist } = await supabase.rpc('fn_spin_history', { p_lead_id: spinLead.id })
    setSpinHist(Array.isArray(hist) ? hist : [])
  }

  async function spinMark(status) {
    const co = spinList[spinIdx]
    if (!co || spinBusy) return
    setSpinBusy(true)
    const { error } = await supabase.rpc('fn_spin_mark', { p_lead_id: spinLead.id, p_company_id: co.id, p_status: status, p_note: null })
    setSpinBusy(false)
    if (error) { alert('Error: ' + error.message); return }
    await refreshHist()
    if (status === 'declined') {
      if (spinIdx + 1 < spinList.length) setSpinIdx(spinIdx + 1)
      else await refetchSpin()
    } else if (status === 'claimed') {
      alert(co.name + ' marked as claimed ✓ — lead recorded.')
      setSpinLead(null)
      await load()
    }
  }

  function spinNext() {
    if (spinIdx + 1 < spinList.length) setSpinIdx(spinIdx + 1)
    else refetchSpin()
  }

  // counts
  const counts = { all: rows.length, test: 0, platform: 0, manual: 0 }
  rows.forEach(c => {
    if (isTestLead(c)) counts.test++
    if (c.source && c.source.toLowerCase() !== 'manual') counts.platform++
    else counts.manual++
  })

  const q = search.trim().toLowerCase()
  const filtered = rows.filter(c => {
    if (tab === 'test' && !isTestLead(c)) return false
    if (tab === 'platform' && !(c.source && c.source.toLowerCase() !== 'manual')) return false
    if (tab === 'manual' && (c.source && c.source.toLowerCase() !== 'manual')) return false
    if (q) {
      const hay = `${c.name || ''} ${c.email || ''} ${c.phone || ''} ${companies[c.company_id] || ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
  const shown = filtered.slice(0, visible)

  const shownIds = shown.map(r => r.id)
  const allShownSelected = shownIds.length > 0 && shownIds.every(id => sel.includes(id))
  function toggleSelectAllShown() {
    if (allShownSelected) setSel(prev => prev.filter(id => !shownIds.includes(id)))
    else setSel(prev => [...new Set([...prev, ...shownIds])])
  }

  const TABS = [
    { key: 'all',      label: 'All' },
    { key: 'test',     label: 'Test' },
    { key: 'platform', label: 'Platform' },
    { key: 'manual',   label: 'Manual' },
  ]

  const inp = { width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 13, boxSizing: 'border-box',
    background: C.inputBg, color: C.label, border: `1px solid ${C.cardBorder}`, outline: 'none' }
  const lbl = { fontSize: 11.5, fontWeight: 600, color: C.sub, marginBottom: 5, display: 'block' }

  if (loading) return <div style={{ padding: 24, color: C.sub }}>Loading leads…</div>

  const spinCo = spinList[spinIdx] || null
  const statusColor = (s) => s === 'claimed' ? C.green : s === 'declined' ? C.danger : C.sub

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4, color: C.title }}>Lead Management</h1>
          <p style={{ color: C.sub, marginBottom: 0, fontSize: 14, maxWidth: 640 }}>
            Search, review and delete leads across all companies. Add manual leads and spin to recruit companies.
          </p>
        </div>
        <button onClick={() => { setMlErr(''); setShowAdd(true) }}
          style={{ background: BRAND, color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0, whiteSpace: 'nowrap' }}>
          <i className="ti ti-plus" style={{ fontSize: 16 }} /> Add Manual Lead
        </button>
      </div>

      {/* SEARCH + TABS */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', margin: '16px 0 14px' }}>
        <div style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 8, background: C.inputBg, border: `1px solid ${C.cardBorder}`, borderRadius: 8, padding: '8px 12px' }}>
          <i className="ti ti-search" style={{ fontSize: 16, color: C.muted }} />
          <input value={search} onChange={e => { setSearch(e.target.value); setVisible(PAGE) }}
            placeholder="Search name, email, phone or company…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: C.label, fontSize: 13 }} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TABS.map(t => {
            const active = tab === t.key
            return (
              <button key={t.key} onClick={() => { setTab(t.key); setVisible(PAGE) }}
                style={{ border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: '7px 13px', borderRadius: 20,
                  background: active ? 'rgba(0,153,204,0.15)' : C.chipBg, color: active ? BRAND : C.sub }}>
                {t.label} · {counts[t.key]}
              </button>
            )
          })}
        </div>
      </div>

      {/* ACTION BAR */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: C.label, userSelect: 'none' }}>
          <input type="checkbox" checked={allShownSelected} onChange={toggleSelectAllShown} style={{ width: 16, height: 16, accentColor: BRAND, cursor: 'pointer' }} />
          Select all shown ({shown.length})
        </label>
        <button onClick={() => sel.length && setPendingDelete([...sel])} disabled={!sel.length || busy}
          style={{ background: sel.length ? C.danger : C.chipBg, color: sel.length ? '#fff' : C.muted, border: 'none', padding: '9px 16px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: sel.length ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 7 }}>
          <i className="ti ti-trash" style={{ fontSize: 15 }} />
          Delete selected ({sel.length})
        </button>
      </div>

      {/* LIST */}
      <div style={{ border: `1px solid ${C.cardBorder}`, borderRadius: 12, overflow: 'hidden', background: C.cardBg }}>
        {shown.length === 0 && <div style={{ padding: 24, color: C.muted, fontSize: 13 }}>No leads in this view.</div>}
        {shown.map(c => {
          const checked = sel.includes(c.id)
          const test = isTestLead(c)
          return (
            <div key={c.id}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: `1px solid ${C.rowBorder}`, background: checked ? C.selBg : 'transparent' }}>
              <input type="checkbox" checked={checked} onChange={() => toggleSel(c.id)} style={{ width: 16, height: 16, accentColor: BRAND, cursor: 'pointer', flexShrink: 0 }} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: C.name, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name || 'Unnamed lead'}</span>
                  {test && <span style={{ background: C.dangerBg, color: C.danger, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12 }}>TEST</span>}
                  {c.source && <span style={{ background: C.chipBg, color: C.sub, fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 12 }}>{c.source}</span>}
                </div>
                <div style={{ fontSize: 11.5, color: C.sub, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {(c.phone || '—')} · {(c.email || '—')}
                </div>
                <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>
                  {companies[c.company_id] || 'Unknown company'} · {fmtDate(c.created_at)}{c.status ? ` · ${c.status}` : ''}
                </div>
              </div>

              <button onClick={() => openEdit(c)} disabled={busy} title="Edit lead"
                style={{ background: 'transparent', border: `1px solid ${C.cardBorder}`, color: C.sub, width: 34, height: 34, borderRadius: 8, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="ti ti-pencil" style={{ fontSize: 15 }} />
              </button>

              {spinOn && (
                <button onClick={() => openSpin(c)} disabled={busy} title="Spin — find a company to call"
                  style={{ background: C.greenBg, border: `1px solid ${C.green}55`, color: C.green, height: 34, padding: '0 12px', borderRadius: 8, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700 }}>
                  <i className="ti ti-refresh" style={{ fontSize: 15 }} /> Spin
                </button>
              )}

              <button onClick={() => setPendingDelete([c.id])} disabled={busy} title="Delete this lead"
                style={{ background: 'transparent', border: `1px solid ${C.cardBorder}`, color: C.danger, width: 34, height: 34, borderRadius: 8, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="ti ti-trash" style={{ fontSize: 15 }} />
              </button>
            </div>
          )
        })}
        {filtered.length > visible && (
          <div onClick={() => setVisible(v => v + PAGE)} style={{ padding: 13, textAlign: 'center', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: BRAND }}>
            Load more ({visible} of {filtered.length})
          </div>
        )}
      </div>

      {/* CONFIRM DELETE POPUP */}
      {pendingDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
          <div style={{ background: C.cardBg, borderRadius: 14, padding: 24, width: 440, maxWidth: '100%', border: `1px solid ${C.cardBorder}` }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: C.title, marginBottom: 8 }}>Delete {pendingDelete.length} lead(s)?</h3>
            <p style={{ fontSize: 13.5, color: C.sub, marginBottom: 16, lineHeight: 1.5 }}>
              This permanently deletes the selected lead(s) along with all related projects, quotations, distributions, chat and activity. This cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setPendingDelete(null)} disabled={busy}
                style={{ background: 'transparent', border: `1px solid ${C.cardBorder}`, color: C.label, padding: '9px 16px', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => runDelete(pendingDelete)} disabled={busy}
                style={{ background: C.danger, color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                {busy ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD MANUAL LEAD MODAL */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
          <div style={{ background: C.cardBg, borderRadius: 14, padding: 24, width: 480, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', border: `1px solid ${C.cardBorder}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: C.title }}>Add Manual Lead</h3>
              <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
            <p style={{ fontSize: 12.5, color: C.sub, marginBottom: 16 }}>A lead that came by phone, WhatsApp or walk-in. It is assigned directly to the chosen company.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={lbl}>Customer Name *</label>
                <input value={mlName} onChange={e => setMlName(e.target.value)} placeholder="e.g. Ankit Sharma" style={inp} />
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label style={lbl}>Phone / WhatsApp *</label>
                  <input value={mlPhone} onChange={e => setMlPhone(e.target.value)} placeholder="+971 50 000 0000" style={inp} />
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label style={lbl}>Email (optional)</label>
                  <input value={mlEmail} onChange={e => setMlEmail(e.target.value)} placeholder="you@email.com" style={inp} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label style={lbl}>Category *</label>
                  <select value={mlCat} onChange={e => setMlCat(e.target.value)} style={inp}>
                    <option value="">Select category…</option>
                    {cats.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label style={lbl}>Area</label>
                  <select value={mlArea} onChange={e => setMlArea(e.target.value)} style={inp}>
                    <option value="">Select area…</option>
                    {DUBAI_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={lbl}>Assign to Companies * (pick one or more)</label>
                <div style={{ maxHeight: 170, overflowY: 'auto', border: `1px solid ${C.cardBorder}`, borderRadius: 8, padding: 6, background: C.inputBg }}>
                  {assignCos.length === 0 && <div style={{ fontSize: 12, color: C.muted, padding: 6 }}>No companies found.</div>}
                  {assignCos.map(co => {
                    const on = mlCos.includes(co.id)
                    return (
                      <label key={co.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px', cursor: 'pointer', borderRadius: 6, background: on ? C.selBg : 'transparent' }}>
                        <input type="checkbox" checked={on} onChange={() => toggleMlCo(co.id)} style={{ width: 15, height: 15, accentColor: BRAND, cursor: 'pointer' }} />
                        <span style={{ fontSize: 12.5, color: C.label }}>{co.name}{co.category ? ' · ' + co.category : ''}</span>
                      </label>
                    )
                  })}
                </div>
                {mlCos.length > 0 && <div style={{ fontSize: 11, color: C.sub, marginTop: 5 }}>{mlCos.length} compan{mlCos.length === 1 ? 'y' : 'ies'} selected</div>}
              </div>
              <div>
                <label style={lbl}>Notes (optional)</label>
                <textarea value={mlNotes} onChange={e => setMlNotes(e.target.value)} placeholder="Project details, budget, timeline…" rows={3}
                  style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>

              {mlErr && <div style={{ fontSize: 12.5, color: C.danger, fontWeight: 600 }}>{mlErr}</div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                <button onClick={() => setShowAdd(false)} disabled={mlBusy}
                  style={{ background: 'transparent', border: `1px solid ${C.cardBorder}`, color: C.label, padding: '10px 16px', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                <button onClick={submitManual} disabled={mlBusy}
                  style={{ background: BRAND, color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: mlBusy ? 0.6 : 1 }}>
                  {mlBusy ? 'Adding…' : 'Add Lead'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SPIN PANEL */}
      {spinLead && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
          <div style={{ background: C.cardBg, borderRadius: 14, padding: 22, width: 460, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', border: `1px solid ${C.cardBorder}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 3 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: C.title, display: 'flex', alignItems: 'center', gap: 7 }}>
                <i className="ti ti-refresh" style={{ fontSize: 18, color: C.green }} /> Spin — find a company
              </h3>
              <button onClick={() => { setSpinLead(null) }} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
            <p style={{ fontSize: 12, color: C.sub, marginBottom: 14 }}>
              Lead: <b style={{ color: C.label }}>{spinLead.name || 'Unnamed'}</b> · {spinLead.phone || '—'}
            </p>

            {spinBusy && spinList.length === 0 ? (
              <div style={{ padding: 26, textAlign: 'center', color: C.muted, fontSize: 13 }}>Loading companies…</div>
            ) : !spinCo ? (
              <div style={{ padding: 22, textAlign: 'center', color: C.muted, fontSize: 13 }}>
                <i className="ti ti-mood-empty" style={{ fontSize: 26, display: 'block', marginBottom: 8 }} />
                No more matching companies to call right now.
                <div style={{ marginTop: 12 }}>
                  <button onClick={refetchSpin} style={{ background: C.chipBg, border: 'none', color: C.label, padding: '8px 16px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Refresh</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: 16, background: C.listBg }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.name, marginBottom: 4 }}>{spinCo.name}</div>
                  <div style={{ fontSize: 12, color: C.sub, marginBottom: 10 }}>
                    {spinCo.category || '—'}{spinCo.area ? ' · ' + spinCo.area : ''}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: BRAND, letterSpacing: '0.5px', marginBottom: 14 }}>
                    {spinCo.phone || '—'}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <a href={`tel:${(spinCo.phone || '').replace(/\s/g, '')}`} onClick={() => spinMark('called')}
                      style={{ flex: 1, minWidth: 120, textAlign: 'center', textDecoration: 'none', background: BRAND, color: '#fff', padding: '10px', borderRadius: 9, fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <i className="ti ti-phone" style={{ fontSize: 15 }} /> Call
                    </a>
                    <button onClick={spinNext} disabled={spinBusy}
                      style={{ flex: 1, minWidth: 100, background: C.chipBg, border: 'none', color: C.label, padding: '10px', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <i className="ti ti-player-skip-forward" style={{ fontSize: 15 }} /> Next
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button onClick={() => spinMark('claimed')} disabled={spinBusy}
                      style={{ flex: 1, background: C.greenBg, border: `1px solid ${C.green}55`, color: C.green, padding: '10px', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <i className="ti ti-check" style={{ fontSize: 15 }} /> Claimed
                    </button>
                    <button onClick={() => spinMark('declined')} disabled={spinBusy}
                      style={{ flex: 1, background: C.dangerBg, border: `1px solid ${C.danger}55`, color: C.danger, padding: '10px', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <i className="ti ti-x" style={{ fontSize: 15 }} /> Declined
                    </button>
                  </div>
                  <div style={{ textAlign: 'center', fontSize: 11, color: C.muted, marginTop: 10 }}>
                    Company {spinIdx + 1} of {spinList.length} in this batch
                  </div>
                </div>

                {spinHist.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Call history</div>
                    {spinHist.map((h, i) => (
                      <div key={h.company_id || i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 0', borderTop: i > 0 ? `1px solid ${C.rowBorder}` : 'none' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: C.label, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</div>
                          <div style={{ fontSize: 10.5, color: C.muted }}>{h.phone || '—'}</div>
                        </div>
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: statusColor(h.status), textTransform: 'capitalize', flexShrink: 0 }}>{h.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* EDIT LEAD MODAL */}
      {editLead && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
          <div style={{ background: C.cardBg, borderRadius: 14, padding: 24, width: 500, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', border: `1px solid ${C.cardBorder}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: C.title }}>Edit Lead</h3>
              <button onClick={() => setEditLead(null)} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={lbl}>Customer Name *</label>
                <input value={edName} onChange={e => setEdName(e.target.value)} style={inp} />
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label style={lbl}>Phone / WhatsApp *</label>
                  <input value={edPhone} onChange={e => setEdPhone(e.target.value)} style={inp} />
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label style={lbl}>Email</label>
                  <input value={edEmail} onChange={e => setEdEmail(e.target.value)} style={inp} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label style={lbl}>Category</label>
                  <select value={edCat} onChange={e => setEdCat(e.target.value)} style={inp}>
                    <option value="">Select category…</option>
                    {cats.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label style={lbl}>Area</label>
                  <select value={edArea} onChange={e => setEdArea(e.target.value)} style={inp}>
                    <option value="">Select area…</option>
                    {DUBAI_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={lbl}>Notes</label>
                <textarea value={edNotes} onChange={e => setEdNotes(e.target.value)} rows={2} style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>

              {/* Assigned companies */}
              <div>
                <label style={lbl}>Assigned Companies</label>
                <div style={{ border: `1px solid ${C.cardBorder}`, borderRadius: 8, padding: 8, background: C.inputBg }}>
                  {edCompanies.length === 0 && <div style={{ fontSize: 12, color: C.muted, padding: 4 }}>No companies assigned yet.</div>}
                  {edCompanies.map(co => (
                    <div key={co.company_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '5px 4px' }}>
                      <span style={{ fontSize: 12.5, color: C.label }}>{co.name} <span style={{ color: C.muted, fontSize: 10.5 }}>· {co.status}</span></span>
                      <button onClick={() => removeEdCompany(co.company_id)} disabled={edBusy} title="Remove"
                        style={{ background: 'transparent', border: 'none', color: C.danger, cursor: 'pointer', fontSize: 14 }}>✕</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add more companies */}
              <div>
                <label style={lbl}>Add Companies</label>
                <div style={{ maxHeight: 140, overflowY: 'auto', border: `1px solid ${C.cardBorder}`, borderRadius: 8, padding: 6, background: C.inputBg }}>
                  {assignCos.filter(co => !edCompanies.some(e => e.company_id === co.id)).map(co => {
                    const on = edAddCos.includes(co.id)
                    return (
                      <label key={co.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px', cursor: 'pointer', borderRadius: 6, background: on ? C.selBg : 'transparent' }}>
                        <input type="checkbox" checked={on} onChange={() => toggleEdAddCo(co.id)} style={{ width: 15, height: 15, accentColor: BRAND, cursor: 'pointer' }} />
                        <span style={{ fontSize: 12.5, color: C.label }}>{co.name}{co.category ? ' · ' + co.category : ''}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {edErr && <div style={{ fontSize: 12.5, color: C.danger, fontWeight: 600 }}>{edErr}</div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                <button onClick={() => setEditLead(null)} disabled={edBusy}
                  style={{ background: 'transparent', border: `1px solid ${C.cardBorder}`, color: C.label, padding: '10px 16px', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                <button onClick={submitEdit} disabled={edBusy}
                  style={{ background: BRAND, color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: edBusy ? 0.6 : 1 }}>
                  {edBusy ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
