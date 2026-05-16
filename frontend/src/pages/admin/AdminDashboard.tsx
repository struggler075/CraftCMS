import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Package, Tag, Server, Newspaper, TrendingUp } from 'lucide-react'
import { adminApi } from '../../services/api'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

interface Stats {
  totalProducts: number
  totalCategories: number
  totalServers: number
  totalNews: number
}

const statCards = (s: Stats) => [
  { label: 'Товаров', value: s.totalProducts, icon: Package, color: 'text-c-primary', bg: 'bg-c-primary/10' },
  { label: 'Категорий', value: s.totalCategories, icon: Tag, color: 'text-c-green', bg: 'bg-c-green/10' },
  { label: 'Серверов', value: s.totalServers, icon: Server, color: 'text-c-gold', bg: 'bg-c-gold/10' },
  { label: 'Новостей', value: s.totalNews, icon: Newspaper, color: 'text-c-red', bg: 'bg-c-red/10' },
]

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    adminApi.getStats().then(setStats).catch(() => {})
  }, [])

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-xl font-semibold text-c-text">Дашборд</h1>
        <p className="text-sm text-c-t2 mt-1">Обзор состояния CraftCMS</p>
      </motion.div>

      {!stats ? (
        <LoadingSpinner />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {statCards(stats).map((card, i) => {
              const Icon = card.icon
              return (
                <motion.div
                  key={card.label}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="card rounded-xl p-5"
                >
                  <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center mb-3`}>
                    <Icon className={`w-5 h-5 ${card.color}`} />
                  </div>
                  <div className="text-2xl font-semibold text-c-text">{card.value}</div>
                  <div className="text-sm text-c-t2 mt-0.5">{card.label}</div>
                </motion.div>
              )
            })}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card rounded-xl p-6"
          >
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-c-primary" />
              <h2 className="text-base font-medium text-c-text">Быстрые действия</h2>
            </div>
            <p className="text-sm text-c-t2 leading-relaxed">
              Используйте боковое меню для управления товарами, серверами, новостями и категориями.
              Все изменения немедленно отображаются на сайте.
            </p>
          </motion.div>
        </>
      )}
    </div>
  )
}
