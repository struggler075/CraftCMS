import { useEffect, useRef, useState } from 'react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Pencil, Trash2, Package, X, Check, Upload, ImageIcon } from 'lucide-react'
import { productsApi, categoriesApi, adminApi } from '../../services/api'
import type { Category, Product } from '../../types'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'

const EMPTY_FORM = {
  name: '', description: '', price: '', imageUrl: '',
  categoryId: '', stock: '0', featured: false, active: true, type: 'ITEM', command: '',
  quantityEnabled: false, defaultQuantity: '1',
}

function ImageDropzone({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Только изображения'); return }
    setUploading(true)
    try {
      const { url } = await adminApi.uploadProductImage(file)
      onChange(url)
      toast.success('Изображение загружено')
    } catch {
      toast.error('Ошибка загрузки')
    } finally {
      setUploading(false)
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div>
      <label className="block text-sm text-c-t2 mb-1">Изображение товара</label>
      <div
        className={`relative border-2 border-dashed rounded-xl transition-colors cursor-pointer
          ${dragging ? 'border-c-primary bg-c-primary/5' : 'border-c-border hover:border-c-border-h'}`}
        style={{ minHeight: '120px' }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />

        {value ? (
          <div className="flex items-center gap-4 p-3">
            <img src={value} alt="Preview" className="w-20 h-20 object-cover rounded-lg bg-c-bg3 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-c-t2 truncate">{value}</p>
              <p className="text-xs text-c-t3 mt-1">Кликните или перетащите для замены</p>
            </div>
            {uploading && <div className="w-5 h-5 border-2 border-c-primary border-t-transparent rounded-full animate-spin shrink-0" />}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
            {uploading ? (
              <div className="w-6 h-6 border-2 border-c-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <div className="w-10 h-10 rounded-xl bg-c-bg3 flex items-center justify-center">
                  {dragging ? <Upload className="w-5 h-5 text-c-primary" /> : <ImageIcon className="w-5 h-5 text-c-t3" />}
                </div>
                <p className="text-sm text-c-t2">Перетащите или <span className="text-c-primary">выберите файл</span></p>
                <p className="text-xs text-c-t3">PNG, JPG, WEBP · до 5 MB</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function AdminModal({ title, onClose, onSave, saving, children }: {
  title: string; onClose: () => void; onSave: () => void; saving: boolean; children: React.ReactNode
}) {
  useEscapeKey(onClose)
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-lg bg-c-bg1 border border-c-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-c-text">{title}</h2>
          <button onClick={onClose} className="text-c-t3 hover:text-c-t2 cursor-pointer transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">{children}</div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg bg-c-bg3 border border-c-border text-c-t2 hover:text-c-text text-sm transition-colors cursor-pointer">Отмена</button>
          <button onClick={onSave} disabled={saving} className="flex-1 py-2 rounded-lg bg-c-primary hover:bg-c-primary-h text-white text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2">
            <Check className="w-4 h-4" />{saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    const [prods, cats] = await Promise.all([productsApi.getAllAdmin(), categoriesApi.getAll()])
    setProducts(prods); setCategories(cats); setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openCreate = () => { setEditId(null); setForm({ ...EMPTY_FORM, categoryId: categories[0]?.id.toString() ?? '' }); setShowForm(true) }
  const openEdit = (p: Product) => {
    setEditId(p.id)
    setForm({ name: p.name, description: p.description ?? '', price: p.price.toString(), imageUrl: p.imageUrl ?? '',
      categoryId: p.category.id.toString(), stock: p.stock.toString(), featured: p.featured, active: p.active, type: p.type,
      command: p.command ?? '', quantityEnabled: p.quantityEnabled ?? false, defaultQuantity: (p.defaultQuantity ?? 1).toString() })
    setShowForm(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = { name: form.name, description: form.description, price: parseFloat(form.price),
        imageUrl: form.imageUrl, categoryId: parseInt(form.categoryId), stock: parseInt(form.stock),
        featured: form.featured, active: form.active, type: form.type as Product['type'],
        command: form.command || null, quantityEnabled: form.quantityEnabled,
        defaultQuantity: parseInt(form.defaultQuantity) || 1 }
      if (editId) { await productsApi.update(editId, payload); toast.success('Товар обновлён') }
      else { await productsApi.create(payload); toast.success('Товар создан') }
      setShowForm(false); load()
    } catch { toast.error('Ошибка сохранения') } finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить товар?')) return
    await productsApi.delete(id); toast.success('Товар удалён'); load()
  }

  const F = form as Record<string, unknown>
  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-c-primary" />
          <h1 className="text-xl font-semibold text-c-text">Товары</h1>
          <span className="text-c-t3 text-sm">({products.length})</span>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 bg-c-primary hover:bg-c-primary-h text-white text-sm rounded-lg transition-colors cursor-pointer">
          <Plus className="w-4 h-4" /> Добавить
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <AdminModal title={`${editId ? 'Редактировать' : 'Новый'} товар`} onClose={() => setShowForm(false)} onSave={handleSave} saving={saving}>
            {[
              { label: 'Название', key: 'name', type: 'text', placeholder: 'Алмазный меч' },
              { label: 'Описание', key: 'description', type: 'textarea', placeholder: 'Описание товара...' },
              { label: 'Цена (₽)', key: 'price', type: 'number', placeholder: '99.00' },
              { label: 'Количество', key: 'stock', type: 'number', placeholder: '999' },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key}>
                <label className="block text-sm text-c-t2 mb-1">{label}</label>
                {type === 'textarea' ? (
                  <textarea value={F[key] as string} onChange={(e) => set(key, e.target.value)}
                    className="input resize-none h-20" placeholder={placeholder} />
                ) : (
                  <input type={type} value={F[key] as string} onChange={(e) => set(key, e.target.value)}
                    className="input" placeholder={placeholder} />
                )}
              </div>
            ))}

            <div>
              <label className="block text-sm text-c-t2 mb-1">Команда выдачи</label>
              <textarea value={form.command} onChange={(e) => set('command', e.target.value)}
                className="input resize-none h-16 font-mono text-xs"
                placeholder="give {username} diamond {amount}" />
              <p className="text-xs text-c-t3 mt-1">Плейсхолдеры: <code>{'{username}'}</code> — ник, <code>{'{amount}'}</code> — кол-во</p>
            </div>

            <ImageDropzone value={form.imageUrl} onChange={(url) => set('imageUrl', url)} />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-c-t2 mb-1">Категория</label>
                <select value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)} className="input cursor-pointer">
                  {categories.map((c) => <option key={c.id} value={c.id} className="bg-c-bg2">{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-c-t2 mb-1">Тип</label>
                <select value={form.type} onChange={(e) => set('type', e.target.value)} className="input cursor-pointer">
                  {['BLOCK','ITEM','ARMOR','WEAPON','TOOL','ENCHANTMENT','KIT','RANK','CURRENCY'].map(t => (
                    <option key={t} value={t} className="bg-c-bg2">{t}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-4 flex-wrap">
              {[['featured', 'Рекомендуемый'], ['active', 'Активен'], ['quantityEnabled', 'Выбор количества']].map(([k, l]) => (
                <label key={k} className="flex items-center gap-2 cursor-pointer text-sm text-c-t2">
                  <input type="checkbox" checked={F[k] as boolean} onChange={(e) => set(k, e.target.checked)} className="accent-c-primary" />{l}
                </label>
              ))}
            </div>
            {form.quantityEnabled && (
              <div>
                <label className="block text-sm text-c-t2 mb-1">Количество по умолчанию</label>
                <input type="number" min="1" value={form.defaultQuantity}
                  onChange={(e) => set('defaultQuantity', e.target.value)}
                  className="input w-32" placeholder="1" />
              </div>
            )}
          </AdminModal>
        )}
      </AnimatePresence>

      {loading ? <LoadingSpinner /> : (
        <div className="card rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-c-border">
                  {['Название', 'Категория', 'Цена', 'Статус', 'Действия'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs text-c-t3 uppercase tracking-wider font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-c-border">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img src={p.imageUrl} alt={p.name} className="w-8 h-8 rounded-lg object-cover bg-c-bg3" />
                        <div>
                          <div className="text-sm font-medium text-c-text">{p.name}</div>
                          <div className="text-xs text-c-t3">{p.type}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-c-t2">{p.category.name}</td>
                    <td className="px-4 py-3 text-sm font-medium text-c-gold tabular-nums">{p.price.toLocaleString('ru-RU')} ₽</td>
                    <td className="px-4 py-3">
                      <span className={`badge border ${p.active ? 'bg-c-green/10 text-c-green border-c-green/20' : 'bg-c-red/10 text-c-red border-c-red/20'}`}>
                        {p.active ? 'Активен' : 'Скрыт'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-c-t3 hover:text-c-primary hover:bg-c-primary/10 transition-colors cursor-pointer"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg text-c-t3 hover:text-c-red hover:bg-c-red/10 transition-colors cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {products.length === 0 && <div className="text-center py-12 text-c-t3 text-sm">Нет товаров</div>}
          </div>
        </div>
      )}
    </div>
  )
}
