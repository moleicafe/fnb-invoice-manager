'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export default function LoginPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(false);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(true);
      setBusy(false);
      return;
    }
    router.push('/upload');
    router.refresh();
  }

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-4 p-6 pt-16">
      <div className="flex justify-end"><LanguageSwitcher /></div>
      <h1 className="text-xl font-semibold">{t('signIn')}</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          {t('email')}
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="rounded border p-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('password')}
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
            className="rounded border p-2" />
        </label>
        {error && <p className="text-sm text-red-600">{t('signInError')}</p>}
        <button type="submit" disabled={busy}
          className="rounded bg-blue-600 p-2 text-white disabled:opacity-50">
          {t('signIn')}
        </button>
      </form>
    </main>
  );
}
