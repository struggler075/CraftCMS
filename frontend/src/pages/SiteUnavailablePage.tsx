import { motion } from 'framer-motion'
import { RefreshCw } from 'lucide-react'

interface Props {
  countdown: number
  onRetry: () => void
}

export default function SiteUnavailablePage({ countdown, onRetry }: Props) {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      {/* Subtle grid background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
      />

      {/* Radial glow */}
      <div className="fixed inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-[600px] h-[600px] rounded-full bg-red-500/5 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 text-center max-w-md"
      >
        {/* Animated status icon */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            {/* Ping rings */}
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="absolute inset-0 rounded-full border border-red-500/30"
                initial={{ scale: 1, opacity: 0.6 }}
                animate={{ scale: 2.5 + i * 0.8, opacity: 0 }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  delay: i * 0.7,
                  ease: 'easeOut',
                }}
              />
            ))}
            {/* Icon container */}
            <div className="relative w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" />
              </svg>
            </div>
          </div>
        </div>

        {/* Status badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 mb-6"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
          <span className="text-xs font-medium text-red-400 tracking-wide uppercase">Сервер недоступен</span>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-3xl font-bold text-white mb-3 leading-tight"
        >
          Сайт временно<br />недоступен
        </motion.h1>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="text-sm text-white/40 leading-relaxed mb-10"
        >
          Мы уже работаем над этим. Сервер скоро вернётся&nbsp;—<br />
          страница обновится автоматически.
        </motion.p>

        {/* Retry countdown */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="space-y-4"
        >
          {/* Progress bar */}
          <div className="relative h-px bg-white/8 rounded-full overflow-hidden">
            <motion.div
              className="absolute left-0 top-0 h-full bg-red-500/50 rounded-full"
              initial={{ width: '100%' }}
              animate={{ width: `${(countdown / 15) * 100}%` }}
              transition={{ duration: 1, ease: 'linear' }}
            />
          </div>

          <p className="text-xs text-white/25">
            Повтор через{' '}
            <span className="text-white/50 tabular-nums font-medium">{countdown}с</span>
          </p>

          {/* Retry button */}
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/8 hover:border-white/15 text-white/60 hover:text-white/90 text-sm transition-all duration-200 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Проверить сейчас
          </button>
        </motion.div>
      </motion.div>
    </div>
  )
}
