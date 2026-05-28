import { supabase } from '../supabase'

export default function Sidebar({ page, setPage, session, adminData, canAccess }) {
  const isSuperAdmin = adminData?.role === 'superadmin' || adminData?.role === 'super_admin'
  const isSales = adminData?.role === 'sales' || isSuperAdmin
  const isAccounts = adminData?.role === 'accounts' || isSuperAdmin

  const roleConfig = {
    super_admin: { label: '👑 Super Admin', color: '#4d90fe' },
    superadmin:  { label: '👑 Super Admin', color: '#4d90fe' },
    admin:       { label: '🛡️ Admin',       color: '#1e8e3e' },
    sales:       { label: '💼 Sales',       color: '#e8b84b' },
    accounts:    { label: '💰 Accounts',    color: '#9c27b0' },
  }
  const roleInfo = roleConfig[adminData?.role] || { label: adminData?.role || 'Staff', color: 'rgba(255,255,255,0.4)' }

  const MENU = [
    { id: 'dashboard',      icon: 'ti-dashboard',        label: 'Dashboard',       show: true },
    { id: 'applications',   icon: 'ti-clipboard-list',   label: 'Applications',    show: true },
    { id: 'companies',      icon: 'ti-building',         label: 'Companies',       show: canAccess('view_companies') },
    { id: 'plan_approvals', icon: 'ti-credit-card',      label: 'Plan Approvals',  show: isSales || isAccounts || isSuperAdmin },
    { id: 'reviews',        icon: 'ti-star',             label: 'Reviews',         show: canAccess('view_reviews') },
    { id: 'categories',     icon: 'ti-category',         label: 'Categories',      show: canAccess('manage_categories') },
    { id: 'employees',      icon: 'ti-users',            label: 'Employees',       show: canAccess('manage_employees') },
    { id: 'plans',          icon: 'ti-diamond',          label: 'Plans & Badges',  show: canAccess('manage_plans') },
    { id: 'bulk',           icon: 'ti-file-spreadsheet', label: 'Bulk Upload',     show: canAccess('bulk_upload') },
    { id: 'team',           icon: 'ti-crown',            label: 'Team',            show: isSuperAdmin },
  ].filter(m => m.show)

  return (
    <div style={{ width: 240, background: 'var(--sidebar)', position: 'fixed', top: 0, left: 0, height: '100vh', display: 'flex', flexDirection: 'column', zIndex: 100 }}>
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ fontSize: 20, fontWeight: 600, color: '#fff' }}>Trust<span style={{ color: '#03C1F5' }}>Dubai</span></div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Admin Panel</div>
      </div>

      {/* Role badge */}
      <div style={{ padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: roleInfo.color, marginBottom: 2 }}>
          {roleInfo.label}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {adminData?.full_name || session?.user?.email}
        </div>
      </div>

      <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
        {MENU.map(item => (
          <div key={item.id} onClick={() => setPage(item.id)} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px',
            cursor: 'pointer', margin: '2px 8px', borderRadius: 8,
            background: page === item.id ? 'rgba(3,193,245,0.15)' : 'transparent',
            borderLeft: page === item.id ? '3px solid #03C1F5' : '3px solid transparent',
            transition: 'all 0.2s'
          }}>
            <i className={'ti ' + item.icon} style={{ fontSize: 18, color: page === item.id ? '#03C1F5' : 'rgba(255,255,255,0.5)' }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: page === item.id ? '#fff' : 'rgba(255,255,255,0.5)' }}>
              {item.label}
            </span>
          </div>
        ))}
      </nav>

      <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {session?.user?.email}
        </div>
        <button onClick={() => supabase.auth.signOut()} style={{ width: '100%', padding: '8px', background: 'rgba(217,48,37,0.15)', color: '#ff6b6b', border: '1px solid rgba(217,48,37,0.3)', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
          Sign Out
        </button>
      </div>
    </div>
  )
}
