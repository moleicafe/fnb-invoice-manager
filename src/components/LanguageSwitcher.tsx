'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();

  function switchTo(next: string) {
    document.cookie = `NEXT_LOCALE=${next};path=/;max-age=31536000`;
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={() => switchTo(locale === 'en' ? 'zh-CN' : 'en')}
      className="rounded-full border border-border bg-card px-3 py-1.5 font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground transition-all duration-200 hover:border-accent/30 hover:text-accent"
    >
      {locale === 'en' ? '中文' : 'EN'}
    </button>
  );
}
