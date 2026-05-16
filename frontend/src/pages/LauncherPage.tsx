import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Download, Monitor, Terminal, Apple, Package } from 'lucide-react'
import { launcherApi, type LauncherConfig } from '../services/api'
import PageTransition from '../components/layout/PageTransition'
import LoadingSpinner from '../components/ui/LoadingSpinner'

const platforms = [
  {
    key: 'windowsUrl' as keyof LauncherConfig,
    label: 'Windows',
    icon: Monitor,
    ext: '.exe',
    hint: 'Windows 10 / 11, 64-bit',
  },
  {
    key: 'linuxUrl' as keyof LauncherConfig,
    label: 'Linux',
    icon: Terminal,
    ext: '.tar.gz',
    hint: 'Ubuntu, Debian, Arch и другие',
  },
  {
    key: 'macUrl' as keyof LauncherConfig,
    label: 'macOS',
    icon: Apple,
    ext: '.dmg',
    hint: 'macOS 12 Monterey и выше',
  },
]

export default function LauncherPage() {
  const [config, setConfig] = useState<LauncherConfig | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    launcherApi.get().then(setConfig).catch(() => {}).finally(() => setLoading(false))
  }, [])

  return (
    <PageTransition>
      <main className="pt-20 pb-20 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12 pt-8"
          >
            <div className="w-14 h-14 bg-c-primary/10 border border-c-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Package className="w-7 h-7 text-c-primary" />
            </div>
            <h1 className="text-3xl font-bold text-c-text mb-3">Лаунчер</h1>
            {loading ? null : config ? (
              <>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-c-green/10 border border-c-green/20 text-c-green text-xs mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-c-green" />
                  Версия {config.version}
                </div>
                <p className="text-c-t2 text-base leading-relaxed max-w-md mx-auto">
                  {config.description}
                </p>
              </>
            ) : (
              <p className="text-c-t3 text-sm">Лаунчер временно недоступен</p>
            )}
          </motion.div>

          {loading ? (
            <LoadingSpinner />
          ) : config ? (
            <>
              {/* Download cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
                {platforms.map(({ key, label, icon: Icon, hint }, i) => {
                  const url = config[key] as string
                  const available = !!url
                  return (
                    <motion.a
                      key={key}
                      href={available ? url : undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className={`card rounded-xl p-5 flex flex-col items-center text-center gap-3 transition-colors duration-150
                        ${available ? 'card-hover cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
                      onClick={!available ? (e) => e.preventDefault() : undefined}
                    >
                      <div className="w-10 h-10 rounded-xl bg-c-bg3 border border-c-border flex items-center justify-center">
                        <Icon className="w-5 h-5 text-c-t2" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-c-text">{label}</p>
                        <p className="text-xs text-c-t3 mt-0.5">{hint}</p>
                      </div>
                      <div className={`flex items-center gap-1.5 text-xs font-medium mt-auto pt-1 ${available ? 'text-c-primary' : 'text-c-t3'}`}>
                        <Download className="w-3.5 h-3.5" />
                        {available ? 'Скачать' : 'Недоступно'}
                      </div>
                    </motion.a>
                  )
                })}
              </div>

            </>
          ) : (
            <div className="text-center card rounded-xl p-12">
              <p className="text-c-t3 text-sm">Информация о лаунчере пока не настроена.</p>
            </div>
          )}
        </div>
      </main>
    </PageTransition>
  )
}
