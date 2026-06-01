import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const STATUS = {
  pending:  { label: 'Pending',  bg: 'rgba(251,191,36,0.15)',  fg: '#fbbf24' },
  verified: { label: 'Verified', bg: 'rgba(74,222,128,0.15)',  fg: '#4ade80' },
  rejected: { label: 'Rejected', bg: 'rgba(248,113,113,0.15)', fg: '#f87171' },
}

export default function DocumentVerification({ theme, adminData }) {
  const isDark = theme === 'dark'
  const [rows, setRows] = useState([])
  const [docMeta, setDocMeta] = useState({})
  const [companies, setCompanies] = useState({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [reviewRow, setReviewRow] = useState(null)

  const C = {
    card:    isDark ? '#161b22' : '#ffffff',
    border:  isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0',
    text:    isDark ? '#f0fdf4' : '#0f172a',
    sub:     isDark ? '#9ca3af' : '#64748b',
    muted:   isDark ? '#6b7280' : '#94a3b8',
    bg2:     isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
    green:   '#22c55e',
  }

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: meta } = await supabase.from('verification_documents').select('*')
    const mm = {}; (meta || []).forEach(m => { mm[m.doc_key] = m }); setDocMeta(mm)
    const { data: docs } = await supabase
      .from('company_documents').select('*').order('uploaded_at', { ascending: false })
    setRows(docs || [])
    const ids = [...new Set((docs || []).map(d => d.company_id))]
    if (ids.length) {
      const { data: comps } = await supabase.from('companies').select('id, name, slug, logo_url').in('id', ids)
      const cm = {}; (comps || []).forEach(c => { cm[c.id] = c }); setCompanies(cm)
    }
    setLoading(false)
  }

  function expiryInfo(dateStr) {
    if (!dateStr) return null
    const today = new Date(); today.setHours(0,0,0,0)
    const exp = new Date(dateStr); exp.setHours(0,0,0,0)
    const days = Math.round((exp - today) / 86400000)
    return { days, expired: days < 0 }
  }

  const counts = {
    pending:  rows.filter(r => r.status === 'pending').length,
    verified: rows.filter(r => r.status === 'verified').length,
    rejected: rows.filter(r => r.status === 'rejected').length,
    all:      rows.length,
  }
  const filtered = filter === 'all' ? rows : rows.filter(r => r.status === filter)

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: 0 }}>Document Verification</h1>
        <p style={{ fontSize: 13, color: C.sub, margin: '4px 0 0' }}>Review and verify uploaded business documents. Approve only after checking every detail against the document.</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[['pending','Pending'],['verified','Verified'],['rejected','Rejected'],['all','All']].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            style={{ padding: '6px 14px', borderRadius: 8, border: `0.5px solid ${filter===k ? C.green : C.border}`, background: filter===k ? 'rgba(34,197,94,0.12)' : C.card, color: filter===k ? C.green : C.sub, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {l} {k !== 'all' && <span style={{ opacity: 0.7 }}>({counts[k]})</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 50, color: C.muted }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 50, color: C.muted, background: C.card, borderRadius: 12, border: `0.5px solid ${C.border}` }}>No documents in this view.</div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {filtered.map(row => {
            const meta = docMeta[row.doc_key]
            const comp = companies[row.company_id]
            const exp = expiryInfo(row.doc_expiry)
            const st = STATUS[row.status] || STATUS.pending
            return (
              <div key={row.id} style={{ background: C.card, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 9, background: C.bg2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: C.muted, flexShrink: 0 }}>
                  <i className="ti ti-file-certificate" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{meta?.label || row.doc_key}</div>
                  <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>
                    {comp?.name || '—'} · No. {row.doc_number || '—'}
                    {exp && <span style={{ marginLeft: 6, color: exp.expired ? '#f87171' : exp.days <= 30 ? '#fbbf24' : C.muted, fontWeight: 600 }}>{exp.expired ? '· Expired' : `· Expires in ${exp.days}d`}</span>}
                  </div>
                </div>
                <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: st.bg, color: st.fg }}>{st.label}</span>
                <button onClick={() => setReviewRow(row)} style={{ flexShrink: 0, padding: '7px 14px', borderRadius: 8, border: 'none', background: C.green, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Review</button>
              </div>
            )
          })}
        </div>
      )}

      {reviewRow && (
        <ReviewModal
          row={reviewRow}
          meta={docMeta[reviewRow.doc_key]}
          company={companies[reviewRow.company_id]}
          adminData={adminData}
          C={C}
          isDark={isDark}
          onClose={() => setReviewRow(null)}
          onDone={() => { setReviewRow(null); load() }}
        />
      )}
    </div>
  )
}

/* ---------- Review + Forced Verification Modal ---------- */
function ReviewModal({ row, meta, company, adminData, C, isDark, onClose, onDone }) {
  const [chkNumber, setChkNumber] = useState(false)
  const [chkExpiry, setChkExpiry] = useState(false)
  const [chkGenuine, setChkGenuine] = useState(false)
  const [chkTerms, setChkTerms] = useState(false)
  const [saving, setSaving] = useState(false)

  const allChecked = chkNumber && chkExpiry && chkGenuine && chkTerms
  const isPdf = row.file_url && row.file_url.toLowerCase().endsWith('.pdf')

  function expiryStr() {
    if (!row.doc_expiry) return '—'
    const d = new Date(row.doc_expiry)
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  async function approve() {
    if (!allChecked) return
    setSaving(true)
    const { error } = await supabase.from('company_documents').update({
      status: 'verified',
      verified_at: new Date().toISOString(),
      verified_by: adminData?.full_name || adminData?.email || 'admin',
    }).eq('id', row.id)
    setSaving(false)
    if (!error) onDone()
  }

  async function reject() {
    setSaving(true)
    const { error } = await supabase.from('company_documents').update({
      status: 'rejected',
      verified_at: new Date().toISOString(),
      verified_by: adminData?.full_name || adminData?.email || 'admin',
    }).eq('id', row.id)
    setSaving(false)
    if (!error) onDone()
  }

  const lbl = { fontSize: 11, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }
  const val = { fontSize: 14, color: C.text, fontWeight: 700, marginTop: 2 }

  const CheckRow = ({ checked, set, children }) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', borderRadius: 9, border: `0.5px solid ${checked ? C.green : C.border}`, background: checked ? 'rgba(34,197,94,0.08)' : C.bg2, cursor: 'pointer', marginBottom: 8 }}>
      <input type="checkbox" checked={checked} onChange={e => set(e.target.checked)} style={{ width: 17, height: 17, accentColor: C.green, cursor: 'pointer' }} />
      <span style={{ fontSize: 12.5, color: C.text, fontWeight: 500 }}>{children}</span>
    </label>
  )

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.card, borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto', padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: C.text, margin: 0 }}>{meta?.label || row.doc_key}</h3>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', background: C.bg2, border: `0.5px solid ${C.border}`, color: C.sub, cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>

        {/* document image / pdf */}
        <div style={{ background: '#000', borderRadius: 10, overflow: 'hidden', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
          {row.file_url ? (
            isPdf
              ? <a href={row.file_url} target="_blank" rel="noopener noreferrer" style={{ padding: 30, color: '#4ade80', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}><i className="ti ti-file-text" /> Open PDF in new tab</a>
              : <img src={row.file_url} alt="" style={{ maxWidth: '100%', maxHeight: 280, objectFit: 'contain' }} />
          ) : <span style={{ color: '#666', fontSize: 13, padding: 30 }}>No file uploaded</span>}
        </div>

        {/* details */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div><div style={lbl}>Company</div><div style={val}>{company?.name || '—'}</div></div>
          <div><div style={lbl}>Document Number</div><div style={val}>{row.doc_number || '—'}</div></div>
          <div><div style={lbl}>Expiry Date</div><div style={val}>{expiryStr()}</div></div>
          <div><div style={lbl}>Submitted</div><div style={val}>{new Date(row.uploaded_at).toLocaleDateString('en-GB')}</div></div>
        </div>

        {/* warning */}
        <div style={{ background: 'rgba(251,191,36,0.1)', border: '0.5px solid rgba(251,191,36,0.3)', borderRadius: 9, padding: '10px 12px', marginBottom: 14, fontSize: 12, color: isDark ? '#fcd34d' : '#92400e', lineHeight: 1.5 }}>
          <i className="ti ti-alert-triangle" /> Carefully match every detail against the actual document before approving.
        </div>

        {/* forced checklist */}
        <CheckRow checked={chkNumber} set={setChkNumber}>Document number matches the file</CheckRow>
        <CheckRow checked={chkExpiry} set={setChkExpiry}>Expiry date matches the file</CheckRow>
        <CheckRow checked={chkGenuine} set={setChkGenuine}>Document is genuine and clearly readable</CheckRow>
        <CheckRow checked={chkTerms} set={setChkTerms}>I have checked all the details and documents before approval</CheckRow>

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={reject} disabled={saving} style={{ flex: 1, padding: 12, borderRadius: 9, border: '0.5px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.12)', color: '#f87171', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Reject</button>
          <button onClick={approve} disabled={!allChecked || saving}
            style={{ flex: 2, padding: 12, borderRadius: 9, border: 'none', background: allChecked ? C.green : (isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'), color: allChecked ? '#fff' : C.muted, fontSize: 13, fontWeight: 700, cursor: allChecked ? 'pointer' : 'not-allowed', transition: 'all .2s' }}>
            {saving ? 'Saving…' : allChecked ? '✓ Approve & Verify' : 'Tick all to approve'}
          </button>
        </div>
      </div>
    </div>
  )
}
