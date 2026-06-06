// trustdubai-admin/src/components/Sidebar.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const SAFE_TOP = 'env(safe-area-inset-top)'

export default function Sidebar({ page, setPage, session, adminData, canAccess, theme, setTheme, isMobile = false, open = false, onClose }) {
  const isSuperAdmin = adminData?.role === 'superadmin' || adminData?.role === 'super_admin'
  const isSales      = adminData?.role === 'sales'    || isSuperAdmin
  const isAccounts   = adminData?.role === 'accounts' || isSuperAdmin
  const isDark       = theme === 'dark'

  // ---- Menu structure: flat items + collapsible groups ----
  const STRUCTURE = [
    { section: 'MAIN' },
    { id: 'control_wall',   icon: 'ti-layout-grid',           label: 'Control Wall',   show: true },
    { id: 'dashboard',      icon: 'ti-layout-dashboard',      label: 'Command Center', show: true },
    { id: 'revenue_engine', icon: 'ti-gauge',                 label: 'Revenue Engine', show: true },
    { id: 'inbox',         icon: 'ti-mail',              label: 'Inbox',        show: true },
    { id: 'notifications', icon: 'ti-bell',              label: 'Notifications',show: true },
    { id: 'companies',     icon: 'ti-building-store',    label: 'Businesses',   show: canAccess('view_companies') },
    { id: 'users',         icon: 'ti-users',             label: 'Customers',    show: isSuperAdmin },
    { id: 'reviews',       icon: 'ti-star',              label: 'Reviews',      show: canAccess('view_reviews') },

    { section: 'OPERATIONS' },
    { group: 'verification', icon: 'ti-shield-check', label: 'Verification', show: true, children: [
      { id: 'applications',      icon: 'ti-file-description',   label: 'Applications',    show: true, badge: '3', badgeColor: '#f87171' },
      { id: 'verification',      icon: 'ti-shield-check',       label: 'Company Verify',  show: true },
      { id: 'team_verification', icon: 'ti-user-check',         label: 'Team Verify',     show: true },
      { id: 'doc_verification',  icon: 'ti-file-certificate',   label: 'Doc Verify',      show: true },
    ]},
    { group: 'moderation', icon: 'ti-alert-circle', label: 'Moderation', show: true, children: [
      { id: 'disputes',      icon: 'ti-alert-circle', label: 'Disputes',      show: true, badge: '5', badgeColor: '#f87171' },
      { id: 'reports',       icon: 'ti-flag',         label: 'Reports',       show: true },
      { id: 'ai_moderation', icon: 'ti-robot',        label: 'AI Moderation', show: isSuperAdmin, badge: '12', badgeColor: '#fbbf24' },
    ]},

    { section: 'LEAD ENGINE' },
    { id: 'leads',         icon: 'ti-address-book',      label: 'All Leads',    show: true },
    { id: 'lead_forms',    icon: 'ti-forms',             label: 'Lead Forms',   show: isSuperAdmin },
    { id: 'distribution',  icon: 'ti-route',             label: 'Distribution', show: isSuperAdmin },

    { section: 'REVENUE' },
    { id: 'subscription',  icon: 'ti-adjustments-dollar', label: 'Subscription Manager', show: isSuperAdmin },
    { id: 'plan_approvals',icon: 'ti-credit-card',       label: 'Plan Approvals',     show: isSales || isAccounts || isSuperAdmin },
    { id: 'sponsor_slots', icon: 'ti-ad-2',              label: 'Sponsor Slots',      show: isSuperAdmin },
    { id: 'accounts',      icon: 'ti-report-money',      label: 'Revenue & Accounts', show: isAccounts || isSuperAdmin },

    { section: 'CONFIG' },
    { group: 'controlpanel', icon: 'ti-adjustments', label: 'Control Panel', show: true, children: [
      { id: 'categories',    icon: 'ti-tag',               label: 'Categories',    show: canAccess('manage_categories') },
      { id: 'plans',         icon: 'ti-award',             label: 'Badges & Plans',show: canAccess('manage_plans') },
      { id: 'plan_features', icon: 'ti-adjustments-check', label: 'Plan Features', show: isSuperAdmin },
      { id: 'badges_manager',icon: 'ti-medal',             label: 'Achievements',  show: isSuperAdmin },
      { id: 'employees',     icon: 'ti-id-badge',          label: 'Employees',     show: canAccess('manage_employees') },
      { id: 'bulk',          icon: 'ti-file-spreadsheet',  label: 'Bulk Upload',   show: canAccess('bulk_upload') },
      { id: 'settings',      icon: 'ti-settings',          label: 'Settings',      show: isSuperAdmin },
    ]},

    { section: 'SYSTEM' },
    { id: 'analytics',         icon: 'ti-chart-line',         label: 'Analytics',         show: isSuperAdmin },
    { id: 'business_insights', icon: 'ti-chart-arcs',         label: 'Business Insights', show: isSuperAdmin },
    { id: 'trust_score',   icon: 'ti-heart-rate-monitor', label: 'Trust Monitor',  show: isSuperAdmin },
    { id: 'team',          icon: 'ti-crown',              label: 'Team',           show: isSuperAdmin },
    { id: 'system_health', icon: 'ti-server',             label: 'System Health',  show: isSuperAdmin },
  ]

  function groupOfPage(pid) {
    for (const item of STRUCTURE) {
      if (item.group && item.children?.some(c => c.id === pid)) return item.group
    }
    return null
  }

  const [openGroup, setOpenGroup] = useState(() => groupOfPage(page))

  useEffect(() => {
    const g = groupOfPage(page)
    if (g) setOpenGroup(g)
  }, [page])

  const SB = {
    bg:                   isDark ? '#0d1117'                  : '#ffffff',
    border:               isDark ? 'rgba(255,255,255,0.07)'   : '#e2e8f0',
    logoText:             isDark ? '#f0fdf4'                  : '#0f172a',
    logoAccent:           isDark ? '#4ade80'                  : '#16a34a',
    logoSub:              isDark ? '#1d9e75'                  : '#16a34a',
    section:              isDark ? '#1f2937'                  : '#c8d3dc',
    itemColor:            isDark ? '#6b7280'                  : '#64748b',
    muted:                isDark ? '#374151'                  : '#94a3b8',
    activeBg:             isDark ? 'rgba(74,222,128,0.1)'     : 'rgba(22,163,74,0.07)',
    activeColor:          isDark ? '#4ade80'                  : '#16a34a',
    hoverBg:              isDark ? 'rgba(255,255,255,0.03)'   : '#f8fafc',
    toggleActiveBg:       isDark ? 'rgba(74,222,128,0.15)'    : 'rgba(22,163,74,0.1)',
    toggleActiveColor:    isDark ? '#4ade80'                  : '#16a34a',
    toggleInactiveBg:     isDark ? 'rgba(255,255,255,0.04)'   : '#f1f5f9',
    toggleInactiveColor:  isDark ? 'rgba(255,255,255,0.25)'   : '#94a3b8',
    footerBg:             isDark ? 'rgba(255,255,255,0.02)'   : '#f8fafc',
    footerText:           isDark ? '#f0fdf4'                  : '#0f172a',
    footerSub:            isDark ? '#1d9e75'                  : '#16a34a',
  }

  function renderItem(item, i, nested = false) {
    const activeStyle = page === item.id
    return (
      <div key={`${item.id}-${i}`} onClick={() => setPage(item.id)}
        style={{ display:'flex', alignItems:'center', gap:8, padding: nested ? '6px 16px 6px 34px' : '7px 16px',
          cursor:'pointer', background:activeStyle?SB.activeBg:'transparent',
          borderRight:activeStyle?`2px solid ${SB.activeColor}`:'2px solid transparent', transition:'all 0.15s' }}
        onMouseEnter={e=>{ if(page!==item.id) e.currentTarget.style.background=SB.hoverBg }}
        onMouseLeave={e=>{ if(page!==item.id) e.currentTarget.style.background='transparent' }}
      >
        <i className={`ti ${item.icon}`} style={{ fontSize:13, color:page===item.id?SB.activeColor:SB.muted, flexShrink:0 }}/>
        <span style={{ fontSize:11, fontWeight:page===item.id?600:400, color:page===item.id?SB.activeColor:SB.itemColor, flex:1 }}>{item.label}</span>
        {item.badge && (
          <span style={{ background:item.badgeColor+'25', color:item.badgeColor, fontSize:8, fontWeight:700, padding:'1px 5px', borderRadius:99 }}>{item.badge}</span>
        )}
      </div>
    )
  }

  function renderGroup(item, i) {
    const children = item.children.filter(c => c.show)
    if (children.length === 0) return null
    const isOpen = openGroup === item.group
    const containsActive = children.some(c => c.id === page)
    const badgeSum = children.reduce((n,c) => n + (c.badge ? parseInt(c.badge,10) || 0 : 0), 0)

    return (
      <div key={`grp-${i}`}>
        <div onClick={() => setOpenGroup(isOpen ? null : item.group)}
          style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 16px', cursor:'pointer',
            background: containsActive && !isOpen ? SB.activeBg : 'transparent',
            borderRight: containsActive && !isOpen ? `2px solid ${SB.activeColor}` : '2px solid transparent', transition:'all 0.15s' }}
          onMouseEnter={e=>{ if(!(containsActive && !isOpen)) e.currentTarget.style.background=SB.hoverBg }}
          onMouseLeave={e=>{ if(!(containsActive && !isOpen)) e.currentTarget.style.background='transparent' }}
        >
          <i className={`ti ${item.icon}`} style={{ fontSize:13, color: containsActive ? SB.activeColor : SB.muted, flexShrink:0 }}/>
          <span style={{ fontSize:11, fontWeight: containsActive ? 600 : 400, color: containsActive ? SB.activeColor : SB.itemColor, flex:1 }}>{item.label}</span>
          {badgeSum > 0 && !isOpen && (
            <span style={{ background:'#f8717125', color:'#f87171', fontSize:8, fontWeight:700, padding:'1px 5px', borderRadius:99 }}>{badgeSum}</span>
          )}
          <i className={`ti ${isOpen ? 'ti-chevron-down' : 'ti-chevron-right'}`} style={{ fontSize:12, color:SB.muted, flexShrink:0 }}/>
        </div>
        {isOpen && children.map((c, ci) => renderItem(c, `${i}-${ci}`, true))}
      </div>
    )
  }

  // mobile drawer transform
  const mobileTransform = isMobile ? (open ? 'translateX(0)' : 'translateX(-100%)') : 'none'

  return (
    <div style={{
      width:210, background:SB.bg, position:'fixed', top:0, left:0, height:'100vh',
      display:'flex', flexDirection:'column',
      zIndex: isMobile ? 100 : 100,
      borderRight:`0.5px solid ${SB.border}`,
      transition:'transform 0.25s ease, background 0.2s, border-color 0.2s',
      transform: mobileTransform,
      boxShadow: isMobile && open ? '0 0 30px rgba(0,0,0,0.35)' : 'none',
      paddingTop: SAFE_TOP,
    }}>

      <div style={{ padding:'16px 14px 14px', borderBottom:`0.5px solid ${SB.border}`, display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:36, height:36, background:'linear-gradient(135deg,#0f6e56,#1d9e75)', borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L4 6V12C4 16.4 7.4 20.5 12 22C16.6 20.5 20 16.4 20 12V6L12 2Z" fill="rgba(255,255,255,0.15)" stroke="#4ade80" strokeWidth="1.5"/>
            <polyline points="8.5,12 11,14.5 15.5,10" fill="none" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:14, fontWeight:700, color:SB.logoText, letterSpacing:'-0.2px' }}>
            TRUST<span style={{ color:SB.logoAccent }}>DUBAI</span>
          </div>
          <div style={{ fontSize:8.5, color:SB.logoSub, marginTop:1 }}>Super Admin Panel</div>
        </div>
        {isMobile && (
          <button onClick={onClose} aria-label="Close menu"
            style={{ width:28, height:28, borderRadius:7, border:`0.5px solid ${SB.border}`, background:'transparent', color:SB.itemColor, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <i className="ti ti-x" style={{ fontSize:16 }} />
          </button>
        )}
      </div>

      <div style={{ padding:'8px 10px', borderBottom:`0.5px solid ${SB.border}`, display:'flex', gap:5 }}>
        <button onClick={() => setTheme('dark')}
          style={{ flex:1, padding:'6px 0', borderRadius:7, border:'none', cursor:'pointer', fontSize:11, fontWeight:600, background:isDark?SB.toggleActiveBg:SB.toggleInactiveBg, color:isDark?SB.toggleActiveColor:SB.toggleInactiveColor, display:'flex', alignItems:'center', justifyContent:'center', gap:5, transition:'all 0.15s' }}>
          <i className="ti ti-moon" style={{ fontSize:12 }}/> Dark
        </button>
        <button onClick={() => setTheme('light')}
          style={{ flex:1, padding:'6px 0', borderRadius:7, border:'none', cursor:'pointer', fontSize:11, fontWeight:600, background:!isDark?SB.toggleActiveBg:SB.toggleInactiveBg, color:!isDark?SB.toggleActiveColor:SB.toggleInactiveColor, display:'flex', alignItems:'center', justifyContent:'center', gap:5, transition:'all 0.15s' }}>
          <i className="ti ti-sun" style={{ fontSize:12 }}/> Light
        </button>
      </div>

      <nav style={{ flex:1, padding:'6px 0', overflowY:'auto' }}>
        {STRUCTURE.map((item, i) => {
          if (item.section) return (
            <div key={`section-${i}`} style={{ fontSize:7.5, fontWeight:700, color:SB.section, letterSpacing:'0.08em', padding:'10px 16px 3px', textTransform:'uppercase' }}>
              {item.section}
            </div>
          )
          if (item.group) return renderGroup(item, i)
          if (item.show) return renderItem(item, i)
          return null
        })}
      </nav>

      <div style={{ padding:'10px 14px', borderTop:`0.5px solid ${SB.border}`, display:'flex', alignItems:'center', gap:8, background:SB.footerBg, paddingBottom:`calc(10px + env(safe-area-inset-bottom))` }}>
        <div style={{ width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg,#0f6e56,#1d9e75)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#fff', flexShrink:0 }}>
          {(adminData?.full_name||session?.user?.email||'A')[0].toUpperCase()}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:10, fontWeight:600, color:SB.footerText, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {adminData?.full_name||'Nadeem Ali'}
          </div>
          <div style={{ fontSize:8, color:SB.footerSub }}>
            {isSuperAdmin?'Super Admin':adminData?.role||'Staff'}
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
