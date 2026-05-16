import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Download, ShoppingBag } from 'lucide-react'
import { useSiteSettings } from '../../store/siteSettingsStore'

export default function HeroSection() {
  const heroTitle = useSiteSettings((s) => s.settings.heroTitle)
  const heroSubtitle = useSiteSettings((s) => s.settings.heroSubtitle)

  return (
    <section className="relative pt-32 pb-20 px-4 overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 70% 40% at 50% 0%, rgba(124,58,237,0.08) 0%, transparent 70%)' }}
      />

      <div className="relative max-w-3xl mx-auto text-center">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.5 }}
          className="text-5xl sm:text-6xl md:text-7xl font-bold text-c-text leading-tight tracking-tight mb-5"
        >
          {heroTitle}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="text-c-t2 text-lg max-w-xl mx-auto mb-10 leading-relaxed"
        >
          {heroSubtitle}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          className="flex items-center justify-center gap-3 flex-wrap"
        >
          <Link
            to="/launcher"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-c-primary hover:bg-c-primary-h text-white text-sm font-medium rounded-lg transition-colors duration-150 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Скачать лаунчер
          </Link>
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-c-bg2 border border-c-border hover:border-c-border-h text-c-t2 hover:text-c-text text-sm font-medium rounded-lg transition-colors duration-150 cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" />
            Магазин
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
