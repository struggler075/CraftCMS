export interface User {
  username: string
  email: string
  role: 'USER' | 'ADMIN'
  balance: number
}

export interface UserProfile {
  id: number
  username: string
  email: string
  role: 'USER' | 'ADMIN'
  balance: number
  createdAt: string
  totalOrders: number
  skinUrl?: string
  capeUrl?: string
  emailVerified: boolean
}

export interface AuthResponse {
  token?: string
  username?: string
  email?: string
  role?: 'USER' | 'ADMIN'
  balance?: number
  message?: string
  requiresTOTP?: boolean
  preAuthToken?: string
  requiresVerification?: boolean
}

export interface Category {
  id: number
  name: string
  slug: string
  icon: string
  description: string
  sortOrder: number
}

export interface Product {
  id: number
  name: string
  description: string
  price: number
  imageUrl: string
  category: Category
  stock: number
  featured: boolean
  active: boolean
  type: ProductType
  command?: string
  quantityEnabled: boolean
  defaultQuantity: number
  createdAt: string
}

export type ProductType =
  | 'BLOCK' | 'ITEM' | 'ARMOR' | 'WEAPON'
  | 'TOOL' | 'ENCHANTMENT' | 'KIT' | 'RANK' | 'CURRENCY'

export type PingMethod = 'MCSRVSTAT' | 'MCSTATUS' | 'DIRECT'

export interface ServerMod {
  id: number
  name: string
  description: string | null
  sortOrder: number
}

export interface ServerWithStatus {
  id: number
  name: string
  address: string
  description: string | null
  imageUrl: string
  featured: boolean
  pingMethod: PingMethod
  mods: ServerMod[]
  online: boolean
  playersOnline: number
  playersMax: number
  version: string
  motd: string
}

export interface News {
  id: number
  title: string
  content: string
  excerpt: string
  imageUrl: string
  images: string[]
  author: string
  category: NewsCategory
  published: boolean
  createdAt: string
}

export type NewsCategory = 'NEWS' | 'UPDATE' | 'EVENT' | 'ANNOUNCEMENT'

export interface Order {
  id: number
  productName: string
  productImageUrl: string
  categoryName: string
  quantity: number
  totalPrice: number
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED'
  createdAt: string
}

export interface DonateFeature {
  id: number
  name: string
  sortOrder: number
}

export interface DonateRank {
  id: number
  name: string
  color: string
  imageUrl: string | null
  price: number
  sortOrder: number
  featured: boolean
  featureIds: number[]
}

export interface DonatePageData {
  ranks: DonateRank[]
  features: DonateFeature[]
}

export interface PaginatedResponse<T> {
  content: T[]
  totalElements: number
  totalPages: number
  currentPage: number
}
