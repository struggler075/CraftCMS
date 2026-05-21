import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Activity, Search, X, ChevronLeft, ChevronRight, Filter, Wallet, KeyRound,
  ShieldCheck, Lock, Unlock, Trash2, LogOut, User as UserIcon,
} from 'lucide-react'
import { adminAuditApi, type AuditAction, type AuditLogEntry } from '../../services/api'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

// ── Action metadata ───────────────────────────────────────────────────────────

const ACTION_META: Record<AuditAction, { label: string; icon: typeof Activity; color: string; bg: string }> = {
  USER_BALANCE_CHANGE: { label: 'Баланс',      icon: Wallet,      color: 'text-c-green',  bg: 'bg-c-green/15' },
  USER_PASSWORD_RESET: { label: 'Пароль',      icon: KeyRound,    color: 'text-c-gold',   bg: 'bg-c-gold/15' },
  USER_ROLE_CHANGE:    { label: 'Роль',        icon: ShieldCheck, color: 'text-c-primary',bg: 'bg-c-primary/15' },
  USER_BLOCK:          { label: 'Блокировка',  icon: Lock,        color: 'text-c-red',    bg: 'bg-c-red/15' },
  USER_UNBLOCK:        { label: 'Разблок',     icon: Unlock,      color: 'text-c-green',  bg: 'bg-c-green/15' },
  USER_DELETE:         { label: 'Удаление',    icon: Trash2,      color: 'text-c-red',    bg: 'bg-c-red/15' },
  USER_FORCE_LOGOUT:   { label: 'Logout-all',  icon: LogOut,      color: 'text-c-t2',     bg: 'bg-white/5' },
}

function ActionBadge({ action }: { action: AuditAction }) {
  const meta = ACTION_META[action] ?? { label: action, icon: Activity, color: 'text-c-t2', bg: 'bg-white/5' }
  const Icon = meta.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${meta.color} ${meta.bg}`}>
      <Icon className="w-3.5 h-3.5" />
      {meta.label}
    </span>
  )
}

// ── Pagination ────────────────────────────────────────────────────────────────

function Pagination({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  if (total <= 1) return null
  const pages: (number | '…')[] = []
  if (total <= 7) {
    for (let i = 0; i < total; i++) pages.push(i)
  } else {
    pages.push(0)
    if (page > 2) pages.push('…')
    for (let i = Math.max(1, page - 1); i <= Math.min(total - 2, page + 1); i++) pages.push(i)
    if (page < total - 3) pages.push('…')
    pages.push(total - 1)
  }
  const btn = 'w-8 h-8 rounded-lg text-sm flex items-center justify-center transition-colors cursor-pointer'
  return (
    <div className="flex items-center justify-center gap-1 mt-6">
      <button onClick={() => onChange(page - 1)} disabled={page === 0}
        className={`${btn} text-c-t2 hover:text-c-text hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed`}>
        <ChevronLeft className="w-4 h-4" />
      </button>
      {pages.map((p, i) => p === '…' ? (
        <span key={`e${i}`} className="w-8 h-8 flex items-center justify-center text-c-t3 text-sm">…</span>
      ) : (
        <button key={p} onClick={() => onChange(p as number)}
          className={`${btn} ${p === page ? 'bg-c-primary text-white font-medium' : 'text-c-t2 hover:text-c-text hover:bg-white/5'}`}>
          {(p as number) + 1}
        </button>
      ))}
      <button onClick={() => onChange(page + 1)} disabled={page === total - 1}
        className={`${btn} text-c-t2 hover:text-c-text hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed`}>
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) {
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }
  return d.toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AdminAuditLogs() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [totalPages, setTotalPages] = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)

  const [actionFilter, setActionFilter] = useState<AuditAction | ''>('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  const load = useCallback(async (p = page, s = search, a = actionFilter) => {
    setLoading(true)
    try {
      const data = await adminAuditApi.list({
        page: p,
        size: 30,
        action: a || undefined,
        search: s || undefined,
      })
      setEntries(data.content)
      setTotalPages(data.totalPages)
      setTotalElements(data.totalElements)
    } finally { setLoading(false) }
  }, [page, search, actionFilter])

  useEffect(() => { load(0, '', '') }, []) // initial

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(0)
    load(0, searchInput, actionFilter)
  }

  const handleAction = (a: AuditAction | '') => {
    setActionFilter(a)
    setPage(0)
    load(0, search, a)
  }

  const handlePage = (p: number) => { setPage(p); load(p, search, actionFilter) }

  const handleReset = () => {
    setSearchInput(''); setSearch(''); setActionFilter(''); setPage(0)
    load(0, '', '')
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-c-primary" />
          <h1 className="text-xl font-semibold text-c-text">Логи действий</h1>
        </div>
        <span className="text-sm text-c-t3">{totalElements.toLocaleString('ru-RU')} событий</span>
      </div>

      {/* Filters */}
      <div className="space-y-3 mb-5">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-c-t3" />
            <input
              type="text"
              placeholder="Поиск по админу, пользователю, описанию..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="input pl-9"
            />
          </div>
          <button type="submit"
            className="px-4 py-2 bg-c-primary hover:bg-c-primary-h text-white text-sm rounded-lg transition-colors cursor-pointer">
            Найти
          </button>
          {(search || actionFilter) && (
            <button type="button" onClick={handleReset}
              className="px-3 py-2 bg-c-bg2 border border-c-border text-c-t2 hover:text-c-text text-sm rounded-lg transition-colors cursor-pointer flex items-center gap-1">
              <X className="w-4 h-4" /> Сброс
            </button>
          )}
        </form>

        {/* Action filter chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-c-t3" />
          <button
            onClick={() => handleAction('')}
            className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer
              ${!actionFilter ? 'border-c-primary bg-c-primary/15 text-c-primary' : 'border-c-border bg-c-bg2 text-c-t2 hover:text-c-text'}`}>
            Все
          </button>
          {(Object.entries(ACTION_META) as [AuditAction, typeof ACTION_META[AuditAction]][]).map(([a, meta]) => {
            const active = actionFilter === a
            return (
              <button key={a} onClick={() => handleAction(a)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer
                  ${active ? `${meta.bg} ${meta.color} border-current` : 'border-c-border bg-c-bg2 text-c-t2 hover:text-c-text'}`}>
                <meta.icon className="w-3 h-3" />
                {meta.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* List */}
      {loading ? <LoadingSpinner /> : entries.length === 0 ? (
        <div className="text-center py-16 text-c-t3 text-sm">
          {search || actionFilter ? 'Ничего не найдено по выбранным фильтрам' : 'Лог пуст — никаких действий пока не зафиксировано'}
        </div>
      ) : (
        <div className="space-y-1.5">
          {entries.map((e, i) => (
            <motion.div key={e.id}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.015, 0.3) }}
              className="card rounded-lg px-4 py-3 flex items-start gap-3">

              {/* Action */}
              <div className="shrink-0 pt-0.5">
                <ActionBadge action={e.action} />
              </div>

              {/* Body */}
              <div className="flex-1 min-w-0">
                <div className="text-sm text-c-text flex items-center gap-1.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-c-primary font-medium">
                    <ShieldCheck className="w-3 h-3" />
                    {e.actorUsername}
                  </span>
                  {e.targetUsername && (
                    <>
                      <span className="text-c-t3">→</span>
                      <span className="inline-flex items-center gap-1 text-c-text">
                        <UserIcon className="w-3 h-3 text-c-t3" />
                        {e.targetUsername}
                      </span>
                    </>
                  )}
                </div>
                {e.details && (
                  <div className="text-xs text-c-t2 mt-1 break-words">{e.details}</div>
                )}
              </div>

              {/* Meta */}
              <div className="shrink-0 text-right">
                <div className="text-xs text-c-t2 tabular-nums">{formatTime(e.timestamp)}</div>
                {e.ip && <div className="text-[10px] text-c-t3 font-mono mt-0.5">{e.ip}</div>}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Pagination page={page} total={totalPages} onChange={handlePage} />
    </div>
  )
}
