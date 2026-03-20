'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from './supabase'
import type { User as SupabaseUser } from '@supabase/supabase-js'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://mlapi.bet'

export interface AppUser {
  id: string
  email: string
  tier: string
  autoUpgrade: boolean
  creditsUsed: number
  creditsLimit: number
  cardOnFile: boolean
  createdAt?: string
}

interface AuthContextType {
  user: AppUser | null
  loading: boolean
  setUser: (user: AppUser | null) => void
  refreshUser: () => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  setUser: () => {},
  refreshUser: async () => {},
  logout: () => {},
})

function toAppUser(su: SupabaseUser): AppUser {
  return {
    id: su.id,
    email: su.email ?? '',
    tier: su.user_metadata?.tier ?? 'free',
    autoUpgrade: true,
    creditsUsed: 0,
    creditsLimit: 1_000,
    cardOnFile: false,
    createdAt: su.created_at,
  }
}

/** Fetch real tier/billing data from our API (MongoDB is source of truth) */
async function fetchUserFromApi(token: string): Promise<Partial<AppUser>> {
  try {
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (data.success && data.data) {
      return {
        tier: data.data.tier || 'free',
      }
    }
  } catch {
    // Fallback to Supabase metadata
  }
  return {}
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  async function hydrateUser(supabaseUser: SupabaseUser, token?: string) {
    const base = toAppUser(supabaseUser)
    if (token) {
      const apiData = await fetchUserFromApi(token)
      setUser({ ...base, ...apiData })
    } else {
      setUser(base)
    }
  }

  async function refreshUser() {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      await hydrateUser(session.user, session.access_token)
    }
  }

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        hydrateUser(session.user, session.access_token).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        hydrateUser(session.user, session.access_token)
      } else {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function logout() {
    await supabase.auth.signOut()
    setUser(null)
    router.push('/login')
  }

  return (
    <AuthContext.Provider value={{ user, loading, setUser, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
