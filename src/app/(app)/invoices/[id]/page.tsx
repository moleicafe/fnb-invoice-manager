import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { Actions } from './ActionsPanel';

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations();
  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, suppliers(name), locations(name), invoice_items(*)')
    .eq('id', id)
    .single();
  if (!invoice) notFound();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('user_id', user!.id).single();

  const { data: signed } = await supabase.storage
    .from('invoices')
    .createSignedUrls(invoice.file_paths ?? [], 3600);

  const items = [...(invoice.invoice_items ?? [])].sort(
    (a: { line_no: number }, b: { line_no: number }) => a.line_no - b.line_no,
  );
  const rel = (v: unknown) => (v as { name: string } | null)?.name ?? '—';
  const money = (v: unknown) => (v == null ? '—' : Number(v).toFixed(2));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-gray-500">{t('detail.original')}</h2>
        {(signed ?? []).map((f, i) => {
          const isPdf = (invoice.file_paths[i] as string).toLowerCase().endsWith('.pdf');
          return isPdf ? (
            <iframe key={i} src={f.signedUrl ?? undefined} className="h-[70vh] w-full rounded border" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={f.signedUrl ?? undefined} alt="" className="w-full rounded border" />
          );
        })}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold">{rel(invoice.suppliers)}</h1>
            <p className="text-sm text-gray-500">
              {invoice.invoice_number ?? '—'} · {invoice.invoice_date ?? '—'} · {rel(invoice.locations)}
            </p>
          </div>
          <Actions
            id={invoice.id}
            role={(profile?.role ?? 'staff') as 'admin' | 'staff'}
            userId={user!.id}
            uploadedBy={invoice.uploaded_by}
            reviewStatus={invoice.review_status}
            paymentStatus={invoice.payment_status}
          />
        </div>

        <dl className="grid grid-cols-2 gap-2 rounded border bg-white p-3 text-sm">
          <dt className="text-gray-500">{t('review.category')}</dt>
          <dd>{t(`categories.${invoice.category}`)}</dd>
          <dt className="text-gray-500">{t('invoices.status')}</dt>
          <dd>{t(`invoices.${invoice.review_status}`)}</dd>
          <dt className="text-gray-500">{t('invoices.paymentStatus')}</dt>
          <dd>{t(`invoices.${invoice.payment_status}`)}</dd>
          <dt className="text-gray-500">{t('detail.dueDate')}</dt>
          <dd>{invoice.payment_due_date ?? '—'}</dd>
          <dt className="text-gray-500">{t('review.subtotal')} / {t('review.gst')} / {t('review.total')}</dt>
          <dd>{money(invoice.subtotal)} / {money(invoice.gst_amount)} / {money(invoice.total)}</dd>
        </dl>

        {invoice.arithmetic_warning && (
          <p className="rounded bg-amber-100 p-2 text-sm">{t('review.arithmeticWarning')}</p>
        )}

        <table className="w-full rounded border bg-white text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-gray-500">
              <th className="p-2">{t('review.description')}</th>
              <th className="p-2 text-right">{t('review.quantity')}</th>
              <th className="p-2">{t('review.unit')}</th>
              <th className="p-2 text-right">{t('review.unitPrice')}</th>
              <th className="p-2 text-right">{t('review.amount')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it: Record<string, unknown>) => (
              <tr key={String(it.id)} className="border-b">
                <td className="p-2">{String(it.description)}</td>
                <td className="p-2 text-right">{it.quantity == null ? '—' : String(it.quantity)}</td>
                <td className="p-2">{it.unit == null ? '—' : String(it.unit)}</td>
                <td className="p-2 text-right">{money(it.unit_price)}</td>
                <td className="p-2 text-right">{money(it.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
