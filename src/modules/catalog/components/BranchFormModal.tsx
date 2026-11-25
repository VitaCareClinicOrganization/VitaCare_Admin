'use client'

import { useEffect, useRef, useState } from 'react'
import type { Dispatch, FormEvent, SetStateAction } from 'react'
import { Loader2, Search, X } from 'lucide-react'
import divisions from '../data/vietnam-divisions.json'
import ImageUploader from './ImageUploader'
import BranchLocationPicker from './BranchLocationPicker'
import { findBranchAddress, type BranchAddressLocation } from '../services/catalogService'
import { apiErrorMessage } from '@/lib/api-client'

const days = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const inputClass = 'h-10 w-full min-w-0 rounded border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-500 transition focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15 disabled:bg-slate-50 disabled:text-slate-500'
const labelClass = 'mb-1 block text-sm font-semibold text-slate-700'

function readDays(hours: string): number[] {
  if (/hằng ngày|hàng ngày|mỗi ngày/i.test(hours)) return [0, 1, 2, 3, 4, 5, 6]
  const range = hours.match(/(?:Thứ\s*|T)([2-7])\s*[-–]\s*(?:(?:Thứ\s*|T)?([2-7])|(CN|Chủ\s*nhật))/i)
  if (range) return Array.from({ length: (range[3] ? 6 : Number(range[2]) - 2) - (Number(range[1]) - 2) + 1 }, (_, i) => Number(range[1]) - 2 + i)
  const selected = days.flatMap((day, index) => (index === 6 ? /CN|Chủ\s*nhật/i : new RegExp(`(?:Thứ\\s*|T)${index + 2}(?!\\d)`, 'i')).test(hours) ? [index] : [])
  return selected.length ? selected : [0, 1, 2, 3, 4, 5]
}

export default function BranchFormModal({ modal, form, setForm, saving, onClose, onSubmit, error }: {
  modal: 'create' | 'edit'; form: any; setForm: Dispatch<SetStateAction<any>>
  saving: boolean; onClose: () => void; onSubmit: (event: FormEvent) => void
  error?: string
}) {
  const [workingDays, setWorkingDays] = useState(() => readDays(form.operatingHours || ''))
  const [googleMapAddress, setGoogleMapAddress] = useState('')
  const [findingAddress, setFindingAddress] = useState(false)
  const [addressFeedback, setAddressFeedback] = useState('')
  const [addressResults, setAddressResults] = useState<BranchAddressLocation[]>([])
  const [resultQuery, setResultQuery] = useState('')
  const [revealMap, setRevealMap] = useState(0)
  const addressRequest = useRef<AbortController | null>(null)
  const latestMapAddress = useRef(googleMapAddress)
  latestMapAddress.current = googleMapAddress
  const dialog = useRef<HTMLFormElement>(null)
  const current = useRef({ onClose, saving })
  current.current = { onClose, saving }
  const province = divisions.find(item => item.name === form.province)
  const update = (key: string, value: unknown) => setForm((previous: any) => ({ ...previous, [key]: value }))

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.current?.querySelector<HTMLInputElement>('input[type="text"]')?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !current.current.saving) current.current.onClose()
      if (event.key !== 'Tab') return
      const controls = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled):not([type="file"]), select:not(:disabled), textarea:not(:disabled), a[href]')
      if (!controls?.length) return
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { addressRequest.current?.abort(); document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKeyDown); previousFocus?.focus() }
  }, [])

  function selectAddress(location: BranchAddressLocation) {
    setForm((previous: any) => ({ ...previous, latitude: location.latitude, longitude: location.longitude }))
    setAddressResults([])
    setRevealMap(value => value + 1)
    setAddressFeedback('Đã đặt ghim theo địa chỉ. Kiểm tra vị trí và kéo ghim nếu cần điều chỉnh.')
  }

  async function searchAddress() {
    const address = googleMapAddress.trim()
    if (!address || findingAddress || saving) return
    addressRequest.current?.abort()
    const controller = new AbortController()
    addressRequest.current = controller
    setFindingAddress(true)
    setAddressResults([])
    setAddressFeedback('')
    setResultQuery(address)
    try {
      const results = await findBranchAddress(address, controller.signal)
      if (controller.signal.aborted || latestMapAddress.current.trim() !== address) return
      if (results.length === 1) selectAddress(results[0])
      else if (results.length) { setAddressResults(results); setAddressFeedback('Chọn địa chỉ phù hợp để đặt ghim:') }
      else setAddressFeedback('Chưa tìm thấy địa chỉ. Thử dán địa chỉ đầy đủ từ Google Maps hoặc chọn trực tiếp trên bản đồ.')
    } catch (error) {
      if (!controller.signal.aborted && latestMapAddress.current.trim() === address) setAddressFeedback(apiErrorMessage(error, 'Chưa thể tìm địa chỉ. Vui lòng thử lại.'))
    } finally {
      if (addressRequest.current === controller) setFindingAddress(false)
    }
  }

  function changeHours(patch: Record<string, string>, selected = workingDays) {
    setForm((previous: any) => {
      const next = { ...previous, ...patch }
      const label = selected.length === 7 ? 'Hằng ngày' : [...selected].sort((a, b) => a - b).map(index => index === 6 ? 'CN' : `T${index + 2}`).join(', ')
      return { ...next, operatingHours: `${next.openTime || '07:30'} - ${next.closeTime || '17:00'}, ${label}` }
    })
  }

  function field(key: string, label: string, type = 'text', placeholder = '', required = false, attributes: Record<string, unknown> = {}) {
    return <div><label htmlFor={`branch-${key}`} className={labelClass}>{label}{required && <span className="text-rose-600"> *</span>}</label><input id={`branch-${key}`} name={key} type={type} required={required} placeholder={placeholder} value={form[key] ?? ''} onChange={event => update(key, event.target.value)} className={inputClass} {...attributes} /></div>
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-3 backdrop-blur-xs sm:p-4">
    <form ref={dialog} role="dialog" aria-modal="true" aria-labelledby="branch-form-title" onSubmit={event => {
      const close = event.currentTarget.elements.namedItem('closeTime') as HTMLInputElement
      close.setCustomValidity((form.closeTime || '17:00') <= (form.openTime || '07:30') ? 'Giờ đóng cửa phải sau giờ mở cửa.' : '')
      if (!event.currentTarget.reportValidity()) { event.preventDefault(); return }
      onSubmit(event)
    }} className="flex max-h-[calc(100dvh-24px)] w-full max-w-4xl flex-col overflow-hidden rounded bg-white shadow-2xl sm:max-h-[calc(100dvh-32px)]">
      <header className="mx-4 flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 py-3 sm:mx-5">
        <h2 id="branch-form-title" className="text-lg font-semibold text-slate-900">{modal === 'create' ? 'Thêm chi nhánh' : 'Cập nhật chi nhánh'}</h2>
        <button type="button" onClick={onClose} disabled={saving} aria-label="Đóng form chi nhánh" className="grid h-10 w-10 place-items-center rounded text-slate-500 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:opacity-50"><X className="h-5 w-5" /></button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
      <fieldset disabled={saving} className="min-w-0 space-y-4 px-4 py-4 sm:px-5">
        {error && <p role="alert" className="rounded bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
        <section aria-labelledby="branch-general-title" className="space-y-3">
          <h3 id="branch-general-title" className="text-sm font-semibold text-slate-900">Thông tin chung</h3>
          <div className="flex items-center gap-3">
            <ImageUploader label="" value={form.imageUrl || ''} onChange={url => update('imageUrl', url)} aspectRatio="logo" disabled={saving} />
            <div className="min-w-0 flex-1">{field('name', 'Tên chi nhánh', 'text', 'Ví dụ: Chi nhánh Bình Thạnh', true, { maxLength: 150, autoComplete: 'organization' })}</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {field('email', 'Email liên hệ', 'email', 'Email chi nhánh', false, { maxLength: 100, autoComplete: 'email' })}
            {field('phoneNumber', 'Hotline', 'tel', 'Số điện thoại', true, { maxLength: 20, autoComplete: 'tel' })}
          </div>
        </section>
        <section aria-labelledby="branch-address-title" className="min-w-0 space-y-3 border-t border-slate-200 pt-4">
          <h3 id="branch-address-title" className="text-sm font-semibold text-slate-900">Địa chỉ chi nhánh</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label htmlFor="branch-province" className={labelClass}>Tỉnh/Thành phố <span className="text-rose-600">*</span></label><select id="branch-province" required value={form.province || ''} onChange={event => setForm((previous: any) => ({ ...previous, province: event.target.value, ward: '', district: '' }))} className={inputClass}><option value="">Chọn tỉnh/thành phố</option>{form.province && !province && <option value={form.province}>{form.province}</option>}{divisions.map(item => <option key={item.name} value={item.name}>{item.name}</option>)}</select></div>
            <div><label htmlFor="branch-ward" className={labelClass}>Phường/Xã <span className="text-rose-600">*</span></label><select id="branch-ward" required disabled={!form.province} value={form.ward || ''} onChange={event => update('ward', event.target.value)} className={inputClass}><option value="">{form.province ? 'Chọn phường/xã' : 'Chọn tỉnh/thành phố trước'}</option>{form.ward && !province?.wards.includes(form.ward) && <option value={form.ward}>{form.ward}</option>}{province?.wards.map(name => <option key={name} value={name}>{name}</option>)}</select></div>
          </div>
          {field('address', 'Địa chỉ chi tiết', 'text', 'Số nhà, tên đường', true, { autoComplete: 'street-address', maxLength: 400 })}
          <div>
            <label htmlFor="branch-google-map-address" className={labelClass}>Địa chỉ Google Maps</label>
            <input id="branch-google-map-address" type="text" autoComplete="off" maxLength={400} placeholder="Dán địa chỉ đầy đủ từ Google Maps để tìm vị trí" value={googleMapAddress} onChange={event => {
              addressRequest.current?.abort()
              latestMapAddress.current = event.target.value
              setGoogleMapAddress(event.target.value)
              setFindingAddress(false)
              setAddressResults([])
              setAddressFeedback('')
            }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void searchAddress() } }} className={inputClass} />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-500">Dán nội dung địa chỉ, sau đó bấm tìm để đặt ghim.</p>
              <button type="button" disabled={saving || findingAddress || !googleMapAddress.trim()} onClick={() => void searchAddress()} className="inline-flex min-h-9 items-center justify-center gap-2 rounded border border-emerald-700 px-3 text-sm font-medium text-emerald-800 hover:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:opacity-50">
                {findingAddress ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{findingAddress ? 'Đang tìm…' : 'Tìm trên bản đồ'}
              </button>
            </div>
            {resultQuery === googleMapAddress.trim() && <>
              {addressFeedback && <p role="status" className="mt-2 text-xs text-slate-600">{addressFeedback}</p>}
              {addressResults.length > 0 && <ul aria-label="Kết quả tìm địa chỉ" className="mt-2 divide-y divide-slate-200 rounded border border-slate-200">{addressResults.map(location => <li key={`${location.latitude}:${location.longitude}:${location.label}`}><button type="button" disabled={saving} onClick={() => selectAddress(location)} className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600">{location.label}</button></li>)}</ul>}
            </>}
          </div>
          <BranchLocationPicker latitude={form.latitude} longitude={form.longitude} disabled={saving || findingAddress} revealToken={revealMap} onChange={location => setForm((previous: any) => ({ ...previous, latitude: Number(location.latitude.toFixed(6)), longitude: Number(location.longitude.toFixed(6)) }))} />
          <p className="text-xs text-slate-500">Tìm địa chỉ: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline underline-offset-2">© OpenStreetMap contributors</a>.</p>
        </section>
        <section aria-labelledby="branch-operation-title" className="min-w-0 space-y-3 border-t border-slate-200 pt-4">
          <h3 id="branch-operation-title" className="text-sm font-semibold text-slate-900">Thông tin hoạt động</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {(['openTime', 'closeTime'] as const).map((key, index) => <div key={key}><label htmlFor={`branch-${key}`} className={labelClass}>{index === 0 ? 'Giờ mở cửa' : 'Giờ đóng cửa'} <span className="text-rose-600">*</span></label><input id={`branch-${key}`} name={key} type="time" required value={form[key] || (index === 0 ? '07:30' : '17:00')} onChange={event => { (dialog.current?.elements.namedItem('closeTime') as HTMLInputElement)?.setCustomValidity(''); changeHours({ [key]: event.target.value }) }} className={inputClass} /></div>)}
          </div>
          <div><p id="branch-days-label" className={labelClass}>Ngày làm việc</p><div role="group" aria-labelledby="branch-days-label" className="grid grid-cols-7 gap-1.5 sm:gap-2">{days.map((day, index) => <button key={day} type="button" aria-label={index === 6 ? 'Chủ nhật' : `Thứ ${index + 2}`} aria-pressed={workingDays.includes(index)} onClick={() => { const next = workingDays.includes(index) ? workingDays.filter(value => value !== index) : [...workingDays, index]; if (!next.length) return; setWorkingDays(next); changeHours({}, next) }} className={`min-h-10 rounded border text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${workingDays.includes(index) ? 'border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}>{day}</button>)}</div></div>
          <div><label htmlFor="branch-description" className={labelClass}>Mô tả chi nhánh</label><textarea id="branch-description" rows={3} placeholder="Giới thiệu cơ sở vật chất, chuyên khoa và thế mạnh của chi nhánh…" value={form.description || ''} onChange={event => update('description', event.target.value)} className="w-full resize-y rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15" /></div>
        </section>
      </fieldset>
      </div>
      <footer className="relative mx-4 flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-white py-3 sm:mx-5">
        <button type="button" disabled={saving} onClick={onClose} className="min-h-10 rounded border border-slate-300 px-5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:opacity-50">Hủy</button>
        <button type="submit" disabled={saving || findingAddress} className="min-h-10 rounded bg-emerald-700 px-5 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:opacity-50">{saving ? 'Đang lưu…' : modal === 'create' ? 'Thêm chi nhánh' : 'Lưu thay đổi'}</button>
      </footer>
    </form>
  </div>
}
