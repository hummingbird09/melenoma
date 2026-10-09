import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

function riskTier(riskScore: number): 'low' | 'med' | 'high' {
  if (riskScore < 0.35) return 'low'
  if (riskScore < 0.65) return 'med'
  return 'high'
}

export async function GET(request: Request) {
  try {
    const patientId = new URL(request.url).searchParams.get('patientId')

    if (!patientId) {
      return NextResponse.json({ ok: false, error: 'patientId is required' }, { status: 400 })
    }

    const [moles, scanCount, upcomingAppointments, recentScans] = await Promise.all([
      prisma.mole.findMany({
        where: { patientId },
        include: { scans: { orderBy: { createdAt: 'desc' }, take: 1 } },
      }),
      prisma.scan.count({ where: { mole: { patientId } } }),
      prisma.appointment.findMany({
        where: { patientId, date: { gte: new Date() } },
        orderBy: { date: 'asc' },
        take: 3,
      }),
      prisma.scan.findMany({
        where: { mole: { patientId } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { mole: { select: { name: true } } },
      }),
    ])

    let highCount = 0
    let medCount = 0

    for (const mole of moles) {
      const latest = mole.scans[0]
      if (!latest) continue
      const tier = riskTier(latest.riskScore)
      if (tier === 'high') highCount += 1
      else if (tier === 'med') medCount += 1
    }

    return NextResponse.json({
      moleCount: moles.length,
      scanCount,
      highCount,
      medCount,
      upcomingCount: upcomingAppointments.length,
      upcomingAppointments,
      recentScans,
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 })
  }
}
