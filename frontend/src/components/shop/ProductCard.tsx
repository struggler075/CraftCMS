import { motion } from 'framer-motion'
import type { Product } from '../../types'

interface ProductCardProps {
  product: Product
  onSelect: (product: Product) => void
}

export default function ProductCard({ product, onSelect }: ProductCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="card-hover rounded-xl overflow-hidden cursor-pointer group"
      onClick={() => onSelect(product)}
    >
      {/* Image */}
      <div className="relative aspect-square bg-c-bg2 overflow-hidden">
        <img
          src={product.imageUrl}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        {product.featured && (
          <span className="absolute top-2 left-2 badge bg-c-gold/15 text-c-gold border border-c-gold/20">
            Хит
          </span>
        )}
        {product.stock === 0 && (
          <div className="absolute inset-0 bg-c-bg/60 flex items-center justify-center">
            <span className="text-xs text-c-t2 font-medium">Нет в наличии</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-xs text-c-t3 mb-0.5 truncate">{product.category.name}</p>
        <p className="text-sm text-c-text font-medium truncate mb-2">{product.name}</p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-c-primary font-semibold text-sm tabular-nums">
            {product.price.toLocaleString('ru-RU')} ₽
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onSelect(product) }}
            disabled={product.stock === 0}
            className="px-2.5 py-1 text-xs font-medium bg-c-primary hover:bg-c-primary-h text-white rounded-md transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
          >
            Купить
          </button>
        </div>
      </div>
    </motion.div>
  )
}
