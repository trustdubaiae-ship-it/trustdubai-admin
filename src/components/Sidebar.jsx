import { supabase } from '../supabase'

export default function Sidebar({ page, setPage, session, adminData, canAccess, theme, setTheme }) {
  const isSuperAdmin = adminData?.role === 'superadmin' || adminData?.role === 'super_admin'
  const isSales      = adminData?.role === 'sales'    || isSuperAdmin
  const isAccounts   = adminData?.role === 'accounts' || isSuperAdmin
  const isDark       = theme === 'dark'

  const MENU = [
    { section: 'MAIN' },
    { id: 'dashboard',         icon: 'ti-layout-dashboard',  label: 'Dashboard',          show: true },
    { id: 'users',             icon: 'ti-users',             label: 'Customers',          show: isSuperAdmin },
    { id: 'companies',         icon: 'ti-building-store',    label: 'Businesses',         show: canAccess('view_companies') },
    { id: 'reviews',           icon: 'ti-star',              label: 'Reviews',            show: canAccess('view_reviews') },
    { id: 'applications',      icon: 'ti-file-description',  label: 'Applications',       show: true, badge: '3', badgeColor: '#f87171' },
    { id: 'leads',             icon: 'ti-address-book',      label: 'All Leads',          show: true },
    { id: 'reports',           icon: 'ti-flag',              label: 'Reports',            show: true },
    { section: 'MODERATION' },
    { id: 'ai_moderation',     icon: 'ti-stack',             label: 'Mod Queue',          show: isSuperAdmin, badge: '12', badgeColor: '#fbbf24' },
    { id: 'ai_moderation',     icon: 'ti-robot',             label: 'AI Moderation',      show: isSuperAdmin },
    { id: 'applications',      icon: 'ti-shield-check',      label: 'Verification',       show: true },
    { id: 'disputes',          icon: 'ti-alert-circle',      label: 'Disputes',           show: true, badge: '5', badgeColor: '#f87171' },
    { section: 'ANALYTICS' },
    { id: 'business_insights', icon: 'ti-chart-line',        label: 'Analytics',          show: true },
    { id: 'trust_score',       icon: 'ti-heart-rate-monitor',label: 'Trust Monitor',      show: true },
    { id: 'accounts',          icon: 'ti-chart-bar',         label: 'Business Insights',  show: isAccounts || isSuperAdmin },
    { id: 'system_health',     icon: 'ti-activity',          label: 'System Analytics',   show: isSuperAdmin },
    { section: 'MANAGEMENT' },
    { id: 'categories',        icon: 'ti-tag',               label: 'Categories',         show: canAccess('manage_categories') },
    { id: 'plans',             icon: 'ti-award',             label: 'Badges & Plans',     show: canAccess('manage_plans') },
    { id: 'employees',         icon: 'ti-id-badge',          label: 'Employees',          show: canAccess('manage_employees') },
    { id: 'notifications',     icon: 'ti-bell',              label: 'Notifications',      show: true },
    { id: 'bulk',              icon: 'ti-file-spreadsheet',  label: 'Bulk Upload',        show: canAccess('bulk_upload') },
    { section: 'SYSTEM' },
    { id: 'team',              icon: 'ti-crown',             label: 'Team',               show: isSuperAdmin },
    { id: 'system_health',     icon: 'ti-server',            label: 'System Health',      show: isSuperAdmin },
    { id: 'system_health',     icon: 'ti-settings',          label: 'Settings',           show: isSuperAdmin },
    { id: 'system_health',     icon: 'ti-lock',              label: 'Roles & Perms',      show: isSuperAdmin },
    { id: 'system_health',     icon: 'ti-notes',             label: 'Logs',               show: isSuperAdmin },
    { id: 'system_health',     icon: 'ti-api',               label: 'API Management',     show: isSuperAdmin },
  ].filter(m => m.section || m.show)

  // Theme-aware colors
  const SB = {
    bg:          isDark ? '#0d1117'               : '#1a2332',
    border:      isDark ? 'rgba(255,255,255,0.07)': 'rgba(255,255,255,0.08)',
    text:        '#f0fdf4',
    muted:       isDark ? '#374151'               : 'rgba(255,255,255,0.35)',
    section:     isDark ? '#1f2937'               : 'rgba(255,255,255,0.2)',
    activeBg:    isDark ? 'rgba(74,222,128,0.1)'  : 'rgba(74,222,128,0.15)',
    activeColor: '#4ade80',
    hoverBg:     isDark ? 'rgba(255,255,255,0.03)': 'rgba(255,255,255,0.06)',
    itemColor:   isDark ? '#6b7280'               : 'rgba(255,255,255,0.55)',
  }

  return (
    <div style={{ width:210, background:SB.bg, position:'fixed', top:0, left:0, height:'100vh', display:'flex', flexDirection:'column', zIndex:100, borderRight:`0.5px solid ${SB.border}`, transition:'background 0.2s' }}>

      {/* Logo */}
      <div style={{ padding:'16px 14px 14px', borderBottom:`0.5px solid ${SB.border}`, display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:36, height:36, background:'linear-gradient(135deg,#0f6e56,#1d9e75)', borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L4 6V12C4 16.4 7.4 20.5 12 22C16.6 20.5 20 16.4 20 12V6L12 2Z" fill="rgba(255,255,255,0.15)" stroke="#4ade80" strokeWidth="1.5"/>
            <polyline points="8.5,12 11,14.5 15.5,10" fill="none" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize:14, fontWeight:700, color:'#f0fdf4', letterSpacing:'-0.2px' }}>
            TRUST<span style={{ color:'#4ade80' }}>DUBAI</span>
          </div>
          <div style={{ fontSize:8.5, color:'#1d9e75', marginTop:1 }}>Super Admin Panel</div>
        </div>
      </div>

      {/* Dark / Light Toggle */}
      <div style={{ padding:'8px 10px', borderBottom:`0.5px solid ${SB.border}`, display:'flex', gap:5 }}>
        <button onClick={() => setTheme('dark')}
          style={{ flex:1, padding:'6px 0', borderRadius:7, border:'none', cursor:'pointer', fontSize:11, fontWeight:600, background:isDark?'rgba(74,222,128,0.15)':'rgba(255,255,255,0.06)', color:isDark?'#4ade80':'rgba(255,255,255,0.4)', display:'flex', alignItems:'center', justifyContent:'center', gap:5, transition:'all 0.15s' }}>
          <i className="ti ti-moon" style={{ fontSize:12 }}/> Dark
        </button>
        <button onClick={() => setTheme('light')}
          style={{ flex:1, padding:'6px 0', borderRadius:7, border:'none', cursor:'pointer', fontSize:11, fontWeight:600, background:!isDark?'rgba(74,222,128,0.15)':'rgba(255,255,255,0.06)', color:!isDark?'#4ade80':'rgba(255,255,255,0.4)', display:'flex', alignItems:'center', justifyContent:'center', gap:5, transition:'all 0.15s' }}>
          <i className="ti ti-sun" style={{ fontSize:12 }}/> Light
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex:1, padding:'6px 0', overflowY:'auto' }}>
        {MENU.map((item, i) => {
          if (item.section) return (
            <div key={i} style={{ fontSize:7.5, fontWeight:700, color:SB.section, letterSpacing:'0.08em', padding:'10px 16px 3px', textTransform:'uppercase' }}>
              {item.section}
            </div>
          )
          const isActive = page === item.id
          return (
            <div key={i} onClick={() => setPage(item.id)}
              style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 16px', cursor:'pointer', background:isActive?SB.activeBg:'transparent', borderRight:isActive?`2px solid ${SB.activeColor}`:'2px solid transparent', transition:'all 0.15s' }}
              onMouseEnter={e=>{ if(!isActive) e.currentTarget.style.background=SB.hoverBg }}
              onMouseLeave={e=>{ if(!isActive) e.currentTarget.style.background='transparent' }}
            >
              <i className={`ti ${item.icon}`} style={{ fontSize:13, color:isActive?SB.activeColor:SB.muted, flexShrink:0 }}/>
              <span style={{ fontSize:11, fontWeight:isActive?600:400, color:isActive?SB.activeColor:SB.itemColor, flex:1 }}>{item.label}</span>
              {item.badge && (
                <span style={{ background:item.badgeColor+'25', color:item.badgeColor, fontSize:8, fontWeight:700, padding:'1px 5px', borderRadius:99 }}>{item.badge}</span>
              )}
            </div>
          )
        })}
      </nav>

      {/* User Footer */}
      <div style={{ padding:'10px 14px', borderTop:`0.5px solid ${SB.border}`, display:'flex', alignItems:'center', gap:8 }}>
        <div style={{ width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg,#0f6e56,#1d9e75)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#fff', flexShrink:0 }}>
          {(adminData?.full_name||session?.user?.email||'A')[0].toUpperCase()}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:10, fontWeight:600, color:'#f0fdf4', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {adminData?.full_name||'Nadeem Ali'}
          </div>
          <div style={{ fontSize:8, color:'#1d9e75' }}>
            {isSuperAdmin ? 'Super Admin' : adminData?.role||'Staff'}
          </div>
        </div>
        <button onClick={() => supabase.auth.signOut()}
          style={{ width:24, height:24, borderRadius:6, background:'rgba(248,113,113,0.12)', border:'0.5px solid rgba(248,113,113,0.2)', color:'#f87171', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <i className="ti ti-logout" style={{ fontSize:12 }}/>
        </button>
      </div>

    </div>
  )
}
