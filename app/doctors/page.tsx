'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import AppNav from '@/components/AppNav'

type Doctor = {
  id: string
  name: string
  address: string
  phone: string | null
  website: string | null
  hours: string | null
  distanceKm: number
  directionsUrl: string
}

type SearchResult = {
  doctors: Doctor[]
  radiusKm: number
  where: string
  mapsUrl: string
}

const fieldClass = 'rounded-xl border border-line bg-paper px-4 py-2.5 text-sm placeholder:text-ink-soft/70'

function googleMapsUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

export default function DoctorsPage() {
  const router = useRouter()
  const [city, setCity] = useState('')
  const [locating, setLocating] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<SearchResult | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace('/login')
    })
  }, [router])

  async function runSearch(search: string, where: string, mapsQuery: string) {
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const response = await fetch(`/api/doctors?${search}`)
      const data = await response.json()
      if (!response.ok || !data.ok) {
        setError(data.error ?? 'Search failed. Try again in a moment.')
        return
      }
      setResult({
        doctors: data.doctors,
        radiusKm: data.radiusKm,
        where,
        mapsUrl: googleMapsUrl(mapsQuery),
      })
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  function findNearMe() {
    if (!navigator.geolocation) {
      setError('Your browser cannot share its location. Type your city below instead.')
      return
    }

    setError('')
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false)
        const { latitude, longitude } = position.coords
        runSearch(
          `lat=${latitude}&lng=${longitude}`,
          'your location',
          `dermatologist near ${latitude},${longitude}`
        )
      },
      () => {
        setLocating(false)
        setError("We couldn't get your location. Allow location access in your browser, or type your city below.")
      },
      { timeout: 10000 }
    )
  }

  function handleCitySearch(e: React.FormEvent) {
    e.preventDefault()
    const name = city.trim()
    if (!name) return
    runSearch(`q=${encodeURIComponent(name)}`, name, `dermatologist near ${name}`)
  }

  const busy = loading || locating

  return (
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Find a dermatologist</h1>
          <p className="text-ink-soft">
            Search near you, then book a visit and link it to the mole you are worried about.
          </p>
        </div>

        <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6">
          <button
            type="button"
            onClick={findNearMe}
            disabled={busy}
            className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
          >
            {locating ? 'Getting your location…' : 'Use my location'}
          </button>

          <p className="text-center text-sm text-ink-soft">or search by city or area</p>

          <form onSubmit={handleCitySearch} className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Bhopal, or Arera Colony Bhopal"
              aria-label="City or area"
              className={`${fieldClass} flex-1`}
            />
            <button
              type="submit"
              disabled={busy || !city.trim()}
              className="rounded-xl border border-brand px-5 py-2.5 text-sm font-semibold text-brand transition-opacity disabled:opacity-50"
            >
              Search
            </button>
          </form>
        </section>

        {error ? <p className="text-sm text-high">{error}</p> : null}

        {loading ? (
          <p className="text-sm text-ink-soft">Searching… this can take a few seconds.</p>
        ) : null}

        {result ? (
          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="font-display text-xl font-semibold">
                {result.doctors.length === 0
                  ? `No listings found near ${result.where}`
                  : `${result.doctors.length} ${result.doctors.length === 1 ? 'listing' : 'listings'} within about ${result.radiusKm} km of ${result.where}`}
              </h2>
              <p className="text-sm text-ink-soft">
                This list comes from OpenStreetMap, which has fewer clinics than Google Maps. Check with the
                clinic before you go, because details may be out of date.
              </p>
            </div>

            <a
              href={result.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-fit rounded-xl border border-brand px-5 py-2.5 text-sm font-semibold text-brand"
            >
              See more on Google Maps
            </a>

            {result.doctors.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {result.doctors.map((doctor) => (
                  <li
                    key={doctor.id}
                    className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-display text-lg font-semibold">{doctor.name}</h3>
                      <span className="shrink-0 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
                        {doctor.distanceKm} km
                      </span>
                    </div>

                    <div className="flex flex-col gap-1 text-sm text-ink-soft">
                      {doctor.address ? <span>{doctor.address}</span> : null}
                      {doctor.hours ? <span>Hours: {doctor.hours}</span> : null}
                      {doctor.phone ? (
                        <a href={`tel:${doctor.phone}`} className="w-fit font-medium text-brand">
                          {doctor.phone}
                        </a>
                      ) : null}
                      {doctor.website ? (
                        <a
                          href={doctor.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-fit font-medium text-brand"
                        >
                          Website
                        </a>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/appointments?doctor=${encodeURIComponent(doctor.name)}`}
                        className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        Book appointment
                      </Link>
                      <a
                        href={doctor.directionsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft"
                      >
                        Get directions
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        <p className="text-xs text-ink-soft">
          Listings ©{' '}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            OpenStreetMap contributors
          </a>
          .
        </p>
      </main>
    </>
  )
}