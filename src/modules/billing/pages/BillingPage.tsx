'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, Search, CreditCard, CheckCircle, Clock, AlertCircle, RotateCcw, QrCode } from 'lucide-react'
import { useAuth } from '@/common/hooks/useAuth'
import {
  AdminButton,
  AdminPageHeader,
  AdminStatCard,
  FilterTabs,
  AdminTableCard,
  AdminTable,
  AdminTableHead,
  AdminTableLoading,
  AdminTableEmpty,
  AdminTableFooter,
  AdminModal,
  StatusBadge,
} from '@/common/components/ui'
import { listReceptionAppointments } from '@/modules/admin/services/appointments'
import { approveAppointmentRefund, completeAppointmentRefund, recordAppointmentPayment } from '@/modules/admin/services/payments'
import { staffRole } from '@/modules/admin/utils/staffSession'
import MyCollectionsPanel from '../components/MyCollectionsPanel'

type AppointmentRow = Record<string, any>
const isRefundReviewPending = (item: AppointmentRow) => !!item.payment?.refund && !['APPROVED', 'COMPLETED', 'NOT_ELIGIBLE'].includes(item.payment.refund.approvalStatus)
const refundStatusLabel = (item: AppointmentRow) => item.payment?.refund?.approvalStatus === 'NOT_ELIGIBLE' ? 'Không hoàn tiền' : (item.payment?.refund?.approvalStatus === 'COMPLETED' || item.payment?.status === 'REFUNDED') ? 'Đã hoàn tiền' : item.payment?.refund?.approvalStatus === 'APPROVED' ? 'Chờ chuyển tiền' : 'Chờ xét duyệt'
const money = (val: any) => `${Number(val || 0).toLocaleString('vi-VN')} đ`
const APPOINTMENT_STATUSES: Record<string, string> = {
  HOLD: 'Đang giữ chỗ', CONFIRMED: 'Đã xác nhận', CHECKED_IN: 'Đã tiếp nhận',
  COMPLETED: 'Đã khám xong', CANCELLED: 'Đã hủy', EXPIRED: 'Hết hạn', NO_SHOW: 'Không đến khám',
}
const PAYMENT_METHODS: Record<string, string> = { cash: 'Tiền mặt', vietqr: 'Chuyển khoản QR', pos_card: 'Thẻ tại quầy', online: 'Thanh toán trực tuyến' }
const CANCELLATION_ROLES: Record<string, string> = { PATIENT: 'Bệnh nhân', RECEPTIONIST: 'Tiếp nhận', BRANCH_MANAGER: 'Quản lý chi nhánh', CHAIN_MANAGER: 'Quản lý chuỗi', DOCTOR: 'Bác sĩ' }

function displayDate(value?: string | null, withTime = false) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return withTime
    ? date.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false })
    : date.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
}

function DetailFields({ items }: { items: Array<[string, string | number | null | undefined]> }) {
  return <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
    {items.map(([label, value]) => <div key={label} className="min-w-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap break-words text-sm font-medium leading-5 text-slate-900">{value || '—'}</dd>
    </div>)}
  </dl>
}

const TABLE_COLUMNS = [
  'Mã hóa đơn',
  'Bệnh nhân',
  'Dịch vụ & Ngày',
  'Bác sĩ',
  { label: 'Số tiền', align: 'right' as const },
  { label: 'Trạng thái', align: 'center' as const },
  { label: 'Thao tác', align: 'right' as const },
]
const REFUND_TABLE_COLUMNS = [
  'Mã hóa đơn',
  'Bệnh nhân',
  { label: 'Thực trả', align: 'right' as const },
  { label: 'Tỷ lệ hoàn', align: 'right' as const },
  { label: 'Khoản giữ lại', align: 'right' as const },
  { label: 'Tiền hoàn', align: 'right' as const },
  { label: 'Trạng thái', align: 'center' as const },
  { label: 'Thao tác', align: 'right' as const },
]

export default function BillingPage({ refundsOnly = false }: { refundsOnly?: boolean }) {
  const { user, token } = useAuth()
  const role = staffRole(user)
  const isReceptionist = role === 'receptionist'
  const canViewRevenue = ['admin', 'branch_manager'].includes(role)
  const isStaff = ['receptionist', 'admin', 'branch_manager'].includes(role)
  const showCollectionMethod = isReceptionist && !refundsOnly
  const baseColumns = refundsOnly ? REFUND_TABLE_COLUMNS : TABLE_COLUMNS
  const tableColumns = showCollectionMethod ? [...baseColumns.slice(0, 5), 'Hình thức thu', ...baseColumns.slice(5)] : baseColumns
  const columnCount = tableColumns.length

  const [appointments, setAppointments] = useState<AppointmentRow[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [view, setView] = useState<'invoices' | 'mine'>('invoices')
  const [collectionsRefreshKey, setCollectionsRefreshKey] = useState(0)

  const [selectedItem, setSelectedItem] = useState<AppointmentRow | null>(null)
  const [payMethod, setPayMethod] = useState<'cash' | 'transfer'>('cash')
  const [payNote, setPayNote] = useState('')
  const [submittingPay, setSubmittingPay] = useState(false)
  const [refundAmount, setRefundAmount] = useState('')
  const [approvalNote, setApprovalNote] = useState('')
  const [approvalError, setApprovalError] = useState('')
  const [approvingRefund, setApprovingRefund] = useState(false)
  const [completingRefund, setCompletingRefund] = useState(false)
  const [completeError, setCompleteError] = useState('')

  useEffect(() => {
    setRefundAmount('')
    setApprovalNote('')
    setApprovalError('')
    setCompleteError('')
  }, [selectedItem?.id])

  const handleCompleteRefund = async () => {
    if (!selectedItem || completingRefund) return
    setCompletingRefund(true)
    setCompleteError('')
    try {
      const result = await completeAppointmentRefund(selectedItem.id)
      if (!result?.refund) throw new Error('Chưa nhận được kết quả xác nhận. Vui lòng tải lại danh sách.')
      setSelectedItem(current => current ? { ...current, payment: { ...current.payment, status: 'REFUNDED', refund: result.refund } } : current)
      await loadData()
    } catch (error: any) {
      setCompleteError(error?.message || 'Không xác nhận được đã hoàn tiền.')
    } finally { setCompletingRefund(false) }
  }

  const handleApproveRefund = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedItem || approvingRefund) return
    const amount = Number(refundAmount)
    if (!Number.isSafeInteger(amount) || amount < 1 || approvalNote.trim().length < 3) {
      setApprovalError('Nhập số tiền hoàn nguyên đồng lớn hơn 0 và lý do xét duyệt ít nhất 3 ký tự.')
      return
    }
    setApprovingRefund(true)
    setApprovalError('')
    try {
      const result = await approveAppointmentRefund(selectedItem.id, amount, approvalNote.trim())
      if (!result?.refund) throw new Error('Chưa nhận được kết quả duyệt. Vui lòng tải lại danh sách.')
      setSelectedItem(current => current ? { ...current, payment: { ...current.payment, refund: result.refund, refundBank: result.refund.refundBank || current.payment?.refundBank } } : current)
      await loadData()
    } catch (error: any) {
      setApprovalError(error?.message || 'Không duyệt được khoản hoàn tiền.')
    } finally { setApprovingRefund(false) }
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const appData = await listReceptionAppointments({ q: '', status: 'all', paymentChannel: isReceptionist && !refundsOnly ? 'counter' : undefined })
      setAppointments(appData || [])
      setCollectionsRefreshKey(value => value + 1)
    } catch (e: any) {
      setError(e?.message || (refundsOnly ? 'Không tải được yêu cầu hoàn tiền.' : 'Không tải được danh sách hóa đơn.'))
    } finally {
      setLoading(false)
    }
  }, [isReceptionist, refundsOnly])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // Danh sách lịch hẹn đã được API giới hạn theo chi nhánh phụ trách.
  const branches = useMemo(() => {
    const scopedBranches = new Map<string, { id: string; name: string }>()
    appointments.forEach(item => {
      if (item.branch?.id) scopedBranches.set(item.branch.id, item.branch)
    })
    return [...scopedBranches.values()]
  }, [appointments])

  useEffect(() => {
    if (selectedBranchId && !branches.some(branch => branch.id === selectedBranchId)) {
      setSelectedBranchId('')
    }
  }, [branches, selectedBranchId])

  const getPatientName = (it: AppointmentRow) =>
    it.patient?.fullName || it.patient?.name || it.patientProfile?.fullName || 'Bệnh nhân'
  const getPatientPhone = (it: AppointmentRow) =>
    it.patient?.phone || it.patientProfile?.phoneNumber || ''
  const getInvoiceCode = (it: AppointmentRow) =>
    `INV-${(it.invoice?.id || it.id).slice(0, 8).toUpperCase()}`
  const getAmount = (it: AppointmentRow) =>
    Number(it.payment?.amount ?? it.invoice?.totalAmount ?? 0)

  const isPaid = (it: AppointmentRow) => {
    const inv = (it.invoice?.status || '').toUpperCase()
    const pay = (it.payment?.status || '').toLowerCase()
    return !isCancelled(it) && (inv === 'PAID' || pay === 'paid' || it.payment?.paid === true)
  }
  const isPending = (it: AppointmentRow) =>
    !isCancelled(it) && !isPaid(it) && (
      (it.invoice?.status || '').toUpperCase() === 'UNPAID' ||
      it.payment?.status === 'unpaid' || ['HOLD', 'CONFIRMED'].includes((it.workflowStatus || '').toUpperCase())
    )
  const isCancelled = (it: AppointmentRow) =>
    (it.workflowStatus || '').toUpperCase() === 'CANCELLED' ||
    (it.invoice?.status || '').toUpperCase() === 'CANCELLED'

  const scopedAppointments = useMemo(() => {
    return appointments.filter((it) => {
      if (refundsOnly && !it.payment?.refund) return false
      const s = q.trim().toLowerCase()
      if (
        s &&
        !getInvoiceCode(it).toLowerCase().includes(s) &&
        !getPatientName(it).toLowerCase().includes(s) &&
        !getPatientPhone(it).toLowerCase().includes(s)
      )
        return false
      if (selectedBranchId && it.branch?.id !== selectedBranchId) return false
      return true
    })
  }, [appointments, q, selectedBranchId, refundsOnly])

  const filtered = scopedAppointments.filter(it => {
    if (statusFilter === 'approved') return it.payment?.refund?.approvalStatus === 'APPROVED'
    if (statusFilter === 'review') return isRefundReviewPending(it)
    if (statusFilter === 'ineligible') return it.payment?.refund?.approvalStatus === 'NOT_ELIGIBLE'
    if (statusFilter === 'paid') return isPaid(it)
    if (statusFilter === 'pending') return isPending(it)
    if (statusFilter === 'cancelled') return isCancelled(it)
    if (statusFilter === 'refund') return !!it.payment?.refund
    return true
  })

  const refundStats = scopedAppointments.reduce((summary, item) => {
    if (item.payment?.refund?.approvalStatus === 'APPROVED') {
      summary.approved++
      summary.amount += Number(item.payment.refund.refundAmount || 0)
    } else if (item.payment?.refund?.approvalStatus === 'NOT_ELIGIBLE') summary.ineligible++
    else if (isRefundReviewPending(item)) summary.review++
    return summary
  }, { approved: 0, review: 0, amount: 0, ineligible: 0 })

  const stats = useMemo(() => {
    let rev = 0
    let paid = 0
    let pend = 0
    let canc = 0
    scopedAppointments.forEach((it) => {
      if (isPaid(it)) {
        if (canViewRevenue) rev += getAmount(it)
        paid++
      } else if (isPending(it)) pend++
      else if (isCancelled(it)) canc++
    })
    return { total: scopedAppointments.length, rev, paid, pend, canc }
  }, [scopedAppointments, canViewRevenue])

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedItem) return
    setSubmittingPay(true)
    setError('')
    try {
      await recordAppointmentPayment({
        token,
        appointmentId: selectedItem.id,
        method: payMethod,
        amount: getAmount(selectedItem),
        note: payNote,
      })
      setSelectedItem(null)
      setPayNote('')
      await loadData()
    } catch (e: any) {
      setError(e?.message || 'Ghi nhận thanh toán thất bại.')
    } finally {
      setSubmittingPay(false)
    }
  }

  const filterTabs = refundsOnly ? [
    { id: 'all', label: 'Tất cả yêu cầu', count: stats.total },
    { id: 'approved', label: 'Chờ chuyển tiền', count: refundStats.approved },
    { id: 'review', label: 'Chờ xét duyệt', count: refundStats.review },
    { id: 'ineligible', label: 'Không hoàn tiền', count: refundStats.ineligible },
  ] : [
    { id: 'all', label: 'Tất cả', count: stats.total },
    { id: 'paid', label: 'Đã thu', count: stats.paid },
    { id: 'pending', label: 'Chờ thu', count: stats.pend },
    { id: 'cancelled', label: 'Đã hủy', count: stats.canc },
    { id: 'refund', label: 'Chờ hoàn tiền' },
  ]

  return (
    <>
      <AdminPageHeader
        title={refundsOnly ? 'Hoàn tiền' : isReceptionist ? 'Thu phí' : role === 'branch_manager' ? 'Thanh toán & Doanh thu' : 'Thanh toán & Hóa đơn'}
        description={refundsOnly ? 'Theo dõi yêu cầu hoàn tiền tại chi nhánh. Mở chi tiết để xem khoản được duyệt và thông tin nhận tiền.' : isReceptionist ? 'Thu tiền mặt hoặc chuyển khoản tại quầy; tra cứu hóa đơn chưa thu và các khoản đã thu tại quầy.' : 'Theo dõi doanh thu, thu tiền trực tiếp và đối soát viện phí.'}
      >
        <AdminButton
          variant="secondary"
          icon={RefreshCw}
          loading={loading}
          onClick={() => {
            if (isReceptionist && view === 'mine') setCollectionsRefreshKey(value => value + 1)
            else void loadData()
          }}
        >
          Làm mới dữ liệu
        </AdminButton>
      </AdminPageHeader>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isReceptionist && !refundsOnly && <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Nội dung thu phí">
        {([['invoices', 'Thu phí bệnh nhân'], ['mine', 'Lịch sử thu tiền của tôi']] as const).map(([value, label]) => (
          <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)} className={`rounded border px-4 py-2 text-xs font-semibold cursor-pointer ${view === value ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>{label}</button>
        ))}
      </div>}

      {isReceptionist && view === 'mine' ? <MyCollectionsPanel refreshKey={collectionsRefreshKey} /> : <>
      {refundsOnly ? <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <AdminStatCard label="Chờ chuyển tiền" value={refundStats.approved} detail="Khoản hoàn đã được duyệt" tone="slate" />
        <AdminStatCard label="Chờ xét duyệt" value={refundStats.review} detail="Cần quản lý chi nhánh xem xét" tone="amber" />
        <AdminStatCard label="Tổng tiền chờ hoàn" value={money(refundStats.amount)} detail="Chỉ tính khoản đã được duyệt" tone="slate" />
      </div> : <div className={`mt-5 grid gap-4 sm:grid-cols-2 ${canViewRevenue ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
        {canViewRevenue && (
          <AdminStatCard
            label="Doanh thu đã thu"
            value={money(stats.rev)}
            detail={`${stats.paid} hóa đơn thành công`}
            tone="emerald"
          />
        )}
        <AdminStatCard
          label="Đã thanh toán"
          value={stats.paid}
          detail="Hoàn tất"
          tone="slate"
        />
        <AdminStatCard
          label="Chờ thanh toán"
          value={stats.pend}
          detail="Cần thu tại quầy"
          tone="amber"
        />
        <AdminStatCard
          label="Đã hủy / Hoàn tiền"
          value={stats.canc}
          detail="Không ghi nhận thu"
          tone="slate"
        />
      </div>}

      <AdminTableCard className="mt-5">
        <div className="border-b border-slate-100 p-4 flex flex-wrap items-center justify-between gap-3">
          <FilterTabs
            tabs={filterTabs}
            active={statusFilter}
            onChange={(id) => setStatusFilter(id)}
          />
          <div className="flex gap-2 w-full sm:w-auto">
            <select
              aria-label="Lọc hóa đơn theo chi nhánh phụ trách"
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              disabled={branches.length <= 1}
              className="text-xs rounded border border-slate-200 px-2.5 py-1.5 bg-white"
            >
              <option value="">{branches.length === 1 ? branches[0].name : branches.length > 1 ? 'Tất cả chi nhánh phụ trách' : 'Chưa có dữ liệu chi nhánh'}</option>
              {branches.length > 1 && branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <div className="relative flex-1 sm:w-60">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm mã HĐ, tên, SĐT..."
                className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded border border-slate-200 focus:outline-none focus:border-emerald-600 bg-white"
              />
            </div>
          </div>
        </div>

        <AdminTable minWidth={refundsOnly ? 'min-w-[1100px]' : 'min-w-[850px]'} className={refundsOnly ? 'whitespace-nowrap' : ''}>
          <AdminTableHead columns={tableColumns} />
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <AdminTableLoading colSpan={columnCount} message={refundsOnly ? 'Đang tải yêu cầu hoàn tiền…' : 'Đang tải danh sách hóa đơn…'} />
            ) : filtered.length === 0 ? (
              <AdminTableEmpty colSpan={columnCount} message={refundsOnly ? 'Chưa có yêu cầu hoàn tiền phù hợp.' : 'Chưa có dữ liệu hóa đơn phù hợp.'} />
            ) : (
              filtered.map((it) => {
                const paid = isPaid(it)
                const pending = isPending(it)
                const canc = isCancelled(it)
                const amt = refundsOnly ? it.payment?.refund?.refundAmount : getAmount(it)
                return (
                  <tr key={it.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-bold text-black-900 text-xs">
                      {getInvoiceCode(it)}
                    </td>
                    <td className="px-5 py-3.5">
                      <strong className="text-xs font-semibold text-slate-900 block">
                        {getPatientName(it)}
                      </strong>
                      <p className="text-xs text-slate-400 font-mono">{getPatientPhone(it)}</p>
                    </td>
                    {refundsOnly ? <>
                      <td className="px-5 py-3.5 text-right text-xs font-medium tabular-nums text-slate-700 whitespace-nowrap">
                        {it.payment?.refund?.paidAmount == null ? '—' : money(it.payment.refund.paidAmount)}
                      </td>
                      <td className="px-5 py-3.5 text-right text-xs font-medium tabular-nums text-slate-700 whitespace-nowrap">
                        {it.payment?.refund?.refundRate == null ? '—' : `${Number(it.payment.refund.refundRate).toLocaleString('vi-VN')}%`}
                      </td>
                      <td className="px-5 py-3.5 text-right text-xs tabular-nums text-slate-700 whitespace-nowrap">
                        <span className="font-medium">{it.payment?.refund?.retainedAmount == null ? '—' : money(it.payment.refund.retainedAmount)}</span>
                        {it.payment?.refund?.refundRate != null && <span className="ml-1.5 text-slate-500">({Number((100 - Number(it.payment.refund.refundRate)).toFixed(2)).toLocaleString('vi-VN')}%)</span>}
                      </td>
                    </> : <>
                    <td className="px-5 py-3.5 text-xs">
                      <p className="font-medium text-slate-800">
                        {it.servicePackage?.name || it.specialty?.name || 'Khám bệnh'}
                      </p>
                      <p className="text-slate-400">{it.appointmentDate || '—'}</p>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-700 font-medium">
                      {it.doctor?.fullName || it.doctor?.name || '—'}
                    </td>
                    </>}
                    <td className="px-5 py-3.5 text-right font-semibold text-slate-900 text-xs tabular-nums whitespace-nowrap">
                      {amt == null ? 'Chờ duyệt' : money(amt)}
                    </td>
                    {showCollectionMethod && <td className="px-5 py-3.5 text-xs text-slate-700">
                      {String(it.payment?.method || '').toLowerCase() === 'cash' ? 'Tiền mặt' : String(it.payment?.method || '').toLowerCase() === 'vietqr' ? 'Chuyển khoản tại quầy' : 'Chưa thu'}
                    </td>}
                    <td className="px-5 py-3.5 text-center">
                      <StatusBadge
                        tone={refundsOnly ? isRefundReviewPending(it) ? 'amber' : 'slate' : paid ? 'emerald' : pending ? 'amber' : canc ? 'slate' : 'blue'}
                      >
                        {refundsOnly ? refundStatusLabel(it) : paid ? 'Đã thu' : pending ? 'Chờ thu' : canc ? 'Đã hủy' : it.workflowStatus}
                      </StatusBadge>
                      {!refundsOnly && it.payment?.refund && <span className="mt-1 block text-xs text-amber-800">
                        {it.payment.refund.approvalStatus === 'APPROVED' ? `Chờ hoàn ${money(it.payment.refund.refundAmount)} (${it.payment.refund.refundRate}%)` : refundStatusLabel(it)}
                      </span>}
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <AdminButton
                        variant="secondary"
                        size="xs"
                        onClick={() => setSelectedItem(it)}
                      >
                        Chi tiết
                      </AdminButton>
                      {!refundsOnly && isStaff && pending && (
                        <AdminButton
                          variant="primary"
                          size="xs"
                          className="ml-1.5"
                          onClick={() => {
                            setSelectedItem(it)
                            setPayMethod('cash')
                          }}
                        >
                          Thu tiền
                        </AdminButton>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </AdminTable>
        <AdminTableFooter total={filtered.length} label={refundsOnly ? 'yêu cầu hoàn tiền' : 'hóa đơn'} />
      </AdminTableCard>
      </>}

      {/* DETAIL & PAYMENT MODAL */}
      <AdminModal
        isOpen={Boolean(selectedItem)}
        onClose={() => setSelectedItem(null)}
        title={selectedItem ? getInvoiceCode(selectedItem) : ''}
        maxWidth="2xl"
        loading={submittingPay || approvingRefund}
      >
        {selectedItem && (
          <div className="space-y-5 text-sm">
            <section className="space-y-3">
              <h3 className="font-semibold text-slate-900">Thông tin bệnh nhân</h3>
              <DetailFields items={[
                ['Họ và tên', getPatientName(selectedItem)],
                ['Mã bệnh nhân', selectedItem.patient?.patientCode],
                ['Ngày sinh', displayDate(selectedItem.patient?.dateOfBirth)],
                ['Giới tính', ({ male: 'Nam', female: 'Nữ', other: 'Khác' } as Record<string, string>)[selectedItem.patient?.gender]],
                ['Số điện thoại', getPatientPhone(selectedItem)],
                ['Email', selectedItem.patient?.email],
                ['Địa chỉ bệnh nhân', selectedItem.patient?.address],
              ]} />
            </section>

            <section className="space-y-3 border-t border-slate-200 pt-4">
              <h3 className="font-semibold text-slate-900">Thông tin lịch khám</h3>
              <DetailFields items={[
                ['Mã lịch khám', selectedItem.bookingCode || selectedItem.ticket],
                ['Mã đơn đặt khám', selectedItem.orderCode],
                ['Ngày khám', displayDate(selectedItem.appointmentDate)],
                ['Giờ khám', selectedItem.startTime ? `${selectedItem.startTime}${selectedItem.endTime ? ` – ${selectedItem.endTime}` : ''}` : null],
                ['Bác sĩ', selectedItem.doctor?.fullName],
                ['Chuyên khoa', selectedItem.specialty?.name || selectedItem.doctor?.specialtyName],
                ['Dịch vụ / Gói khám', selectedItem.servicePackage?.name || selectedItem.specialty?.name],
                ['Hình thức đặt khám', selectedItem.bookingMethod?.name],
                ['Chi nhánh', selectedItem.branch?.name],
                ['Địa chỉ chi nhánh', selectedItem.branch?.address],
                ['Phòng khám', selectedItem.isTelehealth ? 'Khám trực tuyến' : selectedItem.clinicRoomName],
                ['Trạng thái lịch khám', APPOINTMENT_STATUSES[selectedItem.workflowStatus] || selectedItem.workflowStatus],
                ['Thời điểm đặt lịch', displayDate(selectedItem.createdAt, true)],
                ['Nguồn đặt lịch', selectedItem.createdByStaff ? 'Tại phòng khám' : 'Trực tuyến'],
                ['Lý do khám / Triệu chứng', selectedItem.symptoms],
              ]} />
            </section>

            {(selectedItem.workflowStatus === 'CANCELLED' || selectedItem.payment?.refund) && <section className="space-y-3 border-t border-slate-200 pt-4">
              <h3 className="font-semibold text-slate-900">Thông tin hủy lịch</h3>
              <DetailFields items={[
                ['Thời điểm hủy', displayDate(selectedItem.cancellation?.cancelledAt || selectedItem.payment?.refund?.requestedAt, true)],
                ['Người hủy', selectedItem.cancellation?.cancelledBy?.fullName],
                ['Vai trò người hủy', CANCELLATION_ROLES[selectedItem.cancellation?.cancelledBy?.role]],
                ['Lý do hủy', selectedItem.cancellation?.reason || selectedItem.payment?.refund?.reason],
              ]} />
            </section>}

            <section className="space-y-3 border-t border-slate-200 pt-4">
              <h3 className="font-semibold text-slate-900">Thông tin thanh toán</h3>
              <DetailFields items={[
                ['Tổng tiền hóa đơn', money(getAmount(selectedItem))],
                ['Thực trả của lịch này', selectedItem.payment?.refund?.paidAmount != null ? money(selectedItem.payment.refund.paidAmount) : null],
                ['Phương thức thanh toán', PAYMENT_METHODS[selectedItem.payment?.method]],
                ['Thời điểm thanh toán', displayDate(selectedItem.payment?.paidAt, true)],
                ['Mã giao dịch', selectedItem.payment?.transactionId],
              ]} />
            </section>

            {selectedItem.payment?.refund && <div className="border-t border-slate-200 pt-4 text-sm leading-6 text-slate-700">
              {selectedItem.payment.refund.approvalStatus === 'APPROVED' ? <>
                <p className="font-semibold text-slate-900">{selectedItem.payment.refund.approvedBy === 'SYSTEM' ? 'Khoản hoàn đã được tự động duyệt.' : 'Quản lý chi nhánh đã duyệt khoản hoàn.'} Đang chờ chuyển tiền.</p>
                <p>Thực trả cho lịch này: {money(selectedItem.payment.refund.paidAmount)}</p>
                <p>Khoản giữ lại: {money(selectedItem.payment.refund.retainedAmount)}</p>
                <p className="font-semibold">Số tiền hoàn ({selectedItem.payment.refund.refundRate}%): {money(selectedItem.payment.refund.refundAmount)}</p>
                {selectedItem.payment.refund.approvalNote && <p>Lý do xét duyệt: {selectedItem.payment.refund.approvalNote}</p>}
              </> : selectedItem.payment.refund.approvalStatus === 'NOT_ELIGIBLE'
                ? <p>Không hoàn tiền theo chính sách: hủy dưới 2 giờ trước giờ khám hoặc thiếu dữ liệu tính tiền. Số tiền hoàn: 0 đ. Không cần xét duyệt.</p>
                : <p>Yêu cầu theo chính sách cũ hoặc do phòng khám hủy đang chờ quản lý chi nhánh xét duyệt.</p>}
            </div>}

            {/* Bank details belong to this appointment, including family bookings. */}
            {selectedItem.payment?.refundBank && (
              <div className="border-t border-slate-200 pt-4 space-y-3">
                <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                  <RotateCcw className="w-4 h-4 text-slate-500" aria-hidden="true" />
                  <span>Thông tin nhận hoàn tiền</span>
                </div>

                <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <span className="text-slate-500">Ngân hàng:</span>
                    <p className="font-semibold text-slate-800">
                      {selectedItem.payment.refundBank.bankName || selectedItem.payment.refundBank.bankCode}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Số tài khoản:</span>
                    <p className="font-mono font-semibold text-slate-900 text-sm break-all">
                      {selectedItem.payment.refundBank.accountNumber}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-500">Chủ tài khoản thụ hưởng:</span>
                    <p className="font-semibold text-slate-900 text-sm break-words">
                      {selectedItem.payment.refundBank.accountName}
                    </p>
                  </div>
                </div>

                {/* Mã QR VietQR để quét chuyển khoản hoàn tiền ngay lập tức */}
                {selectedItem.payment.refund?.approvalStatus === 'APPROVED' && selectedItem.payment.refund.refundAmount > 0 ? <div className="pt-3 border-t border-slate-200 flex flex-col items-center">
                  <p className="text-[11px] font-medium text-slate-700 mb-2">
                    Mở App Ngân hàng quét mã VietQR để hoàn tiền nhanh:
                  </p>
                  <img
                    src={`https://img.vietqr.io/image/${selectedItem.payment.refundBank.bankBin || selectedItem.payment.refundBank.bankCode}-${selectedItem.payment.refundBank.accountNumber}-compact2.png?amount=${selectedItem.payment.refund.refundAmount}&addInfo=${encodeURIComponent(`HOAN TIEN ${selectedItem.bookingCode || selectedItem.id.slice(0, 8).toUpperCase()}`)}&accountName=${encodeURIComponent(selectedItem.payment.refundBank.accountName || '')}`}
                    alt="VietQR Refund"
                    className="w-44 h-44 rounded border border-slate-200 shadow-xs bg-white p-1.5"
                  />
                  <span className="text-[10px] text-slate-500 mt-1.5 text-center">
                    Số tiền chuyển khoản: <strong className="text-slate-900">{money(selectedItem.payment.refund.refundAmount)}</strong>
                  </span>
                  {role === 'branch_manager' && (
                    <div className="mt-4 w-full space-y-2">
                      {completeError && <p role="alert" className="text-xs text-rose-700 text-center">{completeError}</p>}
                      <button
                        type="button"
                        disabled={completingRefund}
                        onClick={() => void handleCompleteRefund()}
                        className="w-full inline-flex items-center justify-center gap-2 rounded bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {completingRefund ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle className="h-4 w-4" aria-hidden="true" />}
                        {completingRefund ? 'Đang xác nhận…' : 'Xác nhận đã chuyển hoàn tiền'}
                      </button>
                    </div>
                  )}
                </div> : selectedItem.payment.refund?.approvalStatus === 'COMPLETED' ? (
                  <p className="text-sm font-medium text-emerald-700 flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Đã xác nhận chuyển khoản hoàn tiền cho bệnh nhân.
                  </p>
                ) : <p className="text-sm text-slate-500">Mã chuyển tiền sẽ hiển thị sau khi khoản hoàn được duyệt.</p>}
              </div>
            )}

            {isRefundReviewPending(selectedItem) && (
              role === 'branch_manager' ? <form onSubmit={handleApproveRefund} className="space-y-3 border-t border-slate-200 pt-4">
                <h3 className="font-semibold text-slate-900">Xét duyệt khoản hoàn</h3>
                <div>
                  <label htmlFor="refund-approval-amount" className="mb-1.5 block text-sm text-slate-700">Số tiền hoàn (đ)</label>
                  <input id="refund-approval-amount" type="number" inputMode="numeric" min={1} max={selectedItem.payment.refund.paidAmount ?? undefined} step={1} required disabled={approvingRefund} value={refundAmount} onChange={event => setRefundAmount(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500" />
                  <p className="mt-1 text-xs text-slate-500">{selectedItem.payment.refund.paidAmount != null ? `Tối đa ${money(selectedItem.payment.refund.paidAmount)}, là khoản thực trả của lịch này.` : 'Số tiền hoàn không được vượt khoản thực trả của lịch này.'}</p>
                </div>
                <div>
                  <label htmlFor="refund-approval-note" className="mb-1.5 block text-sm text-slate-700">Lý do xét duyệt</label>
                  <textarea id="refund-approval-note" required minLength={3} maxLength={500} rows={2} disabled={approvingRefund} value={approvalNote} onChange={event => setApprovalNote(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500" />
                </div>
                <p className="text-xs leading-5 text-slate-500">Duyệt để chuyển yêu cầu sang chờ chuyển tiền. Thao tác này chưa chuyển tiền cho bệnh nhân.</p>
                {approvalError && <p role="alert" className="text-sm text-rose-700">{approvalError}</p>}
                <button type="submit" disabled={approvingRefund || !refundAmount || approvalNote.trim().length < 3} className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {approvingRefund && <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  {approvingRefund ? 'Đang duyệt…' : 'Duyệt hoàn tiền'}
                </button>
              </form> : <p className="border-t border-slate-200 pt-4 text-sm text-slate-600">Chỉ Quản lý chi nhánh có quyền duyệt yêu cầu này. Nhân viên tiếp nhận theo dõi kết quả tại đây.</p>
            )}

            {!refundsOnly && isPending(selectedItem) && isStaff && (
              <form onSubmit={handleConfirmPayment} className="space-y-3 pt-3 border-t border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Ghi nhận thu tiền trực tiếp
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={`flex items-center gap-2 rounded border p-2.5 text-xs font-semibold cursor-pointer ${
                      payMethod === 'cash'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-900'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="method"
                      checked={payMethod === 'cash'}
                      onChange={() => setPayMethod('cash')}
                    />{' '}
                    Tiền mặt
                  </label>
                  <label
                    className={`flex items-center gap-2 rounded border p-2.5 text-xs font-semibold cursor-pointer ${
                      payMethod === 'transfer'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-900'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="method"
                      checked={payMethod === 'transfer'}
                      onChange={() => setPayMethod('transfer')}
                    />{' '}
                    Chuyển khoản QR
                  </label>
                </div>
                <input
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="Ghi chú thu ngân (nếu có)..."
                  className="w-full px-3 py-1.5 text-xs rounded border border-slate-200 focus:outline-none focus:border-emerald-600 bg-white"
                />
                <AdminButton
                  variant="primary"
                  type="submit"
                  loading={submittingPay}
                  className="w-full py-2.5"
                >
                  Xác nhận đã thu {money(getAmount(selectedItem))}
                </AdminButton>
              </form>
            )}
          </div>
        )}
      </AdminModal>
    </>
  )
}
