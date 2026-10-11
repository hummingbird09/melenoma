'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import AppNav from '@/components/AppNav'
import RiskLens, { riskTier, TIER } from '@/components/RiskLens'

type ScanSummary = {
  id: string
  moleId: string
  riskScore: number
  createdAt: string
  mole: { name: string }
}

type AppointmentSummary = {
  id: string
  date: string
  doctorName: string | null
}

type DashboardData = {
  moleCount: number
  scanCount: number
  highCount: number
  medCount: number
  topRiskScore: number | null
  upcomingCount: number
  upcomingAppointments: AppointmentSummary[]
  recentScans: ScanSummary[]
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function headline(data: DashboardData) {
  if (data.highCount > 0) {
    return {
      text:
        data.highCount === 1
          ? '1 mole needs a dermatologist'
          : `${data.highCount} moles need a dermatologist`,
      detail: 'Book a visit soon and bring your scan history.',
    }
  }
  if (data.medCount > 0) {
    return {
      text: data.medCount === 1 ? '1 mole is worth watching' : `${data.medCount} moles are worth watching`,
      detail: 'Scan again in a few weeks to see if anything changes.',
    }
  }
  if (data.moleCount > 0) {
    return { text: 'Everything looks steady', detail: 'Keep scanning regularly to track changes.' }
  }
  return { text: 'Start with your first mole', detail: 'Add a mole, then take a photo to get a baseline.' }
}

export default function DashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) {
        router.replace('/login')
        return
      }

      const response = await fetch(`/api/dashboard?patientId=${encodeURIComponent(auth.user.id)}`)
      const result = await response.json()
      if (cancelled) return

      if (!response.ok) {
        setError(result.error ?? 'Failed to load dashboard.')
        return
      }
      setData(result)
    }

    load().catch((err) => {
      if (!cancelled) setError(String(err))
    })

    return () => {
      cancelled = true
    }
  }, [router])

  const hero = data ? headline(data) : null

  return (
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
        {!data && !error ? <p className="text-sm text-ink-soft">Loading…</p> : null}
        {error ? <p className="text-sm text-high">{error}</p> : null}

        {data && hero ? (
          <>
            {/* Hero: the lens */}
            <section className="flex flex-col items-center gap-8 rounded-3xl border border-line bg-surface p-8 sm:flex-row sm:p-10">
              <RiskLens score={data.topRiskScore} size={168} />
              <div className="flex flex-col gap-4 text-center sm:text-left">
                <div className="flex flex-col gap-2">
                  <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight">
                    {hero.text}
                  </h1>
                  <p className="max-w-md text-ink-soft">{hero.detail}</p>
                </div>
                <dl className="flex justify-center gap-6 text-sm sm:justify-start">
                  <div>
                    <dt className="text-ink-soft">Moles</dt>
                    <dd className="font-display text-xl font-semibold">{data.moleCount}</dd>
                  </div>
                  <div className="border-l border-line pl-6">
                    <dt className="text-ink-soft">Scans</dt>
                    <dd className="font-display text-xl font-semibold">{data.scanCount}</dd>
                  </div>
                  <div className="border-l border-line pl-6">
                    <dt className="text-ink-soft">Upcoming visits</dt>
                    <dd className="font-display text-xl font-semibold">{data.upcomingCount}</dd>
                  </div>
                </dl>
              </div>
            </section>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Recent scans */}
              <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6">
                <h2 className="font-display text-xl font-semibold">Recent scans</h2>
                {data.recentScans.length === 0 ? (
                  <div className="flex flex-col items-start gap-3">
                    <p className="text-sm text-ink-soft">
                      No scans yet. Add a mole and take a first photo to see results here.
                    </p>
                    <Link href="/moles" className="text-sm font-semibold text-brand">
                      Add a mole
                    </Link>
                  </div>
                ) : (
                  <ul className="flex flex-col divide-y divide-line">
                    {data.recentScans.map((scan) => {
                      const tier = riskTier(scan.riskScore)
                      return (
                        <li key={scan.id}>
                          <Link
                            href={`/moles/${scan.moleId}`}
                            className="flex items-center gap-4 py-3 transition-opacity hover:opacity-80"
                          >
                            <RiskLens score={scan.riskScore} size={44} />
                            <div className="flex flex-1 flex-col">
                              <span className="font-medium">{scan.mole.name}</span>
                              <span className="text-sm text-ink-soft">{formatDate(scan.createdAt)}</span>
                            </div>
                            <span
                              className="rounded-full px-3 py-1 text-xs font-semibold"
                              style={{ color: TIER[tier].color, background: TIER[tier].soft }}
                            >
                              {TIER[tier].label}
                            </span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>

              {/* Upcoming appointments */}
              <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-display text-xl font-semibold">Upcoming visits</h2>
                  <Link href="/appointments" className="text-sm font-semibold text-brand">
                    Manage
                  </Link>
                </div>
                {data.upcomingAppointments.length === 0 ? (
                  <div className="flex flex-col items-start gap-3">
                    <p className="text-sm text-ink-soft">No visits booked.</p>
                    <Link href="/appointments" className="text-sm font-semibold text-brand">
                      Book an appointment
                    </Link>
                  </div>
                ) : (
                  <ul className="flex flex-col divide-y divide-line">
                    {data.upcomingAppointments.map((appointment) => {
                      const when = new Date(appointment.date)
                      return (
                        <li key={appointment.id} className="flex items-center gap-4 py-3">
                          <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-soft text-brand">
                            <span className="font-display text-lg font-semibold leading-none">
                              {when.getDate()}
                            </span>
                            <span className="text-xs leading-tight">
                              {when.toLocaleDateString(undefined, { month: 'short' })}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium">{appointment.doctorName ?? 'Doctor'}</span>
                            <span className="text-sm text-ink-soft">
                              {when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                            </span>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            </div>
          </>
        ) : null}
      </main>
    </>
  )
}
