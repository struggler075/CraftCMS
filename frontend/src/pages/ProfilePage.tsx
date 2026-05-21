import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { User, Wallet, ShoppingBag, Clock, Package, Star, Upload, Plus, X, Check, ShieldCheck, ShieldOff, QrCode, AlertTriangle, Mail, RefreshCw } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { userApi, totpApi, paymentApi } from '../services/api'
import type { UserProfile, Order } from '../types'
import PageTransition from '../components/layout/PageTransition'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import SkinViewer from '../components/profile/SkinViewer'
import { useEscapeKey } from '../hooks/useEscapeKey'
import QRCode from 'react-qr-code'
import toast from 'react-hot-toast'

const statusConfig: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'В обработке', color: 'text-c-gold' },
  COMPLETED: { label: 'Выполнен', color: 'text-c-green' },
  CANCELLED: { label: 'Отменён', color: 'text-c-red' },
  REFUNDED: { label: 'Возврат', color: 'text-c-t2' },
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function UploadButton({ label, accept, onUpload }: { label: string; accept: string; onUpload: (f: File) => Promise<void> }) {
  const ref = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      await onUpload(file)
    } finally {
      setUploading(false)
      if (ref.current) ref.current.value = ''
    }
  }

  return (
    <>
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={handle} />
      <button
        onClick={() => ref.current?.click()}
        disabled={uploading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-c-bg3 border border-c-border hover:border-c-border-h text-c-t2 hover:text-c-text text-xs transition-colors disabled:opacity-50 cursor-pointer"
      >
        <Upload className="w-3.5 h-3.5" />
        {uploading ? 'Загрузка...' : label}
      </button>
    </>
  )
}

// ── Top-up modal ──────────────────────────────────────────────────────────────

function TopUpModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuthStore()
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  useEscapeKey(onClose, true)

  const presets = [50, 100, 250, 500]

  const handleTopUp = async () => {
    const n = parseFloat(amount)
    if (!n || n <= 0) { toast.error('Введите сумму'); return }
    setLoading(true)
    try {
      const { redirectUrl } = await paymentApi.initiate(n)
      window.location.href = redirectUrl
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Платёжная система не настроена')
    } finally { setLoading(false) }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-sm bg-c-bg1 border border-c-border rounded-2xl p-6"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-c-green/15 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-c-green" />
            </div>
            <div>
              <div className="text-sm font-semibold text-c-text">Пополнить баланс</div>
              <div className="text-xs text-c-t3">Текущий: {((user?.balance) ?? 0).toLocaleString('ru-RU')} ₽</div>
            </div>
          </div>
          <button onClick={onClose} className="text-c-t3 hover:text-c-t2 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-4">
          {presets.map((p) => (
            <button key={p} onClick={() => setAmount(p.toString())}
              className={`py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer
                ${amount === p.toString() ? 'border-c-green bg-c-green/15 text-c-green' : 'border-c-border bg-c-bg2 text-c-t2 hover:border-c-border-h hover:text-c-text'}`}>
              {p} ₽
            </button>
          ))}
        </div>

        <div className="relative mb-5">
          <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-c-t3" />
          <input
            type="number" min="1" step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Своя сумма (₽)"
            className="input pl-9"
          />
        </div>

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2 rounded-lg bg-c-bg3 border border-c-border text-c-t2 hover:text-c-text text-sm transition-colors cursor-pointer">
            Отмена
          </button>
          <button onClick={handleTopUp} disabled={loading || !amount}
            className="flex-1 py-2 rounded-lg bg-c-green hover:bg-c-green/90 text-white text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2">
            <Check className="w-4 h-4" />
            {loading ? 'Переход...' : 'Пополнить'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── 2FA Modal ──────────────────────────────────────────────────────────────────

type TotpModalMode = 'setup' | 'disable'

function TotpModal({
  mode,
  onClose,
  onSuccess,
}: {
  mode: TotpModalMode
  onClose: () => void
  onSuccess: () => void
}) {
  const [step, setStep] = useState<'qr' | 'code'>(mode === 'setup' ? 'qr' : 'code')
  const [otpUrl, setOtpUrl] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  useEscapeKey(onClose, true)

  useEffect(() => {
    if (mode === 'setup') {
      totpApi.setup().then((d) => { setSecret(d.secret); setOtpUrl(d.otpUrl) }).catch(() => toast.error('Ошибка настройки 2FA'))
    }
  }, [mode])

  const handleConfirm = async () => {
    if (code.length !== 6) return
    setLoading(true)
    try {
      if (mode === 'setup') {
        await totpApi.enable(code)
        toast.success('Двухфакторная аутентификация включена')
      } else {
        await totpApi.disable(code)
        toast.success('Двухфакторная аутентификация отключена')
      }
      onSuccess()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Неверный код'
      toast.error(msg)
      setCode('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-sm bg-c-bg1 border border-c-border rounded-2xl p-6"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${mode === 'setup' ? 'bg-c-primary/15' : 'bg-c-red/15'}`}>
              {mode === 'setup'
                ? <ShieldCheck className="w-4 h-4 text-c-primary" />
                : <ShieldOff className="w-4 h-4 text-c-red" />}
            </div>
            <div>
              <div className="text-sm font-semibold text-c-text">
                {mode === 'setup' ? 'Включить 2FA' : 'Отключить 2FA'}
              </div>
              <div className="text-xs text-c-t3">Google Authenticator</div>
            </div>
          </div>
          <button onClick={onClose} className="text-c-t3 hover:text-c-t2 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <AnimatePresence mode="wait">
          {/* QR code step (setup only) */}
          {step === 'qr' && mode === 'setup' && (
            <motion.div key="qr" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
              className="space-y-4">
              <p className="text-sm text-c-t2 text-center">
                Отсканируйте QR-код в приложении <span className="text-c-text">Google Authenticator</span>
              </p>
              <div className="flex justify-center p-4 bg-white rounded-xl">
                {otpUrl
                  ? <QRCode value={otpUrl} size={160} />
                  : <div className="w-40 h-40 flex items-center justify-center"><QrCode className="w-10 h-10 text-gray-300 animate-pulse" /></div>}
              </div>
              {secret && (
                <div className="bg-c-bg2 border border-c-border rounded-lg px-3 py-2 text-center">
                  <p className="text-xs text-c-t3 mb-1">Ключ вручную</p>
                  <p className="text-xs font-mono text-c-text tracking-widest break-all">{secret}</p>
                </div>
              )}
              <button
                onClick={() => setStep('code')}
                disabled={!otpUrl}
                className="w-full py-2.5 bg-c-primary hover:bg-c-primary-h text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                Добавил — ввести код
              </button>
            </motion.div>
          )}

          {/* Code verification step */}
          {step === 'code' && (
            <motion.div key="code" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
              className="space-y-4">
              {mode === 'disable' && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-c-red/10 border border-c-red/20">
                  <AlertTriangle className="w-4 h-4 text-c-red shrink-0 mt-0.5" />
                  <p className="text-xs text-c-red">После отключения 2FA вход будет возможен только по паролю</p>
                </div>
              )}
              <div>
                <label className="block text-sm text-c-t2 mb-2 text-center">
                  {mode === 'setup' ? 'Введите код из приложения' : 'Подтвердите кодом из приложения'}
                </label>
                <input
                  type="text" inputMode="numeric" maxLength={6}
                  value={code}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 6)
                    setCode(v)
                    if (v.length === 6) {
                      setTimeout(() => handleConfirm(), 0)
                    }
                  }}
                  autoFocus
                  placeholder="000000"
                  className="input text-center text-2xl font-mono tracking-[0.5em] placeholder:tracking-normal"
                />
              </div>
              <button
                onClick={handleConfirm}
                disabled={loading || code.length !== 6}
                className={`w-full py-2.5 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 cursor-pointer
                  ${mode === 'setup' ? 'bg-c-primary hover:bg-c-primary-h' : 'bg-c-red hover:bg-c-red/90'}`}
              >
                {loading ? 'Проверка...' : mode === 'setup' ? 'Включить 2FA' : 'Отключить 2FA'}
              </button>
              {mode === 'setup' && (
                <button onClick={() => setStep('qr')} className="w-full text-sm text-c-t3 hover:text-c-t2 transition-colors cursor-pointer">
                  ← Назад к QR-коду
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuthStore()
  const setUser = useAuthStore((s) => s.setUser)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [skinUrl, setSkinUrl] = useState<string | undefined>()
  const [capeUrl, setCapeUrl] = useState<string | undefined>()
  const [topUpOpen, setTopUpOpen] = useState(false)
  const [emailVerified, setEmailVerified] = useState(true)
  const [resending, setResending] = useState(false)
  const [totpEnabled, setTotpEnabled] = useState(false)
  const [totpModal, setTotpModal] = useState<TotpModalMode | null>(null)

  const loadProfile = async () => {
    const [p, o, totpStatus] = await Promise.all([userApi.getProfile(), userApi.getOrders(), totpApi.getStatus()])
    setProfile(p); setOrders(o)
    setSkinUrl(p.skinUrl ?? undefined)
    setCapeUrl(p.capeUrl ?? undefined)
    setEmailVerified(p.emailVerified)
    setTotpEnabled(totpStatus.enabled)
    // Keep the global auth store in sync with the authoritative server payload —
    // username, email, role and balance may have been changed by an admin.
    setUser({
      id: p.id,
      username: p.username,
      email: p.email,
      role: p.role,
      balance: Number(p.balance ?? 0),
      emailVerified: p.emailVerified,
      skinUrl: p.skinUrl ?? null,
      capeUrl: p.capeUrl ?? null,
    })
  }

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return }
    loadProfile().finally(() => setLoading(false))
  }, [isAuthenticated, navigate])

  const handleSkinUpload = async (file: File) => {
    const { url } = await userApi.uploadSkin(file)
    setSkinUrl(url + '?t=' + Date.now())
    toast.success('Скин успешно загружен')
  }

  const handleCapeUpload = async (file: File) => {
    const { url } = await userApi.uploadCape(file)
    setCapeUrl(url + '?t=' + Date.now())
    toast.success('Плащ успешно загружен')
  }

  if (loading) return (
    <PageTransition>
      <div className="pt-24 pb-20 max-w-4xl mx-auto px-4"><LoadingSpinner /></div>
    </PageTransition>
  )

  return (
    <PageTransition>
      <main className="pt-20 pb-20 px-4 max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8 pt-4">
          <h1 className="text-2xl font-semibold text-c-text">Личный кабинет</h1>
          <p className="text-sm text-c-t2 mt-1">Управление аккаунтом и история покупок</p>
        </motion.div>

        {/* Email verification banner */}
        <AnimatePresence>
          {!emailVerified && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-6 flex items-start gap-3 px-4 py-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0 mt-0.5">
                <Mail className="w-4 h-4 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-300">Подтвердите email</p>
                <p className="text-xs text-amber-400/70 mt-0.5">
                  Без подтверждения вы не сможете восстановить аккаунт при утере пароля
                </p>
              </div>
              <button
                onClick={async () => {
                  setResending(true)
                  try {
                    await userApi.resendVerification()
                    toast.success('Письмо отправлено! Проверьте почту.')
                  } catch (err: unknown) {
                    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Ошибка отправки'
                    toast.error(msg)
                  } finally {
                    setResending(false)
                  }
                }}
                disabled={resending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/25 text-amber-300 text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                {resending ? 'Отправка...' : 'Выслать письмо'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          {/* Left column */}
          <div className="space-y-4">
            {/* Profile + 3D skin */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="card rounded-xl p-5">
              <div className="flex flex-col items-center text-center">
                {/* 3D Skin Viewer */}
                <div className="w-full flex justify-center mb-3 bg-c-bg2 rounded-xl overflow-hidden border border-c-border" style={{ height: 220 }}>
                  <SkinViewer skinUrl={skinUrl} capeUrl={capeUrl} width={160} height={220} />
                </div>

                <h2 className="text-base font-semibold text-c-text">{user?.username}</h2>
                <div className="flex items-center gap-1.5 mt-0.5 mb-3">
                  <p className="text-xs text-c-t3">{user?.email}</p>
                  <Check
                    className={`w-3.5 h-3.5 shrink-0 ${emailVerified ? 'text-c-primary' : 'text-c-t3/40'}`}
                    strokeWidth={emailVerified ? 2.5 : 2}
                  />
                </div>

                {user?.role === 'ADMIN' && (
                  <span className="badge bg-c-primary/15 text-c-primary border border-c-primary/20 mb-3">Администратор</span>
                )}

                {/* Upload buttons */}
                <div className="flex gap-2 flex-wrap justify-center">
                  <UploadButton label="Скин (PNG)" accept="image/png" onUpload={handleSkinUpload} />
                  <UploadButton label="Плащ (PNG)" accept="image/png" onUpload={handleCapeUpload} />
                </div>
                <p className="text-xs text-c-t3 mt-2">PNG, до 1 МБ, 64×64</p>
              </div>
            </motion.div>

            {/* Balance */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="card rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-c-green" />
                  <span className="text-sm font-medium text-c-text">Баланс</span>
                </div>
                <button
                  onClick={() => setTopUpOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-c-green/15 hover:bg-c-green/25 text-c-green text-xs font-semibold transition-colors cursor-pointer border border-c-green/20">
                  <Plus className="w-3.5 h-3.5" />
                  Пополнить
                </button>
              </div>
              <p className="text-2xl font-semibold text-c-text tabular-nums">
                {(user?.balance ?? 0).toLocaleString('ru-RU')} <span className="text-c-t3 text-lg">₽</span>
              </p>
            </motion.div>

            {/* Stats */}
            {profile && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                className="card rounded-xl p-5 space-y-3">
                <p className="text-sm font-medium text-c-text">Статистика</p>
                {[
                  { icon: ShoppingBag, label: 'Заказов', value: profile.totalOrders },
                  { icon: Star, label: 'Роль', value: profile.role === 'ADMIN' ? 'Администратор' : 'Игрок' },
                  { icon: Clock, label: 'Регистрация', value: formatDate(profile.createdAt) },
                  { icon: User, label: 'ID', value: `#${profile.id}` },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-c-t2"><Icon className="w-3.5 h-3.5" />{label}</span>
                    <span className="text-c-text font-medium">{value}</span>
                  </div>
                ))}
              </motion.div>
            )}

            {/* 2FA */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="card rounded-xl p-5">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck className={`w-4 h-4 ${totpEnabled ? 'text-c-green' : 'text-c-t3'}`} />
                  <span className="text-sm font-medium text-c-text">Двухфакторная аутентификация</span>
                </div>
              </div>
              <p className="text-xs text-c-t3 mb-3">
                {totpEnabled ? 'Вход защищён Google Authenticator' : 'Дополнительная защита аккаунта'}
              </p>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                  totpEnabled
                    ? 'text-c-green bg-c-green/10 border-c-green/20'
                    : 'text-c-t3 bg-c-bg3 border-c-border'
                }`}>
                  {totpEnabled ? 'Включена' : 'Отключена'}
                </span>
                <button
                  onClick={() => setTotpModal(totpEnabled ? 'disable' : 'setup')}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors cursor-pointer
                    ${totpEnabled
                      ? 'border-c-red/30 bg-c-red/10 text-c-red hover:bg-c-red/20'
                      : 'border-c-primary/30 bg-c-primary/10 text-c-primary hover:bg-c-primary/20'
                    }`}
                >
                  {totpEnabled ? 'Отключить' : 'Включить'}
                </button>
              </div>
            </motion.div>
          </div>

          {/* Right — Orders */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-c-text">История покупок</h3>
              <span className="text-xs text-c-t3">{orders.length} заказов</span>
            </div>

            {orders.length === 0 ? (
              <div className="card rounded-xl p-12 text-center">
                <Package className="w-10 h-10 text-c-t3 mx-auto mb-3" />
                <p className="text-sm text-c-t2">У вас пока нет покупок</p>
                <a href="/shop" className="inline-block mt-4 text-sm text-c-primary hover:text-c-primary-h transition-colors cursor-pointer">
                  Перейти в магазин
                </a>
              </div>
            ) : (
              <div className="space-y-2">
                {orders.map((order, i) => {
                  const st = statusConfig[order.status] ?? { label: order.status, color: 'text-c-t2' }
                  return (
                    <motion.div key={order.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * i }} className="card rounded-xl p-4 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-c-bg3 overflow-hidden shrink-0">
                        {order.productImageUrl
                          ? <img src={order.productImageUrl} alt={order.productName} className="w-full h-full object-cover" loading="lazy" />
                          : <Package className="w-5 h-5 text-c-t3 m-3.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-c-text truncate">{order.productName}</p>
                        <p className="text-xs text-c-t3 mt-0.5">{order.categoryName} · x{order.quantity} · {formatDate(order.createdAt)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-c-text tabular-nums">{order.totalPrice.toLocaleString('ru-RU')} ₽</p>
                        <p className={`text-xs mt-0.5 ${st.color}`}>{st.label}</p>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </motion.div>
        </div>
      </main>
      <AnimatePresence>
        {topUpOpen && (
          <TopUpModal
            onClose={() => setTopUpOpen(false)}
          />
        )}
        {totpModal && (
          <TotpModal
            mode={totpModal}
            onClose={() => setTotpModal(null)}
            onSuccess={() => {
              setTotpEnabled(totpModal === 'setup')
              setTotpModal(null)
            }}
          />
        )}
      </AnimatePresence>
    </PageTransition>
  )
}
