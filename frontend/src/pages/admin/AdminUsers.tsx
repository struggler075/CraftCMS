import { useEffect, useState, useCallback } from 'react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Search, Pencil, Trash2, X, Check, ShieldCheck, User, ChevronLeft, ChevronRight, Wallet, Lock, Unlock, KeyRound, Ban } from 'lucide-react'
import { adminUsersApi, type AdminUser } from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'

// ── Avatar ────────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#f97316','#06b6d4']

function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
}

function Avatar({ username, size = 36 }: { username: string; size?: number }) {
  const color = avatarColor(username)
  return (
    <div className="rounded-full flex items-center justify-center shrink-0 font-semibold text-white select-none"
         style={{ width: size, height: size, background: color, fontSize: size * 0.4 }}>
      {username[0]?.toUpperCase()}
    </div>
  )
}

// ── Role badge ────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const isAdmin = role === 'ADMIN'
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium
      ${isAdmin ? 'bg-c-primary/15 text-c-primary' : 'bg-white/5 text-c-t3'}`}>
      {isAdmin ? <ShieldCheck className="w-3 h-3" /> : <User className="w-3 h-3" />}
      {isAdmin ? 'Admin' : 'User'}
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
    <div className="flex items-center justify-center gap-1 mt-8">
      <button onClick={() => onChange(page - 1)} disabled={page === 0}
        className={`${btn} text-c-t2 hover:text-c-text hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed`}>
        <ChevronLeft className="w-4 h-4" />
      </button>
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`e${i}`} className="w-8 h-8 flex items-center justify-center text-c-t3 text-sm">…</span>
        ) : (
          <button key={p} onClick={() => onChange(p as number)}
            className={`${btn} ${p === page ? 'bg-c-primary text-white font-medium' : 'text-c-t2 hover:text-c-text hover:bg-white/5'}`}>
            {(p as number) + 1}
          </button>
        )
      )}
      <button onClick={() => onChange(page + 1)} disabled={page === total - 1}
        className={`${btn} text-c-t2 hover:text-c-text hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed`}>
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}

// ── Edit modal ────────────────────────────────────────────────────────────────

function EditModal({ user, onClose, onSaved }: { user: AdminUser; onClose: () => void; onSaved: (u: AdminUser) => void }) {
  const [role, setRole] = useState(user.role)
  const [balance, setBalance] = useState(user.balance.toString())
  const [newPassword, setNewPassword] = useState('')
  const [blocked, setBlocked] = useState(user.blocked)
  const [blockReason, setBlockReason] = useState((user as unknown as { blockReason?: string }).blockReason ?? '')
  const [saving, setSaving] = useState(false)
  const currentUser = useAuthStore((s) => s.user)
  const isSelf = currentUser?.username === user.username

  useEscapeKey(onClose, true)

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload: Parameters<typeof adminUsersApi.update>[1] = {
        role,
        balance: parseFloat(balance),
        blocked,
        blockReason: blocked ? blockReason : '',
      }
      if (newPassword.trim()) payload.newPassword = newPassword.trim()
      const updated = await adminUsersApi.update(user.id, payload)
      onSaved(updated)
      toast.success('Пользователь обновлён')
      onClose()
    } catch { toast.error('Ошибка сохранения') } finally { setSaving(false) }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-sm bg-c-bg1 border border-c-border rounded-2xl p-6"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <Avatar username={user.username} size={34} />
            <div>
              <div className="text-sm font-semibold text-c-text flex items-center gap-2">
                {user.username}
                {user.blocked && <Ban className="w-3.5 h-3.5 text-c-red" />}
              </div>
              <div className="text-xs text-c-t3">{user.email}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-c-t3 hover:text-c-t2 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          {/* Role */}
          <div>
            <label className="block text-sm text-c-t2 mb-1.5">Роль</label>
            <div className="grid grid-cols-2 gap-2">
              {(['USER', 'ADMIN'] as const).map((r) => (
                <button key={r} type="button"
                  disabled={isSelf}
                  onClick={() => setRole(r)}
                  className={`py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer flex items-center justify-center gap-1.5
                    ${role === r ? 'border-c-primary bg-c-primary/15 text-c-primary' : 'border-c-border bg-c-bg2 text-c-t2 hover:border-c-border-h hover:text-c-text'}
                    disabled:opacity-40 disabled:cursor-not-allowed`}>
                  {r === 'ADMIN' ? <ShieldCheck className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                  {r === 'ADMIN' ? 'Admin' : 'User'}
                </button>
              ))}
            </div>
            {isSelf && <p className="text-xs text-c-t3 mt-1.5">Нельзя изменить роль своего аккаунта</p>}
          </div>

          {/* Balance */}
          <div>
            <label className="block text-sm text-c-t2 mb-1.5">Баланс (₽)</label>
            <div className="relative">
              <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-c-t3" />
              <input type="number" min="0" step="0.01" value={balance}
                onChange={(e) => setBalance(e.target.value)}
                className="input pl-9" />
            </div>
          </div>

          {/* New password */}
          <div>
            <label className="block text-sm text-c-t2 mb-1.5">Новый пароль</label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-c-t3" />
              <input type="text" value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Оставьте пустым, чтобы не менять"
                className="input pl-9" />
            </div>
          </div>

          {/* Block / Unblock */}
          {!isSelf && (
            <div>
              <label className="block text-sm text-c-t2 mb-1.5">Статус аккаунта</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setBlocked(false)}
                  className={`py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer flex items-center justify-center gap-1.5
                    ${!blocked ? 'border-c-green bg-c-green/15 text-c-green' : 'border-c-border bg-c-bg2 text-c-t2 hover:border-c-border-h hover:text-c-text'}`}>
                  <Unlock className="w-3.5 h-3.5" /> Активен
                </button>
                <button type="button" onClick={() => setBlocked(true)}
                  className={`py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer flex items-center justify-center gap-1.5
                    ${blocked ? 'border-c-red bg-c-red/15 text-c-red' : 'border-c-border bg-c-bg2 text-c-t2 hover:border-c-border-h hover:text-c-text'}`}>
                  <Lock className="w-3.5 h-3.5" /> Заблокирован
                </button>
              </div>
              {blocked && (
                <div className="mt-2">
                  <input value={blockReason} onChange={(e) => setBlockReason(e.target.value)}
                    className="input text-sm" placeholder="Причина блокировки (отобразится при входе на сервер)" />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose}
            className="flex-1 py-2 rounded-lg bg-c-bg3 border border-c-border text-c-t2 hover:text-c-text text-sm transition-colors cursor-pointer">
            Отмена
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2 rounded-lg bg-c-primary hover:bg-c-primary-h text-white text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2">
            <Check className="w-4 h-4" />{saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [totalPages, setTotalPages] = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, admins: 0 })
  const [editing, setEditing] = useState<AdminUser | null>(null)
  const currentUser = useAuthStore((s) => s.user)

  const load = useCallback(async (p = page, s = search) => {
    setLoading(true)
    try {
      const data = await adminUsersApi.list({ page: p, size: 15, search: s || undefined })
      setUsers(data.content)
      setTotalPages(data.totalPages)
      setTotalElements(data.totalElements)
    } finally { setLoading(false) }
  }, [page, search])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    adminUsersApi.stats().then(setStats)
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(0)
    load(0, searchInput)
  }

  const handlePageChange = (p: number) => { setPage(p); load(p, search) }

  const handleDelete = async (u: AdminUser) => {
    if (u.username === currentUser?.username) { toast.error('Нельзя удалить собственный аккаунт'); return }
    if (!confirm(`Удалить пользователя ${u.username}?`)) return
    await adminUsersApi.delete(u.id)
    toast.success('Пользователь удалён')
    setStats((s) => ({ ...s, total: s.total - 1, admins: u.role === 'ADMIN' ? s.admins - 1 : s.admins }))
    load()
  }

  const handleSaved = (updated: AdminUser) => {
    setUsers((prev) => prev.map((u) => u.id === updated.id ? updated : u))
    adminUsersApi.stats().then(setStats)
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-c-primary" />
          <h1 className="text-xl font-semibold text-c-text">Пользователи</h1>
        </div>
        <span className="text-sm text-c-t3">{totalElements} всего</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Всего игроков', value: stats.total, color: 'text-c-primary', bg: 'bg-c-primary/10' },
          { label: 'Администраторов', value: stats.admins, color: 'text-c-gold', bg: 'bg-c-gold/10' },
          { label: 'Обычных игроков', value: stats.total - stats.admins, color: 'text-c-green', bg: 'bg-c-green/10' },
        ].map((s) => (
          <div key={s.label} className="card rounded-xl p-4">
            <div className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</div>
            <div className="text-xs text-c-t3 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-c-t3" />
          <input
            type="text"
            placeholder="Поиск по нику или email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="input pl-9"
          />
        </div>
        <button type="submit"
          className="px-4 py-2 bg-c-primary hover:bg-c-primary-h text-white text-sm rounded-lg transition-colors cursor-pointer">
          Найти
        </button>
        {search && (
          <button type="button"
            onClick={() => { setSearchInput(''); setSearch(''); setPage(0); load(0, '') }}
            className="px-3 py-2 bg-c-bg2 border border-c-border text-c-t2 hover:text-c-text text-sm rounded-lg transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        )}
      </form>

      {/* List */}
      {loading ? <LoadingSpinner /> : (
        <div className="space-y-2">
          {users.map((u, i) => (
            <motion.div key={u.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="card rounded-xl px-4 py-3">
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <Avatar username={u.username} size={40} />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-c-text">{u.username}</span>
                    <RoleBadge role={u.role} />
                    {u.blocked && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-c-red/15 text-c-red">
                        <Ban className="w-3 h-3" /> Заблокирован
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-c-t3 mt-0.5 truncate">{u.email}</div>
                </div>

                {/* Balance */}
                <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                  <Wallet className="w-3.5 h-3.5 text-c-green" />
                  <span className="text-sm font-medium text-c-text tabular-nums">
                    {u.balance.toLocaleString('ru-RU')} ₽
                  </span>
                </div>

                {/* Date */}
                <div className="hidden md:block text-xs text-c-t3 shrink-0 w-24 text-right">
                  {formatDate(u.createdAt)}
                </div>

                {/* Actions */}
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setEditing(u)}
                    className="p-1.5 rounded-lg text-c-t3 hover:text-c-primary hover:bg-c-primary/10 transition-colors cursor-pointer"
                    title="Редактировать">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(u)}
                    disabled={u.username === currentUser?.username}
                    className="p-1.5 rounded-lg text-c-t3 hover:text-c-red hover:bg-c-red/10 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Удалить">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}

          {users.length === 0 && (
            <div className="text-center py-16 text-c-t3 text-sm">
              {search ? `Ничего не найдено по запросу «${search}»` : 'Нет пользователей'}
            </div>
          )}
        </div>
      )}

      <Pagination page={page} total={totalPages} onChange={handlePageChange} />

      {/* Edit modal */}
      <AnimatePresence>
        {editing && (
          <EditModal user={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />
        )}
      </AnimatePresence>
    </div>
  )
}
