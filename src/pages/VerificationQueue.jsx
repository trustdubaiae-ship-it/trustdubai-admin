// trustdubai-admin/src/pages/VerificationQueue.jsx
import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

const BRAND = '#0099cc'
const BUCKET = 'verification-docs'

const DOC_STATUS = {
  approved: { bg: '#e6f7ed', color: '#1a7f4b', label: 'Approved' },
  rejected: { bg: '#fdecec', color: '#c0392b', label: 'Rejected' },
  pending:  { bg: '#fff6e6', color: '#b8860b', label: 'Pending' },
}

export default function VerificationQueue() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [signed, setSigned] = useState({}) // path -> url

  async function load() {
    setLoading(true)
    // Jin companies ne kuch na kuch submit kiya hai (doc ya phone pending)
    const { data, error } = await supabase
      .from('companies')
      .select('id, name, owner_email, trade_license_number, trade_license_url, trade_license_status, owner_eid_url, owner_eid_status, phone, phone_verified, verification_percent, verification_status')
      .or('trade_license_url.not.is.null,owner_eid_url.not.is.null')
      .order('verification_status', { ascending: true })
    if (!error && data) setRows(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function viewDoc(path) {
    if (!path) return
    if (signed[path]) { window.open(signed[path], '_blank'); return }
    const { data, error } = await supabase.storage
      .from(BUCKET).createSignedUrl(path, 120)
    if (!error && data?.signedUrl) {
      setSigned((s) => ({ ...s, [path]: data.signedUrl }))
      window.open(data.signedUrl, '_blank')
    }
  }

  async function setDocStatus(company, kind, status) {
    // kind: 'trade_license' | 'owner_eid', status: 'approved' | 'rejected'
    let reason = null
    if (status === 'rejected') {
      reason = window.prompt('Rejection reason (company ko dikhega):', '')
      if (reason === null) return
    }
    setBusy(company.id + kind)
    const statusCol = kind === 'trade_license' ? 'trade_license_status' : 'owner_eid_status'
    const patch = { [statusCol]: status }
    if (status === 'rejected') patch.rejection_reason = reason

    const { error } = await supabase.from('companies').update(patch).eq('id', company.id)
    if (!error) {
      await supabase.from('verification_log').insert({
        company_id: company.id, target: kind, action: status, reason,
      })
      await load()
    } else {
      alert('Error: ' + error.message)
    }
    setBusy('')
  }

  async function togglePhone(company) {
    setBusy(company.id + 'phone')
    const newVal = !company.phone_verified
    const patch = { phone_verified: newVal }
    if (newVal) patch.phone_verified_at = new Date().toISOString()
    const { error } = await supabase.from('companies').update(patch).eq('id', company.id)
    if (!error) {
      await supabase.from('verification_log').insert({
        company_id: company.id, target: 'phone',
        action: newVal ? 'approve' : 'reject',
      })
      await load()
    } else {
      alert('Error: ' + error.message)
    }
    setBusy('')
  }

  if (loading) return <div style={{ padding: 24 }}>Loading queue…</div>

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Company Verification Queue</h1>
      <p style={{ color: '#667', marginBottom: 20 }}>
        Approve / reject documents. Phone is verified manually. Score auto-updates.
      </p>

      {rows.length === 0 && (
        <div style={{ background: '#fff', border: '1px solid #e6e9ee', borderRadius: 12, padding: 24, color: '#778' }}>
          No submissions yet.
        </div>
      )}

      {rows.map((c) => {
        const verified = c.verification_status === 'verified'
        return (
          <div key={c.id} style={{ background: '#fff', border: '1px solid #e6e9ee', borderRadius: 12, padding: 18, marginBottom: 16 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{c.name || 'Unnamed company'}</div>
                <div style={{ fontSize: 13, color: '#778' }}>{c.owner_email}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: BRAND, fontWeight: 700 }}>{c.verification_percent ?? 0}% / 22%</span>
                <span style={{
                  background: verified ? '#e6f7ed' : '#fff6e6',
                  color: verified ? '#1a7f4b' : '#b8860b',
                  padding: '4px 12px', borderRadius: 16, fontSize: 12, fontWeight: 600,
                }}>
                  {verified ? '✓ Verified' : 'Not verified'}
                </span>
              </div>
            </div>

            {/* Trade License */}
            <DocRow
              title="Trade License" weight={10} required
              number={c.trade_license_number} status={c.trade_license_status}
              url={c.trade_license_url} onView={viewDoc}
              onApprove={() => setDocStatus(c, 'trade_license', 'approved')}
              onReject={() => setDocStatus(c, 'trade_license', 'rejected')}
              busy={busy === c.id + 'trade_license'}
            />

            {/* Owner EID */}
            <DocRow
              title="Owner Emirates ID" weight={7}
              status={c.owner_eid_status} url={c.owner_eid_url} onView={viewDoc}
              onApprove={() => setDocStatus(c, 'owner_eid', 'approved')}
              onReject={() => setDocStatus(c, 'owner_eid', 'rejected')}
              busy={busy === c.id + 'owner_eid'}
            />

            {/* Phone */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '1px solid #f0f2f5' }}>
              <div>
                <span style={{ fontWeight: 600 }}>Phone</span>
                <span style={{ color: BRAND, marginLeft: 8, fontSize: 12, fontWeight: 600 }}>+5%</span>
                <span style={{ marginLeft: 10, fontSize: 13, color: '#778' }}>{c.phone || '—'}</span>
              </div>
              <button
                onClick={() => togglePhone(c)}
                disabled={busy === c.id + 'phone'}
                style={{
                  background: c.phone_verified ? '#fdecec' : BRAND, color: '#fff',
                  border: 'none', padding: '7px 14px', borderRadius: 8, fontWeight: 600,
                  fontSize: 13, cursor: 'pointer',
                }}>
                {c.phone_verified ? 'Mark Unverified' : 'Mark Verified'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DocRow({ title, weight, required, number, status, url, onView, onApprove, onReject, busy }) {
  const st = DOC_STATUS[status] || DOC_STATUS.pending
  return (
    <div style={{ padding: '12px 0', borderTop: '1px solid #f0f2f5' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <span style={{ fontWeight: 600 }}>{title}</span>
          {required
            ? <span style={{ color: '#c0392b', marginLeft: 6, fontSize: 12 }}>*</span>
            : <span style={{ color: '#999', marginLeft: 6, fontSize: 12 }}>(optional)</span>}
          <span style={{ color: BRAND, marginLeft: 8, fontSize: 12, fontWeight: 600 }}>+{weight}%</span>
          {number && <span style={{ marginLeft: 10, fontSize: 13, color: '#778' }}>#{number}</span>}
        </div>
        <span style={{ background: st.bg, color: st.color, padding: '4px 10px', borderRadius: 16, fontSize: 12, fontWeight: 600 }}>
          {st.label}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        {url ? (
          <>
            <button onClick={() => onView(url)} style={btnGhost}>View document</button>
            <button onClick={onApprove} disabled={busy} style={btnApprove}>Approve</button>
            <button onClick={onReject} disabled={busy} style={btnReject}>Reject</button>
          </>
        ) : (
          <span style={{ fontSize: 13, color: '#aab' }}>Not uploaded yet</span>
        )}
      </div>
    </div>
  )
}

const btnGhost = { background: '#fff', border: '1px solid #d8dde4', color: '#334', padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const btnApprove = { background: '#1a7f4b', border: 'none', color: '#fff', padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const btnReject = { background: '#c0392b', border: 'none', color: '#fff', padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }
