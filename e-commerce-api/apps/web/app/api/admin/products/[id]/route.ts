import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

import { API_ROUTES, del, put } from '@/lib/api'
import { createAuthorizationHeader } from '@/lib/auth'
import { config } from '@/lib/config'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const headers = await createAuthorizationHeader()

  const { id } = await params
  const body = await req.json()

  try {
    const data = await put(
      `${config.api.endpoint}${API_ROUTES.PRODUCT.UPDATE(id)}`,
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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const headers = await createAuthorizationHeader()

  const { id } = await params

  try {
    await del(`${config.api.endpoint}${API_ROUTES.PRODUCT.DELETE(id)}`, headers)

    revalidatePath('/admin/products')
    revalidatePath('/')
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const err = error as { message: string; status?: number }
    return NextResponse.json(
      { message: err.message },
      { status: err.status || 500 },
    )
  }
}
