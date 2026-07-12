import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import RevenueEngine from './pages/RevenueEngine'
import ControlWall from './pages/ControlWall'
import Companies from './pages/Companies'
import Reviews from './pages/Reviews'
import Categories from './pages/Categories'
import Employees from './pages/Employees'
import BulkUpload from './pages/BulkUpload'
import Plans from './pages/Plans'
import PlanFeatures from './pages/PlanFeatures'
import SubscriptionManager from './pages/SubscriptionManager'
import Team from './pages/Team'
import TeamVerification from './pages/TeamVerification'
import DocumentVerification from './pages/DocumentVerification'
import Applications from './pages/ApplicationsPage'
import PlanApprovals from './pages/PlanApprovals'
import Accounts from './pages/Accounts'
import PartnersPage from './pages/PartnersPage'
import SuperAdminAI from './pages/SuperAdminAI'
import Leads from './pages/Leads'
import LeadManagement from './pages/LeadManagement'
import LeadForms from './pages/LeadForms'
import Distribution from './pages/Distribution'
import Sidebar from './components/Sidebar'
import Users from './pages/Users'
import Reports from './pages/Reports'
import Disputes from './pages/Disputes'
import AiModeration from './pages/AiModeration'
import TrustScoreMonitor from './pages/TrustScoreMonitor'
import BusinessInsights from './pages/BusinessInsights'
import SystemHealth from './pages/SystemHealth'
import Notifications from './pages/Notifications'
import AdminInbox from './pages/AdminInbox'
import SponsorSlotsPage from './pages/SponsorSlotsPage'
import SuperAdminSettings from './pages/SuperAdminSettings'
import BadgeManager from './pages/BadgeManager'
import VerificationQueue from './pages/VerificationQueue'
import Analytics from './pages/Analytics'
import SeoInsights from './pages/SeoInsights'
import ClaimRequests from './pages/ClaimRequests'
import DuplicateClaims from './pages/DuplicateClaims'

const SAFE_TOP = 'env(safe-area-inset-top)'

// All valid page keys (used to validate the URL hash on load)
const VALID_PAGES = new Set([
  'dashboard','control_wall','revenue_engine','analytics','inbox','companies','reviews','leads','lead_forms','distribution','lead_management',
  'categories','employees','plans','plan_features','subscription','bulk','team','team_verification',
  'doc_verification','applications','verification','plan_approvals','accounts','users',
  'reports','disputes','ai_moderation','trust_score','business_insights','system_health',
  'notifications','sponsor_slots','settings','badges_manager','claim_requests','duplicate_claims',
  'ai_manager','partners','seo_insights',
])

// Read current page from the URL hash (e.g. #companies). Falls back to dashboard.
function getHashPage() {
  if (typeof window === 'undefined') return 'control_wall'
  const h = (window.location.hash || '').replace(/^#/, '').trim()
  return VALID_PAGES.has(h) ? h : 'control_wall'
}

export default function App() {
  const [session,    setSession]    = useState(null)
  const [isAdmin,    setIsAdmin]    = useState(false)
  const [adminData,  setAdminData]  = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [page,       setPage]       = useState(getHashPage)   // ← persists across refresh via URL hash
  const [planFilter, setPlanFilter] = useState('all')
  const [theme,      setTheme]      = useState(() => localStorage.getItem('admin_theme') || 'dark')

  // responsive + mobile drawer
  const [vw, setVw] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  // Tablet + phone (iPad portrait/landscape, phones) use the hamburger drawer.
  // Desktops / large laptops (≥1200px) keep the fixed sidebar.
  const isMobile = vw < 1200

  // Keep page in sync with the URL hash (browser back/forward + manual hash change)
  useEffect(() => {
    const onHash = () => setPage(getHashPage())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

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

  // navigate helper — updates URL hash (persistence) + closes the mobile drawer
  function goPage(p) {
    setPage(p)
    setSidebarOpen(false)
    if (typeof window !== 'undefined' && window.location.hash.replace(/^#/, '') !== p) {
      window.location.hash = p
    }
  }

  const isSuperAdmin = adminData?.role === 'superadmin' || adminData?.role === 'super_admin'
  const isSales      = adminData?.role === 'sales'    || isSuperAdmin
  const isAccounts   = adminData?.role === 'accounts' || isSuperAdmin
  const isDark       = theme === 'dark'

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background: isDark?'#0d1117':'#f0f4f8' }}>
      <div style={{ textAlign:'center' }}>
        <img src="/icon-512.png" alt="Quvera" width="72" height="72" style={{ display:'block', margin:'0 auto 12px', borderRadius:16 }} />
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16 }}>
          <div style={{ fontSize:24, fontWeight:700, color: isDark?'#f0fdf4':'#0f172a' }}>
            QUV<span style={{ color:'#4ade80' }}>ERA</span>
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

  const TOPBAR_H = 52

  return (
    <div style={{ display:'flex', minHeight:'100vh', background: isDark?'#0d1117':'#f0f4f8' }}>

      {/* Mobile drawer overlay */}
      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:99 }} />
      )}

      <Sidebar
        page={page}
        setPage={goPage}
        session={session}
        adminData={adminData}
        canAccess={canAccess}
        theme={theme}
        setTheme={setTheme}
        isMobile={isMobile}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Mobile fixed topbar (hamburger + brand) */}
      {isMobile && (
        <div style={{
          position:'fixed', top:0, left:0, right:0, zIndex:60,
          height:`calc(${TOPBAR_H}px + ${SAFE_TOP})`, paddingTop:SAFE_TOP,
          background: isDark?'#0d1117':'#ffffff',
          borderBottom:`0.5px solid ${isDark?'rgba(255,255,255,0.07)':'#e2e8f0'}`,
          display:'flex', alignItems:'center', gap:12, padding:`${SAFE_TOP} 14px 0`,
        }}>
          <button onClick={() => setSidebarOpen(true)} aria-label="Menu"
            style={{ width:36, height:36, borderRadius:8, border:`0.5px solid ${isDark?'rgba(255,255,255,0.1)':'#e2e8f0'}`, background: isDark?'#161b22':'#f8fafc', color: isDark?'#f0fdf4':'#0f172a', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <i className="ti ti-menu-2" style={{ fontSize:20 }} />
          </button>
          <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
            <div style={{ width:30, height:30, background:'linear-gradient(135deg,#0f6e56,#1d9e75)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L4 6V12C4 16.4 7.4 20.5 12 22C16.6 20.5 20 16.4 20 12V6L12 2Z" fill="rgba(255,255,255,0.15)" stroke="#4ade80" strokeWidth="1.5"/>
                <polyline points="8.5,12 11,14.5 15.5,10" fill="none" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{ fontSize:14, fontWeight:700, color: isDark?'#f0fdf4':'#0f172a', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              QUV<span style={{ color:'#4ade80' }}>ERA</span>
            </div>
          </div>
        </div>
      )}

      <div style={{
        flex:1,
        marginLeft: isMobile ? 0 : 210,
        padding: isMobile ? '14px' : 20,
        paddingTop: isMobile ? `calc(14px + ${TOPBAR_H}px + ${SAFE_TOP})` : 20,
        paddingBottom: `calc(${isMobile ? 14 : 20}px + env(safe-area-inset-bottom))`,
        background: isDark?'#0d1117':'#f0f4f8',
        minHeight:'100vh',
        overflowX:'hidden',
        maxWidth:'100%',
        minWidth:0,
      }}>
        {page === 'control_wall'      && <ControlWall onBack={() => goPage('dashboard')} theme={theme} embedded />}
        {page === 'dashboard'         && <Dashboard setPage={goPage} setPlanFilter={setPlanFilter} theme={theme} adminData={adminData} />}
        {page === 'revenue_engine'    && <RevenueEngine setPage={goPage} theme={theme} adminData={adminData} />}
        {page === 'analytics'         && <Analytics setPage={goPage} theme={theme} adminData={adminData} />}
        {page === 'seo_insights'      && isSuperAdmin && <SeoInsights setPage={goPage} theme={theme} adminData={adminData} />}
        {page === 'inbox'             && <AdminInbox theme={theme} adminData={adminData} />}
        {page === 'companies'         && <Companies canAccess={canAccess} initialPlanFilter={planFilter} />}
        {page === 'reviews'           && <Reviews canAccess={canAccess} />}
        {page === 'leads'             && <Leads />}
        {page === 'lead_management'   && isSuperAdmin && <LeadManagement theme={theme} adminData={adminData} />}
        {page === 'lead_forms'        && isSuperAdmin && <LeadForms theme={theme} />}
        {page === 'distribution'      && isSuperAdmin && <Distribution theme={theme} />}
        {page === 'categories'        && canAccess('manage_categories') && <Categories />}
        {page === 'employees'         && canAccess('manage_employees')  && <Employees />}
        {page === 'plans'             && canAccess('manage_plans')      && <Plans />}
        {page === 'plan_features'     && isSuperAdmin && <PlanFeatures />}
        {page === 'subscription'      && isSuperAdmin && <SubscriptionManager theme={theme} adminData={adminData} />}
        {page === 'bulk'              && canAccess('bulk_upload')       && <BulkUpload />}
        {page === 'team'              && isSuperAdmin && <Team />}
        {page === 'team_verification' && <TeamVerification theme={theme} adminData={adminData} />}
        {page === 'doc_verification'  && <DocumentVerification theme={theme} adminData={adminData} />}
        {page === 'applications'      && <Applications />}
        {page === 'verification'      && <VerificationQueue theme={theme} adminData={adminData} />}
        {page === 'claim_requests'    && <ClaimRequests theme={theme} adminData={adminData} />}
        {page === 'duplicate_claims'  && <DuplicateClaims />}
        {page === 'plan_approvals'    && (isSales || isAccounts || isSuperAdmin) && <PlanApprovals />}
        {page === 'accounts'          && (isAccounts || isSuperAdmin) && <Accounts />}
        {page === 'partners'          && (isAccounts || isSuperAdmin) && <PartnersPage theme={theme} />}
        {page === 'ai_manager'        && isSuperAdmin && <SuperAdminAI theme={theme} />}
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
