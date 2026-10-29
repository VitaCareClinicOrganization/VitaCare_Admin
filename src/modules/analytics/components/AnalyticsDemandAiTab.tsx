'use client'

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Users,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  Activity,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react'
import { useAuth } from '@/common/hooks/useAuth'
import { fetchDemandInsights, fetchAiExecutiveReport } from '@/modules/admin/services/stats'
import { SearchAnalyticsChart } from './SearchAnalyticsChart'
import RecommendationPerformanceSection from './RecommendationPerformanceSection'

interface AnalyticsDemandAiTabProps {
  branchFilter?: string
  branches?: any[]
  timeFilter?: string
  startDate?: string
  endDate?: string
}

export default function AnalyticsDemandAiTab({
  branchFilter = 'all',
  branches = [],
  timeFilter = 'month',
  startDate,
  endDate,
}: AnalyticsDemandAiTabProps) {
  const { token, hasRole } = useAuth()
  const [metrics, setMetrics] = useState<any>(null)
  const [aiReport, setAiReport] = useState<any>(null)
  const [loadingMetrics, setLoadingMetrics] = useState(true)
  const [metricsError, setMetricsError] = useState('')
  const [generatingAi, setGeneratingAi] = useState(false)
  const canViewRecommendations = hasRole('chain_manager', 'super_admin')

  // 1. Tải số liệu thống kê (Demand Metrics)
  const loadMetrics = useCallback(async () => {
    setLoadingMetrics(true)
    setMetricsError('')
    try {
      const res = await fetchDemandInsights({
        token: token || undefined,
        timeFilter,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        branchId: branchFilter !== 'all' ? branchFilter : undefined,
      })
      if (res) setMetrics(res)
    } catch (err) {
      console.warn('Failed to load demand metrics:', err)
      setMetrics(null)
      setMetricsError('Không thể tải số liệu. Vui lòng thử lại.')
    } finally {
      setLoadingMetrics(false)
    }
  }, [token, timeFilter, branchFilter, startDate, endDate])

  // 2. Tải hoặc làm mới báo cáo AI
  const loadAiReport = useCallback(
    async (forceRefresh = false) => {
      if (forceRefresh) setGeneratingAi(true)
      try {
        const res = await fetchAiExecutiveReport({
          token: token || undefined,
          timeFilter,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          branchId: branchFilter !== 'all' ? branchFilter : undefined,
          forceRefresh,
        })
        if (res) setAiReport(res)
      } catch (err) {
        console.warn('Failed to fetch AI report:', err)
      } finally {
        if (forceRefresh) setGeneratingAi(false)
      }
    },
    [token, timeFilter, branchFilter, startDate, endDate]
  )

  useEffect(() => {
    void loadMetrics()
    void loadAiReport(false)
  }, [loadMetrics, loadAiReport])

  const kpis = metrics?.kpis || {
    totalSearches: 0,
    totalPackageViews: 0,
    totalBookings: 0,
    overallConversionRate: null,
    topSpecialtyDemand: 'Đang tải...',
  }

  const maxUnmatchedCount = useMemo(() => {
    return Math.max(1, ...(metrics?.unmatchedSearches || []).map((s: any) => s.searchCount || 0))
  }, [metrics?.unmatchedSearches])

  // Tổng hợp cơ cấu tuổi toàn viện để vẽ biểu đồ tổng quát
  const ageTotals = useMemo(() => {
    const demos = metrics?.demographics || []
    const sum = {
      under12: 0,
      teens: 0,
      youngAdults: 0,
      middleAged: 0,
      elderly: 0,
      total: 0,
      male: 0,
      female: 0,
    }
    demos.forEach((d: any) => {
      sum.under12 += Number(d.ageGroups?.under12 || 0)
      sum.teens += Number(d.ageGroups?.teens12to18 || 0)
      sum.youngAdults += Number(d.ageGroups?.youngAdults19to35 || 0)
      sum.middleAged += Number(d.ageGroups?.middleAged36to55 || 0)
      sum.elderly += Number(d.ageGroups?.elderlyOver55 || 0)
      sum.total += Number(d.totalPatients || 0)
      sum.male += Number(d.maleCount || 0)
      sum.female += Number(d.femaleCount || 0)
    })
    return sum
  }, [metrics?.demographics])

  return (
    <section aria-label="Thống kê nhu cầu" className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="space-y-6 p-4 sm:p-5">
        <h2 className="text-base font-semibold text-slate-900">Tổng quan nhu cầu</h2>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              <Activity className="w-3.5 h-3.5 text-emerald-700" />
              <span>Phạm vi phân tích:</span>
              <span className="text-emerald-800 font-bold">
                {branchFilter === 'all'
                  ? 'Toàn bộ chi nhánh'
                  : branches.find((b) => b.id === branchFilter)?.name || 'Chi nhánh'}
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-900 font-bold">
                {startDate && endDate
                  ? `${startDate} → ${endDate}`
                  : timeFilter === 'today'
                    ? 'Hôm nay'
                    : timeFilter === 'week'
                      ? '7 ngày gần nhất'
                      : timeFilter === 'quarter'
                        ? '90 ngày gần nhất'
                        : '30 ngày gần nhất'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => { void loadMetrics(); void loadAiReport(false) }}
            disabled={loadingMetrics}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingMetrics ? 'animate-spin' : ''}`} />
            <span>Tải lại</span>
          </button>
        </div>
        {loadingMetrics ? (
          <p role="status" className="py-12 text-center text-sm text-slate-500">Đang tải số liệu...</p>
        ) : metricsError ? (
          <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
            {metricsError}
            <button type="button" className="ml-3 underline" onClick={() => void loadMetrics()}>Thử lại</button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {kpis.totalBookings > 0 && <p className="text-xs text-slate-500">Chuyên khoa được đặt nhiều nhất: <strong className="font-medium text-slate-800">{kpis.topSpecialtyDemand}</strong></p>}
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  {
                    label: 'Lượt tìm kiếm',
                    value: kpis.totalSearches.toLocaleString('vi-VN'),
                    description: metrics?.searchFunnel && kpis.totalSearches > 0
                      ? metrics.searchFunnel.clicked + ' lượt tìm có bấm kết quả · ' + metrics.searchFunnel.booked + ' lượt có đặt thành công'
                      : 'Các lượt tìm kiếm được ghi nhận trong kỳ',
                  },
                  {
                    label: 'Lượt xem gói khám',
                    value: kpis.totalPackageViews.toLocaleString('vi-VN'),
                    description: 'Lượt xem trang chi tiết gói khám trong kỳ',
                  },
                  {
                    label: 'Tỷ lệ đặt từ lượt xem (CVR)',
                    value: kpis.overallConversionRate == null ? '—' : kpis.overallConversionRate.toLocaleString('vi-VN') + '%',
                    description: kpis.totalPackageViews
                      ? (kpis.convertedViewCount || 0) + '/' + kpis.totalPackageViews + ' lượt xem dẫn đến đặt thành công' + (kpis.totalPackageViews < 30 ? ' (ít dữ liệu)' : '')
                      : 'Chưa có lượt xem được ghi nhận',
                  },
                ].map(item => <div key={item.label} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-500">{item.label}</p>
                  <p className="text-2xl font-semibold tabular-nums text-slate-900">{item.value}</p>
                  <p className="text-xs leading-5 text-slate-500">{item.description}</p>
                </div>)}
                {canViewRecommendations && <RecommendationPerformanceSection timeFilter={timeFilter} startDate={startDate} endDate={endDate} />}
              </div>
              <p className="text-[11px] leading-5 text-slate-500">
                Theo giờ Việt Nam. CVR = lượt xem dẫn đến đặt thành công / lượt xem gói; không tính lịch chỉ mới giữ chỗ.
                {kpis.unattributedBookings > 0 && ' Có ' + kpis.unattributedBookings + ' lịch đặt chưa liên kết được với lượt xem/tìm kiếm nên chưa tính vào CVR.'}
              </p>
              {metrics?.searchFunnel && (metrics.searchFunnel.empty > 0 || metrics.searchFunnel.errors + metrics.searchFunnel.partial > 0) && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                  {metrics.searchFunnel.empty > 0 && metrics.searchFunnel.empty + ' lượt tìm không có kết quả. '}
                  {metrics.searchFunnel.errors + metrics.searchFunnel.partial > 0 && metrics.searchFunnel.errors + metrics.searchFunnel.partial + ' lượt tìm gặp lỗi hoặc tải chưa đầy đủ.'}
                </p>
              )}
            </div>
            {/* ── HÀNG 2: BIỂU ĐỒ TỪ KHÓA TÌM KIẾM (SHADCN/UI CHART) & PHỄU CHUYỂN ĐỔI GÓI KHÁM ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* 1. Cột trái: Biểu đồ Shadcn / Recharts Top Từ khóa & Nhu cầu chưa đáp ứng */}
              <div className="space-y-4">
                <SearchAnalyticsChart
                  data={(metrics?.topSearches || []).slice(0, 5).map((s: any) => ({
                    keyword: s.query,
                    count: Number(s.searchCount) || 0,
                  }))}
                  title="Top Từ khóa tìm kiếm"
                  description="Các truy vấn tìm kiếm hoàn tất trong kỳ"
                  layout="vertical"
                />

                {/* Phân mục: Nhu cầu chưa có gói khám đáp ứng (Market Gap) */}
                <div className="p-4 bg-white rounded border border-slate-200/90 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[11.5px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                      <span>Tìm kiếm chưa có kết quả</span>
                    </h4>
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      {(metrics?.unmatchedSearches || []).length} kết quả
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {(metrics?.unmatchedSearches || []).length > 0 ? (
                      metrics.unmatchedSearches.slice(0, 4).map((s: any, idx: number) => {
                        const pct = Math.min(100, Math.max(15, Math.round((s.searchCount / maxUnmatchedCount) * 100)))
                        return (
                          <div key={idx} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium text-amber-950 truncate text-[11.5px] pr-2" title={s.query}>
                                • {s.query}
                              </span>
                              <span className="font-bold text-amber-800 text-[10.5px] shrink-0 tabular-nums">
                                {s.searchCount} lượt
                              </span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-amber-100/60 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="py-2.5 text-center text-[11px] text-amber-800/70">
                        Chưa ghi nhận lượt tìm kiếm không có kết quả trong kỳ
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Cột phải: Bảng Hiệu quả Đặt khám & Thanh Phễu Chuyển đổi trực quan */}
              <div className="lg:col-span-2 p-5 bg-white rounded border border-slate-200/90 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Hiệu quả Đặt khám & Phễu Chuyển đổi Gói khám</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">Lượt xem trong kỳ có lịch thành công được liên kết. Không suy ra rời bỏ từ lượt xem.</p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-500">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-600" />Đã đặt</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" />Chưa ghi nhận lịch</span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-semibold text-[11px]">
                        <th className="pb-2">Gói khám dịch vụ</th>
                        <th className="pb-2">Chuyên khoa</th>
                        <th className="pb-2 text-right">Lượt xem</th>
                        <th className="pb-2 text-right">Xem → đặt thành công</th>
                        <th className="pb-2 pl-4">Phễu chuyển đổi</th>
                        <th className="pb-2 text-right">CVR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {(metrics?.packageFunnels || []).length > 0 ? (
                        metrics.packageFunnels.slice(0, 8).map((p: any) => {
                          const conv = Number(p.conversionRate) || 0
                          const drop = Number(p.dropOffRate) || 0
                          return (
                            <tr key={p.packageId} className="hover:bg-slate-50/70 transition">
                              <td className="py-2.5 font-bold text-slate-900 max-w-[180px] truncate" title={p.name}>
                                {p.name}
                              </td>
                              <td className="py-2.5 text-slate-500">{p.specialtyName}</td>
                              <td className="py-2.5 text-right font-semibold tabular-nums">{p.views}</td>
                              <td className="py-2.5 text-right font-bold text-emerald-700 tabular-nums">{p.bookings}<div className="text-[10px] font-normal text-slate-400">{p.successfulBookings} lịch trong kỳ</div></td>
                              <td className="py-2.5 pl-4 min-w-[140px]">
                                {/* Thanh tỷ lệ chuyển đổi trực quan kép */}
                                <div className="flex items-center gap-2">
                                  <div className="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden flex">
                                    <div
                                      className="h-full bg-emerald-600 transition-all"
                                      style={{ width: `${conv}%` }}
                                      title={`Chuyển đổi: ${conv}%`}
                                    />
                                    <div
                                      className="h-full bg-rose-400 transition-all"
                                      style={{ width: `${drop}%` }}
                                      title={`Chưa ghi nhận lịch thành công: ${drop}%`}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td className="py-2.5 text-right">
                                <span className={`px-2 py-0.5 rounded font-bold text-[10.5px] ${
                                  conv > 50
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : conv > 0
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {p.conversionRate == null ? '—' : `${conv}%`}
                                </span>
                                {p.lowSample && <div className="mt-1 text-[10px] text-slate-400">Ít dữ liệu</div>}
                              </td>
                            </tr>
                          )
                        })
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400">
                            Chưa có dữ liệu gói khám trong kỳ
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ── HÀNG 3: BẢNG & BIỂU ĐỒ PHÂN KHÚC NHÂN KHẨU HỌC THEO CHUYÊN KHOA ── */}
            <div className="p-5 bg-white rounded border border-slate-200/90 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Phân khúc Nhân khẩu học (Độ tuổi & Giới tính) theo Chuyên khoa</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Biểu đồ cơ cấu nhóm tuổi và tỷ lệ phân bổ giới tính theo dữ liệu khám bệnh thực tế</p>
                </div>
                {/* Chú giải màu sắc các nhóm tuổi */}
                <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-600">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-xs bg-sky-400" />&lt;12t</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-xs bg-blue-500" />12-18t</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-xs bg-indigo-500" />19-35t</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-xs bg-emerald-600" />36-55t</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-xs bg-amber-500" />&gt;55t</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-semibold text-[11px]">
                      <th className="pb-2.5 pr-3">Chuyên khoa</th>
                      <th className="pb-2.5 px-2 text-center w-20">Tổng ca</th>
                      <th className="pb-2.5 px-3 min-w-[175px]">Tỷ lệ Giới tính</th>
                      <th className="pb-2.5 px-3 min-w-[180px]">Cơ cấu Nhóm tuổi (Cột phân tầng)</th>
                      <th className="pb-2.5 px-1 text-center w-14 text-sky-700">&lt;12t</th>
                      <th className="pb-2.5 px-1 text-center w-14 text-blue-700">12-18t</th>
                      <th className="pb-2.5 px-1 text-center w-14 text-indigo-700">19-35t</th>
                      <th className="pb-2.5 px-1 text-center w-14 text-emerald-700">36-55t</th>
                      <th className="pb-2.5 px-1 text-center w-14 text-amber-700">&gt;55t</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {(metrics?.demographics || []).length > 0 ? (
                      metrics.demographics.map((d: any, idx: number) => {
                        const total = Math.max(1, Number(d.totalPatients || 0))
                        const malePct = Math.round((Number(d.maleCount || 0) / total) * 100)
                        const femalePct = Math.round((Number(d.femaleCount || 0) / total) * 100)

                        const u12Pct = Math.round((Number(d.ageGroups?.under12 || 0) / total) * 100)
                        const t18Pct = Math.round((Number(d.ageGroups?.teens12to18 || 0) / total) * 100)
                        const y35Pct = Math.round((Number(d.ageGroups?.youngAdults19to35 || 0) / total) * 100)
                        const m55Pct = Math.round((Number(d.ageGroups?.middleAged36to55 || 0) / total) * 100)
                        const o55Pct = Math.round((Number(d.ageGroups?.elderlyOver55 || 0) / total) * 100)

                        const sortedAges = [
                          { label: '<12t', count: Number(d.ageGroups?.under12 || 0), pct: u12Pct },
                          { label: '12-18t', count: Number(d.ageGroups?.teens12to18 || 0), pct: t18Pct },
                          { label: '19-35t', count: Number(d.ageGroups?.youngAdults19to35 || 0), pct: y35Pct },
                          { label: '36-55t', count: Number(d.ageGroups?.middleAged36to55 || 0), pct: m55Pct },
                          { label: '>55t', count: Number(d.ageGroups?.elderlyOver55 || 0), pct: o55Pct },
                        ].sort((a, b) => b.count - a.count)
                        const topAge = sortedAges[0]?.count > 0 ? `${sortedAges[0].label} (${sortedAges[0].pct}%)` : 'Chưa có'

                        return (
                          <tr key={idx} className="hover:bg-slate-50/70 transition">
                            <td className="py-2.5 pr-3 font-bold text-slate-900 whitespace-nowrap">{d.specialtyName}</td>
                            <td className="py-2.5 px-2 text-center font-bold text-emerald-800 tabular-nums">{d.totalPatients}</td>

                            {/* Cột Tỷ lệ Giới tính trực quan */}
                            <td className="py-2.5 px-3">
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold whitespace-nowrap">
                                  <span>{d.maleCount} Nam ({malePct}%)</span>
                                  <span>{d.femaleCount} Nữ ({femalePct}%)</span>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden flex">
                                  <div className="h-full bg-blue-600 transition-all" style={{ width: `${malePct}%` }} title={`Nam: ${malePct}%`} />
                                  <div className="h-full bg-rose-500 transition-all" style={{ width: `${femalePct}%` }} title={`Nữ: ${femalePct}%`} />
                                </div>
                              </div>
                            </td>

                            {/* Cột Cơ cấu Độ tuổi phân tầng trực quan (Đồng bộ cấu trúc & chiều cao với cột Giới tính) */}
                            <td className="py-2.5 px-3">
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold whitespace-nowrap">
                                  <span>Nhóm tuổi chủ đạo</span>
                                  <span className="font-bold text-slate-700">{topAge}</span>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden flex">
                                  {u12Pct > 0 && <div className="h-full bg-sky-400 transition-all" style={{ width: `${u12Pct}%` }} title={`Trẻ em (<12): ${d.ageGroups?.under12} ca (${u12Pct}%)`} />}
                                  {t18Pct > 0 && <div className="h-full bg-blue-500 transition-all" style={{ width: `${t18Pct}%` }} title={`Vị thành niên (12-18): ${d.ageGroups?.teens12to18} ca (${t18Pct}%)`} />}
                                  {y35Pct > 0 && <div className="h-full bg-indigo-500 transition-all" style={{ width: `${y35Pct}%` }} title={`Thanh niên (19-35): ${d.ageGroups?.youngAdults19to35} ca (${y35Pct}%)`} />}
                                  {m55Pct > 0 && <div className="h-full bg-emerald-600 transition-all" style={{ width: `${m55Pct}%` }} title={`Trung niên (36-55): ${d.ageGroups?.middleAged36to55} ca (${m55Pct}%)`} />}
                                  {o55Pct > 0 && <div className="h-full bg-amber-500 transition-all" style={{ width: `${o55Pct}%` }} title={`Cao tuổi (>55): ${d.ageGroups?.elderlyOver55} ca (${o55Pct}%)`} />}
                                </div>
                              </div>
                            </td>

                            <td className="py-2.5 px-1 text-center text-slate-600 tabular-nums">{d.ageGroups?.under12}</td>
                            <td className="py-2.5 px-1 text-center text-slate-600 tabular-nums">{d.ageGroups?.teens12to18}</td>
                            <td className="py-2.5 px-1 text-center text-indigo-700 font-bold tabular-nums">{d.ageGroups?.youngAdults19to35}</td>
                            <td className="py-2.5 px-1 text-center text-emerald-800 font-bold tabular-nums">{d.ageGroups?.middleAged36to55}</td>
                            <td className="py-2.5 px-1 text-center text-amber-800 font-bold tabular-nums">{d.ageGroups?.elderlyOver55}</td>
                          </tr>
                        )
                      })
                    ) : (
                      <tr>
                        <td colSpan={9} className="py-6 text-center text-slate-400">
                          Chưa có dữ liệu lịch hẹn trong khoảng thời gian này
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── HÀNG 4: KHUNG BÁO CÁO CỐ VẤN CHIẾN LƯỢC TỪ AI GEMINI ───────── */}
            <div className="bg-white rounded border border-slate-200/90 shadow-2xs overflow-hidden">
              {/* Header Báo Cáo AI */}
              <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                    Báo cáo Cố vấn Chiến lược Y tế & Nhu cầu
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tự động tổng hợp từ Telemetry tìm kiếm, Phễu chuyển đổi và Hồ sơ bệnh án
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
                  {aiReport?.generatedAt && (
                    <span className="text-[11px] text-slate-500 font-mono bg-slate-50 px-2.5 py-1.5 rounded border border-slate-200">
                      Cập nhật: {new Date(aiReport.generatedAt).toLocaleTimeString('vi-VN')} {new Date(aiReport.generatedAt).toLocaleDateString('vi-VN')}
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={generatingAi}
                    onClick={() => loadAiReport(true)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-60"
                  >
                    <span>{generatingAi ? 'Đang phân tích dữ liệu...' : 'Phân tích dữ liệu'}</span>
                  </button>
                </div>
              </div>

              {/* Nội dung Phân tích AI */}
              <div className="p-5 space-y-5">
                {/* Đánh giá tổng quan */}
                <div className="p-3.5 rounded bg-emerald-50/60 border border-emerald-200/70 text-xs text-slate-800 leading-relaxed">
                  <strong className="font-bold text-emerald-800">Đánh giá tổng quan: </strong>
                  <span>{aiReport?.overview || 'Đang cập nhật phân tích từ mô hình AI...'}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 1. Xu hướng dịch tễ & triệu chứng */}
                  <div className="p-4 rounded border border-slate-200 bg-slate-50/50 space-y-2.5">
                    <div className="flex items-center gap-2 text-blue-900 font-bold text-xs uppercase tracking-wide">
                      <TrendingUp className="w-4 h-4 text-blue-700" />
                      <span>Xu hướng & Triệu chứng nổi bật</span>
                    </div>
                    <ul className="text-xs text-slate-700 space-y-1.5 pl-4 list-disc leading-relaxed">
                      {(aiReport?.epidemiologicalTrends || []).map((item: string, idx: number) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  {/* 2. Điểm nghẽn chuyển đổi (Drop-off) */}
                  <div className="p-4 rounded border border-slate-200 bg-slate-50/50 space-y-2.5">
                    <div className="flex items-center gap-2 text-rose-900 font-bold text-xs uppercase tracking-wide">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      <span>Khả năng chuyển đổi</span>
                    </div>
                    <ul className="text-xs text-slate-700 space-y-1.5 pl-4 list-disc leading-relaxed">
                      {(aiReport?.conversionBottlenecks || []).map((item: string, idx: number) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  {/* 3. Chân dung nhân khẩu học */}
                  <div className="p-4 rounded border border-slate-200 bg-slate-50/50 space-y-2.5">
                    <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs uppercase tracking-wide">
                      <Users className="w-4 h-4 text-indigo-700" />
                      <span>Phân nhóm bệnh nhân</span>
                    </div>
                    <ul className="text-xs text-slate-700 space-y-1.5 pl-4 list-disc leading-relaxed">
                      {(aiReport?.demographicInsights || []).map((item: string, idx: number) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  {/* 4. Nhu cầu chưa được đáp ứng (Market Gap) */}
                  <div className="p-4 rounded border border-amber-200 bg-amber-50/40 space-y-2.5">
                    <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wide">
                      <ShieldAlert className="w-4 h-4 text-amber-600" />
                      <span>Phân tích tìm kiếm chưa có kết quả</span>
                    </div>
                    <ul className="text-xs text-amber-950 space-y-1.5 pl-4 list-disc leading-relaxed font-medium">
                      {(aiReport?.unmetDemandInsights || []).map((item: string, idx: number) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  {/* 5. Đề xuất hành động chiến lược */}
                  <div className="md:col-span-2 p-4 rounded border border-emerald-200 bg-emerald-50/30 space-y-2.5">
                    <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs uppercase tracking-wide">
                      <Lightbulb className="w-4 h-4 text-emerald-700" />
                      <span>Đề xuất hành động</span>
                    </div>
                    <ul className="text-xs text-slate-800 space-y-1.5 pl-4 list-disc leading-relaxed">
                      {(aiReport?.strategicRecommendations || []).map((item: string, idx: number) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
