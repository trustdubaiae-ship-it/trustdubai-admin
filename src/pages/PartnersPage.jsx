import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { marginalCommission } from '../lib/commission'

const AED = (n) => 'AED ' + Math.round(Number(n) || 0).toLocaleString('en-AE')
const STC = { active: '#22c55e', pending: '#f59e0b', paused: '#94a3b8' }

export default function PartnersPage({ theme }) {
  const dark = theme !== 'light'
  const [partners, setPartners] = useState([])
  const [payouts, setPayouts] = useState([])
  const [bankMap, setBankMap] = useState({})
  const [metaMap, setMetaMap] = useState({})
  const [settings, setSettings] = useState({ min_payout: 100, claims_per_month: 2 })
  const [slabs, setSlabs] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const [pRes, oRes, bRes, sRes, cRes] = await Promise.all([
      supabase.rpc('admin_partner_overview'),
      supabase.from('qv_partner_payouts').select('*').order('created_at', { ascending: false }),
      supabase.from('qv_partners').select('id, payout_info, payment_status, docs_verified, bank_verified, tier, fee_monthly, documents'),
      supabase.from('qv_settings').select('*'),
      supabase.from('qv_commission_tiers').select('*').order('sort', { ascending: true }),
    ])
    setPartners(pRes.data || [])
    setPayouts(oRes.data || [])
    setSlabs(cRes.data || [])
    const bm = {}, mm = {}; (bRes.data || []).forEach(p => { bm[p.id] = p.payout_info || {}; mm[p.id] = p }); setBankMap(bm); setMetaMap(mm)
    if (sRes.data) { const m = {}; sRes.data.forEach(r => { m[r.key] = Number(r.value) }); setSettings(s => ({ ...s, ...m })) }
    setLoading(false)
  }
  async function setStatus(id, status) { setBusy(id); await supabase.from('qv_partners').update({ status }).eq('id', id); await load(); setBusy('') }
  async function verifyDocs(id, val) { setBusy(id); await supabase.from('qv_partners').update({ docs_verified: val }).eq('id', id); await load(); setBusy('') }
  async function verifyBank(id) {
    const b = bankMap[id] || {}
    if (!b.iban) { alert('No bank details on file yet.'); return }
    if (!window.confirm(`Confirm the account is correct before verifying:\n\nHolder: ${b.account_holder || '—'}\nBank: ${b.bank_name || '—'}\nIBAN: ${b.iban}${b.swift ? '\nSWIFT: ' + b.swift : ''}`)) return
    setBusy(id); await supabase.from('qv_partners').update({ bank_verified: true }).eq('id', id); await load(); setBusy('')
  }
  function viewDoc(dataUrl) { if (!dataUrl) return; const w = window.open(); if (w) w.document.write(`<iframe src="${dataUrl}" style="border:0;width:100%;height:100%"></iframe>`) }
  async function saveField(id, patch) { await supabase.from('qv_partners').update(patch).eq('id', id); load() }
  async function saveSetting(key, value) {
    const v = Number(value); if (!Number.isFinite(v)) return
    await supabase.from('qv_settings').upsert({ key, value: v }, { onConflict: 'key' })
    setSettings(s => ({ ...s, [key]: v }))
  }
  async function markPaid(p) {
    const b = bankMap[p.partner_id] || {}
    const detail = b.iban ? `\n\nBank: ${b.bank_name || ''}\nIBAN: ${b.iban}\nHolder: ${b.account_holder || ''}` : ''
    if (!window.confirm(`Mark AED ${p.amount} to ${partnerName(p.partner_id)} as PAID?\nTransfer the amount to their bank first.${detail}`)) return
    setBusy(p.id)
    try {
      await supabase.from('qv_partner_payouts').update({ status: 'paid', paid_on: new Date().toISOString().slice(0, 10), method: 'bank' }).eq('id', p.id)
      await load()
    } catch (e) { alert('Failed: ' + (e?.message || e)) } finally { setBusy('') }
  }

  const bg = dark ? '#0f172a' : '#f8fafc'
  const cardBg = dark ? '#1e293b' : '#fff'
  const text = dark ? '#e2e8f0' : '#0f172a'
  const sub = dark ? '#94a3b8' : '#64748b'
  const border = dark ? '#334155' : '#e2e8f0'
  const inp = { padding: '6px 8px', borderRadius: 7, border: `1px solid ${border}`, background: dark ? '#0f172a' : '#fff', color: text, fontSize: 13, width: 64 }
  const miniBtn = { padding: '4px 9px', borderRadius: 6, border: `1px solid ${border}`, background: dark ? '#0f172a' : '#fff', color: text, cursor: 'pointer', fontSize: 11, fontWeight: 600 }
  const partnerName = (id) => partners.find(p => p.id === id)?.name || '—'
  const requested = payouts.filter(p => p.status === 'requested')

  return (
    <div style={{ padding: 'clamp(14px,3vw,28px)', background: bg, minHeight: '100vh', color: text }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}><i className="ti ti-friends" /> Partners</h1>
          <div style={{ fontSize: 13, color: sub, marginTop: 2 }}>Resellers, commissions & payouts</div>
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: sub }}>Min payout AED</span>
            <input type="number" defaultValue={settings.min_payout} onBlur={e => saveSetting('min_payout', e.target.value)} style={{ ...inp, width: 70 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: sub }}>Claims/month</span>
            <input type="number" defaultValue={settings.claims_per_month} onBlur={e => saveSetting('claims_per_month', e.target.value)} style={{ ...inp, width: 50 }} />
          </div>
          <button onClick={load} style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${border}`, background: cardBg, color: text, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}><i className="ti ti-refresh" /> Refresh</button>
        </div>
      </div>

      {/* payout requests */}
      {requested.length > 0 && (
        <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: '#f59e0b' }}><i className="ti ti-bell-ringing" /> Payout requests ({requested.length}) — transfer to the bank below, then mark paid</div>
          {requested.map(p => {
            const b = bankMap[p.partner_id] || {}
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderTop: `1px solid ${border}`, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <b>{partnerName(p.partner_id)}</b><span style={{ color: sub, fontSize: 12 }}> · {p.period || '—'}</span>
                  {b.iban
                    ? <div style={{ fontSize: 11.5, color: sub, marginTop: 3 }}>{b.bank_name || 'Bank'} · IBAN <b style={{ color: text, fontFamily: 'monospace' }}>{b.iban}</b>{b.account_holder ? ' · ' + b.account_holder : ''}{b.swift ? ' · ' + b.swift : ''}</div>
                    : <div style={{ fontSize: 11.5, color: '#ef4444', marginTop: 3 }}>⚠ No bank details on file</div>}
                </div>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{AED(p.amount)}</span>
                <button onClick={() => markPaid(p)} disabled={busy === p.id} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#22c55e', color: '#fff', cursor: 'pointer', fontSize: 12.5, fontWeight: 700 }}>{busy === p.id ? '…' : 'Mark paid'}</button>
              </div>
            )
          })}
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
                        <td style={{ padding: '10px 6px' }}>{(() => { const eff = marginalCommission(Number(p.referred_paid) || 0, slabs); return <span title={`Effective rate across ${p.referred_paid || 0} paying referrals (global slabs)`} style={{ fontWeight: 700, color: '#0099cc' }}>{eff.blendedPct.toFixed(1)}%</span> })()}</td>
                        <td style={{ padding: '10px 6px' }}>
                          <select value={p.tier || 'starter'} onChange={e => saveField(p.id, { tier: e.target.value })} style={{ ...inp, width: 120 }}>
                            <option value="starter">Starter (AED 99)</option>
                            <option value="growth">Growth (AED 199)</option>
                            <option value="pro">Pro (AED 299)</option>
                          </select>
                        </td>
                        <td style={{ padding: '10px 6px' }}>{p.referred_paid}<span style={{ color: sub }}> / {p.referred_total}</span></td>
                        <td style={{ padding: '10px 6px' }}>{AED(p.paid_out)}</td>
                        <td style={{ padding: '10px 6px' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: STC[p.status] || sub, background: (STC[p.status] || sub) + '22', padding: '3px 9px', borderRadius: 99, textTransform: 'capitalize' }}>{p.status}</span>
                          {(() => { const m = metaMap[p.id] || {}; const d = m.documents || {}; const upl = d.emirates_id && d.trade_license; return (
                            <div style={{ fontSize: 10, marginTop: 4, lineHeight: 1.55 }}>
                              <div style={{ color: m.payment_status === 'active' ? '#22c55e' : '#ef4444' }}>{m.payment_status === 'active' ? '💳 paid' : '✗ unpaid'}</div>
                              <div style={{ color: m.docs_verified ? '#22c55e' : upl ? '#f59e0b' : '#ef4444' }}>{m.docs_verified ? '✓ docs verified' : upl ? 'docs uploaded' : 'docs missing'}</div>
                              <div style={{ color: bankMap[p.id]?.iban ? (m.bank_verified ? '#22c55e' : '#f59e0b') : sub }}>{bankMap[p.id]?.iban ? (m.bank_verified ? '🏦 bank ✓' : '🏦 bank · unverified') : 'no bank'}</div>
                            </div>
                          ) })()}
                        </td>
                        <td style={{ padding: '10px 6px', whiteSpace: 'nowrap' }}>
                          {(() => { const m = metaMap[p.id] || {}; const d = m.documents || {}; const upl = d.emirates_id && d.trade_license; const ready = m.payment_status === 'active' && m.docs_verified; return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-start' }}>
                              {(d.emirates_id || d.trade_license) && (
                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                  {d.emirates_id && <button onClick={() => viewDoc(d.emirates_id)} style={miniBtn}>EID</button>}
                                  {d.trade_license && <button onClick={() => viewDoc(d.trade_license)} style={miniBtn}>License</button>}
                                  {upl && !m.docs_verified && <button onClick={() => verifyDocs(p.id, true)} disabled={busy === p.id} style={{ ...miniBtn, background: '#0099cc', color: '#fff', border: 'none' }}>Verify docs ✓</button>}
                                </div>
                              )}
                              {bankMap[p.id]?.iban && !m.bank_verified && <button onClick={() => verifyBank(p.id)} disabled={busy === p.id} style={{ ...miniBtn, background: '#7c3aed', color: '#fff', border: 'none' }}>Verify bank ✓</button>}
                              {p.status === 'pending' && <button onClick={() => { if (!ready && !window.confirm('Payment or documents not complete/verified. Activate anyway?')) return; setStatus(p.id, 'active') }} disabled={busy === p.id} style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: ready ? '#22c55e' : '#94a3b8', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>{ready ? 'Activate' : 'Activate (override)'}</button>}
                              {p.status === 'active' && <button onClick={() => setStatus(p.id, 'paused')} disabled={busy === p.id} style={{ padding: '6px 12px', borderRadius: 7, border: `1px solid ${border}`, background: 'transparent', color: sub, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Pause</button>}
                              {p.status === 'paused' && <button onClick={() => setStatus(p.id, 'active')} disabled={busy === p.id} style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: '#22c55e', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Reactivate</button>}
                            </div>
                          ) })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
      </div>

      <div style={{ fontSize: 11.5, color: sub, marginTop: 14 }}>Comm% is the <b>effective</b> rate from the global commission slabs (set on the <b>Partner Program</b> page), based on each partner's paying referrals. Tier = the monthly plan fee only.</div>
    </div>
  )
}
