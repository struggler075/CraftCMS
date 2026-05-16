import { useEffect, useRef, useState } from 'react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Pencil, Trash2, Server, X, Check, Upload, ImageIcon, Package } from 'lucide-react'
import { serversApi, adminApi } from '../../services/api'
import type { PingMethod } from '../../types'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'

interface ModInput {
  name: string
  description: string
}

interface ServerData {
  id: number; name: string; address: string; description: string;
  imageUrl: string; featured: boolean; active: boolean; pingMethod: PingMethod; sortOrder: number;
  mods: ModInput[]
}

type FormState = Omit<ServerData, 'id' | 'sortOrder'> & { sortOrder: string }

const PING_LABELS: Record<PingMethod, string> = {
  MCSRVSTAT: 'mcsrvstat.us',
  MCSTATUS: 'mcstatus.io',
  DIRECT: 'Прямой пинг',
}
const PING_METHODS: PingMethod[] = ['MCSRVSTAT', 'MCSTATUS', 'DIRECT']
const EMPTY: FormState = { name: '', address: '', description: '', imageUrl: '', featured: false, active: true, pingMethod: 'MCSRVSTAT', sortOrder: '0', mods: [] }

function ImageDropzone({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Только изображения'); return }
    setUploading(true)
    try {
      const { url } = await adminApi.uploadServerImage(file)
      onChange(url)
    } catch { toast.error('Ошибка загрузки') } finally { setUploading(false) }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]; if (file) handleFile(file)
  }

  return (
    <div>
      <label className="block text-sm text-c-t2 mb-1">Изображение сервера</label>
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
            <img src={value} alt="" className="w-14 h-14 object-cover rounded-lg bg-c-bg3 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-c-t2 truncate">{value}</p>
              <p className="text-xs text-c-t3 mt-0.5">Кликните для замены</p>
            </div>
            {uploading && <div className="w-4 h-4 border-2 border-c-primary border-t-transparent rounded-full animate-spin shrink-0" />}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-5 gap-2">
            {uploading
              ? <div className="w-5 h-5 border-2 border-c-primary border-t-transparent rounded-full animate-spin" />
              : <>
                  <div className="w-9 h-9 rounded-lg bg-c-bg3 flex items-center justify-center">
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

export default function AdminServers() {
  const [servers, setServers] = useState<ServerData[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)

  const load = () => serversApi.getAllAdmin().then((d) => setServers(d as ServerData[])).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const openCreate = () => { setEditId(null); setForm(EMPTY); setShowForm(true) }
  const openEdit = (s: ServerData) => {
    setEditId(s.id)
    setForm({
      name: s.name, address: s.address, description: s.description ?? '', imageUrl: s.imageUrl ?? '',
      featured: s.featured, active: s.active, pingMethod: s.pingMethod ?? 'MCSRVSTAT',
      sortOrder: s.sortOrder.toString(),
      mods: (s.mods ?? []).map((m) => ({ name: m.name, description: m.description ?? '' })),
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        ...form,
        sortOrder: parseInt(form.sortOrder),
        mods: form.mods.filter((m) => m.name.trim()).map((m, i) => ({ name: m.name.trim(), description: m.description.trim() || null, sortOrder: i })),
      }
      if (editId) { await serversApi.update(editId, payload); toast.success('Сервер обновлён') }
      else { await serversApi.create(payload); toast.success('Сервер добавлен') }
      setShowForm(false); load()
    } catch { toast.error('Ошибка') } finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить сервер?')) return
    await serversApi.delete(id); toast.success('Удалено'); load()
  }

  const addMod = () => setForm((f) => ({ ...f, mods: [...f.mods, { name: '', description: '' }] }))
  const removeMod = (i: number) => setForm((f) => ({ ...f, mods: f.mods.filter((_, idx) => idx !== i) }))
  const updateMod = (i: number, key: keyof ModInput, val: string) =>
    setForm((f) => ({ ...f, mods: f.mods.map((m, idx) => idx === i ? { ...m, [key]: val } : m) }))

  useEscapeKey(() => setShowForm(false), showForm)

  const F = form as Record<string, unknown>
  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Server className="w-5 h-5 text-c-gold" />
          <h1 className="text-xl font-semibold text-c-text">Серверы</h1>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 bg-c-primary hover:bg-c-primary-h text-white text-sm rounded-lg transition-colors cursor-pointer">
          <Plus className="w-4 h-4" /> Добавить
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowForm(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-c-bg1 border border-c-border rounded-2xl p-6"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold text-c-text">{editId ? 'Редактировать' : 'Новый'} сервер</h2>
                <button onClick={() => setShowForm(false)} className="text-c-t3 hover:text-c-t2 cursor-pointer"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-3 max-h-[68vh] overflow-y-auto pr-1">
                {[
                  { label: 'Название', key: 'name', placeholder: 'My Server' },
                  { label: 'Адрес (host:port)', key: 'address', placeholder: 'play.server.ru:25565' },
                  { label: 'Описание', key: 'description', placeholder: 'Лучший сервер...' },
                  { label: 'Порядок отображения', key: 'sortOrder', placeholder: '0' },
                ].map(({ label, key, placeholder }) => (
                  <div key={key}>
                    <label className="block text-sm text-c-t2 mb-1">{label}</label>
                    <input type="text" value={F[key] as string} onChange={(e) => set(key, e.target.value)} className="input" placeholder={placeholder} />
                  </div>
                ))}

                <ImageDropzone value={form.imageUrl} onChange={(url) => set('imageUrl', url)} />

                <div>
                  <label className="block text-sm text-c-t2 mb-1">Метод пинга</label>
                  <div className="grid grid-cols-3 gap-2">
                    {PING_METHODS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => set('pingMethod', m)}
                        className={`py-2 px-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer text-center
                          ${form.pingMethod === m
                            ? 'border-c-primary bg-c-primary/15 text-c-primary'
                            : 'border-c-border bg-c-bg2 text-c-t2 hover:border-c-border-h hover:text-c-text'}`}
                      >
                        {PING_LABELS[m]}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-c-t3 mt-1.5">
                    {form.pingMethod === 'DIRECT' && 'Прямое TCP подключение к серверу (MC протокол)'}
                    {form.pingMethod === 'MCSRVSTAT' && 'Через API mcsrvstat.us — работает с большинством серверов'}
                    {form.pingMethod === 'MCSTATUS' && 'Через API mcstatus.io — альтернатива mcsrvstat'}
                  </p>
                </div>

                {/* Mods */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-c-t2 flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5" /> Моды ({form.mods.length})
                    </label>
                    <button type="button" onClick={addMod}
                      className="flex items-center gap-1 px-2 py-1 rounded-md bg-c-bg3 border border-c-border hover:border-c-border-h text-c-t2 hover:text-c-text text-xs transition-colors cursor-pointer">
                      <Plus className="w-3 h-3" /> Добавить мод
                    </button>
                  </div>
                  <div className="space-y-2">
                    {form.mods.length === 0 && (
                      <p className="text-xs text-c-t3 text-center py-3 border border-dashed border-c-border rounded-lg">Нет модов — нажмите «Добавить мод»</p>
                    )}
                    {form.mods.map((mod, i) => (
                      <div key={i} className="flex gap-2 items-start bg-c-bg2 border border-c-border rounded-lg p-2.5">
                        <div className="flex-1 space-y-1.5">
                          <input
                            type="text"
                            placeholder="Название мода *"
                            value={mod.name}
                            onChange={(e) => updateMod(i, 'name', e.target.value)}
                            className="input text-xs py-1.5"
                          />
                          <input
                            type="text"
                            placeholder="Описание мода (опционально)"
                            value={mod.description}
                            onChange={(e) => updateMod(i, 'description', e.target.value)}
                            className="input text-xs py-1.5"
                          />
                        </div>
                        <button onClick={() => removeMod(i)}
                          className="p-1 mt-1 rounded-md text-c-t3 hover:text-c-red hover:bg-c-red/10 transition-colors cursor-pointer shrink-0">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4">
                  {[['featured', 'Топ'], ['active', 'Активен']].map(([k, l]) => (
                    <label key={k} className="flex items-center gap-2 cursor-pointer text-sm text-c-t2">
                      <input type="checkbox" checked={F[k] as boolean} onChange={(e) => set(k, e.target.checked)} className="accent-c-primary" />{l}
                    </label>
                  ))}
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
        <div className="flex flex-col gap-3">
          {servers.map((s, i) => (
            <motion.div key={s.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="card rounded-xl p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  {s.imageUrl ? (
                    <img src={s.imageUrl} alt={s.name} className="w-9 h-9 rounded-lg object-cover bg-c-bg3 shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-c-gold/10 flex items-center justify-center shrink-0">
                      <Server className="w-4 h-4 text-c-gold" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-c-text">{s.name}</span>
                      <span className="badge bg-c-bg3 text-c-t3 border border-c-border">{PING_LABELS[s.pingMethod] ?? s.pingMethod}</span>
                      {s.featured && <span className="badge bg-c-gold/10 text-c-gold border border-c-gold/20">Топ</span>}
                      {!s.active && <span className="badge bg-c-bg3 text-c-t3 border border-c-border">Скрыт</span>}
                      {s.mods?.length > 0 && (
                        <span className="badge bg-c-primary/10 text-c-primary border border-c-primary/20">
                          {s.mods.length} мод{s.mods.length === 1 ? '' : s.mods.length < 5 ? 'а' : 'ов'}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-c-t3 mt-0.5">{s.address}</div>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-c-t3 hover:text-c-primary hover:bg-c-primary/10 transition-colors cursor-pointer"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded-lg text-c-t3 hover:text-c-red hover:bg-c-red/10 transition-colors cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </motion.div>
          ))}
          {servers.length === 0 && <div className="text-center py-12 text-c-t3 text-sm">Серверов нет</div>}
        </div>
      )}
    </div>
  )
}
