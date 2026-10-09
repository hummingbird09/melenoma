import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const mole = await prisma.mole.findUnique({
      where: { id },
      include: { scans: { orderBy: { createdAt: 'asc' } } },
    })

    if (!mole) {
      return NextResponse.json({ ok: false, error: 'Mole not found' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, mole })
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 })
  }
}