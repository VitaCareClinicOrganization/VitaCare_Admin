'use client'

import { useCallback, useRef, useState } from 'react'
import { useNavigate } from './useNextNavigation'
import { useAuth } from './useAuth'

export function useStaffLogout() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const pending = useRef<Promise<void> | null>(null)

  const performLogout = useCallback(() => {
    if (pending.current) return pending.current
    setIsLoggingOut(true)
    pending.current = (async () => {
      try {
        await logout()
      } catch (error) {
        console.error('Không thể hoàn tất đăng xuất:', error instanceof Error ? error : new Error('Đăng xuất thất bại, không có thông tin lỗi.'))
      } finally {
        try {
          navigate('/login', { replace: true })
        } catch (error) {
          console.error('Không thể chuyển đến trang đăng nhập:', error)
          window.location.replace('/login')
        }
        pending.current = null
        setIsLoggingOut(false)
      }
    })()
    return pending.current
  }, [logout, navigate])

  return { performLogout, isLoggingOut }
}
