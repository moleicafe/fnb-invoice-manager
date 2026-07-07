import Link from 'next/link';
import { getTranslations, getLocale } from 'next-intl/server';
import { BRANDING, brandName } from '@/branding';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { MobileNav } from '@/components/MobileNav';
import { signOut } from '@/lib/auth/actions';
import { createClient } from '@/lib/supabase/server';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations();
  const locale = await getLocale();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from('profiles').select('role').eq('user_id', user.id).single()
    : { data: null };
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
          <Link href="/upload" className="flex min-w-0 items-center gap-2.5">
            {BRANDING.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={BRANDING.logoUrl} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover shadow-accent" />
            ) : (
              <span className="gradient-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-accent-foreground shadow-accent">
                {BRANDING.logoGlyph}
              </span>
            )}
            <span className="truncate whitespace-nowrap font-display text-base tracking-tight sm:text-lg">
              {brandName(locale)}
            </span>
          </Link>
          {/* Desktop nav — phones use the bottom tab bar instead */}
          <nav className="hidden items-center gap-1 text-sm font-medium sm:flex">
            <Link
              href="/upload"
              className="rounded-lg px-3 py-2 text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
            >
              {t('nav.upload')}
            </Link>
            <Link
              href="/invoices"
              className="rounded-lg px-3 py-2 text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
            >
              {t('nav.invoices')}
            </Link>
            {profile?.role === 'admin' && (
              <Link
                href="/dashboard"
                className="rounded-lg px-3 py-2 text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
              >
                {t('nav.dashboard')}
              </Link>
            )}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <LanguageSwitcher />
            <form action={signOut}>
              <button
                type="submit"
                className="whitespace-nowrap rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground sm:px-3"
              >
                {t('common.signOut')}
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6 sm:pb-8">{children}</main>
      <MobileNav isAdmin={profile?.role === 'admin'} />
    </div>
  );
}
