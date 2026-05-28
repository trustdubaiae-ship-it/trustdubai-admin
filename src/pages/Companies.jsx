import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const CATS = ['Interior Design','Renovation','Technical Contracting','Fit-Out','AC Service','Plumbing','Electrical','Cleaning','Painting','Handyman','Restaurant','Gym','Medical','Legal','Salon','Hotel','Other']

const PLANS = {
  free:     { label: 'Free',     color: '#6b7280', bg: '#f3f4f6' },
  silver:   { label: 'Silver',   color: '#94a3b8', bg: '#f1f5f9' },
  gold:     { label: 'Gold',     color: '#e8b84b', bg: '#fffdf7' },
  platinum: { label: 'Platinum', color: '#8b5cf6', bg: '#f5f3ff' },
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 480, maxHeight: '80vh', overflowY: 'auto' }}>
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

export default function Companies() {
  const [tab, setTab] = useState('approved')
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [editC, setEditC] = useState(null)
  const [addModal, setAddModal] = useState(false)
  const [planModal, setPlanModal] = useState(null)
  const [newC, setNewC] = useState({ name: '', category: '', area: '', phone: '', whatsapp: '', email: '', description: '' })

  useEffect(() => { fetchAll() }, [])

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
    setPlanModal(null)
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

  const pending  = companies.filter(c => c.status === 'pending' || c.status === 'under_review')
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
                {['Company', 'Category', 'Area', 'Plan', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayList.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)', fontSize: 13 }}>No companies</td></tr>
              ) : displayList.map(c => {
                const plan = PLANS[c.plan || 'free'] || PLANS.free
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
                        <button onClick={() => setPlanModal(c)} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer', background: plan.bg, color: plan.color }}>
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

      {/* Plan Change Modal */}
      {planModal && (
        <Modal title={'Change Plan — ' + planModal.name} onClose={() => setPlanModal(null)}>
          <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text2)' }}>
            Current plan: <strong style={{ color: PLANS[planModal.plan || 'free']?.color }}>{PLANS[planModal.plan || 'free']?.label}</strong>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            {Object.entries(PLANS).map(([key, p]) => (
              <div key={key} onClick={() => update(planModal.id, { plan: key })} style={{
                padding: '14px', border: '2px solid ' + ((planModal.plan || 'free') === key ? p.color : 'var(--border)'),
                borderRadius: 10, cursor: 'pointer', background: (planModal.plan || 'free') === key ? p.bg : '#fff',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: p.color }}>{p.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                  {key === 'free' ? 'AED 0' : key === 'silver' ? 'AED 149/mo' : key === 'gold' ? 'AED 349/mo' : 'AED 699/mo'}
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => setPlanModal(null)} style={{ width: '100%', padding: 10, background: 'var(--bg)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
            Cancel
          </button>
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
