'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const LINKS = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/moles', label: 'Moles' },
  { href: '/appointments', label: 'Appointments' },
]

export default function AppNav() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="hidden font-display text-lg font-semibold text-brand sm:block">
            Mole tracker
          </Link>
          <nav className="flex gap-1">
            {LINKS.map((link) => {
              const active = pathname === link.href || pathname.startsWith(link.href + '/')
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    active ? 'bg-brand-soft text-brand' : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
        >
          Log out
        </button>
      </div>
    </header>
  )
}