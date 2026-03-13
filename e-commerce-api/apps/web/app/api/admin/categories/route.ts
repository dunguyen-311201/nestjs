import { revalidateTag } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

import { API_ROUTES, post } from '@/lib/api'
import { createAuthorizationHeader } from '@/lib/auth'
import { config } from '@/lib/config'

export async function POST(req: NextRequest) {
  try {
    const headers = await createAuthorizationHeader()
    const body = await req.json()

    const data = await post(
      `${config.api.endpoint}${API_ROUTES.CATEGORY.CREATE}`,
      body,
      headers,
    )

    revalidateTag('categories', 'default')

    return NextResponse.json(data)
  } catch (error: unknown) {
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { message: err.message || 'Failed to create category' },
      { status: err.status || 500 },
    )
  }
}
