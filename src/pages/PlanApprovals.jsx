import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const PLANS = {
  free:     { label: 'Free',     color: '#6b7280', price: 0 },
  silver:   { label: 'Silver',   color: '#94a3b8', price: 149 },
  gold:     { label: 'Gold',     color: '#e8b84b', price: 349 },
  platinum: { label: 'Platinum', color: '#8b5cf6', price: 699 },
}

const STATUS_CONFIG = {
  pending_sales:       { label: 'Pending Sales',       color: '#f59e0b', bg: '#fef9ed' },
  pending_accounts:    { label: 'Pending Accounts',    color: '#3b82f6', bg: '#eff6ff' },
  pending_super_admin: { label: 'Pending Approval',    color: '#8b5cf6', bg: '#f5f3ff' },
  approved:            { label: 'Approved',            color: '#10b981', bg: '#ecfdf5' },
  rejected:            { label: 'Rejected',            color: '#ef4444', bg: '#fef2f2' },
}

export default function PlanApprovals() {
  const [approvals, setApprovals] = useState([])
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)
  const [filter, setFilter] = useState('all')
  const [showNew, setShowNew] = useState(false)
  const [newApproval, setNewApproval] = useState({ company_id: '', plan: 'silver', amount_aed: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [rejectModal, setRejectModal] = useState(null)
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: adminData } = await supabase.from('admin_users').select('*').eq('email', user?.email).single()
    setCurrentUser(adminData)

    const { data: approvalsData } = await supabase
      .from('plan_approvals')
      .select('*, companies(name, owner_email, category)')
      .order('created_at', { ascending: false })

    const { data: companiesData } = await supabase
      .from('companies')
      .select('id, name, owner_email')
      .eq('status', 'approved')
      .order('name')

    setApprovals(approvalsData || [])
    setCompanies(companiesData || [])
    setLoading(false)
  }

  const role = currentUser?.role || ''
  const isSuperAdmin = role === 'super_admin' || role === 'superadmin'
  const isSales = role === 'sales' || isSuperAdmin
  const isAccounts = role === 'accounts' || isSuperAdmin

  async function createApproval() {
    if (!newApproval.company_id || !newApproval.plan) return
    setSaving(true)
    const { data, error } = await supabase.from('plan_approvals').insert({
      company_id: newApproval.company_id,
      plan: newApproval.plan,
      amount_aed: newApproval.amount_aed || PLANS[newApproval.plan]?.price,
      notes: newApproval.notes,
      status: 'pending_accounts',
      sales_by: currentUser?.email,
      sales_at: new Date().toISOString(),
    }).select().single()

    if (!error) {
      // Notification for accounts
      await supabase.from('notifications').insert({
        type: 'plan_approval',
        title: 'New Plan Sale',
        message: 'Sales marked a new ' + newApproval.plan + ' plan sale. Please confirm payment.',
        for_role: 'accounts',
        related_id: data.id,
        related_type: 'plan_approval'
      })
      await fetchAll()
      setShowNew(false)
      setNewApproval({ company_id: '', plan: 'silver', amount_aed: '', notes: '' })
    }
    setSaving(false)
  }

  async function confirmPayment(approval) {
    setSaving(true)
    await supabase.from('plan_approvals').update({
      status: 'pending_super_admin',
      accounts_by: currentUser?.email,
      accounts_at: new Date().toISOString(),
    }).eq('id', approval.id)

    await supabase.from('notifications').insert({
      type: 'plan_approval',
      title: 'Payment Confirmed — Awaiting Approval',
      message: 'Accounts confirmed payment for ' + approval.companies?.name + ' (' + approval.plan + ' plan). Please approve.',
      for_role: 'super_admin',
      related_id: approval.id,
      related_type: 'plan_approval'
    })

    await fetchAll()
    setSaving(false)
  }

  async function approveplan(approval) {
    setSaving(true)
    await supabase.from('plan_approvals').update({
      status: 'approved',
      approved_by: currentUser?.email,
      approved_at: new Date().toISOString(),
    }).eq('id', approval.id)

    // Company ka plan update karo
    await supabase.from('companies').update({ plan: approval.plan }).eq('id', approval.company_id)

    // Company ko notification
    await supabase.from('notifications').insert({
      type: 'plan_activated',
      title: approval.plan.charAt(0).toUpperCase() + approval.plan.slice(1) + ' Plan Activated!',
      message: 'Your ' + approval.plan + ' plan has been activated on Quvera.',
      for_role: 'company',
      related_id: approval.company_id,
      related_type: 'company'
    })

    await fetchAll()
    setSaving(false)
  }

  async function rejectPlan(approval) {
    if (!rejectReason.trim()) return
    setSaving(true)
    await supabase.from('plan_approvals').update({
      status: 'rejected',
      rejection_reason: rejectReason,
      approved_by: currentUser?.email,
      approved_at: new Date().toISOString(),
    }).eq('id', approval.id)

    setRejectModal(null)
    setRejectReason('')
    await fetchAll()
    setSaving(false)
  }

  const filtered = filter === 'all' ? approvals : approvals.filter(a => a.status === filter)

  const counts = {
    all: approvals.length,
    pending_sales: approvals.filter(a => a.status === 'pending_sales').length,
    pending_accounts: approvals.filter(a => a.status === 'pending_accounts').length,
    pending_super_admin: approvals.filter(a => a.status === 'pending_super_admin').length,
    approved: approvals.filter(a => a.status === 'approved').length,
    rejected: approvals.filter(a => a.status === 'rejected').length,
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>Plan Approvals</h1>
          <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>
            {isSales && 'Sales: Mark new plan sales'}
            {isAccounts && !isSales && 'Accounts: Confirm payments'}
            {isSuperAdmin && ' · Super Admin: Final approval'}
          </p>
        </div>
        {isSales && (
          <button onClick={() => setShowNew(true)} style={{ padding: '8px 16px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            + New Plan Sale
          </button>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { key: 'pending_accounts', label: 'Awaiting Payment', color: '#3b82f6' },
          { key: 'pending_super_admin', label: 'Awaiting Approval', color: '#8b5cf6' },
          { key: 'approved', label: 'Approved', color: '#10b981' },
          { key: 'rejected', label: 'Rejected', color: '#ef4444' },
          { key: 'all', label: 'Total', color: '#6b7280' },
        ].map(s => (
          <div key={s.key} onClick={() => setFilter(s.key)} style={{ background: filter === s.key ? s.color + '15' : '#fff', border: '1px solid ' + (filter === s.key ? s.color : 'var(--border)'), borderRadius: 10, padding: '12px 14px', cursor: 'pointer', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{counts[s.key]}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* New Approval Form */}
      {showNew && (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>New Plan Sale</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Company *</label>
              <select value={newApproval.company_id} onChange={e => setNewApproval(p => ({ ...p, company_id: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit' }}>
                <option value="">Select company...</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Plan *</label>
              <select value={newApproval.plan} onChange={e => setNewApproval(p => ({ ...p, plan: e.target.value, amount_aed: PLANS[e.target.value]?.price }))}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit' }}>
                {Object.entries(PLANS).filter(([k]) => k !== 'free').map(([k, v]) => (
                  <option key={k} value={k}>{v.label} — AED {v.price}/mo</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Amount Received (AED)</label>
              <input type="number" value={newApproval.amount_aed} onChange={e => setNewApproval(p => ({ ...p, amount_aed: e.target.value }))}
                placeholder={PLANS[newApproval.plan]?.price}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Notes</label>
              <input value={newApproval.notes} onChange={e => setNewApproval(p => ({ ...p, notes: e.target.value }))}
                placeholder="Optional notes..."
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={createApproval} disabled={saving} style={{ padding: '8px 20px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              {saving ? 'Saving...' : 'Submit for Accounts Approval'}
            </button>
            <button onClick={() => setShowNew(false)} style={{ padding: '8px 16px', background: 'var(--bg)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Approvals List */}
      {loading ? <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Loading...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)', background: '#fff', border: '1px solid var(--border)', borderRadius: 12 }}>
              No {filter === 'all' ? '' : filter.replace('_', ' ')} approvals
            </div>
          ) : filtered.map(app => {
            const plan = PLANS[app.plan] || {}
            const status = STATUS_CONFIG[app.status] || {}
            const company = app.companies

            return (
              <div key={app.id} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 10, background: plan.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                      {app.plan === 'platinum' ? '💎' : app.plan === 'gold' ? '🥇' : app.plan === 'silver' ? '🥈' : '🆓'}
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>{company?.name || 'Unknown'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text2)' }}>{company?.owner_email} · {company?.category}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ background: status.bg, color: status.color, fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 99 }}>
                      {status.label}
                    </span>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                      {new Date(app.created_at).toLocaleDateString('en-AE')}
                    </div>
                  </div>
                </div>

                {/* Plan + Amount */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 14 }}>
                  {[
                    ['Plan', plan.label],
                    ['Amount', 'AED ' + (app.amount_aed || plan.price)],
                    ['Sales by', app.sales_by || '—'],
                    ['Accounts by', app.accounts_by || '—'],
                  ].map(([l, v]) => (
                    <div key={l} style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>{l}</div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{v}</div>
                    </div>
                  ))}
                </div>

                {app.notes && (
                  <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13, color: 'var(--text2)' }}>
                    Note: {app.notes}
                  </div>
                )}

                {app.rejection_reason && (
                  <div style={{ background: '#fef2f2', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13, color: '#991b1b' }}>
                    Rejected: {app.rejection_reason}
                  </div>
                )}

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 8 }}>
                  {app.status === 'pending_accounts' && isAccounts && (
                    <button onClick={() => confirmPayment(app)} disabled={saving} style={{ padding: '7px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                      ✓ Confirm Payment Received
                    </button>
                  )}
                  {app.status === 'pending_super_admin' && isSuperAdmin && (
                    <>
                      <button onClick={() => approveplan(app)} disabled={saving} style={{ padding: '7px 16px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                        ✅ Approve & Activate Plan
                      </button>
                      <button onClick={() => setRejectModal(app)} style={{ padding: '7px 16px', background: '#fef2f2', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
                        ❌ Reject
                      </button>
                    </>
                  )}
                  {app.status === 'approved' && (
                    <span style={{ fontSize: 12, color: '#10b981', fontWeight: 500 }}>
                      ✓ Approved by {app.approved_by} on {app.approved_at ? new Date(app.approved_at).toLocaleDateString('en-AE') : '—'}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 440 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Reject Plan Approval</h3>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, minHeight: 80, fontFamily: 'inherit', marginBottom: 12 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => rejectPlan(rejectModal)} disabled={saving} style={{ flex: 1, padding: 10, background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                Confirm Reject
              </button>
              <button onClick={() => { setRejectModal(null); setRejectReason('') }} style={{ flex: 1, padding: 10, background: 'var(--bg)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
