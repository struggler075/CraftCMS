import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useRef, useEffect } from 'react'
import { ShoppingBag, LogOut, User, ShieldCheck, Menu, X, Wallet, ChevronDown, UserPlus } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useSiteSettings } from '../../store/siteSettingsStore'

const navLinks = [
  { label: 'Магазин', href: '/shop' },
  { label: 'Донат', href: '/donate' },
  { label: 'Лаунчер', href: '/launcher' },
  { label: 'Серверы', href: '/servers' },
  { label: 'Форум', href: '#', disabled: true },
]

export default function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAuthenticated, logout } = useAuthStore()
  const siteName = useSiteSettings((s) => s.settings.siteName)
  const logoUrl = useSiteSettings((s) => s.settings.logoUrl)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!userMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [userMenuOpen])

  const handleLogout = () => { logout(); setUserMenuOpen(false); navigate('/') }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-c-border bg-c-bg/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-6">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          {logoUrl ? (
            <img src={logoUrl} alt={siteName} className="w-7 h-7 object-contain rounded-md" />
          ) : (
            <div className="w-7 h-7 bg-c-primary rounded-md flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-white" />
            </div>
          )}
          <span className="font-semibold text-sm text-c-text tracking-tight">{siteName}</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 flex-1">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.href
            return (
              <Link
                key={link.label}
                to={link.disabled ? '#' : link.href}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors duration-150 cursor-pointer
                  ${link.disabled ? 'text-c-t3 pointer-events-none' : ''}
                  ${isActive ? 'text-c-text bg-white/5' : !link.disabled ? 'text-c-t2 hover:text-c-text hover:bg-white/5' : ''}`}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>

        {/* Right */}
        <div className="flex items-center gap-2">
          {isAuthenticated && user ? (
            <>
              {/* Balance */}
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-c-bg2 border border-c-border text-sm">
                <Wallet className="w-3.5 h-3.5 text-c-green" />
                <span className="text-c-text font-medium tabular-nums">
                  {(user.balance ?? 0).toLocaleString('ru-RU')} ₽
                </span>
              </div>

              {/* User dropdown */}
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-c-bg2 border border-c-border text-sm text-c-t2 hover:text-c-text hover:border-c-border-h transition-all duration-150 cursor-pointer"
                >
                  <div className="w-5 h-5 rounded-full bg-c-primary/20 flex items-center justify-center">
                    <User className="w-3 h-3 text-c-primary" />
                  </div>
                  <span className="hidden sm:block max-w-24 truncate">{user.username}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-1.5 w-48 bg-c-bg1 border border-c-border rounded-xl overflow-hidden z-50 shadow-xl shadow-black/40"
                    >
                      <Link
                        to="/profile"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-c-t2 hover:text-c-text hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        <User className="w-4 h-4" />
                        Личный кабинет
                      </Link>
                      {user.role === 'ADMIN' && (
                        <Link
                          to="/admin"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-c-t2 hover:text-c-text hover:bg-white/5 transition-colors cursor-pointer"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          Админ панель
                        </Link>
                      )}
                      <div className="h-px bg-c-border mx-2" />
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-c-t2 hover:text-c-red hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        Выйти
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="px-3 py-1.5 text-sm text-c-t2 hover:text-c-text transition-colors duration-150 cursor-pointer"
              >
                Войти
              </Link>
              <Link
                to="/register"
                className="hidden sm:block px-3 py-1.5 text-sm bg-c-primary hover:bg-c-primary-h text-white rounded-md transition-colors duration-150 cursor-pointer font-medium"
              >
                Регистрация
              </Link>
            </div>
          )}

          {/* Mobile toggle */}
          <button
            className="md:hidden p-1.5 text-c-t2 hover:text-c-text transition-colors cursor-pointer"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Меню"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden border-t border-c-border bg-c-bg overflow-hidden"
          >
            <div className="px-4 py-3 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  to={link.disabled ? '#' : link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-3 py-2 rounded-md text-sm transition-colors ${link.disabled ? 'text-c-t3 pointer-events-none' : 'text-c-t2 hover:text-c-text hover:bg-white/5'}`}
                >
                  {link.label}
                </Link>
              ))}
              {isAuthenticated && user ? (
                <>
                  <div className="flex items-center gap-1.5 px-3 py-2 text-sm text-c-t2">
                    <Wallet className="w-3.5 h-3.5 text-c-green" />
                    Баланс: <span className="text-c-text font-medium">{user.balance.toLocaleString('ru-RU')} ₽</span>
                  </div>
                  <Link to="/profile" onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-c-t2 hover:text-c-text hover:bg-white/5">
                    <User className="w-4 h-4" /> Личный кабинет
                  </Link>
                  {user.role === 'ADMIN' && (
                    <Link to="/admin" onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-c-t2 hover:text-c-text hover:bg-white/5">
                      <ShieldCheck className="w-4 h-4" /> Админ панель
                    </Link>
                  )}
                  <button onClick={() => { handleLogout(); setMobileOpen(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-c-red hover:bg-c-red/10 cursor-pointer">
                    <LogOut className="w-4 h-4" /> Выйти
                  </button>
                </>
              ) : (
                <>
                  <div className="h-px bg-c-border mx-1 my-1" />
                  <Link to="/login" onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-c-t2 hover:text-c-text hover:bg-white/5">
                    <User className="w-4 h-4" /> Войти
                  </Link>
                  <Link to="/register" onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-sm bg-c-primary/10 text-c-primary font-medium">
                    <UserPlus className="w-4 h-4" /> Регистрация
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
