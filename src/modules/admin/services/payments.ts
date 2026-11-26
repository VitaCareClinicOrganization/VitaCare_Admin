import { apiErrorMessage, apiRequest, unwrapApiData } from '@/lib/api-client'

export interface MyCollectionHistory {
  date: string
  page: number
  pageSize: number
  total: number
  totalAmount: number
  cashAmount: number
  transferAmount: number
  items: Array<{
    id: string
    amount: number
    method: string
    paidAt: string
    invoiceId: string
    ticket: string | null
    patientName: string | null
    patientPhone: string | null
    branch: { id: string; name: string }
  }>
}

export async function listMyCollections(date: string, page = 1, signal?: AbortSignal): Promise<MyCollectionHistory> {
  const response = await apiRequest({ method: 'GET', url: '/payments/appointments/my-collections', params: { date, page, pageSize: 10 }, signal })
  // Hỗ trợ cả phản hồi cũ bị bọc thêm một lớp data.
  const data = unwrapApiData<MyCollectionHistory>(response)
  const amounts = [data?.totalAmount, data?.cashAmount, data?.transferAmount]
  const counts = [data?.total, data?.page, data?.pageSize]
  if (!data || !Array.isArray(data.items) ||
      amounts.some(value => value == null || typeof value === 'boolean' || String(value).trim() === '' || !Number.isFinite(Number(value)) || Number(value) < 0) ||
      counts.some(value => !Number.isInteger(value) || value < 0) || data.page < 1 || data.pageSize < 1) {
    throw new Error('Dữ liệu lịch sử thu tiền chưa đầy đủ. Vui lòng tải lại.')
  }
  return { ...data, totalAmount: Number(data.totalAmount), cashAmount: Number(data.cashAmount), transferAmount: Number(data.transferAmount) }
}

/** Ghi nhận đã thu phí khám (150k mặc định). method: 'cash' | 'transfer' */
export async function recordAppointmentPayment({ token, appointmentId, method, amount, note }) {
  const id = String(appointmentId || '').trim()
  const body: { method: string; amount?: number; note?: string } = { method }
  if (amount != null) body.amount = amount
  if (note != null) body.note = String(note || '')
  try { return await apiRequest({ method: 'POST', url: `/payments/appointments/${encodeURIComponent(id)}/counter`, data: body }) }
  catch (error) { throw new Error(apiErrorMessage(error, 'Không ghi nhận được thanh toán.')) }
}

export async function approveAppointmentRefund(appointmentId: string, amount: number, note: string) {
  try {
    const response = await apiRequest({ method: 'POST', url: `/payments/appointments/${encodeURIComponent(appointmentId)}/refund/approve`, data: { amount, note } })
    return unwrapApiData<{ refund: Record<string, any>; message: string }>(response)
  } catch (error) { throw new Error(apiErrorMessage(error, 'Không duyệt được khoản hoàn tiền.')) }
}

export async function completeAppointmentRefund(appointmentId: string, note?: string) {
  try {
    const response = await apiRequest({ method: 'POST', url: `/payments/appointments/${encodeURIComponent(appointmentId)}/refund/complete`, data: note ? { note } : {} })
    return unwrapApiData<{ refund: Record<string, any>; message: string }>(response)
  } catch (error) { throw new Error(apiErrorMessage(error, 'Không xác nhận được đã hoàn tiền.')) }
}
