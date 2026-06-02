import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Categories() {
  const [cats, setCats] = useState([])
  const [requests, setRequests] = useState([])
  const [adding, setAdding] = useState(false)
  const [newCat, setNewCat] = useState({ name: '', type: 'minor', icon: '🔧' })
  const [busy, setBusy] = useState(null)
  const [approveModal, setApproveModal] = useState(null)  // request being approved
  const [appType, setAppType] = useState('minor')
  const [appIcon, setAppIcon] = useState('🔧')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const { data: c } = await supabase.from('categories').select('*').order('sort_order')
    setCats(c || [])
    const { data: r } = await supabase.from('category_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false })
    setRequests(r || [])
  }

  async function add() {
    if (!newCat.name) return
    const maxSort = cats.reduce((m, c) => Math.max(m, c.sort_order || 0), 0)
    await supabase.from('categories').insert({ ...newCat, is_active: true, sort_order: maxSort + 1 })
    setNewCat({ name: '', type: 'minor', icon: '🔧' })
    setAdding(false)
    fetchAll()
  }

  async function toggle(id, cur) {
    await supabase.from('categories').update({ is_active: !cur }).eq('id', id)
    fetchAll()
  }

  async function del(id) {
    if (!confirm('Delete?')) return
    await supabase.from('categories').delete().eq('id', id)
    fetchAll()
  }

  function openApprove(req) {
    setApproveModal(req)
    setAppType('minor')
    setAppIcon('🔧')
  }

  async function confirmApprove() {
    const req = approveModal
    if (!req) return
    setBusy(req.id)
    // 1. check duplicate (case-insensitive)
    const exists = cats.find(c => (c.name || '').toLowerCase() === req.requested_name.toLowerCase())
    if (exists) {
      // already exists — just mark request approved
      await supabase.from('category_requests').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', req.id)
    } else {
      const maxSort = cats.reduce((m, c) => Math.max(m, c.sort_order || 0), 0)
      const { error } = await supabase.from('categories').insert({
        name: req.requested_name.trim(), type: appType, icon: appIcon || '🔧', is_active: true, sort_order: maxSort + 1,
      })
      if (error) { alert('Failed: ' + error.message); setBusy(null); return }
      await supabase.from('category_requests').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', req.id)
    }
    setBusy(null)
    setApproveModal(null)
    fetchAll()
  }

  async function reject(req) {
    if (!confirm(`Reject "${req.requested_name}"?`)) return
    setBusy(req.id)
    await supabase.from('category_requests').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', req.id)
    setBusy(null)
    fetchAll()
  }

  const major = cats.filter(c => c.type === 'major')
  const minor = cats.filter(c => c.type === 'minor')

  const Row = ({ cat, i, arr }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
      <span style={{ fontSize: 22 }}>{cat.icon}</span>
      <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 500 }}>{cat.name}</div></div>
      <span style={{ background: cat.is_active ? 'var(--green-light)' : 'var(--red-light)', color: cat.is_active ? 'var(--green)' : 'var(--red)', fontSize: 11, padding: '2px 8px', borderRadius: 10 }}>{cat.is_active ? 'Active' : 'Inactive'}</span>
      <button onClick={() => toggle(cat.id, cat.is_active)} style={{ padding: '4px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>{cat.is_active ? 'Disable' : 'Enable'}</button>
      <button onClick={() => del(cat.id)} style={{ padding: '4px 10px', background: 'var(--red-light)', border: 'none', borderRadius: 6, fontSize: 12, color: 'var(--red)', cursor: 'pointer' }}>Delete</button>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div><h1 style={{ fontSize: 22, fontWeight: 600 }}>Categories</h1><p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>Manage service categories</p></div>
        <button onClick={() => setAdding(true)} style={{ padding: '8px 16px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>+ Add Category</button>
      </div>

      {/* PENDING REQUESTS */}
      {requests.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ background: 'rgba(251,191,36,0.15)', color: '#d97706', fontSize: 11, padding: '3px 10px', borderRadius: 10, fontWeight: 600 }}>PENDING REQUESTS · {requests.length}</span>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>Category requests from businesses</span>
          </div>
          <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            {requests.map((req, i) => (
              <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < requests.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{req.requested_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                    by {req.company_name || 'Unknown'}{req.note ? ` · "${req.note}"` : ''} · {new Date(req.created_at).toLocaleDateString('en-GB')}
                  </div>
                </div>
                <button onClick={() => openApprove(req)} disabled={busy === req.id}
                  style={{ padding: '5px 14px', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Approve</button>
                <button onClick={() => reject(req)} disabled={busy === req.id}
                  style={{ padding: '5px 12px', background: 'var(--red-light)', color: 'var(--red)', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Reject</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {adding && <div style={{ background: '#fff', border: '1px solid var(--primary)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>New Category</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: 12, marginBottom: 12 }}>
          <input value={newCat.name} onChange={e => setNewCat({ ...newCat, name: e.target.value })} placeholder="Category name" style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, outline: 'none' }} />
          <select value={newCat.type} onChange={e => setNewCat({ ...newCat, type: e.target.value })} style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, outline: 'none', background: '#fff' }}>
            <option value="major">Major</option><option value="minor">Minor</option>
          </select>
          <input value={newCat.icon} onChange={e => setNewCat({ ...newCat, icon: e.target.value })} placeholder="🔧" style={{ padding: '8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 18, outline: 'none', textAlign: 'center' }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={add} style={{ padding: '8px 20px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>Add</button>
          <button onClick={() => setAdding(false)} style={{ padding: '8px 20px', background: 'var(--bg)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
        </div>
      </div>}

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ background: '#e8f0fe', color: 'var(--primary)', fontSize: 11, padding: '3px 10px', borderRadius: 10, fontWeight: 600 }}>MAJOR SERVICES</span>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>Project-based, high value</span>
        </div>
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          {major.length === 0 ? <p style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>No major categories</p> : major.map((cat, i) => <Row key={cat.id} cat={cat} i={i} arr={major} />)}
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ background: 'var(--green-light)', color: 'var(--green)', fontSize: 11, padding: '3px 10px', borderRadius: 10, fontWeight: 600 }}>MINOR SERVICES</span>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>Quick, local-based</span>
        </div>
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          {minor.length === 0 ? <p style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>No minor categories</p> : minor.map((cat, i) => <Row key={cat.id} cat={cat} i={i} arr={minor} />)}
        </div>
      </div>

      {/* Approve modal — set type + icon before adding */}
      {approveModal && (
        <div onClick={() => setApproveModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 420, padding: 22 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Approve Category</h3>
            <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>Requested by {approveModal.company_name || 'a business'}</p>

            <label style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600, display: 'block', marginBottom: 5 }}>Category Name</label>
            <input value={approveModal.requested_name} disabled style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, marginBottom: 14, boxSizing: 'border-box', background: 'var(--bg)' }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 12, marginBottom: 18 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600, display: 'block', marginBottom: 5 }}>Type</label>
                <select value={appType} onChange={e => setAppType(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', boxSizing: 'border-box' }}>
                  <option value="major">Major</option><option value="minor">Minor</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600, display: 'block', marginBottom: 5 }}>Icon</label>
                <input value={appIcon} onChange={e => setAppIcon(e.target.value)} placeholder="🔧" style={{ width: '100%', padding: '9px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 18, outline: 'none', textAlign: 'center', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={confirmApprove} disabled={busy === approveModal.id}
                style={{ flex: 1, padding: '10px', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {busy === approveModal.id ? 'Adding...' : 'Approve & Add'}
              </button>
              <button onClick={() => setApproveModal(null)}
                style={{ flex: 1, padding: '10px', background: 'var(--bg)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
