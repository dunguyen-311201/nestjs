import { NextResponse } from 'next/server'

import { API_ROUTES, patch } from '@/lib/api'
import { createAuthorizationHeader } from '@/lib/auth'
import { config } from '@/lib/config'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const headers = await createAuthorizationHeader()

    await patch(
      `${config.api.endpoint}${API_ROUTES.ORDER.CANCEL(parseInt(id))}`,
      {},
      headers,
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 },
    )
  }
}
