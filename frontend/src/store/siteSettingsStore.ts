import { create } from 'zustand'
import api from '../services/api'

export interface FooterLink {
  label: string
  href: string
}

export interface FooterColumn {
  title: string
  links: FooterLink[]
}

export interface SiteSettings {
  siteName: string
  siteDescription: string
  logoUrl: string | null
  copyrightText: string
  disclaimerText: string
  heroTitle: string
  heroSubtitle: string
  donateHeaderImageUrl: string | null
  footerColumnsJson: string
  siteUrl: string
  emailVerificationRequired: boolean
  banKickMessage: string
  bridgeApiKey: string
  primaryColor: string
  bgColor: string
}

// Pre-render placeholder — kept only so consumer components stay TS-safe
// during the brief window before fetch returns. App.tsx blocks the entire
// UI tree until `loaded === true`, so these values are NEVER visible.
// If you ever see "CraftCMS" in the UI, it means `loaded` wasn't checked.
const PLACEHOLDER: SiteSettings = {
  siteName: '',
  siteDescription: '',
  logoUrl: null,
  copyrightText: '',
  disclaimerText: '',
  heroTitle: '',
  heroSubtitle: '',
  donateHeaderImageUrl: null,
  footerColumnsJson: '[]',
  siteUrl: '',
  emailVerificationRequired: false,
  banKickMessage: '',
  bridgeApiKey: '',
  primaryColor: '#7c3aed',
  bgColor: '#0a0a0f',
}

// ── Color application ─────────────────────────────────────────────────────────

function hexToChannels(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function clamp(n: number) { return Math.min(255, Math.max(0, Math.round(n))) }

function darken([r, g, b]: [number, number, number], amount = 0.13): string {
  return `${clamp(r * (1 - amount))} ${clamp(g * (1 - amount))} ${clamp(b * (1 - amount))}`
}

export function applyColors(primaryColor: string, bgColor: string) {
  const root = document.documentElement
  const primary = hexToChannels(primaryColor) ?? hexToChannels('#7c3aed')!
  const bg = hexToChannels(bgColor) ?? hexToChannels('#0a0a0f')!
  const [r, g, b] = bg

  root.style.setProperty('--c-primary',   `${primary[0]} ${primary[1]} ${primary[2]}`)
  root.style.setProperty('--c-primary-h', darken(primary))
  root.style.setProperty('--c-bg',        `${r} ${g} ${b}`)
  root.style.setProperty('--c-bg1',       `${clamp(r+5)}  ${clamp(g+5)}  ${clamp(b+7)}`)
  root.style.setProperty('--c-bg2',       `${clamp(r+11)} ${clamp(g+11)} ${clamp(b+15)}`)
  root.style.setProperty('--c-bg3',       `${clamp(r+18)} ${clamp(g+18)} ${clamp(b+24)}`)
}

interface SiteSettingsState {
  settings: SiteSettings
  loaded: boolean
  loadError: string | null
  fetch: () => Promise<void>
  update: (s: Partial<SiteSettings>) => Promise<void>
}

// Retry policy — exponential backoff capped so transient blips (rolling
// restart from update.sh, brief nginx reload) recover automatically.
const RETRY_DELAYS_MS = [0, 500, 1500, 4000, 10000]

async function fetchWithRetry(): Promise<SiteSettings> {
  let lastError: unknown
  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
    if (RETRY_DELAYS_MS[attempt] > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]))
    }
    try {
      const { data } = await api.get<SiteSettings>('/settings')
      return data
    } catch (e) {
      lastError = e
      // Loud — no more silent "guess the admin meant defaults".
      // eslint-disable-next-line no-console
      console.error(`[siteSettings] fetch attempt ${attempt + 1} failed`, e)
    }
  }
  throw lastError
}

export const useSiteSettings = create<SiteSettingsState>((set) => ({
  settings: PLACEHOLDER,
  loaded: false,
  loadError: null,

  fetch: async () => {
    set({ loadError: null })
    try {
      const data = await fetchWithRetry()
      applyColors(data.primaryColor, data.bgColor)
      set({ settings: data, loaded: true, loadError: null })
    } catch (e) {
      // Stay in loaded=false. App.tsx surfaces this as the unavailability
      // screen instead of rendering placeholders to the user.
      const msg = e instanceof Error ? e.message : 'Не удалось загрузить настройки'
      set({ loadError: msg })
      // eslint-disable-next-line no-console
      console.error('[siteSettings] giving up after retries — settings remain unloaded:', msg)
    }
  },

  update: async (incoming) => {
    const { data } = await api.put<SiteSettings>('/admin/settings', incoming)
    applyColors(data.primaryColor, data.bgColor)
    set({ settings: data, loaded: true, loadError: null })
  },
}))

export function parseFooterColumns(json: string): FooterColumn[] {
  try { return JSON.parse(json) } catch { return [] }
}
