// trustdubai-admin/src/pages/VerificationQueue.jsx
import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

const BRAND = '#0099cc'
const BUCKET = 'verification-docs'
const PAGE = 20

const CHECKLIST = {
  trade_license: [
    { key: 'name_match',   label: 'Company name matches license' },
    { key: 'number_match', label: 'License number matches' },
    { key: 'valid',        label: 'License valid (not expired)' },
    { key: 'clear',        label: 'Document clear & readable' },
  ],
  owner_eid: [
    { key: 'name_match', label: 'Owner name matches' },
    { key: 'number',     label: 'EID number matches photo' },
    { key: 'not_expired',label: 'Expiry matches photo (not expired)' },
    { key: 'clear',      label: 'Document clear & readable' },
  ],
}

function isImagePath(p) {
  if (!p) return false
  const ext = (p.split('.').pop() || '').toLowerCase()
  return ['jpg','jpeg','png','webp','gif'].includes(ext)
}

function classify(c) {
  if (c.verification_status === 'verified') return 'verified'
  if (c.trade_license_status === 'rejected' || c.owner_eid_status === 'rejected') return 'rejected'
  return 'pending'
}

export default function VerificationQueue({ theme, adminData }) {
  const isDark = theme === 'dark'
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [confirmFor, setConfirmFor] = useState(null)
  const [checks, setChecks] = useState({})

  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('pending')
  const [selectedId, setSelectedId] = useState(null)
  const [visible, setVisible] = useState(PAGE)
  const [previews, setPreviews] = useState({})

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
  }

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('companies')
      .select('id, name, owner_email, trade_license_number, trade_license_url, trade_license_status, owner_eid_url, owner_eid_status, owner_eid_number, owner_eid_expiry, owner_eid_front_url, owner_eid_back_url, phone, phone_verified, verification_percent, verification_status, verification_checklist, verified_by_name')
      .or('trade_license_url.not.is.null,owner_eid_url.not.is.null,owner_eid_front_url.not.is.null')
      .order('verification_status', { ascending: true })
    if (!error && data) {
      setRows(data)
      const seed = {}
      data.forEach(c => { seed[c.id] = c.verification_checklist || {} })
      setChecks(seed)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // load signed-url previews for the selected company
  useEffect(() => {
    const c = rows.find(r => r.id === selectedId)
    if (!c) { setPreviews({}); return }
    let cancelled = false
    async function go() {
      async function signed(path) {
        if (!path || !isImagePath(path)) return null
        const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 600)
        return data?.signedUrl || null
      }
      const tl = await signed(c.trade_license_url)
      const front = await signed(c.owner_eid_front_url || c.owner_eid_url)
      const back = await signed(c.owner_eid_back_url)
      if (!cancelled) setPreviews({ tl, front, back })
    }
    go()
    return () => { cancelled = true }
  }, [selectedId, rows])

  async function viewDoc(path) {
    if (!path) return
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 120)
    if (!error && data?.signedUrl) window.open(data.signedUrl, '_blank')
    else alert('Could not open document.')
  }

  function toggleCheck(companyId, docKind, itemKey, value) {
    setChecks(prev => ({
      ...prev,
      [companyId]: {
        ...(prev[companyId] || {}),
        [docKind]: { ...((prev[companyId] || {})[docKind] || {}), [itemKey]: value },
      },
    }))
  }

  function docVerdict(companyId, docKind, hasDoc) {
    if (!hasDoc) return 'none'
    const items = CHECKLIST[docKind]
    const state = (checks[companyId] || {})[docKind] || {}
    const answered = items.filter(it => state[it.key] === true || state[it.key] === false)
    if (answered.length < items.length) return 'incomplete'
    const anyFail = items.some(it => state[it.key] === false)
    return anyFail ? 'rejected' : 'approved'
  }

  function eidHasDoc(c) { return !!(c.owner_eid_front_url || c.owner_eid_url) }

  function openConfirm(company) {
    const tlVerdict  = docVerdict(company.id, 'trade_license', !!company.trade_license_url)
    const eidVerdict = docVerdict(company.id, 'owner_eid', eidHasDoc(company))
    if (tlVerdict === 'incomplete' || eidVerdict === 'incomplete') {
      alert('Please complete the checklist for all uploaded documents before submitting.')
      return
    }
    setConfirmFor({ company, tlVerdict, eidVerdict })
  }

  async function submitVerification() {
    const { company, tlVerdict, eidVerdict } = confirmFor
    setBusy(company.id)
    const patch = {
      verification_checklist: checks[company.id] || {},
      verified_by_name: adminData?.full_name || 'Admin',
    }
    if (company.trade_license_url) patch.trade_license_status = (tlVerdict === 'approved') ? 'approved' : 'rejected'
    if (eidHasDoc(company))        patch.owner_eid_status     = (eidVerdict === 'approved') ? 'approved' : 'rejected'
    const fails = []
    ;['trade_license','owner_eid'].forEach(dk => {
      const state = (checks[company.id] || {})[dk] || {}
      CHECKLIST[dk].forEach(it => { if (state[it.key] === false) fails.push(it.label) })
    })
    if (fails.length) patch.rejection_reason = fails.join('; ')
    const { error } = await supabase.from('companies').update(patch).eq('id', company.id)
    if (!error) {
      await supabase.from('verification_log').insert({
        company_id: company.id, target: 'company',
        action: fails.length ? 'reject' : 'approve',
        reason: fails.length ? patch.rejection_reason : null,
        performed_by: adminData?.id || null,
      })
      setConfirmFor(null)
      await load()
      alert(fails.length ? 'Submitted — company notified of items needing correction.' : 'Submitted — company verified and notified.')
    } else { alert('Error: ' + error.message) }
    setBusy('')
  }

  async function togglePhone(c) {
    setBusy(c.id + 'phone')
    const nv = !c.phone_verified
    const p = { phone_verified: nv }
    if (nv) p.phone_verified_at = new Date().toISOString()
    await supabase.from('companies').update(p).eq('id', c.id)
    await load(); setBusy('')
  }

  // mark helper for list summary
  function mark(status, url) {
    if (!url) return '—'
    if (status === 'approved' || status === 'verified') return '✓'
    if (status === 'rejected') return '✗'
    return '•'
  }

  // counts
  const counts = { pending: 0, verified: 0, rejected: 0, all: rows.length }
  rows.forEach(c => { counts[classify(c)]++ })

  // filtered
  const q = search.trim().toLowerCase()
  const filtered = rows.filter(c => {
    if (tab !== 'all' && classify(c) !== tab) return false
    if (q && !(`${c.name || ''} ${c.owner_email || ''}`.toLowerCase().includes(q))) return false
    return true
  })
  const shown = filtered.slice(0, visible)
  const selected = rows.find(r => r.id === selectedId) || null

  // auto-select first in filtered list
  useEffect(() => {
    if (filtered.length && !filtered.find(r => r.id === selectedId)) {
      setSelectedId(filtered[0].id)
    }
    if (!filtered.length) setSelectedId(null)
  }, [tab, search, rows])

  const TABS = [
    { key: 'pending',  label: 'Pending' },
    { key: 'verified', label: 'Verified' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'all',      label: 'All' },
  ]

  if (loading) return <div style={{ padding: 24, color: C.sub }}>Loading queue…</div>

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4, color: C.title }}>Company Verification Queue</h1>
      <p style={{ color: C.sub, marginBottom: 16, fontSize: 14 }}>
        Check each detail, then confirm. The company is notified by email automatically.
      </p>

      {/* SEARCH + TABS */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 8, background: C.inputBg, border: `1px solid ${C.cardBorder}`, borderRadius: 8, padding: '8px 12px' }}>
          <i className="ti ti-search" style={{ fontSize: 16, color: C.muted }} />
          <input value={search} onChange={e => { setSearch(e.target.value); setVisible(PAGE) }}
            placeholder="Search company name or email…"
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

      {/* SPLIT PANE */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 0, border: `1px solid ${C.cardBorder}`, borderRadius: 12, overflow: 'hidden', background: C.cardBg, minHeight: 460 }}>

        {/* LEFT LIST */}
        <div style={{ borderRight: `1px solid ${C.cardBorder}`, background: C.listBg, maxHeight: 640, overflowY: 'auto' }}>
          {shown.length === 0 && <div style={{ padding: 20, color: C.muted, fontSize: 13 }}>No companies in this view.</div>}
          {shown.map(c => {
            const sel = c.id === selectedId
            return (
              <div key={c.id} onClick={() => setSelectedId(c.id)}
                style={{ padding: '11px 14px', borderBottom: `1px solid ${C.rowBorder}`, cursor: 'pointer',
                  borderLeft: sel ? `3px solid ${BRAND}` : '3px solid transparent', background: sel ? C.selBg : 'transparent' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: sel ? 700 : 600, color: C.name, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name || 'Unnamed'}</span>
                  <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>{c.verification_percent ?? 0}%</span>
                </div>
                <div style={{ fontSize: 11, color: C.sub, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.owner_email}</div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>
                  TL {mark(c.trade_license_status, c.trade_license_url)} · EID {mark(c.owner_eid_status, c.owner_eid_front_url || c.owner_eid_url)} · Ph {c.phone_verified ? '✓' : '—'}
                </div>
              </div>
            )
          })}
          {filtered.length > visible && (
            <div onClick={() => setVisible(v => v + PAGE)} style={{ padding: 13, textAlign: 'center', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: BRAND }}>
              Load more ({visible} of {filtered.length})
            </div>
          )}
        </div>

        {/* RIGHT DETAIL */}
        <div style={{ padding: 18, maxHeight: 640, overflowY: 'auto' }}>
          {!selected ? (
            <div style={{ color: C.muted, fontSize: 14, padding: 30, textAlign: 'center' }}>Select a company from the list.</div>
          ) : (
            <DetailPane
              C={C} isDark={isDark} c={selected} checks={checks} previews={previews}
              busy={busy} onView={viewDoc} onToggle={toggleCheck} onPhone={togglePhone}
              onSubmit={() => openConfirm(selected)} eidHasDoc={eidHasDoc}
            />
          )}
        </div>
      </div>

      {/* CONFIRM POPUP */}
      {confirmFor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
          <div style={{ background: C.cardBg, borderRadius: 14, padding: 24, width: 440, border: `1px solid ${C.cardBorder}` }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: C.title, marginBottom: 8 }}>Confirm Verification</h3>
            <p style={{ fontSize: 13.5, color: C.sub, marginBottom: 12, lineHeight: 1.5 }}>
              {(confirmFor.tlVerdict === 'rejected' || confirmFor.eidVerdict === 'rejected')
                ? 'Some items are marked as issues. The company will be notified to correct them.'
                : 'All checked items look good. The company will be marked Verified and notified by email.'}
            </p>
            <div style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: C.label, marginBottom: 16 }}>
              I confirm I have checked all the information and documents.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setConfirmFor(null)}
                style={{ background: 'transparent', border: `1px solid ${C.cardBorder}`, color: C.label, padding: '9px 16px', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={submitVerification} disabled={busy === confirmFor.company.id}
                style={{ background: BRAND, color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Confirm & Notify Company</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- detail pane ---------- */
function DetailPane({ C, isDark, c, checks, previews, busy, onView, onToggle, onPhone, onSubmit, eidHasDoc }) {
  const verified = c.verification_status === 'verified'
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 17, color: C.name }}>{c.name || 'Unnamed company'}</div>
          <div style={{ fontSize: 13, color: C.muted }}>{c.owner_email}</div>
          {c.verified_by_name && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Last reviewed by: {c.verified_by_name}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: BRAND, fontWeight: 700 }}>{c.verification_percent ?? 0}% / 22%</span>
          <span style={{ background: verified ? 'rgba(26,127,75,0.15)' : 'rgba(184,134,11,0.15)', color: verified ? '#1a7f4b' : '#b8860b', padding: '4px 12px', borderRadius: 16, fontSize: 12, fontWeight: 600 }}>
            {verified ? '✓ Verified' : 'Not verified'}
          </span>
        </div>
      </div>

      {/* TRADE LICENSE */}
      <DocBlock
        C={C} isDark={isDark} c={c} checks={checks} docKind="trade_license" title="Trade License"
        number={c.trade_license_number}
        urls={[{ label: 'View document', path: c.trade_license_url }]}
        thumb={previews.tl} onView={onView} onToggle={onToggle}
      />

      {/* OWNER EID with card previews */}
      <DocBlock
        C={C} isDark={isDark} c={c} checks={checks} docKind="owner_eid" title="Owner Emirates ID"
        number={c.owner_eid_number} expiry={c.owner_eid_expiry}
        urls={[
          { label: 'View front', path: c.owner_eid_front_url || c.owner_eid_url },
          { label: 'View back', path: c.owner_eid_back_url },
        ]}
        eidPreview={{ front: previews.front, back: previews.back,
          frontPath: c.owner_eid_front_url || c.owner_eid_url, backPath: c.owner_eid_back_url }}
        onView={onView} onToggle={onToggle}
      />

      {/* PHONE */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: `1px solid ${C.rowBorder}` }}>
        <div>
          <span style={{ fontWeight: 600, color: C.label }}>Phone</span>
          <span style={{ color: BRAND, marginLeft: 8, fontSize: 12, fontWeight: 600 }}>+5%</span>
          <span style={{ marginLeft: 10, fontSize: 13, color: C.muted }}>{c.phone || '—'}</span>
        </div>
        <button onClick={() => onPhone(c)} disabled={busy === c.id + 'phone'}
          style={{ background: c.phone_verified ? 'rgba(248,113,113,0.15)' : BRAND, color: c.phone_verified ? '#dc2626' : '#fff', border: 'none', padding: '7px 14px', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          {c.phone_verified ? 'Mark Unverified' : 'Mark Verified'}
        </button>
      </div>

      {/* SUBMIT */}
      <div style={{ borderTop: `1px solid ${C.rowBorder}`, paddingTop: 14, marginTop: 6, textAlign: 'right' }}>
        <button onClick={onSubmit} disabled={busy === c.id}
          style={{ background: '#1a7f4b', color: '#fff', border: 'none', padding: '9px 20px', borderRadius: 8, fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>
          Submit Verification
        </button>
      </div>
    </div>
  )
}

/* ---------- one document block ---------- */
function DocBlock({ C, isDark, c, checks, docKind, title, number, expiry, urls, thumb, eidPreview, onView, onToggle }) {
  const items = CHECKLIST[docKind]
  const validUrls = (urls || []).filter(u => u.path)
  const hasDoc = validUrls.length > 0
  const state = (checks[c.id] || {})[docKind] || {}

  let expiryNote = null
  if (expiry) {
    const today = new Date(); today.setHours(0,0,0,0)
    const exp = new Date(expiry)
    const days = Math.round((exp - today) / 86400000)
    if (days < 0) expiryNote = { text: `${expiry} · EXPIRED`, color: '#c0392b' }
    else if (days <= 30) expiryNote = { text: `${expiry} · ${days}d`, color: '#d97706' }
    else expiryNote = { text: expiry, color: C.muted }
  }

  const cardBox = { width: '50%', aspectRatio: '1.586 / 1', borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.cardBorder}`, background: C.listBg, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }

  return (
    <div style={{ padding: '12px 0', borderTop: `1px solid ${C.rowBorder}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <div>
          <span style={{ fontWeight: 600, color: C.label }}>{title}</span>
          {number && <span style={{ marginLeft: 10, fontSize: 13, color: C.muted }}>#{number}</span>}
          {expiryNote && <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 600, color: expiryNote.color }}>Exp: {expiryNote.text}</span>}
        </div>
        {hasDoc ? (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {validUrls.map((u, i) => (
              <button key={i} onClick={() => onView(u.path)} style={{ background: 'transparent', border: `1px solid ${C.cardBorder}`, color: C.label, padding: '6px 12px', borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{u.label}</button>
            ))}
          </div>
        ) : <span style={{ fontSize: 13, color: C.muted }}>Not uploaded</span>}
      </div>

      {/* TL thumbnail */}
      {thumb && (
        <img src={thumb} alt="doc" onClick={() => onView(validUrls[0]?.path)}
          style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover', border: `1px solid ${C.cardBorder}`, cursor: 'pointer', marginBottom: 8 }} />
      )}

      {/* EID front/back card previews */}
      {eidPreview && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          {['front','back'].map(side => {
            const pv = eidPreview[side]
            const path = side === 'front' ? eidPreview.frontPath : eidPreview.backPath
            const isPdf = path && !isImagePath(path)
            return (
              <div key={side} style={cardBox} onClick={() => path && onView(path)}>
                {pv ? <img src={pv} alt={side} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : isPdf ? <div style={{ textAlign: 'center', color: C.muted }}><i className="ti ti-file-text" style={{ fontSize: 24 }} /><div style={{ fontSize: 10, marginTop: 3 }}>PDF</div></div>
                  : <div style={{ textAlign: 'center', color: C.muted }}><i className="ti ti-id" style={{ fontSize: 24 }} /><div style={{ fontSize: 10, marginTop: 3 }}>No {side}</div></div>}
              </div>
            )
          })}
        </div>
      )}

      {hasDoc && items.map(it => {
        const val = state[it.key]
        return (
          <div key={it.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
            <span style={{ fontSize: 13, color: C.label }}>{it.label}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => onToggle(c.id, docKind, it.key, true)}
                style={{ width: 30, height: 28, borderRadius: 7, border: 'none', cursor: 'pointer', fontWeight: 700, background: val === true ? '#1a7f4b' : C.chipBg, color: val === true ? '#fff' : C.muted }}>✓</button>
              <button onClick={() => onToggle(c.id, docKind, it.key, false)}
                style={{ width: 30, height: 28, borderRadius: 7, border: 'none', cursor: 'pointer', fontWeight: 700, background: val === false ? '#c0392b' : C.chipBg, color: val === false ? '#fff' : C.muted }}>✗</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
