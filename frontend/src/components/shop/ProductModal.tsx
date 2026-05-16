import { useState, useEffect } from 'react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Package, Wallet, ShoppingBag, AlertCircle, CheckCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Product } from '../../types'
import { useAuthStore } from '../../store/authStore'
import { userApi } from '../../services/api'
import toast from 'react-hot-toast'

interface ProductModalProps {
  product: Product | null
  onClose: () => void
}

const typeLabels: Record<string, string> = {
  BLOCK: 'Блок', ITEM: 'Предмет', ARMOR: 'Броня', WEAPON: 'Оружие',
  TOOL: 'Инструмент', ENCHANTMENT: 'Зачарование', KIT: 'Кит',
  RANK: 'Ранг', CURRENCY: 'Валюта',
}

export default function ProductModal({ product, onClose }: ProductModalProps) {
  const { user, isAuthenticated, updateBalance } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [rawQty, setRawQty] = useState('1')

  useEffect(() => {
    const q = product?.defaultQuantity ?? 1
    setQuantity(q)
    setRawQty(String(q))
  }, [product?.id])

  const totalPrice = product ? product.price * quantity : 0
  const hasBalance = user ? (user.balance ?? 0) >= totalPrice : false
  useEscapeKey(onClose, !!product)

  const handlePurchase = async () => {
    if (!product) return
    setLoading(true)
    try {
      const order = await userApi.purchase(product.id, quantity)
      updateBalance(user!.balance - order.totalPrice)
      toast.success(`Покупка оформлена!`)
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Ошибка покупки'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {product && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="pointer-events-auto w-full max-w-2xl bg-c-bg1 border border-c-border rounded-2xl overflow-hidden shadow-2xl shadow-black/60">
              <div className="flex flex-col sm:flex-row">
                {/* Image */}
                <div className="sm:w-64 h-52 sm:h-auto shrink-0 bg-c-bg2">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Content */}
                <div className="flex-1 p-6 flex flex-col min-h-0">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="badge bg-c-bg3 text-c-t2 border border-c-border text-xs">
                          {typeLabels[product.type] ?? product.type}
                        </span>
                        <span className="text-xs text-c-t3">{product.category.name}</span>
                      </div>
                      <h2 className="text-lg font-semibold text-c-text leading-tight">{product.name}</h2>
                    </div>
                    <button
                      onClick={onClose}
                      className="p-1.5 text-c-t3 hover:text-c-t2 hover:bg-white/5 rounded-lg transition-colors cursor-pointer shrink-0"
                      aria-label="Закрыть"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Description */}
                  {product.description && (
                    <p className="text-sm text-c-t2 leading-relaxed mb-4 flex-1 line-clamp-4">
                      {product.description}
                    </p>
                  )}

                  {/* Out of stock only */}
                  {product.stock === 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-c-red mb-4">
                      <Package className="w-3.5 h-3.5" />
                      <span>Нет в наличии</span>
                    </div>
                  )}

                  {/* Divider */}
                  <div className="divider mb-4" />

                  {/* Price + Quantity */}
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <p className="text-xs text-c-t3 mb-0.5">Цена за единицу</p>
                      <p className="text-xl font-semibold text-c-primary tabular-nums">
                        {product.price.toLocaleString('ru-RU')} ₽
                      </p>
                    </div>
                    {product.quantityEnabled && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { const q = Math.max(1, quantity - 1); setQuantity(q); setRawQty(String(q)) }}
                          className="w-7 h-7 rounded-md bg-c-bg3 border border-c-border text-c-t2 hover:text-c-text hover:border-c-border-h transition-colors text-sm cursor-pointer"
                        >
                          −
                        </button>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={rawQty}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\D/g, '')
                            setRawQty(raw)
                            if (raw !== '') setQuantity(Math.max(1, parseInt(raw)))
                          }}
                          onBlur={() => {
                            const q = Math.max(1, parseInt(rawQty) || 1)
                            setQuantity(q)
                            setRawQty(String(q))
                          }}
                          onFocus={(e) => e.target.select()}
                          className="w-12 text-center text-sm text-c-text bg-c-bg3 border border-c-border rounded-md py-1 tabular-nums focus:outline-none focus:border-c-primary/50"
                        />
                        <button
                          onClick={() => { const q = quantity + 1; setQuantity(q); setRawQty(String(q)) }}
                          className="w-7 h-7 rounded-md bg-c-bg3 border border-c-border text-c-t2 hover:text-c-text hover:border-c-border-h transition-colors text-sm cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Total + Action */}
                  {isAuthenticated && user ? (
                    <div className="space-y-3">
                      {/* Balance status */}
                      <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${hasBalance ? 'bg-c-green/10 text-c-green' : 'bg-c-red/10 text-c-red'}`}>
                        {hasBalance ? <CheckCircle className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                        <span>
                          Ваш баланс: <strong className="tabular-nums">{(user.balance ?? 0).toLocaleString('ru-RU')} ₽</strong>
                          {!hasBalance && ` · Не хватает: ${(totalPrice - (user.balance ?? 0)).toLocaleString('ru-RU')} ₽`}
                        </span>
                      </div>

                      <button
                        onClick={handlePurchase}
                        disabled={loading || product.stock === 0 || !hasBalance}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-c-primary hover:bg-c-primary-h text-white text-sm font-medium transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <ShoppingBag className="w-4 h-4" />
                        {loading ? 'Оформление...' : `Купить за ${totalPrice.toLocaleString('ru-RU')} ₽`}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-c-bg3 text-c-t2 border border-c-border">
                        <Wallet className="w-3.5 h-3.5 shrink-0" />
                        Войдите, чтобы купить этот товар
                      </div>
                      <div className="flex gap-2">
                        <Link
                          to="/login"
                          onClick={onClose}
                          className="flex-1 text-center py-2.5 rounded-lg bg-c-primary hover:bg-c-primary-h text-white text-sm font-medium transition-colors duration-150 cursor-pointer"
                        >
                          Войти
                        </Link>
                        <Link
                          to="/register"
                          onClick={onClose}
                          className="flex-1 text-center py-2.5 rounded-lg bg-c-bg3 border border-c-border hover:border-c-border-h text-c-t2 hover:text-c-text text-sm transition-colors duration-150 cursor-pointer"
                        >
                          Регистрация
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
