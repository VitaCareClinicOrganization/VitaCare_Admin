'use client'

import { useEffect, useState } from 'react'
import { isAxiosError } from 'axios'
import { Clock, Loader2, MessageSquare, RefreshCw } from 'lucide-react'
import { apiErrorMessage, apiRequest } from '@/lib/api-client'

interface SessionMessage {
  id?: string
  senderRole: 'DOCTOR' | 'PATIENT'
  senderName: string
  text: string
  timestamp: string
}

interface SessionHistory {
  startedAt: string | null
  endedAt: string | null
  durationSeconds: number | null
  chatMessages: SessionMessage[] | null
}

function formatTimestamp(value?: string | null) {
  if (!value || Number.isNaN(new Date(value).getTime())) return 'Chưa ghi nhận'
  return new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
}

function formatDuration(seconds: number | null) {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return 'Chưa ghi nhận'
  const total = Math.floor(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  return `${hours ? `${hours} giờ ` : ''}${minutes} phút ${total % 60} giây`
}

export default function TelehealthSessionHistory({ appointmentId }: { appointmentId: string }) {
  const [session, setSession] = useState<SessionHistory | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setSession(null)
    apiRequest<SessionHistory>({
      method: 'GET',
      url: `/telehealth/room/${encodeURIComponent(appointmentId)}/session`,
      signal: controller.signal,
    }).then(data => {
      if (!controller.signal.aborted) setSession(data)
    }).catch((err: unknown) => {
      if (controller.signal.aborted) return
      if (!isAxiosError(err) || err.response?.status !== 404) {
        setError(apiErrorMessage(err, 'Không thể tải lịch sử tư vấn.'))
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [appointmentId, attempt])

  const messages = Array.isArray(session?.chatMessages) ? session.chatMessages : []

  return (
    <section className="space-y-3 border-t border-slate-100 pt-4" aria-label="Chi tiết tư vấn online">
      <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-800">
        <Clock className="h-4 w-4" /> Chi tiết buổi tư vấn online
      </h4>
      {loading ? (
        <p role="status" className="flex items-center gap-2 py-4 text-xs text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải lịch sử tư vấn…
        </p>
      ) : error ? (
        <div role="alert" className="space-y-2 text-xs text-rose-700">
          <p>{error}</p>
          <button type="button" onClick={() => setAttempt(value => value + 1)} className="inline-flex items-center gap-1 rounded border border-rose-200 px-3 py-1.5 font-semibold hover:bg-rose-100">
            <RefreshCw className="h-3.5 w-3.5" /> Thử lại
          </button>
        </div>
      ) : !session ? (
        <p className="text-xs text-slate-500">Chưa có hồ sơ tư vấn được lưu cho lịch hẹn này.</p>
      ) : (
        <>
          <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
            <div><dt className="text-slate-500">Bắt đầu</dt><dd className="mt-1 font-semibold text-slate-800">{formatTimestamp(session.startedAt)}</dd></div>
            <div><dt className="text-slate-500">Kết thúc</dt><dd className="mt-1 font-semibold text-slate-800">{formatTimestamp(session.endedAt)}</dd></div>
            <div><dt className="text-slate-500">Thời lượng buổi tư vấn</dt><dd className="mt-1 font-bold text-emerald-800">{formatDuration(session.durationSeconds)}</dd></div>
            <div><dt className="text-slate-500">Tin nhắn đã trao đổi</dt><dd className="mt-1 font-semibold text-slate-800">{messages.length} tin nhắn</dd></div>
          </dl>
          <div className="space-y-2">
            <h5 className="flex items-center gap-1.5 text-xs font-bold text-slate-700"><MessageSquare className="h-3.5 w-3.5 text-emerald-700" /> Lịch sử trò chuyện ({messages.length})</h5>
            <div className="max-h-80 space-y-3 overflow-y-auto p-1" tabIndex={0} aria-label="Nội dung trò chuyện đã lưu">
              {messages.length === 0 ? <p className="py-4 text-center text-xs text-slate-500">Không có tin nhắn trong buổi tư vấn này.</p> : messages.map((message, index) => {
                const isDoctor = message.senderRole === 'DOCTOR'
                return (
                  <div key={message.id || index} className={`flex flex-col gap-1 ${isDoctor ? 'items-end' : 'items-start'}`}>
                    <span className="text-[11px] text-slate-500">{isDoctor ? 'Bác sĩ' : 'Bệnh nhân'}{message.senderName ? ` · ${message.senderName}` : ''}</span>
                    <p className={`max-w-[90%] whitespace-pre-wrap break-words rounded px-3 py-2 text-xs leading-relaxed ${isDoctor ? 'bg-emerald-700 text-white' : 'border border-slate-200 bg-white text-slate-800'}`}>{message.text}</p>
                    <time dateTime={message.timestamp} className="text-[10px] text-slate-500">{formatTimestamp(message.timestamp)}</time>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </section>
  )
}
