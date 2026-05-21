import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Plug, RefreshCw, Copy, Check, Download, Shield,
  Network, AlertTriangle, CheckCircle, Package, Server as ServerIcon
} from 'lucide-react'
import toast from 'react-hot-toast'
import api, { serversApi } from '../../services/api'
import type { ServerWithStatus } from '../../types'

interface BridgeStatus {
  templateFound: boolean
  templatePath: string
  apiKey: string
  serverId: number | null
  serverName: string | null
  allowedIp: string
  backendUrl: string
  detectedUrl: string
  backendUrlAuto: boolean
}

export default function AdminBridgePlugin() {
  const [status, setStatus] = useState<BridgeStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [servers, setServers] = useState<ServerWithStatus[]>([])
  const [selectedServerId, setSelectedServerId] = useState<number | ''>('')
  const [apiKey, setApiKey] = useState('')
  const [allowedIp, setAllowedIp] = useState('')
  const [backendUrl, setBackendUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [generating, setGenerating] = useState(false)

  const fetchStatus = async (serverId?: number) => {
    try {
      const res = await api.get<BridgeStatus>('/admin/bridge/status', {
        params: serverId ? { serverId } : {},
      })
      setStatus(res.data)
      setApiKey(res.data.apiKey)
      setAllowedIp(res.data.allowedIp)
      setBackendUrl(res.data.backendUrl)
    } catch {
      toast.error('Не удалось загрузить статус Bridge')
    } finally {
      setLoading(false)
    }
  }

  // First load: pull servers and pre-select the first one.
  useEffect(() => {
    serversApi.getAll().then((all) => {
      setServers(all)
      const first = all[0]?.id
      if (first != null) {
        setSelectedServerId(first)
        fetchStatus(first)
      } else {
        // No servers yet — fall back to legacy global mode.
        fetchStatus()
      }
    }).catch(() => {
      fetchStatus()
    })
  }, [])

  // Switching server → reload that server's key.
  const handleServerChange = (id: number | '') => {
    setSelectedServerId(id)
    setLoading(true)
    fetchStatus(typeof id === 'number' ? id : undefined)
  }

  const handleGenerateKey = async () => {
    setGenerating(true)
    try {
      const res = await api.post<{ key: string }>('/admin/bridge/generate-key')
      setApiKey(res.data.key)
      toast.success('Новый ключ сгенерирован — не забудьте сохранить')
    } catch {
      toast.error('Ошибка генерации ключа')
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = async () => {
    if (!apiKey) return
    await navigator.clipboard.writeText(apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSave = async () => {
    if (!apiKey.trim()) {
      toast.error('API ключ не может быть пустым')
      return
    }
    setSaving(true)
    try {
      await api.put('/admin/bridge/settings', {
        serverId: typeof selectedServerId === 'number' ? selectedServerId : null,
        apiKey, allowedIp, backendUrl,
      })
      toast.success('Настройки сохранены')
      await fetchStatus(typeof selectedServerId === 'number' ? selectedServerId : undefined)
    } catch {
      toast.error('Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const handleDownload = async () => {
    if (!status?.templateFound) {
      toast.error('Шаблон плагина не найден. Выполните mvn package в папке BridgePlugin/')
      return
    }
    setDownloading(true)
    try {
      const params = typeof selectedServerId === 'number' ? { serverId: selectedServerId } : {}
      const res = await api.get('/admin/bridge/download', { responseType: 'blob', params })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      const filename = typeof selectedServerId === 'number'
        ? `BridgePlugin-server${selectedServerId}.jar`
        : 'BridgePlugin.jar'
      a.download = filename
      a.click()
      window.URL.revokeObjectURL(url)
      toast.success(`${filename} скачан`)
    } catch {
      toast.error('Ошибка скачивания плагина')
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-c-t3 animate-spin" />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="max-w-2xl space-y-5"
    >
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-c-text flex items-center gap-2">
          <Plug className="w-5 h-5 text-c-primary" />
          Серверный Плагин
        </h1>
        <p className="text-sm text-c-t3 mt-1">
          Каждому серверу — свой JAR с уникальным ключом. Выберите сервер ниже и скачайте его плагин.
        </p>
      </div>

      {/* Server selector */}
      <div className="bg-c-bg1 border border-c-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <ServerIcon className="w-4 h-4 text-c-primary" />
          <h2 className="text-sm font-semibold text-c-text">Для какого сервера</h2>
        </div>
        {servers.length === 0 ? (
          <p className="text-sm text-c-t3">
            Сначала добавьте сервер в вкладке «Серверы». Без сервера плагин выдаётся в legacy-режиме (общий ключ).
          </p>
        ) : (
          <>
            <select
              value={selectedServerId}
              onChange={(e) => handleServerChange(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
              className="w-full bg-c-bg2 border border-c-border rounded-lg px-3 py-2 text-sm text-c-text cursor-pointer focus:outline-none focus:border-c-primary/50"
            >
              {servers.map((s) => (
                <option key={s.id} value={s.id} className="bg-c-bg2">{s.name}</option>
              ))}
            </select>
            <p className="text-xs text-c-t3 mt-2">
              Каждый сервер имеет свой ключ. При покупке товара бэкенд направит команду
              именно тому серверу, который указан у этого товара/ранга.
            </p>
          </>
        )}
      </div>

      {/* Template status card */}
      <div className={`rounded-xl border p-4 flex items-start gap-3 ${
        status?.templateFound
          ? 'border-green-500/20 bg-green-500/5'
          : 'border-yellow-500/20 bg-yellow-500/5'
      }`}>
        {status?.templateFound
          ? <CheckCircle className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
          : <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
        }
        <div className="min-w-0">
          <p className={`text-sm font-medium ${status?.templateFound ? 'text-green-400' : 'text-yellow-400'}`}>
            {status?.templateFound ? 'Шаблон плагина найден' : 'Шаблон плагина не найден'}
          </p>
          <p className="text-xs text-c-t3 mt-0.5 break-all">{status?.templatePath}</p>
          {!status?.templateFound && (
            <p className="text-xs text-yellow-300/70 mt-1.5 font-mono bg-black/30 rounded px-2 py-1">
              cd BridgePlugin && mvn package
            </p>
          )}
        </div>
      </div>

      {/* API Key section */}
      <div className="bg-c-bg1 border border-c-border rounded-xl p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-c-primary" />
          <h2 className="text-sm font-semibold text-c-text">API ключ (256-bit)</h2>
        </div>

        <div>
          <label className="block text-xs text-c-t3 mb-1.5">Ключ аутентификации</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Нажмите «Сгенерировать» для создания ключа"
                className="w-full bg-c-bg2 border border-c-border rounded-lg px-3 py-2 text-sm text-c-text font-mono placeholder:text-c-t3 focus:outline-none focus:border-c-primary/50 pr-10"
              />
            </div>
            <button
              onClick={handleCopy}
              disabled={!apiKey}
              className="px-3 py-2 rounded-lg border border-c-border bg-c-bg2 hover:bg-white/5 text-c-t2 hover:text-c-text transition-colors duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Копировать"
            >
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={handleGenerateKey}
              disabled={generating}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-c-border bg-c-bg2 hover:bg-white/5 text-c-t2 hover:text-c-text transition-colors duration-150 cursor-pointer disabled:opacity-40 text-sm whitespace-nowrap"
            >
              <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
              Сгенерировать
            </button>
          </div>
          <p className="text-xs text-c-t3 mt-1.5">
            Генерируется на сервере через CSPRNG — 32 байта = 64 символа hex
          </p>
        </div>

        {/* Backend URL */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Network className="w-3.5 h-3.5 text-c-t3" />
            <label className="text-xs text-c-t3">URL бэкенда</label>
          </div>
          <input
            type="text"
            value={backendUrl}
            onChange={(e) => setBackendUrl(e.target.value)}
            placeholder="Оставьте пустым — определяется автоматически"
            className="w-full bg-c-bg2 border border-c-border rounded-lg px-3 py-2 text-sm text-c-text placeholder:text-c-t3 focus:outline-none focus:border-c-primary/50"
          />
          {status?.backendUrlAuto && status.detectedUrl && (
            <p className="text-xs text-c-t3 mt-1.5">
              Будет запатчен автоматически:{' '}
              <span className="font-mono text-c-t2">{status.detectedUrl}</span>
            </p>
          )}
          {!status?.backendUrlAuto && (
            <p className="text-xs text-c-t3 mt-1.5">
              Патчится в JAR как <span className="font-mono">base-url</span>.
            </p>
          )}
        </div>

        {/* Allowed IP */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Network className="w-3.5 h-3.5 text-c-t3" />
            <label className="text-xs text-c-t3">Разрешённый IP Minecraft-сервера (опционально)</label>
          </div>
          <input
            type="text"
            value={allowedIp}
            onChange={(e) => setAllowedIp(e.target.value)}
            placeholder="192.168.1.100 (оставьте пустым для отключения)"
            className="w-full bg-c-bg2 border border-c-border rounded-lg px-3 py-2 text-sm text-c-text placeholder:text-c-t3 focus:outline-none focus:border-c-primary/50"
          />
          <p className="text-xs text-c-t3 mt-1.5">
            Если указан — Bridge-запросы принимаются только с этого IP. Будет захардкожен в JAR.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-c-primary hover:bg-c-primary/80 text-white rounded-lg text-sm font-medium transition-colors duration-150 cursor-pointer disabled:opacity-50"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {saving ? 'Сохранение...' : 'Сохранить настройки'}
        </button>
      </div>

      {/* Download section */}
      <div className="bg-c-bg1 border border-c-border rounded-xl p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-c-primary" />
          <h2 className="text-sm font-semibold text-c-text">Выпуск плагина</h2>
        </div>

        <div className="text-sm text-c-t2 space-y-1.5">
          <p>При нажатии «Скачать» произойдёт следующее:</p>
          <ul className="list-disc list-inside text-c-t3 space-y-1 ml-1">
            <li>Из шаблона создаётся копия JAR</li>
            <li>В неё патчится текущий API ключ и IP</li>
            <li>Готовый <span className="font-mono text-c-text">BridgePlugin.jar</span> скачивается</li>
          </ul>
          <p className="text-c-t3 text-xs mt-2">
            Скачанный JAR не требует настройки config.yml — ключ уже захардкожен внутри.
          </p>
        </div>

        <button
          onClick={handleDownload}
          disabled={downloading || !status?.templateFound}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed
            ${status?.templateFound
              ? 'bg-c-primary hover:bg-c-primary/80 text-white'
              : 'bg-c-bg2 border border-c-border text-c-t3 cursor-not-allowed'
            }`}
        >
          {downloading
            ? <RefreshCw className="w-4 h-4 animate-spin" />
            : <Download className="w-4 h-4" />
          }
          {downloading ? 'Генерация...' : 'Скачать BridgePlugin.jar'}
        </button>

        {!status?.templateFound && (
          <p className="text-xs text-yellow-400/70">
            Сначала соберите шаблон: <span className="font-mono">cd BridgePlugin && mvn package</span>
          </p>
        )}
      </div>

      {/* Install instructions */}
      <div className="bg-c-bg1 border border-c-border rounded-xl p-4 space-y-2">
        <h2 className="text-sm font-semibold text-c-text">Установка</h2>
        <ol className="text-sm text-c-t3 space-y-1.5 list-decimal list-inside">
          <li>Заполните URL бэкенда, сгенерируйте ключ и сохраните</li>
          <li>Нажмите «Скачать BridgePlugin.jar»</li>
          <li>Скопируйте JAR в папку <span className="font-mono text-c-text">plugins/</span> вашего Minecraft-сервера</li>
          <li>Перезапустите сервер — настройка config.yml не нужна</li>
          <li>Проверьте консоль — должно появиться <span className="font-mono text-green-400">BridgePlugin enabled</span></li>
        </ol>
      </div>
    </motion.div>
  )
}
