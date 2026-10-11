'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import AppNav from '@/components/AppNav'
import RiskLens, { riskTier, TIER } from '@/components/RiskLens'

type Mole = {
  id: string
  name: string
  createdAt: string
  scans: { riskScore: number }[]
}

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
        setError(result.error ?? 'Failed to add mole.')
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
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Your moles</h1>
          <p className="text-ink-soft">Name each mole by where it is, then scan it regularly to track changes.</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:flex-row"
        >
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Left forearm, near the wrist"
            aria-label="Mole name"
            className="flex-1 rounded-xl border border-line bg-paper px-4 py-2.5 text-sm placeholder:text-ink-soft/70"
          />
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
          >
            {submitting ? 'Adding…' : 'Add mole'}
          </button>
        </form>

        {error ? <p className="text-sm text-high">{error}</p> : null}

        {!moles ? (
          <p className="text-sm text-ink-soft">Loading…</p>
        ) : moles.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-ink-soft">
            No moles yet. Add your first one above, then take a photo to get a baseline.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {moles.map((mole) => {
              const latest = mole.scans[0]
              const tier = latest ? riskTier(latest.riskScore) : null
              return (
                <li key={mole.id}>
                  <Link
                    href={`/moles/${mole.id}`}
                    className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-brand"
                  >
                    <RiskLens score={latest ? latest.riskScore : null} size={64} />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="truncate font-display text-lg font-semibold">{mole.name}</span>
                      <span className="text-sm text-ink-soft">Added {formatDate(mole.createdAt)}</span>
                      {tier ? (
                        <span
                          className="mt-1 w-fit rounded-full px-3 py-0.5 text-xs font-semibold"
                          style={{ color: TIER[tier].color, background: TIER[tier].soft }}
                        >
                          {TIER[tier].label}
                        </span>
                      ) : (
                        <span className="mt-1 text-sm text-ink-soft">No scans yet</span>
                      )}
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </>
  )
}