import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RefreshCcw, ShieldCheck, ShieldX, KeyRound,
  ExternalLink, ChevronDown, ChevronUp, AlertTriangle, Loader2,
  ArrowUpCircle, CheckCircle2, Clock, Terminal, X, WifiOff,
} from 'lucide-react'
import { updatesApi, type UpdatesStatus, type Commit } from '../../services/api'
import toast from 'react-hot-toast'

// ── commit type metadata ──────────────────────────────────────────────────────

const TYPE_META: Record<string, { dot: string; badge: string }> = {
  feat:     { dot: 'bg-emerald-500',  badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
  fix:      { dot: 'bg-red-500',      badge: 'bg-red-500/15 text-red-400 border-red-500/20' },
  hotfix:   { dot: 'bg-orange-500',   badge: 'bg-orange-500/15 text-orange-400 border-orange-500/20' },
  refactor: { dot: 'bg-blue-500',     badge: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
  perf:     { dot: 'bg-purple-500',   badge: 'bg-purple-500/15 text-purple-400 border-purple-500/20' },
  docs:     { dot: 'bg-amber-500',    badge: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
  test:     { dot: 'bg-cyan-500',     badge: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20' },
  style:    { dot: 'bg-pink-500',     badge: 'bg-pink-500/15 text-pink-400 border-pink-500/20' },
  chore:    { dot: 'bg-slate-500',    badge: 'bg-slate-500/15 text-slate-400 border-slate-500/20' },
  ci:       { dot: 'bg-slate-500',    badge: 'bg-slate-500/15 text-slate-400 border-slate-500/20' },
  build:    { dot: 'bg-slate-500',    badge: 'bg-slate-500/15 text-slate-400 border-slate-500/20' },
  revert:   { dot: 'bg-orange-500',   badge: 'bg-orange-500/15 text-orange-400 border-orange-500/20' },
  commit:   { dot: 'bg-slate-600',    badge: 'bg-slate-600/15 text-slate-400 border-slate-600/20' },
}

function typeMeta(type: string) {
  return TYPE_META[type] ?? TYPE_META.commit
}

// ── helpers ───────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(mins / 60)
  const days  = Math.floor(hours / 24)
  if (mins  <  1) return 'только что'
  if (mins  < 60) return `${mins} мин назад`
  if (hours < 24) return `${hours} ч назад`
  if (days  <  7) return `${days} дн назад`
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function cleanMessage(message: string): string {
  return message.replace(/^(feat|fix|hotfix|chore|refactor|docs|test|style|perf|ci|build|revert)(\(.+\))?(!)?: /, '')
}

// ── CommitRow ─────────────────────────────────────────────────────────────────

function CommitRow({ commit, isLast, dim }: { commit: Commit; isLast: boolean; dim?: boolean }) {
  const meta = typeMeta(commit.type)
  return (
    <div className={`flex gap-3 ${dim ? 'opacity-60' : ''}`}>
      <div className="flex flex-col items-center pt-1 shrink-0">
        <div className={`w-2 h-2 rounded-full ${meta.dot} shrink-0`} />
        {!isLast && <div className="w-px bg-c-border flex-1 mt-1.5" />}
      </div>
      <div className="pb-4 flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono font-medium uppercase tracking-wide ${meta.badge}`}>
            {commit.type}
          </span>
          <code className="text-[11px] text-c-t3 font-mono">{commit.shortSha}</code>
          <span className="text-[11px] text-c-t3 ml-auto shrink-0">{relativeTime(commit.date)}</span>
        </div>
        <p className="text-sm text-c-text leading-snug">{cleanMessage(commit.message)}</p>
        <div className="flex items-center gap-1.5 mt-1">
          {commit.authorAvatarUrl && (
            <img src={commit.authorAvatarUrl} alt={commit.author} className="w-3.5 h-3.5 rounded-full" />
          )}
          <span className="text-[11px] text-c-t3">{commit.author}</span>
          {commit.url && (
            <a href={commit.url} target="_blank" rel="noopener noreferrer"
              className="ml-auto text-c-t3 hover:text-c-primary transition-colors">
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

// ── ApplyOverlay ──────────────────────────────────────────────────────────────

type ApplyPhase = 'connecting' | 'running' | 'success' | 'failed' | 'error'

function lineClass(line: string): string {
  const t = line.trimStart()
  if (t.startsWith('✓') || t.startsWith('OK ')) return 'text-emerald-400'
  if (t.startsWith('✗') || t.startsWith('ОШИБКА') || t.startsWith('ERR')) return 'text-red-400'
  if (t.startsWith('!') || t.startsWith('WARN')) return 'text-yellow-400'
  if (t.startsWith('━')) return 'text-slate-400 font-semibold'
  if (t.startsWith('→')) return 'text-sky-400'
  return 'text-slate-300'
}

function ApplyOverlay({ onClose }: { onClose: () => void }) {
  const [phase, setPhase]   = useState<ApplyPhase>('connecting')
  const [lines, setLines]   = useState<string[]>([])
  const [exitCode, setExitCode] = useState<number | null>(null)
  const [errMsg, setErrMsg] = useState('')
  const [countdown, setCountdown] = useState(3)
  const termRef    = useRef<HTMLDivElement>(null)
  const wsRef      = useRef<WebSocket | null>(null)
  const phaseRef   = useRef<ApplyPhase>('connecting')

  const setPhaseSync = (p: ApplyPhase) => { phaseRef.current = p; setPhase(p) }

  const addLine = (line: string) =>
    setLines(prev => prev.length >= 2000 ? [...prev.slice(-1999), line] : [...prev, line])

  // Auto-scroll terminal to bottom on new output
  useEffect(() => {
    const el = termRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines])

  // Countdown + auto-close after success
  useEffect(() => {
    if (phase !== 'success') return
    if (countdown <= 0) { onClose(); return }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, countdown, onClose])

  useEffect(() => {
    let ws: WebSocket | null = null

    ;(async () => {
      try {
        const { token } = await updatesApi.getWsToken()
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
        ws = new WebSocket(`${proto}//${location.host}/updater/ws`)
        wsRef.current = ws

        ws.onopen = () => {
          ws!.send(JSON.stringify({ type: 'start', token }))
          setPhaseSync('running')
        }

        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data as string)
            if (msg.type === 'log') {
              addLine(msg.line as string)
            } else if (msg.type === 'exit') {
              setExitCode(msg.code as number)
              setPhaseSync(msg.code === 0 ? 'success' : 'failed')
            } else if (msg.type === 'error') {
              setErrMsg(msg.message as string)
              setPhaseSync('error')
            }
          } catch { /* ignore bad frames */ }
        }

        ws.onerror = () => {
          setErrMsg('Ошибка WebSocket соединения с агентом обновлений')
          setPhaseSync('error')
        }

        ws.onclose = () => {
          if (phaseRef.current === 'running') {
            setErrMsg('Соединение с агентом прервано')
            setPhaseSync('error')
          }
        }
      } catch {
        setErrMsg('Не удалось получить токен. Убедитесь что craftcms-updater запущен.')
        setPhaseSync('error')
      }
    })()

    return () => { ws?.close() }
  }, [])

  const statusBar = () => {
    if (phase === 'connecting') return (
      <div className="flex items-center gap-2 text-slate-400">
        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
        <span>Подключение к агенту обновлений...</span>
      </div>
    )
    if (phase === 'running') return (
      <div className="flex items-center gap-2 text-sky-400">
        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
        <span>Обновление выполняется...</span>
      </div>
    )
    if (phase === 'success') return (
      <div className="flex items-center gap-2 text-emerald-400">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>Обновление успешно — перезагрузка через {countdown}с</span>
      </div>
    )
    if (phase === 'failed') return (
      <div className="flex items-center gap-2 text-red-400">
        <X className="w-3.5 h-3.5 shrink-0" />
        <span>Обновление завершилось с ошибкой (exit {exitCode})</span>
      </div>
    )
    return (
      <div className="flex items-center gap-2 text-red-400">
        <WifiOff className="w-3.5 h-3.5 shrink-0" />
        <span>{errMsg}</span>
      </div>
    )
  }

  const canClose = phase === 'failed' || phase === 'error'

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-3xl rounded-xl overflow-hidden shadow-2xl border border-slate-700 flex flex-col"
        style={{ maxHeight: '80vh' }}
      >
        {/* Title bar */}
        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-800 border-b border-slate-700 shrink-0">
          <Terminal className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-300 font-medium">Применение обновления</span>
          <div className="ml-auto flex items-center gap-2">
            {canClose && (
              <button onClick={onClose}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer px-2 py-1 rounded hover:bg-slate-700">
                <X className="w-3.5 h-3.5" /> Закрыть
              </button>
            )}
          </div>
        </div>

        {/* Terminal output */}
        <div
          ref={termRef}
          className="flex-1 overflow-y-auto bg-slate-950 px-4 py-3 font-mono text-xs leading-5"
          style={{ minHeight: '300px' }}
        >
          {lines.length === 0 && phase === 'connecting' && (
            <span className="text-slate-600">Ожидание вывода...</span>
          )}
          {lines.map((line, i) => (
            <div key={i} className={`whitespace-pre-wrap break-all ${lineClass(line)}`}>
              {line || ' '}
            </div>
          ))}
        </div>

        {/* Status bar */}
        <div className="px-4 py-2.5 bg-slate-900 border-t border-slate-700 text-xs shrink-0">
          {statusBar()}
        </div>
      </motion.div>
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function AdminUpdates() {
  const [data, setData] = useState<UpdatesStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [tokenInput, setTokenInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [applying, setApplying] = useState(false)
  const [showAllHistory, setShowAllHistory] = useState(false)
  const [historySince, setHistorySince] = useState<string | null>(() =>
    localStorage.getItem('cms_history_since')
  )

  const load = (bust = false) => {
    setLoading(true)
    updatesApi.getStatus(bust)
      .then((d) => {
        setData(d)
        if (d.status === 'unconfigured') setFormOpen(true)
      })
      .catch(() => toast.error('Ошибка загрузки'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleSaveToken = async () => {
    if (!tokenInput.trim()) { toast.error('Введите токен'); return }
    setSaving(true)
    try {
      await updatesApi.updateToken(tokenInput.trim())
      toast.success('Токен обновлён')
      setTokenInput('')
      setFormOpen(false)
      load()
    } catch { toast.error('Ошибка сохранения') }
    finally { setSaving(false) }
  }

  const handleApply = () => setApplying(true)

  const handleHideBefore = () => {
    const now = new Date().toISOString()
    localStorage.setItem('cms_history_since', now)
    setHistorySince(now)
  }

  const handleClearFilter = () => {
    localStorage.removeItem('cms_history_since')
    setHistorySince(null)
  }

  const isActive       = data?.status === 'active'
  const isInactive     = data?.status === 'inactive'
  const isUnconfigured = data?.status === 'unconfigured'

  const allInstalled = data?.installedCommits ?? []
  const filteredInstalled = historySince
    ? allInstalled.filter(c => new Date(c.date) >= new Date(historySince))
    : allInstalled
  const visibleHistory = showAllHistory
    ? filteredInstalled
    : filteredInstalled.slice(0, 5)

  return (
    <>
      {applying && (
        <ApplyOverlay onClose={() => { setApplying(false); window.location.reload() }} />
      )}

      <div className="max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <RefreshCcw className="w-5 h-5 text-c-primary" />
            <h1 className="text-xl font-semibold text-c-text">Обновления</h1>
          </div>
          {!loading && (
            <button onClick={() => load(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-c-t2 hover:text-c-text border border-c-border hover:border-c-border-h rounded-lg transition-colors cursor-pointer">
              <RefreshCcw className="w-3.5 h-3.5" />
              Обновить
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-c-primary animate-spin" />
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

            {/* License status */}
            <div className={`card rounded-xl p-4 border transition-colors ${
              isActive       ? 'border-emerald-500/25 bg-emerald-500/5' :
              isInactive     ? 'border-red-500/25 bg-red-500/5' :
                               'border-amber-500/25 bg-amber-500/5'
            }`}>
              <div className="flex items-center gap-3">
                {isActive       && <ShieldCheck    className="w-5 h-5 text-emerald-400 shrink-0" />}
                {isInactive     && <ShieldX        className="w-5 h-5 text-red-400 shrink-0" />}
                {isUnconfigured && <AlertTriangle  className="w-5 h-5 text-amber-400 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${
                    isActive ? 'text-emerald-400' : isInactive ? 'text-red-400' : 'text-amber-400'
                  }`}>{data?.message}</p>
                  {data?.githubRepo && <p className="text-xs text-c-t3 mt-0.5">{data.githubRepo}</p>}
                </div>
                {data?.currentVersion && (
                  <code className="text-xs font-mono text-c-t3 bg-c-bg3 px-2 py-0.5 rounded shrink-0">
                    {data.currentVersion}
                  </code>
                )}
              </div>
            </div>

            {/* Available update card */}
            {isActive && data?.hasUpdates && (
              <div className="card rounded-xl border border-c-primary/25 bg-c-primary/5 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-c-primary/15">
                  <div className="flex items-center gap-2.5">
                    <ArrowUpCircle className="w-5 h-5 text-c-primary" />
                    <div>
                      <p className="text-sm font-semibold text-c-text">Доступно обновление</p>
                      <p className="text-xs text-c-t3 mt-0.5">
                        {data.pendingCommits.length} {data.pendingCommits.length === 1 ? 'коммит' :
                          data.pendingCommits.length < 5 ? 'коммита' : 'коммитов'} не установлено
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleApply}
                    className="flex items-center gap-1.5 px-4 py-2 bg-c-primary hover:bg-c-primary-h text-white text-sm font-medium rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    <ArrowUpCircle className="w-4 h-4" />
                    Обновить
                  </button>
                </div>
                <div className="px-5 pt-4 pb-2">
                  {data.pendingCommits.map((c, i) => (
                    <CommitRow key={c.sha} commit={c} isLast={i === data.pendingCommits.length - 1} />
                  ))}
                </div>
              </div>
            )}

            {/* Up to date */}
            {isActive && !data?.hasUpdates && data?.installedCommits?.length > 0 && (
              <div className="card rounded-xl p-4 border border-emerald-500/20 bg-emerald-500/5 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-400">Установлена последняя версия</p>
                  <p className="text-xs text-c-t3 mt-0.5">Обновлений нет</p>
                </div>
              </div>
            )}

            {/* Token update form */}
            <div className="card rounded-xl border border-c-border overflow-hidden">
              <button
                onClick={() => setFormOpen(!formOpen)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm text-c-t2 hover:text-c-text hover:bg-white/3 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4" />
                  {data?.tokenSet ? 'Обновить лицензионный токен' : 'Настроить лицензию'}
                </div>
                {formOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <AnimatePresence>
                {formOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-1 space-y-3 border-t border-c-border">
                      <div>
                        <label className="block text-xs text-c-t3 mb-1.5">Лицензионный токен</label>
                        <input
                          type="password"
                          value={tokenInput}
                          onChange={(e) => setTokenInput(e.target.value)}
                          className="input text-sm font-mono"
                          placeholder="ghp_••••••••••••••••••••••••••••••••••••••••"
                          autoComplete="new-password"
                        />
                      </div>
                      <button
                        onClick={handleSaveToken}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-c-primary hover:bg-c-primary-h text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                        {saving ? 'Проверка...' : 'Сохранить и проверить'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Installed history */}
            {isActive && allInstalled.length > 0 && (
              <div className="card rounded-xl p-5">
                <div className="flex items-center gap-2 mb-5">
                  <Clock className="w-4 h-4 text-c-t2" />
                  <h2 className="text-sm font-semibold text-c-text">История установленных версий</h2>
                  <div className="ml-auto flex items-center gap-2">
                    {historySince ? (
                      <>
                        <span className="text-xs text-c-t3">
                          с {new Date(historySince).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <button
                          onClick={handleClearFilter}
                          className="text-xs text-c-t3 hover:text-c-t2 underline transition-colors cursor-pointer"
                        >
                          Показать все
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={handleHideBefore}
                        className="text-xs text-c-t3 hover:text-c-t2 transition-colors cursor-pointer"
                      >
                        Скрыть старые
                      </button>
                    )}
                  </div>
                </div>
                {filteredInstalled.length === 0 ? (
                  <p className="text-xs text-c-t3 text-center py-4">Нет коммитов после выбранной даты</p>
                ) : (
                  <>
                    {visibleHistory.map((c, i) => (
                      <CommitRow key={c.sha} commit={c} isLast={i === visibleHistory.length - 1} dim />
                    ))}
                    {filteredInstalled.length > 5 && (
                      <button
                        onClick={() => setShowAllHistory(!showAllHistory)}
                        className="mt-2 text-xs text-c-t3 hover:text-c-t2 transition-colors cursor-pointer"
                      >
                        {showAllHistory
                          ? 'Свернуть'
                          : `Показать ещё ${filteredInstalled.length - 5}`}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Inactive state */}
            {isInactive && (
              <div className="card rounded-xl p-8 text-center border border-red-500/20">
                <ShieldX className="w-8 h-8 text-red-400/50 mx-auto mb-3" />
                <p className="text-sm text-red-400 font-medium">Лицензия не активна</p>
                <p className="text-xs text-c-t3 mt-1">Обновите токен выше или обратитесь к поставщику</p>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </>
  )
}
