'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { brandName } from '@/branding';
import { createClient } from '@/lib/supabase/client';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SectionLabel } from '@/components/ui/badge';
import { fieldStyles, labelStyles } from '@/components/ui/field';

export default function LoginPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const locale = useLocale();
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

  // Gradient-highlight the last word of the headline (design-system signature);
  // for zh-CN the whole compact headline takes the gradient.
  const appName = brandName(locale);
  const words = appName.split(' ');
  const leading = words.slice(0, -1).join(' ');
  const last = words[words.length - 1];

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      {/* Ambient radial glows — felt, not seen */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-accent/5 blur-[150px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-accent-secondary/5 blur-[150px]" />

      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <SectionLabel pulse>{t('signIn')}</SectionLabel>
          <LanguageSwitcher />
        </div>

        <h1 className="font-display text-4xl leading-[1.15] tracking-[-0.02em]">
          {leading ? <>{leading} </> : null}
          <span className="gradient-text">{last}</span>
        </h1>

        <Card className="mt-8 p-8">
          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            <label className={labelStyles}>
              {t('email')}
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={fieldStyles}
              />
            </label>
            <label className={labelStyles}>
              {t('password')}
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={fieldStyles}
              />
            </label>
            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {t('signInError')}
              </p>
            )}
            <Button type="submit" size="lg" disabled={busy} className="mt-1 w-full">
              {t('signIn')}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
