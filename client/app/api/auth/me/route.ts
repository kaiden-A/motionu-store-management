import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { isAdmin } from '@/lib/auth'

export async function GET() {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }

  return NextResponse.json({
    user: {
      email: session.email,
      name: session.name,
      verified: session.email_verified,
      picture: session.picture,
      roles: session.roles,
      is_admin: isAdmin(session.roles),
    },
  })
}
