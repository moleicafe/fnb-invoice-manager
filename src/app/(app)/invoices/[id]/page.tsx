import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { StatusChip, type StatusKind } from '@/components/ui/badge';
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
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground">
          {t('detail.original')}
        </h2>
        {(signed ?? []).map((f, i) => {
          const isPdf = (invoice.file_paths[i] as string).toLowerCase().endsWith('.pdf');
          return isPdf ? (
            <iframe
              key={i}
              src={f.signedUrl ?? undefined}
              className="h-[70vh] w-full rounded-2xl border border-border bg-card shadow-lg"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={f.signedUrl ?? undefined}
              alt=""
              className="w-full rounded-2xl border border-border shadow-lg"
            />
          );
        })}
      </section>

      <section className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl tracking-tight sm:text-3xl">
              {rel(invoice.suppliers)}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
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

        <Card className="p-6">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
            <dt className="text-muted-foreground">{t('review.category')}</dt>
            <dd className="font-medium">{t(`categories.${invoice.category}`)}</dd>
            <dt className="text-muted-foreground">{t('invoices.status')}</dt>
            <dd>
              <StatusChip
                kind={invoice.review_status as StatusKind}
                label={t(`invoices.${invoice.review_status}`)}
              />
            </dd>
            <dt className="text-muted-foreground">{t('invoices.paymentStatus')}</dt>
            <dd>
              <StatusChip
                kind={invoice.payment_status as StatusKind}
                label={t(`invoices.${invoice.payment_status}`)}
              />
            </dd>
            <dt className="text-muted-foreground">{t('detail.dueDate')}</dt>
            <dd className="font-medium tabular-nums">{invoice.payment_due_date ?? '—'}</dd>
            <dt className="text-muted-foreground">
              {t('review.subtotal')} / {t('review.gst')} / {t('review.total')}
            </dt>
            <dd className="font-medium tabular-nums">
              {money(invoice.subtotal)} / {money(invoice.gst_amount)} /{' '}
              <span className="gradient-text font-semibold">{money(invoice.total)}</span>
            </dd>
          </dl>
        </Card>

        {invoice.arithmetic_warning && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {t('review.arithmeticWarning')}
          </p>
        )}

        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-md">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                <th className="p-3 font-medium">{t('review.description')}</th>
                <th className="p-3 text-right font-medium">{t('review.quantity')}</th>
                <th className="p-3 font-medium">{t('review.unit')}</th>
                <th className="p-3 text-right font-medium">{t('review.unitPrice')}</th>
                <th className="p-3 text-right font-medium">{t('review.amount')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it: Record<string, unknown>) => (
                <tr key={String(it.id)} className="border-b border-border/60 last:border-0">
                  <td className="p-3">{String(it.description)}</td>
                  <td className="p-3 text-right tabular-nums">
                    {it.quantity == null ? '—' : String(it.quantity)}
                  </td>
                  <td className="p-3 text-muted-foreground">{it.unit == null ? '—' : String(it.unit)}</td>
                  <td className="p-3 text-right tabular-nums">{money(it.unit_price)}</td>
                  <td className="p-3 text-right font-medium tabular-nums">{money(it.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
