import { useEffect, useRef, useState } from 'react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Pencil, Trash2, Newspaper, X, Check, Upload, ImageIcon, Images } from 'lucide-react'
import { newsApi, adminApi } from '../../services/api'
import type { News } from '../../types'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'

const CATEGORIES = ['NEWS', 'UPDATE', 'EVENT', 'ANNOUNCEMENT']
const EMPTY = {
  title: '', content: '', excerpt: '', imageUrl: '',
  images: [] as string[], author: 'CraftCMS Team', category: 'NEWS', published: true,
}

function ImageDropzone({ value, onChange, label = 'Обложка' }: { value: string; onChange: (url: string) => void; label?: string }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Только изображения'); return }
    setUploading(true)
    try {
      const { url } = await adminApi.uploadNewsImage(file)
      onChange(url)
    } catch { toast.error('Ошибка загрузки') } finally { setUploading(false) }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div>
      <label className="block text-sm text-c-t2 mb-1">{label}</label>
      <div
        className={`relative border-2 border-dashed rounded-xl transition-colors cursor-pointer
          ${dragging ? 'border-c-primary bg-c-primary/5' : 'border-c-border hover:border-c-border-h'}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <input ref={inputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />

        {value ? (
          <div className="flex items-center gap-3 p-3">
            <img src={value} alt="" className="w-16 h-16 object-cover rounded-lg bg-c-bg3 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-c-t2 truncate">{value}</p>
              <p className="text-xs text-c-t3 mt-0.5">Кликните для замены</p>
            </div>
            {uploading && <div className="w-4 h-4 border-2 border-c-primary border-t-transparent rounded-full animate-spin shrink-0" />}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 gap-2">
            {uploading ? (
              <div className="w-5 h-5 border-2 border-c-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <div className="w-9 h-9 rounded-lg bg-c-bg3 flex items-center justify-center">
                  {dragging ? <Upload className="w-4 h-4 text-c-primary" /> : <ImageIcon className="w-4 h-4 text-c-t3" />}
                </div>
                <p className="text-xs text-c-t2">Перетащите или <span className="text-c-primary">выберите</span></p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function GalleryDropzone({ images, onChange }: { images: string[]; onChange: (imgs: string[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)

  const handleFiles = async (files: FileList) => {
    const valid = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (!valid.length) { toast.error('Только изображения'); return }
    setUploading(true)
    try {
      const results = await Promise.all(valid.map(f => adminApi.uploadNewsImage(f)))
      onChange([...images, ...results.map(r => r.url)])
      toast.success(`Загружено ${results.length} фото`)
    } catch { toast.error('Ошибка загрузки') } finally { setUploading(false) }
  }

  const remove = (idx: number) => onChange(images.filter((_, i) => i !== idx))

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files)
  }

  return (
    <div>
      <label className="block text-sm text-c-t2 mb-1">Галерея фото</label>

      {/* Thumbnails row */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {images.map((url, i) => (
            <div key={url + i} className="relative group/thumb">
              <img src={url} alt="" className="w-16 h-16 object-cover rounded-lg bg-c-bg3" />
              <button
                onClick={() => remove(i)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-c-red flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity cursor-pointer"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-xl transition-colors cursor-pointer
          ${dragging ? 'border-c-primary bg-c-primary/5' : 'border-c-border hover:border-c-border-h'}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files) }} />
        <div className="flex items-center justify-center gap-2 py-4">
          {uploading ? (
            <div className="w-4 h-4 border-2 border-c-primary border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <div className="w-7 h-7 rounded-lg bg-c-bg3 flex items-center justify-center">
                {dragging ? <Upload className="w-3.5 h-3.5 text-c-primary" /> : <Images className="w-3.5 h-3.5 text-c-t3" />}
              </div>
              <p className="text-xs text-c-t2">
                {images.length > 0 ? 'Добавить ещё фото' : 'Перетащите несколько фото'}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AdminNews() {
  const [news, setNews] = useState<News[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  const load = () => newsApi.getAll({ size: 50 }).then((d) => setNews(d.content)).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const openCreate = () => { setEditId(null); setForm(EMPTY); setShowForm(true) }
  const openEdit = (n: News) => {
    setEditId(n.id)
    setForm({
      title: n.title, content: n.content, excerpt: n.excerpt ?? '',
      imageUrl: n.imageUrl ?? '', images: n.images ?? [],
      author: n.author, category: n.category, published: n.published,
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editId) { await newsApi.update(editId, form as Partial<News>); toast.success('Новость обновлена') }
      else { await newsApi.create(form as Partial<News>); toast.success('Новость создана') }
      setShowForm(false); load()
    } catch { toast.error('Ошибка') } finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить новость?')) return
    await newsApi.delete(id); toast.success('Удалено'); load()
  }

  useEscapeKey(() => setShowForm(false), showForm)

  const set = <K extends keyof typeof EMPTY>(k: K, v: typeof EMPTY[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Newspaper className="w-5 h-5 text-c-red" />
          <h1 className="text-xl font-semibold text-c-text">Новости</h1>
          <span className="text-c-t3 text-sm">({news.length})</span>
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
              className="w-full max-w-lg bg-c-bg1 border border-c-border rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold text-c-text">{editId ? 'Редактировать' : 'Новая'} новость</h2>
                <button onClick={() => setShowForm(false)} className="text-c-t3 hover:text-c-t2 cursor-pointer"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
                {/* Text fields */}
                {([
                  { label: 'Заголовок', key: 'title', type: 'text', placeholder: 'Большое обновление...' },
                  { label: 'Краткое описание', key: 'excerpt', type: 'text', placeholder: 'Краткое описание...' },
                  { label: 'Текст новости', key: 'content', type: 'textarea', placeholder: 'Полный текст...' },
                  { label: 'Автор', key: 'author', type: 'text', placeholder: 'CraftCMS Team' },
                ] as const).map(({ label, key, type, placeholder }) => (
                  <div key={key}>
                    <label className="block text-sm text-c-t2 mb-1">{label}</label>
                    {type === 'textarea' ? (
                      <textarea value={form[key] as string} onChange={(e) => set(key, e.target.value)}
                        className="input resize-none h-24" placeholder={placeholder} />
                    ) : (
                      <input type="text" value={form[key] as string} onChange={(e) => set(key, e.target.value)}
                        className="input" placeholder={placeholder} />
                    )}
                  </div>
                ))}

                {/* Cover image */}
                <ImageDropzone value={form.imageUrl} onChange={(url) => set('imageUrl', url)} />

                {/* Gallery */}
                <GalleryDropzone images={form.images} onChange={(imgs) => set('images', imgs)} />

                {/* Category + Published */}
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="block text-sm text-c-t2 mb-1">Категория</label>
                    <select value={form.category} onChange={(e) => set('category', e.target.value)} className="input cursor-pointer">
                      {CATEGORIES.map(c => <option key={c} value={c} className="bg-c-bg2">{c}</option>)}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-c-t2 pb-2">
                    <input type="checkbox" checked={form.published} onChange={(e) => set('published', e.target.checked)} className="accent-c-primary" />
                    Опубликовано
                  </label>
                </div>
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
        <div className="card rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-c-border">
                  {['Заголовок', 'Автор', 'Категория', 'Фото', 'Статус', 'Действия'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs text-c-t3 uppercase tracking-wider font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-c-border">
                {news.map((n) => (
                  <tr key={n.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-c-text line-clamp-1">{n.title}</div>
                      <div className="text-xs text-c-t3 line-clamp-1">{n.excerpt}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-c-t2">{n.author}</td>
                    <td className="px-4 py-3">
                      <span className="badge bg-c-bg3 text-c-t2 border border-c-border">{n.category}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-c-t3 tabular-nums">
                      {1 + (n.images?.length ?? 0)} фото
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge border ${n.published ? 'bg-c-green/10 text-c-green border-c-green/20' : 'bg-c-bg3 text-c-t3 border-c-border'}`}>
                        {n.published ? 'Опубл.' : 'Черновик'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(n)} className="p-1.5 rounded-lg text-c-t3 hover:text-c-primary hover:bg-c-primary/10 transition-colors cursor-pointer"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(n.id)} className="p-1.5 rounded-lg text-c-t3 hover:text-c-red hover:bg-c-red/10 transition-colors cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {news.length === 0 && <div className="text-center py-12 text-c-t3 text-sm">Нет новостей</div>}
          </div>
        </div>
      )}
    </div>
  )
}
