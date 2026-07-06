'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { ReviewForm, EMPTY_ITEM, type ReviewFormValues } from '@/components/ReviewForm';
import { Spinner } from '@/components/ui/spinner';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type Phase = 'pick' | 'working' | 'wizard' | 'done';
type Mode = 'batch' | 'pages';

interface Job {
  filePaths: string[];
  banner: 'failed' | 'wrongDocType' | null;
  initial: ReviewFormValues;
  duplicates: { id: string }[];
  newSupplier: boolean;
}

interface ExtractResponse {
  extraction: {
    document_type: 'invoice' | 'statement' | 'other';
    supplier_name: string | null;
    invoice_number: string | null;
    invoice_date: string | null;
    line_items: { description: string; quantity: number | null; unit: string | null; unit_price: number | null; amount: number | null; name_en: string | null; name_zh: string | null }[];
    subtotal: number | null;
    gst_amount: number | null;
    total: number | null;
    suggested_category: string | null;
  };
  matchedSupplier: { id: string; name: string; default_category: string | null } | null;
  matchedLocationId: string | null;
  duplicates: { id: string }[];
}

const s = (n: number | null) => (n == null ? '' : String(n));

export function UploadFlow(props: { locations: { id: string; name: string }[]; defaultLocationId: string }) {
  const t = useTranslations('upload');
  const [mode, setMode] = useState<Mode>('batch');
  const [phase, setPhase] = useState<Phase>('pick');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [current, setCurrent] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [settled, setSettled] = useState(0);
  const [total, setTotal] = useState(0);
  const [pickError, setPickError] = useState(false);

  function blankValues(): ReviewFormValues {
    return {
      locationId: props.defaultLocationId, supplierId: null, supplierName: '',
      invoiceNumber: '', invoiceDate: '', category: 'misc',
      subtotal: '', gst: '', total: '', items: [EMPTY_ITEM], extractionRaw: null,
    };
  }

  async function extractJob(paths: string[]): Promise<Job> {
    const failed: Job = { filePaths: paths, banner: 'failed', initial: blankValues(), duplicates: [], newSupplier: true };
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths }),
      });
      setSettled((n) => n + 1);
      if (!res.ok) {
        return failed;
      }
      const payload = (await res.json()) as ExtractResponse;
      const e = payload.extraction;
      return {
        filePaths: paths,
        banner: e.document_type !== 'invoice' ? 'wrongDocType' : null,
        initial: {
          locationId: payload.matchedLocationId ?? props.defaultLocationId,
          supplierId: payload.matchedSupplier?.id ?? null,
          supplierName: payload.matchedSupplier?.name ?? e.supplier_name ?? '',
          invoiceNumber: e.invoice_number ?? '',
          invoiceDate: e.invoice_date ?? '',
          category: (e.suggested_category ?? payload.matchedSupplier?.default_category ?? 'misc') as ReviewFormValues['category'],
          subtotal: s(e.subtotal), gst: s(e.gst_amount), total: s(e.total),
          items: e.line_items.length
            ? e.line_items.map((li) => ({
                description: li.description, quantity: s(li.quantity), unit: li.unit ?? '',
                unitPrice: s(li.unit_price), amount: s(li.amount),
                nameEn: li.name_en, nameZh: li.name_zh,
              }))
            : [EMPTY_ITEM],
          extractionRaw: e,
        },
        duplicates: payload.duplicates,
        newSupplier: !payload.matchedSupplier,
      };
    } catch {
      setSettled((n) => n + 1);
      return failed;
    }
  }

  async function onFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).slice(0, mode === 'batch' ? 10 : 5);
    setPickError(false);
    setPhase('working');
    setSettled(0);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const uploaded: string[] = [];
    for (const file of files) {
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase() || '.jpg';
      const path = `${user!.id}/${crypto.randomUUID()}${ext}`;
      const { error } = await supabase.storage.from('invoices').upload(path, file);
      if (error) {
        setPickError(true);
        setPhase('pick');
        return;
      }
      uploaded.push(path);
    }

    const groups = mode === 'pages' ? [uploaded] : uploaded.map((p) => [p]);
    setTotal(groups.length);
    const results = await Promise.all(groups.map((g) => extractJob(g)));
    setJobs(results);
    setCurrent(0);
    setSavedCount(0);
    setPhase('wizard');
  }

  function advance() {
    if (current + 1 < jobs.length) setCurrent(current + 1);
    else setPhase('done');
  }

  if (phase === 'wizard' && jobs[current]) {
    const job = jobs[current];
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="font-mono text-xs uppercase tracking-[0.15em] text-accent">
            {t('progress', { current: current + 1, total: jobs.length })}
          </p>
          <button type="button" className={buttonVariants({ variant: 'ghost', size: 'sm' })} onClick={advance}>
            {t('skip')}
          </button>
        </div>
        {job.banner && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {job.banner === 'failed' ? t('extractionFailed') : t('wrongDocType')}
          </p>
        )}
        <ReviewForm
          key={current}
          initial={job.initial}
          locations={props.locations}
          filePaths={job.filePaths}
          duplicates={job.duplicates}
          newSupplier={job.newSupplier}
          submitUrl="/api/invoices"
          method="POST"
          onSaved={() => {
            setSavedCount((n) => n + 1);
            advance();
          }}
        />
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="flex flex-col items-center gap-6 pt-16 text-center">
        <Card className="flex w-full max-w-xl flex-col items-center gap-4 p-10">
          <p className="font-display text-2xl tracking-tight">
            {t('batchDone', { saved: savedCount, total: jobs.length })}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link className={buttonVariants({ size: 'lg' })} href="/invoices">
              {t('viewInvoices')}
            </Link>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => {
                setJobs([]);
                setCurrent(0);
                setSavedCount(0);
                setPhase('pick');
              }}
            >
              {t('uploadMore')}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center gap-8 pt-10 sm:pt-16">
      {/* Ambient glow behind the dropzone */}
      <div className="pointer-events-none absolute left-1/2 top-8 h-72 w-72 -translate-x-1/2 rounded-full bg-accent/5 blur-[120px]" />

      <h1 className="font-display text-3xl tracking-tight sm:text-4xl">{t('title')}</h1>
      {pickError && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t('extractionFailed')}
        </p>
      )}
      {phase === 'pick' ? (
        <>
          <div className="flex gap-2">
            <button
              type="button"
              className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                mode === 'batch' ? 'border-accent/40 bg-accent/5 text-accent' : 'border-border text-muted-foreground'
              }`}
              onClick={() => setMode('batch')}
            >
              {t('modeMultiple')}
            </button>
            <button
              type="button"
              className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                mode === 'pages' ? 'border-accent/40 bg-accent/5 text-accent' : 'border-border text-muted-foreground'
              }`}
              onClick={() => setMode('pages')}
            >
              {t('modeSinglePages')}
            </button>
          </div>
          <label className="group relative w-full max-w-xl cursor-pointer rounded-2xl border-2 border-dashed border-border bg-card p-10 text-center shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-xl sm:p-14">
            <div className="gradient-accent mx-auto flex h-14 w-14 items-center justify-center rounded-2xl shadow-accent transition-transform duration-300 group-hover:scale-110">
              <svg
                className="h-7 w-7 text-accent-foreground"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 16V4m0 0 4 4m-4-4-4 4" />
                <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
              </svg>
            </div>
            <p className="mt-5 text-base font-medium text-foreground">{t('selectFiles')}</p>
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => void onFiles(e.target.files)}
            />
          </label>
        </>
      ) : (
        <div className="flex w-full max-w-xl flex-col items-center gap-5 rounded-2xl border border-border bg-card p-14 shadow-md">
          <Spinner className="h-8 w-8" />
          <p className="font-mono text-xs uppercase tracking-[0.15em] text-accent">
            {t('extracting')} {settled}/{total}
          </p>
        </div>
      )}
    </div>
  );
}
