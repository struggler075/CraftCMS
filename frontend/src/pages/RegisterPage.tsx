import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff, ShoppingBag } from 'lucide-react'
import { authApi } from '../services/api'
import { useAuthStore } from '../store/authStore'
import PageTransition from '../components/layout/PageTransition'
import PasswordStrengthMeter from '../components/auth/PasswordStrengthMeter'
import toast from 'react-hot-toast'

export default function RegisterPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirm) { toast.error('Пароли не совпадают'); return }
    setLoading(true)
    try {
      const data = await authApi.register(form.username, form.email, form.password)
      login({ username: data.username!, email: data.email!, role: data.role! as 'USER' | 'ADMIN', balance: Number(data.balance ?? 0) }, data.token!)
      if (data.requiresVerification) {
        toast.success('Регистрация прошла успешно! Подтвердите email в личном кабинете.', { duration: 5000 })
      } else {
        toast.success('Регистрация прошла успешно!')
      }
      navigate('/')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Ошибка регистрации'
      toast.error(msg, { duration: 6000 })
    } finally {
      setLoading(false)
    }
  }

  // ── Registration form ──────────────────────────────────────────────────────
  return (
    <PageTransition>
      <div className="min-h-screen flex items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-sm"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="w-10 h-10 bg-c-primary rounded-xl flex items-center justify-center mb-4">
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-c-text">Создать аккаунт</h1>
            <p className="text-sm text-c-t2 mt-1">Присоединись к сообществу</p>
          </div>

          <div className="card p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="reg-username" className="block text-sm text-c-t2 mb-1.5">Никнейм</label>
                <input
                  id="reg-username"
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="input"
                  placeholder="SteveBuilder"
                  required
                  minLength={3}
                  maxLength={20}
                  autoComplete="nickname"
                />
              </div>

              <div>
                <label htmlFor="reg-email" className="block text-sm text-c-t2 mb-1.5">Email</label>
                <input
                  id="reg-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="input"
                  placeholder="steve@example.com"
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <label htmlFor="reg-password" className="block text-sm text-c-t2 mb-1.5">Пароль</label>
                <div className="relative">
                  <input
                    id="reg-password"
                    type={showPass ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="input pr-10"
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-c-t3 hover:text-c-t2 transition-colors cursor-pointer"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {form.password && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-2">
                    <PasswordStrengthMeter password={form.password} />
                  </motion.div>
                )}
              </div>

              <div>
                <label htmlFor="reg-confirm" className="block text-sm text-c-t2 mb-1.5">Подтвердить пароль</label>
                <input
                  id="reg-confirm"
                  type={showPass ? 'text' : 'password'}
                  value={form.confirm}
                  onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                  className={`input ${form.confirm && form.password !== form.confirm ? 'border-c-red' : ''}`}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                />
                {form.confirm && form.password !== form.confirm && (
                  <p className="text-c-red text-xs mt-1">Пароли не совпадают</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-c-primary hover:bg-c-primary-h text-white text-sm font-medium rounded-lg transition-colors duration-150 disabled:opacity-50 cursor-pointer mt-1"
              >
                {loading ? 'Регистрация...' : 'Создать аккаунт'}
              </button>
            </form>

            <div className="divider mt-4 mb-4" />

            <p className="text-center text-sm text-c-t2">
              Уже есть аккаунт?{' '}
              <Link to="/login" className="text-c-primary hover:text-c-primary-h transition-colors">
                Войти
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </PageTransition>
  )
}
