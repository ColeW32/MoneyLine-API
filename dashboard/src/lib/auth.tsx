'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from './supabase'
import type { User as SupabaseUser } from '@supabase/supabase-js'

export interface AppUser {
  id: string
  email: string
  tier: string
  createdAt?: string
}

interface AuthContextType {
  user: AppUser | null
  loading: boolean
  setUser: (user: AppUser | null) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  setUser: () => {},
  logout: () => {},
})

function toAppUser(su: SupabaseUser): AppUser {
  return {
    id: su.id,
    email: su.email ?? '',
    tier: su.user_metadata?.tier ?? 'free',
    createdAt: su.created_at,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(toAppUser(session.user))
      }
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(toAppUser(session.user))
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
    <AuthContext.Provider value={{ user, loading, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
