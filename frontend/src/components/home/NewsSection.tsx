import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Calendar, ArrowRight } from 'lucide-react'
import { newsApi } from '../../services/api'
import type { News } from '../../types'
import LoadingSpinner from '../ui/LoadingSpinner'
import NewsModal from './NewsModal'

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
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

export default function NewsSection() {
  const [news, setNews] = useState<News[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<News | null>(null)

  useEffect(() => {
    newsApi.getAll({ size: 4 }).then((data) => {
      setNews(data.content)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  return (
    <>
      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-c-text">Новости</h2>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="flex flex-col gap-3">
            {news.map((article, i) => (
              <motion.article
                key={article.id}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setSelected(article)}
                className="card-hover rounded-xl overflow-hidden cursor-pointer flex group"
              >
                {/* Thumbnail */}
                <div className="w-32 sm:w-40 shrink-0 bg-c-bg3 overflow-hidden">
                  <img
                    src={article.imageUrl}
                    alt={article.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                </div>

                {/* Content */}
                <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
                  <div>
                    <span className={`badge mb-2 text-xs ${catColors[article.category] ?? 'text-c-t2 bg-c-bg3'}`}>
                      {catLabels[article.category] ?? article.category}
                    </span>
                    <h3 className="text-sm font-medium text-c-text line-clamp-2 leading-snug mb-1.5">
                      {article.title}
                    </h3>
                    <p className="text-xs text-c-t3 line-clamp-2 leading-relaxed">
                      {article.excerpt}
                    </p>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="flex items-center gap-1 text-xs text-c-t3">
                      <Calendar className="w-3 h-3" />
                      {formatDate(article.createdAt)}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-c-t3 group-hover:text-c-primary group-hover:translate-x-0.5 transition-all duration-200" />
                  </div>
                </div>
              </motion.article>
            ))}
            {news.length === 0 && (
              <p className="text-center text-c-t3 text-sm py-10">Новостей пока нет</p>
            )}
          </div>
        )}
      </section>

      <NewsModal news={selected} onClose={() => setSelected(null)} />
    </>
  )
}
