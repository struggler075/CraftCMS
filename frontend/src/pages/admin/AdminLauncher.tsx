import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Package, Save } from 'lucide-react'
import { launcherApi, type LauncherConfig } from '../../services/api'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'

const EMPTY: Partial<LauncherConfig> = {
  version: '', description: '', windowsUrl: '', linuxUrl: '', macUrl: '',
}

export default function AdminLauncher() {
  const [form, setForm] = useState<Partial<LauncherConfig>>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    launcherApi.get()
      .then((c) => setForm(c))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await launcherApi.update(form)
      toast.success('Настройки лаунчера сохранены')
    } catch {
      toast.error('Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const set = (k: keyof LauncherConfig, v: string) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Package className="w-5 h-5 text-c-primary" />
        <h1 className="text-xl font-semibold text-c-text">Лаунчер</h1>
      </div>

      {loading ? <LoadingSpinner /> : (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl space-y-4">
          <div className="card rounded-xl p-5 space-y-4">
            <div>
              <label className="block text-sm text-c-t2 mb-1.5">Версия</label>
              <input
                type="text"
                value={form.version ?? ''}
                onChange={(e) => set('version', e.target.value)}
                className="input"
                placeholder="1.0.0"
              />
            </div>
            <div>
              <label className="block text-sm text-c-t2 mb-1.5">Описание</label>
              <textarea
                value={form.description ?? ''}
                onChange={(e) => set('description', e.target.value)}
                className="input resize-none h-20"
                placeholder="Краткое описание лаунчера..."
              />
            </div>
          </div>

          <div className="card rounded-xl p-5 space-y-4">
            <p className="text-sm font-medium text-c-text">Ссылки на скачивание</p>
            {[
              { key: 'windowsUrl' as const, label: 'Windows (.exe)', placeholder: 'https://example.com/launcher-win.exe' },
              { key: 'linuxUrl' as const, label: 'Linux (.tar.gz)', placeholder: 'https://example.com/launcher-linux.tar.gz' },
              { key: 'macUrl' as const, label: 'macOS (.dmg)', placeholder: 'https://example.com/launcher-mac.dmg' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-sm text-c-t2 mb-1.5">{label}</label>
                <input
                  type="url"
                  value={(form[key] as string) ?? ''}
                  onChange={(e) => set(key, e.target.value)}
                  className="input"
                  placeholder={placeholder}
                />
              </div>
            ))}
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-c-primary hover:bg-c-primary-h text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Сохранение...' : 'Сохранить настройки'}
          </button>
        </motion.div>
      )}
    </div>
  )
}
