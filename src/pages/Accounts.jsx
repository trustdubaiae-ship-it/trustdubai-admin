import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const PLANS = {
  silver:   { label: 'Silver',   color: '#94a3b8', price: 149 },
  gold:     { label: 'Gold',     color: '#e8b84b', price: 349 },
  platinum: { label: 'Platinum', color: '#8b5cf6', price: 699 },
}

export default function Accounts() {
  const [approvals, setApprovals] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('all')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const { data } = await supabase
      .from('plan_approvals')
      .select('*, companies(name, category, owner_email)')
      .eq('status', 'approved')
      .order('approved_at', { ascending: false })
    setApprovals(data || [])
    setLoading(false)
  }

  function filterByPeriod(data) {
    const now = new Date()
    if (period === 'today') {
      const today = now.toISOString().split('T')[0]
      return data.filter(a => a.approved_at?.startsWith(today))
    }
    if (period === 'week') {
      const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
      return data.filter(a => a.approved_at >= weekAgo)
    }
    if (period === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      return data.filter(a => a.approved_at >= monthStart)
    }
    return data
  }

  const filtered = filterByPeriod(approvals)
  const totalRevenue = filtered.reduce((s, a) => s + (parseFloat(a.amount_aed) || 0), 0)
  const planBreakdown = Object.entries(PLANS).map(([key, p]) => ({
    ...p, key,
    count: filtered.filter(a => a.plan === key).length,
    revenue: filtered.filter(a => a.plan === key).reduce((s, a) => s + (parseFloat(a.amount_aed) || 0), 0)
  }))

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>Accounts & Revenue</h1>
          <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>Track all plan payments and revenue</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
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
      </div>

      {/* Revenue Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: 18, gridColumn: 'span 1' }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Total Revenue</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#03C1F5' }}>AED {totalRevenue.toLocaleString()}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{filtered.length} payments</div>
        </div>
        {planBreakdown.map(p => (
          <div key={p.key} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>{p.label}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: p.color }}>AED {p.revenue.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{p.count} companies</div>
          </div>
        ))}
      </div>

      {/* Revenue table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)', background: '#fff', border: '1px solid var(--border)', borderRadius: 12 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💰</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>No payments yet</div>
          <div style={{ fontSize: 13 }}>Approved plan payments will appear here</div>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg)' }}>
                {['Company', 'Plan', 'Amount', 'Sales By', 'Accounts By', 'Approved By', 'Date'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const plan = PLANS[a.plan] || { label: a.plan, color: '#6b7280' }
                return (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{a.companies?.name || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{a.companies?.owner_email}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: plan.color + '20', color: plan.color, fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 99 }}>
                        {plan.label}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#10b981' }}>
                      AED {parseFloat(a.amount_aed || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text2)' }}>{a.sales_by || '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text2)' }}>{a.accounts_by || '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text2)' }}>{a.approved_by || '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text3)' }}>
                      {a.approved_at ? new Date(a.approved_at).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div style={{ padding: '12px 16px', background: 'var(--bg)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>{filtered.length} transactions</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#03C1F5' }}>Total: AED {totalRevenue.toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  )
}
