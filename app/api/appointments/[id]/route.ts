import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

const STATUSES = ['SCHEDULED', 'COMPLETED', 'CANCELLED'] as const
type Status = (typeof STATUSES)[number]

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { patientId, status } = await request.json()

    if (typeof patientId !== 'string' || !patientId.trim()) {
      return NextResponse.json({ ok: false, error: 'patientId is required' }, { status: 400 })
    }
    if (!STATUSES.includes(status as Status)) {
      return NextResponse.json(
        { ok: false, error: 'status must be SCHEDULED, COMPLETED, or CANCELLED' },
        { status: 400 }
      )
    }

    // Only the patient who owns the appointment can change it
    const existing = await prisma.appointment.findFirst({ where: { id, patientId } })
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Appointment not found' }, { status: 404 })
    }

    const appointment = await prisma.appointment.update({
      where: { id },
      data: { status: status as Status },
    })

    return NextResponse.json({ ok: true, appointment })
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 })
  }
}