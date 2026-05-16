import { useEffect, useState } from 'react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Pencil, Trash2, Tag, X, Check } from 'lucide-react'
import { categoriesApi } from '../../services/api'
import type { Category } from '../../types'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'

const EMPTY = { name: '', slug: '', icon: 'package', description: '', sortOrder: '0' }

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  const load = () => categoriesApi.getAll().then(setCategories).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const openCreate = () => { setEditId(null); setForm(EMPTY); setShowForm(true) }
  const openEdit = (c: Category) => {
    setEditId(c.id)
    setForm({ name: c.name, slug: c.slug, icon: c.icon ?? 'package', description: c.description ?? '', sortOrder: c.sortOrder.toString() })
    setShowForm(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = { ...form, sortOrder: parseInt(form.sortOrder) }
      if (editId) { await categoriesApi.update(editId, payload); toast.success('Категория обновлена') }
      else { await categoriesApi.create(payload); toast.success('Категория создана') }
      setShowForm(false); load()
    } catch { toast.error('Ошибка сохранения') } finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить категорию?')) return
    await categoriesApi.delete(id); toast.success('Удалено'); load()
  }

  useEscapeKey(() => setShowForm(false), showForm)

  const F = form as Record<string, string>
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Tag className="w-5 h-5 text-c-green" />
          <h1 className="text-xl font-semibold text-c-text">Категории</h1>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 bg-c-primary hover:bg-c-primary-h text-white text-sm rounded-lg transition-colors cursor-pointer">
          <Plus className="w-4 h-4" /> Добавить
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-c-bg1 border border-c-border rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold text-c-text">{editId ? 'Редактировать' : 'Новая'} категория</h2>
                <button onClick={() => setShowForm(false)} className="text-c-t3 hover:text-c-t2 cursor-pointer"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Название', key: 'name', placeholder: 'Блоки' },
                  { label: 'Slug', key: 'slug', placeholder: 'blocks' },
                  { label: 'Иконка', key: 'icon', placeholder: 'cube' },
                  { label: 'Описание', key: 'description', placeholder: 'Описание...' },
                  { label: 'Порядок', key: 'sortOrder', placeholder: '0' },
                ].map(({ label, key, placeholder }) => (
                  <div key={key}>
                    <label className="block text-sm text-c-t2 mb-1">{label}</label>
                    <input type="text" value={F[key]} onChange={(e) => set(key, e.target.value)} className="input" placeholder={placeholder} />
                  </div>
                ))}
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-lg bg-c-bg3 border border-c-border text-c-t2 hover:text-c-text text-sm transition-colors cursor-pointer">Отмена</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 py-2 rounded-lg bg-c-primary hover:bg-c-primary-h text-white text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" />{saving ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? <LoadingSpinner /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat, i) => (
            <motion.div key={cat.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="card rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-c-text">{cat.name}</div>
                  <div className="text-xs text-c-t3 mt-0.5">/{cat.slug}</div>
                  {cat.description && <p className="text-xs text-c-t2 mt-1 line-clamp-2">{cat.description}</p>}
                </div>
                <div className="flex gap-1 shrink-0 ml-2">
                  <button onClick={() => openEdit(cat)} className="p-1.5 rounded-lg text-c-t3 hover:text-c-primary hover:bg-c-primary/10 transition-colors cursor-pointer"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(cat.id)} className="p-1.5 rounded-lg text-c-t3 hover:text-c-red hover:bg-c-red/10 transition-colors cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </motion.div>
          ))}
          {categories.length === 0 && <p className="col-span-3 text-center py-12 text-c-t3 text-sm">Нет категорий</p>}
        </div>
      )}
    </div>
  )
}
