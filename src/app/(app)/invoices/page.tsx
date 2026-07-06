import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { buttonStyles } from '@/components/ui/button';
import { StatusChip, type StatusKind } from '@/components/ui/badge';
import { fieldStyles } from '@/components/ui/field';

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const t = await getTranslations();
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: locations } = await supabase
    .from('locations').select('id, name').eq('active', true).order('name');

  let query = supabase
    .from('invoices')
    .select('id, invoice_number, invoice_date, total, category, review_status, payment_status, suppliers(name), locations(name)')
    .order('invoice_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(200);
  if (sp.status) query = query.eq('review_status', sp.status);
  if (sp.payment) query = query.eq('payment_status', sp.payment);
  if (sp.location) query = query.eq('location_id', sp.location);
  if (sp.from) query = query.gte('invoice_date', sp.from);
  if (sp.to) query = query.lte('invoice_date', sp.to);
  const { data: invoices } = await query;

  const rel = (v: unknown) => (v as { name: string } | null)?.name ?? '—';
  const filterLabel = 'flex flex-col gap-1.5 text-xs font-medium text-muted-foreground';

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl tracking-tight sm:text-3xl">{t('invoices.title')}</h1>

      <form
        method="GET"
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4 shadow-md"
      >
        <label className={filterLabel}>
          {t('invoices.status')}
          <select name="status" defaultValue={sp.status ?? ''} className={fieldStyles}>
            <option value="">{t('invoices.all')}</option>
            <option value="pending_review">{t('invoices.pending_review')}</option>
            <option value="approved">{t('invoices.approved')}</option>
            <option value="needs_manual_entry">{t('invoices.needs_manual_entry')}</option>
          </select>
        </label>
        <label className={filterLabel}>
          {t('invoices.paymentStatus')}
          <select name="payment" defaultValue={sp.payment ?? ''} className={fieldStyles}>
            <option value="">{t('invoices.all')}</option>
            <option value="unpaid">{t('invoices.unpaid')}</option>
            <option value="paid">{t('invoices.paid')}</option>
          </select>
        </label>
        <label className={filterLabel}>
          {t('invoices.location')}
          <select name="location" defaultValue={sp.location ?? ''} className={fieldStyles}>
            <option value="">{t('invoices.all')}</option>
            {(locations ?? []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        <label className={filterLabel}>
          {t('invoices.from')}
          <input type="date" name="from" defaultValue={sp.from ?? ''} className={fieldStyles} />
        </label>
        <label className={filterLabel}>
          {t('invoices.to')}
          <input type="date" name="to" defaultValue={sp.to ?? ''} className={fieldStyles} />
        </label>
        <button type="submit" className={buttonStyles('primary', 'md')}>
          {t('invoices.apply')}
        </button>
        <Link href="/invoices" className={buttonStyles('ghost', 'md')}>
          {t('invoices.clear')}
        </Link>
      </form>

      {(invoices ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-16 text-center">
          <p className="text-sm text-muted-foreground">{t('invoices.empty')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-md">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                <th className="p-3 font-medium">{t('invoices.date')}</th>
                <th className="p-3 font-medium">{t('review.supplier')}</th>
                <th className="p-3 font-medium">{t('invoices.number')}</th>
                <th className="p-3 font-medium">{t('invoices.location')}</th>
                <th className="p-3 font-medium">{t('review.category')}</th>
                <th className="p-3 text-right font-medium">{t('invoices.total')}</th>
                <th className="p-3 font-medium">{t('invoices.status')}</th>
                <th className="p-3 font-medium">{t('invoices.paymentStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {(invoices ?? []).map((inv) => (
                <tr
                  key={inv.id}
                  className="border-b border-border/60 transition-colors duration-150 last:border-0 hover:bg-accent/[0.03]"
                >
                  <td className="p-3 font-medium">
                    <Link href={`/invoices/${inv.id}`} className="block text-accent hover:underline">
                      {inv.invoice_date ?? '—'}
                    </Link>
                  </td>
                  <td className="p-3">{rel(inv.suppliers)}</td>
                  <td className="p-3 text-muted-foreground">{inv.invoice_number ?? '—'}</td>
                  <td className="p-3">{rel(inv.locations)}</td>
                  <td className="p-3 text-muted-foreground">{t(`categories.${inv.category}`)}</td>
                  <td className="p-3 text-right font-medium tabular-nums">
                    {inv.total != null ? Number(inv.total).toFixed(2) : '—'}
                  </td>
                  <td className="p-3">
                    <StatusChip
                      kind={inv.review_status as StatusKind}
                      label={t(`invoices.${inv.review_status}`)}
                    />
                  </td>
                  <td className="p-3">
                    <StatusChip
                      kind={inv.payment_status as StatusKind}
                      label={t(`invoices.${inv.payment_status}`)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
