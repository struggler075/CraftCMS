import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, ShoppingBag, ArrowLeft, CheckCircle } from 'lucide-react'
import { authApi } from '../services/api'
import PageTransition from '../components/layout/PageTransition'
import toast from 'react-hot-toast'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    try {
      await authApi.forgotPassword(email)
      setSent(true)
    } catch {
      toast.error('Ошибка отправки письма')
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
            {!sent ? (
              <motion.div key="form" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="flex flex-col items-center mb-8">
                  <div className="w-10 h-10 bg-c-primary rounded-xl flex items-center justify-center mb-4">
                    <ShoppingBag className="w-5 h-5 text-white" />
                  </div>
                  <h1 className="text-xl font-semibold text-c-text">Восстановление пароля</h1>
                  <p className="text-sm text-c-t2 mt-1 text-center">Введите email, указанный при регистрации</p>
                </div>

                <div className="card p-6 space-y-4">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label htmlFor="email" className="block text-sm text-c-t2 mb-1.5">Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-c-t3" />
                        <input
                          id="email" type="email" value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="input pl-9" placeholder="your@email.com" required autoComplete="email"
                        />
                      </div>
                    </div>
                    <button type="submit" disabled={loading || !email}
                      className="w-full py-2.5 bg-c-primary hover:bg-c-primary-h text-white text-sm font-medium rounded-lg transition-colors duration-150 disabled:opacity-50 cursor-pointer mt-1"
                    >
                      {loading ? 'Отправка...' : 'Отправить ссылку'}
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
            ) : (
              <motion.div key="sent" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                <div className="card p-8 text-center space-y-4">
                  <div className="w-14 h-14 rounded-full bg-c-green/15 border border-c-green/25 flex items-center justify-center mx-auto">
                    <CheckCircle className="w-7 h-7 text-c-green" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-c-text mb-1">Письмо отправлено</h2>
                    <p className="text-sm text-c-t2">
                      Если аккаунт с адресом <span className="text-c-text">{email}</span> существует — ссылка для восстановления уже в вашей почте.
                    </p>
                    <p className="text-xs text-c-t3 mt-2">Ссылка действительна 1 час</p>
                  </div>
                  <Link to="/login"
                    className="inline-flex items-center justify-center gap-1.5 text-sm text-c-primary hover:text-c-primary-h transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Вернуться к входу
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </PageTransition>
  )
}
