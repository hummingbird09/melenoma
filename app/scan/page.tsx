'use client'

import { Fraunces, Inter } from 'next/font/google'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const fraunces = Fraunces({ subsets: ['latin'] })
const inter = Inter({ subsets: ['latin'] })

type Mole = { id: string; name: string }

type ScanResult = {
  id: string
  riskScore: number
  notes: string | null
}

function riskTier(riskScore: number): 'low' | 'med' | 'high' {
  if (riskScore < 0.35) return 'low'
  if (riskScore < 0.65) return 'med'
  return 'high'
}

const TIER_COLOR = { low: '#5FBF7A', med: '#D6A855', high: '#E1584A' } as const
const TIER_LABEL = { low: 'Low risk', med: 'Watch closely', high: 'See a dermatologist' } as const

export default function ScanPage() {
  const router = useRouter()
  const [patientId, setPatientId] = useState<string | null>(null)
  const [moles, setMoles] = useState<Mole[] | null>(null)
  const [moleId, setMoleId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [checks, setChecks] = useState({
    asymmetry: false,
    borderIrregular: false,
    colorUneven: false,
    diameterOver6mm: false,
    evolving: false,
  })
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ScanResult | null>(null)

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
      const response = await fetch(`/api/moles?patientId=${encodeURIComponent(auth.user.id)}`)
      const data = await response.json()
      if (!cancelled && response.ok) {
        setMoles(data.moles)
        const wanted = new URLSearchParams(window.location.search).get('moleId')
const match = data.moles.find((m: Mole) => m.id === wanted)
if (match) setMoleId(match.id)
else if (data.moles.length > 0) setMoleId(data.moles[0].id)
      }
    }
    init().catch((err) => !cancelled && setError(String(err)))
    return () => {
      cancelled = true
    }
  }, [router])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!moleId || !file) {
      setError('Pick a mole and choose a photo first.')
      return
    }
    setSubmitting(true)
    setError('')
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('moleId', moleId)
      formData.append('asymmetry', String(checks.asymmetry))
      formData.append('borderIrregular', String(checks.borderIrregular))
      formData.append('colorUneven', String(checks.colorUneven))
      formData.append('diameterOver6mm', String(checks.diameterOver6mm))
      formData.append('evolving', String(checks.evolving))
      if (notes.trim()) formData.append('notes', notes.trim())

      const response = await fetch('/api/scans', { method: 'POST', body: formData })
      const data = await response.json()
      if (!response.ok || !data.ok) {
        setError(data.error ?? 'Scan failed.')
        return
      }
      setResult(data.scan)
    } catch (err) {
      setError(String(err))
    } finally {
      setSubmitting(false)
    }
  }

  const checkboxItems: { key: keyof typeof checks; label: string }[] = [
    { key: 'asymmetry', label: 'Asymmetry' },
    { key: 'borderIrregular', label: 'Irregular border' },
    { key: 'colorUneven', label: 'Uneven color' },
    { key: 'diameterOver6mm', label: 'Diameter > 6mm' },
    { key: 'evolving', label: 'Evolving / changed recently' },
  ]

  return (
    <main className={`${inter.className} min-h-screen`} style={{ background: '#080B08', color: '#E4F1E7' }}>
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-6 py-10">
        <Link href="/moles" className="text-sm" style={{ color: '#7CA98A' }}>
          ← My Moles
        </Link>

        <h1 className={`${fraunces.className} text-3xl`} style={{ color: '#3ED97F' }}>
          Scan & Predict
        </h1>

        {!moles ? (
          <p className="text-sm" style={{ color: '#7CA98A' }}>Loading…</p>
        ) : moles.length === 0 ? (
          <p className="text-sm" style={{ color: '#7CA98A' }}>
            No moles yet. <Link href="/moles" style={{ color: '#3ED97F' }}>Add one first.</Link>
          </p>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 p-6"
            style={{ background: '#0F140F', border: '1px solid #213024', borderRadius: 8 }}
          >
            <div>
              <label className="mb-1 block text-sm" style={{ color: '#7CA98A' }}>Mole</label>
              <select
                value={moleId}
                onChange={(e) => setMoleId(e.target.value)}
                className="w-full px-3 py-2 text-sm"
                style={{ background: '#080B08', border: '1px solid #213024', borderRadius: 6, color: '#E4F1E7' }}
              >
                {moles.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm" style={{ color: '#7CA98A' }}>Photo</label>
              <div
                className="cursor-pointer p-4 text-center text-sm"
                style={{ border: '1px dashed #213024', borderRadius: 6, color: '#7CA98A' }}
                onClick={() => document.getElementById('fileInput')?.click()}
              >
                {preview ? (
                  <img src={preview} alt="preview" style={{ maxHeight: 180, margin: '0 auto', borderRadius: 6 }} />
                ) : (
                  'Tap to choose an image'
                )}
                <input id="fileInput" type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm" style={{ color: '#7CA98A' }}>Quick ABCDE check</label>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {checkboxItems.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={checks[key]}
                      onChange={(e) => setChecks((c) => ({ ...c, [key]: e.target.checked }))}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm" style={{ color: '#7CA98A' }}>Notes (optional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-sm"
                style={{ background: '#080B08', border: '1px solid #213024', borderRadius: 6, color: '#E4F1E7' }}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm"
              style={{ background: '#3ED97F', color: '#080B08', borderRadius: 6, fontWeight: 600, opacity: submitting ? 0.6 : 1 }}
            >
              {submitting ? 'Analyzing…' : 'Run risk analysis'}
            </button>
          </form>
        )}

        {error ? <p className="text-sm" style={{ color: '#E1584A' }}>{error}</p> : null}

        {result ? (
          <div
            className="flex flex-col gap-2 p-6"
            style={{ background: '#0F140F', border: `1px solid ${TIER_COLOR[riskTier(result.riskScore)]}`, borderRadius: 8 }}
          >
            <h2 className={`${fraunces.className} text-xl`} style={{ color: TIER_COLOR[riskTier(result.riskScore)] }}>
              {TIER_LABEL[riskTier(result.riskScore)]}
            </h2>
            <p className="text-sm" style={{ color: '#7CA98A' }}>
              Score: {(result.riskScore * 100).toFixed(0)}% — {result.notes}
            </p>
          </div>
        ) : null}
      </div>
    </main>
  )
}