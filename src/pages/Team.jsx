import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const PERMISSIONS = [
  { key: 'view_companies', label: 'View Companies', icon: 'ti-eye', group: 'Companies' },
  { key: 'approve_companies', label: 'Approve / Reject', icon: 'ti-check', group: 'Companies' },
  { key: 'edit_companies', label: 'Edit Companies', icon: 'ti-edit', group: 'Companies' },
  { key: 'delete_companies', label: 'Delete Companies', icon: 'ti-trash', group: 'Companies' },
  { key: 'view_reviews', label: 'View Reviews', icon: 'ti-eye', group: 'Reviews' },
  { key: 'moderate_reviews', label: 'Moderate Reviews', icon: 'ti-shield', group: 'Reviews' },
  { key: 'manage_categories', label: 'Manage Categories', icon: 'ti-category', group: 'Settings' },
  { key: 'manage_plans', label: 'Manage Plans & Badges', icon: 'ti-diamond', group: 'Settings' },
  { key: 'manage_employees', label: 'Verify Employees', icon: 'ti-users', group: 'Settings' },
  { key: 'bulk_upload', label: 'Bulk Upload', icon: 'ti-file-spreadsheet', group: 'Settings' },
  { key: 'manage_team', label: 'Manage Team', icon: 'ti-crown', group: 'Admin Only' },
]

const QUICK_ROLES = [
  { label: 'Secretary', color: '#9c27b0', perms: ['view_companies', 'view_reviews'] },
  { label: 'Sales', color: '#1a73e8', perms: ['view_companies', 'approve_companies', 'manage_plans'] },
  { label: 'Office Admin', color: '#1e8e3e', perms: ['view_companies', 'approve_companies', 'edit_companies', 'view_reviews', 'moderate_reviews', 'manage_categories', 'bulk_upload'] },
  { label: 'Doc Controller', color: '#f9a825', perms: ['view_companies', 'manage_employees'] },
]

const emptyPerms = () => Object.fromEntries(PERMISSIONS.map(p => [p.key, false]))

export default function Team() {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [addModal, setAddModal] = useState(false)
  const [editMember, setEditMember] = useState(null)
  const [newMember, setNewMember] = useState({ full_name: '', email: '', role: 'staff', permissions: emptyPerms() })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { fetchTeam() }, [])

  async function fetchTeam() {
    setLoading(true)
    const { data } = await supabase.from('admin_users').select('*').order('created_at')
    setMembers(data || [])
    setLoading(false)
  }

  async function addMember() {
    if (!newMember.full_name || !newMember.email) return
    setSaving(true)
    await supabase.from('admin_users').insert({
      full_name: newMember.full_name,
      email: newMember.email,
      role: newMember.role,
      permissions: newMember.permissions,
      is_active: true,
      added_by: 'superadmin'
    })
    setSaving(false)
    setAddModal(false)
    setNewMember({ full_name: '', email: '', role: 'staff', permissions: emptyPerms() })
    fetchTeam()
  }

  async function updateMember(member) {
    setSaving(true)
    await supabase.from('admin_users').update({
      full_name: member.full_name,
      role: member.role,
      permissions: member.permissions,
      is_active: member.is_active
    }).eq('id', member.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setEditMember(null)
    fetchTeam()
  }

  async function toggleActive(id, current) {
    await supabase.from('admin_users').update({ is_active: !current }).eq('id', id)
    fetchTeam()
  }

  async function deleteMember(id) {
    if (!confirm('Remove this team member?')) return
    await supabase.from('admin_users').delete().eq('id', id)
    fetchTeam()
  }

  function applyQuickRole(permsObj, quickRole) {
    const newPerms = emptyPerms()
    quickRole.perms.forEach(p => newPerms[p] = true)
    return newPerms
  }

  function togglePerm(obj, setObj, key) {
    setObj({ ...obj, permissions: { ...obj.permissions, [key]: !obj.permissions[key] } })
  }

  const groups = [...new Set(PERMISSIONS.map(p => p.group))]
  const isSuperAdmin = (m) => m.role === 'superadmin'

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>Team Management</h1>
          <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>Manage team access and permissions</p>
        </div>
        <button onClick={() => setAddModal(true)} style={{
          padding: '8px 16px', background: 'var(--primary)', color: '#fff',
          border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer'
        }}>+ Add Team Member</button>
      </div>

      {saved && (
        <div style={{ background: 'var(--green-light)', color: 'var(--green)', padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          ✓ Permissions updated!
        </div>
      )}

      {/* Super Admin Card */}
      <div style={{ background: 'linear-gradient(135deg, #1a1a2e, #252550)', borderRadius: 12, padding: 20, marginBottom: 20, border: '1px solid rgba(77,144,254,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(77,144,254,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="ti ti-crown" style={{ fontSize: 20, color: '#4d90fe' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>Nadeem Ali — Super Admin</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>trustdubai.ae@gmail.com</div>
          </div>
          <span style={{ background: 'rgba(77,144,254,0.2)', color: '#4d90fe', fontSize: 11, padding: '3px 10px', borderRadius: 10, fontWeight: 600 }}>
            Full Access
          </span>
        </div>
        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {PERMISSIONS.map(p => (
            <span key={p.key} style={{ background: 'rgba(77,144,254,0.1)', color: '#4d90fe', fontSize: 11, padding: '2px 8px', borderRadius: 10 }}>
              ✓ {p.label}
            </span>
          ))}
        </div>
      </div>

      {/* Team Members */}
      {loading ? <p style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Loading...</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {members.filter(m => !isSuperAdmin(m)).map(member => (
            <div key={member.id} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: 16, opacity: member.is_active ? 1 : 0.6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, color: 'var(--primary)' }}>
                  {(member.full_name || member.email).charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{member.full_name || 'No name'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 1 }}>{member.email}</div>
                </div>
                <span style={{ background: 'var(--bg)', color: 'var(--text2)', fontSize: 11, padding: '2px 8px', borderRadius: 10, textTransform: 'capitalize' }}>{member.role}</span>
                <span style={{ background: member.is_active ? 'var(--green-light)' : 'var(--red-light)', color: member.is_active ? 'var(--green)' : 'var(--red)', fontSize: 11, padding: '2px 8px', borderRadius: 10 }}>
                  {member.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Permissions display */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
                {PERMISSIONS.map(p => {
                  const hasAccess = member.permissions?.[p.key]
                  return (
                    <span key={p.key} style={{
                      background: hasAccess ? 'var(--green-light)' : 'var(--bg)',
                      color: hasAccess ? 'var(--green)' : 'var(--text3)',
                      fontSize: 11, padding: '2px 8px', borderRadius: 10
                    }}>
                      {hasAccess ? '✓' : '✗'} {p.label}
                    </span>
                  )
                })}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setEditMember({ ...member, permissions: { ...emptyPerms(), ...member.permissions } })} style={{ padding: '6px 14px', background: 'var(--primary-light)', color: 'var(--primary)', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                  Edit Permissions
                </button>
                <button onClick={() => toggleActive(member.id, member.is_active)} style={{ padding: '6px 14px', background: member.is_active ? 'var(--amber-light)' : 'var(--green-light)', color: member.is_active ? 'var(--amber)' : 'var(--green)', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                  {member.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button onClick={() => deleteMember(member.id)} style={{ padding: '6px 14px', background: 'var(--red-light)', color: 'var(--red)', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                  Remove
                </button>
              </div>
            </div>
          ))}
          {members.filter(m => !isSuperAdmin(m)).length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)', fontSize: 13 }}>
              No team members yet. Add your first team member!
            </div>
          )}
        </div>
      )}

      {/* Add Member Modal */}
      {addModal && (
        <PermissionModal
          title="Add Team Member"
          member={newMember}
          setMember={setNewMember}
          onSave={addMember}
          onClose={() => setAddModal(false)}
          saving={saving}
          isNew={true}
          togglePerm={(key) => togglePerm(newMember, setNewMember, key)}
          applyQuickRole={(qr) => setNewMember({ ...newMember, permissions: applyQuickRole(newMember.permissions, qr) })}
        />
      )}

      {/* Edit Member Modal */}
      {editMember && (
        <PermissionModal
          title="Edit Permissions"
          member={editMember}
          setMember={setEditMember}
          onSave={() => updateMember(editMember)}
          onClose={() => setEditMember(null)}
          saving={saving}
          isNew={false}
          togglePerm={(key) => togglePerm(editMember, setEditMember, key)}
          applyQuickRole={(qr) => setEditMember({ ...editMember, permissions: applyQuickRole(editMember.permissions, qr) })}
        />
      )}
    </div>
  )
}

function PermissionModal({ title, member, setMember, onSave, onClose, saving, isNew, togglePerm, applyQuickRole }) {
  const groups = [...new Set(PERMISSIONS.map(p => p.group))]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 560, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text3)' }}>×</button>
        </div>

        {isNew && (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Full Name *</label>
              <input value={member.full_name} onChange={e => setMember({ ...member, full_name: e.target.value })}
                placeholder="Team member name"
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, outline: 'none' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Gmail Address *</label>
              <input value={member.email} onChange={e => setMember({ ...member, email: e.target.value })}
                placeholder="theirname@gmail.com"
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, outline: 'none' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Role Title</label>
              <input value={member.role} onChange={e => setMember({ ...member, role: e.target.value })}
                placeholder="e.g. Secretary, Sales, Office Admin"
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, outline: 'none' }} />
            </div>
          </>
        )}

        {/* Quick Role Presets */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', display: 'block', marginBottom: 8 }}>Quick Role Presets</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {QUICK_ROLES.map(qr => (
              <button key={qr.label} onClick={() => applyQuickRole(qr)} style={{
                padding: '5px 12px', borderRadius: 16, border: `1px solid ${qr.color}`,
                background: 'transparent', color: qr.color, fontSize: 12, cursor: 'pointer', fontWeight: 500
              }}>{qr.label}</button>
            ))}
            <button onClick={() => setMember({ ...member, permissions: Object.fromEntries(PERMISSIONS.map(p => [p.key, true])) })} style={{
              padding: '5px 12px', borderRadius: 16, border: '1px solid var(--primary)',
              background: 'var(--primary)', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 500
            }}>Full Access</button>
            <button onClick={() => setMember({ ...member, permissions: Object.fromEntries(PERMISSIONS.filter(p => p.key !== 'manage_team').map(p => [p.key, false])) })} style={{
              padding: '5px 12px', borderRadius: 16, border: '1px solid var(--border)',
              background: 'var(--bg)', color: 'var(--text2)', fontSize: 12, cursor: 'pointer'
            }}>Clear All</button>
          </div>
        </div>

        {/* Permission Groups */}
        {groups.map(group => (
          <div key={group} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>
              {group}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {PERMISSIONS.filter(p => p.group === group).map(perm => (
                <label key={perm.key} onClick={() => togglePerm(perm.key)} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                  border: `1px solid ${member.permissions?.[perm.key] ? 'var(--green)' : 'var(--border)'}`,
                  borderRadius: 8, cursor: 'pointer',
                  background: member.permissions?.[perm.key] ? 'var(--green-light)' : '#fff',
                  transition: 'all 0.15s'
                }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: 4,
                    background: member.permissions?.[perm.key] ? 'var(--green)' : 'var(--bg)',
                    border: `1px solid ${member.permissions?.[perm.key] ? 'var(--green)' : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    {member.permissions?.[perm.key] && <i className="ti ti-check" style={{ fontSize: 12, color: '#fff' }} />}
                  </div>
                  <span style={{ fontSize: 12, color: member.permissions?.[perm.key] ? 'var(--green)' : 'var(--text2)', fontWeight: member.permissions?.[perm.key] ? 500 : 400 }}>
                    {perm.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button onClick={onSave} disabled={saving} style={{
            flex: 1, padding: 10, background: saving ? 'var(--text3)' : 'var(--primary)',
            color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer'
          }}>{saving ? 'Saving...' : isNew ? 'Add Team Member' : 'Save Permissions'}</button>
          <button onClick={onClose} style={{
            flex: 1, padding: 10, background: 'var(--bg)', color: 'var(--text2)',
            border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer'
          }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
