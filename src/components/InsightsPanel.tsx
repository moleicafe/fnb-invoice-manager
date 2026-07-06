'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { SectionLabel } from './ui/badge';
import { Spinner } from './ui/spinner';
import { SimpleMarkdown } from './SimpleMarkdown';

export function InsightsPanel({
  month,
  initialReport,
}: {
  month: string;
  initialReport: string | null;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [report, setReport] = useState(initialReport);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month }),
    });
    if (!res.ok) {
      setBusy(false);
      setError(t('review.saveFailed'));
      return;
    }
    const { content } = (await res.json()) as { content: string };
    setReport(content);
    setBusy(false);
    router.refresh();
  }

  return (
    <Card className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <SectionLabel>{t('dashboard.insights')}</SectionLabel>
        <Button onClick={() => void generate()} disabled={busy}>
          {busy ? (
            <>
              <Spinner className="h-4 w-4" />
              {t('dashboard.generating')}
            </>
          ) : report ? (
            t('dashboard.regenerate')
          ) : (
            t('dashboard.generate')
          )}
        </Button>
      </div>
      {error && (
        <p className="mb-4 text-sm text-red-600">{error}</p>
      )}
      {report ? (
        <SimpleMarkdown text={report} />
      ) : (
        <p className="text-sm text-muted-foreground">{t('dashboard.noReport')}</p>
      )}
    </Card>
  );
}
