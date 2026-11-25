'use client'

import { useEffect, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'
import type { Map as LeafletMap, Marker } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './branch-location.css'

type Props = {
  revealToken?: number
  latitude?: string | number; longitude?: string | number; disabled: boolean
  onChange: (location: { latitude: number; longitude: number }) => void
}
const coordinates = (latitude: Props['latitude'], longitude: Props['longitude']): [number, number] | null =>
  latitude !== '' && latitude != null && longitude !== '' && longitude != null
    && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))
    && Math.abs(Number(latitude)) <= 85 && Math.abs(Number(longitude)) <= 180
    ? [Number(latitude), Number(longitude)] : null

export default function BranchLocationPicker(props: Props) {
  const { latitude, longitude, disabled } = props
  const [open, setOpen] = useState(false)
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<LeafletMap | null>(null)
  const marker = useRef<Marker | null>(null)
  const latest = useRef(props)
  latest.current = props
  const position = coordinates(latitude, longitude)

  useEffect(() => { if (props.revealToken) setOpen(true) }, [props.revealToken])

  useEffect(() => {
    if (!open || !container.current) return
    let cancelled = false
    let instance: LeafletMap | null = null
    let observer: ResizeObserver | undefined
    setLoading(true)
    setFailed(false)
    void import('leaflet').then(L => {
      if (cancelled || !container.current) return
      const point = coordinates(latest.current.latitude, latest.current.longitude)
      const initial: [number, number] = point || [10.7769, 106.7009]
      instance = L.map(container.current, {
        center: initial, zoom: 15, minZoom: 5, maxZoom: 19,
        zoomControl: false, scrollWheelZoom: false,
        inertia: true, zoomAnimation: true, fadeAnimation: true,
      })
      map.current = instance
      L.control.zoom({ position: 'topright', zoomInTitle: 'Phóng to', zoomOutTitle: 'Thu nhỏ' }).addTo(instance)
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, keepBuffer: 3, updateWhenIdle: true,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
      }).on('tileerror', () => { if (!cancelled) setFailed(true) }).addTo(instance)
      const pin = L.marker(initial, {
        draggable: !latest.current.disabled, opacity: point ? 1 : 0,
        title: 'Vị trí chi nhánh', alt: 'Ghim vị trí chi nhánh',
        icon: L.divIcon({ className: 'branch-location-marker', html: '<span></span>', iconSize: [24, 24], iconAnchor: [12, 12] }),
      }).addTo(instance)
      marker.current = pin
      const select = (lat: number, lng: number) => {
        if (latest.current.disabled) return
        const normalized = L.latLng(Math.max(-85, Math.min(85, lat)), lng).wrap()
        pin.setLatLng(normalized).setOpacity(1)
        latest.current.onChange({ latitude: normalized.lat, longitude: normalized.lng })
      }
      instance.on('click', event => select(event.latlng.lat, event.latlng.lng))
      instance.on('keydown', event => {
        if (event.originalEvent.key === 'Enter') {
          event.originalEvent.preventDefault()
          const center = instance!.getCenter()
          select(center.lat, center.lng)
        }
      })
      pin.on('dragend', () => { const point = pin.getLatLng(); select(point.lat, point.lng) })
      observer = new ResizeObserver(() => instance?.invalidateSize({ pan: false }))
      observer.observe(container.current)
      if (latest.current.disabled) {
        instance.dragging.disable(); instance.touchZoom.disable()
        instance.doubleClickZoom.disable(); instance.keyboard.disable()
      }
      setLoading(false)
    }).catch(() => { if (!cancelled) { setFailed(true); setLoading(false) } })
    return () => {
      cancelled = true
      observer?.disconnect()
      instance?.remove()
      map.current = null
      marker.current = null
    }
  }, [open])

  useEffect(() => {
    const point = coordinates(latitude, longitude)
    if (point) {
      const previous = marker.current?.getLatLng()
      const changed = previous && (Math.abs(previous.lat - point[0]) > 0.00001 || Math.abs(previous.lng - point[1]) > 0.00001)
      marker.current?.setLatLng(point).setOpacity(1)
      if (changed) map.current?.flyTo(point, Math.max(16, map.current.getZoom()), { animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches, duration: 0.6 })
    }
    else marker.current?.setOpacity(0)
  }, [latitude, longitude])

  useEffect(() => {
    const instance = map.current
    if (!instance) return
    for (const handler of [instance.dragging, instance.touchZoom, instance.doubleClickZoom, instance.keyboard, instance.boxZoom]) {
      if (disabled) handler.disable()
      else handler.enable()
    }
    if (disabled) marker.current?.dragging?.disable()
    else marker.current?.dragging?.enable()
  }, [disabled])

  if (!open) return <button type="button" disabled={disabled} onClick={() => setOpen(true)} className="flex min-h-20 w-full flex-col items-center justify-center gap-1 rounded border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600 transition hover:border-emerald-500 hover:bg-emerald-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:opacity-50">
    <MapPin className="h-5 w-5 text-emerald-700" />
    <span className="font-semibold text-slate-800">Vị trí chi nhánh trên bản đồ</span>
    <span>{position ? 'Đã chọn vị trí · Nhấn để điều chỉnh' : 'Chọn vị trí để xác định tọa độ'}</span>
  </button>

  return <div className="space-y-2">
    <div className="relative isolate overflow-hidden rounded border border-slate-200 bg-slate-100" aria-busy={loading}>
      <div ref={container} role="region" aria-label="Bản đồ vị trí chi nhánh. Dùng phím mũi tên để di chuyển và Enter để chọn vị trí." className="branch-location-map relative z-0 h-44 w-full" />
      {loading && <div role="status" className="pointer-events-none absolute inset-0 grid place-items-center bg-slate-50/80 text-sm text-slate-600">Đang tải bản đồ…</div>}
      {disabled && <div className="absolute inset-0 z-10 cursor-wait bg-white/20" />}
    </div>
    <p className="text-xs text-slate-600">{failed ? 'Chưa tải được bản đồ. Kiểm tra kết nối mạng rồi mở lại.' : 'Kéo để di chuyển bản đồ; nhấn để đặt ghim hoặc kéo ghim để điều chỉnh. Dùng + / − để thu phóng.'}</p>
    {failed && <button type="button" disabled={disabled} onClick={() => setOpen(false)} className="rounded text-xs font-medium text-emerald-700 underline underline-offset-2">Đóng bản đồ để thử lại</button>}
  </div>
}
