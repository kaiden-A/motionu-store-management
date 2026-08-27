import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { backendFetch } from '@/lib/api'

async function proxyHandler(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }

  const { path } = await params
  const pathname = `/${path.join('/')}`
  const search = request.nextUrl.search

  const init: RequestInit = { method: request.method, cache: 'no-store' }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const body = await request.arrayBuffer()
    if (body.byteLength > 0) {
      init.body = body
    }
  }

  const upstream = await backendFetch(session, `${pathname}${search}`, init)

  const contentType = upstream.headers.get('content-type') || 'application/json'

  if (contentType.includes('text/csv')) {
    const text = await upstream.text()
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': upstream.headers.get('content-disposition') || '',
      },
    })
  }

  const data = await upstream.text()
  if (upstream.status === 204) {
    return new NextResponse(null, { status: 204 })
  }

  return new NextResponse(data, {
    status: upstream.status,
    headers: { 'Content-Type': contentType },
  })
}

export const GET = proxyHandler
export const POST = proxyHandler
export const PATCH = proxyHandler
export const DELETE = proxyHandler
