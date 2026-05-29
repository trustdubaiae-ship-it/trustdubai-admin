import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const CATS = ['Interior Design','Renovation','Technical Contracting','Fit-Out','AC Service','Plumbing','Electrical','Cleaning','Painting','Handyman','Restaurant','Gym','Medical','Legal','Salon','Hotel','Other']

const PLANS = {
  free:     { label: 'Free',     color: '#6b7280', bg: '#f3f4f6', price: 0 },
  silver:   { label: 'Silver',   color: '#94a3b8', bg: '#f1f5f9', price: 149 },
  gold:     { label: 'Gold',     color: '#e8b84b', bg: '#fffdf7', price: 349 },
  platinum: { label: 'Platinum', color: '#8b5cf6', bg: '#f5f3ff', price: 699 },
}

const DURATIONS = [
  { id: '1month',  label: '1 Month',  months: 1,  defaultDiscount: 0 },
  { id: '3month',  label: '3 Months', months: 3,  defaultDiscount: 0 },
  { id: '6month',  label: '6 Months', months: 6,  defaultDiscount: 0 },
  { id: '1year',   label: '1 Year',   months: 12, defaultDiscount: 20 },
]

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 520, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text3)' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, value, onChange }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', display: 'block', marginBottom: 4, textTransform: 'capitalize' }}>{label}</label>
      <input value={value || ''} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, outline: 'none' }} />
    </div>
  )
}

function formatExpiry(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.ceil((d - now) / (1000 * 60 * 60 * 24))
  if (diffDays < 0)  return { label: 'Expired', color: '#ef4444', days: diffDays }
  if (diffDays <= 7) return { label: diffDays + ' days left', color: '#f59e0b', days: diffDays }
  if (diffDays <= 30) return { label: diffDays + ' days left', color: '#3b82f6', days: diffDays }
  return { label: diffDays + ' days left', color: '#10b981', days: diffDays }
}

export default function Companies() {
  const [tab, setTab] = useState('approved')
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [editC, setEditC] = useState(null)
  const [addModal, setAddModal] = useState(false)
  const [planModal, setPlanModal] = useState(null)
  const [selectedPlan, setSelectedPlan] = useState('free')
  const [duration, setDuration] = useState('1month')
  const [discount, setDiscount] = useState(0)
  const [savingPlan, setSavingPlan] = useState(false)
  const [adminData, setAdminData] = useState(null)
  const [newC, setNewC] = useState({ name: '', category: '', area: '', phone: '', whatsapp: '', email: '', description: '' })

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
    const { data } = await supabase.from('companies').select('*').order('created_at', { ascending: false })
    setCompanies(data || [])
    setLoading(false)
  }

  async function update(id, updates) {
    await supabase.from('companies').update(updates).eq('id', id)
    fetchAll()
    setEditC(null)
  }

  async function del(id) {
    if (!confirm('Delete this company?')) return
    await supabase.from('companies').delete().eq('id', id)
    fetchAll()
  }

  async function addNew() {
    await supabase.from('companies').insert({ ...newC, status: 'approved' })
    setAddModal(false)
    setNewC({ name: '', category: '', area: '', phone: '', whatsapp: '', email: '', description: '' })
    fetchAll()
  }

  function openPlanModal(company) {
    setPlanModal(company)
    setSelectedPlan(company.plan || 'free')
    setDuration('1month')
    setDiscount(0)
  }

  // Pricing calculations
  const durObj = DURATIONS.find(d => d.id === duration) || DURATIONS[0]
  const planPrice = PLANS[selectedPlan]?.price || 0
  const months = durObj.months
  const baseTotal = planPrice * months
  const discountAmount = Math.round(baseTotal * (discount / 100))
  const finalTotal = baseTotal - discountAmount

  function getExpiryDate() {
    const d = new Date()
    d.setMonth(d.getMonth() + months)
    return d.toISOString()
  }

  function getExpiryLabel() {
    return new Date(getExpiryDate()).toLocaleDateString('en-AE', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  async function savePlan() {
    if (!planModal || !selectedPlan) return
    setSavingPlan(true)

    const expiryDate = selectedPlan === 'free' ? null : getExpiryDate()

    await supabase.from('companies').update({
      plan: selectedPlan,
      plan_started_at: new Date().toISOString(),
      plan_expires_at: expiryDate,
    }).eq('id', planModal.id)

    // Notify Accounts team + Super Admins
    if (selectedPlan !== 'free') {
      const { data: accountsUsers } = await supabase
        .from('admin_users').select('id').eq('role', 'accounts').eq('is_active', true)
      const { data: superAdmins } = await supabase
        .from('admin_users').select('id').in('role', ['super_admin', 'superadmin']).eq('is_active', true)

      const recipients = [...(accountsUsers || []), ...(superAdmins || [])]

      for (const r of recipients) {
        await supabase.from('notifications').insert({
          user_id: r.id,
          type: 'payment_pending',
          title: '💰 Payment Confirmation Required',
          message: `${planModal.name} assigned ${PLANS[selectedPlan]?.label} plan for ${durObj.label}. Total: AED ${finalTotal}${discount > 0 ? ' (after ' + discount + '% discount)' : ''}. Please confirm payment received.`,
          data: {
            company_id: planModal.id,
            company_name: planModal.name,
            plan: selectedPlan,
            duration: durObj.label,
            months,
            base_total: baseTotal,
            discount_pct: discount,
            discount_amount: discountAmount,
            final_total: finalTotal,
            expires_at: expiryDate,
            assigned_by: adminData?.full_name || adminData?.email || 'Admin'
          },
          is_read: false,
        })
      }
    }

    setSavingPlan(false)
    setPlanModal(null)
    fetchAll()
    alert(selectedPlan === 'free'
      ? '✅ Plan set to Free!'
      : `✅ Plan saved! Accounts team notified for payment confirmation of AED ${finalTotal}.`
    )
  }

  const pending = companies.filter(c => c.status === 'pending' || c.status === 'under_review')
  const approved = companies.filter(c => c.status === 'approved')
  const displayList = tab === 'pending' ? pending : tab === 'approved' ? approved : companies
  const btn = (color, bg) => ({ padding: '5px 12px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer', color, background: bg })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>Companies</h1>
          <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>Manage all listings</p>
        </div>
        <button onClick={() => setAddModal(true)} style={{ padding: '8px 16px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>+ Add Company</button>
      </div>

      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {[
          { id: 'pending',  label: 'Pending (' + pending.length + ')' },
          { id: 'approved', label: 'Approved (' + approved.length + ')' },
          { id: 'all',      label: 'All (' + companies.length + ')' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '10px 20px', border: 'none', background: 'none', borderBottom: tab === t.id ? '2px solid var(--primary)' : '2px solid transparent', color: tab === t.id ? 'var(--primary)' : 'var(--text2)', fontWeight: 500, fontSize: 13, cursor: 'pointer' }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <p style={{ textAlign: 'center', color: 'var(--text3)', padding: 40 }}>Loading...</p> : (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg)' }}>
                {['Company', 'Category', 'Area', 'Plan', 'Expiry', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayList.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)', fontSize: 13 }}>No companies</td></tr>
              ) : displayList.map(c => {
                const plan = PLANS[c.plan || 'free'] || PLANS.free
                const expiry = formatExpiry(c.plan_expires_at)
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{c.owner_email}</div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13 }}>{c.category}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13 }}>{c.area || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: plan.bg, color: plan.color, fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 99 }}>
                        {plan.label}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {c.plan === 'free' || !c.plan_expires_at ? (
                        <span style={{ fontSize: 12, color: 'var(--text3)' }}>—</span>
                      ) : expiry ? (
                        <span style={{ fontSize: 12, fontWeight: 500, color: expiry.color }}>
                          {expiry.days < 0 ? '⚠️ ' : ''}{expiry.label}
                        </span>
                      ) : null}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span style={{ background: c.status === 'approved' ? 'var(--green-light)' : '#fef9ed', color: c.status === 'approved' ? 'var(--green)' : '#92400e', fontSize: 11, padding: '2px 8px', borderRadius: 10, display: 'inline-block' }}>
                          {c.status}
                        </span>
                        {c.is_verified && (
                          <span style={{ background: '#e8f0fe', color: 'var(--primary)', fontSize: 11, padding: '2px 8px', borderRadius: 10, display: 'inline-block' }}>✓ Verified</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        <button onClick={() => setEditC(c)} style={btn('var(--primary)', 'var(--primary-light)')}>Edit</button>
                        <button onClick={() => update(c.id, { is_verified: !c.is_verified })} style={btn('var(--green)', 'var(--green-light)')}>
                          {c.is_verified ? 'Unverify' : 'Verify'}
                        </button>
                        <button onClick={() => openPlanModal(c)} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer', background: plan.bg, color: plan.color }}>
                          Plan
                        </button>
                        <button onClick={() => del(c.id)} style={btn('var(--red)', 'var(--red-light)')}>Del</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Plan Modal */}
      {planModal && (
        <Modal title={'Change Plan — ' + planModal.name} onClose={() => setPlanModal(null)}>

          {/* Current plan */}
          <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--bg)', borderRadius: 8, fontSize: 13 }}>
            Current: <strong style={{ color: PLANS[planModal.plan || 'free']?.color }}>{PLANS[planModal.plan || 'free']?.label}</strong>
            {planModal.plan_expires_at && (
              <span style={{ marginLeft: 8, fontSize: 12, color: formatExpiry(planModal.plan_expires_at)?.color }}>
                · {formatExpiry(planModal.plan_expires_at)?.label}
              </span>
            )}
          </div>

          {/* Plan selector */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>1. Select Plan</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {Object.entries(PLANS).map(([key, p]) => (
                <div key={key} onClick={() => { setSelectedPlan(key); if (key === 'free') setDiscount(0) }} style={{
                  padding: '12px 14px', border: '2px solid ' + (selectedPlan === key ? p.color : 'var(--border)'),
                  borderRadius: 10, cursor: 'pointer', background: selectedPlan === key ? p.bg : '#fff', textAlign: 'center'
                }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: p.color }}>{p.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                    {p.price === 0 ? 'Free' : 'AED ' + p.price + '/mo'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Duration + Discount — only for paid */}
          {selectedPlan && selectedPlan !== 'free' && (
            <>
              {/* Duration */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>2. Select Duration</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {DURATIONS.map(d => (
                    <div key={d.id} onClick={() => {
                      setDuration(d.id)
                      setDiscount(d.defaultDiscount)
                    }} style={{
                      padding: '10px 8px', border: '2px solid ' + (duration === d.id ? 'var(--primary)' : 'var(--border)'),
                      borderRadius: 8, cursor: 'pointer',
                      background: duration === d.id ? 'var(--primary-light)' : '#fff',
                      textAlign: 'center', position: 'relative'
                    }}>
                      {d.defaultDiscount > 0 && (
                        <div style={{ position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)', background: 'var(--green)', color: '#fff', fontSize: 8, fontWeight: 700, padding: '1px 6px', borderRadius: 99, whiteSpace: 'nowrap' }}>
                          {d.defaultDiscount}% OFF
                        </div>
                      )}
                      <div style={{ fontSize: 13, fontWeight: 700, color: duration === d.id ? 'var(--primary)' : 'var(--text)' }}>{d.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                        AED {planPrice * d.months}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Discount */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>
                  3. Discount % <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(editable)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <input
                    type="number" min="0" max="100" value={discount}
                    onChange={e => setDiscount(Math.min(100, Math.max(0, Number(e.target.value))))}
                    style={{ width: 80, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 16, fontWeight: 700, textAlign: 'center', outline: 'none' }}
                  />
                  <span style={{ fontSize: 13, color: 'var(--text2)' }}>%</span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[0, 5, 10, 15, 20, 25, 30].map(d => (
                      <button key={d} onClick={() => setDiscount(d)} style={{
                        padding: '4px 10px', border: '1px solid ' + (discount === d ? 'var(--primary)' : 'var(--border)'),
                        borderRadius: 6, fontSize: 12, cursor: 'pointer',
                        background: discount === d ? 'var(--primary-light)' : '#fff',
                        color: discount === d ? 'var(--primary)' : 'var(--text2)',
                        fontWeight: discount === d ? 600 : 400
                      }}>{d}%</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Price Summary */}
              <div style={{ background: '#f0fdf4', border: '1px solid #a7f3d0', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#065f46', marginBottom: 10 }}>💰 Price Summary</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151' }}>
                    <span>{PLANS[selectedPlan]?.label} Plan × {months} month{months > 1 ? 's' : ''}</span>
                    <span>AED {baseTotal}</span>
                  </div>
                  {discount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#059669', fontWeight: 500 }}>
                      <span>Discount ({discount}%)</span>
                      <span>− AED {discountAmount}</span>
                    </div>
                  )}
                  <div style={{ borderTop: '1px solid #a7f3d0', marginTop: 4, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700 }}>
                    <span style={{ color: '#065f46' }}>Total Payable</span>
                    <span style={{ color: '#059669' }}>AED {finalTotal}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                    Plan expires: <strong>{getExpiryLabel()}</strong>
                  </div>
                </div>
              </div>

              {/* Accounts notification warning */}
              <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#92400e', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 16 }}>⚠️</span>
                <span>
                  After saving, <strong>Accounts team</strong> will be notified to confirm payment of <strong>AED {finalTotal}</strong>.
                  Plan is already activated — Accounts will mark it as paid.
                </span>
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={savePlan} disabled={savingPlan} style={{
              flex: 1, padding: 10,
              background: savingPlan ? 'var(--text3)' : 'var(--primary)',
              color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer'
            }}>
              {savingPlan ? 'Saving...' : selectedPlan === 'free' ? '✅ Set to Free' : '📤 Save & Notify Accounts'}
            </button>
            <button onClick={() => setPlanModal(null)} style={{ flex: 1, padding: 10, background: 'var(--bg)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {/* Edit Modal */}
      {editC && (
        <Modal title="Edit Company" onClose={() => setEditC(null)}>
          {['name', 'area', 'phone', 'whatsapp', 'email', 'description'].map(f => (
            <Field key={f} label={f} value={editC[f]} onChange={v => setEditC({ ...editC, [f]: v })} />
          ))}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Category</label>
            <select value={editC.category || ''} onChange={e => setEditC({ ...editC, category: e.target.value })} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, background: '#fff' }}>
              {CATS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={() => update(editC.id, editC)} style={{ flex: 1, padding: 10, background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Save</button>
            <button onClick={() => setEditC(null)} style={{ flex: 1, padding: 10, background: 'var(--bg)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          </div>
        </Modal>
      )}

      {/* Add Modal */}
      {addModal && (
        <Modal title="Add New Company" onClose={() => setAddModal(false)}>
          {['name', 'area', 'phone', 'whatsapp', 'email', 'description'].map(f => (
            <Field key={f} label={f} value={newC[f]} onChange={v => setNewC({ ...newC, [f]: v })} />
          ))}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Category</label>
            <select value={newC.category} onChange={e => setNewC({ ...newC, category: e.target.value })} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, background: '#fff' }}>
              <option value="">Select category</option>
              {CATS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={addNew} style={{ flex: 1, padding: 10, background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Add Company</button>
            <button onClick={() => setAddModal(false)} style={{ flex: 1, padding: 10, background: 'var(--bg)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
