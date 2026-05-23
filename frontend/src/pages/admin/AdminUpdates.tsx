import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RefreshCcw, ShieldCheck, ShieldX, KeyRound, GitCommit,
  ExternalLink, ChevronDown, ChevronUp, AlertTriangle, Loader2,
} from 'lucide-react'
import { updatesApi, type UpdatesStatus, type Commit } from '../../services/api'
import toast from 'react-hot-toast'

// ── commit type metadata ────────────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; dot: string; badge: string }> = {
  feat:     { label: 'feat',     dot: 'bg-emerald-500',  badge: 'bg-emerald-500/15 text-emerald-400' },
  fix:      { label: 'fix',      dot: 'bg-red-500',      badge: 'bg-red-500/15 text-red-400' },
  hotfix:   { label: 'hotfix',   dot: 'bg-orange-500',   badge: 'bg-orange-500/15 text-orange-400' },
  refactor: { label: 'refactor', dot: 'bg-blue-500',     badge: 'bg-blue-500/15 text-blue-400' },
  perf:     { label: 'perf',     dot: 'bg-purple-500',   badge: 'bg-purple-500/15 text-purple-400' },
  docs:     { label: 'docs',     dot: 'bg-amber-500',    badge: 'bg-amber-500/15 text-amber-400' },
  test:     { label: 'test',     dot: 'bg-cyan-500',     badge: 'bg-cyan-500/15 text-cyan-400' },
  style:    { label: 'style',    dot: 'bg-pink-500',     badge: 'bg-pink-500/15 text-pink-400' },
  chore:    { label: 'chore',    dot: 'bg-slate-500',    badge: 'bg-slate-500/15 text-slate-400' },
  ci:       { label: 'ci',       dot: 'bg-slate-500',    badge: 'bg-slate-500/15 text-slate-400' },
  build:    { label: 'build',    dot: 'bg-slate-500',    badge: 'bg-slate-500/15 text-slate-400' },
  revert:   { label: 'revert',   dot: 'bg-orange-500',   badge: 'bg-orange-500/15 text-orange-400' },
  commit:   { label: 'commit',   dot: 'bg-slate-600',    badge: 'bg-slate-600/15 text-slate-400' },
}

function typeMeta(type: string) {
  return TYPE_META[type] ?? TYPE_META.commit
}

// ── relative time ────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(mins / 60)
  const days  = Math.floor(hours / 24)
  if (mins  <  1) return 'только что'
  if (mins  < 60) return `${mins} мин назад`
  if (hours < 24) return `${hours} ч назад`
  if (days  <  7) return `${days} дн назад`
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── strip type prefix from message for cleaner display ───────────────────────

function cleanMessage(message: string): string {
  return message.replace(/^(feat|fix|hotfix|chore|refactor|docs|test|style|perf|ci|build|revert)(\(.+\))?(!)?: /, '')
}

// ── CommitRow ────────────────────────────────────────────────────────────────

function CommitRow({ commit, isLast }: { commit: Commit; isLast: boolean }) {
  const meta = typeMeta(commit.type)
  return (
    <div className="flex gap-3">
      {/* Timeline spine */}
      <div className="flex flex-col items-center pt-1 shrink-0">
        <div className={`w-2.5 h-2.5 rounded-full ${meta.dot} ring-2 ring-c-bg1 shrink-0`} />
        {!isLast && <div className="w-px bg-c-border flex-1 mt-1.5" />}
      </div>

      {/* Content */}
      <div className={`pb-5 flex-1 min-w-0 ${isLast ? '' : ''}`}>
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium uppercase tracking-wide ${meta.badge}`}>
            {meta.label}
          </span>
          <code className="text-[11px] text-c-t3 font-mono bg-c-bg3 px-1.5 py-0.5 rounded">
            {commit.shortSha}
          </code>
          <span className="text-[11px] text-c-t3 ml-auto shrink-0">{relativeTime(commit.date)}</span>
        </div>

        <p className="text-sm text-c-text leading-snug break-words">{cleanMessage(commit.message)}</p>

        <div className="flex items-center gap-2 mt-1.5">
          {commit.authorAvatarUrl && (
            <img src={commit.authorAvatarUrl} alt={commit.author} className="w-4 h-4 rounded-full" />
          )}
          <span className="text-[11px] text-c-t3">{commit.author}</span>
          {commit.url && (
            <a
              href={commit.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-c-t3 hover:text-c-primary transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

// ── main page ────────────────────────────────────────────────────────────────

export default function AdminUpdates() {
  const [data, setData] = useState<UpdatesStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [tokenInput, setTokenInput] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    updatesApi.getStatus()
      .then((d) => {
        setData(d)
        if (d.status === 'unconfigured') setFormOpen(true)
      })
      .catch(() => toast.error('Ошибка загрузки статуса'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleSave = async () => {
    if (!tokenInput.trim()) {
      toast.error('Введите токен')
      return
    }
    setSaving(true)
    try {
      await updatesApi.updateToken(tokenInput.trim())
      toast.success('Лицензия обновлена')
      setTokenInput('')
      setFormOpen(false)
      load()
    } catch {
      toast.error('Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const isActive       = data?.status === 'active'
  const isInactive     = data?.status === 'inactive'
  const isUnconfigured = data?.status === 'unconfigured'

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <RefreshCcw className="w-5 h-5 text-c-primary" />
          <h1 className="text-xl font-semibold text-c-text">Обновления</h1>
        </div>
        {!loading && (
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-c-t2 hover:text-c-text border border-c-border hover:border-c-border-h rounded-lg transition-colors cursor-pointer"
          >
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

          {/* License status card */}
          <div className={`card rounded-xl p-4 border transition-colors ${
            isActive       ? 'border-emerald-500/25 bg-emerald-500/5' :
            isInactive     ? 'border-red-500/25 bg-red-500/5' :
                             'border-c-border bg-c-bg2'
          }`}>
            <div className="flex items-center gap-3">
              {isActive   && <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />}
              {isInactive && <ShieldX     className="w-5 h-5 text-red-400 shrink-0" />}
              {isUnconfigured && <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />}

              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${
                  isActive ? 'text-emerald-400' : isInactive ? 'text-red-400' : 'text-amber-400'
                }`}>
                  {data?.message}
                </p>
                {data?.githubRepo && (
                  <p className="text-xs text-c-t3 mt-0.5 truncate">{data.githubRepo}</p>
                )}
              </div>

              {isActive && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs text-emerald-400">Активна</span>
                </div>
              )}
            </div>
          </div>

          {/* Token / repo update form */}
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
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 pt-1 space-y-3 border-t border-c-border">
                    <div>
                      <label className="block text-xs text-c-t3 mb-1.5">
                        Лицензионный токен
                      </label>
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
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 bg-c-primary hover:bg-c-primary-h text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                      {saving ? 'Сохранение...' : 'Сохранить и проверить'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Commits timeline */}
          {isActive && data?.commits && data.commits.length > 0 && (
            <div className="card rounded-xl p-5">
              <div className="flex items-center gap-2 mb-5">
                <GitCommit className="w-4 h-4 text-c-t2" />
                <h2 className="text-sm font-semibold text-c-text">История обновлений</h2>
                <span className="ml-auto text-xs text-c-t3">{data.commits.length} коммитов</span>
              </div>

              <div>
                {data.commits.map((commit, i) => (
                  <CommitRow
                    key={commit.sha}
                    commit={commit}
                    isLast={i === data.commits.length - 1}
                  />
                ))}
              </div>
            </div>
          )}

          {isActive && (!data?.commits || data.commits.length === 0) && (
            <div className="card rounded-xl p-8 text-center border border-c-border">
              <GitCommit className="w-8 h-8 text-c-t3 mx-auto mb-2" />
              <p className="text-sm text-c-t3">Репозиторий не настроен или коммиты не найдены</p>
              <p className="text-xs text-c-t3 mt-1">Укажите репозиторий в форме выше</p>
            </div>
          )}

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
  )
}
