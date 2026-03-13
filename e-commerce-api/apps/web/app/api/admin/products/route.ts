import { NextRequest, NextResponse } from 'next/server'

import { API_ROUTES, post } from '@/lib/api'
import { createAuthorizationHeader } from '@/lib/auth'
import { config } from '@/lib/config'

export async function POST(req: NextRequest) {
  const headers = await createAuthorizationHeader()
  const body = await req.json()

  try {
    const data = await post(
      `${config.api.endpoint}${API_ROUTES.PRODUCT.CREATE}`,
      body,
      headers,
    )

    return NextResponse.json(data)
  } catch (error: unknown) {
    const err = error as { message: string; status?: number }
    return NextResponse.json(
      { message: err.message },
      { status: err.status || 500 },
    )
  }
}
