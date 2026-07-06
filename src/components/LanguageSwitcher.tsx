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
      className="text-sm underline"
    >
      {locale === 'en' ? '中文' : 'EN'}
    </button>
  );
}
