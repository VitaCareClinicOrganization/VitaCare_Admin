'use client'

import React, { useState } from 'react'
import RoleSidebar, { StaffMobileHeader } from '@/modules/portal/components/RoleSidebar'

interface DoctorAppHeaderProps {
  activeTab?: 'calendar' | 'waiting' | 'schedule' | 'history' | 'exam' | 'stats'
  user?: any
  onLogout?: () => void
  examBadge?: number
  onExamNavigate?: () => void
}

export default function DoctorAppHeader({
  activeTab = 'calendar',
  user,
  onLogout,
}: DoctorAppHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const roleActive =
    activeTab === 'history'
      ? 'history'
      : activeTab === 'schedule'
        ? 'schedule'
        : activeTab === 'waiting'
          ? 'waiting'
          : activeTab === 'stats'
            ? 'dashboard'
            : 'calendar'

  return (
    <>
      <RoleSidebar
        role="doctor"
        active={roleActive}
        user={user}
        onLogout={onLogout}
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />
      <StaffMobileHeader onOpenMenu={() => setMobileMenuOpen(true)} roleTitle="Bác sĩ" />
    </>
  )
}

