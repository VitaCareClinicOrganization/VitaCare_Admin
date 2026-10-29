'use client'

import { useEffect, useState } from 'react'
import { AdminStatCard } from '@/common/components/ui'
import { apiErrorMessage } from '@/lib/api-client'
import { listMyCollections, type MyCollectionHistory } from '@/modules/admin/services/payments'

const money = (amount: number | null | undefined) => {
  if (amount == null || !Number.isFinite(Number(amount))) return '—'
  return `${Number(amount).toLocaleString('vi-VN')} đ`
}
const methods: Record<string, string> = { CASH: 'Tiền mặt', VIETQR: 'Chuyển khoản tại quầy' }

export default function MyCollectionsPanel({ refreshKey }: { refreshKey: number }) {
  const [date, setDate] = useState(() => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date()))
  const [page, setPage] = useState(1)
  const [history, setHistory] = useState<MyCollectionHistory | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setHistory(null)
    listMyCollections(date, page, controller.signal).then(data => {
      if (!controller.signal.aborted) {
        const lastPage = Math.max(1, Math.ceil(data.total / data.pageSize))
        if (page > lastPage) setPage(lastPage)
        else setHistory(data)
      }
    }).catch(err => {
      if (!controller.signal.aborted) setError(apiErrorMessage(err, 'Không tải được lịch sử thu tiền của bạn.'))
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [date, page, refreshKey, attempt])

  const totalPages = history ? Math.max(1, Math.ceil(history.total / history.pageSize)) : 1
  return (
    <section className="mt-5 min-w-0 space-y-4" aria-label="Lịch sử thu tiền của tôi">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Lịch sử thu tiền của tôi</h2>
          <p className="mt-1 text-xs text-slate-500">Chỉ gồm khoản thu tại quầy do bạn ghi nhận thành công trong ngày đã chọn. Thanh toán online không được cộng vào đây.</p>
        </div>
        <label className="text-xs text-slate-600">Ngày thu tiền
          <input type="date" value={date} onChange={event => {
            if (event.target.value) { setDate(event.target.value); setPage(1) }
          }} className="mt-1 block rounded border border-slate-200 bg-white px-3 py-2 text-slate-800" />
        </label>
      </div>
      {error ? <div role="alert" className="rounded border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700">
        <p>{error}</p><button type="button" onClick={() => setAttempt(value => value + 1)} className="mt-2 rounded border border-rose-300 px-3 py-1.5 font-semibold hover:bg-rose-100 cursor-pointer">Thử lại</button>
      </div> : <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminStatCard label="Tiền tôi đã thu trong ngày" value={history ? money(history.totalAmount) : '—'} detail="Tổng giao dịch thu thành công" tone="emerald" loading={loading} />
          <AdminStatCard label="Tiền mặt cần đối chiếu" value={history ? money(history.cashAmount) : '—'} detail="Các khoản bạn đã ghi nhận bằng tiền mặt" loading={loading} />
          <AdminStatCard label="Chuyển khoản tại quầy" value={history ? money(history.transferAmount) : '—'} detail="Các khoản chuyển khoản do bạn ghi nhận" loading={loading} />
          <AdminStatCard label="Giao dịch của tôi" value={history?.total ?? '—'} detail="Trong ngày đã chọn" loading={loading} />
        </div>
        <div className="min-w-0 overflow-hidden rounded border border-slate-200 bg-white">
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Danh sách giao dịch thu tiền cá nhân">
            <table className="w-full min-w-[800px] text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <tr>{['Thời gian thu', 'Mã vé', 'Bệnh nhân', 'Chi nhánh', 'Hình thức thu', 'Số tiền'].map(label => <th key={label} className={`px-4 py-3 font-semibold ${label === 'Số tiền' ? 'text-right' : ''}`}>{label}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? <tr><td colSpan={6} role="status" className="p-8 text-center text-slate-500">Đang tải lịch sử thu tiền…</td></tr> : !history?.items.length ? <tr><td colSpan={6} className="p-8 text-center text-slate-500">Bạn chưa có giao dịch thu tiền tại quầy trong ngày này.</td></tr> : history.items.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3">{new Date(item.paidAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-emerald-800">{item.ticket || `INV-${item.invoiceId.slice(0, 8).toUpperCase()}`}</td>
                    <td className="px-4 py-3"><p className="font-semibold text-slate-800">{item.patientName || '—'}</p><p className="text-slate-500">{item.patientPhone || '—'}</p></td>
                    <td className="px-4 py-3">{item.branch.name}</td>
                    <td className="px-4 py-3">{methods[item.method] || item.method}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums">{money(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {history && totalPages > 1 && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-3 text-xs text-slate-600">
            <span>Trang {page} / {totalPages} · {history.total} giao dịch</span>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1 || loading} onClick={() => setPage(value => value - 1)} className="rounded border border-slate-200 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40 cursor-pointer">Trước</button>
              <button type="button" disabled={page >= totalPages || loading} onClick={() => setPage(value => value + 1)} className="rounded border border-slate-200 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40 cursor-pointer">Sau</button>
            </div>
          </div>}
        </div>
      </>}
    </section>
  )
}
