import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const ROLES = [
  { value: 'super_admin', label: 'Super Admin', color: '#4d90fe', desc: 'Full access — owner only' },
  { value: 'admin',       label: 'Admin',       color: '#1e8e3e', desc: 'Manage companies & reviews' },
  { value: 'sales',       label: 'Sales',       color: '#e8b84b', desc: 'Mark plans as sold' },
  { value: 'accounts',    label: 'Accounts',    color: '#9c27b0', desc: 'Confirm payments' },
]

const PERMISSIONS = [
  { key: 'view_companies',    label: 'View Companies',       group: 'Companies' },
  { key: 'approve_companies', label: 'Approve / Reject',     group: 'Companies' },
  { key: 'edit_companies',    label: 'Edit Companies',       group: 'Companies' },
  { key: 'delete_companies',  label: 'Delete Companies',     group: 'Companies' },
  { key: 'view_reviews',      label: 'View Reviews',         group: 'Reviews' },
  { key: 'moderate_reviews',  label: 'Moderate Reviews',     group: 'Reviews' },
  { key: 'manage_plans',      label: 'Manage Plans',         group: 'Plans' },
  { key: 'approve_plans',     label: 'Approve Plan Payment', group: 'Plans' },
  { key: 'manage_categories', label: 'Manage Categories',    group: 'Settings' },
  { key: 'manage_employees',  label: 'Verify Employees',     group: 'Settings' },
  { key: 'bulk_upload',       label: 'Bulk Upload',          group: 'Settings' },
  { key: 'view_accounts',     label: 'View Accounts',        group: 'Accounts' },
  { key: 'manage_team',       label: 'Manage Team',          group: 'Admin Only' },
]

const ROLE_PRESETS = {
  admin:   ['view_companies','approve_companies','edit_companies','view_reviews','moderate_reviews','manage_categories','manage_employees','bulk_upload'],
  sales:   ['view_companies','manage_plans'],
  accounts:['view_companies','approve_plans','view_accounts'],
}

const emptyPerms = () => Object.fromEntries(PERMISSIONS.map(p => [p.key, false]))

export default function Team() {
  const [members, setMembers] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [addModal, setAddModal] = useState(false)
  const [editMember, setEditMember] = useState(null)
  const [newMember, setNewMember] = useState({ full_name: '', email: '', role: 'sales', permissions: emptyPerms() })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { fetchTeam() }, [])

  async function fetchTeam() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('admin_users').select('*').order('created_at')
    setMembers(data || [])
    const me = data?.find(m => m.email === user?.email)
    setCurrentUser(me)
    setLoading(false)
  }

  const isSuperAdmin = currentUser?.role === 'super_admin' || currentUser?.role === 'superadmin'

  async function addMember() {
    if (!newMember.full_name || !newMember.email) return
    setSaving(true)
    await supabase.from('admin_users').insert({
      full_name: newMember.full_name,
      email: newMember.email,
      role: newMember.role,
      permissions: newMember.permissions,
      is_active: true,
      added_by: currentUser?.email || 'super_admin'
    })
    setSaving(false)
    setAddModal(false)
    setNewMember({ full_name: '', email: '', role: 'sales', permissions: emptyPerms() })
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

  function applyRolePreset(role) {
    const perms = emptyPerms()
    const preset = ROLE_PRESETS[role] || []
    preset.forEach(p => perms[p] = true)
    return perms
  }

  const groups = [...new Set(PERMISSIONS.map(p => p.group))]
  const superAdminMembers = members.filter(m => m.role === 'super_admin' || m.role === 'superadmin')
  const otherMembers = members.filter(m => m.role !== 'super_admin' && m.role !== 'superadmin')

  const roleColor = (role) => ROLES.find(r => r.value === role)?.color || '#6b7280'
  const roleLabel = (role) => ROLES.find(r => r.value === role)?.label || role

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>Team Management</h1>
          <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>Manage staff access and roles</p>
        </div>
        {isSuperAdmin && (
          <button onClick={() => setAddModal(true)} style={{
            padding: '8px 16px', background: 'var(--primary)', color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer'
          }}>+ Add Staff Member</button>
        )}
      </div>

      {saved && (
        <div style={{ background: 'var(--green-light)', color: 'var(--green)', padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          ✓ Updated successfully!
        </div>
      )}

      {/* Roles info */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
        {ROLES.map(r => (
          <div key={r.value} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: r.color }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: r.color }}>{r.label}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{r.desc}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginTop: 6 }}>
              {members.filter(m => m.role === r.value || (r.value === 'super_admin' && m.role === 'superadmin')).length} staff
            </div>
          </div>
        ))}
      </div>

      {/* Super Admin Card */}
      {superAdminMembers.map(m => (
        <div key={m.id} style={{ background: 'linear-gradient(135deg, #1a1a2e, #252550)', borderRadius: 12, padding: 20, marginBottom: 16, border: '1px solid rgba(77,144,254,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(77,144,254,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="ti ti-crown" style={{ fontSize: 20, color: '#4d90fe' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{m.full_name} — Super Admin</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{m.email}</div>
            </div>
            <span style={{ background: 'rgba(77,144,254,0.2)', color: '#4d90fe', fontSize: 11, padding: '3px 10px', borderRadius: 10, fontWeight: 600 }}>
              Full Access
            </span>
          </div>
        </div>
      ))}

      {/* Team Members */}
      {loading ? <p style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Loading...</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {otherMembers.map(member => (
            <div key={member.id} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: 16, opacity: member.is_active ? 1 : 0.6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: roleColor(member.role) + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, color: roleColor(member.role) }}>
                  {(member.full_name || member.email).charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{member.full_name || 'No name'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 1 }}>{member.email}</div>
                </div>
                <span style={{ background: roleColor(member.role) + '20', color: roleColor(member.role), fontSize: 11, padding: '3px 10px', borderRadius: 10, fontWeight: 600 }}>
                  {roleLabel(member.role)}
                </span>
                <span style={{ background: member.is_active ? 'var(--green-light)' : '#fef2f2', color: member.is_active ? 'var(--green)' : '#ef4444', fontSize: 11, padding: '2px 8px', borderRadius: 10 }}>
                  {member.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
                {PERMISSIONS.map(p => {
                  const has = member.permissions?.[p.key]
                  return has ? (
                    <span key={p.key} style={{ background: 'var(--green-light)', color: 'var(--green)', fontSize: 11, padding: '2px 8px', borderRadius: 10 }}>
                      ✓ {p.label}
                    </span>
                  ) : null
                })}
              </div>

              {isSuperAdmin && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setEditMember({ ...member, permissions: { ...emptyPerms(), ...member.permissions } })} style={{ padding: '6px 14px', background: 'var(--primary-light)', color: 'var(--primary)', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                    Edit
                  </button>
                  <button onClick={() => toggleActive(member.id, member.is_active)} style={{ padding: '6px 14px', background: member.is_active ? '#fef9ed' : 'var(--green-light)', color: member.is_active ? '#92400e' : 'var(--green)', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                    {member.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => deleteMember(member.id)} style={{ padding: '6px 14px', background: '#fef2f2', color: '#ef4444', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                    Remove
                  </button>
                </div>
              )}
            </div>
          ))}
          {otherMembers.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)', fontSize: 13, background: '#fff', border: '1px solid var(--border)', borderRadius: 12 }}>
              No staff members yet. Add your first staff member!
            </div>
          )}
        </div>
      )}

      {/* Add Modal */}
      {addModal && (
        <StaffModal
          title="Add Staff Member"
          member={newMember}
          setMember={setNewMember}
          onSave={addMember}
          onClose={() => setAddModal(false)}
          saving={saving}
          isNew={true}
          applyRolePreset={applyRolePreset}
        />
      )}

      {/* Edit Modal */}
      {editMember && (
        <StaffModal
          title="Edit Staff Member"
          member={editMember}
          setMember={setEditMember}
          onSave={() => updateMember(editMember)}
          onClose={() => setEditMember(null)}
          saving={saving}
          isNew={false}
          applyRolePreset={applyRolePreset}
        />
      )}
    </div>
  )
}

function StaffModal({ title, member, setMember, onSave, onClose, saving, isNew, applyRolePreset }) {
  const groups = [...new Set(PERMISSIONS.map(p => p.group))]

  function togglePerm(key) {
    setMember({ ...member, permissions: { ...member.permissions, [key]: !member.permissions?.[key] } })
  }

  function handleRoleChange(role) {
    const perms = applyRolePreset(role)
    setMember({ ...member, role, permissions: perms })
  }

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
                placeholder="Staff member name"
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, outline: 'none' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Gmail Address *</label>
              <input value={member.email} onChange={e => setMember({ ...member, email: e.target.value })}
                placeholder="theirname@gmail.com"
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, outline: 'none' }} />
            </div>
          </>
        )}

        {/* Role selector */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', display: 'block', marginBottom: 8 }}>Role *</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {ROLES.filter(r => r.value !== 'super_admin').map(r => (
              <div key={r.value}
                onClick={() => handleRoleChange(r.value)}
                style={{
                  padding: '10px 14px', border: '2px solid ' + (member.role === r.value ? r.color : 'var(--border)'),
                  borderRadius: 8, cursor: 'pointer',
                  background: member.role === r.value ? r.color + '10' : '#fff'
                }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: member.role === r.value ? r.color : 'var(--text)' }}>{r.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{r.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Permissions */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', display: 'block', marginBottom: 8 }}>
            Custom Permissions
          </label>
          {groups.map(group => (
            <div key={group} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 6 }}>{group}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {PERMISSIONS.filter(p => p.group === group).map(perm => (
                  <label key={perm.key} onClick={() => togglePerm(perm.key)} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                    border: '1px solid ' + (member.permissions?.[perm.key] ? 'var(--green)' : 'var(--border)'),
                    borderRadius: 8, cursor: 'pointer',
                    background: member.permissions?.[perm.key] ? 'var(--green-light)' : '#fff',
                  }}>
                    <div style={{ width: 16, height: 16, borderRadius: 4, background: member.permissions?.[perm.key] ? 'var(--green)' : 'var(--bg)', border: '1px solid ' + (member.permissions?.[perm.key] ? 'var(--green)' : 'var(--border)'), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {member.permissions?.[perm.key] && <i className="ti ti-check" style={{ fontSize: 11, color: '#fff' }} />}
                    </div>
                    <span style={{ fontSize: 12, color: member.permissions?.[perm.key] ? 'var(--green)' : 'var(--text2)' }}>{perm.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onSave} disabled={saving} style={{ flex: 1, padding: 10, background: saving ? 'var(--text3)' : 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            {saving ? 'Saving...' : isNew ? 'Add Staff Member' : 'Save Changes'}
          </button>
          <button onClick={onClose} style={{ flex: 1, padding: 10, background: 'var(--bg)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
