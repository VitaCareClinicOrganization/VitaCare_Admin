'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, CheckCircle2, Clock3, FileText, Loader2, MapPin, Search, Stethoscope, Users, Video } from 'lucide-react'
import { appointmentMethodLabel, appointmentState, shiftAppointmentDate } from '../utils/appointmentFilters'

type QueueAppointment = {
  id: string
  appointmentDate?: string
  startTime?: string
  endTime?: string
  checkedInAt?: string
  queueNumber?: number
  visitQueueNumber?: number
  status?: string
  workflowStatus?: string
  isTelehealth?: boolean
  bookingMethod?: { code?: string; name?: string }
  bookingCode?: string
  ticket?: string
  symptoms?: string
  clinicRoomName?: string
  servicePackage?: { name?: string }
  branch?: { name?: string }
  patient?: { fullName?: string; patientCode?: string; phone?: string; gender?: string; dateOfBirth?: string; address?: string; nationalId?: string; healthInsuranceNumber?: string }
}

const vietnamDay = (now: number) => new Date(now + 7 * 3_600_000).toISOString().slice(0, 10)
const online = (item: QueueAppointment) => item.isTelehealth || item.bookingMethod?.code === 'ONLINE_CONSULTATION'
const workflow = (item: QueueAppointment) => String(item.workflowStatus || item.status || '').toUpperCase()
const queueNumber = (item: QueueAppointment) => {
  const number = Number(item.visitQueueNumber ?? item.queueNumber)
  return Number.isFinite(number) && number > 0 ? number : null
}
const timeLabel = (value?: string) => value?.slice(0, 5) || '—'
const checkInTime = (value?: string) => value && Number.isFinite(Date.parse(value))
  ? new Date(value).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' }) : '—'

function entryWindow(item: QueueAppointment, now: number) {
  const date = item.appointmentDate?.slice(0, 10)
  const start = date && item.startTime ? Date.parse(`${date}T${item.startTime.slice(0, 5)}:00+07:00`) : NaN
  const end = date && item.endTime ? Date.parse(`${date}T${item.endTime.slice(0, 5)}:00+07:00`) : NaN
  if (!Number.isFinite(start) || !Number.isFinite(end)) return { allowed: false, label: 'Chưa xác định giờ tư vấn' }
  if (now >= end) return { allowed: false, label: 'Đã hết giờ tư vấn' }
  if (now < start - 15 * 60_000) return { allowed: false, label: 'Phòng mở trước giờ hẹn 15 phút' }
  return { allowed: true, label: 'Có thể vào phòng' }
}

function demographics(item: QueueAppointment) {
  const patient = item.patient
  const gender = patient?.gender === 'male' ? 'Nam' : patient?.gender === 'female' ? 'Nữ' : ''
  const birth = patient?.dateOfBirth ? new Date(patient.dateOfBirth) : null
  const today = new Date()
  let age = birth && Number.isFinite(birth.getTime()) ? today.getFullYear() - birth.getFullYear() : null
  if (birth && age !== null && (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate()))) age--
  return [gender, age !== null && age >= 0 ? `${age} tuổi` : '', patient?.phone].filter(Boolean).join(' · ') || 'Chưa có thông tin liên hệ'
}

export default function DoctorWaitingQueue({ appointments, loading, finishingId, onFinish, onEnterRoom, onOpenCalendar }: {
  appointments: QueueAppointment[]
  loading: boolean
  finishingId: string | null
  onFinish: (item: QueueAppointment) => Promise<void>
  onEnterRoom: (id: string) => void
  onOpenCalendar: () => void
}) {
  const [now, setNow] = useState(() => Date.now())
  const [chosenDate, setChosenDate] = useState('')
  const [tab, setTab] = useState<'onsite' | 'online'>('onsite')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState('')
  useEffect(() => {
    const update = () => setNow(Date.now())
    const timer = window.setInterval(update, 30_000)
    window.addEventListener('focus', update)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update) }
  }, [])

  const today = vietnamDay(now)
  const date = chosenDate || today
  const dayAppointments = useMemo(() => appointments.filter(item => item.appointmentDate?.slice(0, 10) === date), [appointments, date])
  const onsite = dayAppointments.filter(item => !online(item) && workflow(item) === 'CHECKED_IN')
  const remote = dayAppointments.filter(item => online(item) && ['CONFIRMED', 'CHECKED_IN'].includes(workflow(item)))
  const completed = dayAppointments.filter(item => appointmentState(item) === 'COMPLETED').length
  const visible = (tab === 'onsite' ? onsite : remote).filter(item => {
    const value = query.trim().toLocaleLowerCase('vi-VN')
    return !value || [item.patient?.fullName, item.patient?.patientCode, item.patient?.phone, item.ticket, item.bookingCode]
      .some(field => field?.toLocaleLowerCase('vi-VN').includes(value))
  }).sort((a, b) => {
    if (tab === 'online') return String(a.startTime || '').localeCompare(String(b.startTime || '')) || a.id.localeCompare(b.id)
    const order = (queueNumber(a) ?? Number.MAX_SAFE_INTEGER) - (queueNumber(b) ?? Number.MAX_SAFE_INTEGER)
    return order || String(a.checkedInAt || '').localeCompare(String(b.checkedInAt || '')) || String(a.startTime || '').localeCompare(String(b.startTime || '')) || a.id.localeCompare(b.id)
  })
  const selected = visible.find(item => item.id === selectedId) || visible[0] || null
  const entry = selected && online(selected) ? entryWindow(selected, now) : null
  const chooseDate = (value: string) => { setChosenDate(value === today ? '' : value); setSelectedId('') }
  const focusClass = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#218838]'

  return <section className="space-y-4" aria-label="Hàng đợi khám bệnh">
    <div className="flex flex-wrap items-center justify-between gap-4 rounded border border-slate-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <CalendarDays aria-hidden="true" className="mr-1 h-4 w-4 text-slate-500" />
        <button type="button" aria-label="Ngày trước" onClick={() => chooseDate(shiftAppointmentDate(date, 'day', -1))} className={`grid h-9 w-9 place-items-center rounded text-slate-600 hover:bg-slate-100 ${focusClass}`}><ChevronLeft className="h-4 w-4" /></button>
        <input type="date" aria-label="Ngày xem hàng đợi" value={date} onChange={event => chooseDate(event.target.value)} className={`h-10 rounded border border-slate-200 bg-white px-2 text-sm text-slate-800 ${focusClass}`} />
        <button type="button" aria-label="Ngày sau" onClick={() => chooseDate(shiftAppointmentDate(date, 'day', 1))} className={`grid h-9 w-9 place-items-center rounded text-slate-600 hover:bg-slate-100 ${focusClass}`}><ChevronRight className="h-4 w-4" /></button>
        <button type="button" onClick={() => chooseDate(today)} className={`min-h-10 rounded px-3 text-sm font-medium ${date === today ? 'bg-[#28a745]/10 text-[#218838]' : 'text-slate-600 hover:bg-slate-100'} ${focusClass}`}>Hôm nay</button>
      </div>
      <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {[['Đang chờ', onsite.length], ['Đã khám', completed], ['Lịch online', remote.length]].map(([label, count]) => <div key={label} className="flex items-baseline gap-2"><dt className="text-slate-500">{label}</dt><dd className="font-semibold tabular-nums text-slate-900">{loading ? '—' : count}</dd></div>)}
      </dl>
    </div>

    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="min-w-0 overflow-hidden rounded border border-slate-200 bg-white">
        <div className="flex gap-1 border-b border-slate-200 p-1" role="group" aria-label="Hình thức khám">
          {([['onsite', 'Tại cơ sở', onsite.length], ['online', 'Tư vấn online', remote.length]] as const).map(([value, label, count]) => <button key={value} type="button" aria-pressed={tab === value} onClick={() => { setTab(value); setSelectedId('') }} className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded px-3 text-sm font-semibold transition-colors ${tab === value ? 'bg-[#28a745]/5 text-[#218838]' : 'text-slate-500 hover:bg-slate-50'} ${focusClass}`}>
            {value === 'onsite' ? <Users aria-hidden="true" className="h-4 w-4" /> : <Video aria-hidden="true" className="h-4 w-4" />}{label}<span className="text-xs tabular-nums">{loading ? '—' : count}</span>
          </button>)}
        </div>
        <div className="p-3">
          <div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><input aria-label="Tìm bệnh nhân trong hàng đợi" placeholder="Tên, mã bệnh nhân, mã vé, số điện thoại…" value={query} onChange={event => setQuery(event.target.value)} className={`h-10 w-full min-w-0 rounded border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm placeholder:text-slate-500 ${focusClass}`} /></div>
          <div className="mt-3 flex items-center justify-between px-1 text-xs text-slate-500"><span>{tab === 'onsite' ? 'Theo số thứ tự khám' : 'Theo giờ hẹn'}</span><span>{loading ? 'Đang tải…' : `${visible.length} bệnh nhân`}</span></div>
        </div>
        <div className="max-h-[520px] overflow-y-auto overscroll-contain border-t border-slate-100 lg:max-h-[calc(100dvh-23rem)]">
          {loading ? <div role="status" className="space-y-3 p-4"><span className="sr-only">Đang tải hàng đợi</span>{[1, 2, 3].map(index => <div key={index} className="h-24 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />)}</div> : !visible.length ? <div role="status" className="px-5 py-14 text-center"><Users aria-hidden="true" className="mx-auto mb-3 h-7 w-7 text-slate-400" /><p className="text-sm font-medium text-slate-700">{query ? 'Không tìm thấy bệnh nhân phù hợp' : tab === 'onsite' ? 'Chưa có bệnh nhân chờ khám' : 'Chưa có lịch tư vấn online'}</p><p className="mt-2 text-xs leading-5 text-slate-500">{query ? 'Thử tìm bằng tên hoặc mã bệnh nhân khác.' : tab === 'onsite' ? 'Bệnh nhân xuất hiện sau khi nhân viên xác nhận tiếp nhận trong ngày đã chọn.' : 'Chọn ngày khác hoặc xem toàn bộ lịch khám.'}</p></div> : visible.map((item, index) => {
            const active = selected?.id === item.id
            const minutes = item.checkedInAt ? Math.floor((now - Date.parse(item.checkedInAt)) / 60_000) : NaN
            return <button key={item.id} type="button" aria-pressed={active} onClick={() => setSelectedId(item.id)} className={`flex w-full items-start gap-3 border-b border-slate-100 p-4 text-left transition-colors last:border-b-0 ${active ? 'bg-[#28a745]/[0.07]' : 'bg-white hover:bg-slate-50'} ${focusClass}`}>
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded text-xl font-semibold tabular-nums ${active ? 'bg-[#28a745] text-white' : 'bg-slate-100 text-slate-600'}`}>{tab === 'online' ? <Video aria-hidden="true" className="h-5 w-5" /> : queueNumber(item) ?? '—'}</span>
              <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="break-words text-sm font-semibold text-slate-900">{item.patient?.fullName || 'Chưa có tên'}</span>{index === 0 && tab === 'onsite' && !query.trim() && <span className="text-[11px] font-medium text-[#218838]">Tiếp theo</span>}</span><span className="mt-1 block text-xs text-slate-500">{timeLabel(item.startTime)}–{timeLabel(item.endTime)} · {item.bookingCode || item.ticket}</span><span className="mt-1.5 block text-xs text-slate-600">{tab === 'online' ? entryWindow(item, now).label : date === today && Number.isFinite(minutes) && minutes >= 0 ? `Đã chờ ${minutes} phút · Tiếp nhận ${checkInTime(item.checkedInAt)}` : `Tiếp nhận lúc ${checkInTime(item.checkedInAt)}`}</span></span>
            </button>
          })}
        </div>
      </div>

      <section aria-label="Hồ sơ khám bệnh" className="flex max-h-[calc(100dvh-2rem)] min-h-0 min-w-0 flex-col overflow-hidden rounded border border-slate-200 bg-white lg:sticky lg:top-4 lg:max-h-[calc(100dvh-20rem)]">
        {loading ? <div className="space-y-4 p-6"><div className="h-6 w-1/2 animate-pulse rounded bg-slate-100" /><div className="h-32 animate-pulse rounded bg-slate-100" /></div> : selected ? <>
          <div className="shrink-0 border-b border-slate-100 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">Hồ sơ khám bệnh</h2>
              <span className="text-xs text-slate-500">{selected.bookingCode || selected.ticket}</span>
            </div>
            <div className="mt-3 flex items-start justify-between gap-3">
              <div className="min-w-0"><h3 className="break-words text-lg font-semibold text-slate-900">{selected.patient?.fullName || 'Chưa có tên'}</h3><p className="mt-1 text-sm text-slate-500">{demographics(selected)}</p></div>
              {tab === 'onsite' && <div className="shrink-0 text-right"><p className="text-xs text-slate-500">STT khám</p><p className="mt-1 text-xl font-semibold tabular-nums text-[#218838]">{queueNumber(selected) ?? '—'}</p></div>}
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 [scrollbar-gutter:stable]">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div><dt className="text-xs text-slate-500">Mã bệnh nhân</dt><dd className="mt-1 break-words font-medium text-slate-800">{selected.patient?.patientCode || '—'}</dd></div>
              <div><dt className="text-xs text-slate-500">CCCD / Hộ chiếu</dt><dd className="mt-1 break-words font-medium text-slate-800">{selected.patient?.nationalId || 'Chưa cung cấp'}</dd></div>
              <div><dt className="text-xs text-slate-500">Mã BHYT</dt><dd className="mt-1 break-words font-medium text-slate-800">{selected.patient?.healthInsuranceNumber || 'Chưa cung cấp'}</dd></div>
              <div><dt className="text-xs text-slate-500">{tab === 'onsite' ? 'Đã tiếp nhận lúc' : 'Trạng thái phòng'}</dt><dd className="mt-1 font-medium text-slate-800">{tab === 'onsite' ? checkInTime(selected.checkedInAt) : entry?.label}</dd></div>
              <div className="col-span-2"><dt className="text-xs text-slate-500">Địa chỉ bệnh nhân</dt><dd className="mt-1 break-words text-slate-700">{selected.patient?.address || 'Chưa cung cấp'}</dd></div>
            </dl>
            <div className="space-y-2 border-t border-slate-100 pt-3 text-sm text-slate-700">
              <p className="flex items-start gap-2"><Stethoscope aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><span className="font-medium text-slate-800">{selected.servicePackage?.name || appointmentMethodLabel(selected)}</span></p>
              <p className="flex items-start gap-2"><Clock3 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><span>{date.split('-').reverse().join('/')} · {timeLabel(selected.startTime)}–{timeLabel(selected.endTime)}</span></p>
              <p className="flex items-start gap-2"><MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><span>{selected.branch?.name || 'Chưa xác định cơ sở'}{tab === 'onsite' && selected.clinicRoomName ? ` · ${selected.clinicRoomName}` : ''}</span></p>
            </div>
            <div><h3 className="flex items-center gap-2 text-xs font-semibold text-slate-500"><FileText aria-hidden="true" className="h-4 w-4" />Triệu chứng / Ghi chú tiếp nhận</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{selected.symptoms || 'Chưa có ghi chú tiếp nhận.'}</p></div>
          </div>
            <div className="shrink-0 border-t border-slate-200 bg-white p-3 sm:px-4">
              {tab === 'online' ? <button type="button" disabled={!entry?.allowed} onClick={() => onEnterRoom(selected.id)} className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded bg-[#28a745] px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 ${focusClass}`}><Video aria-hidden="true" className="h-4 w-4" />Vào phòng tư vấn</button> : <button type="button" disabled={Boolean(finishingId)} onClick={() => void onFinish(selected)} className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded bg-[#28a745] px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 ${focusClass}`}>
                {finishingId === selected.id ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <CheckCircle2 aria-hidden="true" className="h-4 w-4" />}{finishingId === selected.id ? 'Đang hoàn thành…' : 'Hoàn thành khám'}
              </button>}
            </div>
        </> : <div className="flex min-h-[20rem] flex-col items-center justify-center px-6 py-12 text-center"><Stethoscope aria-hidden="true" className="mb-4 h-8 w-8 text-slate-300" /><h2 className="text-base font-semibold text-slate-700">Hồ sơ khám bệnh</h2><p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">Chọn một bệnh nhân trong hàng đợi để xem hồ sơ và xử lý lượt khám tại đây.</p><button type="button" onClick={onOpenCalendar} className={`mt-4 min-h-10 rounded px-3 text-sm font-medium text-[#218838] hover:bg-[#28a745]/5 ${focusClass}`}>Xem lịch khám</button></div>}
      </section>
    </div>
  </section>
}
