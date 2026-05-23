import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RefreshCcw, ShieldCheck, ShieldX, KeyRound, GitCommit,
  ExternalLink, ChevronDown, ChevronUp, AlertTriangle, Loader2,
  ArrowUpCircle, CheckCircle2, Clock,
} from 'lucide-react'
import axios from 'axios'
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

function ApplyOverlay({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<'running' | 'down' | 'waiting'>('running')
  const wasDown = useRef(false)

  useEffect(() => {
    const iv = setInterval(async () => {
      try {
        await axios.get('/api/health', { timeout: 2000 })
        if (wasDown.current) {
          clearInterval(iv)
          onDone()
        }
      } catch {
        if (!wasDown.current) {
          wasDown.current = true
          setPhase('down')
        } else {
          setPhase('waiting')
        }
      }
    }, 2500)
    return () => clearInterval(iv)
  }, [onDone])

  const lines: Record<typeof phase, string> = {
    running: 'Обновление запущено, ожидаем остановки сервиса...',
    down:    'Сервис перезапускается...',
    waiting: 'Ждём запуска нового сервиса...',
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="card rounded-2xl p-8 max-w-sm w-full mx-4 text-center border border-c-border"
      >
        <div className="w-12 h-12 rounded-full bg-c-primary/10 border border-c-primary/20 flex items-center justify-center mx-auto mb-4">
          <Loader2 className="w-6 h-6 text-c-primary animate-spin" />
        </div>
        <p className="text-sm font-medium text-c-text mb-1">Применение обновления</p>
        <p className="text-xs text-c-t3">{lines[phase]}</p>
        <div className="flex justify-center gap-1.5 mt-4">
          {(['running', 'down', 'waiting'] as const).map((p) => (
            <div key={p} className={`w-1.5 h-1.5 rounded-full transition-colors ${phase === p ? 'bg-c-primary' : 'bg-c-border'}`} />
          ))}
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

  const handleApply = async () => {
    try {
      await updatesApi.apply()
      setApplying(true)
    } catch { toast.error('Не удалось запустить обновление') }
  }

  const isActive       = data?.status === 'active'
  const isInactive     = data?.status === 'inactive'
  const isUnconfigured = data?.status === 'unconfigured'

  const visibleHistory = showAllHistory
    ? (data?.installedCommits ?? [])
    : (data?.installedCommits ?? []).slice(0, 5)

  return (
    <>
      {applying && <ApplyOverlay onDone={() => window.location.reload()} />}

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
            {isActive && data?.installedCommits && data.installedCommits.length > 0 && (
              <div className="card rounded-xl p-5">
                <div className="flex items-center gap-2 mb-5">
                  <Clock className="w-4 h-4 text-c-t2" />
                  <h2 className="text-sm font-semibold text-c-text">История установленных версий</h2>
                </div>
                {visibleHistory.map((c, i) => (
                  <CommitRow key={c.sha} commit={c} isLast={i === visibleHistory.length - 1} dim />
                ))}
                {data.installedCommits.length > 5 && (
                  <button
                    onClick={() => setShowAllHistory(!showAllHistory)}
                    className="mt-2 text-xs text-c-t3 hover:text-c-t2 transition-colors cursor-pointer"
                  >
                    {showAllHistory
                      ? 'Свернуть'
                      : `Показать ещё ${data.installedCommits.length - 5}`}
                  </button>
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
