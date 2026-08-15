import { ApiClientError } from './api'

export async function downloadExport(path: string, token: string | null): Promise<void> {
  if (!token) return
  const headers: Record<string, string> = { accept: '*/*', authorization: `Bearer ${token}` }
  const response = await fetch(path, { method: 'GET', credentials: 'include', headers })
  const disposition = response.headers.get('content-disposition') ?? ''
  const contentType = response.headers.get('content-type') ?? ''
  if (!response.ok || contentType.includes('application/json')) {
    const parsed = (await response.json().catch(() => ({}))) as {
      code?: string
      message?: string
      request_id?: string
    }
    throw new ApiClientError(response.status, {
      code: parsed.code,
      message: parsed.message,
      request_id: parsed.request_id,
    })
  }
  const blob = await response.blob()
  const matched = /filename="?([^"]+)"?/i.exec(disposition)
  const filename = matched?.[1] ?? 'export.xlsx'
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
