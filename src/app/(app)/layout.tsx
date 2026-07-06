import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { signOut } from '@/lib/auth/actions';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link href="/upload" className="flex items-center gap-2.5">
            <span className="gradient-accent flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-accent-foreground shadow-accent">
              发
            </span>
            <span className="font-display text-lg tracking-tight">{t('common.appName')}</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm font-medium">
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
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <LanguageSwitcher />
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
              >
                {t('common.signOut')}
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
