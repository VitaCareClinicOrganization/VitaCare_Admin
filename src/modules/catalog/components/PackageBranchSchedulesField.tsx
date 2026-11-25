'use client'

import { useState } from 'react'
import PackageSchedulesField from './PackageSchedulesField'
import { ReceptionDay } from '../types/catalog.types'

interface Props {
  branches: { id: string; name: string }[]
  value: ReceptionDay[]
  onChange: (schedules: ReceptionDay[]) => void
  disabled?: boolean
  methodCode?: string
}

export default function PackageBranchSchedulesField({ branches, value, onChange, disabled, methodCode }: Props) {
  const [selectedId, setSelectedId] = useState('')
  const branchId = branches.some((branch) => String(branch.id) === String(selectedId)) ? selectedId : branches[0]?.id
  if (!branchId) return null
  const days = value.filter((day) => String(day.branchId) === String(branchId))
  const weekendOnly = methodCode === 'AFTER_HOURS'

  return <div className="sm:col-span-2 space-y-3">
    {branches.length > 1 && <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-slate-700">Lịch của cơ sở</span>
      <select aria-label="Cơ sở thiết lập lịch" value={branchId} disabled={disabled} onChange={(event) => setSelectedId(event.target.value)} className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs">
        {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
      </select>
    </div>}
    <PackageSchedulesField key={branchId} value={days} weekendOnly={weekendOnly} disabled={disabled} onChange={(next) => onChange([
      ...value.filter((day) => String(day.branchId) !== String(branchId)),
      ...next.map((day) => ({ ...day, branchId })),
    ])} />
  </div>
}
