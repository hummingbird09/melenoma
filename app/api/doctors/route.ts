import { NextResponse } from 'next/server'

// OpenStreetMap's services ask every app to identify itself
const USER_AGENT = 'MoleTracker/1.0 (student project)'

type Center = { lat: number; lng: number }

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

type OsmElement = {
  type: string
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

type NominatimResult = {
  place_id: number
  lat: string
  lon: string
  name?: string
  display_name: string
  extratags?: Record<string, string> | null
}

function distanceKm(a: Center, b: Center) {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

function makeDoctor(
  fields: Omit<Doctor, 'distanceKm' | 'directionsUrl'>,
  point: Center,
  center: Center
): Doctor {
  return {
    ...fields,
    distanceKm: Math.round(distanceKm(center, point) * 10) / 10,
    directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`,
  }
}

// City or area name -> coordinates (Nominatim)
async function geocode(query: string): Promise<(Center & { label: string }) | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error('Place lookup failed')
  const results = (await response.json()) as { lat: string; lon: string; display_name: string }[]
  if (!results.length) return null
  return {
    lat: Number(results[0].lat),
    lng: Number(results[0].lon),
    label: results[0].display_name,
  }
}

/* ---------- Source 1: Overpass (thorough, but the public servers are flaky) ---------- */

// Public Overpass servers are shared and sometimes broken, so we try several in turn
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

function buildAddress(tags: Record<string, string>) {
  if (tags['addr:full']) return tags['addr:full']
  return [
    [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' '),
    tags['addr:suburb'],
    tags['addr:city'],
    tags['addr:postcode'],
  ]
    .filter(Boolean)
    .join(', ')
}

async function findDermatology(center: Center, radiusMeters: number): Promise<OsmElement[]> {
  const around = `(around:${radiusMeters},${center.lat},${center.lng})`

  // Cheap filters first: rare tags, or an exact amenity type before any name matching.
  const query = `
    [out:json][timeout:25];
    (
      nwr["healthcare:speciality"~"dermatolog"]${around};
      nwr["speciality"~"dermatolog"]${around};
      nwr["amenity"="clinic"]["name"~"skin|derma",i]${around};
      nwr["amenity"="doctors"]["name"~"skin|derma",i]${around};
      nwr["amenity"="hospital"]["name"~"skin|derma",i]${around};
    );
    out tags center 60;
  `

  const failures: string[] = []

  for (const endpoint of OVERPASS_ENDPOINTS) {
    const host = new URL(endpoint).host
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(20000),
      })

      if (!response.ok) {
        failures.push(`${host}: HTTP ${response.status}`)
        continue
      }

      try {
        const data = JSON.parse(await response.text()) as { elements?: OsmElement[] }
        return data.elements ?? []
      } catch {
        failures.push(`${host}: unreadable reply`)
      }
    } catch (err) {
      failures.push(`${host}: ${err instanceof Error ? err.name : 'failed'}`)
    }
  }

  throw new Error(`All Overpass servers failed (${failures.join('; ')})`)
}

async function searchOverpass(center: Center): Promise<{ doctors: Doctor[]; radiusKm: number }> {
  // Search 10 km around it; if that finds very little, widen to 30 km
  let elements = await findDermatology(center, 10000)
  let radiusKm = 10
  if (elements.length < 3) {
    elements = await findDermatology(center, 30000)
    radiusKm = 30
  }

  const doctors = elements
    .map((el) => {
      const tags = el.tags ?? {}
      const pos = el.type === 'node' ? { lat: el.lat, lng: el.lon } : { lat: el.center?.lat, lng: el.center?.lon }
      if (!tags.name || pos.lat === undefined || pos.lng === undefined) return null
      return makeDoctor(
        {
          id: `${el.type}-${el.id}`,
          name: tags.name,
          address: buildAddress(tags),
          phone: tags.phone ?? tags['contact:phone'] ?? null,
          website: tags.website ?? tags['contact:website'] ?? null,
          hours: tags.opening_hours ?? null,
        },
        { lat: pos.lat, lng: pos.lng },
        center
      )
    })
    .filter((d): d is Doctor => d !== null)

  return { doctors, radiusKm }
}

/* ---------- Source 2: Nominatim (simpler, but a separate system, so a good backup) ---------- */

async function searchNominatim(center: Center): Promise<Doctor[]> {
  const delta = 0.15 // about 16 km each way
  const viewbox = `${center.lng - delta},${center.lat + delta},${center.lng + delta},${center.lat - delta}`
  const terms = ['dermatologist', 'skin clinic']
  const found = new Map<number, Doctor>()

  for (let i = 0; i < terms.length; i++) {
    // Nominatim allows about one request per second
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, 1100))

    const url =
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=20&extratags=1` +
      `&viewbox=${viewbox}&bounded=1&q=${encodeURIComponent(terms[i])}`

    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) throw new Error(`Nominatim search failed (HTTP ${response.status})`)

    const results = (await response.json()) as NominatimResult[]
    for (const r of results) {
      if (!r.name || found.has(r.place_id)) continue
      const extra = r.extratags ?? {}
      found.set(
        r.place_id,
        makeDoctor(
          {
            id: `place-${r.place_id}`,
            name: r.name,
            address: r.display_name,
            phone: extra.phone ?? extra['contact:phone'] ?? null,
            website: extra.website ?? extra['contact:website'] ?? null,
            hours: extra.opening_hours ?? null,
          },
          { lat: Number(r.lat), lng: Number(r.lon) },
          center
        )
      )
    }
  }

  return [...found.values()]
}

/* ---------- The route ---------- */

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams
    const q = params.get('q')?.trim().slice(0, 100) ?? ''
    const lat = Number(params.get('lat'))
    const lng = Number(params.get('lng'))
    const hasCoords = params.has('lat') && params.has('lng') && Number.isFinite(lat) && Number.isFinite(lng)

    if (!q && !hasCoords) {
      return NextResponse.json(
        { ok: false, error: 'Provide lat and lng, or q (a city or area)' },
        { status: 400 }
      )
    }

    // 1. Work out the center of the search
    let center: Center
    let label: string | null = null

    if (q) {
      const place = await geocode(q)
      if (!place) {
        return NextResponse.json(
          { ok: false, error: `Couldn't find "${q}". Try a city or neighbourhood name.` },
          { status: 404 }
        )
      }
      center = { lat: place.lat, lng: place.lng }
      label = place.label
    } else {
      center = { lat, lng }
    }

    // 2. Search: Overpass first, Nominatim as the backup
    let doctors: Doctor[] = []
    let radiusKm = 10
    let source: 'overpass' | 'nominatim' = 'overpass'

    try {
      const result = await searchOverpass(center)
      doctors = result.doctors
      radiusKm = result.radiusKm
    } catch (overpassError) {
      console.error('[doctors] Overpass failed:', overpassError)
    }

    if (doctors.length === 0) {
      doctors = await searchNominatim(center)
      radiusKm = 16
      source = 'nominatim'
    }

    // 3. Nearest first
    doctors = doctors.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 25)

    return NextResponse.json({ ok: true, doctors, center, label, radiusKm, source })
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 })
  }
}