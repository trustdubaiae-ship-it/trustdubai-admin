// trustdubai-admin/src/pages/VerificationQueue.jsx
import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

const BRAND = '#0099cc'
const BUCKET = 'verification-docs'

// Checklist items per document
const CHECKLIST = {
  trade_license: [
    { key: 'name_match',   label: 'Company name matches license' },
    { key: 'number_match', label: 'License number matches' },
    { key: 'valid',        label: 'License valid (not expired)' },
    { key: 'clear',        label: 'Document clear & readable' },
  ],
  owner_eid: [
    { key: 'name_match', label: 'Owner name matches' },
    { key: 'number',     label: 'EID number readable' },
    { key: 'not_expired',label: 'Not expired' },
    { key: 'clear',      label: 'Document clear & readable' },
  ],
}

export default function VerificationQueue({ theme, adminData }) {
  const isDark = theme === 'dark'
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [confirmFor, setConfirmFor] = useState(null) // company being submitted

  // per-company local checklist state: { [companyId]: { trade_license:{...}, owner_eid:{...} } }
  const [checks, setChecks] = useState({})

  const C = {
    title: isDark ? '#f0fdf4' : '#0f172a',
    sub:   isDark ? '#94a3b8' : '#64748b',
    cardBg: isDark ? '#161b22' : '#ffffff',
    cardBorder: isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0',
    rowBorder:  isDark ? 'rgba(255,255,255,0.06)' : '#eef2f6',
    name:  isDark ? '#f0fdf4' : '#0f172a',
    label: isDark ? '#e5e7eb' : '#334155',
    muted: isDark ? '#6b7280' : '#94a3b8',
  }

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('companies')
      .select('id, name, owner_email, trade_license_number, trade_license_url, trade_license_status, owner_eid_url, owner_eid_status, phone, phone_verified, verification_percent, verification_status, verification_checklist, verified_by_name')
      .or('trade_license_url.not.is.null,owner_eid_url.not.is.null')
      .order('verification_status', { ascending: true })
    if (!error && data) {
      setRows(data)
      // seed local checks from saved checklist
      const seed = {}
      data.forEach(c => { seed[c.id] = c.verification_checklist || {} })
      setChecks(seed)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

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

  // Returns 'approved' | 'rejected' | 'incomplete' for a doc
  function docVerdict(companyId, docKind, hasDoc) {
    if (!hasDoc) return 'none'
    const items = CHECKLIST[docKind]
    const state = (checks[companyId] || {})[docKind] || {}
    const answered = items.filter(it => state[it.key] === true || state[it.key] === false)
    if (answered.length < items.length) return 'incomplete'
    const anyFail = items.some(it => state[it.key] === false)
    return anyFail ? 'rejected' : 'approved'
  }

  function openConfirm(company) {
    // validate: every uploaded doc fully checked
    const tlVerdict  = docVerdict(company.id, 'trade_license', !!company.trade_license_url)
    const eidVerdict = docVerdict(company.id, 'owner_eid', !!company.owner_eid_url)
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
    if (company.owner_eid_url)     patch.owner_eid_status     = (eidVerdict === 'approved') ? 'approved' : 'rejected'

    // build rejection reason from failed items
    const fails = []
    ;['trade_license', 'owner_eid'].forEach(dk => {
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
      // Email (Step C) — will hook here later
      setConfirmFor(null)
      await load()
      alert(fails.length ? 'Submitted — company notified of items needing correction.' : 'Submitted — company verified and notified.')
    } else {
      alert('Error: ' + error.message)
    }
    setBusy('')
  }

  if (loading) return <div style={{ padding: 24, color: C.sub }}>Loading queue…</div>

  return (
    <div style={{ padding: 24, maxWidth: 1000 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4, color: C.title }}>Company Verification Queue</h1>
      <p style={{ color: C.sub, marginBottom: 20, fontSize: 14 }}>
        Check each detail, then confirm. The company is notified by email automatically.
      </p>

      {rows.length === 0 && (
        <div style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: 24, color: C.sub }}>
          No submissions yet.
        </div>
      )}

      {rows.map((c) => {
        const verified = c.verification_status === 'verified'
        return (
          <div key={c.id} style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: C.name }}>{c.name || 'Unnamed company'}</div>
                <div style={{ fontSize: 13, color: C.muted }}>{c.owner_email}</div>
                {c.verified_by_name && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Last reviewed by: {c.verified_by_name}</div>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: BRAND, fontWeight: 700 }}>{c.verification_percent ?? 0}% / 22%</span>
                <span style={{
                  background: verified ? 'rgba(26,127,75,0.15)' : 'rgba(184,134,11,0.15)',
                  color: verified ? '#1a7f4b' : '#b8860b',
                  padding: '4px 12px', borderRadius: 16, fontSize: 12, fontWeight: 600,
                }}>
                  {verified ? '✓ Verified' : 'Not verified'}
                </span>
              </div>
            </div>

            <DocChecklist
              C={C} companyId={c.id} docKind="trade_license"
              title="Trade License" number={c.trade_license_number}
              url={c.trade_license_url} state={(checks[c.id] || {}).trade_license || {}}
              onView={viewDoc} onToggle={toggleCheck}
            />

            <DocChecklist
              C={C} companyId={c.id} docKind="owner_eid"
              title="Owner Emirates ID" url={c.owner_eid_url}
              state={(checks[c.id] || {}).owner_eid || {}}
              onView={viewDoc} onToggle={toggleCheck}
            />

            {/* Phone */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: `1px solid ${C.rowBorder}` }}>
              <div>
                <span style={{ fontWeight: 600, color: C.label }}>Phone</span>
                <span style={{ color: BRAND, marginLeft: 8, fontSize: 12, fontWeight: 600 }}>+5%</span>
                <span style={{ marginLeft: 10, fontSize: 13, color: C.muted }}>{c.phone || '—'}</span>
              </div>
              <button
                onClick={async () => {
                  setBusy(c.id + 'phone')
                  const nv = !c.phone_verified
                  const p = { phone_verified: nv }
                  if (nv) p.phone_verified_at = new Date().toISOString()
                  await supabase.from('companies').update(p).eq('id', c.id)
                  await load(); setBusy('')
                }}
                disabled={busy === c.id + 'phone'}
                style={{ background: c.phone_verified ? 'rgba(248,113,113,0.15)' : BRAND, color: c.phone_verified ? '#dc2626' : '#fff', border: 'none', padding: '7px 14px', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                {c.phone_verified ? 'Mark Unverified' : 'Mark Verified'}
              </button>
            </div>

            {/* Submit */}
            <div style={{ borderTop: `1px solid ${C.rowBorder}`, paddingTop: 14, marginTop: 6, textAlign: 'right' }}>
              <button onClick={() => openConfirm(c)} disabled={busy === c.id}
                style={{ background: '#1a7f4b', color: '#fff', border: 'none', padding: '9px 20px', borderRadius: 8, fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>
                Submit Verification
              </button>
            </div>
          </div>
        )
      })}

      {/* Confirm popup */}
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
                style={{ background: 'transparent', border: `1px solid ${C.cardBorder}`, color: C.label, padding: '9px 16px', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={submitVerification} disabled={busy === confirmFor.company.id}
                style={{ background: BRAND, color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                Confirm & Notify Company
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DocChecklist({ C, companyId, docKind, title, number, url, state, onView, onToggle }) {
  const items = CHECKLIST[docKind]
  return (
    <div style={{ padding: '12px 0', borderTop: `1px solid ${C.rowBorder}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <div>
          <span style={{ fontWeight: 600, color: C.label }}>{title}</span>
          {number && <span style={{ marginLeft: 10, fontSize: 13, color: C.muted }}>#{number}</span>}
        </div>
        {url
          ? <button onClick={() => onView(url)} style={{ background: 'transparent', border: `1px solid ${C.cardBorder}`, color: C.label, padding: '6px 12px', borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>View document</button>
          : <span style={{ fontSize: 13, color: C.muted }}>Not uploaded</span>}
      </div>

      {url && items.map(it => {
        const val = state[it.key]
        return (
          <div key={it.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
            <span style={{ fontSize: 13, color: C.label }}>{it.label}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => onToggle(companyId, docKind, it.key, true)}
                style={{ width: 30, height: 28, borderRadius: 7, border: 'none', cursor: 'pointer', fontWeight: 700, background: val === true ? '#1a7f4b' : (C.cardBg === '#161b22' ? 'rgba(255,255,255,0.06)' : '#eef2f6'), color: val === true ? '#fff' : C.muted }}>✓</button>
              <button onClick={() => onToggle(companyId, docKind, it.key, false)}
                style={{ width: 30, height: 28, borderRadius: 7, border: 'none', cursor: 'pointer', fontWeight: 700, background: val === false ? '#c0392b' : (C.cardBg === '#161b22' ? 'rgba(255,255,255,0.06)' : '#eef2f6'), color: val === false ? '#fff' : C.muted }}>✗</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
