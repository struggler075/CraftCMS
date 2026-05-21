import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, X, Wallet, ShoppingCart, Minus, ArrowLeft } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { donateApi, serversApi, userApi } from '../services/api'
import type { DonatePageData, DonateRank, DonateFeature, ServerWithStatus } from '../types'
import { useSiteSettings } from '../store/siteSettingsStore'
import { useAuthStore } from '../store/authStore'
import { useEscapeKey } from '../hooks/useEscapeKey'
import PageTransition from '../components/layout/PageTransition'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import ServerSelectGrid from '../components/ServerSelectGrid'
import toast from 'react-hot-toast'

function compactPrice(price: number): string {
  if (price >= 1000) {
    const k = price / 1000
    return `${Number.isInteger(k) ? k : k.toFixed(1)}к`
  }
  return price.toString()
}

function GemIcon({ color, size = 38 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 38 38" fill="none">
      <polygon points="19,3 34,12 34,26 19,35 4,26 4,12" fill={color} opacity="0.9" />
      <polygon points="19,3 34,12 19,19 4,12" fill="white" opacity="0.22" />
      <polygon points="19,19 34,26 19,35 4,26" fill="black" opacity="0.18" />
      <polygon points="19,3 28,9 19,13 10,9" fill="white" opacity="0.12" />
    </svg>
  )
}

// ── Purchase modal ─────────────────────────────────────────────────────────────

function PurchaseModal({
  rank,
  allFeatures,
  onClose,
  onPurchased,
}: {
  rank: DonateRank
  allFeatures: DonateFeature[]
  onClose: () => void
  onPurchased: (newBalance: number) => void
}) {
  const { user, isAuthenticated } = useAuthStore()
  const [buying, setBuying] = useState(false)

  useEscapeKey(onClose, true)

  const canAfford = isAuthenticated && user != null && (user.balance ?? 0) >= rank.price

  const handleBuy = async () => {
    setBuying(true)
    try {
      const { newBalance } = await userApi.buyDonate(rank.id)
      toast.success(`Ранг «${rank.name}» куплен!`)
      onPurchased(newBalance)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg || 'Ошибка при покупке')
    } finally {
      setBuying(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-md bg-c-bg1 border border-c-border rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 w-full" style={{ background: rank.color }} />
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              {rank.imageUrl
                ? <img src={rank.imageUrl} alt={rank.name} className="w-10 h-10 object-contain" />
                : <GemIcon color={rank.color} size={40} />
              }
              <div>
                <div className="text-base font-bold text-c-text">{rank.name}</div>
                <div className="text-xs text-c-t3">{rank.featureIds.length} из {allFeatures.length} привилегий</div>
              </div>
            </div>
            <button onClick={onClose} className="text-c-t3 hover:text-c-t2 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Feature list */}
          <div className="bg-c-bg2 border border-c-border rounded-xl p-4 mb-4 max-h-60 overflow-y-auto space-y-2">
            {allFeatures.map((feature) => {
              const has = rank.featureIds.includes(feature.id)
              return (
                <div key={feature.id} className={`flex items-start gap-2.5 ${has ? '' : 'opacity-40'}`}>
                  <div className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center shrink-0
                    ${has ? 'bg-c-green/15' : 'bg-c-red/10'}`}>
                    {has
                      ? <Check className="w-3 h-3 text-c-green" />
                      : <X className="w-3 h-3 text-c-red" />
                    }
                  </div>
                  <span className="text-sm text-c-t2 leading-snug">{feature.name}</span>
                </div>
              )
            })}
          </div>

          {/* Price + Balance */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="text-xs text-c-t3 mb-0.5">Цена</div>
              <div className="text-2xl font-bold tabular-nums" style={{ color: rank.color }}>
                {rank.price.toLocaleString('ru-RU')} ₽
              </div>
            </div>
            {isAuthenticated && user && (
              <div className="text-right">
                <div className="text-xs text-c-t3 mb-0.5">Ваш баланс</div>
                <div className={`text-base font-semibold tabular-nums flex items-center gap-1.5 justify-end
                  ${canAfford ? 'text-c-green' : 'text-c-red'}`}>
                  <Wallet className="w-4 h-4" />
                  {(user.balance ?? 0).toLocaleString('ru-RU')} ₽
                </div>
              </div>
            )}
          </div>

          {/* Action */}
          {!isAuthenticated ? (
            <div className="text-center text-sm text-c-t3 py-3 border border-c-border rounded-xl">
              Войдите, чтобы совершить покупку
            </div>
          ) : !canAfford ? (
            <div className="space-y-2">
              <div className="text-center text-xs text-c-red py-1">Недостаточно средств</div>
              <button disabled
                className="w-full py-2.5 rounded-xl text-sm font-medium bg-c-bg3 border border-c-border text-c-t3 cursor-not-allowed opacity-50">
                Купить за {rank.price.toLocaleString('ru-RU')} ₽
              </button>
            </div>
          ) : (
            <button onClick={handleBuy} disabled={buying}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer hover:opacity-90"
              style={{ background: rank.color }}>
              <ShoppingCart className="w-4 h-4" />
              {buying ? 'Покупка...' : `Купить за ${rank.price.toLocaleString('ru-RU')} ₽`}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DonatePage() {
  const navigate = useNavigate()
  const { serverId: serverIdParam } = useParams<{ serverId?: string }>()
  const serverId = serverIdParam ? parseInt(serverIdParam, 10) : undefined

  const [data, setData] = useState<DonatePageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<DonateRank | null>(null)
  const [serverInfo, setServerInfo] = useState<ServerWithStatus | null>(null)
  const donateHeaderImageUrl = useSiteSettings((s) => s.settings.donateHeaderImageUrl)
  const updateBalance = useAuthStore((s) => s.updateBalance)

  useEffect(() => {
    if (serverId == null) { setLoading(false); return }
    setLoading(true)
    donateApi.getPage(serverId).then(setData).catch(() => {}).finally(() => setLoading(false))
    serversApi.getAll().then((all) => setServerInfo(all.find((s) => s.id === serverId) ?? null))
  }, [serverId])

  // ── No server picked yet → landing
  if (serverId == null) {
    return (
      <PageTransition>
        <ServerSelectGrid
          title="Донат"
          subtitle="Выберите сервер, для которого хотите купить ранг"
          onPick={(s) => navigate(`/donate/${s.id}`)}
        />
      </PageTransition>
    )
  }

  const ranks = data?.ranks ?? []
  const features = data?.features ?? []

  // Feature column: 30% on mobile, ~200px on large screens
  const featureColWidth = ranks.length <= 4 ? '35%' : '28%'

  return (
    <PageTransition>
      <main className="pt-20 pb-20 px-4 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 pt-6 flex items-center gap-4">
          {donateHeaderImageUrl && (
            <img src={donateHeaderImageUrl} alt="" className="w-14 h-14 object-contain rounded-xl shrink-0" />
          )}
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-c-text">
              Донат · <span className="text-c-primary">{serverInfo?.name ?? '...'}</span>
            </h1>
            <p className="text-sm text-c-t2 mt-1">{serverInfo?.description ?? 'Поддержите проект и получите игровые привилегии'}</p>
          </div>
          <button
            onClick={() => navigate('/donate')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-c-bg2 border border-c-border hover:border-c-border-h text-c-t2 hover:text-c-text text-xs transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Сменить сервер
          </button>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : !data || ranks.length === 0 ? (
          <div className="text-center py-20 text-c-t3 text-sm">Ранги доната не настроены</div>
        ) : (
          <div className="rounded-xl border border-c-border overflow-hidden">
            <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
              <colgroup>
                <col style={{ width: featureColWidth }} />
                {ranks.map((r) => <col key={r.id} />)}
              </colgroup>

              {/* Rank headers */}
              <thead>
                <tr>
                  <th className="border-b border-c-border px-3 py-4 text-left text-xs font-medium text-c-t3 uppercase tracking-wider bg-c-bg1">
                    <span className="hidden sm:inline">Привилегии</span>
                  </th>
                  {ranks.map((rank) => (
                    <th key={rank.id}
                        className="border-b border-c-border px-2 py-4 text-center relative cursor-pointer hover:opacity-90 transition-opacity"
                        style={{ background: rank.featured ? `${rank.color}12` : '#0f0f18' }}
                        onClick={() => setSelected(rank)}
                        title={rank.name}>
                      {rank.featured && (
                        <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: rank.color }} />
                      )}
                      <div className="flex flex-col items-center gap-1.5">
                        {rank.imageUrl
                          ? <img src={rank.imageUrl} alt={rank.name} className="w-8 h-8 object-contain" />
                          : <GemIcon color={rank.color} size={32} />
                        }
                        <div className="text-xs font-bold text-c-text leading-tight hidden sm:block truncate w-full text-center px-1">
                          {rank.name}
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Feature rows */}
              <tbody>
                {features.map((feature) => (
                  <tr key={feature.id}>
                    <td className="border-b border-c-border/40 px-3 py-2.5 bg-c-bg1 text-xs text-c-t2 leading-snug">
                      <span className="hidden sm:inline">{feature.name}</span>
                      <span className="sm:hidden line-clamp-2">{feature.name}</span>
                    </td>
                    {ranks.map((rank) => {
                      const has = rank.featureIds.includes(feature.id)
                      return (
                        <td key={rank.id}
                            className="border-b border-c-border/40 px-1 py-2.5 text-center"
                            style={{ background: has ? 'rgba(34,197,94,0.09)' : 'rgba(239,68,68,0.07)' }}>
                          {has
                            ? <Check className="w-3.5 h-3.5 mx-auto text-c-green" />
                            : <Minus className="w-3.5 h-3.5 mx-auto text-c-red opacity-50" />
                          }
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>

              {/* Price + buy footer — entire cell is clickable */}
              <tfoot>
                <tr>
                  <td className="border-t border-c-border px-3 py-3 bg-c-bg1" />
                  {ranks.map((rank) => (
                    <td key={rank.id}
                        onClick={() => setSelected(rank)}
                        className="border-t border-c-border py-3 text-center cursor-pointer hover:opacity-90 transition-opacity select-none"
                        style={{ background: rank.featured ? `${rank.color}12` : '#0f0f18' }}>
                      <div className="font-bold tabular-nums text-xs leading-tight" style={{ color: rank.color }}>
                        <span className="sm:hidden">{compactPrice(rank.price)} ₽</span>
                        <span className="hidden sm:inline">{rank.price.toLocaleString('ru-RU')} ₽</span>
                      </div>
                      <div className="text-c-t3 text-xs mt-0.5 hidden sm:block">купить</div>
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </main>

      <AnimatePresence>
        {selected && data && (
          <PurchaseModal
            rank={selected}
            allFeatures={features}
            onClose={() => setSelected(null)}
            onPurchased={(newBalance) => {
              updateBalance(newBalance)
              setSelected(null)
            }}
          />
        )}
      </AnimatePresence>
    </PageTransition>
  )
}
