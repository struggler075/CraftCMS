import { useEffect, useRef, useState } from 'react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Pencil, Trash2, Gem, X, Check, Upload, ImageIcon, List } from 'lucide-react'
import { adminDonateApi } from '../../services/api'
import type { DonateFeature, DonateRank } from '../../types'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'

// ── Gem preview ────────────────────────────────────────────────────────────────

function GemPreview({ color, size = 28 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 38 38" fill="none">
      <polygon points="19,3 34,12 34,26 19,35 4,26 4,12" fill={color} opacity="0.9" />
      <polygon points="19,3 34,12 19,19 4,12" fill="white" opacity="0.22" />
      <polygon points="19,19 34,26 19,35 4,26" fill="black" opacity="0.18" />
    </svg>
  )
}

// ── Image Dropzone ─────────────────────────────────────────────────────────────

function ImageDropzone({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Только изображения'); return }
    setUploading(true)
    try { const { url } = await adminDonateApi.uploadImage(file); onChange(url) }
    catch { toast.error('Ошибка загрузки') }
    finally { setUploading(false) }
  }

  return (
    <div>
      <label className="block text-sm text-c-t2 mb-1">Иконка ранга (необязательно)</label>
      <div
        className={`relative border-2 border-dashed rounded-xl transition-colors cursor-pointer
          ${dragging ? 'border-c-primary bg-c-primary/5' : 'border-c-border hover:border-c-border-h'}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
      >
        <input ref={inputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        {value ? (
          <div className="flex items-center gap-3 p-3">
            <img src={value} alt="" className="w-12 h-12 object-contain rounded-lg bg-c-bg3 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-c-t2 truncate">{value}</p>
              <p className="text-xs text-c-t3 mt-0.5">Кликните для замены</p>
            </div>
            {uploading && <div className="w-4 h-4 border-2 border-c-primary border-t-transparent rounded-full animate-spin shrink-0" />}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-4 gap-1.5">
            {uploading
              ? <div className="w-5 h-5 border-2 border-c-primary border-t-transparent rounded-full animate-spin" />
              : <>
                  <div className="w-8 h-8 rounded-lg bg-c-bg3 flex items-center justify-center">
                    {dragging ? <Upload className="w-4 h-4 text-c-primary" /> : <ImageIcon className="w-4 h-4 text-c-t3" />}
                  </div>
                  <p className="text-xs text-c-t2">Перетащите или <span className="text-c-primary">выберите</span></p>
                </>
            }
          </div>
        )}
      </div>
    </div>
  )
}

// ── Features tab ───────────────────────────────────────────────────────────────

function FeaturesTab() {
  const [features, setFeatures] = useState<DonateFeature[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [sortOrder, setSortOrder] = useState('0')
  const [saving, setSaving] = useState(false)

  const load = () => adminDonateApi.getFeatures().then(setFeatures).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const openCreate = () => { setEditId(null); setName(''); setSortOrder('0'); setShowForm(true) }
  const openEdit = (f: DonateFeature) => { setEditId(f.id); setName(f.name); setSortOrder(f.sortOrder.toString()); setShowForm(true) }

  const handleSave = async () => {
    setSaving(true)
    try {
      const data = { name, sortOrder: parseInt(sortOrder) }
      if (editId) { await adminDonateApi.updateFeature(editId, data); toast.success('Обновлено') }
      else { await adminDonateApi.createFeature(data); toast.success('Создано') }
      setShowForm(false); load()
    } catch { toast.error('Ошибка сохранения') } finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить привилегию?')) return
    await adminDonateApi.deleteFeature(id); toast.success('Удалено'); load()
  }

  useEscapeKey(() => setShowForm(false), showForm)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-c-t3">{features.length} привилегий</p>
        <button onClick={openCreate}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-c-primary hover:bg-c-primary-h text-white text-sm rounded-lg transition-colors cursor-pointer">
          <Plus className="w-4 h-4" /> Добавить
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm bg-c-bg1 border border-c-border rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-c-text">{editId ? 'Редактировать' : 'Новая'} привилегия</h3>
                <button onClick={() => setShowForm(false)} className="text-c-t3 hover:text-c-t2 cursor-pointer"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-c-t2 mb-1">Название</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} className="input"
                    placeholder="Вход на заполненный сервер" autoFocus />
                </div>
                <div>
                  <label className="block text-sm text-c-t2 mb-1">Порядок</label>
                  <input value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="input" placeholder="0" />
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowForm(false)}
                  className="flex-1 py-2 rounded-lg bg-c-bg3 border border-c-border text-c-t2 hover:text-c-text text-sm transition-colors cursor-pointer">
                  Отмена
                </button>
                <button onClick={handleSave} disabled={saving || !name.trim()}
                  className="flex-1 py-2 rounded-lg bg-c-primary hover:bg-c-primary-h text-white text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" />{saving ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? <LoadingSpinner /> : (
        <div className="space-y-2">
          {features.map((f, i) => (
            <motion.div key={f.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="card rounded-xl px-4 py-3 flex items-center justify-between gap-4">
              <span className="text-sm text-c-t2">{f.name}</span>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => openEdit(f)}
                  className="p-1.5 rounded-lg text-c-t3 hover:text-c-primary hover:bg-c-primary/10 transition-colors cursor-pointer">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(f.id)}
                  className="p-1.5 rounded-lg text-c-t3 hover:text-c-red hover:bg-c-red/10 transition-colors cursor-pointer">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
          {features.length === 0 && <p className="text-center py-10 text-c-t3 text-sm">Нет привилегий</p>}
        </div>
      )}
    </div>
  )
}

// ── Ranks tab ──────────────────────────────────────────────────────────────────

const EMPTY_RANK = {
  name: '', color: '#7c3aed', imageUrl: '', price: '0', sortOrder: '0', featured: false, featureIds: [] as number[], command: '',
}

function RanksTab() {
  const [ranks, setRanks] = useState<DonateRank[]>([])
  const [allFeatures, setAllFeatures] = useState<DonateFeature[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState(EMPTY_RANK)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const [r, f] = await Promise.all([adminDonateApi.getRanks(), adminDonateApi.getFeatures()])
    setRanks(r); setAllFeatures(f); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openCreate = () => { setEditId(null); setForm(EMPTY_RANK); setShowForm(true) }
  const openEdit = (r: DonateRank) => {
    setEditId(r.id)
    setForm({ name: r.name, color: r.color, imageUrl: r.imageUrl ?? '', price: r.price.toString(),
      sortOrder: r.sortOrder.toString(), featured: r.featured, featureIds: r.featureIds,
      command: (r as unknown as { command?: string }).command ?? '' })
    setShowForm(true)
  }

  const toggleFeature = (fid: number) =>
    setForm((f) => ({ ...f, featureIds: f.featureIds.includes(fid) ? f.featureIds.filter((x) => x !== fid) : [...f.featureIds, fid] }))

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = { ...form, price: parseInt(form.price), sortOrder: parseInt(form.sortOrder),
        imageUrl: form.imageUrl || null, command: form.command || null }
      if (editId) { await adminDonateApi.updateRank(editId, payload); toast.success('Ранг обновлён') }
      else { await adminDonateApi.createRank(payload); toast.success('Ранг создан') }
      setShowForm(false); load()
    } catch { toast.error('Ошибка') } finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить ранг?')) return
    await adminDonateApi.deleteRank(id); toast.success('Удалено'); load()
  }

  useEscapeKey(() => setShowForm(false), showForm)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-c-t3">{ranks.length} рангов</p>
        <button onClick={openCreate}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-c-primary hover:bg-c-primary-h text-white text-sm rounded-lg transition-colors cursor-pointer">
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
                <h3 className="text-sm font-semibold text-c-text">{editId ? 'Редактировать' : 'Новый'} ранг</h3>
                <button onClick={() => setShowForm(false)} className="text-c-t3 hover:text-c-t2 cursor-pointer"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
                {/* Name + Color */}
                <div className="grid grid-cols-[1fr_auto] gap-3">
                  <div>
                    <label className="block text-sm text-c-t2 mb-1">Название</label>
                    <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      className="input" placeholder="VIP" />
                  </div>
                  <div>
                    <label className="block text-sm text-c-t2 mb-1">Цвет</label>
                    <div className="flex items-center gap-2 h-10">
                      <input type="color" value={form.color}
                        onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                        className="w-10 h-10 rounded-lg border border-c-border cursor-pointer bg-transparent p-0.5" />
                      <input value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                        className="input w-28 font-mono text-sm" placeholder="#7c3aed" />
                      <GemPreview color={form.color} size={28} />
                    </div>
                  </div>
                </div>

                {/* Price + Sort + Featured */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm text-c-t2 mb-1">Цена (₽)</label>
                    <input value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                      className="input" type="number" min="0" />
                  </div>
                  <div>
                    <label className="block text-sm text-c-t2 mb-1">Порядок</label>
                    <input value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                      className="input" type="number" />
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-c-t2">
                      <input type="checkbox" checked={form.featured}
                        onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))}
                        className="accent-c-primary" />
                      Топ ранг
                    </label>
                  </div>
                </div>

                {/* Command */}
                <div>
                  <label className="block text-sm text-c-t2 mb-1">Команда выдачи</label>
                  <textarea value={form.command} onChange={(e) => setForm((f) => ({ ...f, command: e.target.value }))}
                    className="input resize-none h-16 font-mono text-xs"
                    placeholder="lp user {username} parent set vip" />
                  <p className="text-xs text-c-t3 mt-1">Плейсхолдер <code>{'{username}'}</code> — ник игрока</p>
                </div>

                {/* Image */}
                <ImageDropzone value={form.imageUrl}
                  onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))} />

                {/* Feature checkboxes */}
                {allFeatures.length > 0 && (
                  <div>
                    <label className="block text-sm text-c-t2 mb-2">Привилегии этого ранга</label>
                    <div className="bg-c-bg2 border border-c-border rounded-xl p-3 space-y-1.5 max-h-44 overflow-y-auto">
                      {allFeatures.map((feat) => (
                        <label key={feat.id} className="flex items-center gap-2.5 cursor-pointer group">
                          <input type="checkbox" checked={form.featureIds.includes(feat.id)}
                            onChange={() => toggleFeature(feat.id)} className="accent-c-primary" />
                          <span className="text-sm text-c-t2 group-hover:text-c-text transition-colors">{feat.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {allFeatures.length === 0 && (
                  <p className="text-xs text-c-t3 text-center py-2">Сначала создайте привилегии во вкладке «Привилегии»</p>
                )}
              </div>

              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowForm(false)}
                  className="flex-1 py-2 rounded-lg bg-c-bg3 border border-c-border text-c-t2 hover:text-c-text text-sm transition-colors cursor-pointer">
                  Отмена
                </button>
                <button onClick={handleSave} disabled={saving || !form.name.trim()}
                  className="flex-1 py-2 rounded-lg bg-c-primary hover:bg-c-primary-h text-white text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" />{saving ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? <LoadingSpinner /> : (
        <div className="space-y-2">
          {ranks.map((r, i) => (
            <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="card rounded-xl p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  {r.imageUrl
                    ? <img src={r.imageUrl} alt={r.name} className="w-9 h-9 object-contain shrink-0" />
                    : <GemPreview color={r.color} size={32} />
                  }
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-c-text">{r.name}</span>
                      {r.featured && <span className="badge border" style={{ color: r.color, borderColor: `${r.color}40`, background: `${r.color}15` }}>Топ</span>}
                      <span className="text-xs text-c-t3 tabular-nums">{r.price.toLocaleString('ru-RU')} ₽</span>
                    </div>
                    <div className="text-xs text-c-t3 mt-0.5">{r.featureIds.length} привилегий</div>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(r)}
                    className="p-1.5 rounded-lg text-c-t3 hover:text-c-primary hover:bg-c-primary/10 transition-colors cursor-pointer">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(r.id)}
                    className="p-1.5 rounded-lg text-c-t3 hover:text-c-red hover:bg-c-red/10 transition-colors cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
          {ranks.length === 0 && <p className="text-center py-10 text-c-t3 text-sm">Нет рангов</p>}
        </div>
      )}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function AdminDonate() {
  const [tab, setTab] = useState<'ranks' | 'features'>('ranks')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Gem className="w-5 h-5 text-c-primary" />
          <h1 className="text-xl font-semibold text-c-text">Донат</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-c-bg2 border border-c-border rounded-xl p-1 w-fit">
        {([['ranks', 'Ранги', Gem], ['features', 'Привилегии', List]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm transition-colors cursor-pointer
              ${tab === key ? 'bg-c-bg1 text-c-text shadow-sm' : 'text-c-t2 hover:text-c-text'}`}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {tab === 'ranks' ? <RanksTab /> : <FeaturesTab />}
    </div>
  )
}
