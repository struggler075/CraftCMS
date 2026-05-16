import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Server, Users, RefreshCw } from 'lucide-react'
import { serversApi } from '../../services/api'
import type { ServerWithStatus } from '../../types'
import LoadingSpinner from '../ui/LoadingSpinner'

export default function ServersSection() {
  const [servers, setServers] = useState<ServerWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    try {
      const data = await serversApi.getAll()
      setServers(data)
    } catch { /* ignore */ } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(() => load(), 60000)
    return () => clearInterval(interval)
  }, [])

  return (
    <section>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-c-text">Серверы</h2>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-xs text-c-t3 hover:text-c-t2 transition-colors cursor-pointer disabled:opacity-50"
          aria-label="Обновить"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Обновить
        </button>
      </div>

      {loading ? (
        <LoadingSpinner size={28} />
      ) : (
        <div className="flex flex-col gap-2">
          {servers.map((server, i) => {
            const fill = server.playersMax > 0
              ? Math.round((server.playersOnline / server.playersMax) * 100)
              : 0

            return (
              <motion.div
                key={server.id}
                initial={{ opacity: 0, x: 10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="card rounded-xl p-3.5"
              >
                <div className="flex items-center gap-3">
                  {/* Server image or icon */}
                  {server.imageUrl ? (
                    <img
                      src={server.imageUrl}
                      alt={server.name}
                      className="w-9 h-9 rounded-lg object-cover bg-c-bg3 shrink-0"
                    />
                  ) : (
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${server.online ? 'bg-c-green/10' : 'bg-c-bg3'}`}>
                      <Server className={`w-4 h-4 ${server.online ? 'text-c-green' : 'text-c-t3'}`} />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-sm font-medium text-c-text truncate">{server.name}</span>
                      <span className={`text-xs shrink-0 font-medium ${server.online ? 'text-c-green' : 'text-c-t3'}`}>
                        {server.online ? 'Online' : 'Offline'}
                      </span>
                    </div>

                    {server.online ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 bg-c-bg3 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${fill}%` }}
                            transition={{ duration: 0.8 }}
                            className={`h-full rounded-full ${fill > 80 ? 'bg-c-gold' : 'bg-c-green'}`}
                          />
                        </div>
                        <span className="flex items-center gap-1 text-xs text-c-t3 shrink-0 tabular-nums">
                          <Users className="w-3 h-3" />
                          {server.playersOnline}<span className="text-c-t3/50">/{server.playersMax}</span>
                        </span>
                      </div>
                    ) : (
                      <p className="text-xs text-c-t3">Сервер недоступен</p>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })}
          {servers.length === 0 && (
            <p className="text-center text-c-t3 text-sm py-8">Серверы не найдены</p>
          )}
        </div>
      )}
    </section>
  )
}
