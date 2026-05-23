import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { CreditCard, Save, RefreshCw, CheckCircle, XCircle, Clock, ChevronLeft, ChevronRight, Eye, EyeOff, Copy } from 'lucide-react'
import toast from 'react-hot-toast'
import { adminPaymentApi, type PaymentSettings, type TopUpOrder } from '../../services/api'
import { useSiteSettings } from '../../store/siteSettingsStore'

type Tab = 'providers' | 'orders' | 'display'

const PROVIDER_ABBR: Record<string, string> = {
  FREEKASSA: 'FK',
  UNITPAY: 'UP',
  STRIPE: 'STR',
  YOOKASSA: 'YK',
  TRADEMC: 'TMC',
}

const PROVIDER_COLORS: Record<string, string> = {
  FREEKASSA: 'text-blue-400',
  UNITPAY: 'text-purple-400',
  STRIPE: 'text-indigo-400',
  YOOKASSA: 'text-yellow-400',
  TRADEMC: 'text-emerald-400',
}

const STATUS_CONFIG = {
  COMPLETED: { label: 'Выполнен', icon: CheckCircle, color: 'text-c-green' },
  PENDING:   { label: 'Ожидает',  icon: Clock,        color: 'text-c-gold' },
  FAILED:    { label: 'Ошибка',   icon: XCircle,      color: 'text-c-red' },
}

function SecretField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div>
      <label className="block text-xs text-c-t3 mb-1">{label}</label>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? '••••••••'}
          className="input pr-10"
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-c-t3 hover:text-c-t2 cursor-pointer"
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <label className="relative inline-block cursor-pointer shrink-0" style={{ width: 40, height: 22 }}>
      <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
      <div className={`absolute inset-0 rounded-full transition-colors duration-200 ${checked ? 'bg-c-primary' : 'bg-c-bg3 border border-c-border'}`} />
      <div className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-[21px]' : 'translate-x-[3px]'}`} />
    </label>
  )
}

function ProviderCard({ title, badge, enabled, onToggle, children }: {
  title: string; badge: string; enabled: boolean
  onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div className={`card p-5 transition-colors duration-200 ${enabled ? 'border-c-primary/30' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg bg-c-bg2 border border-c-border flex items-center justify-center text-xs font-bold ${PROVIDER_COLORS[badge]}`}>
            {PROVIDER_ABBR[badge]}
          </div>
          <div>
            <div className="text-sm font-semibold text-c-text">{title}</div>
            <div className={`text-xs mt-0.5 ${enabled ? 'text-c-green' : 'text-c-t3'}`}>
              {enabled ? 'Включён' : 'Отключён'}
            </div>
          </div>
        </div>
        <Toggle checked={enabled} onChange={onToggle} />
      </div>
      <div className={`space-y-3 transition-opacity duration-150 ${enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
        {children}
      </div>
    </div>
  )
}

const DEFAULTS: PaymentSettings = {
  freekassaEnabled: false, freekassaMerchantId: '', freekassaSecretKey1: '', freekassaSecretKey2: '',
  unitpayEnabled: false, unitpayPublicKey: '', unitpaySecretKey: '',
  stripeEnabled: false, stripePublishableKey: '', stripeSecretKey: '', stripeWebhookSecret: '',
  yookassaEnabled: false, yookassaShopId: '', yookassaSecretKey: '',
  trademcEnabled: false, trademcShopId: '', trademcItemId: '', trademcShopKey: '',
  showLogosInFooter: true,
  topUpProvider: '',
}


export default function AdminPayments() {
  const [tab, setTab] = useState<Tab>('providers')
  const siteUrl = useSiteSettings((s) => s.settings.siteUrl) || window.location.origin
  const [settings, setSettings] = useState<PaymentSettings>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Orders
  const [orders, setOrders] = useState<TopUpOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  useEffect(() => {
    adminPaymentApi.getSettings()
      .then(setSettings)
      .catch(() => toast.error('Ошибка загрузки настроек'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (tab !== 'orders') return
    setOrdersLoading(true)
    adminPaymentApi.getOrders({ page, size: 20 })
      .then((data) => { setOrders(data.content); setTotalPages(data.totalPages) })
      .catch(() => toast.error('Ошибка загрузки заказов'))
      .finally(() => setOrdersLoading(false))
  }, [tab, page])

  const patch = (partial: Partial<PaymentSettings>) => setSettings((s) => ({ ...s, ...partial }))

  const selectProvider = (key: 'freekassaEnabled' | 'unitpayEnabled' | 'stripeEnabled' | 'yookassaEnabled' | 'trademcEnabled', providerValue: string) => {
    setSettings((s) => {
      const enabling = !s[key]
      return {
        ...s,
        freekassaEnabled: false,
        unitpayEnabled: false,
        stripeEnabled: false,
        yookassaEnabled: false,
        trademcEnabled: false,
        [key]: enabling,
        topUpProvider: enabling ? providerValue : '',
      }
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const saved = await adminPaymentApi.updateSettings(settings)
      setSettings(saved)
      toast.success('Настройки сохранены')
    } catch { toast.error('Ошибка сохранения') }
    finally { setSaving(false) }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw className="w-6 h-6 animate-spin text-c-t3" />
    </div>
  )

  const tabs: { id: Tab; label: string }[] = [
    { id: 'providers', label: 'Провайдеры' },
    { id: 'orders',    label: 'История платежей' },
    { id: 'display',   label: 'Отображение' },
  ]

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <CreditCard className="w-5 h-5 text-c-primary" />
        <h1 className="text-xl font-semibold text-c-text">Платежи</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-c-bg1 border border-c-border rounded-xl p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors duration-150 cursor-pointer
              ${tab === t.id ? 'bg-c-primary text-white' : 'text-c-t2 hover:text-c-text'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Providers */}
      {tab === 'providers' && (
        <motion.div
          key="providers"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Webhook hint */}
          <div className="card p-4 text-xs text-c-t2 space-y-2">
            <p className="font-medium text-c-text mb-2">Webhook URL (обратный вызов) — укажите в личном кабинете платёжной системы:</p>
            {[
              { name: 'FreeKassa', path: '/api/payments/webhook/freekassa' },
              { name: 'UnitPay', path: '/api/payments/webhook/unitpay' },
              { name: 'Stripe', path: '/api/payments/webhook/stripe' },
              { name: 'YooKassa', path: '/api/payments/webhook/yookassa' },
              { name: 'TradeMC', path: '/api/payments/webhook/trademc' },
            ].map(({ name, path }) => {
              const fullUrl = siteUrl.replace(/\/$/, '') + path
              return (
                <div key={name} className="flex items-center gap-2">
                  <span className="text-c-t3 w-20 shrink-0">{name}:</span>
                  <code className="text-c-primary flex-1 truncate">{fullUrl}</code>
                  <button
                    onClick={() => { navigator.clipboard.writeText(fullUrl); toast.success('Скопировано') }}
                    className="p-1 rounded hover:bg-white/5 text-c-t3 hover:text-c-t2 transition-colors cursor-pointer shrink-0"
                    title="Копировать"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>

          <ProviderCard
            title="FreeKassa" badge="FREEKASSA"
            enabled={settings.freekassaEnabled}
            onToggle={() => selectProvider('freekassaEnabled', 'FREEKASSA')}
          >
            <div>
              <label className="block text-xs text-c-t3 mb-1">ID магазина</label>
              <input className="input" value={settings.freekassaMerchantId}
                onChange={(e) => patch({ freekassaMerchantId: e.target.value })}
                placeholder="123456" />
            </div>
            <SecretField label="Секретное слово 1" value={settings.freekassaSecretKey1}
              onChange={(v) => patch({ freekassaSecretKey1: v })} />
            <SecretField label="Секретное слово 2" value={settings.freekassaSecretKey2}
              onChange={(v) => patch({ freekassaSecretKey2: v })} />
          </ProviderCard>

          <ProviderCard
            title="UnitPay" badge="UNITPAY"
            enabled={settings.unitpayEnabled}
            onToggle={() => selectProvider('unitpayEnabled', 'UNITPAY')}
          >
            <div>
              <label className="block text-xs text-c-t3 mb-1">Публичный ключ проекта</label>
              <input className="input" value={settings.unitpayPublicKey}
                onChange={(e) => patch({ unitpayPublicKey: e.target.value })}
                placeholder="project_public_key" />
            </div>
            <SecretField label="Секретный ключ" value={settings.unitpaySecretKey}
              onChange={(v) => patch({ unitpaySecretKey: v })} />
          </ProviderCard>

          <ProviderCard
            title="Stripe" badge="STRIPE"
            enabled={settings.stripeEnabled}
            onToggle={() => selectProvider('stripeEnabled', 'STRIPE')}
          >
            <div>
              <label className="block text-xs text-c-t3 mb-1">Публичный ключ (pk_...)</label>
              <input className="input" value={settings.stripePublishableKey}
                onChange={(e) => patch({ stripePublishableKey: e.target.value })}
                placeholder="pk_live_..." />
            </div>
            <SecretField label="Секретный ключ (sk_...)" value={settings.stripeSecretKey}
              onChange={(v) => patch({ stripeSecretKey: v })} placeholder="sk_live_..." />
            <SecretField label="Webhook Secret (whsec_...)" value={settings.stripeWebhookSecret}
              onChange={(v) => patch({ stripeWebhookSecret: v })} placeholder="whsec_..." />
          </ProviderCard>

          <ProviderCard
            title="ЮKassa" badge="YOOKASSA"
            enabled={settings.yookassaEnabled}
            onToggle={() => selectProvider('yookassaEnabled', 'YOOKASSA')}
          >
            <div>
              <label className="block text-xs text-c-t3 mb-1">ID магазина</label>
              <input className="input" value={settings.yookassaShopId}
                onChange={(e) => patch({ yookassaShopId: e.target.value })}
                placeholder="123456" />
            </div>
            <SecretField label="Секретный ключ" value={settings.yookassaSecretKey}
              onChange={(v) => patch({ yookassaSecretKey: v })} />
          </ProviderCard>

          <ProviderCard
            title="TradeMC" badge="TRADEMC"
            enabled={settings.trademcEnabled}
            onToggle={() => selectProvider('trademcEnabled', 'TRADEMC')}
          >
            <div>
              <label className="block text-xs text-c-t3 mb-1">ID магазина</label>
              <input className="input" value={settings.trademcShopId}
                onChange={(e) => patch({ trademcShopId: e.target.value })}
                placeholder="237754" />
            </div>
            <div>
              <label className="block text-xs text-c-t3 mb-1">ID товара (валюта 1:1)</label>
              <input className="input" value={settings.trademcItemId}
                onChange={(e) => patch({ trademcItemId: e.target.value })}
                placeholder="959912" />
            </div>
            <SecretField label="Ключ магазина" value={settings.trademcShopKey}
              onChange={(v) => patch({ trademcShopKey: v })} />
            <div className="bg-c-bg2 border border-c-border rounded-xl p-3 text-xs text-c-t3 space-y-1">
              <p className="font-medium text-c-t2">Как настроить TradeMC:</p>
              <p>1. Создай магазин на <a href="https://trademc.org" target="_blank" rel="noopener noreferrer" className="text-c-primary hover:underline">trademc.org</a></p>
              <p>2. Добавь товар типа «Игровая валюта» с ценой 1₽ за единицу</p>
              <p>3. В настройках магазина → <b className="text-c-t2">Обратный вызов</b> → укажи URL:</p>
              <div className="flex items-center gap-2 mt-1 mb-1">
                <code className="text-c-primary bg-c-bg3 px-2 py-1 rounded flex-1 truncate">{siteUrl.replace(/\/$/, '')}/api/payments/webhook/trademc</code>
                <button
                  onClick={() => { navigator.clipboard.writeText(siteUrl.replace(/\/$/, '') + '/api/payments/webhook/trademc'); toast.success('Скопировано') }}
                  className="p-1.5 rounded hover:bg-white/5 text-c-t3 hover:text-c-t2 transition-colors cursor-pointer shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              <p>4. Скопируй ID магазина, ID товара и ключ магазина сюда</p>
              <p>5. Нажми «Сохранить»</p>
            </div>
          </ProviderCard>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-c-primary hover:bg-c-primary-h text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </motion.div>
      )}

      {/* Orders */}
      {tab === 'orders' && (
        <motion.div key="orders" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {ordersLoading ? (
            <div className="flex justify-center py-12"><RefreshCw className="w-5 h-5 animate-spin text-c-t3" /></div>
          ) : (
            <>
              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-c-border text-c-t3 text-xs">
                      <th className="text-left px-4 py-3">Пользователь</th>
                      <th className="text-left px-4 py-3">Сумма</th>
                      <th className="text-left px-4 py-3">Провайдер</th>
                      <th className="text-left px-4 py-3">Статус</th>
                      <th className="text-left px-4 py-3">Дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length === 0 && (
                      <tr><td colSpan={5} className="text-center py-8 text-c-t3">Нет платежей</td></tr>
                    )}
                    {orders.map((order) => {
                      const cfg = STATUS_CONFIG[order.status]
                      const Icon = cfg.icon
                      return (
                        <tr key={order.id} className="border-b border-c-border/50 hover:bg-white/[0.02]">
                          <td className="px-4 py-3 text-c-text font-medium">{order.username}</td>
                          <td className="px-4 py-3 text-c-text">{order.amount.toLocaleString('ru-RU')} ₽</td>
                          <td className={`px-4 py-3 font-medium text-xs ${PROVIDER_COLORS[order.provider]}`}>
                            {order.provider}
                          </td>
                          <td className={`px-4 py-3 ${cfg.color}`}>
                            <span className="flex items-center gap-1.5">
                              <Icon className="w-3.5 h-3.5" />
                              {cfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-c-t3 text-xs">
                            {new Date(order.createdAt).toLocaleString('ru-RU')}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-2 justify-center">
                  <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
                    className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-40 cursor-pointer">
                    <ChevronLeft className="w-4 h-4 text-c-t2" />
                  </button>
                  <span className="text-sm text-c-t2">{page + 1} / {totalPages}</span>
                  <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                    className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-40 cursor-pointer">
                    <ChevronRight className="w-4 h-4 text-c-t2" />
                  </button>
                </div>
              )}
            </>
          )}
        </motion.div>
      )}

      {/* Display */}
      {tab === 'display' && (
        <motion.div key="display" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Footer logos */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-c-text mb-4">Логотипы в футере</h3>
            <label className="flex items-center gap-3 cursor-pointer">
              <Toggle checked={settings.showLogosInFooter} onChange={() => patch({ showLogosInFooter: !settings.showLogosInFooter })} />
              <div>
                <div className="text-sm text-c-text">Показывать логотипы платёжных систем в футере</div>
                <div className="text-xs text-c-t3 mt-0.5">Отображаются только включённые провайдеры</div>
              </div>
            </label>

            {settings.showLogosInFooter && (
              <div className="mt-5 pt-5 border-t border-c-border">
                <p className="text-xs text-c-t3 mb-3">Предпросмотр:</p>
                <div className="flex items-center gap-3 flex-wrap">
                  {settings.freekassaEnabled && (
                    <div className="px-3 py-1.5 bg-c-bg2 border border-c-border rounded-lg text-xs font-bold text-blue-400">FreeKassa</div>
                  )}
                  {settings.unitpayEnabled && (
                    <div className="px-3 py-1.5 bg-c-bg2 border border-c-border rounded-lg text-xs font-bold text-purple-400">UnitPay</div>
                  )}
                  {settings.stripeEnabled && (
                    <div className="px-3 py-1.5 bg-c-bg2 border border-c-border rounded-lg text-xs font-bold text-indigo-400">Stripe</div>
                  )}
                  {settings.yookassaEnabled && (
                    <div className="px-3 py-1.5 bg-c-bg2 border border-c-border rounded-lg text-xs font-bold text-yellow-400">ЮKassa</div>
                  )}
                  {settings.trademcEnabled && (
                    <div className="px-3 py-1.5 bg-c-bg2 border border-c-border rounded-lg text-xs font-bold text-emerald-400">TradeMC</div>
                  )}
                  {!settings.freekassaEnabled && !settings.unitpayEnabled && !settings.stripeEnabled && !settings.yookassaEnabled && !settings.trademcEnabled && (
                    <span className="text-xs text-c-t3">Нет включённых провайдеров</span>
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-c-primary hover:bg-c-primary-h text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </motion.div>
      )}
    </div>
  )
}
