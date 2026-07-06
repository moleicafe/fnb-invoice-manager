'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { ReviewForm, EMPTY_ITEM, type ReviewFormValues } from '@/components/ReviewForm';

type Phase = 'pick' | 'uploading' | 'extracting' | 'review';

interface ExtractResponse {
  extraction: {
    document_type: 'invoice' | 'statement' | 'other';
    supplier_name: string | null;
    invoice_number: string | null;
    invoice_date: string | null;
    line_items: { description: string; quantity: number | null; unit: string | null; unit_price: number | null; amount: number | null }[];
    subtotal: number | null;
    gst_amount: number | null;
    total: number | null;
    suggested_category: string | null;
  };
  matchedSupplier: { id: string; name: string; default_category: string | null } | null;
  duplicates: { id: string }[];
}

const s = (n: number | null) => (n == null ? '' : String(n));

export function UploadFlow(props: { locations: { id: string; name: string }[]; defaultLocationId: string }) {
  const t = useTranslations('upload');
  const [phase, setPhase] = useState<Phase>('pick');
  const [banner, setBanner] = useState<string | null>(null);
  const [filePaths, setFilePaths] = useState<string[]>([]);
  const [review, setReview] = useState<{ initial: ReviewFormValues; duplicates: { id: string }[]; newSupplier: boolean } | null>(null);

  function blankValues(): ReviewFormValues {
    return {
      locationId: props.defaultLocationId, supplierId: null, supplierName: '',
      invoiceNumber: '', invoiceDate: '', category: 'misc',
      subtotal: '', gst: '', total: '', items: [EMPTY_ITEM], extractionRaw: null,
    };
  }

  async function onFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).slice(0, 5);
    setBanner(null);
    setPhase('uploading');

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const paths: string[] = [];
    for (const file of files) {
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase() || '.jpg';
      const path = `${user!.id}/${crypto.randomUUID()}${ext}`;
      const { error } = await supabase.storage.from('invoices').upload(path, file);
      if (error) {
        setBanner(t('extractionFailed'));
        setPhase('pick');
        return;
      }
      paths.push(path);
    }
    setFilePaths(paths);
    setPhase('extracting');

    const res = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths }),
    });
    if (!res.ok) {
      // File is safe in storage — offer manual entry (spec §8)
      setBanner(t('extractionFailed'));
      setReview({ initial: blankValues(), duplicates: [], newSupplier: true });
      setPhase('review');
      return;
    }
    const payload = (await res.json()) as ExtractResponse;
    const e = payload.extraction;
    if (e.document_type !== 'invoice') setBanner(t('wrongDocType'));
    setReview({
      initial: {
        locationId: props.defaultLocationId,
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
            }))
          : [EMPTY_ITEM],
        extractionRaw: e,
      },
      duplicates: payload.duplicates,
      newSupplier: !payload.matchedSupplier,
    });
    setPhase('review');
  }

  if (phase === 'review' && review) {
    return (
      <div className="flex flex-col gap-3">
        {banner && <p className="rounded bg-amber-100 p-2 text-sm">{banner}</p>}
        <ReviewForm
          initial={review.initial}
          locations={props.locations}
          filePaths={filePaths}
          duplicates={review.duplicates}
          newSupplier={review.newSupplier}
          submitUrl="/api/invoices"
          method="POST"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 pt-8">
      <h1 className="text-lg font-semibold">{t('title')}</h1>
      {banner && <p className="rounded bg-amber-100 p-2 text-sm">{banner}</p>}
      {phase === 'pick' ? (
        <label className="cursor-pointer rounded-lg border-2 border-dashed p-10 text-center text-sm text-gray-600">
          {t('selectFiles')}
          <input
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => void onFiles(e.target.files)}
          />
        </label>
      ) : (
        <p className="text-sm text-gray-600">
          {phase === 'uploading' ? t('uploading') : t('extracting')}
        </p>
      )}
    </div>
  );
}
