import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Search, ChevronDown } from 'lucide-react'
import { categoriesApi, productsApi, type ProductsQuery } from '../services/api'
import type { Category, Product } from '../types'
import PageTransition from '../components/layout/PageTransition'
import CategorySidebar from '../components/shop/CategorySidebar'
import ProductCard from '../components/shop/ProductCard'
import ProductModal from '../components/shop/ProductModal'
import LoadingSpinner from '../components/ui/LoadingSpinner'

const SORT_OPTIONS = [
  { label: 'Новые', value: 'createdAt-desc' },
  { label: 'Цена: низкая', value: 'price-asc' },
  { label: 'Цена: высокая', value: 'price-desc' },
  { label: 'Название', value: 'name-asc' },
]

export default function ShopPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(0)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [sortValue, setSortValue] = useState('createdAt-desc')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  useEffect(() => {
    categoriesApi.getAll().then(setCategories)
  }, [])

  const loadProducts = async (page: number, category: string, sort: string, append = false) => {
    setLoading(true)
    const [sortBy, sortDir] = sort.split('-')
    try {
      const query: ProductsQuery = { category: category || undefined, page, size: 24, sortBy, sortDir }
      const data = await productsApi.getAll(query)
      if (append) {
        setProducts((prev) => [...prev, ...data.content])
      } else {
        setProducts(data.content)
      }
      setTotal(data.totalElements)
      setTotalPages(data.totalPages)
      setCurrentPage(page)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProducts(0, selectedCategory, sortValue, false)
  }, [selectedCategory, sortValue])

  const handleCategoryChange = (slug: string) => {
    setSelectedCategory(slug)
    setCurrentPage(0)
  }

  const filtered = search.trim()
    ? products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : products

  return (
    <PageTransition>
      <main className="pt-20 pb-20 px-4 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 pt-6">
          <h1 className="text-2xl font-semibold text-c-text">Магазин</h1>
          <p className="text-sm text-c-t2 mt-1">Блоки, предметы, ранги и многое другое</p>
        </div>

        {/* Search + sort */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-c-t3" />
            <input
              type="text"
              placeholder="Поиск товаров..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9"
            />
          </div>
          <div className="relative sm:w-44 shrink-0">
            <select
              value={sortValue}
              onChange={(e) => setSortValue(e.target.value)}
              className="input pr-9 cursor-pointer appearance-none"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} className="bg-c-bg2">{o.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-c-t3" />
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          <CategorySidebar
            categories={categories}
            selected={selectedCategory}
            onSelect={handleCategoryChange}
          />

          <div className="flex-1">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-c-t3">
                {search ? `Найдено: ${filtered.length}` : `${total} товаров`}
              </p>
            </div>

            {loading && products.length === 0 ? (
              <LoadingSpinner />
            ) : (
              <>
                <AnimatePresence mode="popLayout">
                  {filtered.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                      {filtered.map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          onSelect={setSelectedProduct}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-20 text-c-t3 text-sm">
                      Товары не найдены
                    </div>
                  )}
                </AnimatePresence>

                {!search && currentPage < totalPages - 1 && (
                  <div className="flex justify-center mt-10">
                    <button
                      onClick={() => loadProducts(currentPage + 1, selectedCategory, sortValue, true)}
                      disabled={loading}
                      className="px-5 py-2.5 text-sm text-c-t2 hover:text-c-text bg-c-bg2 border border-c-border hover:border-c-border-h rounded-lg transition-colors duration-150 disabled:opacity-50 cursor-pointer"
                    >
                      {loading ? 'Загрузка...' : 'Загрузить ещё'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
    </PageTransition>
  )
}
