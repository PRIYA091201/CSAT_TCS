import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export type UserRole = 'admin' | 'md' | null

export type AuthState = {
  user: User | null
  role: UserRole
  loading: boolean
}

export function useAuth(): AuthState {
  const [user, setUser]       = useState<User | null>(null)
  const [role, setRole]       = useState<UserRole>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setRole(extractRole(session?.user ?? null))
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setRole(extractRole(session?.user ?? null))
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user, role, loading }
}

function extractRole(user: User | null): UserRole {
  if (!user) return null

  // Priority 1: app_metadata.role (set by admin SQL — most secure)
  const appRole = user.app_metadata?.role as string | undefined
  if (appRole === 'admin' || appRole === 'md') return appRole

  // Priority 2: user_metadata.role (set during login flow)
  const metaRole = user.user_metadata?.role as string | undefined
  if (metaRole === 'admin' || metaRole === 'md') return metaRole

  // Priority 3: email-based role assignment for known accounts (MVP fallback)
  // This allows login while app_metadata is being set up via SQL
  const email = user.email ?? ''
  if (email === 'admin@chennaisilks.com') return 'admin'
  if (email === 'md@chennaisilks.com') return 'md'

  return null
}
