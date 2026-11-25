'use client'

import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiClient } from '../lib/api-client'
import { getCurrentStaff } from '@/modules/auth/services/authService'
import {
  clearStaffSession,
  getStaffSession,
  saveStaffSession,
  setRuntimeStaffSession,
  staffRole,
} from '../modules/admin/utils/staffSession'

export const AuthContext = createContext(null)

const STAFF_ROLES = [
  'admin',
  'chain_manager',
  'branch_manager',
  'doctor',
  'receptionist',
]

export function AuthProvider({ children }) {
  const [session, setSession] = useState({ token: null, user: null })
  const [isInitializing, setIsInitializing] = useState(true)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const logoutPromise = useRef<Promise<void> | null>(null)
  const sessionVersion = useRef(0)
  const syncRuntimeSession = useCallback(() => setSession(getStaffSession()), [])

  const logout = useCallback(() => {
    if (logoutPromise.current) return logoutPromise.current
    sessionVersion.current += 1
    setIsLoggingOut(true)
    logoutPromise.current = (async () => {
      try {
        await apiClient.post('/auth/logout', {})
      } catch {
        // UI vẫn phải đóng phiên nếu cookie phía server đã hết hạn.
      } finally {
        clearStaffSession()
        setSession({ token: null, user: null })
        setIsLoggingOut(false)
        logoutPromise.current = null
      }
    })()
    return logoutPromise.current
  }, [])

  const verifySession = useCallback(async () => {
    if (logoutPromise.current) return null
    const version = sessionVersion.current
    try {
      const verifiedUser = await getCurrentStaff()
      if (version !== sessionVersion.current) return null
      const user = verifiedUser
      setRuntimeStaffSession(user)
      setSession({ token: 'cookie-session', user })
      return user
    } catch {
      if (version !== sessionVersion.current) return null
      clearStaffSession()
      setSession({ token: null, user: null })
      return null
    }
  }, [])

  useEffect(() => {
    verifySession().finally(() => setIsInitializing(false))
    window.addEventListener('staff-session-changed', syncRuntimeSession)
    const expireSession = () => {
      sessionVersion.current += 1
      clearStaffSession()
      setSession({ token: null, user: null })
    }
    window.addEventListener('auth-session-expired', expireSession)
    return () => {
      window.removeEventListener('staff-session-changed', syncRuntimeSession)
      window.removeEventListener('auth-session-expired', expireSession)
    }
  }, [syncRuntimeSession, verifySession])

  const login = useCallback(({ user }) => {
    const role = staffRole(user)
    if (!STAFF_ROLES.includes(role)) {
      throw new Error('Tài khoản này không có quyền truy cập cổng nhân viên.')
    }
    sessionVersion.current += 1
    saveStaffSession({ user })
    setSession({ token: 'cookie-session', user })
  }, [])

  const hasRole = useCallback(
    (...roles) => roles.map((role) => String(role).toLowerCase()).includes(staffRole(session.user)),
    [session.user],
  )

  const value = useMemo(
    () => ({
      token: session.token,
      user: session.user,
      role: staffRole(session.user),
      isAuthenticated: Boolean(session.token && session.user),
      isInitializing,
      isLoggingOut,
      login,
      logout,
      hasRole,
      verifySession,
    }),
    [hasRole, isInitializing, isLoggingOut, login, logout, session, verifySession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
