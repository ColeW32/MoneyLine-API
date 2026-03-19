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
  monthlyTotal: number
  monthlyLimit: number
  dailyCounts: { date: string; count: number }[]
  recentRequests: {
    endpoint: string
    method: string
    statusCode: number
    responseTimeMs: number
    timestamp: string
  }[]
}

export interface PlanData {
  currentTier: string
  tierConfig: Record<string, unknown>
  allTiers: {
    id: string
    label: string
    requestsPerMonth: number
    requestsPerMinute: number
    edgeAccess: boolean
    playByPlay: boolean
    injuryAccess: boolean
    sports: string | string[]
    [key: string]: unknown
  }[]
}
