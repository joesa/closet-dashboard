import { NextResponse } from 'next/server'

import { getCurrentAdmin } from '@/lib/admin'
import { getSpecBuildProgress } from '@/lib/spec/specBuildProgress'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getCurrentAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const progress = await getSpecBuildProgress(id)
    if (!progress) {
      return NextResponse.json({ error: 'Spec Build not found' }, { status: 404 })
    }
    return NextResponse.json(progress, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    })
  } catch (error) {
    console.error('[spec-build-progress] failed:', error)
    return NextResponse.json({ error: 'Could not load Spec Build progress' }, { status: 500 })
  }
}