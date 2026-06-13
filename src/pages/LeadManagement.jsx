// trustdubai-admin/src/pages/LeadManagement.jsx
import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

const BRAND = '#0099cc'
const PAGE = 25

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
  }

  async function load() {
    setLoading(true)
    const [{ data: leads }, { data: comps }] = await Promise.all([
      supabase.from('lead_submissions')
        .select('id, company_id, name, phone, email, status, source, created_at')
        .order('created_at', { ascending: false }),
      supabase.from('companies').select('id, name'),
    ])
    const map = {}
    ;(comps || []).forEach(c => { map[c.id] = c.name })
    setCompanies(map)
    setRows(leads || [])
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

  if (loading) return <div style={{ padding: 24, color: C.sub }}>Loading leads…</div>

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4, color: C.title }}>Lead Management</h1>
      <p style={{ color: C.sub, marginBottom: 16, fontSize: 14 }}>
        Search, review and delete leads across all companies. Deleting a lead also removes its projects, quotations, distributions, chat and activity.
      </p>

      {/* SEARCH + TABS */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
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

      {/* CONFIRM POPUP */}
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
    </div>
  )
}
