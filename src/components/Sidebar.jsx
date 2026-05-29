import { supabase } from '../supabase'

export default function Sidebar({ page, setPage, session, adminData, canAccess, theme, setTheme }) {
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
    { section: 'MAIN' },
    { id: 'dashboard',         icon: 'ti-layout-dashboard', label: 'Dashboard',          show: true },
    { id: 'applications',      icon: 'ti-clipboard-list',   label: 'Applications',       show: true },
    { id: 'companies',         icon: 'ti-building',         label: 'Businesses',         show: canAccess('view_companies') },
    { id: 'users',             icon: 'ti-users',            label: 'Users',              show: isSuperAdmin },
    { id: 'reviews',           icon: 'ti-star',             label: 'Reviews',            show: canAccess('view_reviews') },
    { id: 'leads',             icon: 'ti-address-book',     label: 'All Leads',          show: true },
    { id: 'reports',           icon: 'ti-flag',             label: 'Reports',            show: true },
    { id: 'disputes',          icon: 'ti-scale',            label: 'Disputes',           show: true },

    { section: 'MODERATION' },
    { id: 'ai_moderation',     icon: 'ti-robot',            label: 'AI Moderation',      show: isSuperAdmin },
    { id: 'plan_approvals',    icon: 'ti-credit-card',      label: 'Plan Approvals',     show: isSales || isAccounts || isSuperAdmin },

    { section: 'ANALYTICS' },
    { id: 'accounts',          icon: 'ti-report-money',     label: 'Revenue',            show: isAccounts || isSuperAdmin },
    { id: 'trust_score',       icon: 'ti-shield-check',     label: 'Trust Score',        show: true },
    { id: 'business_insights', icon: 'ti-chart-bar',        label: 'Business Insights',  show: true },

    { section: 'MANAGEMENT' },
    { id: 'categories',        icon: 'ti-category',         label: 'Categories',         show: canAccess('manage_categories') },
    { id: 'plans',             icon: 'ti-diamond',          label: 'Plans & Badges',     show: canAccess('manage_plans') },
    { id: 'employees',         icon: 'ti-id-badge',         label: 'Employees',          show: canAccess('manage_employees') },
    { id: 'notifications',     icon: 'ti-bell',             label: 'Notifications',      show: true },
    { id: 'bulk',              icon: 'ti-file-spreadsheet', label: 'Bulk Upload',        show: canAccess('bulk_upload') },

    { section: 'SYSTEM' },
    { id: 'team',              icon: 'ti-crown',            label: 'Team',               show: isSuperAdmin },
    { id: 'system_health',     icon: 'ti-activity',         label: 'System Health',      show: isSuperAdmin },
  ].filter(m => m.section || m.show)

  const isDark = theme === 'dark'

  const sidebarBg = isDark ? '#0f172a' : '#ffffff'
  const sidebarBorder = isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'
  const textPrimary = isDark ? '#ffffff' : '#111827'
  const textMuted = isDark ? 'rgba(255,255,255,0.4)' : '#9ca3af'
  const activeItemBg = isDark ? 'rgba(3,193,245,0.15)' : '#e0f9ff'
  const hoverBg = isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6'
  const iconMuted = isDark ? 'rgba(255,255,255,0.4)' : '#9ca3af'
  const sectionColor = isDark ? 'rgba(255,255,255,0.2)' : '#d1d5db'

  return (
    <div style={{ width: 240, background: sidebarBg, position: 'fixed', top: 0, left: 0, height: '100vh', display: 'flex', flexDirection: 'column', zIndex: 100, borderRight: '1px solid ' + sidebarBorder, transition: 'background 0.2s' }}>

      {/* Logo */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid ' + sidebarBorder, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: textPrimary }}>
            Trust<span style={{ color: '#03C1F5' }}>Dubai</span>
          </div>
          <div style={{ fontSize: 10, color: textMuted, marginTop: 1 }}>Admin Panel</div>
        </div>
        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid ' + sidebarBorder, background: isDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isDark ? '#fff' : '#374151', fontSize: 14 }}
          title={isDark ? 'Switch to Light' : 'Switch to Dark'}
        >
          <i className={isDark ? 'ti ti-sun' : 'ti ti-moon'} />
        </button>
      </div>

      {/* Role Badge */}
      <div style={{ padding: '10px 20px', borderBottom: '1px solid ' + sidebarBorder }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: roleInfo.color }}>{roleInfo.label}</div>
        <div style={{ fontSize: 11, color: textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
          {adminData?.full_name || session?.user?.email}
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
        {MENU.map((item, i) => {
          if (item.section) return (
            <div key={i} style={{ fontSize: 10, fontWeight: 600, color: sectionColor, padding: '12px 20px 4px', letterSpacing: '0.08em' }}>
              {item.section}
            </div>
          )
          const isActive = page === item.id
          return (
            <div key={item.id} onClick={() => setPage(item.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 20px', cursor: 'pointer', margin: '1px 8px', borderRadius: 8, background: isActive ? activeItemBg : 'transparent', borderLeft: isActive ? '3px solid #03C1F5' : '3px solid transparent', transition: 'all 0.15s' }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = hoverBg }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
            >
              <i className={'ti ' + item.icon} style={{ fontSize: 16, color: isActive ? '#03C1F5' : iconMuted }} />
              <span style={{ fontSize: 12, fontWeight: 500, color: isActive ? (isDark ? '#fff' : '#111827') : (isDark ? 'rgba(255,255,255,0.6)' : '#6b7280') }}>
                {item.label}
              </span>
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid ' + sidebarBorder }}>
        <div style={{ fontSize: 10, color: textMuted, marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {session?.user?.email}
        </div>
        <button onClick={() => supabase.auth.signOut()} style={{ width: '100%', padding: '8px', background: 'rgba(217,48,37,0.12)', color: '#ef4444', border: '1px solid rgba(217,48,37,0.2)', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
          Sign Out
        </button>
      </div>
    </div>
  )
}
