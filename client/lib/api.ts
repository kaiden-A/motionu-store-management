import type { Session } from '@/lib/auth'

const API_URL = (process.env.API_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '')

export class BackendError extends Error {
  status: number
  detail: unknown

  constructor(status: number, detail: unknown) {
    super(typeof detail === 'string' ? detail : 'Backend request failed')
    this.status = status
    this.detail = detail
  }
}

export async function backendFetch(
  session: Session,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const url = path.startsWith('http') ? path : `${API_URL}/api/v1${path}`
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${session.access_token}`)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  return fetch(url, { ...init, headers, cache: 'no-store' })
}

export async function backendJson<T>(
  session: Session,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await backendFetch(session, path, init)
  if (!res.ok) {
    let detail: unknown = res.statusText
    try {
      detail = await res.json()
    } catch {
      /* keep statusText */
    }
    throw new BackendError(res.status, detail)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}
