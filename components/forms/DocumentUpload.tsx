'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Camera, FileText, Upload, X } from 'lucide-react'

const DEFAULT_ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp'
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024
const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])

export interface DocumentUploadProps {
  value: File | null
  onChange: (file: File | null) => void
  accept?: string
  maxBytes?: number
  disabled?: boolean
  error?: string | null
  hint?: string
  'aria-label'?: string
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function isAllowedFile(file: File, accept: string, maxBytes: number): string | null {
  const tokens = accept.split(',').map((part) => part.trim()).filter(Boolean)
  const mimeOk =
    ALLOWED_MIME.has(file.type) ||
    tokens.some((token) => {
      if (token.startsWith('.')) return file.name.toLowerCase().endsWith(token.toLowerCase())
      if (token.endsWith('/*')) return file.type.startsWith(token.slice(0, -1))
      return file.type === token
    })
  if (!mimeOk) return 'Allowed types: PDF, JPEG, PNG, WEBP'
  if (file.size <= 0 || file.size > maxBytes) return `File must be between 1 byte and ${formatBytes(maxBytes)}`
  return null
}

/* ─── DocumentUpload ─────────────────────────────────────────────────────────
   Theme-matched proof / document picker. Hidden native file inputs only.
   Browse + drag-drop + camera (getUserMedia, capture=environment fallback).
──────────────────────────────────────────────────────────────────────────── */
export function DocumentUpload({
  value,
  onChange,
  accept = DEFAULT_ACCEPT,
  maxBytes = DEFAULT_MAX_BYTES,
  disabled = false,
  error = null,
  hint,
  'aria-label': ariaLabel = 'Document upload',
}: DocumentUploadProps) {
  const browseId = useId()
  const cameraFallbackId = useId()
  const browseRef = useRef<HTMLInputElement>(null)
  const cameraFallbackRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [dragging, setDragging] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }

  useEffect(() => {
    if (!value || !value.type.startsWith('image/')) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(value)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [value])

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!cameraOpen || !streamRef.current || !videoRef.current) return
    videoRef.current.srcObject = streamRef.current
    void videoRef.current.play()
  }, [cameraOpen])

  const applyFile = (file: File | null) => {
    if (!file) {
      setLocalError(null)
      onChange(null)
      return
    }
    const problem = isAllowedFile(file, accept, maxBytes)
    if (problem) {
      setLocalError(problem)
      return
    }
    setLocalError(null)
    onChange(file)
  }

  const handleBrowseChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    event.target.value = ''
    applyFile(file)
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setDragging(false)
    if (disabled) return
    const file = event.dataTransfer.files?.[0] ?? null
    applyFile(file)
  }

  const openCamera = async () => {
    if (disabled) return
    setCameraError(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      cameraFallbackRef.current?.click()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      setCameraOpen(true)
    } catch {
      setCameraError(null)
      cameraFallbackRef.current?.click()
    }
  }

  const closeCamera = () => {
    stopCamera()
    setCameraOpen(false)
    setCameraError(null)
  }

  const capturePhoto = () => {
    const video = videoRef.current
    if (!video || video.videoWidth === 0) {
      setCameraError('Camera is not ready yet')
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      setCameraError('Could not capture frame')
      return
    }
    ctx.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError('Could not create image')
          return
        }
        const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' })
        applyFile(file)
        closeCamera()
      },
      'image/jpeg',
      0.92,
    )
  }

  const displayError = error ?? localError

  return (
    <div className="flex flex-col gap-2" aria-label={ariaLabel}>
      <input
        ref={browseRef}
        id={browseId}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        disabled={disabled}
        onChange={handleBrowseChange}
        aria-hidden
      />
      <input
        ref={cameraFallbackRef}
        id={cameraFallbackId}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        disabled={disabled}
        onChange={handleBrowseChange}
        aria-hidden
      />

      {value ? (
        <div
          className="flex items-start gap-3 rounded-xl border p-3"
          style={{
            borderColor: 'var(--qp-border)',
            backgroundColor: 'var(--qp-card)',
            boxShadow: 'var(--qp-shadow-sm)',
          }}
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt=""
              className="h-14 w-14 shrink-0 rounded-lg object-cover"
              style={{ border: '1px solid var(--qp-border)' }}
            />
          ) : (
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: 'var(--qp-primary-light)', color: 'var(--qp-primary)' }}
            >
              <FileText size={22} strokeWidth={1.75} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" style={{ color: 'var(--qp-text-primary)' }}>
              {value.name}
            </p>
            <p className="text-[11px]" style={{ color: 'var(--qp-text-muted)' }}>
              {formatBytes(value.size)}
              {value.type ? ` · ${value.type}` : ''}
            </p>
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => applyFile(null)}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors disabled:opacity-60"
            style={{ borderColor: 'var(--qp-border)', color: 'var(--qp-text-secondary)', backgroundColor: '#fff' }}
            aria-label="Remove attachment"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          aria-label={`${ariaLabel} drop zone`}
          className="rounded-xl border border-dashed p-4 outline-none transition-colors focus-visible:ring-2"
          style={{
            borderColor: dragging ? 'var(--qp-primary)' : 'var(--qp-border)',
            backgroundColor: dragging ? 'var(--qp-primary-light)' : 'var(--qp-card)',
            boxShadow: 'var(--qp-shadow-sm)',
            opacity: disabled ? 0.6 : 1,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
          onDragEnter={(event) => {
            event.preventDefault()
            if (!disabled) setDragging(true)
          }}
          onDragOver={(event) => {
            event.preventDefault()
            if (!disabled) setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => {
            if (!disabled) browseRef.current?.click()
          }}
          onKeyDown={(event) => {
            if (disabled) return
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              browseRef.current?.click()
            }
          }}
        >
          <div className="mb-3 flex flex-col items-center gap-1 text-center">
            <div
              className="mb-1 flex h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: 'var(--qp-primary-light)', color: 'var(--qp-primary)' }}
            >
              <Upload size={18} strokeWidth={1.75} />
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--qp-text-primary)' }}>
              Drop a file here, or browse
            </p>
            <p className="text-[11px]" style={{ color: 'var(--qp-text-muted)' }}>
              PDF, JPEG, PNG, WEBP · max {formatBytes(maxBytes)}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => browseRef.current?.click()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
              style={{ backgroundColor: 'var(--qp-primary)' }}
              aria-label="Browse files"
            >
              <Upload size={15} strokeWidth={2} />
              Browse
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => void openCamera()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold transition-colors disabled:opacity-60"
              style={{
                borderColor: 'var(--qp-border)',
                color: 'var(--qp-text-secondary)',
                backgroundColor: '#fff',
              }}
              aria-label="Take photo"
            >
              <Camera size={15} strokeWidth={2} />
              Take photo
            </button>
          </div>
        </div>
      )}

      {displayError ? (
        <p className="text-[11px] font-medium" style={{ color: 'var(--qp-danger)' }}>
          {displayError}
        </p>
      ) : hint ? (
        <p className="text-[11px]" style={{ color: 'var(--qp-text-muted)' }}>
          {hint}
        </p>
      ) : null}

      {cameraOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          role="dialog"
          aria-label="Take photo"
        >
          <div
            className="w-full max-w-md rounded-2xl border p-4"
            style={{
              backgroundColor: 'var(--qp-card)',
              borderColor: 'var(--qp-border)',
              boxShadow: 'var(--qp-shadow-lg)',
            }}
          >
            <p className="mb-3 text-sm font-semibold" style={{ color: 'var(--qp-text-primary)' }}>
              Take photo
            </p>
            <div
              className="mb-3 overflow-hidden rounded-xl"
              style={{ backgroundColor: '#0f172a', aspectRatio: '4 / 3' }}
            >
              <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay />
            </div>
            {cameraError ? (
              <p className="mb-3 text-[11px] font-medium" style={{ color: 'var(--qp-danger)' }}>
                {cameraError}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeCamera}
                className="inline-flex h-9 items-center rounded-lg border px-4 text-sm font-medium"
                style={{ borderColor: 'var(--qp-border)', color: 'var(--qp-text-secondary)', backgroundColor: '#fff' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={capturePhoto}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold text-white"
                style={{ backgroundColor: 'var(--qp-primary)' }}
              >
                <Camera size={15} strokeWidth={2} />
                Capture
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
