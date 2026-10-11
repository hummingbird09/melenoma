import Link from 'next/link'
import RiskLens from '@/components/RiskLens'

const STEPS = [
  {
    title: 'Photograph the mole',
    body: 'Take a clear, well-lit photo. Each one is saved so you can compare over time.',
  },
  {
    title: 'Answer five quick questions',
    body: 'Asymmetry, border, color, size and change. The same checklist dermatologists use.',
  },
  {
    title: 'See the trend, then decide',
    body: 'Get a risk estimate for each scan and a timeline. Book a visit when something shifts.',
  },
]

export default function Home() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6">
      <header className="flex items-center justify-between py-6">
        <span className="font-display text-lg font-semibold text-brand">Mole tracker</span>
        <Link
          href="/login"
          className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink-soft hover:text-ink"
        >
          Log in
        </Link>
      </header>

      <main className="flex flex-1 flex-col gap-16 py-10">
        <section className="flex flex-col items-center gap-10 md:flex-row md:justify-between">
          <div className="flex max-w-lg flex-col gap-6 text-center md:text-left">
            <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight">
              Notice changes in your moles early.
            </h1>
            <p className="text-lg text-ink-soft">
              Keep a photo history of every mole, check it against the ABCDE signs of melanoma, and know
              when it is time to see a dermatologist.
            </p>
            <div className="flex flex-wrap justify-center gap-3 md:justify-start">
              <Link href="/signup" className="rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white">
                Create an account
              </Link>
              <Link
                href="/login"
                className="rounded-xl border border-line bg-surface px-6 py-3 text-sm font-semibold"
              >
                Log in
              </Link>
            </div>
          </div>
          <div aria-hidden="true">
            <RiskLens score={0.28} size={280} />
          </div>
        </section>

        <section className="flex flex-col gap-6">
          <h2 className="font-display text-2xl font-semibold">How it works</h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-6">
                <span className="font-display text-sm font-semibold text-brand">Step {i + 1}</span>
                <h3 className="font-display text-lg font-semibold">{step.title}</h3>
                <p className="text-sm text-ink-soft">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="border-t border-line py-6 text-sm text-ink-soft">
        This app is a self-monitoring aid, not a medical diagnosis. See a dermatologist about any mole that
        worries you.
      </footer>
    </div>
  )
}