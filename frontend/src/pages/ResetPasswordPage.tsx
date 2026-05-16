import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff, KeyRound, ArrowLeft } from 'lucide-react'
import { authApi } from '../services/api'
import PageTransition from '../components/layout/PageTransition'
import toast from 'react-hot-toast'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) { toast.error('Пароль должен содержать минимум 6 символов'); return }
    if (password !== confirm) { toast.error('Пароли не совпадают'); return }
    if (!token) { toast.error('Ссылка недействительна'); return }

    setLoading(true)
    try {
      await authApi.resetPassword(token, password)
      toast.success('Пароль успешно изменён')
      navigate('/login')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Ошибка сброса пароля'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <PageTransition>
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="card p-8 text-center max-w-sm w-full space-y-4">
            <KeyRound className="w-10 h-10 text-c-red mx-auto" />
            <div>
              <h2 className="text-base font-semibold text-c-text mb-1">Ссылка недействительна</h2>
              <p className="text-sm text-c-t2">Ссылка для сброса пароля повреждена или устарела.</p>
            </div>
            <Link to="/forgot-password" className="inline-flex items-center gap-1.5 text-sm text-c-primary hover:text-c-primary-h transition-colors">
              Запросить новую ссылку
            </Link>
          </div>
        </div>
      </PageTransition>
    )
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
          <div className="flex flex-col items-center mb-8">
            <div className="w-10 h-10 bg-c-primary rounded-xl flex items-center justify-center mb-4">
              <KeyRound className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-c-text">Новый пароль</h1>
            <p className="text-sm text-c-t2 mt-1">Придумайте надёжный пароль</p>
          </div>

          <div className="card p-6 space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm text-c-t2 mb-1.5">Новый пароль</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input pr-10"
                    placeholder="Минимум 6 символов"
                    required
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-c-t3 hover:text-c-t2 transition-colors cursor-pointer"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirm" className="block text-sm text-c-t2 mb-1.5">Повторите пароль</label>
                <input
                  id="confirm"
                  type={showPass ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={`input ${confirm && confirm !== password ? 'border-c-red/50 focus:border-c-red' : ''}`}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                />
                {confirm && confirm !== password && (
                  <p className="text-xs text-c-red mt-1">Пароли не совпадают</p>
                )}
              </div>

              <button type="submit" disabled={loading || !password || !confirm}
                className="w-full py-2.5 bg-c-primary hover:bg-c-primary-h text-white text-sm font-medium rounded-lg transition-colors duration-150 disabled:opacity-50 cursor-pointer mt-1"
              >
                {loading ? 'Сохранение...' : 'Сохранить пароль'}
              </button>
            </form>
            <div className="divider" />
            <Link to="/login"
              className="flex items-center justify-center gap-1.5 text-sm text-c-t3 hover:text-c-t2 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Вернуться к входу
            </Link>
          </div>
        </motion.div>
      </div>
    </PageTransition>
  )
}
