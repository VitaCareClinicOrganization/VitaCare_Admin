export type AppointmentPeriod = 'all' | 'day' | 'week' | 'month'

export const BOOKING_METHOD_LABELS: Record<string, string> = {
  SPECIALTY_EXAM: 'Khám chuyên khoa',
  CONSULTATION: 'Khám với bác sĩ',
  ONLINE_CONSULTATION: 'Tư vấn trực tuyến',
  HEALTH_PACKAGE: 'Gói khám sức khỏe',
  AFTER_HOURS: 'Khám ngoài giờ',
}

export function appointmentMethodCode(item: any): string {
  if (item.isTelehealth) return 'ONLINE_CONSULTATION'
  const code = String(item.bookingMethod?.code || '').toUpperCase()
  return code === 'DOCTOR' ? 'CONSULTATION' : code
}

export function appointmentMethodLabel(item: any): string {
  return BOOKING_METHOD_LABELS[appointmentMethodCode(item)] || item.bookingMethod?.name || 'Chưa xác định hình thức'
}

export function appointmentState(item: any): string {
  const status = String(item.workflowStatus || item.status || '').toUpperCase()
  if (status === 'CANCELLED') return 'CANCELLED'
  if (['COMPLETED', 'EXAMINED'].includes(status)) return 'COMPLETED'
  if (['CHECKED_IN'].includes(status) ||
      (appointmentMethodCode(item) === 'ONLINE_CONSULTATION' && status === 'CONFIRMED')) return 'CHECKED_IN'
  if (['HOLD', 'PENDING', 'CONFIRMED'].includes(status)) return 'PENDING'
  return status
}

export function appointmentDateRange(period: AppointmentPeriod, anchor: string) {
  if (period === 'all' || !anchor) return { from: '', to: '' }
  const date = new Date(`${anchor}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return { from: '', to: '' }
  const start = new Date(date), end = new Date(date)
  if (period === 'week') {
    start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7)
    end.setTime(start.getTime())
    end.setUTCDate(end.getUTCDate() + 6)
  } else if (period === 'month') {
    start.setUTCDate(1)
    end.setUTCMonth(end.getUTCMonth() + 1, 0)
  }
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) }
}

export function shiftAppointmentDate(anchor: string, period: AppointmentPeriod, direction: number) {
  const date = new Date(`${anchor}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return anchor
  if (period === 'month') date.setUTCMonth(date.getUTCMonth() + direction, 1)
  else date.setUTCDate(date.getUTCDate() + direction * (period === 'week' ? 7 : 1))
  return date.toISOString().slice(0, 10)
}
