'use client'

import type { ReactNode } from 'react'
import { Building2, MapPin, ShieldCheck, Stethoscope, UserRound } from 'lucide-react'
import { useAuth } from '@/common/hooks/useAuth'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Quản trị hệ thống',
  chain_manager: 'Quản lý toàn chuỗi',
  branch_manager: 'Quản lý chi nhánh',
  doctor: 'Bác sĩ',
  receptionist: 'Lễ tân & Tiếp nhận',
}

function Detail({ label, value }: { label: string; value?: ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-slate-800">{value === null || value === undefined || value === '' ? 'Chưa cập nhật' : value}</dd></div>
}

export default function StaffProfilePage() {
  const { user, role } = useAuth()
  const name = user?.fullName || user?.displayName || 'Nhân viên'
  const initials = name.split(/\s+/).slice(-2).map((part: string) => part[0]).join('').toUpperCase()
  const assignments = user?.branch ? [user.branch] : []
  const doctor = user?.doctor
  const status = String(user?.status || '').toLowerCase()
  const statusLabel = user?.isBlocked ? 'Đã khóa' : status === 'active' ? 'Đang hoạt động' : status === 'inactive' ? 'Ngừng hoạt động' : 'Chưa cập nhật'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Thông tin cá nhân</h1>
        <p className="mt-1 text-sm text-slate-500">Thông tin tài khoản và phân công làm việc của bạn tại VitaCare Clinic.</p>
      </div>
      <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:p-6">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[var(--clinic-primary-soft)] text-xl font-bold text-[var(--clinic-primary)]">{initials}</span>
        <div className="min-w-0 flex-1">
          <h2 className="break-words text-lg font-bold text-slate-900">{name}</h2>
          <p className="mt-1 text-sm font-medium text-[var(--clinic-primary)]">{ROLE_LABELS[role] || 'Nhân viên'}</p>
          <p className="mt-1 break-words text-sm text-slate-500">{user?.email || 'Chưa cập nhật email'}</p>
        </div>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600"><ShieldCheck className="h-4 w-4" />{statusLabel}</span>
      </section>
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="mb-5 flex items-center gap-2 text-sm font-bold text-slate-900"><UserRound className="h-5 w-5 text-[var(--clinic-primary)]" />Thông tin tài khoản</h2>
          <dl className="grid gap-5 sm:grid-cols-2">
            <Detail label="Họ và tên" value={name} />
            <Detail label="Vai trò" value={ROLE_LABELS[role]} />
            <Detail label="Email" value={user?.email} />
            <Detail label="Số điện thoại" value={user?.phoneNumber} />
          </dl>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="mb-5 flex items-center gap-2 text-sm font-bold text-slate-900"><Building2 className="h-5 w-5 text-[var(--clinic-primary)]" />Chi nhánh được phân công</h2>
          {assignments.length ? (
            <ul className="space-y-3">
              {assignments.map((branch: any) => (
                <li key={branch.id} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-800">{branch.name || 'Chưa cập nhật tên chi nhánh'}</h3>
                  </div>
                  {branch.code && <p className="mt-1 text-xs text-slate-500">Mã chi nhánh: {branch.code}</p>}
                  {branch.address && <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500"><MapPin className="h-4 w-4 shrink-0" />{branch.address}</p>}
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-500">Chưa có chi nhánh được phân công cho tài khoản này.</p>}
        </section>
      </div>
      {role === 'doctor' && doctor && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="mb-5 flex items-center gap-2 text-sm font-bold text-slate-900"><Stethoscope className="h-5 w-5 text-[var(--clinic-primary)]" />Thông tin chuyên môn</h2>
          <dl className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <Detail label="Học hàm / Học vị" value={doctor.academicRank} />
            <Detail label="Số giấy phép hành nghề" value={doctor.licenseNumber} />
            <Detail label="Kinh nghiệm" value={doctor.experienceYears != null ? `${doctor.experienceYears} năm` : null} />
            <Detail label="Chuyên khoa" value={doctor.specialties?.map((item: any) => item.specialty?.name).filter(Boolean).join(', ')} />
          </dl>
          {doctor.biography && <div className="mt-5"><h3 className="text-xs font-medium text-slate-500">Giới thiệu</h3><p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-700">{doctor.biography}</p></div>}
        </section>
      )}
    </div>
  )
}
