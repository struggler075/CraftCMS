import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../types'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  // True once the bootstrap revalidation against /api/auth/me has finished
  // (either confirmed or cleared the persisted session). Until then the UI
  // should not trust user/token coming straight out of localStorage.
  ready: boolean
  login: (user: User, token: string) => void
  logout: () => void
  setUser: (patch: Partial<User>) => void
  setReady: (ready: boolean) => void
  updateBalance: (balance: number) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      ready: false,
      login: (user, token) => set({ user, token, isAuthenticated: true, ready: true }),
      logout: () => set({ user: null, token: null, isAuthenticated: false, ready: true }),
      setUser: (patch) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...patch } : (patch as User),
        })),
      setReady: (ready) => set({ ready }),
      updateBalance: (balance) =>
        set((state) => ({
          user: state.user ? { ...state.user, balance } : null,
        })),
    }),
    {
      name: 'craftcms-auth',
      // ready is a per-session flag — never persist it.
      partialize: (s) => ({ user: s.user, token: s.token, isAuthenticated: s.isAuthenticated }),
    }
  )
)
