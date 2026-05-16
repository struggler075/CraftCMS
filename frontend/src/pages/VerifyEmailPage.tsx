import { useEffect, useRef, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle, XCircle, Loader, ShoppingBag, ArrowRight } from 'lucide-react'
import { authApi } from '../services/api'
import PageTransition from '../components/layout/PageTransition'

type State = 'loading' | 'success' | 'error'

export default function VerifyEmailPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [state, setState] = useState<State>('loading')
  const [message, setMessage] = useState('')
  const [username, setUsername] = useState('')
  const called = useRef(false)

  useEffect(() => {
    if (called.current) return
    called.current = true

    if (!token) { setState('error'); setMessage('Токен отсутствует в ссылке'); return }

    authApi.verifyEmail(token)
      .then((data) => {
        setState('success')
        setMessage(data.message)
        setUsername(data.username ?? '')
      })
      .catch((err) => {
        setState('error')
        setMessage(err?.response?.data?.message ?? 'Ссылка недействительна или истекла')
      })
  }, [token])

  return (
    <PageTransition>
      <div className="min-h-screen flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">

          {/* Logo */}
          <div className="flex justify-center mb-10">
            <div className="w-10 h-10 bg-c-primary rounded-xl flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
          </div>

          <motion.div
            key={state}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="card p-8 text-center"
          >
            {state === 'loading' && (
              <>
                <div className="flex justify-center mb-5">
                  <div className="w-16 h-16 rounded-full bg-c-bg3 border border-c-border flex items-center justify-center">
                    <Loader className="w-7 h-7 text-c-primary animate-spin" />
                  </div>
                </div>
                <h1 className="text-lg font-semibold text-c-text mb-2">Проверка ссылки</h1>
                <p className="text-sm text-c-t3">Подождите немного...</p>
              </>
            )}

            {state === 'success' && (
              <>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.05 }}
                  className="flex justify-center mb-5"
                >
                  <div className="w-16 h-16 rounded-full bg-c-green/10 border border-c-green/20 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-c-green" />
                  </div>
                </motion.div>
                <h1 className="text-lg font-semibold text-c-text mb-2">Email подтверждён!</h1>
                {username && (
                  <p className="text-sm text-c-t2 mb-1">
                    Добро пожаловать, <span className="text-c-text font-medium">{username}</span>!
                  </p>
                )}
                <p className="text-sm text-c-t3 mb-7">{message}</p>
                <Link
                  to="/profile"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-c-primary hover:bg-c-primary-h text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
                >
                  В личный кабинет
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </>
            )}

            {state === 'error' && (
              <>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.05 }}
                  className="flex justify-center mb-5"
                >
                  <div className="w-16 h-16 rounded-full bg-c-red/10 border border-c-red/20 flex items-center justify-center">
                    <XCircle className="w-8 h-8 text-c-red" />
                  </div>
                </motion.div>
                <h1 className="text-lg font-semibold text-c-text mb-2">Ссылка недействительна</h1>
                <p className="text-sm text-c-t3 mb-7">{message}</p>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-c-bg2 border border-c-border hover:border-c-border-h text-c-t2 hover:text-c-text text-sm font-medium rounded-lg transition-colors cursor-pointer"
                >
                  Зарегистрироваться снова
                </Link>
              </>
            )}
          </motion.div>
        </div>
      </div>
    </PageTransition>
  )
}
