import Link from 'next/link'
import RiskLens from '@/components/RiskLens'

export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
  footer: React.ReactNode
}) {
  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-brand p-12 text-white md:flex">
        <Link href="/" className="font-display text-lg font-semibold">
          Mole tracker
        </Link>
        <div className="flex flex-col gap-8">
          <div aria-hidden="true">
            <RiskLens score={0.28} size={176} />
          </div>
          <div className="flex max-w-sm flex-col gap-3">
            <h2 className="font-display text-4xl font-semibold leading-tight tracking-tight">
              Track every mole over time.
            </h2>
            <p className="text-white/80">
              Photograph a mole, note what you see, and keep the full history to show your dermatologist.
            </p>
          </div>
        </div>
        <p className="max-w-sm text-sm text-white/70">
          This app is not a diagnosis. See a dermatologist about any mole that worries you.
        </p>
      </aside>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <Link href="/" className="font-display text-lg font-semibold text-brand md:hidden">
            Mole tracker
          </Link>
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
            <p className="text-ink-soft">{subtitle}</p>
          </div>
          {children}
          <p className="text-sm text-ink-soft">{footer}</p>
        </div>
      </section>
    </main>
  )
}