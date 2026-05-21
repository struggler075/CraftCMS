import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, ShoppingBag, ShieldCheck, ArrowLeft } from 'lucide-react'
import { authApi } from '../services/api'
import { useAuthStore } from '../store/authStore'
import PageTransition from '../components/layout/PageTransition'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [form, setForm] = useState({ username: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  // 2FA state
  const [step, setStep] = useState<'credentials' | 'totp'>('credentials')
  const [preAuthToken, setPreAuthToken] = useState('')
  const [totpCode, setTotpCode] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await authApi.login(form.username, form.password)
      if (data.requiresTOTP && data.preAuthToken) {
        setPreAuthToken(data.preAuthToken)
        setStep('totp')
        setTotpCode('')
        return
      }
      login({ username: data.username!, email: data.email!, role: data.role!, balance: data.balance! }, data.token!)
      toast.success(`Добро пожаловать, ${data.username}!`)
      navigate(data.role === 'ADMIN' ? '/admin' : '/')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Неверные данные'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleTotpChange = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 6)
    setTotpCode(digits)
    if (digits.length === 6) handleTotpSubmit(digits)
  }

  const handleTotpSubmit = async (code = totpCode) => {
    if (code.length !== 6) return
    setLoading(true)
    try {
      const data = await authApi.verify2fa(preAuthToken, code)
      login({ username: data.username!, email: data.email!, role: data.role!, balance: data.balance! }, data.token!)
      toast.success(`Добро пожаловать, ${data.username}!`)
      navigate(data.role === 'ADMIN' ? '/admin' : '/')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Неверный код'
      toast.error(msg)
      setTotpCode('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageTransition>
      <div className="min-h-screen flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-sm"
        >
          <AnimatePresence mode="wait">
            {step === 'credentials' ? (
              <motion.div key="credentials" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                {/* Logo */}
                <div className="flex flex-col items-center mb-8">
                  <div className="w-10 h-10 bg-c-primary rounded-xl flex items-center justify-center mb-4">
                    <ShoppingBag className="w-5 h-5 text-white" />
                  </div>
                  <h1 className="text-xl font-semibold text-c-text">Войти в аккаунт</h1>
                  <p className="text-sm text-c-t2 mt-1">Добро пожаловать обратно</p>
                </div>

                <div className="card p-6 space-y-4">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label htmlFor="username" className="block text-sm text-c-t2 mb-1.5">Логин</label>
                      <input
                        id="username" type="text" value={form.username}
                        onChange={(e) => setForm({ ...form, username: e.target.value })}
                        className="input" placeholder="Ваш никнейм" required autoComplete="username"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label htmlFor="password" className="text-sm text-c-t2">Пароль</label>
                        <Link to="/forgot-password" className="text-xs text-c-t3 hover:text-c-primary transition-colors">
                          Забыл пароль
                        </Link>
                      </div>
                      <div className="relative">
                        <input
                          id="password" type={showPass ? 'text' : 'password'} value={form.password}
                          onChange={(e) => setForm({ ...form, password: e.target.value })}
                          className="input pr-10" placeholder="••••••••" required autoComplete="current-password"
                        />
                        <button type="button" onClick={() => setShowPass(!showPass)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-c-t3 hover:text-c-t2 transition-colors cursor-pointer"
                        >
                          {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <button type="submit" disabled={loading}
                      className="w-full py-2.5 bg-c-primary hover:bg-c-primary-h text-white text-sm font-medium rounded-lg transition-colors duration-150 disabled:opacity-50 cursor-pointer mt-1"
                    >
                      {loading ? 'Входим...' : 'Войти'}
                    </button>
                  </form>
                  <div className="divider" />
                  <p className="text-center text-sm text-c-t2">
                    Нет аккаунта?{' '}
                    <Link to="/register" className="text-c-primary hover:text-c-primary-h transition-colors">
                      Зарегистрироваться
                    </Link>
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div key="totp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                {/* 2FA step */}
                <div className="flex flex-col items-center mb-8">
                  <div className="w-10 h-10 bg-c-primary rounded-xl flex items-center justify-center mb-4">
                    <ShieldCheck className="w-5 h-5 text-white" />
                  </div>
                  <h1 className="text-xl font-semibold text-c-text">Двухфакторная аутентификация</h1>
                  <p className="text-sm text-c-t2 mt-1 text-center">Введите код из приложения Google Authenticator</p>
                </div>

                <div className="card p-6 space-y-5">
                  {/* 6-digit code input */}
                  <div>
                    <label className="block text-sm text-c-t2 mb-3 text-center">Код подтверждения</label>
                    <input
                      type="text" inputMode="numeric" maxLength={6}
                      value={totpCode}
                      onChange={(e) => handleTotpChange(e.target.value)}
                      autoFocus
                      placeholder="000000"
                      className="input text-center text-2xl font-mono tracking-[0.5em] placeholder:tracking-normal"
                    />
                    <p className="text-xs text-c-t3 mt-2 text-center">Код обновляется каждые 30 секунд</p>
                  </div>

                  <button
                    onClick={() => handleTotpSubmit()}
                    disabled={loading || totpCode.length !== 6}
                    className="w-full py-2.5 bg-c-primary hover:bg-c-primary-h text-white text-sm font-medium rounded-lg transition-colors duration-150 disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? 'Проверка...' : 'Подтвердить'}
                  </button>

                  <button
                    onClick={() => { setStep('credentials'); setTotpCode('') }}
                    className="w-full flex items-center justify-center gap-1.5 text-sm text-c-t3 hover:text-c-t2 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Вернуться к входу
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </PageTransition>
  )
}
