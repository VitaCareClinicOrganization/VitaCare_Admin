'use client'

import { useEffect, useState } from 'react'
import { apiRequest, unwrapApiData, apiErrorMessage } from '@/lib/api-client'

export default function PackageReceptionSlotsPanel({ packages }: { packages: any[] }) {
  const [packageId, setPackageId] = useState('')
  const [slots, setSlots] = useState<any[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [capacities, setCapacities] = useState<Record<string, string>>({})
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    if (!packageId) { setSlots([]); return }
    let active = true
    setError('')
    apiRequest({ method: 'GET', url: '/package-reception-slots', params: { servicePackageId: packageId } })
      .then(response => { if (active) { setSlots(unwrapApiData<any[]>(response)); setCapacities({}) } })
      .catch(err => { if (active) setError(apiErrorMessage(err, 'Không tải được khung tiếp nhận')) })
    return () => { active = false }
  }, [packageId, refresh])
  const create = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true); setError(''); setNotice('')
    try {
      const result = unwrapApiData<{ count: number }>(await apiRequest({ method: 'POST', url: '/package-reception-slots', data: {
        servicePackageId: packageId, from: form.get('from'), to: form.get('to'), startTime: form.get('startTime'), endTime: form.get('endTime'),
        slotDurationMin: Number(form.get('duration')), capacity: Number(form.get('capacity')),
      } }))
      setNotice(`Đã tạo ${result.count} khung tiếp nhận. Các khung đã tồn tại được giữ nguyên.`)
      setRefresh(value => value + 1)
    } catch (err) { setError(apiErrorMessage(err, 'Không tạo được khung tiếp nhận')) }
    finally { setBusy(false) }
  }
  const update = async (slot: any, data: Record<string, any>) => {
    setBusy(true); setError(''); setNotice('')
    try {
      await apiRequest({ method: 'PATCH', url: `/package-reception-slots/${slot.id}`, data })
      setRefresh(value => value + 1)
      setNotice('Đã cập nhật khung tiếp nhận.')
    } catch (err) { setError(apiErrorMessage(err, 'Không cập nhật được khung tiếp nhận')) }
    finally { setBusy(false) }
  }
  const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700'
  const label = 'grid gap-1.5 text-xs font-medium text-slate-600'
  return <details className="my-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
    <summary className="cursor-pointer text-sm font-semibold text-slate-900">Khung giờ tiếp nhận gói tổng quát</summary>
    <p className="mt-3 text-sm leading-6 text-slate-600">Tạo giờ đến và số chỗ cho gói khám tại chi nhánh. Nhân viên điều phối khi bệnh nhân đến, không cấp bác sĩ, phòng hoặc số thứ tự khi đặt lịch.</p>
    <label className={`${label} mt-4`}>Gói khám
      <select className={input} disabled={busy} value={packageId} onChange={event => { setPackageId(event.target.value); setNotice('') }}>
        <option value="">Chọn gói tổng quát</option>
        {packages.map(pkg => <option key={pkg.id} value={pkg.id}>{pkg.name}</option>)}
      </select>
    </label>
    {packageId && <>
      <form onSubmit={create} className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className={label}>Từ ngày<input className={input} name="from" type="date" required disabled={busy} /></label>
        <label className={label}>Đến ngày<input className={input} name="to" type="date" required disabled={busy} /></label>
        <label className={label}>Số người / khung<input className={input} name="capacity" type="number" min={1} max={200} defaultValue={5} required disabled={busy} /></label>
        <label className={label}>Bắt đầu<input className={input} name="startTime" type="time" defaultValue="07:30" required disabled={busy} /></label>
        <label className={label}>Kết thúc<input className={input} name="endTime" type="time" defaultValue="11:30" required disabled={busy} /></label>
        <label className={label}>Phút / khung<input className={input} name="duration" type="number" min={10} max={120} defaultValue={30} required disabled={busy} /></label>
        <p className="text-xs leading-5 text-slate-500 sm:col-span-3">Chỉ tạo trong các ngày và buổi tiếp nhận đã cấu hình của gói. Mỗi gói có sức chứa riêng.</p>
        <button disabled={busy} type="submit" className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Đang lưu…' : 'Tạo khung tiếp nhận'}</button>
      </form>
      <div className="mt-5 max-h-80 overflow-auto">
        <table className="w-full min-w-[650px] text-left text-sm">
          <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500"><tr>{['Ngày', 'Giờ tiếp nhận', 'Đã đặt', 'Sức chứa', 'Trạng thái', 'Thao tác'].map(text => <th className="p-3 font-medium" key={text}>{text}</th>)}</tr></thead>
          <tbody>{slots.map(slot => <tr key={slot.id} className="border-t border-slate-100">
            <td className="p-3">{new Date(slot.date).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</td>
            <td className="p-3 whitespace-nowrap">{slot.startTime.slice(11, 16)}–{slot.endTime.slice(11, 16)}</td>
            <td className="p-3 tabular-nums">{slot.occupiedCount}</td>
            <td className="p-3"><input aria-label="Sức chứa khung tiếp nhận" className="w-20 rounded-lg border border-slate-300 p-2" type="number" min={Math.max(1, slot.occupiedCount)} max={200} value={capacities[slot.id] ?? String(slot.capacity)} disabled={busy} onChange={event => setCapacities(values => ({ ...values, [slot.id]: event.target.value }))} /></td>
            <td className="p-3 whitespace-nowrap">{slot.isActive ? 'Đang mở' : 'Tạm dừng'}</td>
            <td className="p-3 whitespace-nowrap"><button type="button" className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-50" disabled={busy || !capacities[slot.id]} onClick={() => void update(slot, { capacity: Number(capacities[slot.id]) })}>Lưu</button><button type="button" className="ml-2 rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-50" disabled={busy} onClick={() => void update(slot, { isActive: !slot.isActive })}>{slot.isActive ? 'Tạm dừng' : 'Mở lại'}</button></td>
          </tr>)}</tbody>
        </table>
        {!slots.length && <p className="py-5 text-sm text-slate-500">Chưa có khung tiếp nhận. Tạo khung để bệnh nhân có thể đặt gói.</p>}
      </div>
    </>}
    {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
    {notice && <p role="status" className="mt-3 text-sm text-slate-700">{notice}</p>}
  </details>
}
