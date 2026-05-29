import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const PLANS = {
  free:     { label: 'Free',     color: '#6b7280', price: 0 },
  silver:   { label: 'Silver',   color: '#94a3b8', price: 149 },
  gold:     { label: 'Gold',     color: '#e8b84b', price: 349 },
  platinum: { label: 'Platinum', color: '#8b5cf6', price: 699 },
}

export default function Accounts() {
  const [tab, setTab] = useState('pending')
  const [pendingPayments, setPendingPayments] = useState([])
  const [approvals, setApprovals] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('all')
  const [confirming, setConfirming] = useState(null)
  const [adminData, setAdminData] = useState(null)

  useEffect(() => { fetchAll(); fetchAdminData() }, [])

  async function fetchAdminData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase.from('admin_users').select('*').eq('email', user.email).single()
      setAdminData(data)
    }
  }

  async function fetchAll() {
    setLoading(true)

    // Fetch pending payment notifications
    const { data: notifs } = await supabase
      .from('notifications')
      .select('*')
      .eq('type', 'payment_pending')
      .eq('is_read', false)
      .order('created_at', { ascending: false })

    setPendingPayments(notifs || [])

    // Fetch confirmed payments
    const { data: confirmed } = await supabase
      .from('notifications')
      .select('*')
      .eq('type', 'payment_confirmed')
      .order('created_at', { ascending: false })

    setApprovals(confirmed || [])
    setLoading(false)
  }

  async function confirmPayment(notif) {
    setConfirming(notif.id)
    try {
      const d = notif.data || {}

      // Mark notification as read (payment confirmed)
      await supabase.from('notifications').update({
        is_read: true,
        type: 'payment_confirmed',
        data: {
          ...d,
          confirmed_by: adminData?.full_name || adminData?.email || 'Accounts',
          confirmed_at: new Date().toISOString()
        }
      }).eq('id', notif.id)

      // Add confirmed payment record
      await supabase.from('notifications').insert({
        type: 'payment_confirmed',
        title: '✅ Payment Confirmed',
        message: `Payment of AED ${d.final_total} confirmed for ${d.company_name} — ${PLANS[d.plan]?.label} plan (${d.duration})`,
        data: {
          ...d,
          confirmed_by: adminData?.full_name || adminData?.email || 'Accounts',
          confirmed_at: new Date().toISOString(),
          amount_aed: d.final_total,
        },
        is_read: true,
      })

      // Notify Super Admin
      const { data: superAdmins } = await supabase
        .from('admin_users').select('id')
        .in('role', ['super_admin', 'superadmin']).eq('is_active', true)

      for (const sa of (superAdmins || [])) {
        await supabase.from('notifications').insert({
          user_id: sa.id,
          type: 'payment_confirmed',
          title: '✅ Payment Confirmed by Accounts',
          message: `${d.company_name} — AED ${d.final_total} confirmed by ${adminData?.full_name || 'Accounts'}`,
          data: { ...d, confirmed_by: adminData?.full_name || adminData?.email },
          is_read: false,
        })
      }

      await fetchAll()
    } catch (e) {
      alert('Error confirming payment: ' + e.message)
    }
    setConfirming(null)
  }

  function filterByPeriod(data) {
    const now = new Date()
    if (period === 'today') {
      const today = now.toISOString().split('T')[0]
      return data.filter(a => a.created_at?.startsWith(today))
    }
    if (period === 'week') {
      const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
      return data.filter(a => a.created_at >= weekAgo)
    }
    if (period === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      return data.filter(a => a.created_at >= monthStart)
    }
    return data
  }

  const filteredApprovals = filterByPeriod(approvals)
  const totalRevenue = filteredApprovals.reduce((s, a) => s + (parseFloat(a.data?.final_total) || 0), 0)

  const planBreakdown = Object.entries(PLANS).filter(([k]) => k !== 'free').map(([key, p]) => ({
    ...p, key,
    count: filteredApprovals.filter(a => a.data?.plan === key).length,
    revenue: filteredApprovals.filter(a => a.data?.plan === key).reduce((s, a) => s + (parseFloat(a.data?.final_total) || 0), 0)
  }))

  return (
    <div style={{ maxWidth: 1000 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>Accounts & Revenue</h1>
          <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>Confirm payments and track revenue</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {[
          { id: 'pending',  label: '⏳ Pending Payments (' + pendingPayments.length + ')' },
          { id: 'revenue',  label: '💰 Revenue & History' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 20px', border: 'none', background: 'none',
            borderBottom: tab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
            color: tab === t.id ? 'var(--primary)' : 'var(--text2)',
            fontWeight: 500, fontSize: 13, cursor: 'pointer'
          }}>{t.label}</button>
        ))}
      </div>

      {/* PENDING PAYMENTS TAB */}
      {tab === 'pending' && (
        <div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Loading...</div>
          ) : pendingPayments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)', background: '#fff', border: '1px solid var(--border)', borderRadius: 12 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>No pending payments</div>
              <div style={{ fontSize: 13 }}>All payments are confirmed!</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {pendingPayments.map(notif => {
                const d = notif.data || {}
                const plan = PLANS[d.plan] || { label: d.plan, color: '#6b7280' }
                return (
                  <div key={notif.id} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{d.company_name || 'Unknown Company'}</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ background: plan.color + '20', color: plan.color, fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 99 }}>
                            {plan.label}
                          </span>
                          <span style={{ background: '#f3f4f6', color: '#374151', fontSize: 12, padding: '3px 10px', borderRadius: 99 }}>
                            {d.duration || '—'}
                          </span>
                          <span style={{ background: '#fef9ed', color: '#92400e', fontSize: 12, padding: '3px 10px', borderRadius: 99 }}>
                            Assigned by: {d.assigned_by || '—'}
                          </span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 22, fontWeight: 700, color: '#10b981' }}>AED {d.final_total}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                          {new Date(notif.created_at).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                    </div>

                    {/* Price breakdown */}
                    <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: 'var(--text2)' }}>
                      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                        <span>Base: <strong>AED {d.base_total}</strong></span>
                        {d.discount_pct > 0 && <span style={{ color: '#10b981' }}>Discount: <strong>{d.discount_pct}% (−AED {d.discount_amount})</strong></span>}
                        <span>Total: <strong style={{ color: '#10b981' }}>AED {d.final_total}</strong></span>
                        {d.expires_at && <span>Expires: <strong>{new Date(d.expires_at).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></span>}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        onClick={() => confirmPayment(notif)}
                        disabled={confirming === notif.id}
                        style={{
                          padding: '8px 20px', background: confirming === notif.id ? '#9ca3af' : '#10b981',
                          color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
                          cursor: confirming === notif.id ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {confirming === notif.id ? 'Confirming...' : '✅ Confirm Payment Received'}
                      </button>
                      <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', alignItems: 'center' }}>
                        Click after receiving AED {d.final_total} from client
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* REVENUE TAB */}
      {tab === 'revenue' && (
        <div>
          {/* Period filter */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 20, justifyContent: 'flex-end' }}>
            {[
              { key: 'today', label: 'Today' },
              { key: 'week',  label: 'This Week' },
              { key: 'month', label: 'This Month' },
              { key: 'all',   label: 'All Time' },
            ].map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)} style={{
                padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 500,
                background: period === p.key ? 'var(--primary)' : 'var(--bg)',
                color: period === p.key ? '#fff' : 'var(--text2)',
              }}>{p.label}</button>
            ))}
          </div>

          {/* Revenue Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Total Revenue</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#03C1F5' }}>AED {totalRevenue.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{filteredApprovals.length} payments</div>
            </div>
            {planBreakdown.map(p => (
              <div key={p.key} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>{p.label}</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: p.color }}>AED {p.revenue.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{p.count} payments</div>
              </div>
            ))}
          </div>

          {/* History table */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Loading...</div>
          ) : filteredApprovals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)', background: '#fff', border: '1px solid var(--border)', borderRadius: 12 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>💰</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>No payments yet</div>
              <div style={{ fontSize: 13 }}>Confirmed payments will appear here</div>
            </div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg)' }}>
                    {['Company', 'Plan', 'Duration', 'Amount', 'Discount', 'Assigned By', 'Confirmed By', 'Date'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredApprovals.map(a => {
                    const d = a.data || {}
                    const plan = PLANS[d.plan] || { label: d.plan, color: '#6b7280' }
                    return (
                      <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{d.company_name || '—'}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ background: plan.color + '20', color: plan.color, fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 99 }}>
                            {plan.label}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 13 }}>{d.duration || '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#10b981' }}>
                          AED {parseFloat(d.final_total || 0).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#10b981' }}>
                          {d.discount_pct > 0 ? d.discount_pct + '%' : '—'}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text2)' }}>{d.assigned_by || '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text2)' }}>{d.confirmed_by || '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text3)' }}>
                          {a.created_at ? new Date(a.created_at).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div style={{ padding: '12px 16px', background: 'var(--bg)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--text2)' }}>{filteredApprovals.length} transactions</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#03C1F5' }}>Total: AED {totalRevenue.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
