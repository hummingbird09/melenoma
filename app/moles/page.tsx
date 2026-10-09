'use client'

import { Fraunces, Inter } from 'next/font/google'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const fraunces = Fraunces({ subsets: ['latin'] })
const inter = Inter({ subsets: ['latin'] })

type Mole = {
  id: string
  name: string
  createdAt: string
  scans: { riskScore: number }[]
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

export default function MolesPage() {
  const router = useRouter()
  const [patientId, setPatientId] = useState<string | null>(null)
  const [moles, setMoles] = useState<Mole[] | null>(null)
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function loadMoles(id: string) {
    const response = await fetch(`/api/moles?patientId=${encodeURIComponent(id)}`)
    const result = await response.json()
    if (!response.ok) {
      setError(result.error ?? 'Failed to load moles.')
      return
    }
    setMoles(result.moles)
  }

  useEffect(() => {
    let cancelled = false

    async function init() {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) {
        router.replace('/login')
        return
      }
      if (cancelled) return
      setPatientId(auth.user.id)
      await loadMoles(auth.user.id)
    }

    init().catch((err) => {
      if (!cancelled) setError(String(err))
    })

    return () => {
      cancelled = true
    }
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!patientId || !name.trim()) return

    setSubmitting(true)
    setError('')

    try {
      const response = await fetch('/api/moles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, name: name.trim() }),
      })
      const result = await response.json()
      if (!response.ok) {
        setError(result.error ?? 'Failed to create mole.')
        return
      }
      setName('')
      await loadMoles(patientId)
    } catch (err) {
      setError(String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className={`${inter.className} min-h-screen`} style={{ background: '#080B08', color: '#E4F1E7' }}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10">
        <header className="flex items-center justify-between gap-4">
          <Link href="/dashboard" className="text-sm" style={{ color: '#7CA98A' }}>
            ← Dashboard
          </Link>
        </header>

        <h1 className={`${fraunces.className} text-3xl`} style={{ color: '#3ED97F' }}>
          My Moles
        </h1>

        <form
          onSubmit={handleSubmit}
          className="flex gap-3 p-6"
          style={{ background: '#0F140F', border: '1px solid #213024', borderRadius: 8 }}
        >
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Left forearm mole"
            className="flex-1 px-3 py-2 text-sm"
            style={{
              background: '#080B08',
              border: '1px solid #213024',
              borderRadius: 6,
              color: '#E4F1E7',
            }}
          />
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="px-4 py-2 text-sm"
            style={{
              background: '#3ED97F',
              color: '#080B08',
              borderRadius: 6,
              fontWeight: 600,
              opacity: submitting || !name.trim() ? 0.6 : 1,
            }}
          >
            {submitting ? 'Adding…' : 'Add mole'}
          </button>
        </form>

        {error ? (
          <p className="text-sm" style={{ color: '#E1584A' }}>
            {error}
          </p>
        ) : null}

        {!moles ? (
          <p className="text-sm" style={{ color: '#7CA98A' }}>
            Loading…
          </p>
        ) : moles.length === 0 ? (
          <p className="text-sm" style={{ color: '#7CA98A' }}>
            No moles yet — add one above to get started.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {moles.map((mole) => {
              const latest = mole.scans[0]
              return (
                <li
                  key={mole.id}
                  className="flex items-center justify-between gap-3 p-5"
                  style={{ background: '#0F140F', border: '1px solid #213024', borderRadius: 8 }}
                >
                  <div className="flex flex-col gap-0.5">
                  <Link href={`/moles/${mole.id}`} style={{ color: '#3ED97F' }}>{mole.name}</Link>
                    <span className="text-sm" style={{ color: '#7CA98A' }}>
                      Added {formatDate(mole.createdAt)}
                    </span>
                  </div>
                  {latest ? (
                    <span
                      className="px-2.5 py-1 text-xs uppercase tracking-wide"
                      style={{
                        color: TIER_COLOR[riskTier(latest.riskScore)],
                        border: `1px solid ${TIER_COLOR[riskTier(latest.riskScore)]}`,
                        borderRadius: 6,
                      }}
                    >
                      {riskTier(latest.riskScore)}
                    </span>
                  ) : (
                    <span className="text-sm" style={{ color: '#7CA98A' }}>
                      No scans yet
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </main>
  )
}