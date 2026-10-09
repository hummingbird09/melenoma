import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

const GEMINI_PROMPT =
  'You are assisting a self-monitoring skin health app that already displays a clear medical disclaimer to users (not a diagnostic tool, consult a dermatologist). Based on this photo of a skin lesion, provide an illustrative risk estimate for internal use in a prototype application. Respond ONLY with valid JSON in this exact shape, no markdown, no extra text: {"riskScore": <float 0 to 1, where higher means more melanoma-like features present>, "rationale": "<one sentence, plain language, non-diagnostic>"}'

function parseBooleanFlag(value: FormDataEntryValue | null): boolean {
  return String(value).toLowerCase() === 'true'
}

function parseGeminiJson(text: string): { riskScore: number; rationale: string } {
  const stripped = text
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()

  try {
    const parsed = JSON.parse(stripped) as { riskScore?: unknown; rationale?: unknown }
    const riskScore =
      typeof parsed.riskScore === 'number' && Number.isFinite(parsed.riskScore)
        ? parsed.riskScore
        : 0.5
    const rationale =
      typeof parsed.rationale === 'string' && parsed.rationale.trim()
        ? parsed.rationale
        : 'Automated assessment unavailable.'
    return { riskScore, rationale }
  } catch {
    return { riskScore: 0.5, rationale: 'Automated assessment unavailable.' }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const moleId = formData.get('moleId')
    const notesField = formData.get('notes')

    if (typeof moleId !== 'string' || !moleId) {
      return NextResponse.json({ ok: false, error: 'moleId is required' }, { status: 400 })
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'file is required' }, { status: 400 })
    }

    const asymmetry = parseBooleanFlag(formData.get('asymmetry'))
    const borderIrregular = parseBooleanFlag(formData.get('borderIrregular'))
    const colorUneven = parseBooleanFlag(formData.get('colorUneven'))
    const diameterOver6mm = parseBooleanFlag(formData.get('diameterOver6mm'))
    const evolving = parseBooleanFlag(formData.get('evolving'))
    const userNotes = typeof notesField === 'string' && notesField.trim() ? notesField.trim() : null

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { ok: false, error: 'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const bytes = Buffer.from(await file.arrayBuffer())
    const storagePath = `${moleId}/${Date.now()}-${file.name}`

    const { error: uploadError } = await supabase.storage.from('mole-photos').upload(storagePath, bytes, {
      contentType: file.type || 'image/jpeg',
    })

    if (uploadError) {
      return NextResponse.json({ ok: false, error: String(uploadError) }, { status: 500 })
    }

    const geminiApiKey = process.env.GEMINI_API_KEY
    if (!geminiApiKey) {
      return NextResponse.json({ ok: false, error: 'GEMINI_API_KEY must be set' }, { status: 500 })
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-3.8-flash' })
    const result = await model.generateContent([
      { text: GEMINI_PROMPT },
      {
        inlineData: {
          data: bytes.toString('base64'),
          mimeType: file.type || 'image/jpeg',
        },
      },
    ])
    const { riskScore: geminiRiskScore, rationale } = parseGeminiJson(result.response.text())

    const trueFlags = [asymmetry, borderIrregular, colorUneven, diameterOver6mm, evolving].filter(Boolean).length
    const checklistScore = trueFlags / 5
    const finalScore = clamp(geminiRiskScore * 0.6 + checklistScore * 0.4, 0.02, 0.99)

    const scan = await prisma.scan.create({
      data: {
        moleId,
        imageUrl: storagePath,
        riskScore: finalScore,
        asymmetry,
        borderIrregular,
        colorUneven,
        diameterOver6mm,
        evolving,
        notes: userNotes ?? rationale,
      },
    })

    return NextResponse.json({ ok: true, scan })
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 })
  }
}
