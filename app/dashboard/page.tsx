'use client'

import { Fraunces, Inter } from 'next/font/google'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const fraunces = Fraunces({ subsets: ['latin'] })
const inter = Inter({ subsets: ['latin'] })

type ScanSummary = {
  id: string
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
  upcomingCount: number
  upcomingAppointments: AppointmentSummary[]
  recentScans: ScanSummary[]
}

function riskTier(riskScore: number): 'low' | 'med' | 'high' {
  if (riskScore < 0.35) return 'low'
  if (riskScore < 0.65) return 'med'
  return 'high'
}

const TIER_COLOR = {
  low: '#5FBF7A',
  med: '#D6A855',
  high: '#E1584A',
} as const

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function DashboardPage() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
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
      if (cancelled) return
      setEmail(auth.user.email ?? auth.user.id)

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

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const hero =
    data && data.highCount > 0
      ? {
          text: `${data.highCount} mole(s) need a dermatologist`,
          color: '#CE6C56',
        }
      : data && data.medCount > 0
        ? {
            text: `${data.medCount} mole(s) worth watching`,
            color: '#D6A855',
          }
        : data && data.moleCount > 0
          ? { text: 'Everything looks steady', color: '#5FBF7A' }
          : { text: 'No moles tracked yet', color: '#7CA98A' }

  return (
    <main
    className={`${inter.className} min-h-screen`}
      style={{ background: '#080B08', color: '#E4F1E7' }}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10">
        <header className="flex items-center justify-between gap-4">
          <p className="text-sm" style={{ color: '#7CA98A' }}>
            Welcome, {email ?? '…'}
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="px-3 py-1.5 text-sm"
            style={{
              background: '#3ED97F',
              color: '#080B08',
              borderRadius: 7,
              fontWeight: 600,
            }}
          >
            Log out
          </button>
        </header>

        {!data && !error ? (
          <p className="text-sm" style={{ color: '#7CA98A' }}>
            Loading…
          </p>
        ) : null}

        {error ? (
          <p className="text-sm" style={{ color: '#E1584A' }}>
            {error}
          </p>
        ) : null}

        {data ? (
          <>
            <section className="flex flex-col gap-5">
              <h1
                className={`${fraunces.className} text-4xl leading-tight`}
                style={{ color: hero.color }}
              >
                {hero.text}
              </h1>
              <div className="flex gap-8 text-sm" style={{ color: '#7CA98A' }}>
                <span>
                  <strong style={{ color: '#E4F1E7' }}>{data.moleCount}</strong> moles
                </span>
                <span>
                  <strong style={{ color: '#E4F1E7' }}>{data.scanCount}</strong> scans
                </span>
                <span>
                  <strong style={{ color: '#E4F1E7' }}>{data.upcomingCount}</strong> upcoming
                </span>
              </div>
            </section>

            <section
              className="flex flex-col gap-4 p-6"
              style={{
                background: '#0F140F',
                border: '1px solid #213024',
                borderRadius: 8,
              }}
            >
              <h2 className={`${fraunces.className} text-xl`} style={{ color: '#3ED97F' }}>
                Recent scans
              </h2>
              {data.recentScans.length === 0 ? (
                <p className="text-sm" style={{ color: '#7CA98A' }}>
                  No scans yet. Add a mole and take a first photo to see results here.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {data.recentScans.map((scan) => {
                    const tier = riskTier(scan.riskScore)
                    return (
                      <li
                        key={scan.id}
                        className="flex items-center justify-between gap-3 py-1"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span>{scan.mole.name}</span>
                          <span className="text-sm" style={{ color: '#7CA98A' }}>
                            {formatDate(scan.createdAt)}
                          </span>
                        </div>
                        <span
                          className="px-2.5 py-1 text-xs uppercase tracking-wide"
                          style={{
                            color: TIER_COLOR[tier],
                            border: `1px solid ${TIER_COLOR[tier]}`,
                            borderRadius: 6,
                          }}
                        >
                          {tier}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <section
              className="flex flex-col gap-4 p-6"
              style={{
                background: '#0F140F',
                border: '1px solid #213024',
                borderRadius: 8,
              }}
            >
              <h2 className={`${fraunces.className} text-xl`} style={{ color: '#3ED97F' }}>
                Upcoming appointments
              </h2>
              {data.upcomingAppointments.length === 0 ? (
                <p className="text-sm" style={{ color: '#7CA98A' }}>
                  No upcoming appointments. When you book one, it will appear here.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {data.upcomingAppointments.map((appointment) => (
                    <li
                      key={appointment.id}
                      className="flex items-center justify-between gap-3 py-1"
                    >
                      <span>{appointment.doctorName ?? 'Doctor'}</span>
                      <span className="text-sm" style={{ color: '#7CA98A' }}>
                        {formatDate(appointment.date)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : null}
      </div>
    </main>
  )
}
