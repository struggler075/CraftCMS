import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useSiteSettings } from '../../store/siteSettingsStore'
import {
  LayoutDashboard, Package, Server, Newspaper,
  Tag, LogOut, ArrowLeft, ShieldCheck, Download, Settings, Gem, Users, Menu, X, Plug, CreditCard
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

const navItems = [
  { label: 'Дашборд', href: '/admin', icon: LayoutDashboard, exact: true },
  { label: 'Товары', href: '/admin/products', icon: Package },
  { label: 'Категории', href: '/admin/categories', icon: Tag },
  { label: 'Серверы', href: '/admin/servers', icon: Server },
  { label: 'Новости', href: '/admin/news', icon: Newspaper },
  { label: 'Лаунчер', href: '/admin/launcher', icon: Download },
  { label: 'Пользователи', href: '/admin/users', icon: Users },
  { label: 'Донат', href: '/admin/donate', icon: Gem },
  { label: 'Платежи', href: '/admin/payments', icon: CreditCard },
  { label: 'Настройки', href: '/admin/settings', icon: Settings },
  { label: 'Серверный Плагин', href: '/admin/bridge', icon: Plug },
]

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const siteName = useSiteSettings((s) => s.settings.siteName)

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b border-c-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-c-primary rounded-md flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-c-text">{siteName}</div>
            <div className="text-xs text-c-t3">Admin Panel</div>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-c-t3 hover:text-c-t2 cursor-pointer ml-2">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = item.exact
            ? location.pathname === item.href
            : location.pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={onClose}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors duration-150 cursor-pointer
                ${isActive ? 'bg-c-primary/15 text-c-primary' : 'text-c-t2 hover:text-c-text hover:bg-white/5'}`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="p-2 border-t border-c-border space-y-0.5">
        <Link
          to="/"
          onClick={onClose}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-c-t2 hover:text-c-text hover:bg-white/5 transition-colors duration-150 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          На сайт
        </Link>
        <button
          onClick={() => { logout(); navigate('/') }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-c-t2 hover:text-c-red hover:bg-c-red/10 transition-colors duration-150 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          Выйти
        </button>
      </div>

      {/* User */}
      <div className="px-3 pb-3">
        <div className="bg-c-bg2 border border-c-border rounded-lg px-3 py-2">
          <div className="text-xs text-c-t3">Вы вошли как</div>
          <div className="text-sm font-medium text-c-text mt-0.5">{user?.username}</div>
        </div>
      </div>
    </div>
  )
}

export default function AdminLayout() {
  const { user, isAuthenticated } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
    } else if (user?.role !== 'ADMIN') {
      toast.error('Доступ запрещён')
      navigate('/403')
    }
  }, [isAuthenticated, user, navigate])

  // Close mobile sidebar on route change
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  if (!isAuthenticated || user?.role !== 'ADMIN') return null

  const currentPage = navItems.find((item) =>
    item.exact ? location.pathname === item.href : location.pathname.startsWith(item.href)
  )

  return (
    <div className="min-h-screen flex bg-c-bg">
      {/* Desktop sidebar */}
      <motion.aside
        initial={{ x: -240 }}
        animate={{ x: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="hidden md:flex w-56 shrink-0 bg-c-bg1 border-r border-c-border flex-col"
      >
        <SidebarContent />
      </motion.aside>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -256 }} animate={{ x: 0 }} exit={{ x: -256 }}
              transition={{ type: 'spring', stiffness: 350, damping: 35 }}
              className="fixed left-0 top-0 bottom-0 w-64 bg-c-bg1 border-r border-c-border z-50 md:hidden"
            >
              <SidebarContent onClose={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <div className="md:hidden flex items-center gap-3 px-4 h-14 border-b border-c-border bg-c-bg1 shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-c-t2 hover:text-c-text cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold text-c-text">{currentPage?.label ?? 'Admin'}</span>
        </div>

        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
