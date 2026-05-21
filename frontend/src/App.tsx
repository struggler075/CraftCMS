import { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useBackendHealth } from './hooks/useBackendHealth'
import { useAuthStore } from './store/authStore'
import { authApi } from './services/api'
import SiteUnavailablePage from './pages/SiteUnavailablePage'
import Navbar from './components/layout/Navbar'
import Footer from './components/layout/Footer'
import HomePage from './pages/HomePage'
import ShopPage from './pages/ShopPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ProfilePage from './pages/ProfilePage'
import LauncherPage from './pages/LauncherPage'
import NotAuthorizedPage from './pages/NotAuthorizedPage'
import AdminLayout from './pages/admin/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminProducts from './pages/admin/AdminProducts'
import AdminServers from './pages/admin/AdminServers'
import AdminNews from './pages/admin/AdminNews'
import AdminCategories from './pages/admin/AdminCategories'
import AdminLauncher from './pages/admin/AdminLauncher'
import AdminSettings from './pages/admin/AdminSettings'
import AdminDonate from './pages/admin/AdminDonate'
import AdminUsers from './pages/admin/AdminUsers'
import AdminBridgePlugin from './pages/admin/AdminBridgePlugin'
import AdminPayments from './pages/admin/AdminPayments'
import AdminAuditLogs from './pages/admin/AdminAuditLogs'
import PaymentSuccessPage from './pages/PaymentSuccessPage'
import PaymentCancelPage from './pages/PaymentCancelPage'
import DonatePage from './pages/DonatePage'
import ServersPage from './pages/ServersPage'
import VerifyEmailPage from './pages/VerifyEmailPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import { useSiteSettings } from './store/siteSettingsStore'

export default function App() {
  const location = useLocation()
  const isAdmin = location.pathname.startsWith('/admin')
  const fetchSettings = useSiteSettings((s) => s.fetch)
  const { available, countdown, retry } = useBackendHealth()
  const token = useAuthStore((s) => s.token)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const ready = useAuthStore((s) => s.ready)
  const setUser = useAuthStore((s) => s.setUser)
  const setReady = useAuthStore((s) => s.setReady)
  const logout = useAuthStore((s) => s.logout)

  useEffect(() => {
    if (available) fetchSettings()
  }, [available])

  // Bootstrap revalidation: if we restored a token from localStorage, prove the
  // session is still valid against the live DB before showing authenticated UI.
  // The backend filter rejects tokens whose userId, username or tokenVersion
  // diverge from the row — covers deleted, renamed, blocked, password-rotated
  // and force-logged-out accounts.
  useEffect(() => {
    if (available !== true) return
    if (!token || !isAuthenticated) {
      setReady(true)
      return
    }
    let cancelled = false
    authApi.me()
      .then((u) => {
        if (cancelled) return
        setUser({
          id: u.id,
          username: u.username,
          email: u.email,
          role: u.role,
          balance: Number(u.balance ?? 0),
          emailVerified: u.emailVerified,
          skinUrl: u.skinUrl,
          capeUrl: u.capeUrl,
        })
        setReady(true)
      })
      .catch(() => {
        if (cancelled) return
        // 401 already triggered logout() in the axios interceptor; calling
        // it again is a no-op but guarantees state is clean for network errors.
        logout()
      })
    return () => { cancelled = true }
  }, [available, token, isAuthenticated])

  useEffect(() => { window.scrollTo(0, 0) }, [location.pathname])

  if (available === false) {
    return <SiteUnavailablePage countdown={countdown} onRetry={retry} />
  }

  if (available === null) return null

  // Hold render until session revalidation finishes — avoids a flash of
  // "authenticated" UI before the backend rejects a stale token.
  if (isAuthenticated && !ready) return null

  return (
    <div className="min-h-screen bg-c-bg flex flex-col">
      {!isAdmin && <Navbar />}

      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#15151e', color: '#fafafa', border: '1px solid rgba(255,255,255,0.07)', fontSize: '14px' },
          success: { iconTheme: { primary: '#22c55e', secondary: '#15151e' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#15151e' } },
        }}
      />

      <div className="flex-1">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/shop" element={<ShopPage />} />
        <Route path="/shop/:serverId" element={<ShopPage />} />
        <Route path="/launcher" element={<LauncherPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/donate" element={<DonatePage />} />
        <Route path="/donate/:serverId" element={<DonatePage />} />
        <Route path="/servers" element={<ServersPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/payment/success" element={<PaymentSuccessPage />} />
        <Route path="/payment/cancel" element={<PaymentCancelPage />} />
        <Route path="/403" element={<NotAuthorizedPage />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="servers" element={<AdminServers />} />
          <Route path="news" element={<AdminNews />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="launcher" element={<AdminLauncher />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="donate" element={<AdminDonate />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="bridge" element={<AdminBridgePlugin />} />
          <Route path="payments" element={<AdminPayments />} />
          <Route path="logs" element={<AdminAuditLogs />} />
        </Route>
        <Route path="*" element={<NotAuthorizedPage />} />
      </Routes>
      </div>

      {!isAdmin && <Footer />}
    </div>
  )
}
