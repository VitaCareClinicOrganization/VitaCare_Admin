'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { apiErrorMessage } from '@/lib/api-client'
import { assignBranchManager, getBranchManagerOptions, type BranchManagerOptions } from '../services/catalogService'

export default function BranchManagerModal({ branch, onClose, onAssigned }: {
  branch: { id: number; name: string }; onClose: () => void; onAssigned: () => void | Promise<void>
}) {
  const [data, setData] = useState<BranchManagerOptions | null>(null)
  const [query, setQuery] = useState('')
  const [managerId, setManagerId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const dialog = useRef<HTMLFormElement>(null)
  const latest = useRef({ saving, onClose })
  latest.current = { saving, onClose }

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.current?.querySelector<HTMLInputElement>('input')?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !latest.current.saving) latest.current.onClose()
      if (event.key !== 'Tab') return
      const elements = dialog.current?.querySelectorAll<HTMLElement>('input:not(:disabled), select:not(:disabled), button:not(:disabled)')
      if (!elements?.length) return
      const first = elements[0], last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', keydown)
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); previous?.focus() }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    const timer = setTimeout(() => {
      getBranchManagerOptions(branch.id, query, controller.signal).then(value => {
        if (!controller.signal.aborted) setData(value)
      }).catch(cause => {
        if (!controller.signal.aborted) { setData(null); setError(apiErrorMessage(cause, 'Không tải được danh sách quản lý.')) }
      }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, query ? 300 : 0)
    return () => { clearTimeout(timer); controller.abort() }
  }, [branch.id, query, reload])

  const unchanged = data?.currentManagers.length === 1 && data.currentManagers[0].id === managerId
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-3 backdrop-blur-xs">
    <form ref={dialog} role="dialog" aria-modal="true" aria-labelledby="branch-manager-title" onSubmit={async event => {
      event.preventDefault()
      if (!data || !managerId || saving || loading || unchanged) return
      setSaving(true); setError('')
      try {
        await assignBranchManager(branch.id, managerId, data.currentManagers.map(manager => manager.id))
        await onAssigned()
      } catch (cause) { setError(apiErrorMessage(cause, 'Không thể bổ nhiệm người quản lý.')); setSaving(false) }
    }} className="flex h-[640px] max-h-[calc(100dvh-24px)] min-w-0 w-full max-w-lg flex-col overflow-hidden rounded bg-white shadow-xl">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
        <h2 id="branch-manager-title" className="text-base font-semibold text-slate-900">Bổ nhiệm người quản lý</h2>
        <button type="button" onClick={onClose} disabled={saving} aria-label="Đóng bổ nhiệm quản lý" className="grid h-9 w-9 place-items-center rounded text-slate-500 hover:bg-slate-100 disabled:opacity-50"><X className="h-5 w-5" /></button>
      </header>
      <div className="min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto p-5 text-sm [scrollbar-gutter:stable]">
        <div><p className="text-slate-500">Chi nhánh</p><p title={branch.name} className="mt-1 h-10 line-clamp-2 break-words font-semibold text-slate-900">{branch.name}</p></div>
        <div><p className="text-slate-500">Người quản lý hiện tại</p><p className="mt-1 h-10 line-clamp-2 break-words font-medium text-slate-800">{data ? data.currentManagers.map(manager => `${manager.fullName || manager.email || 'Chưa có tên'}${manager.isBlocked || manager.status !== 'ACTIVE' ? ' (không hoạt động)' : ''}`).join(', ') || 'Chưa bổ nhiệm' : loading ? 'Đang tải…' : 'Chưa tải được'}</p></div>
        <div><label htmlFor="branch-manager-search" className="mb-1 block font-medium text-slate-700">Tìm người quản lý</label><input id="branch-manager-search" value={query} disabled={saving} onChange={event => { setQuery(event.target.value); setManagerId(''); setLoading(true) }} placeholder="Nhập họ tên hoặc email" className="h-10 w-full rounded border border-slate-300 px-3 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15" /></div>
        <div className="min-w-0"><label htmlFor="branch-manager-select" className="mb-1 block font-medium text-slate-700">Người được bổ nhiệm <span className="text-rose-600">*</span></label><select id="branch-manager-select" required disabled={loading || saving || !data?.branch.isActive} value={managerId} onChange={event => setManagerId(event.target.value)} className="h-10 min-w-0 w-full max-w-full truncate rounded border border-slate-300 px-3 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15 disabled:bg-slate-50">
          <option value="">{loading ? 'Đang tải danh sách…' : 'Chọn người quản lý'}</option>
          {data?.candidates.map(manager => <option key={manager.id} value={manager.id}>{manager.fullName || manager.email || 'Chưa có tên'}{manager.fullName && manager.email ? ` — ${manager.email}` : ''}</option>)}
        </select></div>
        <div role="status" aria-live="polite" className="h-14 overflow-y-auto text-xs leading-5 text-slate-600">
          {loading ? <span className="inline-flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />Đang tìm người quản lý…</span>
            : data && !data.branch.isActive ? <p className="text-rose-700">Chi nhánh đã ngừng hoạt động, không thể bổ nhiệm.</p>
            : data && !data.candidates.length ? <p>{query.trim() ? 'Không tìm thấy người phù hợp. Thử họ tên hoặc email khác.' : 'Chưa có quản lý khả dụng. Cần tài khoản quản lý chưa phụ trách chi nhánh khác.'}</p>
            : data ? <p>Chọn người quản lý trong danh sách để tiếp tục.</p> : null}
        </div>
        <p className="text-xs leading-5 text-slate-500">Mỗi chi nhánh có tối đa một quản lý chính; mỗi người phụ trách tối đa một chi nhánh. Khi thay người, tài khoản quản lý cũ được giữ để phân công sau.</p>
        {error && <div role="alert" className="rounded bg-rose-50 p-3 text-rose-700"><p>{error}</p><button type="button" disabled={saving} onClick={() => { setManagerId(''); setReload(value => value + 1) }} className="mt-2 underline underline-offset-2">Tải lại danh sách</button></div>}
      </div>
      <footer className="flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-white px-5 py-3">
        <button type="button" disabled={saving} onClick={onClose} className="min-h-10 rounded border border-slate-300 px-4 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">Hủy</button>
        <button type="submit" disabled={saving || loading || !managerId || !data?.branch.isActive || unchanged} className="inline-flex min-h-10 items-center justify-center gap-2 rounded bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{saving ? 'Đang lưu…' : 'Xác nhận bổ nhiệm'}</button>
      </footer>
    </form>
  </div>
}
