'use client'

import { Fraunces, Inter } from 'next/font/google'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const fraunces = Fraunces({ subsets: ['latin'] })
const inter = Inter({ subsets: ['latin'] })

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

function riskTier(riskScore: number): 'low' | 'med' | 'high' {
  if (riskScore < 0.35) return 'low'
  if (riskScore < 0.65) return 'med'
  return 'high'
}

const TIER_COLOR = { low: '#5FBF7A', med: '#D6A855', high: '#E1584A' } as const
const TIER_LABEL = { low: 'Low risk', med: 'Watch closely', high: 'See a dermatologist' } as const

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function Timeline({ scans }: { scans: Scan[] }) {
  const W = Math.max(280, scans.length * 80)
  const H = 100
  const pad = 16

  const points = scans.map((s, i) => {
    const x = scans.length === 1 ? W / 2 : pad + (i * (W - 2 * pad)) / (scans.length - 1)
    const y = pad + (1 - s.riskScore) * (H - 2 * pad)
    return { x, y, s }
  })

  const line = points.map((p) => `${p.x},${p.y}`).join(' ')

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={W} height={H + 28} viewBox={`0 0 ${W} ${H + 28}`}>
        <polyline points={line} fill="none" stroke="#213024" strokeWidth={2} />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={5} fill={TIER_COLOR[riskTier(p.s.riskScore)]} />
        ))}
        {points.map((p, i) => (
          <text key={i} x={p.x} y={H + 20} fontSize={10.5} fill="#7CA98A" textAnchor="middle">
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

  return (
    <main className={`${inter.className} min-h-screen`} style={{ background: '#080B08', color: '#E4F1E7' }}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-10">
        <Link href="/moles" className="text-sm" style={{ color: '#7CA98A' }}>
          ← My Moles
        </Link>

        {error ? (
          <p className="text-sm" style={{ color: '#E1584A' }}>{error}</p>
        ) : !mole ? (
          <p className="text-sm" style={{ color: '#7CA98A' }}>Loading…</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4">
              <h1 className={`${fraunces.className} text-3xl`} style={{ color: '#3ED97F' }}>
                {mole.name}
              </h1>
              {latest ? (
                <span
                  className="px-2.5 py-1 text-xs uppercase tracking-wide"
                  style={{
                    color: TIER_COLOR[riskTier(latest.riskScore)],
                    border: `1px solid ${TIER_COLOR[riskTier(latest.riskScore)]}`,
                    borderRadius: 6,
                  }}
                >
                  {TIER_LABEL[riskTier(latest.riskScore)]}
                </span>
              ) : null}
            </div>

            <Link
              href={`/scan?moleId=${mole.id}`}
              className="self-start px-4 py-2 text-sm"
              style={{ background: '#3ED97F', color: '#080B08', borderRadius: 6, fontWeight: 600 }}
            >
              + New scan
            </Link>

            <div
              className="flex flex-col gap-4 p-6"
              style={{ background: '#0F140F', border: '1px solid #213024', borderRadius: 8 }}
            >
              <h2 className={`${fraunces.className} text-xl`} style={{ color: '#3ED97F' }}>
                Progression
              </h2>
              {mole.scans.length === 0 ? (
                <p className="text-sm" style={{ color: '#7CA98A' }}>
                  No scans logged for this mole yet.
                </p>
              ) : (
                <>
                  <p className="text-sm" style={{ color: '#7CA98A' }}>
                    {mole.scans.length} scan{mole.scans.length > 1 ? 's' : ''} over time
                  </p>
                  <Timeline scans={mole.scans} />
                </>
              )}
            </div>

            {mole.scans.length > 0 ? (
              <div
                className="flex flex-col gap-3 p-6"
                style={{ background: '#0F140F', border: '1px solid #213024', borderRadius: 8 }}
              >
                <h2 className={`${fraunces.className} text-xl`} style={{ color: '#3ED97F' }}>
                  Scan history
                </h2>
                <ul className="flex flex-col gap-3">
                  {[...mole.scans].reverse().map((scan) => (
                    <li key={scan.id} className="flex items-center justify-between gap-3 py-1">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm" style={{ color: '#7CA98A' }}>{formatDate(scan.createdAt)}</span>
                        {scan.notes ? (
                          <span className="text-sm" style={{ color: '#E4F1E7' }}>{scan.notes}</span>
                        ) : null}
                      </div>
                      <span
                        className="px-2.5 py-1 text-xs"
                        style={{
                          color: TIER_COLOR[riskTier(scan.riskScore)],
                          border: `1px solid ${TIER_COLOR[riskTier(scan.riskScore)]}`,
                          borderRadius: 6,
                        }}
                      >
                        {(scan.riskScore * 100).toFixed(0)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </div>
    </main>
  )
}