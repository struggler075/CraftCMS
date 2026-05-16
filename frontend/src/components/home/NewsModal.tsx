import { useState } from 'react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, ChevronRight, Calendar, User } from 'lucide-react'
import type { News } from '../../types'

const catColors: Record<string, string> = {
  NEWS: 'text-c-primary bg-c-primary/10',
  UPDATE: 'text-c-green bg-c-green/10',
  EVENT: 'text-c-gold bg-c-gold/10',
  ANNOUNCEMENT: 'text-c-t2 bg-c-bg3',
}
const catLabels: Record<string, string> = {
  NEWS: 'Новость', UPDATE: 'Обновление', EVENT: 'Событие', ANNOUNCEMENT: 'Анонс',
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

function ImageCarousel({ images }: { images: string[] }) {
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(0)

  if (images.length === 0) return null

  const go = (dir: number) => {
    setDirection(dir)
    setIndex((i) => (i + dir + images.length) % images.length)
  }

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? '-100%' : '100%', opacity: 0 }),
  }

  return (
    <div className="relative rounded-xl overflow-hidden bg-c-bg3 select-none" style={{ aspectRatio: '16/7' }}>
      <AnimatePresence initial={false} custom={direction} mode="popLayout">
        <motion.img
          key={index}
          src={images[index]}
          alt=""
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
      </AnimatePresence>

      {/* Arrows */}
      {images.length > 1 && (
        <>
          <button
            onClick={() => go(-1)}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors cursor-pointer z-10"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => go(1)}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors cursor-pointer z-10"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Dots */}
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => { setDirection(i > index ? 1 : -1); setIndex(i) }}
                className={`rounded-full transition-all duration-200 cursor-pointer ${i === index ? 'w-5 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/40 hover:bg-white/60'}`}
              />
            ))}
          </div>

          {/* Counter */}
          <div className="absolute top-3 right-3 px-2 py-0.5 rounded-md bg-black/50 text-xs text-white z-10 tabular-nums">
            {index + 1} / {images.length}
          </div>
        </>
      )}
    </div>
  )
}

interface NewsModalProps {
  news: News | null
  onClose: () => void
}

export default function NewsModal({ news, onClose }: NewsModalProps) {
  useEscapeKey(onClose, !!news)

  const allImages = news ? [news.imageUrl, ...(news.images ?? [])].filter(Boolean) : []

  return (
    <AnimatePresence>
      {news && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 35 }}
            className="w-full max-w-2xl bg-c-bg1 border border-c-border rounded-t-2xl sm:rounded-2xl overflow-hidden max-h-[92vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header bar */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-c-border shrink-0">
              <div className="flex items-center gap-2">
                <span className={`badge text-xs ${catColors[news.category] ?? 'text-c-t2 bg-c-bg3'}`}>
                  {catLabels[news.category] ?? news.category}
                </span>
                <span className="flex items-center gap-1 text-xs text-c-t3">
                  <Calendar className="w-3 h-3" />
                  {formatDate(news.createdAt)}
                </span>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-lg bg-c-bg3 hover:bg-white/10 flex items-center justify-center text-c-t3 hover:text-c-t2 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 p-5 space-y-5">
              {/* Title */}
              <h2 className="text-xl font-semibold text-c-text leading-snug">{news.title}</h2>

              {/* Image carousel */}
              {allImages.length > 0 && <ImageCarousel images={allImages} />}

              {/* Excerpt */}
              {news.excerpt && (
                <p className="text-sm text-c-t2 leading-relaxed border-l-2 border-c-primary pl-3">
                  {news.excerpt}
                </p>
              )}

              {/* Content */}
              <div className="text-sm text-c-t2 leading-relaxed whitespace-pre-wrap">
                {news.content}
              </div>

              {/* Author */}
              <div className="flex items-center gap-2 pt-2 border-t border-c-border">
                <div className="w-7 h-7 rounded-full bg-c-primary/20 flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-c-primary" />
                </div>
                <span className="text-sm text-c-t3">{news.author}</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
