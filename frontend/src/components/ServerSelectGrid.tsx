import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Server as ServerIcon, ChevronRight } from 'lucide-react'
import { serversApi } from '../services/api'
import type { ServerWithStatus } from '../types'
import LoadingSpinner from './ui/LoadingSpinner'

interface Props {
  /** Что выводится в заголовке: "Выберите сервер для покупки" / "Выберите сервер для доната". */
  title: string
  subtitle?: string
  /** Куда перейти при выборе. ServerWithStatus передаётся, чтобы можно было сохранить serverId. */
  onPick: (server: ServerWithStatus) => void
}

/**
 * Showcases all active Minecraft servers as cards. Used as the landing screen
 * for /shop and /donate — admin describes each server once in the Servers tab,
 * players pick which world they're buying for.
 */
export default function ServerSelectGrid({ title, subtitle, onPick }: Props) {
  const [servers, setServers] = useState<ServerWithStatus[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    serversApi.getAll()
      .then((all) => setServers(all))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="pt-20 max-w-5xl mx-auto px-4"><LoadingSpinner /></div>
  }

  if (servers.length === 0) {
    return (
      <div className="pt-20 max-w-5xl mx-auto px-4 text-center">
        <div className="card rounded-xl p-12">
          <ServerIcon className="w-10 h-10 text-c-t3 mx-auto mb-3" />
          <p className="text-sm text-c-t2">Серверов пока нет</p>
          <p className="text-xs text-c-t3 mt-1">Администратор скоро добавит их в админ-панели.</p>
        </div>
      </div>
    )
  }

  return (
    <main className="pt-20 pb-20 px-4 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8 pt-6 text-center">
        <h1 className="text-2xl font-semibold text-c-text">{title}</h1>
        {subtitle && <p className="text-sm text-c-t2 mt-2 max-w-xl mx-auto">{subtitle}</p>}
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {servers.map((s, i) => (
          <motion.button
            key={s.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            onClick={() => onPick(s)}
            className="card rounded-xl overflow-hidden text-left cursor-pointer
                       hover:border-c-border-h transition-colors duration-150 group"
          >
            {/* Image / banner */}
            <div className="aspect-video bg-c-bg2 relative overflow-hidden">
              {s.imageUrl ? (
                <img
                  src={s.imageUrl}
                  alt={s.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ServerIcon className="w-10 h-10 text-c-t3" />
                </div>
              )}
              {s.online && (
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-c-green/20 border border-c-green/30 text-c-green text-[10px] font-medium">
                  Online · {s.playersOnline}
                </div>
              )}
            </div>

            {/* Body */}
            <div className="p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-c-text truncate">{s.name}</h3>
                <ChevronRight className="w-4 h-4 text-c-t3 group-hover:text-c-primary transition-colors shrink-0" />
              </div>
              {s.description && (
                <p className="text-xs text-c-t2 mt-1.5 line-clamp-2">{s.description}</p>
              )}
              {s.mods && s.mods.length > 0 && (
                <p className="text-[11px] text-c-t3 mt-2">
                  Модов: {s.mods.length}
                </p>
              )}
            </div>
          </motion.button>
        ))}
      </div>
    </main>
  )
}
