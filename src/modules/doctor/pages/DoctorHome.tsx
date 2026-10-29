'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from '@/common/hooks/useNextNavigation'
import { useStaffLogout } from '@/common/hooks/useStaffLogout'
import {
  Calendar,
  Clock,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  User,
  Phone,
  MapPin,
  FileText,
  CreditCard,
  Building2,
  Loader2,
  Users,
  ChevronLeft,
  ChevronRight,
  DoorOpen,
  CalendarCheck,
  UserCheck,
} from 'lucide-react'
import {
  listDoctorAppointments,
  finishExamAppointment,
} from '@/modules/admin/services/appointments'
import DoctorWorkSchedulesPage from './DoctorWorkSchedulesPage'
import DoctorAppHeader from '../components/DoctorAppHeader'
import TelehealthSessionHistory from '../components/TelehealthSessionHistory'
import { getStaffSession, staffRole } from '@/modules/admin/utils/staffSession'
import { useAppointmentsSocket } from '@/modules/admin/hooks/useAppointmentsSocket'
import { appointmentDateRange, appointmentMethodCode, appointmentMethodLabel, appointmentState, BOOKING_METHOD_LABELS, shiftAppointmentDate, type AppointmentPeriod } from '../utils/appointmentFilters'

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function formatPatientAge(dob?: string) {
  if (!dob) return '—'
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return '—'
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const md = now.getMonth() - d.getMonth()
  if (md < 0 || (md === 0 && now.getDate() < d.getDate())) age -= 1
  return age >= 0 && age <= 120 ? `${age} tuổi` : String(d.getFullYear())
}

function formatGenderVi(gender?: string) {
  const g = String(gender || '').toLowerCase()
  if (g === 'male' || g === 'nam') return 'Nam'
  if (g === 'female' || g === 'nu' || g === 'nữ') return 'Nữ'
  return 'Khác'
}

function formatApptDateVi(val?: string) {
  if (!val) return '—'
  const d = new Date(val)
  if (Number.isNaN(d.getTime())) return String(val).slice(0, 10)
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`
}

function formatTimeOnly(timeStr?: string) {
  if (!timeStr) return '—'
  const s = String(timeStr).trim()
  if (s.includes('T')) {
    const d = new Date(s)
    if (!Number.isNaN(d.getTime())) return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  }
  return s.slice(0, 5)
}

function statusBadge(status?: string, workflowStatus?: string) {
  const st = String(status || '').toLowerCase()
  const wf = String(workflowStatus || '').toUpperCase()

  if (st === 'cancelled') {
    return (
      <span className="text-xs font-semibold text-rose-700 whitespace-nowrap">
        Đã hủy
      </span>
    )
  }
  if (st === 'examined' || st === 'completed' || wf === 'COMPLETED') {
    return (
      <span className="text-xs font-semibold text-emerald-700 whitespace-nowrap">
        Đã khám
      </span>
    )
  }
  if (wf === 'CHECKED_IN') {
    return (
      <span className="text-xs font-semibold text-blue-700 whitespace-nowrap">
        Đã tiếp nhận
      </span>
    )
  }
  if (st === 'confirmed' || wf === 'CONFIRMED') {
    return (
      <span className="text-xs font-semibold text-blue-700 whitespace-nowrap">
        Chờ khám
      </span>
    )
  }
  return (
    <span className="text-xs font-semibold text-amber-700 whitespace-nowrap">
      Chờ xử lý
    </span>
  )
}

function paymentBadge(payment?: any, invoice?: any) {
  const isPaid = payment?.paid === true || String(payment?.status || invoice?.status || '').toLowerCase() === 'paid'
  if (isPaid) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xl text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
        <CreditCard className="w-3 h-3 shrink-0" /> Đã thu phí
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xl text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
      <CreditCard className="w-3 h-3 shrink-0" /> Chưa thu phí
    </span>
  )
}

function isTelehealthDoctorAppt(item: any) {
  if (!item) return false
  return Boolean(
    item.isTelehealth ||
    item.bookingMethod?.code === 'ONLINE_CONSULTATION'
  )
}

function canFinishDoctorAppt(item: any) {
  if (isTelehealthDoctorAppt(item)) return false
  const status = String(item.workflowStatus || item.status || '').toUpperCase()
  return ['CHECKED_IN', 'IN_EXAMINATION'].includes(status)
}

export default function DoctorHome() {
  const { performLogout } = useStaffLogout()
  const navigate = useNavigate()
  const location = useLocation()
  const session = getStaffSession()
  const token = session?.token
  const user = session?.user
  const role = staffRole(user)

  const isHistoryView = location.search.includes('view=history')
  const isScheduleView = location.search.includes('view=schedule')
  const isWaitingView = location.search.includes('view=waiting')

  // State Appointments
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [period, setPeriod] = useState<AppointmentPeriod>('all')
  const [dateFilter, setDateFilter] = useState(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()))
  const [methodFilter, setMethodFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('') // '' = all statuses
  const [page, setPage] = useState(1)
  const pageSize = 10
  const dateRange = useMemo(() => appointmentDateRange(period, dateFilter), [period, dateFilter])
  const methodOptions = useMemo(() => {
    const labels = new Map(Object.entries(BOOKING_METHOD_LABELS))
    appointments.forEach(item => {
      const code = appointmentMethodCode(item)
      if (code && !labels.has(code)) labels.set(code, appointmentMethodLabel(item))
    })
    return [...labels.entries()]
  }, [appointments])

  useEffect(() => { setPage(1) }, [period, dateFilter, methodFilter, searchTerm, statusFilter, isHistoryView, isWaitingView])

  const selectStatsStatus = (status: string) => {
    setStatusFilter(status)
    setPage(1)
    if (isHistoryView || isWaitingView) navigate('/doctor')
  }

  // Modal chi tiết
  const [detailAppt, setDetailAppt] = useState<any | null>(null)
  const [finishingId, setFinishingId] = useState<string | null>(null)

  const handleFinishExam = async (item: any) => {
    if (!canFinishDoctorAppt(item)) return
    const patientName = item.patient?.fullName || 'bệnh nhân'
    if (!window.confirm(`Xác nhận hoàn thành lượt khám cho ${patientName}?`)) {
      return
    }
    setFinishingId(item.id)
    try {
      await finishExamAppointment({ appointmentId: item.id })
      if (detailAppt?.id === item.id) {
        setDetailAppt(null)
      }
      await loadAppointments({ silent: true })
    } catch (err: any) {
      alert(err?.message || 'Không thể hoàn thành lượt khám.')
    } finally {
      setFinishingId(null)
    }
  }

  // Redirect if not doctor
  useEffect(() => {
    if (!token || !user) {
      navigate('/login', { replace: true })
    } else if (role !== 'doctor' && role !== 'admin') {
      navigate('/dashboard', { replace: true })
    }
  }, [token, user, role, navigate])

  const loadAppointments = useCallback(
    async ({ silent = false } = {}) => {
      if (!token) return
      if (!silent) setLoading(true)
      if (silent) setRefreshing(true)
      try {
        const rows = await listDoctorAppointments()
        setAppointments(Array.isArray(rows) ? rows : [])
        setError('')
      } catch (err: any) {
        setError(err?.message || 'Không thể tải lịch khám của bác sĩ.')
      } finally {
        if (!silent) setLoading(false)
        setRefreshing(false)
      }
    },
    [token],
  )

  useEffect(() => {
    if (!isScheduleView) {
      void loadAppointments({ silent: false })
    }
  }, [isScheduleView, loadAppointments])

  // Lắng nghe realtime
  useAppointmentsSocket({
    enabled: Boolean(token && role === 'doctor'),
    onAppointmentBooked: useCallback(() => {
      void loadAppointments({ silent: true })
    }, [loadAppointments]),
    onStatusChanged: useCallback(() => {
      void loadAppointments({ silent: true })
    }, [loadAppointments]),
  })

  const scopedAppointments = useMemo(() => appointments.filter(item => {
      const date = String(item.appointmentDate || '').slice(0, 10)
      if (dateRange.from && (!date || date < dateRange.from || date > dateRange.to)) return false
      if (methodFilter && appointmentMethodCode(item) !== methodFilter) return false

      return true
    }), [appointments, dateRange, methodFilter])

  const filteredList = useMemo(() => {
    const selectedStatus = isHistoryView ? 'COMPLETED' : isWaitingView ? 'CHECKED_IN' : statusFilter
    const q = searchTerm.trim().toLowerCase()
    const list = scopedAppointments.filter(item => {
      if (selectedStatus && appointmentState(item) !== selectedStatus) return false
      if (q) {
        const ticket = String(item.ticket || item.bookingCode || '').toLowerCase()
        const patientName = String(item.patient?.fullName || '').toLowerCase()
        const patientCode = String(item.patient?.patientCode || '').toLowerCase()
        const phone = String(item.patient?.phone || '').toLowerCase()
        const match =
          ticket.includes(q) || patientName.includes(q) || patientCode.includes(q) || phone.includes(q)
        if (!match) return false
      }

      return true
    })

    if (isHistoryView) {
      return [...list].sort((a, b) => {
        const dateOrder = String(b.appointmentDate || '').localeCompare(String(a.appointmentDate || ''))
        if (dateOrder) return dateOrder
        const timeOrder = String(b.startTime || '').localeCompare(String(a.startTime || ''))
        if (timeOrder) return timeOrder
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
      })
    }

    if (isWaitingView) {
      // Ưu tiên sắp xếp danh sách chờ khám:
      // 1. Thời gian check-in tại quầy (checkedInAt) tăng dần (ai check-in trước khám trước)
      // 2. Số thứ tự khám (visitQueueNumber / queueNumber)
      // 3. Khung giờ khám (startTime)
      return [...list].sort((a, b) => {
        const dateOrder = String(a.appointmentDate || '').localeCompare(String(b.appointmentDate || ''))
        if (dateOrder) return dateOrder
        if (isTelehealthDoctorAppt(a) || isTelehealthDoctorAppt(b)) {
          const timeOrder = String(a.startTime || '').localeCompare(String(b.startTime || ''))
          if (timeOrder) return timeOrder
        }
        if (a.checkedInAt && b.checkedInAt) {
          const tA = new Date(a.checkedInAt).getTime()
          const tB = new Date(b.checkedInAt).getTime()
          if (tA !== tB) return tA - tB
        } else if (a.checkedInAt && !b.checkedInAt) {
          return -1
        } else if (!a.checkedInAt && b.checkedInAt) {
          return 1
        }

        const qA = Number(a.visitQueueNumber || a.queueNumber || 999999)
        const qB = Number(b.visitQueueNumber || b.queueNumber || 999999)
        if (qA !== qB) return qA - qB

        const timeA = String(a.startTime || '99:99')
        const timeB = String(b.startTime || '99:99')
        return timeA.localeCompare(timeB)
      })
    }

    return list
  }, [scopedAppointments, isHistoryView, isWaitingView, statusFilter, searchTerm])

  // Phân trang
  const totalPages = Math.max(1, Math.ceil(filteredList.length / pageSize))
  useEffect(() => { setPage(current => Math.min(current, totalPages)) }, [totalPages])
  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredList.slice(start, start + pageSize)
  }, [filteredList, page, pageSize])

  // Thống kê theo thời gian và hình thức khám, độc lập với tìm kiếm và trạng thái của bảng.
  const stats = useMemo(() => {
    const count = (status: string) => scopedAppointments.filter(item => appointmentState(item) === status).length
    return { total: scopedAppointments.length, pending: count('PENDING'), checkedIn: count('CHECKED_IN'), completed: count('COMPLETED'), cancelled: count('CANCELLED') }
  }, [scopedAppointments])
  const activeStatsStatus = isHistoryView ? 'COMPLETED' : isWaitingView ? 'CHECKED_IN' : statusFilter

  if (!token || !user) return null

  const activeHeaderTab = isHistoryView
    ? 'history'
    : isScheduleView
      ? 'schedule'
      : isWaitingView
        ? 'waiting'
        : 'calendar'

  return (
    <div className="min-h-screen bg-[#f5f8f5] relative text-slate-800">
      <DoctorAppHeader
        activeTab={activeHeaderTab}
        user={user}
        onLogout={() => void performLogout()}
      />

      <main className="min-w-0 p-4 sm:p-6 max-w-[1600px] mx-auto w-full space-y-5 lg:pl-[264px]" role="main">
        {/* Tiêu đề trang & Tác vụ chính */}
        {!isScheduleView ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded border border-slate-200/90 shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <span className={`p-2 rounded-xl border shrink-0 ${isWaitingView
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}>
                  {isHistoryView ? (
                    <Users className="w-5 h-5" />
                  ) : isWaitingView ? (
                    <UserCheck className="w-5 h-5 text-blue-700" />
                  ) : (
                    <CalendarCheck className="w-5 h-5" />
                  )}
                </span>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                    {isHistoryView
                      ? 'Lịch sử bệnh nhân'
                      : isWaitingView
                        ? 'Chờ khám bệnh'
                        : 'Lịch khám của bác sĩ'}
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isHistoryView
                      ? 'Danh sách bệnh nhân đã hoàn tất khám tại cơ sở hoặc tư vấn trực tuyến.'
                      : isWaitingView
                        ? 'Ca khám tại cơ sở đã tiếp nhận và lịch tư vấn online đã xác nhận. Lọc ngày để xem lịch cần xử lý.'
                        : 'Danh sách toàn bộ lịch hẹn khám bệnh của bác sĩ.'}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                onClick={() => void loadAppointments({ silent: true })}
                disabled={refreshing}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                <span>{refreshing ? 'Đang làm mới…' : 'Làm mới'}</span>
              </button>
            </div>
          </div>
        ) : null}

        {/* Thông báo lỗi nếu có */}
        {!isScheduleView && error ? (
          <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs shadow-2xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {/* ============================================================ */}
        {/* VIEW 1: LỊCH LÀM VIỆC (VIEW === 'schedule') */}
        {/* ============================================================ */}
        {isScheduleView ? (
          <DoctorWorkSchedulesPage
            isDoctorRole={true}
            readOnly={true}
            initialDoctorId={user?.doctor?.id || user?.doctorId || user?.id}
          />
        ) : (
          /* ============================================================ */
          /* VIEW 2 & 3: LỊCH KHÁM (CHECKED-IN) & LỊCH SỬ BỆNH NHÂN */
          /* ============================================================ */
          <div className="min-w-0 space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {[
                { status: '', title: 'Tổng lịch', value: stats.total, description: 'Bấm để xem tất cả', surface: 'bg-white', border: 'border-slate-200 hover:border-slate-300', selectedBorder: 'border-slate-400', color: 'text-slate-900' },
                { status: 'PENDING', title: 'Chờ xác nhận', value: stats.pending, description: 'Chưa tiếp nhận / chờ xử lý', surface: 'bg-amber-50/30', border: 'border-amber-200 hover:border-amber-300', selectedBorder: 'border-amber-400', color: 'text-amber-800' },
                { status: 'CHECKED_IN', title: 'Đang chờ khám', value: stats.checkedIn, description: 'Đã tiếp nhận / tư vấn online', surface: 'bg-blue-50/35', border: 'border-blue-200 hover:border-blue-300', selectedBorder: 'border-blue-400', color: 'text-blue-800' },
                { status: 'COMPLETED', title: 'Đã khám', value: stats.completed, description: 'Hoàn thành ca khám', surface: 'bg-emerald-50/40', border: 'border-emerald-200 hover:border-emerald-300', selectedBorder: 'border-emerald-400', color: 'text-emerald-800' },
                { status: 'CANCELLED', title: 'Đã hủy', value: stats.cancelled, description: 'Lịch hẹn đã hủy', surface: 'bg-slate-50/70', border: 'border-slate-200 hover:border-slate-300', selectedBorder: 'border-slate-400', color: 'text-slate-600' },
              ].map(card => (
                <button key={card.status} type="button" onClick={() => selectStatsStatus(card.status)} aria-pressed={activeStatsStatus === card.status}
                  className={`flex h-full min-w-0 flex-col rounded border px-4 py-3 text-left outline-none transition-colors duration-150 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600/60 cursor-pointer ${card.surface} ${activeStatsStatus === card.status ? card.selectedBorder : card.border}`}>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{card.title}</p>
                  <p className={`mt-1 text-2xl font-bold leading-7 tabular-nums ${card.color}`}>{card.value}</p>
                  <p className="mt-1 text-[11px] leading-4 text-slate-400">{card.description}</p>
                </button>
              ))}
            </div>

            {/* Danh sách lịch khám & Bộ lọc */}
            <div className="min-w-0 max-w-full bg-white rounded border border-slate-200/90 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <h2 className="min-w-0 text-sm font-bold text-slate-900">
                  {isHistoryView
                    ? 'Danh sách bệnh nhân đã khám'
                    : isWaitingView
                      ? 'Danh sách chờ khám / tư vấn online'
                      : statusFilter === 'CHECKED_IN'
                        ? 'Danh sách chờ khám / tư vấn online'
                        : statusFilter === 'COMPLETED'
                          ? 'Danh sách bệnh nhân đã khám xong'
                          : statusFilter === 'CANCELLED'
                            ? 'Danh sách lịch hẹn đã hủy'
                            : statusFilter === 'PENDING'
                              ? 'Danh sách lịch hẹn chờ xác nhận'
                            : 'Danh sách toàn bộ lịch khám'}
                </h2>
                <span className="text-xs text-slate-500 whitespace-nowrap">
                  Tổng số: <b>{filteredList.length}</b> lịch hẹn
                </span>
              </div>

              {/* Thanh tìm kiếm & Bộ lọc */}
              <div className="space-y-4 border-b border-slate-200/80 p-4">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    setPage(1)
                  }}
                  placeholder="Tìm theo tên bệnh nhân, mã vé, mã BN, số điện thoại..."
                  aria-label="Tìm kiếm lịch khám"
                  className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 transition-all placeholder:text-slate-400"
                />
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-0 max-w-full">
                  <p className="mb-1.5 text-[11px] font-semibold text-slate-500">Thời gian khám</p>
                  <div className="inline-flex max-w-full flex-wrap rounded border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Khoảng thời gian">
                    {([['all', 'Tất cả'], ['day', 'Ngày'], ['week', 'Tuần'], ['month', 'Tháng']] as const).map(([value, label]) => (
                      <button key={value} type="button" aria-pressed={period === value} onClick={() => setPeriod(value)}
                        className={`rounded px-3 py-1.5 text-xs font-semibold cursor-pointer ${period === value ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{label}</button>
                    ))}
                  </div>
                </div>
                {period !== 'all' && <div>
                  <label htmlFor="doctor-period-date" className="mb-1.5 block text-[11px] font-semibold text-slate-500">{period === 'month' ? 'Chọn tháng' : period === 'week' ? 'Chọn ngày trong tuần' : 'Chọn ngày'}</label>
                  <div className="flex h-10 items-center rounded border border-slate-200 bg-white">
                    <button type="button" aria-label="Khoảng thời gian trước" onClick={() => setDateFilter(shiftAppointmentDate(dateFilter, period, -1))} className="h-full px-2 text-slate-500 hover:bg-slate-50 cursor-pointer"><ChevronLeft className="h-4 w-4" /></button>
                    <input id="doctor-period-date" type={period === 'month' ? 'month' : 'date'} value={period === 'month' ? dateFilter.slice(0, 7) : dateFilter}
                      onChange={event => {
                        if (!event.target.value) { setPeriod('all'); return }
                        setDateFilter(period === 'month' ? `${event.target.value}-01` : event.target.value)
                      }} className="min-w-0 bg-transparent px-1 text-xs text-slate-700 outline-none" />
                    <button type="button" aria-label="Khoảng thời gian sau" onClick={() => setDateFilter(shiftAppointmentDate(dateFilter, period, 1))} className="h-full px-2 text-slate-500 hover:bg-slate-50 cursor-pointer"><ChevronRight className="h-4 w-4" /></button>
                  </div>
                </div>}
                <label className="w-full min-w-0 sm:min-w-[190px] sm:flex-1 sm:max-w-[250px]">
                  <span className="mb-1.5 block text-[11px] font-semibold text-slate-500">Hình thức khám</span>
                  <select value={methodFilter} onChange={event => setMethodFilter(event.target.value)} className="h-10 w-full rounded border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-emerald-600 cursor-pointer">
                    <option value="">Tất cả hình thức</option>
                    {methodOptions.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                  </select>
                </label>
                {/* Lọc trạng thái nhanh (chỉ hiển thị ở tab Lịch khám chung) */}
                {!isHistoryView && !isWaitingView && (
                  <label className="w-full min-w-0 sm:w-auto">
                  <span className="mb-1.5 block text-[11px] font-semibold text-slate-500">Trạng thái</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value)
                      setPage(1)
                    }}
                    className="h-10 w-full px-3 text-xs bg-white border border-slate-200 rounded text-slate-700 focus:outline-none focus:border-emerald-600 cursor-pointer"
                  >
                    <option value="">Tất cả trạng thái</option>
                    <option value="PENDING">Chờ xác nhận</option>
                    <option value="CHECKED_IN">Đang chờ khám / tư vấn</option>
                    <option value="COMPLETED">Đã khám</option>
                    <option value="CANCELLED">Đã hủy</option>
                  </select>
                  </label>
                )}
                {(period !== 'all' || methodFilter || searchTerm || statusFilter) && <button type="button" onClick={() => { setPeriod('all'); setMethodFilter(''); setSearchTerm(''); setStatusFilter('') }} className="inline-flex h-10 items-center gap-1.5 px-2 text-xs font-semibold text-slate-500 hover:text-emerald-700 cursor-pointer"><X className="h-3.5 w-3.5" />Xóa bộ lọc</button>}
              </div>
              </div>

              {/* Bảng danh sách lịch khám */}
              <div className="w-full overflow-x-auto overscroll-x-contain" tabIndex={0} role="region" aria-label="Danh sách lịch khám, cuộn ngang để xem đầy đủ các cột">
                <table className={`w-full table-fixed text-left text-xs border-collapse ${!isWaitingView && !isHistoryView ? 'min-w-[1120px]' : 'min-w-[1000px]'}`}>
                  <colgroup>
                    <col className="w-12" />
                    <col className="w-[190px]" />
                    <col className="w-[210px]" />
                    <col className="w-[140px]" />
                    <col />
                    {!isWaitingView && !isHistoryView && <col className="w-[120px]" />}
                    <col className="w-[248px]" />
                  </colgroup>
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-600 font-bold whitespace-nowrap">
                      <th className="py-2.5 px-3 text-center">STT</th>
                      <th className="py-2.5 px-3">Mã phiếu</th>
                      <th className="py-2.5 px-3">Bệnh nhân</th>
                      <th className="py-2.5 px-3">Thời gian khám</th>
                      <th className="py-2.5 px-3">Triệu chứng / Ghi chú</th>
                      {!isWaitingView && !isHistoryView && (
                        <th className="py-2.5 px-3">Trạng thái</th>
                      )}
                      <th className="py-2.5 px-3 text-right whitespace-nowrap">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={!isWaitingView && !isHistoryView ? 7 : 6} className="py-12 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Loader2 className="w-6 h-6 animate-spin text-emerald-700" />
                            <span>Đang tải danh sách lịch khám…</span>
                          </div>
                        </td>
                      </tr>
                    ) : pagedRows.length === 0 ? (
                      <tr>
                        <td colSpan={!isWaitingView && !isHistoryView ? 7 : 6} className="py-12 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <span className="font-medium">Không tìm thấy lịch khám phù hợp.</span>
                            <span className="text-[11px] text-slate-400">
                              {isWaitingView
                                ? 'Hiện không có bệnh nhân nào đang chờ khám.'
                                : 'Ca khám tại cơ sở cần được tiếp nhận; lịch online cần được xác nhận.'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      pagedRows.map((item, idx) => {
                        const stt = (page - 1) * pageSize + idx + 1
                        const patient = item.patient
                        const st = String(item.status || '').toLowerCase()
                        const wf = String(item.workflowStatus || '').toUpperCase()
                        const canFinish = canFinishDoctorAppt(item)

                        return (
                          <tr key={item.id || idx} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-2.5 px-3 text-center font-semibold text-slate-500 whitespace-nowrap">
                              {stt}
                            </td>
                            <td className="py-2.5 px-3 align-middle">
                              <span className="font-bold text-slate-900 block truncate" title={item.ticket || item.bookingCode}>{item.ticket || item.bookingCode || '—'}</span>
                              <span className="text-[10px] text-slate-500 font-medium block truncate" title={appointmentMethodLabel(item)}>{appointmentMethodLabel(item)}</span>
                              {!isTelehealthDoctorAppt(item) && item.visitQueueNumber ? (
                                <span className="text-[10px] text-emerald-700 font-semibold block">
                                  STT khám: {item.visitQueueNumber}
                                </span>
                              ) : null}
                            </td>
                            <td className="py-2.5 px-3 align-middle">
                              <span className="font-bold text-slate-900 block truncate" title={patient?.fullName}>{patient?.fullName || '—'}</span>
                              <span className="text-[11px] text-slate-500 block truncate" title={`${formatGenderVi(patient?.gender)} · ${formatPatientAge(patient?.dateOfBirth)} · ${patient?.phone || '—'}`}>
                                {formatGenderVi(patient?.gender)} · {formatPatientAge(patient?.dateOfBirth)} · {patient?.phone || '—'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className="font-bold text-slate-800 block">
                                {item.startTime ? `${item.startTime}${item.endTime ? ` - ${item.endTime}` : ''}` : '—'}
                              </span>
                              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                                {formatApptDateVi(item.appointmentDate)}
                              </span>
                              {item.checkedInAt ? (
                                <span className="text-[10px] text-blue-700 font-semibold flex items-center gap-1 mt-0.5">
                                  Check-in: {new Date(item.checkedInAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              ) : null}
                            </td>
                            <td className="py-2.5 px-3 align-middle">
                              <p className="text-slate-600 line-clamp-2 break-words [overflow-wrap:anywhere]" title={item.symptoms || 'Khám theo lịch hẹn'}>
                                {item.symptoms || 'Khám theo lịch hẹn'}
                              </p>
                            </td>
                            {!isWaitingView && !isHistoryView && (
                              <td className="py-2.5 px-3 whitespace-nowrap">{statusBadge(item.status, item.workflowStatus)}</td>
                            )}
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <div className="flex flex-nowrap items-center justify-end gap-1.5">
                                {isTelehealthDoctorAppt(item) && ['CONFIRMED', 'CHECKED_IN', 'IN_EXAMINATION'].includes(wf || st.toUpperCase()) && (
                                  <button
                                    type="button"
                                    className="inline-flex shrink-0 items-center justify-center px-2.5 py-1.5 rounded text-xs font-bold text-white bg-blue-700  cursor-pointer whitespace-nowrap shadow-xs"
                                    onClick={() => navigate(`/doctor/telehealth/${item.id}`)}
                                    title="Vào phòng khám trực tuyến với bệnh nhân này"
                                  >
                                    <span>Vào phòng khám</span>
                                  </button>
                                )}
                                {canFinish && (
                                  <button
                                    type="button"
                                    disabled={finishingId === item.id}
                                    className="inline-flex shrink-0 items-center justify-center px-3 py-1.5 rounded border border-blue-700 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 hover:border-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap shadow-xs"
                                    onClick={() => void handleFinishExam(item)}
                                    title="Hoàn thành khám cho bệnh nhân này"
                                  >
                                    <span>{finishingId === item.id ? 'Đang lưu…' : 'Hoàn thành khám'}</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="inline-flex items-center justify-center px-2.5 py-1.5 rounded text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200/90 shadow-2xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
                                  onClick={() => setDetailAppt(item)}
                                  title="Xem chi tiết phiếu khám"
                                >
                                  <span>Chi tiết</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Phân trang */}
              {totalPages > 1 ? (
                <div className="p-3.5 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Trang {page} / {totalPages}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="px-3 py-1 rounded text-xs font-bold border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Trước
                    </button>
                    <button
                      type="button"
                      className="px-3 py-1 rounded text-xs font-bold border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Sau
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </main>

      {/* MODAL CHI TIẾT PHIẾU KHÁM */}
      {detailAppt ? (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setDetailAppt(null)}
        >
          <div
            className="bg-white rounded border border-slate-200 shadow-xl max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto break-words [overflow-wrap:anywhere]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Chi tiết lịch khám bệnh"
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Chi tiết lịch khám bệnh</h3>
                <p className="text-xs text-slate-500">Mã vé: <b className="text-slate-800">{detailAppt.ticket || detailAppt.bookingCode}</b></p>
              </div>
              <button
                type="button"
                className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                onClick={() => setDetailAppt(null)}
                aria-label="Đóng chi tiết lịch khám"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Thông tin bệnh nhân */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-700" /> Thông tin bệnh nhân
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-xs pt-1">
                <div>
                  <span className="text-slate-500 block">Họ và tên:</span>
                  <b className="text-slate-900">{detailAppt.patient?.fullName || '—'}</b>
                </div>
                <div>
                  <span className="text-slate-500 block">Mã bệnh nhân:</span>
                  <b className="text-slate-900">{detailAppt.patient?.patientCode || '—'}</b>
                </div>
                <div>
                  <span className="text-slate-500 block">Giới tính / Tuổi:</span>
                  <span className="text-slate-800 font-medium">
                    {formatGenderVi(detailAppt.patient?.gender)} · {formatPatientAge(detailAppt.patient?.dateOfBirth)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Số điện thoại:</span>
                  <span className="text-slate-800 font-medium flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" /> {detailAppt.patient?.phone || '—'}
                  </span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-500 block">Địa chỉ:</span>
                  <span className="text-slate-800 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" /> {detailAppt.patient?.address || '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Thông tin ca khám */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-700" /> Ca khám & Phòng khám
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-xs pt-1">
                <div>
                  <span className="text-slate-500 block">Ngày khám:</span>
                  <b className="text-slate-900">{formatApptDateVi(detailAppt.appointmentDate)}</b>
                </div>
                <div>
                  <span className="text-slate-500 block">Khung giờ:</span>
                  <b className="text-slate-900">{detailAppt.startTime || '—'} - {detailAppt.endTime || '—'}</b>
                </div>
                <div>
                  <span className="text-slate-500 block">Phòng khám:</span>
                  <span className="text-slate-800 font-medium">{detailAppt.clinicRoomName || detailAppt.clinicRoom || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Cơ sở:</span>
                  <span className="text-slate-800 font-medium flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-slate-400" /> {detailAppt.branch?.name || 'VitaCare Clinic'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Bác sĩ phụ trách:</span>
                  <span className="text-emerald-800 font-bold">{detailAppt.doctor?.fullName || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Trạng thái:</span>
                  <div className="mt-0.5">{statusBadge(detailAppt.status, detailAppt.workflowStatus)}</div>
                </div>
              </div>
            </div>

            {/* Triệu chứng & Lý do khám */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-emerald-700" /> Triệu chứng ban đầu
              </h4>
              <div className="pt-1 whitespace-pre-wrap text-xs text-slate-700 font-medium">
                {detailAppt.symptoms || 'Bệnh nhân chưa cung cấp triệu chứng cụ thể.'}
              </div>
            </div>

            {isTelehealthDoctorAppt(detailAppt) && appointmentState(detailAppt) === 'COMPLETED' ? (
              <TelehealthSessionHistory key={detailAppt.id} appointmentId={detailAppt.id} />
            ) : null}

            {/* Footer Modal */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                className="px-4 py-2 text-xs font-bold rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs transition-colors cursor-pointer"
                onClick={() => setDetailAppt(null)}
              >
                Đóng
              </button>
              {(() => {
                if (!canFinishDoctorAppt(detailAppt)) return null
                return (
                  <button
                    type="button"
                    disabled={finishingId === detailAppt.id}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded border border-blue-700 text-white bg-blue-700 hover:bg-blue-800 hover:border-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-xs transition-colors cursor-pointer"
                    onClick={async () => {
                      await handleFinishExam(detailAppt)
                    }}
                  >
                    {finishingId === detailAppt.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>Hoàn thành khám</span>
                  </button>
                )
              })()}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
