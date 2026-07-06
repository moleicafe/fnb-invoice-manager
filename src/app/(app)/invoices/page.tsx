import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';

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
  const select = 'rounded border p-2 text-sm';

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">{t('invoices.title')}</h1>

      <form method="GET" className="flex flex-wrap items-end gap-2 text-sm">
        <label className="flex flex-col gap-1">
          {t('invoices.status')}
          <select name="status" defaultValue={sp.status ?? ''} className={select}>
            <option value="">{t('invoices.all')}</option>
            <option value="pending_review">{t('invoices.pending_review')}</option>
            <option value="approved">{t('invoices.approved')}</option>
            <option value="needs_manual_entry">{t('invoices.needs_manual_entry')}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          {t('invoices.paymentStatus')}
          <select name="payment" defaultValue={sp.payment ?? ''} className={select}>
            <option value="">{t('invoices.all')}</option>
            <option value="unpaid">{t('invoices.unpaid')}</option>
            <option value="paid">{t('invoices.paid')}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          {t('invoices.location')}
          <select name="location" defaultValue={sp.location ?? ''} className={select}>
            <option value="">{t('invoices.all')}</option>
            {(locations ?? []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          {t('invoices.from')}
          <input type="date" name="from" defaultValue={sp.from ?? ''} className={select} />
        </label>
        <label className="flex flex-col gap-1">
          {t('invoices.to')}
          <input type="date" name="to" defaultValue={sp.to ?? ''} className={select} />
        </label>
        <button type="submit" className="rounded bg-blue-600 px-3 py-2 text-white">{t('invoices.apply')}</button>
        <Link href="/invoices" className="px-2 py-2 underline">{t('invoices.clear')}</Link>
      </form>

      {(invoices ?? []).length === 0 ? (
        <p className="text-sm text-gray-500">{t('invoices.empty')}</p>
      ) : (
        <div className="overflow-x-auto rounded border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-gray-500">
                <th className="p-2">{t('invoices.date')}</th>
                <th className="p-2">{t('review.supplier')}</th>
                <th className="p-2">{t('invoices.number')}</th>
                <th className="p-2">{t('invoices.location')}</th>
                <th className="p-2">{t('review.category')}</th>
                <th className="p-2 text-right">{t('invoices.total')}</th>
                <th className="p-2">{t('invoices.status')}</th>
                <th className="p-2">{t('invoices.paymentStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {(invoices ?? []).map((inv) => (
                <tr key={inv.id} className="border-b hover:bg-gray-50">
                  <td className="p-2">
                    <Link href={`/invoices/${inv.id}`} className="block">{inv.invoice_date ?? '—'}</Link>
                  </td>
                  <td className="p-2">{rel(inv.suppliers)}</td>
                  <td className="p-2">{inv.invoice_number ?? '—'}</td>
                  <td className="p-2">{rel(inv.locations)}</td>
                  <td className="p-2">{t(`categories.${inv.category}`)}</td>
                  <td className="p-2 text-right">{inv.total != null ? Number(inv.total).toFixed(2) : '—'}</td>
                  <td className="p-2">{t(`invoices.${inv.review_status}`)}</td>
                  <td className="p-2">{t(`invoices.${inv.payment_status}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
