import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { patientId, name } = await request.json()

    if (typeof patientId !== 'string' || !patientId.trim()) {
      return NextResponse.json({ ok: false, error: 'patientId is required' }, { status: 400 })
    }
    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ ok: false, error: 'name is required' }, { status: 400 })
    }

    const mole = await prisma.mole.create({
      data: { patientId, name: name.trim() },
    })

    return NextResponse.json({ ok: true, mole })
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const patientId = new URL(request.url).searchParams.get('patientId')
    if (!patientId) {
      return NextResponse.json({ ok: false, error: 'patientId is required' }, { status: 400 })
    }

    const moles = await prisma.mole.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      include: { scans: { orderBy: { createdAt: 'desc' }, take: 1 } },
    })

    return NextResponse.json({ ok: true, moles })
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 })
  }
}