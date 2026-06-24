import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const AED = (n) => 'AED ' + Math.round(Number(n) || 0).toLocaleString('en-AE')
const STC = { active: '#22c55e', pending: '#f59e0b', paused: '#94a3b8' }

export default function PartnersPage({ theme }) {
  const dark = theme !== 'light'
  const [partners, setPartners] = useState([])
  const [payouts, setPayouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const [pRes, oRes] = await Promise.all([
      supabase.rpc('admin_partner_overview'),
      supabase.from('qv_partner_payouts').select('*').order('created_at', { ascending: false }),
    ])
    setPartners(pRes.data || [])
    setPayouts(oRes.data || [])
    setLoading(false)
  }
  async function setStatus(id, status) { setBusy(id); await supabase.from('qv_partners').update({ status }).eq('id', id); await load(); setBusy('') }
  async function saveField(id, patch) { await supabase.from('qv_partners').update(patch).eq('id', id); load() }
  async function markPaid(p) {
    setBusy(p.id)
    try {
      // real Stripe Connect transfer to the partner, then mark paid
      const { data, error } = await supabase.functions.invoke('partner-payout', { body: { payoutId: p.id } })
      if (error) { let m = 'Payout failed'; try { m = (await error.context.json())?.error || m } catch {} ; alert(m); return }
      if (!data?.ok) { alert(data?.error || 'Payout failed'); return }
      await load()
    } catch (e) { alert('Payout failed: ' + (e?.message || e)) } finally { setBusy('') }
  }

  const bg = dark ? '#0f172a' : '#f8fafc'
  const cardBg = dark ? '#1e293b' : '#fff'
  const text = dark ? '#e2e8f0' : '#0f172a'
  const sub = dark ? '#94a3b8' : '#64748b'
  const border = dark ? '#334155' : '#e2e8f0'
  const inp = { padding: '6px 8px', borderRadius: 7, border: `1px solid ${border}`, background: dark ? '#0f172a' : '#fff', color: text, fontSize: 13, width: 64 }
  const partnerName = (id) => partners.find(p => p.id === id)?.name || '—'
  const requested = payouts.filter(p => p.status === 'requested')

  return (
    <div style={{ padding: 'clamp(14px,3vw,28px)', background: bg, minHeight: '100vh', color: text }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}><i className="ti ti-friends" /> Partners</h1>
          <div style={{ fontSize: 13, color: sub, marginTop: 2 }}>Resellers, commissions & payouts</div>
        </div>
        <button onClick={load} style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${border}`, background: cardBg, color: text, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}><i className="ti ti-refresh" /> Refresh</button>
      </div>

      {/* payout requests */}
      {requested.length > 0 && (
        <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: '#f59e0b' }}><i className="ti ti-bell-ringing" /> Payout requests ({requested.length})</div>
          {requested.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: `1px solid ${border}`, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 160 }}><b>{partnerName(p.partner_id)}</b><span style={{ color: sub, fontSize: 12 }}> · {p.period || '—'}</span></div>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{AED(p.amount)}</span>
              <button onClick={() => markPaid(p)} disabled={busy === p.id} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#22c55e', color: '#fff', cursor: 'pointer', fontSize: 12.5, fontWeight: 700 }}>{busy === p.id ? '…' : 'Mark paid'}</button>
            </div>
          ))}
        </div>
      )}

      {/* partners table */}
      <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>All partners ({partners.length})</div>
        {loading ? <div style={{ color: sub, padding: 20 }}>Loading…</div>
          : partners.length === 0 ? <div style={{ color: sub, padding: 20 }}>No partners yet.</div>
            : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: sub, fontSize: 11.5, textTransform: 'uppercase' }}>
                      <th style={{ padding: '8px 6px' }}>Partner</th>
                      <th style={{ padding: '8px 6px' }}>Code</th>
                      <th style={{ padding: '8px 6px' }}>Comm%</th>
                      <th style={{ padding: '8px 6px' }}>Tier</th>
                      <th style={{ padding: '8px 6px' }}>Referred</th>
                      <th style={{ padding: '8px 6px' }}>Paid out</th>
                      <th style={{ padding: '8px 6px' }}>Status</th>
                      <th style={{ padding: '8px 6px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partners.map(p => (
                      <tr key={p.id} style={{ borderTop: `1px solid ${border}` }}>
                        <td style={{ padding: '10px 6px' }}><div style={{ fontWeight: 700 }}>{p.name}</div><div style={{ color: sub, fontSize: 11.5 }}>{p.email}{p.phone ? ' · ' + p.phone : ''}</div></td>
                        <td style={{ padding: '10px 6px', fontFamily: 'monospace', fontWeight: 700, color: '#00b4d8' }}>{p.code}</td>
                        <td style={{ padding: '10px 6px' }}><input type="number" defaultValue={p.commission_pct} onBlur={e => { const v = Number(e.target.value); if (v !== Number(p.commission_pct)) saveField(p.id, { commission_pct: v }) }} style={inp} /></td>
                        <td style={{ padding: '10px 6px' }}>
                          <select value={p.tier || 'standard'} onChange={e => saveField(p.id, { tier: e.target.value })} style={{ ...inp, width: 100 }}>
                            <option value="standard">Standard</option>
                            <option value="premium">Premium</option>
                          </select>
                        </td>
                        <td style={{ padding: '10px 6px' }}>{p.referred_paid}<span style={{ color: sub }}> / {p.referred_total}</span></td>
                        <td style={{ padding: '10px 6px' }}>{AED(p.paid_out)}</td>
                        <td style={{ padding: '10px 6px' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: STC[p.status] || sub, background: (STC[p.status] || sub) + '22', padding: '3px 9px', borderRadius: 99, textTransform: 'capitalize' }}>{p.status}</span>
                          <div style={{ fontSize: 10, color: p.payouts_enabled ? '#22c55e' : sub, marginTop: 4 }}>{p.payouts_enabled ? '💳 payouts on' : 'no payout setup'}</div>
                        </td>
                        <td style={{ padding: '10px 6px', whiteSpace: 'nowrap' }}>
                          {p.status === 'pending' && <button onClick={() => setStatus(p.id, 'active')} disabled={busy === p.id} style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: '#22c55e', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Approve</button>}
                          {p.status === 'active' && <button onClick={() => setStatus(p.id, 'paused')} disabled={busy === p.id} style={{ padding: '6px 12px', borderRadius: 7, border: `1px solid ${border}`, background: 'transparent', color: sub, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Pause</button>}
                          {p.status === 'paused' && <button onClick={() => setStatus(p.id, 'active')} disabled={busy === p.id} style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: '#22c55e', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Reactivate</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
      </div>

      <div style={{ fontSize: 11.5, color: sub, marginTop: 14 }}>Tip: set a partner to <b>Premium</b> and bump their Comm% (e.g. 30) for top performers. Commission auto-applies to their referrals.</div>
    </div>
  )
}
