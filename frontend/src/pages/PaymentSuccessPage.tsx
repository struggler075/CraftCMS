import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle, ArrowRight } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { userApi } from '../services/api'
import PageTransition from '../components/layout/PageTransition'

export default function PaymentSuccessPage() {
  const [params] = useSearchParams()
  const orderId = params.get('orderId')
  const { updateBalance, token } = useAuthStore()

  useEffect(() => {
    if (!token) return
    const timer = setTimeout(() => {
      userApi.getProfile().then((p) => updateBalance(p.balance)).catch(() => {})
    }, 1500)
    return () => clearTimeout(timer)
  }, [token, updateBalance])

  return (
    <PageTransition>
      <div className="min-h-screen flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="card p-10 text-center max-w-md w-full"
        >
          <div className="flex justify-center mb-5">
            <div className="w-16 h-16 rounded-full bg-c-green/10 flex items-center justify-center">
              <CheckCircle className="w-9 h-9 text-c-green" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-c-text mb-2">Оплата прошла успешно!</h1>
          <p className="text-c-t2 text-sm mb-1">Баланс будет пополнен в течение нескольких секунд.</p>
          {orderId && <p className="text-xs text-c-t3 mb-6">Заказ: {orderId}</p>}
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-2">
            <Link
              to="/profile"
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-c-primary hover:bg-c-primary-h text-white rounded-lg text-sm font-medium transition-colors"
            >
              Личный кабинет
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/shop"
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-c-bg2 hover:bg-c-bg3 text-c-text border border-c-border rounded-lg text-sm font-medium transition-colors"
            >
              В магазин
            </Link>
          </div>
        </motion.div>
      </div>
    </PageTransition>
  )
}
