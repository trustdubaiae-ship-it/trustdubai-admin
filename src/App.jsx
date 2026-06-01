import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Companies from './pages/Companies'
import Reviews from './pages/Reviews'
import Categories from './pages/Categories'
import Employees from './pages/Employees'
import BulkUpload from './pages/BulkUpload'
import Plans from './pages/Plans'
import PlanFeatures from './pages/PlanFeatures'
import Team from './pages/Team'
import Applications from './pages/ApplicationsPage'
import PlanApprovals from './pages/PlanApprovals'
import Accounts from './pages/Accounts'
import Leads from './pages/Leads'
import Sidebar from './components/Sidebar'
import Users from './pages/Users'
import Reports from './pages/Reports'
import Disputes from './pages/Disputes'
import AiModeration from './pages/AiModeration'
import TrustScoreMonitor from './pages/TrustScoreMonitor'
import BusinessInsights from './pages/BusinessInsights'
import SystemHealth from './pages/SystemHealth'
import Notifications from './pages/Notifications'
import SponsorSlotsPage from './pages/SponsorSlotsPage'
import SuperAdminSettings from './pages/SuperAdminSettings'
import BadgeManager from './pages/BadgeManager'
import VerificationQueue from './pages/VerificationQueue'

export default function App() {
  const [session,    setSession]    = useState(null)
  const [isAdmin,    setIsAdmin]    = useState(false)
  const [adminData,  setAdminData]  = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [page,       setPage]       = useState('dashboard')
  const [planFilter, setPlanFilter] = useState('all')
  const [theme,      setTheme]      = useState(() => localStorage.getItem('admin_theme') || 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.body.style.background = theme === 'dark' ? '#0d1117' : '#f0f4f8'
    localStorage.setItem('admin_theme', theme)
  }, [theme])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) checkAdmin(session.user.email)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) checkAdmin(session.user.email)
      else { setIsAdmin(false); setAdminData(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function checkAdmin(email) {
    const { data } = await supabase
      .from('admin_users').select('*').eq('email', email).eq('is_active', true).single()
    if (data) { setIsAdmin(true); setAdminData(data) }
    else { setIsAdmin(false); setAdminData(null) }
    setLoading(false)
  }

  function canAccess(permission) {
    if (!adminData) return false
    if (adminData.role === 'superadmin' || adminData.role === 'super_admin') return true
    return adminData.permissions?.[permission] === true
  }

  const isSuperAdmin = adminData?.role === 'superadmin' || adminData?.role === 'super_admin'
  const isSales      = adminData?.role === 'sales'    || isSuperAdmin
  const isAccounts   = adminData?.role === 'accounts' || isSuperAdmin
  const isDark       = theme === 'dark'

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background: isDark?'#0d1117':'#f0f4f8' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:16 }}>
          <div style={{ width:40, height:40, background:'linear-gradient(135deg,#0f6e56,#1d9e75)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L4 6V12C4 16.4 7.4 20.5 12 22C16.6 20.5 20 16.4 20 12V6L12 2Z" fill="rgba(255,255,255,0.15)" stroke="#4ade80" strokeWidth="1.5"/>
              <polyline points="8.5,12 11,14.5 15.5,10" fill="none" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{ fontSize:24, fontWeight:700, color: isDark?'#f0fdf4':'#0f172a' }}>
            TRUST<span style={{ color:'#4ade80' }}>DUBAI</span>
          </div>
        </div>
        <div style={{ width:36, height:36, border:'3px solid #4ade80', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 12px' }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ fontSize:13, color: isDark?'#374151':'#94a3b8' }}>Loading Super Admin Panel...</div>
      </div>
    </div>
  )

  if (!session) return <Login />

  if (!isAdmin) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background: isDark?'#0d1117':'#f0f4f8' }}>
      <div style={{ textAlign:'center', padding:40, background: isDark?'#161b22':'#ffffff', border:`0.5px solid ${isDark?'rgba(255,255,255,0.07)':'#e2e8f0'}`, borderRadius:16 }}>
        <div style={{ width:56, height:56, background:'rgba(248,113,113,0.12)', borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
          <i className="ti ti-lock" style={{ fontSize:28, color:'#f87171' }}/>
        </div>
        <div style={{ fontSize:18, fontWeight:700, marginBottom:8, color: isDark?'#f0fdf4':'#0f172a' }}>Access Denied</div>
        <div style={{ fontSize:13, color: isDark?'#374151':'#94a3b8', marginBottom:24 }}>You are not authorized to access this panel.</div>
        <button onClick={() => supabase.auth.signOut()}
          style={{ padding:'10px 24px', background:'rgba(248,113,113,0.12)', color:'#f87171', border:'0.5px solid rgba(248,113,113,0.2)', borderRadius:8, cursor:'pointer', fontSize:13 }}>
          Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ display:'flex', minHeight:'100vh', background: isDark?'#0d1117':'#f0f4f8' }}>
      <Sidebar page={page} setPage={setPage} session={session} adminData={adminData} canAccess={canAccess} theme={theme} setTheme={setTheme} />
      <div style={{ flex:1, marginLeft:210, padding:20, background: isDark?'#0d1117':'#f0f4f8', minHeight:'100vh', overflowX:'hidden' }}>
        {page === 'dashboard'         && <Dashboard setPage={setPage} setPlanFilter={setPlanFilter} theme={theme} adminData={adminData} />}
        {page === 'companies'         && <Companies canAccess={canAccess} initialPlanFilter={planFilter} />}
        {page === 'reviews'           && <Reviews canAccess={canAccess} />}
        {page === 'leads'             && <Leads />}
        {page === 'categories'        && canAccess('manage_categories') && <Categories />}
        {page === 'employees'         && canAccess('manage_employees')  && <Employees />}
        {page === 'plans'             && canAccess('manage_plans')      && <Plans />}
        {page === 'plan_features'     && isSuperAdmin && <PlanFeatures />}
        {page === 'bulk'              && canAccess('bulk_upload')       && <BulkUpload />}
        {page === 'team'              && isSuperAdmin && <Team />}
        {page === 'applications'      && <Applications />}
        {page === 'verification'      && <VerificationQueue theme={theme} adminData={adminData} />}
        {page === 'plan_approvals'    && (isSales || isAccounts || isSuperAdmin) && <PlanApprovals />}
        {page === 'accounts'          && (isAccounts || isSuperAdmin) && <Accounts />}
        {page === 'users'             && isSuperAdmin && <Users />}
        {page === 'reports'           && <Reports />}
        {page === 'disputes'          && <Disputes />}
        {page === 'ai_moderation'     && isSuperAdmin && <AiModeration />}
        {page === 'trust_score'       && <TrustScoreMonitor />}
        {page === 'business_insights' && <BusinessInsights />}
        {page === 'system_health'     && isSuperAdmin && <SystemHealth />}
        {page === 'notifications'     && <Notifications />}
        {page === 'sponsor_slots'     && isSuperAdmin && <SponsorSlotsPage />}
        {page === 'settings'          && isSuperAdmin && <SuperAdminSettings theme={theme} />}
        {page === 'badges_manager'    && isSuperAdmin && <BadgeManager theme={theme} />}
      </div>
    </div>
  )
}
