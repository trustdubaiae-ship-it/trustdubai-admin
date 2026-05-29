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
import Team from './pages/Team'
import Applications from './pages/ApplicationsPage'
import PlanApprovals from './pages/PlanApprovals'
import Accounts from './pages/Accounts'
import Leads from './pages/Leads'
import Sidebar from './components/Sidebar'

export default function App() {
  const [session, setSession] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminData, setAdminData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState('dashboard')

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
  const isSales = adminData?.role === 'sales' || isSuperAdmin
  const isAccounts = adminData?.role === 'accounts' || isSuperAdmin

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--sidebar)' }}>
      <div style={{ textAlign: 'center', color: '#fff' }}>
        <div style={{ fontSize: 28, fontWeight: 600 }}>TrustDubai</div>
        <div style={{ fontSize: 14, opacity: 0.5, marginTop: 4 }}>Loading...</div>
      </div>
    </div>
  )

  if (!session) return <Login />

  if (!isAdmin) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--sidebar)' }}>
      <div style={{ textAlign: 'center', color: '#fff', padding: 40 }}>
        <i className="ti ti-lock" style={{ fontSize: 48, color: '#ff6b6b', display: 'block', marginBottom: 16 }} />
        <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Access Denied</div>
        <div style={{ fontSize: 14, opacity: 0.5, marginBottom: 24 }}>You are not authorized to access this panel.</div>
        <button onClick={() => supabase.auth.signOut()} style={{ padding: '10px 24px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
          Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar page={page} setPage={setPage} session={session} adminData={adminData} canAccess={canAccess} />
      <div style={{ flex: 1, marginLeft: 240, padding: 24, background: 'var(--bg)', minHeight: '100vh' }}>
        {page === 'dashboard'      && <Dashboard />}
        {page === 'companies'      && <Companies canAccess={canAccess} />}
        {page === 'reviews'        && <Reviews canAccess={canAccess} />}
        {page === 'leads'          && <Leads />}
        {page === 'categories'     && canAccess('manage_categories') && <Categories />}
        {page === 'employees'      && canAccess('manage_employees') && <Employees />}
        {page === 'plans'          && canAccess('manage_plans') && <Plans />}
        {page === 'bulk'           && canAccess('bulk_upload') && <BulkUpload />}
        {page === 'team'           && isSuperAdmin && <Team />}
        {page === 'applications'   && <Applications />}
        {page === 'plan_approvals' && (isSales || isAccounts || isSuperAdmin) && <PlanApprovals />}
        {page === 'accounts'       && (isAccounts || isSuperAdmin) && <Accounts />}
      </div>
    </div>
  )
}
