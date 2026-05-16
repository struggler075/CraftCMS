import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Server, Package, ChevronDown, ChevronUp } from 'lucide-react'
import { serversApi } from '../services/api'
import type { ServerWithStatus } from '../types'
import PageTransition from '../components/layout/PageTransition'
import LoadingSpinner from '../components/ui/LoadingSpinner'

function ServerCard({ server, index }: { server: ServerWithStatus; index: number }) {
  const [modsOpen, setModsOpen] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="card rounded-xl overflow-hidden"
    >
      {server.featured && <div className="h-0.5 w-full bg-c-gold" />}

      <div className="p-5">
        <div className="flex items-start gap-4">
          {server.imageUrl ? (
            <img src={server.imageUrl} alt={server.name} className="w-14 h-14 rounded-xl object-cover bg-c-bg3 shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-c-gold/10 border border-c-gold/20 flex items-center justify-center shrink-0">
              <Server className="w-6 h-6 text-c-gold" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-c-text">{server.name}</h2>
              {server.featured && (
                <span className="badge bg-c-gold/10 text-c-gold border border-c-gold/20 text-xs">Топ</span>
              )}
            </div>
          </div>
        </div>

        {server.description && (
          <p className="text-sm text-c-t2 mt-4 leading-relaxed">{server.description}</p>
        )}

        {server.mods && server.mods.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setModsOpen(!modsOpen)}
              className="flex items-center gap-2 text-xs text-c-t2 hover:text-c-text transition-colors cursor-pointer w-full"
            >
              <Package className="w-3.5 h-3.5 text-c-primary" />
              <span className="font-medium">Моды ({server.mods.length})</span>
              {modsOpen
                ? <ChevronUp className="w-3.5 h-3.5 ml-auto" />
                : <ChevronDown className="w-3.5 h-3.5 ml-auto" />
              }
            </button>

            {modsOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-3 space-y-2 overflow-hidden"
              >
                {server.mods.map((mod) => (
                  <div key={mod.id} className="flex items-start gap-2.5 px-3 py-2 rounded-lg bg-c-bg2 border border-c-border">
                    <div className="w-1.5 h-1.5 rounded-full bg-c-primary mt-1.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-c-text leading-snug">{mod.name}</p>
                      {mod.description && (
                        <p className="text-xs text-c-t3 mt-0.5 leading-relaxed">{mod.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}

export default function ServersPage() {
  const [servers, setServers] = useState<ServerWithStatus[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    serversApi.getAll().then(setServers).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const featured = servers.filter((s) => s.featured)
  const regular = servers.filter((s) => !s.featured)

  return (
    <PageTransition>
      <main className="pt-20 pb-20 px-4 max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 pt-8 flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-c-gold/10 border border-c-gold/20 flex items-center justify-center shrink-0">
            <Server className="w-6 h-6 text-c-gold" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-c-text">Серверы</h1>
            <p className="text-sm text-c-t2 mt-0.5">Список игровых серверов проекта</p>
          </div>
        </motion.div>

        {loading ? (
          <LoadingSpinner />
        ) : servers.length === 0 ? (
          <div className="card rounded-xl p-12 text-center">
            <Server className="w-10 h-10 text-c-t3 mx-auto mb-3" />
            <p className="text-sm text-c-t3">Серверы пока не добавлены</p>
          </div>
        ) : (
          <div className="space-y-4">
            {featured.length > 0 && (
              <>
                {featured.map((s, i) => <ServerCard key={s.id} server={s} index={i} />)}
                {regular.length > 0 && (
                  <div className="flex items-center gap-3 py-1">
                    <div className="flex-1 h-px bg-c-border" />
                    <span className="text-xs text-c-t3">Другие серверы</span>
                    <div className="flex-1 h-px bg-c-border" />
                  </div>
                )}
              </>
            )}
            {regular.map((s, i) => <ServerCard key={s.id} server={s} index={featured.length + i} />)}
          </div>
        )}
      </main>
    </PageTransition>
  )
}
