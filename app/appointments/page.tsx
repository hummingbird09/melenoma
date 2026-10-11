'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import AppNav from '@/components/AppNav'

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

const STATUS_STYLE: Record<Exclude<Status, 'SCHEDULED'>, { label: string; color: string; bg: string }> = {
  COMPLETED: { label: 'Completed', color: 'var(--low)', bg: 'var(--low-soft)' },
  CANCELLED: { label: 'Cancelled', color: 'var(--high)', bg: 'var(--high-soft)' },
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function formatFullDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// "now" in the format <input type="datetime-local"> expects, in the user's own timezone
function nowForInput() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

const fieldClass =
  'rounded-xl border border-line bg-paper px-4 py-2.5 text-sm placeholder:text-ink-soft/70'

function DateTile({ value, muted = false }: { value: string; muted?: boolean }) {
  const when = new Date(value)
  return (
    <div
      className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl ${
        muted ? 'bg-paper text-ink-soft' : 'bg-brand-soft text-brand'
      }`}
    >
      <span className="font-display text-xl font-semibold leading-none">{when.getDate()}</span>
      <span className="text-xs leading-tight">{when.toLocaleDateString(undefined, { month: 'short' })}</span>
    </div>
  )
}

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

      // Allows /appointments?moleId=... to pre-select a mole
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
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Appointments</h1>
          <p className="text-ink-soft">Keep track of dermatologist visits and which mole each one is about.</p>
        </div>

        {error ? <p className="text-sm text-high">{error}</p> : null}

        <div className="grid items-start gap-6 md:grid-cols-5">
          {/* Booking form */}
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6 md:col-span-2"
          >
            <h2 className="font-display text-xl font-semibold">Book a visit</h2>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Doctor or clinic
              <input
                type="text"
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                placeholder="e.g. Dr. Sharma, City Skin Clinic"
                className={fieldClass}
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Date and time
              <input
                type="datetime-local"
                value={date}
                min={nowForInput()}
                onChange={(e) => setDate(e.target.value)}
                className={fieldClass}
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Mole to discuss
              <select value={moleId} onChange={(e) => setMoleId(e.target.value)} className={fieldClass}>
                <option value="">No specific mole</option>
                {moles.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Notes
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Questions to ask, or changes you've noticed"
                className={fieldClass}
              />
            </label>

            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            >
              {submitting ? 'Booking…' : 'Book appointment'}
            </button>
          </form>

          {/* Lists */}
          <div className="flex flex-col gap-6 md:col-span-3">
            {!appointments ? (
              <p className="text-sm text-ink-soft">Loading…</p>
            ) : (
              <>
                <section className="flex flex-col gap-4">
                  <h2 className="font-display text-xl font-semibold">Scheduled</h2>
                  {scheduled.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-ink-soft">
                      No visits booked. Use the form to add one.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-3">
                      {scheduled.map((a) => (
                        <li
                          key={a.id}
                          className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5"
                        >
                          <div className="flex items-start gap-4">
                            <DateTile value={a.date} />
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                              <span className="font-display text-lg font-semibold">{a.doctorName ?? 'Doctor'}</span>
                              <span className="text-sm text-ink-soft">
                                {formatFullDate(a.date)} at {formatTime(a.date)}
                              </span>
                              {a.mole ? (
                                <Link
                                  href={`/moles/${a.mole.id}`}
                                  className="w-fit text-sm font-medium text-brand"
                                >
                                  About: {a.mole.name}
                                </Link>
                              ) : null}
                              {a.notes ? <span className="mt-1 text-sm text-ink-soft">{a.notes}</span> : null}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => updateStatus(a.id, 'COMPLETED')}
                              className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white"
                            >
                              Mark completed
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm('Cancel this appointment?')) updateStatus(a.id, 'CANCELLED')
                              }}
                              className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-high"
                            >
                              Cancel visit
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {history.length > 0 ? (
                  <section className="flex flex-col gap-4">
                    <h2 className="font-display text-xl font-semibold">History</h2>
                    <ul className="flex flex-col gap-3">
                      {history.map((a) => {
                        const style = STATUS_STYLE[a.status as Exclude<Status, 'SCHEDULED'>]
                        return (
                          <li
                            key={a.id}
                            className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4"
                          >
                            <DateTile value={a.date} muted />
                            <div className="flex min-w-0 flex-1 flex-col">
                              <span className="font-medium">{a.doctorName ?? 'Doctor'}</span>
                              <span className="text-sm text-ink-soft">
                                {formatFullDate(a.date)} at {formatTime(a.date)}
                              </span>
                            </div>
                            <span
                              className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold"
                              style={{ color: style.color, background: style.bg }}
                            >
                              {style.label}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                ) : null}
              </>
            )}
          </div>
        </div>
      </main>
    </>
  )
}