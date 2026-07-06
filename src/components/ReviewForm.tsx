'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CATEGORIES, type Category } from '../lib/categories';
import { hasArithmeticWarning } from '../lib/invoice/checks';
import { Button } from './ui/button';
import { Card } from './ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
} from './ui/alert-dialog';
import { fieldStyles, fieldStylesCompact, labelStyles } from './ui/field';

export interface ReviewItemValues {
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  amount: string;
  nameEn: string | null;
  nameZh: string | null;
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

export const EMPTY_ITEM: ReviewItemValues = {
  description: '', quantity: '', unit: '', unitPrice: '', amount: '',
  nameEn: null, nameZh: null,
};

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
  onSaved?: (id: string) => void;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [v, setV] = useState(props.initial);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [dupOpen, setDupOpen] = useState(false);

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
            nameEn: it.nameEn,
            nameZh: it.nameZh,
          })),
      }),
    });
    if (res.status === 409) {
      setBusy(false);
      setDupOpen(true);
      return;
    }
    if (!res.ok) {
      setBusy(false);
      setServerError(t('review.saveFailed'));
      return;
    }
    const { id } = await res.json();
    if (props.onSaved) {
      setBusy(false);
      props.onSaved(id as string);
    } else {
      router.push(`/invoices/${id}`);
    }
  }

  const warningBanner =
    'rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800';

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); void submit(false); }}
      className="mx-auto flex w-full max-w-3xl flex-col gap-5"
    >
      <h1 className="font-display text-2xl tracking-tight sm:text-3xl">{t('review.title')}</h1>

      {props.duplicates.length > 0 && (
        <p className={warningBanner}>{t('review.duplicateConfirm')}</p>
      )}

      <Card className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
        <label className={labelStyles}>
          {t('upload.selectLocation')}
          <select className={fieldStyles} value={v.locationId}
            onChange={(e) => setV({ ...v, locationId: e.target.value })}>
            {props.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        <label className={labelStyles}>
          {t('review.supplier')}
          <input required className={fieldStyles} value={v.supplierName}
            onChange={(e) => setV({ ...v, supplierName: e.target.value, supplierId: null })} />
          {props.newSupplier && (
            <span className="text-xs font-normal text-accent">{t('review.newSupplierHint')}</span>
          )}
        </label>
        <label className={labelStyles}>
          {t('review.invoiceNumber')}
          <input className={fieldStyles} value={v.invoiceNumber}
            onChange={(e) => setV({ ...v, invoiceNumber: e.target.value })} />
        </label>
        <label className={labelStyles}>
          {t('review.invoiceDate')}
          <input type="date" className={fieldStyles} value={v.invoiceDate}
            onChange={(e) => setV({ ...v, invoiceDate: e.target.value })} />
        </label>
        <label className={labelStyles}>
          {t('review.category')}
          <select className={fieldStyles} value={v.category}
            onChange={(e) => setV({ ...v, category: e.target.value as Category })}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{t(`categories.${c}`)}</option>)}
          </select>
        </label>
      </Card>

      <Card className="p-6">
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-sm font-semibold tracking-[-0.01em]">{t('review.items')}</legend>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  <th className="p-1.5 font-medium">{t('review.description')}</th>
                  <th className="w-20 p-1.5 font-medium">{t('review.quantity')}</th>
                  <th className="w-16 p-1.5 font-medium">{t('review.unit')}</th>
                  <th className="w-24 p-1.5 font-medium">{t('review.unitPrice')}</th>
                  <th className="w-24 p-1.5 font-medium">{t('review.amount')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {v.items.map((it, i) => (
                  <tr key={i}>
                    <td className="p-1.5"><input className={fieldStylesCompact} value={it.description}
                      onChange={(e) => setItem(i, { description: e.target.value })} /></td>
                    <td className="p-1.5"><input inputMode="decimal" className={fieldStylesCompact} value={it.quantity}
                      onChange={(e) => setItem(i, { quantity: e.target.value })} /></td>
                    <td className="p-1.5"><input className={fieldStylesCompact} value={it.unit}
                      onChange={(e) => setItem(i, { unit: e.target.value })} /></td>
                    <td className="p-1.5"><input inputMode="decimal" className={fieldStylesCompact} value={it.unitPrice}
                      onChange={(e) => setItem(i, { unitPrice: e.target.value })} /></td>
                    <td className="p-1.5"><input inputMode="decimal" className={fieldStylesCompact} value={it.amount}
                      onChange={(e) => setItem(i, { amount: e.target.value })} /></td>
                    <td className="p-1.5">
                      <button
                        type="button"
                        className="rounded-lg px-2 py-1 text-xs text-red-600 transition-colors duration-200 hover:bg-red-50"
                        onClick={() => setV((cur) => ({ ...cur, items: cur.items.filter((_, j) => j !== i) }))}
                      >
                        {t('review.removeItem')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="self-start rounded-lg px-2 py-1 text-sm font-medium text-accent transition-colors duration-200 hover:bg-accent/5"
            onClick={() => setV((cur) => ({ ...cur, items: [...cur.items, EMPTY_ITEM] }))}
          >
            + {t('review.addItem')}
          </button>
        </fieldset>
      </Card>

      <Card className="p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {(['subtotal', 'gst', 'total'] as const).map((f) => (
            <label key={f} className={labelStyles}>
              {t(`review.${f}`)}
              <input inputMode="decimal" className={fieldStyles} value={v[f]}
                onChange={(e) => setV({ ...v, [f]: e.target.value })} />
            </label>
          ))}
        </div>
        {arithmeticWarning && (
          <p className={`${warningBanner} mt-4`}>{t('review.arithmeticWarning')}</p>
        )}
      </Card>

      {serverError && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {serverError}
        </p>
      )}

      <Button type="submit" size="lg" disabled={busy} className="w-full">
        {t('review.submit')}
      </Button>

      <AlertDialog open={dupOpen} onOpenChange={setDupOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogDescription>{t('review.duplicateConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDupOpen(false);
                void submit(true);
              }}
            >
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
