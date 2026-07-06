import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { signOut } from '@/lib/auth/actions';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations();
  return (
    <div className="mx-auto max-w-5xl">
      <header className="flex items-center gap-4 border-b bg-white p-4">
        <span className="font-semibold">{t('common.appName')}</span>
        <nav className="flex gap-3 text-sm">
          <Link href="/upload" className="underline">{t('nav.upload')}</Link>
          <Link href="/invoices" className="underline">{t('nav.invoices')}</Link>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <LanguageSwitcher />
          <form action={signOut}>
            <button type="submit" className="text-sm text-gray-500 underline">{t('common.signOut')}</button>
          </form>
        </div>
      </header>
      <main className="p-4">{children}</main>
    </div>
  );
}
