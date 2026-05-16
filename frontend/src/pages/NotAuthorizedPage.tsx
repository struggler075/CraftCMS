import { useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ShieldOff, Home, LogIn } from 'lucide-react'
import PageTransition from '../components/layout/PageTransition'

const BLOCKS = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 32 + 16,
  opacity: Math.random() * 0.06 + 0.02,
  speed: Math.random() * 0.3 + 0.1,
}))

export default function NotAuthorizedPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mouseRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      mouseRef.current = {
        x: (e.clientX - rect.left - rect.width / 2) / rect.width,
        y: (e.clientY - rect.top - rect.height / 2) / rect.height,
      }

      const elements = container.querySelectorAll<HTMLElement>('[data-parallax]')
      elements.forEach((el) => {
        const depth = parseFloat(el.dataset.parallax ?? '1')
        const tx = mouseRef.current.x * depth * 30
        const ty = mouseRef.current.y * depth * 30
        el.style.transform = `translate(${tx}px, ${ty}px)`
      })
    }

    container.addEventListener('mousemove', handleMove)
    return () => container.removeEventListener('mousemove', handleMove)
  }, [])

  return (
    <PageTransition>
      <div ref={containerRef} className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-4">
        {/* Parallax pixel blocks */}
        {BLOCKS.map((b) => (
          <div
            key={b.id}
            data-parallax={b.speed.toFixed(2)}
            className="absolute pointer-events-none select-none rounded-sm transition-transform duration-75"
            style={{
              left: `${b.x}%`,
              top: `${b.y}%`,
              width: b.size,
              height: b.size,
              background: `rgba(124,58,237,${b.opacity})`,
              border: `1px solid rgba(124,58,237,${b.opacity * 2})`,
            }}
          />
        ))}

        {/* Radial glow */}
        <div
          data-parallax="0.5"
          className="absolute w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.06) 0%, transparent 70%)' }}
        />

        {/* Content */}
        <div className="relative z-10 text-center max-w-md">
          {/* Icon */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, type: 'spring', stiffness: 200 }}
            className="flex justify-center mb-8"
          >
            <div className="relative">
              <div className="w-24 h-24 rounded-2xl bg-c-red/10 border border-c-red/20 flex items-center justify-center">
                <ShieldOff className="w-12 h-12 text-c-red" />
              </div>
              {/* Pixel corner decorations */}
              {['-top-2 -left-2', '-top-2 -right-2', '-bottom-2 -left-2', '-bottom-2 -right-2'].map((pos) => (
                <div key={pos} className={`absolute ${pos} w-3 h-3 bg-c-red/30 rounded-sm`} />
              ))}
            </div>
          </motion.div>

          {/* Error code */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xs font-mono text-c-red/60 uppercase tracking-widest mb-3"
          >
            Error 403 · Forbidden
          </motion.p>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="text-4xl font-bold text-c-text mb-4 leading-tight"
          >
            Сюда нельзя
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
            className="text-c-t2 text-base leading-relaxed mb-8"
          >
            У вас недостаточно прав для просмотра этой страницы.
            Попробуйте войти в аккаунт или вернитесь на главную.
          </motion.p>

          {/* Pixel art separator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-center gap-1 mb-8"
          >
            {Array.from({ length: 7 }, (_, i) => (
              <div
                key={i}
                className="h-1 rounded-full"
                style={{
                  width: i === 3 ? 24 : i === 2 || i === 4 ? 12 : 6,
                  background: i === 3 ? '#7c3aed' : 'rgba(124,58,237,0.3)',
                }}
              />
            ))}
          </motion.div>

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="flex items-center justify-center gap-3 flex-wrap"
          >
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-c-primary hover:bg-c-primary-h text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
            >
              <Home className="w-4 h-4" />
              На главную
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-c-bg2 border border-c-border hover:border-c-border-h text-c-t2 hover:text-c-text text-sm font-medium rounded-lg transition-colors cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              Войти
            </Link>
          </motion.div>
        </div>
      </div>
    </PageTransition>
  )
}
