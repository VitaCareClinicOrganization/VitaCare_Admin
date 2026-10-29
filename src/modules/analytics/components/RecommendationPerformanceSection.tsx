'use client'

import { useEffect, useState } from 'react'
import { apiErrorMessage } from '@/lib/api-client'
import { fetchRecommendationMetrics, type RecommendationMetrics } from '@/modules/admin/services/stats'

interface Props { timeFilter?: string; startDate?: string; endDate?: string }
const number = (value: number) => value.toLocaleString('vi-VN')
const percent = (value: number | null) => value == null ? '—' : value.toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + '%'

export default function RecommendationPerformanceSection({ timeFilter = 'month', startDate, endDate }: Props) {
  const [data, setData] = useState<RecommendationMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setData(null)
    fetchRecommendationMetrics({ timeFilter, startDate: startDate || undefined, endDate: endDate || undefined }, controller.signal)
      .then(result => { if (!controller.signal.aborted) setData(result) })
      .catch(cause => { if (!controller.signal.aborted) setError(apiErrorMessage(cause, 'Không tải được hiệu quả gói gợi ý.')) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [timeFilter, startDate, endDate, refresh])

  const totals = data?.totals
  const stats = [
    { label: 'Lượt bấm gói gợi ý', value: totals ? number(totals.clicks) : '—', description: 'Toàn hệ thống · Theo thời gian đã chọn' },
    { label: 'Đặt thành công từ gợi ý', value: totals ? number(totals.bookings) : '—', description: 'Lượt bấm dẫn đến đặt thành công trong 24 giờ' },
    { label: 'Tỷ lệ đặt từ gợi ý', value: totals ? percent(totals.clickToBookingRate) : '—',
      description: !totals?.clicks ? 'Chưa có lượt bấm để tính tỷ lệ' : totals.clicks < 30 ? 'Đặt thành công / lượt bấm · Ít dữ liệu' : 'Đặt thành công / lượt bấm' },
  ]

  if (error) return (
    <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 sm:col-span-3">
      {error}
      <button type="button" onClick={() => setRefresh(value => value + 1)} className="ml-2 underline">Thử lại</button>
    </div>
  )

  return (
    <>
      {stats.map(item => (
        <div key={item.label} aria-busy={loading} title="Số liệu gợi ý toàn hệ thống, không lọc theo chi nhánh" className="space-y-2 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
          <p className="text-xs font-medium text-slate-500">{item.label}</p>
          <p className="text-2xl font-semibold tabular-nums text-slate-900">{loading ? '…' : item.value}</p>
          <p className="text-xs leading-5 text-slate-500">{loading ? 'Đang tải số liệu gợi ý…' : item.description}</p>
        </div>
      ))}
    </>
  )
}
