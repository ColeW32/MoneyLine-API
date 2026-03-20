import { supabase } from './supabase'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://mlapi.bet'

interface ApiResponse<T = unknown> {
  success: boolean
  data: T
  meta: Record<string, unknown>
  error: { message: string; statusCode: number } | null
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  })

  const data = await res.json()
  if (!data.success) {
    throw new ApiError(data.error?.message || 'Request failed', data.error?.statusCode || res.status)
  }
  return data
}

export class ApiError extends Error {
  statusCode: number
  constructor(message: string, statusCode: number) {
    super(message)
    this.statusCode = statusCode
  }
}

// --- Auth (Supabase) ---

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw new Error(error.message)
  return data
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error(error.message)
}

// --- API Keys (still calls our Fastify API) ---

export async function listKeys() {
  return request<ApiKey[]>('/manage/keys')
}

export async function createKey(name: string) {
  return request<ApiKey & { rawKey: string }>('/manage/keys', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export async function revokeKey(keyId: string) {
  return request('/manage/keys/' + keyId, { method: 'DELETE' })
}

// --- Usage ---

export async function getUsage(days = 30) {
  return request<UsageData>(`/manage/usage?days=${days}`)
}

// --- Plan ---

export async function getPlan() {
  return request<PlanData>('/manage/plan')
}

// --- Billing ---

export async function getBillingStatus() {
  return request<BillingStatus>('/manage/billing/status')
}

export async function updateAutoUpgrade(enabled: boolean) {
  return request<{ autoUpgrade: boolean; message: string }>('/manage/billing/auto-upgrade', {
    method: 'PATCH',
    body: JSON.stringify({ enabled }),
  })
}

export async function requestCheckout(tier: string) {
  return request<{ message: string; targetTier: string; price: number }>('/manage/billing/checkout', {
    method: 'POST',
    body: JSON.stringify({ tier }),
  })
}

export async function requestUpgrade(tier: string) {
  return request<{ previousTier: string; newTier: string; message: string }>('/manage/billing/upgrade', {
    method: 'POST',
    body: JSON.stringify({ tier }),
  })
}

// --- Types ---

export interface User {
  id: string
  email: string
  name: string
  company?: string
  tier: string
  createdAt?: string
}

export interface ApiKey {
  id: string
  keyPrefix: string
  name: string
  tier: string
  status: string
  createdAt: string
  lastUsedAt: string | null
}

export interface UsageData {
  creditsUsed: number
  creditsLimit: number
  overageCredits: number
  billingCycleStart: string
  billingCycleEnd: string
  dailyCounts: { date: string; count: number }[]
  recentRequests: {
    endpoint: string
    method: string
    statusCode: number
    responseTimeMs: number
    creditsConsumed?: number
    timestamp: string
  }[]
}

export interface PlanData {
  currentTier: string
  tierConfig: Record<string, unknown>
  creditsUsed: number
  creditsRemaining: number
  overageCredits: number
  overageCost: number
  autoUpgrade: boolean
  cardOnFile: boolean
  billingCycleEnd: string
  allTiers: {
    id: string
    label: string
    creditsPerMonth: number
    requestsPerMinute: number
    priceMonthly: number | null
    overageRate: number | null
    edgeAccess: boolean
    playByPlay: boolean
    injuryAccess: boolean
    booksPerRequest: number
    historicalDays: number
    sports: string | string[]
    [key: string]: unknown
  }[]
}

export interface BillingStatus {
  tier: string
  tierConfig: Record<string, unknown>
  autoUpgrade: boolean
  cardOnFile: boolean
  creditsUsed: number
  creditsLimit: number
  overageCredits: number
  overageCost: number
  billingCycleEnd: string | null
  stripeCustomerId: string | null
  nextTier: string | null
  upgradeCost: number | null
}
