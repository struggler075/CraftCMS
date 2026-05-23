import axios from 'axios'
import { useAuthStore } from '../store/authStore'
import type {
  AuthResponse, Category, CurrentUser, DonateFeature, DonatePageData, DonateRank, News, Order,
  PaginatedResponse, Product, ServerWithStatus, UserProfile,
} from '../types'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Any 401 from the backend means our persisted session no longer matches the
    // server's view of the user (deleted, blocked, password rotated, tokenVersion
    // bumped, expired) — drop the local copy immediately.
    if (err.response?.status === 401) {
      const { isAuthenticated, logout } = useAuthStore.getState()
      if (isAuthenticated) logout()
    }
    return Promise.reject(err)
  }
)

export const authApi = {
  login: (username: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { username, password }).then((r) => r.data),
  register: (username: string, email: string, password: string) =>
    api.post<AuthResponse>('/auth/register', { username, email, password }).then((r) => r.data),
  verifyEmail: (token: string) =>
    api.get<{ success: boolean; message: string; username: string }>(`/auth/verify-email?token=${token}`).then((r) => r.data),
  verify2fa: (preAuthToken: string, code: string) =>
    api.post<AuthResponse>('/auth/2fa/verify', { preAuthToken, code }).then((r) => r.data),
  forgotPassword: (email: string) =>
    api.post<{ message: string }>('/auth/forgot-password', { email }).then((r) => r.data),
  resetPassword: (token: string, password: string) =>
    api.post<{ message: string }>('/auth/reset-password', { token, password }).then((r) => r.data),
  me: () => api.get<CurrentUser>('/auth/me').then((r) => r.data),
  logoutAll: () => api.post<{ message: string }>('/auth/logout-all').then((r) => r.data),
}

export const totpApi = {
  getStatus: () => api.get<{ enabled: boolean }>('/user/2fa/status').then((r) => r.data),
  setup: () => api.post<{ secret: string; otpUrl: string }>('/user/2fa/setup').then((r) => r.data),
  enable: (code: string) => api.post<{ message: string }>('/user/2fa/enable', { code }).then((r) => r.data),
  disable: (code: string) => api.post<{ message: string }>('/user/2fa/disable', { code }).then((r) => r.data),
}

export const categoriesApi = {
  getAll: () => api.get<Category[]>('/categories').then((r) => r.data),
  create: (data: Partial<Category>) => api.post<Category>('/admin/categories', data).then((r) => r.data),
  update: (id: number, data: Partial<Category>) => api.put<Category>(`/admin/categories/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/admin/categories/${id}`),
}

export interface ProductsQuery {
  category?: string; serverId?: number; page?: number; size?: number; sortBy?: string; sortDir?: string;
}

export const productsApi = {
  getAll: (params?: ProductsQuery) =>
    api.get<PaginatedResponse<Product>>('/products', { params }).then((r) => r.data),
  getById: (id: number) => api.get<Product>(`/products/${id}`).then((r) => r.data),
  getFeatured: () => api.get<Product[]>('/products/featured').then((r) => r.data),
  getAllAdmin: () => api.get<Product[]>('/admin/products').then((r) => r.data),
  create: (data: object) => api.post<Product>('/admin/products', data).then((r) => r.data),
  update: (id: number, data: object) => api.put<Product>(`/admin/products/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/admin/products/${id}`),
}

export const serversApi = {
  getAll: () => api.get<ServerWithStatus[]>('/servers').then((r) => r.data),
  getAllAdmin: () => api.get<unknown[]>('/admin/servers').then((r) => r.data),
  create: (data: object) => api.post('/admin/servers', data).then((r) => r.data),
  update: (id: number, data: object) => api.put(`/admin/servers/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/admin/servers/${id}`),
}

export const newsApi = {
  getAll: (params?: { page?: number; size?: number }) =>
    api.get<PaginatedResponse<News>>('/news', { params }).then((r) => r.data),
  getById: (id: number) => api.get<News>(`/news/${id}`).then((r) => r.data),
  create: (data: Partial<News>) => api.post<News>('/admin/news', data).then((r) => r.data),
  update: (id: number, data: Partial<News>) => api.put<News>(`/admin/news/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/admin/news/${id}`),
}

export const userApi = {
  getProfile: () => api.get<UserProfile>('/user/profile').then((r) => r.data),
  getOrders: () => api.get<Order[]>('/user/orders').then((r) => r.data),
  purchase: (productId: number, quantity = 1) =>
    api.post<Order>('/user/purchase', { productId, quantity }).then((r) => r.data),
  addBalance: (username: string, amount: number) =>
    api.post('/user/balance', { username, amount }).then((r) => r.data),
  uploadSkin: (file: File) => {
    const fd = new FormData(); fd.append('file', file)
    return api.post<{ url: string }>('/user/skin', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
  },
  uploadCape: (file: File) => {
    const fd = new FormData(); fd.append('file', file)
    return api.post<{ url: string }>('/user/cape', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
  },
  buyDonate: (rankId: number) =>
    api.post<{ newBalance: number }>(`/user/donate/buy/${rankId}`).then((r) => r.data),
  resendVerification: () =>
    api.post<{ message: string }>('/user/resend-verification').then((r) => r.data),
}

export const adminApi = {
  getStats: () =>
    api.get<{ totalProducts: number; totalCategories: number; totalServers: number; totalNews: number }>('/admin/stats').then((r) => r.data),
  uploadProductImage: (file: File) => {
    const fd = new FormData(); fd.append('file', file)
    return api.post<{ url: string }>('/admin/upload/product-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
  },
  uploadNewsImage: (file: File) => {
    const fd = new FormData(); fd.append('file', file)
    return api.post<{ url: string }>('/admin/upload/news-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
  },
  uploadServerImage: (file: File) => {
    const fd = new FormData(); fd.append('file', file)
    return api.post<{ url: string }>('/admin/upload/server-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
  },
  uploadSiteLogo: (file: File) => {
    const fd = new FormData(); fd.append('file', file)
    return api.post<{ url: string }>('/admin/upload/site-logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
  },
}

export interface AdminUser {
  id: number
  username: string
  email: string
  role: 'USER' | 'ADMIN'
  balance: number
  blocked: boolean
  skinUrl: string | null
  createdAt: string
}

export interface AdminUserPage {
  content: AdminUser[]
  totalElements: number
  totalPages: number
  number: number
}

export const adminUsersApi = {
  list: (params: { search?: string; page?: number; size?: number }) =>
    api.get<AdminUserPage>('/admin/users', { params }).then((r) => r.data),
  stats: () =>
    api.get<{ total: number; admins: number }>('/admin/users/stats').then((r) => r.data),
  update: (id: number, data: { role?: string; balance?: number; newPassword?: string; blocked?: boolean; blockReason?: string }) =>
    api.put<AdminUser>(`/admin/users/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/admin/users/${id}`),
}

export type AuditAction =
  | 'USER_BALANCE_CHANGE'
  | 'USER_PASSWORD_RESET'
  | 'USER_ROLE_CHANGE'
  | 'USER_BLOCK'
  | 'USER_UNBLOCK'
  | 'USER_DELETE'
  | 'USER_FORCE_LOGOUT'

export interface AuditLogEntry {
  id: number
  timestamp: string
  actorId: number
  actorUsername: string
  action: AuditAction
  targetId: number | null
  targetUsername: string | null
  details: string | null
  ip: string | null
}

export interface AuditLogPage {
  content: AuditLogEntry[]
  totalElements: number
  totalPages: number
  number: number
}

export const adminAuditApi = {
  list: (params: {
    action?: AuditAction
    actorId?: number
    targetId?: number
    from?: string
    to?: string
    search?: string
    page?: number
    size?: number
  }) => api.get<AuditLogPage>('/admin/audit-logs', { params }).then((r) => r.data),
  actions: () => api.get<AuditAction[]>('/admin/audit-logs/actions').then((r) => r.data),
}

export const donateApi = {
  getPage: (serverId?: number) =>
    api.get<DonatePageData>('/donate', { params: serverId ? { serverId } : {} }).then((r) => r.data),
}

export const adminDonateApi = {
  getFeatures: () => api.get<DonateFeature[]>('/admin/donate/features').then((r) => r.data),
  createFeature: (data: { name: string; sortOrder: number }) =>
    api.post<DonateFeature>('/admin/donate/features', data).then((r) => r.data),
  updateFeature: (id: number, data: { name: string; sortOrder: number }) =>
    api.put<DonateFeature>(`/admin/donate/features/${id}`, data).then((r) => r.data),
  deleteFeature: (id: number) => api.delete(`/admin/donate/features/${id}`),

  getRanks: () => api.get<DonateRank[]>('/admin/donate/ranks').then((r) => r.data),
  createRank: (data: Partial<DonateRank>) =>
    api.post<DonateRank>('/admin/donate/ranks', data).then((r) => r.data),
  updateRank: (id: number, data: Partial<DonateRank>) =>
    api.put<DonateRank>(`/admin/donate/ranks/${id}`, data).then((r) => r.data),
  deleteRank: (id: number) => api.delete(`/admin/donate/ranks/${id}`),

  uploadImage: (file: File) => {
    const fd = new FormData(); fd.append('file', file)
    return api.post<{ url: string }>('/admin/upload/donate-image', fd,
      { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data)
  },
}

export interface LauncherConfig {
  id: number
  version: string
  description: string
  windowsUrl: string
  linuxUrl: string
  macUrl: string
  active: boolean
}

export const launcherApi = {
  get: () => api.get<LauncherConfig>('/launcher').then((r) => r.data),
  update: (data: Partial<LauncherConfig>) => api.put<LauncherConfig>('/admin/launcher', data).then((r) => r.data),
}

export interface SmtpSettings {
  id?: number
  enabled: boolean
  host: string
  port: number
  username: string
  password: string
  fromEmail: string
  fromName: string
  ssl: boolean
}

export const smtpApi = {
  get: () => api.get<SmtpSettings>('/admin/smtp').then((r) => r.data),
  update: (data: Partial<SmtpSettings>) => api.put<SmtpSettings>('/admin/smtp', data).then((r) => r.data),
  test: (email: string) => api.post<{ message: string }>('/admin/smtp/test', { email }).then((r) => r.data),
}

export interface Commit {
  sha: string
  shortSha: string
  message: string
  author: string
  authorAvatarUrl: string
  date: string
  url: string
  type: string
}

export interface UpdatesStatus {
  status: 'active' | 'inactive' | 'unconfigured'
  message: string
  tokenSet: boolean
  githubRepo: string | null
  currentVersion: string | null
  hasUpdates: boolean
  pendingCommits: Commit[]
  installedCommits: Commit[]
}

export const updatesApi = {
  getStatus: (refresh = false) =>
    api.get<UpdatesStatus>(`/admin/updates${refresh ? '?refresh=true' : ''}`).then((r) => r.data),
  updateToken: (token: string) =>
    api.put<{ message: string }>('/admin/updates/token', { token }).then((r) => r.data),
  getWsToken: () =>
    api.post<{ token: string }>('/admin/updates/ws-token').then((r) => r.data),
}

export interface PaymentSettings {
  id?: number
  freekassaEnabled: boolean
  freekassaMerchantId: string
  freekassaSecretKey1: string
  freekassaSecretKey2: string
  unitpayEnabled: boolean
  unitpayPublicKey: string
  unitpaySecretKey: string
  stripeEnabled: boolean
  stripePublishableKey: string
  stripeSecretKey: string
  stripeWebhookSecret: string
  yookassaEnabled: boolean
  yookassaShopId: string
  yookassaSecretKey: string
  trademcEnabled: boolean
  trademcShopId: string
  trademcItemId: string
  trademcShopKey: string
  showLogosInFooter: boolean
  topUpProvider: string
}

export type PaymentProvider = 'FREEKASSA' | 'UNITPAY' | 'STRIPE' | 'YOOKASSA' | 'TRADEMC'
export type TopUpStatus = 'PENDING' | 'COMPLETED' | 'FAILED'

export interface TopUpOrder {
  id: string
  username: string
  amount: number
  provider: PaymentProvider
  status: TopUpStatus
  externalId: string | null
  createdAt: string
  completedAt: string | null
}

export interface ModulesConfig {
  trademc: boolean
}

export const modulesApi = {
  get: () => api.get<ModulesConfig>('/settings/modules').then((r) => r.data),
}

export const paymentApi = {
  initiate: (amount: number) =>
    api.post<{ redirectUrl: string }>('/payments/initiate', { amount }).then((r) => r.data),
  getHistory: () =>
    api.get<TopUpOrder[]>('/payments/history').then((r) => r.data),
}

export const adminPaymentApi = {
  getSettings: () => api.get<PaymentSettings>('/admin/payments/settings').then((r) => r.data),
  updateSettings: (data: Partial<PaymentSettings>) =>
    api.put<PaymentSettings>('/admin/payments/settings', data).then((r) => r.data),
  getOrders: (params?: { page?: number; size?: number }) =>
    api.get<{ content: TopUpOrder[]; totalElements: number; totalPages: number; number: number }>(
      '/admin/payments/orders', { params }).then((r) => r.data),
  completeOrder: (orderId: string) =>
    api.post(`/admin/payments/orders/${orderId}/complete`).then((r) => r.data),
}

export default api
