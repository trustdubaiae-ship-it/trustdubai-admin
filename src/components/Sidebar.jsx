import { supabase } from '../supabase'

export default function Sidebar({ page, setPage, session, adminData, canAccess }) {
  const isSuperAdmin = adminData?.role === 'superadmin'

  const MENU = [
    { id: 'dashboard', icon: 'ti-dashboard', label: 'Dashboard', show: true },
    { id: 'companies', icon: 'ti-building', label: 'Companies', show: canAccess('view_companies') },
    { id: 'reviews', icon: 'ti-star', label: 'Reviews', show: canAccess('view_reviews') },
    { id: 'categories', icon: 'ti-category', label: 'Categories', show: canAccess('manage_categories') },
    { id: 'employees', icon: 'ti-users', label: 'Employees', show: canAccess('manage_employees') },
    { id: 'plans', icon: 'ti-diamond', label: 'Plans & Badges', show: canAccess('manage_plans') },
    { id: 'bulk', icon: 'ti-file-spreadsheet', label: 'Bulk Upload', show: canAccess('bulk_upload') },
    { id: 'team', icon: 'ti-crown', label: 'Team', show: isSuperAdmin },
    { id: 'applications', icon: 'ti-clipboard-list', label: 'Applications', show: true },
  ].filter(m => m.show)

  return (
    <div style={{ width:240, background:'var(--sidebar)', position:'fixed', top:0, left:0, height:'100vh', display:'flex', flexDirection:'column', zIndex:100 }}>
      <div style={{ padding:'20px 20px 16px', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ fontSize:20, fontWeight:600, color:'#fff' }}>Trust<span style={{ color:'#4d90fe' }}>Dubai</span></div>
        <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginTop:2 }}>Admin Panel</div>
      </div>

      {/* Role badge */}
      <div style={{ padding:'8px 20px', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
        <span style={{
          fontSize:11, padding:'2px 8px', borderRadius:10, fontWeight:600,
          background: isSuperAdmin ? 'rgba(77,144,254,0.2)' : 'rgba(255,255,255,0.08)',
          color: isSuperAdmin ? '#4d90fe' : 'rgba(255,255,255,0.4)'
        }}>
          {isSuperAdmin ? '👑 Super Admin' : adminData?.role || 'Staff'}
        </span>
      </div>

      <nav style={{ flex:1, padding:'12px 0', overflowY:'auto' }}>
        {MENU.map(item => (
          <div key={item.id} onClick={() => setPage(item.id)} style={{
            display:'flex', alignItems:'center', gap:10, padding:'10px 20px',
            cursor:'pointer', margin:'2px 8px', borderRadius:8,
            background: page===item.id ? 'rgba(77,144,254,0.15)' : 'transparent',
            borderLeft: page===item.id ? '3px solid #4d90fe' : '3px solid transparent',
            transition:'all 0.2s'
          }}>
            <i className={`ti ${item.icon}`} style={{ fontSize:18, color: page===item.id ? '#4d90fe' : 'rgba(255,255,255,0.5)' }} />
            <span style={{ fontSize:13, fontWeight:500, color: page===item.id ? '#fff' : 'rgba(255,255,255,0.5)' }}>{item.label}</span>
          </div>
        ))}
      </nav>

      <div style={{ padding:'12px 20px', borderTop:'1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {adminData?.full_name || session?.user?.email}
        </div>
        <div style={{ fontSize:11, color:'rgba(255,255,255,0.25)', marginBottom:8, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {session?.user?.email}
        </div>
        <button onClick={() => supabase.auth.signOut()} style={{ width:'100%', padding:'8px', background:'rgba(217,48,37,0.15)', color:'#ff6b6b', border:'1px solid rgba(217,48,37,0.3)', borderRadius:6, fontSize:12, fontWeight:500, cursor:'pointer' }}>
          Sign Out
        </button>
      </div>
    </div>
  )
}
