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
  id: number
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

const DEFAULTS: SiteSettings = {
  id: 1,
  siteName: 'CraftCMS',
  siteDescription: 'Лучший Minecraft опыт.',
  logoUrl: null,
  copyrightText: 'Все права защищены.',
  disclaimerText: 'Not affiliated with Mojang Studios',
  heroTitle: 'Модовый проект нового уровня',
  heroSubtitle: 'Уникальная сборка модов, балансный геймплей и активное сообщество. Скачайте лаунчер и начните играть за несколько минут.',
  donateHeaderImageUrl: null,
  footerColumnsJson: '[]',
  siteUrl: 'http://localhost:5173',
  emailVerificationRequired: false,
  banKickMessage: '§cВы заблокированы на этом сервере.\n§7Причина: §f{reason}',
  bridgeApiKey: 'change-me',
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
  fetch: () => Promise<void>
  update: (s: Partial<SiteSettings>) => Promise<void>
}

export const useSiteSettings = create<SiteSettingsState>((set) => ({
  settings: DEFAULTS,
  loaded: false,

  fetch: async () => {
    try {
      const { data } = await api.get<SiteSettings>('/settings')
      const merged = { ...DEFAULTS } as SiteSettings
      for (const [k, v] of Object.entries(data)) {
        if (v !== null && v !== undefined) (merged as unknown as Record<string, unknown>)[k] = v
      }
      applyColors(merged.primaryColor, merged.bgColor)
      set({ settings: merged, loaded: true })
    } catch {
      set({ loaded: true })
    }
  },

  update: async (incoming) => {
    const { data } = await api.put<SiteSettings>('/admin/settings', incoming)
    const merged = { ...DEFAULTS, ...data } as SiteSettings
    applyColors(merged.primaryColor, merged.bgColor)
    set({ settings: merged })
  },
}))

export function parseFooterColumns(json: string): FooterColumn[] {
  try { return JSON.parse(json) } catch { return [] }
}
