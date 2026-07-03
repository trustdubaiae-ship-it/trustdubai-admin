import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const PLANS = {
  free:     { label: 'Free',     color: '#6b7280', price: 0 },
  silver:   { label: 'Silver',   color: '#94a3b8', price: 149 },
  gold:     { label: 'Gold',     color: '#e8b84b', price: 349 },
  platinum: { label: 'Platinum', color: '#8b5cf6', price: 699 },
}

export default function Accounts() {
  const [tab, setTab]                     = useState('pending')
  const [pendingPayments, setPendingPayments] = useState([])
  const [approvals, setApprovals]         = useState([])
  const [loading, setLoading]             = useState(true)
  const [period, setPeriod]               = useState('all')
  const [confirming, setConfirming]       = useState(null)
  const [adminData, setAdminData]         = useState(null)
  const [, forceUpdate]                   = useState(0)

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'

  useEffect(() => {
    fetchAll()
    fetchAdminData()
    const observer = new MutationObserver(() => forceUpdate(n => n + 1))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  async function fetchAdminData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase.from('admin_users').select('*').eq('email', user.email).single()
      setAdminData(data)
    }
  }

  async function fetchAll() {
    setLoading(true)
    const { data: notifs } = await supabase
      .from('notifications').select('*')
      .eq('type', 'payment_pending').eq('is_read', false)
      .order('created_at', { ascending: false })
    setPendingPayments(notifs || [])

    const { data: confirmed } = await supabase
      .from('notifications').select('*')
      .eq('type', 'payment_confirmed')
      .order('created_at', { ascending: false })
    setApprovals(confirmed || [])
    setLoading(false)
  }

  async function confirmPayment(notif) {
    setConfirming(notif.id)
    try {
      const d = notif.data || {}
      await supabase.from('notifications').update({
        is_read: true, type: 'payment_confirmed',
        data: { ...d, confirmed_by: adminData?.full_name || adminData?.email || 'Accounts', confirmed_at: new Date().toISOString() }
      }).eq('id', notif.id)

      await supabase.from('notifications').insert({
        type: 'payment_confirmed', title: '✅ Payment Confirmed',
        message: `Payment of AED ${d.final_total} confirmed for ${d.company_name} — ${PLANS[d.plan]?.label} plan (${d.duration})`,
        data: { ...d, confirmed_by: adminData?.full_name || adminData?.email || 'Accounts', confirmed_at: new Date().toISOString(), amount_aed: d.final_total },
        is_read: true,
      })

      const { data: superAdmins } = await supabase.from('admin_users').select('id').in('role', ['super_admin', 'superadmin']).eq('is_active', true)
      for (const sa of (superAdmins || [])) {
        await supabase.from('notifications').insert({
          user_id: sa.id, type: 'payment_confirmed', title: '✅ Payment Confirmed by Accounts',
          message: `${d.company_name} — AED ${d.final_total} confirmed by ${adminData?.full_name || 'Accounts'}`,
          data: { ...d, confirmed_by: adminData?.full_name || adminData?.email }, is_read: false,
        })
      }
      await fetchAll()
    } catch (e) { alert('Error: ' + e.message) }
    setConfirming(null)
  }

  function filterByPeriod(data) {
    const now = new Date()
    if (period === 'today') return data.filter(a => a.created_at?.startsWith(now.toISOString().split('T')[0]))
    if (period === 'week')  return data.filter(a => a.created_at >= new Date(now - 7*24*60*60*1000).toISOString())
    if (period === 'month') return data.filter(a => a.created_at >= new Date(now.getFullYear(), now.getMonth(), 1).toISOString())
    return data
  }

  const filteredApprovals = filterByPeriod(approvals)
  const totalRevenue = filteredApprovals.reduce((s, a) => s + (parseFloat(a.data?.final_total) || 0), 0)
  const planBreakdown = Object.entries(PLANS).filter(([k]) => k !== 'free').map(([key, p]) => ({
    ...p, key,
    count:   filteredApprovals.filter(a => a.data?.plan === key).length,
    revenue: filteredApprovals.filter(a => a.data?.plan === key).reduce((s, a) => s + (parseFloat(a.data?.final_total) || 0), 0)
  }))

  const text      = isDark ? '#f1f5f9' : '#0f172a'
  const textSub   = isDark ? '#94a3b8' : '#64748b'
  const textMuted = isDark ? '#475569' : '#94a3b8'
  const cardBg    = isDark ? '#1e293b' : '#ffffff'
  const borderCol = isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'
  const bgRow     = isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc'

  return (
    <div style={{ maxWidth: 1000 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: text, marginBottom: 4 }}>Accounts & Revenue</h1>
          <p style={{ fontSize: 13, color: textSub }}>Confirm payments and track revenue</p>
        </div>
        {pendingPayments.length > 0 && (
          <div style={{ background: isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2', border: '1px solid ' + (isDark ? 'rgba(239,68,68,0.3)' : '#fca5a5'), borderRadius: 10, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'pulse 1.5s infinite' }} />
            <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} } @keyframes spin { to { transform: rotate(360deg) } }`}</style>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#ef4444' }}>{pendingPayments.length} payment{pendingPayments.length > 1 ? 's' : ''} pending</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid ' + borderCol }}>
        {[
          { id: 'pending', label: '⏳ Pending Payments', count: pendingPayments.length },
          { id: 'revenue', label: '💰 Revenue & History', count: null },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
            borderBottom: tab === t.id ? '2px solid #03C1F5' : '2px solid transparent',
            color: tab === t.id ? '#03C1F5' : textSub, fontWeight: 500, fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {t.label}
            {t.count !== null && t.count > 0 && (
              <span style={{ background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99, minWidth: 18, textAlign: 'center' }}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* PENDING PAYMENTS */}
      {tab === 'pending' && (
        loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ width: 36, height: 36, border: '3px solid #03C1F5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            <p style={{ color: textMuted, fontSize: 13 }}>Loading...</p>
          </div>
        ) : pendingPayments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, background: cardBg, border: '1px solid ' + borderCol, borderRadius: 14 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div style={{ fontWeight: 600, color: text, marginBottom: 4 }}>No pending payments</div>
            <div style={{ fontSize: 13, color: textSub }}>All payments are confirmed!</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pendingPayments.map(notif => {
              const d = notif.data || {}
              const plan = PLANS[d.plan] || { label: d.plan, color: '#6b7280' }
              return (
                <div key={notif.id} style={{ background: cardBg, border: '1px solid ' + borderCol, borderRadius: 14, padding: 20, boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.2)' : '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: text, marginBottom: 8 }}>{d.company_name || 'Unknown Company'}</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ background: isDark ? plan.color + '22' : plan.color + '20', color: plan.color, fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 99 }}>{plan.label}</span>
                        <span style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6', color: textSub, fontSize: 12, padding: '3px 10px', borderRadius: 99 }}>{d.duration || '—'}</span>
                        <span style={{ background: isDark ? 'rgba(232,184,75,0.1)' : '#fef9e7', color: '#e8b84b', fontSize: 12, padding: '3px 10px', borderRadius: 99 }}>Assigned by: {d.assigned_by || '—'}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 28, fontWeight: 700, color: '#10b981', lineHeight: 1 }}>AED {d.final_total}</div>
                      <div style={{ fontSize: 11, color: textMuted, marginTop: 4 }}>
                        {new Date(notif.created_at).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                  </div>

                  {/* Price breakdown */}
                  <div style={{ background: bgRow, borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: textSub, border: '1px solid ' + borderCol }}>
                    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                      <span>Base: <strong style={{ color: text }}>AED {d.base_total}</strong></span>
                      {d.discount_pct > 0 && <span style={{ color: '#10b981' }}>Discount: <strong>{d.discount_pct}% (−AED {d.discount_amount})</strong></span>}
                      <span>Total: <strong style={{ color: '#10b981' }}>AED {d.final_total}</strong></span>
                      {d.expires_at && <span>Expires: <strong style={{ color: text }}>{new Date(d.expires_at).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button onClick={() => confirmPayment(notif)} disabled={confirming === notif.id} style={{
                      padding: '9px 20px', background: confirming === notif.id ? textMuted : '#10b981',
                      color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
                      cursor: confirming === notif.id ? 'not-allowed' : 'pointer',
                    }}>
                      {confirming === notif.id ? 'Confirming...' : '✅ Confirm Payment Received'}
                    </button>
                    <span style={{ fontSize: 12, color: textMuted }}>Click after receiving AED {d.final_total} from client</span>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* REVENUE TAB */}
      {tab === 'revenue' && (
        <div>
          {/* Period Filter */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 20, justifyContent: 'flex-end', background: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9', borderRadius: 10, padding: 4, border: '1px solid ' + borderCol, width: 'fit-content', marginLeft: 'auto' }}>
            {[
              { key: 'today', label: 'Today' },
              { key: 'week',  label: 'This Week' },
              { key: 'month', label: 'This Month' },
              { key: 'all',   label: 'All Time' },
            ].map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)} style={{
                padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 500,
                background: period === p.key ? '#03C1F5' : 'transparent',
                color: period === p.key ? '#fff' : textSub, transition: 'all 0.15s',
              }}>{p.label}</button>
            ))}
          </div>

          {/* Revenue Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
            <div style={{ background: cardBg, border: '1px solid ' + borderCol, borderRadius: 14, padding: 18, boxShadow: isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: 12, color: textMuted, marginBottom: 6 }}>Total Revenue</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#03C1F5', lineHeight: 1 }}>AED {totalRevenue.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: textMuted, marginTop: 6 }}>{filteredApprovals.length} payments</div>
            </div>
            {planBreakdown.map(p => (
              <div key={p.key} style={{ background: cardBg, border: '1px solid ' + borderCol, borderRadius: 14, padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
                  <span style={{ fontSize: 12, color: textMuted }}>{p.label}</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: p.color, lineHeight: 1 }}>AED {p.revenue.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: textMuted, marginTop: 6 }}>{p.count} payments</div>
              </div>
            ))}
          </div>

          {/* History Table */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ width: 36, height: 36, border: '3px solid #03C1F5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
              <p style={{ color: textMuted, fontSize: 13 }}>Loading...</p>
            </div>
          ) : filteredApprovals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, background: cardBg, border: '1px solid ' + borderCol, borderRadius: 14 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>💰</div>
              <div style={{ fontWeight: 600, color: text, marginBottom: 4 }}>No payments yet</div>
              <div style={{ fontSize: 13, color: textSub }}>Confirmed payments will appear here</div>
            </div>
          ) : (
            <div style={{ background: cardBg, border: '1px solid ' + borderCol, borderRadius: 14, overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: bgRow }}>
                    {['Company', 'Plan', 'Duration', 'Amount', 'Discount', 'Assigned By', 'Confirmed By', 'Date'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: textSub, borderBottom: '1px solid ' + borderCol }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredApprovals.map(a => {
                    const d = a.data || {}
                    const plan = PLANS[d.plan] || { label: d.plan, color: '#6b7280' }
                    return (
                      <tr key={a.id} style={{ borderBottom: '1px solid ' + borderCol }}
                        onMouseEnter={e => e.currentTarget.style.background = bgRow}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: text }}>{d.company_name || '—'}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ background: isDark ? plan.color + '22' : plan.color + '20', color: plan.color, fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 99 }}>
                            {plan.label}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: textSub }}>{d.duration || '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 700, color: '#10b981' }}>
                          AED {parseFloat(d.final_total || 0).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#10b981', fontWeight: 500 }}>
                          {d.discount_pct > 0 ? d.discount_pct + '%' : '—'}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: textSub }}>{d.assigned_by || '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: textSub }}>{d.confirmed_by || '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: textMuted, whiteSpace: 'nowrap' }}>
                          {a.created_at ? new Date(a.created_at).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div style={{ padding: '12px 16px', background: bgRow, borderTop: '1px solid ' + borderCol, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: textSub }}>{filteredApprovals.length} transactions</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#03C1F5' }}>Total: AED {totalRevenue.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
