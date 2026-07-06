'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CATEGORIES, type Category } from '../lib/categories';
import { hasArithmeticWarning } from '../lib/invoice/checks';

export interface ReviewItemValues {
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  amount: string;
}

export interface ReviewFormValues {
  locationId: string;
  supplierId: string | null;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  category: Category;
  subtotal: string;
  gst: string;
  total: string;
  items: ReviewItemValues[];
  extractionRaw: unknown | null;
}

export const EMPTY_ITEM: ReviewItemValues = { description: '', quantity: '', unit: '', unitPrice: '', amount: '' };

function num(s: string): number | null {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : null;
}

export function ReviewForm(props: {
  initial: ReviewFormValues;
  locations: { id: string; name: string }[];
  filePaths: string[];
  duplicates: { id: string }[];
  newSupplier: boolean;
  submitUrl: string;
  method: 'POST' | 'PATCH';
}) {
  const t = useTranslations();
  const router = useRouter();
  const [v, setV] = useState(props.initial);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const arithmeticWarning = hasArithmeticWarning(num(v.subtotal), num(v.gst), num(v.total));

  function setItem(i: number, patch: Partial<ReviewItemValues>) {
    setV((cur) => ({ ...cur, items: cur.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) }));
  }

  async function submit(confirmedDuplicate: boolean) {
    setBusy(true);
    setServerError(null);
    const res = await fetch(props.submitUrl, {
      method: props.method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locationId: v.locationId,
        supplierId: v.supplierId,
        supplierName: v.supplierName.trim(),
        invoiceNumber: v.invoiceNumber.trim() || null,
        invoiceDate: v.invoiceDate || null,
        category: v.category,
        subtotal: num(v.subtotal),
        gstAmount: num(v.gst),
        total: num(v.total),
        filePaths: props.filePaths,
        extractionRaw: v.extractionRaw,
        confirmedDuplicate,
        items: v.items
          .filter((it) => it.description.trim())
          .map((it) => ({
            description: it.description.trim(),
            quantity: num(it.quantity),
            unit: it.unit.trim() || null,
            unitPrice: num(it.unitPrice),
            amount: num(it.amount),
          })),
      }),
    });
    if (res.status === 409) {
      setBusy(false);
      if (window.confirm(t('review.duplicateConfirm'))) await submit(true);
      return;
    }
    if (!res.ok) {
      setBusy(false);
      setServerError(t('review.saveFailed'));
      return;
    }
    const { id } = await res.json();
    router.push(`/invoices/${id}`);
  }

  const input = 'rounded border p-2 text-sm';

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); void submit(false); }}
      className="flex flex-col gap-4"
    >
      <h1 className="text-lg font-semibold">{t('review.title')}</h1>

      {props.duplicates.length > 0 && (
        <p className="rounded bg-amber-100 p-2 text-sm">{t('review.duplicateConfirm')}</p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          {t('upload.selectLocation')}
          <select className={input} value={v.locationId}
            onChange={(e) => setV({ ...v, locationId: e.target.value })}>
            {props.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('review.supplier')}
          <input required className={input} value={v.supplierName}
            onChange={(e) => setV({ ...v, supplierName: e.target.value, supplierId: null })} />
          {props.newSupplier && <span className="text-xs text-blue-600">{t('review.newSupplierHint')}</span>}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('review.invoiceNumber')}
          <input className={input} value={v.invoiceNumber}
            onChange={(e) => setV({ ...v, invoiceNumber: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('review.invoiceDate')}
          <input type="date" className={input} value={v.invoiceDate}
            onChange={(e) => setV({ ...v, invoiceDate: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('review.category')}
          <select className={input} value={v.category}
            onChange={(e) => setV({ ...v, category: e.target.value as Category })}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{t(`categories.${c}`)}</option>)}
          </select>
        </label>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">{t('review.items')}</legend>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="p-1">{t('review.description')}</th>
                <th className="p-1 w-20">{t('review.quantity')}</th>
                <th className="p-1 w-16">{t('review.unit')}</th>
                <th className="p-1 w-24">{t('review.unitPrice')}</th>
                <th className="p-1 w-24">{t('review.amount')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {v.items.map((it, i) => (
                <tr key={i}>
                  <td className="p-1"><input className={`${input} w-full`} value={it.description}
                    onChange={(e) => setItem(i, { description: e.target.value })} /></td>
                  <td className="p-1"><input inputMode="decimal" className={`${input} w-full`} value={it.quantity}
                    onChange={(e) => setItem(i, { quantity: e.target.value })} /></td>
                  <td className="p-1"><input className={`${input} w-full`} value={it.unit}
                    onChange={(e) => setItem(i, { unit: e.target.value })} /></td>
                  <td className="p-1"><input inputMode="decimal" className={`${input} w-full`} value={it.unitPrice}
                    onChange={(e) => setItem(i, { unitPrice: e.target.value })} /></td>
                  <td className="p-1"><input inputMode="decimal" className={`${input} w-full`} value={it.amount}
                    onChange={(e) => setItem(i, { amount: e.target.value })} /></td>
                  <td className="p-1">
                    <button type="button" className="text-xs text-red-600 underline"
                      onClick={() => setV((cur) => ({ ...cur, items: cur.items.filter((_, j) => j !== i) }))}>
                      {t('review.removeItem')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" className="self-start text-sm text-blue-600 underline"
          onClick={() => setV((cur) => ({ ...cur, items: [...cur.items, EMPTY_ITEM] }))}>
          {t('review.addItem')}
        </button>
      </fieldset>

      <div className="grid grid-cols-3 gap-3">
        {(['subtotal', 'gst', 'total'] as const).map((f) => (
          <label key={f} className="flex flex-col gap-1 text-sm">
            {t(`review.${f}`)}
            <input inputMode="decimal" className={input} value={v[f]}
              onChange={(e) => setV({ ...v, [f]: e.target.value })} />
          </label>
        ))}
      </div>

      {arithmeticWarning && (
        <p className="rounded bg-amber-100 p-2 text-sm">{t('review.arithmeticWarning')}</p>
      )}
      {serverError && <p className="text-sm text-red-600">{serverError}</p>}

      <button type="submit" disabled={busy}
        className="rounded bg-blue-600 p-3 text-white disabled:opacity-50">
        {t('review.submit')}
      </button>
    </form>
  );
}
