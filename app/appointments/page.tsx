'use client'

import { Fraunces, Inter } from 'next/font/google'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const fraunces = Fraunces({ subsets: ['latin'] })
const inter = Inter({ subsets: ['latin'] })

type Status = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'

type Appointment = {
  id: string
  date: string
  doctorName: string | null
  notes: string | null
  status: Status
  mole: { id: string; name: string } | null
}

type MoleOption = { id: string; name: string }

const STATUS_COLOR: Record<Status, string> = {
  SCHEDULED: '#3ED97F',
  COMPLETED: '#7CA98A',
  CANCELLED: '#E1584A',
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// "now" in the format <input type="datetime-local"> expects, in the user's own timezone
function nowForInput() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

const inputStyle = {
  background: '#080B08',
  border: '1px solid #213024',
  borderRadius: 6,
  color: '#E4F1E7',
} as const

const cardStyle = {
  background: '#0F140F',
  border: '1px solid #213024',
  borderRadius: 8,
} as const

export default function AppointmentsPage() {
  const router = useRouter()
  const [patientId, setPatientId] = useState<string | null>(null)
  const [appointments, setAppointments] = useState<Appointment[] | null>(null)
  const [moles, setMoles] = useState<MoleOption[]>([])

  const [doctorName, setDoctorName] = useState('')
  const [date, setDate] = useState('')
  const [moleId, setMoleId] = useState('')
  const [notes, setNotes] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function loadAppointments(id: string) {
    const response = await fetch(`/api/appointments?patientId=${encodeURIComponent(id)}`)
    const result = await response.json()
    if (!response.ok) {
      setError(result.error ?? 'Failed to load appointments.')
      return
    }
    setAppointments(result.appointments)
  }

  async function loadMoles(id: string) {
    const response = await fetch(`/api/moles?patientId=${encodeURIComponent(id)}`)
    const result = await response.json()
    if (response.ok) setMoles(result.moles)
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

      // Allows /appointments?moleId=... to pre-select a mole (used in Step 5)
      const preset = new URLSearchParams(window.location.search).get('moleId')
      if (preset) setMoleId(preset)

      await Promise.all([loadAppointments(auth.user.id), loadMoles(auth.user.id)])
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
    if (!patientId || !doctorName.trim() || !date) return

    setSubmitting(true)
    setError('')

    try {
      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          doctorName: doctorName.trim(),
          // Convert local time -> UTC ISO string so the server stores the right moment
          date: new Date(date).toISOString(),
          moleId: moleId || null,
          notes,
        }),
      })
      const result = await response.json()
      if (!response.ok) {
        setError(result.error ?? 'Failed to book appointment.')
        return
      }
      setDoctorName('')
      setDate('')
      setMoleId('')
      setNotes('')
      await loadAppointments(patientId)
    } catch (err) {
      setError(String(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function updateStatus(id: string, status: Status) {
    if (!patientId) return
    setError('')

    try {
      const response = await fetch(`/api/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, status }),
      })
      const result = await response.json()
      if (!response.ok) {
        setError(result.error ?? 'Failed to update appointment.')
        return
      }
      await loadAppointments(patientId)
    } catch (err) {
      setError(String(err))
    }
  }

  const scheduled = (appointments ?? []).filter((a) => a.status === 'SCHEDULED')
  const history = (appointments ?? [])
    .filter((a) => a.status !== 'SCHEDULED')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const canSubmit = !submitting && doctorName.trim() !== '' && date !== ''

  return (
    <main className={`${inter.className} min-h-screen`} style={{ background: '#080B08', color: '#E4F1E7' }}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10">
        <header className="flex items-center justify-between gap-4">
          <Link href="/dashboard" className="text-sm" style={{ color: '#7CA98A' }}>
            ← Dashboard
          </Link>
        </header>

        <h1 className={`${fraunces.className} text-3xl`} style={{ color: '#3ED97F' }}>
          Appointments
        </h1>

        {/* Booking form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6" style={cardStyle}>
          <h2 className={`${fraunces.className} text-xl`} style={{ color: '#3ED97F' }}>
            Book an appointment
          </h2>

          <label className="flex flex-col gap-1 text-sm" style={{ color: '#7CA98A' }}>
            Doctor or clinic
            <input
              type="text"
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
              placeholder="e.g. Dr. Sharma, City Skin Clinic"
              className="px-3 py-2 text-sm"
              style={inputStyle}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm" style={{ color: '#7CA98A' }}>
            Date and time
            <input
              type="datetime-local"
              value={date}
              min={nowForInput()}
              onChange={(e) => setDate(e.target.value)}
              className="px-3 py-2 text-sm"
              style={{ ...inputStyle, colorScheme: 'dark' }}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm" style={{ color: '#7CA98A' }}>
            Mole to discuss (optional)
            <select
              value={moleId}
              onChange={(e) => setMoleId(e.target.value)}
              className="px-3 py-2 text-sm"
              style={inputStyle}
            >
              <option value="">None</option>
              {moles.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm" style={{ color: '#7CA98A' }}>
            Notes (optional)
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Anything you want to remember to ask"
              className="px-3 py-2 text-sm"
              style={inputStyle}
            />
          </label>

          <button
            type="submit"
            disabled={!canSubmit}
            className="self-start px-4 py-2 text-sm"
            style={{
              background: '#3ED97F',
              color: '#080B08',
              borderRadius: 6,
              fontWeight: 600,
              opacity: canSubmit ? 1 : 0.6,
            }}
          >
            {submitting ? 'Booking…' : 'Book appointment'}
          </button>
        </form>

        {error ? (
          <p className="text-sm" style={{ color: '#E1584A' }}>
            {error}
          </p>
        ) : null}

        {!appointments ? (
          <p className="text-sm" style={{ color: '#7CA98A' }}>
            Loading…
          </p>
        ) : (
          <>
            {/* Scheduled */}
            <section className="flex flex-col gap-4">
              <h2 className={`${fraunces.className} text-xl`} style={{ color: '#3ED97F' }}>
                Scheduled
              </h2>
              {scheduled.length === 0 ? (
                <p className="text-sm" style={{ color: '#7CA98A' }}>
                  Nothing scheduled. Book one above.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {scheduled.map((a) => (
                    <li key={a.id} className="flex flex-col gap-3 p-5" style={cardStyle}>
                      <div className="flex flex-col gap-0.5">
                        <span>{a.doctorName ?? 'Doctor'}</span>
                        <span className="text-sm" style={{ color: '#7CA98A' }}>
                          {formatDateTime(a.date)}
                        </span>
                        {a.mole ? (
                          <Link
                            href={`/moles/${a.mole.id}`}
                            className="text-sm"
                            style={{ color: '#3ED97F' }}
                          >
                            Re: {a.mole.name}
                          </Link>
                        ) : null}
                        {a.notes ? (
                          <span className="mt-1 text-sm" style={{ color: '#7CA98A' }}>
                            {a.notes}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => updateStatus(a.id, 'COMPLETED')}
                          className="px-3 py-1.5 text-xs"
                          style={{ background: '#3ED97F', color: '#080B08', borderRadius: 6, fontWeight: 600 }}
                        >
                          Mark completed
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm('Cancel this appointment?')) updateStatus(a.id, 'CANCELLED')
                          }}
                          className="px-3 py-1.5 text-xs"
                          style={{ color: '#E1584A', border: '1px solid #E1584A', borderRadius: 6 }}
                        >
                          Cancel
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* History */}
            {history.length > 0 ? (
              <section className="flex flex-col gap-4">
                <h2 className={`${fraunces.className} text-xl`} style={{ color: '#3ED97F' }}>
                  History
                </h2>
                <ul className="flex flex-col gap-3">
                  {history.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-3 p-5"
                      style={cardStyle}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span>{a.doctorName ?? 'Doctor'}</span>
                        <span className="text-sm" style={{ color: '#7CA98A' }}>
                          {formatDateTime(a.date)}
                        </span>
                      </div>
                      <span
                        className="px-2.5 py-1 text-xs uppercase tracking-wide"
                        style={{
                          color: STATUS_COLOR[a.status],
                          border: `1px solid ${STATUS_COLOR[a.status]}`,
                          borderRadius: 6,
                        }}
                      >
                        {a.status.toLowerCase()}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </div>
    </main>
  )
}