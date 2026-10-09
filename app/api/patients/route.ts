import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { id, name, email } = await request.json()

    if (!id || !name || !email) {
      return NextResponse.json(
        { ok: false, error: 'id, name, and email are required' },
        { status: 400 }
      )
    }

    const patient = await prisma.patient.upsert({
      where: { id },
      update: { name, email },
      create: { id, name, email },
    })

    return NextResponse.json({ ok: true, patient })
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 })
  }
}
