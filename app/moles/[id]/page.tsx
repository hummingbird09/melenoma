'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import AppNav from '@/components/AppNav'
import RiskLens, { riskTier, TIER } from '@/components/RiskLens'

type Scan = {
  id: string
  riskScore: number
  createdAt: string
  notes: string | null
}

type MoleDetail = {
  id: string
  name: string
  createdAt: string
  scans: Scan[]
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function Timeline({ scans }: { scans: Scan[] }) {
  const W = Math.max(320, scans.length * 90)
  const H = 110
  const pad = 20

  const points = scans.map((s, i) => {
    const x = scans.length === 1 ? W / 2 : pad + (i * (W - 2 * pad)) / (scans.length - 1)
    const y = pad + (1 - s.riskScore) * (H - 2 * pad)
    return { x, y, s }
  })

  const line = points.map((p) => `${p.x},${p.y}`).join(' ')

  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H + 30} viewBox={`0 0 ${W} ${H + 30}`} role="img" aria-label="Risk score over time">
        {/* guide lines at the tier boundaries */}
        {[0.35, 0.65].map((v) => {
          const y = pad + (1 - v) * (H - 2 * pad)
          return <line key={v} x1={0} x2={W} y1={y} y2={y} stroke="var(--line)" strokeDasharray="4 4" />
        })}
        {scans.length > 1 ? (
          <polyline points={line} fill="none" stroke="var(--brand)" strokeOpacity={0.35} strokeWidth={2} />
        ) : null}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={6}
            fill={TIER[riskTier(p.s.riskScore)].color}
            stroke="var(--surface)"
            strokeWidth={2}
          />
        ))}
        {points.map((p, i) => (
          <text key={i} x={p.x} y={H + 22} fontSize={11} fill="var(--ink-soft)" textAnchor="middle">
            {formatDate(p.s.createdAt)}
          </text>
        ))}
      </svg>
    </div>
  )
}

export default function MoleDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [mole, setMole] = useState<MoleDetail | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) {
        router.replace('/login')
        return
      }
      const response = await fetch(`/api/moles/${params.id}`)
      const data = await response.json()
      if (cancelled) return
      if (!response.ok || !data.ok) {
        setError(data.error ?? 'Failed to load mole.')
        return
      }
      setMole(data.mole)
    }

    load().catch((err) => !cancelled && setError(String(err)))
    return () => {
      cancelled = true
    }
  }, [params.id, router])

  const latest = mole?.scans[mole.scans.length - 1]
  const tier = latest ? riskTier(latest.riskScore) : null

  return (
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
        <Link href="/moles" className="w-fit text-sm text-ink-soft hover:text-ink">
          ← Your moles
        </Link>

        {error ? (
          <p className="text-sm text-high">{error}</p>
        ) : !mole ? (
          <p className="text-sm text-ink-soft">Loading…</p>
        ) : (
          <>
            <section className="flex flex-col items-center gap-6 rounded-3xl border border-line bg-surface p-8 sm:flex-row">
              <RiskLens score={latest ? latest.riskScore : null} size={112} />
              <div className="flex flex-col items-center gap-3 sm:items-start">
                <h1 className="font-display text-3xl font-semibold tracking-tight">{mole.name}</h1>
                {tier ? (
                  <span
                    className="w-fit rounded-full px-3 py-1 text-sm font-semibold"
                    style={{ color: TIER[tier].color, background: TIER[tier].soft }}
                  >
                    {TIER[tier].label}
                  </span>
                ) : (
                  <span className="text-sm text-ink-soft">No scans yet. Take a photo to set a baseline.</span>
                )}
                <div className="flex flex-wrap justify-center gap-3 pt-1 sm:justify-start">
                  <Link
                    href={`/scan?moleId=${mole.id}`}
                    className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white"
                  >
                    New scan
                  </Link>
                  <Link
                    href={`/appointments?moleId=${mole.id}`}
                    className="rounded-xl border border-brand px-4 py-2 text-sm font-semibold text-brand"
                  >
                    Book appointment
                  </Link>
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6">
              <h2 className="font-display text-xl font-semibold">Progression</h2>
              {mole.scans.length === 0 ? (
                <p className="text-sm text-ink-soft">No scans logged for this mole yet.</p>
              ) : (
                <>
                  <p className="text-sm text-ink-soft">
                    {mole.scans.length} scan{mole.scans.length > 1 ? 's' : ''} over time. Dashed lines mark where
                    risk moves from low to watch, and from watch to high.
                  </p>
                  <Timeline scans={mole.scans} />
                </>
              )}
            </section>

            {mole.scans.length > 0 ? (
              <section className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-6">
                <h2 className="font-display text-xl font-semibold">Scan history</h2>
                <ul className="flex flex-col divide-y divide-line">
                  {[...mole.scans].reverse().map((scan) => {
                    const t = riskTier(scan.riskScore)
                    return (
                      <li key={scan.id} className="flex items-start justify-between gap-4 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-medium">{formatDate(scan.createdAt)}</span>
                          {scan.notes ? <span className="max-w-md text-sm text-ink-soft">{scan.notes}</span> : null}
                        </div>
                        <span
                          className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold"
                          style={{ color: TIER[t].color, background: TIER[t].soft }}
                        >
                          {(scan.riskScore * 100).toFixed(0)}%
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </main>
    </>
  )
}