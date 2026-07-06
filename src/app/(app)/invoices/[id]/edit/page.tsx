import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ReviewForm, EMPTY_ITEM, type ReviewFormValues } from '@/components/ReviewForm';
import { canEditInvoice, type Role } from '@/lib/auth/permissions';
import type { Category } from '@/lib/categories';

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: invoice }, { data: locations }] = await Promise.all([
    supabase.from('invoices')
      .select('*, suppliers(id, name), invoice_items(*)')
      .eq('id', id).single(),
    supabase.from('locations').select('id, name').eq('active', true).order('name'),
  ]);
  if (!invoice) notFound();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('user_id', user!.id).single();
  if (!canEditInvoice((profile?.role ?? 'staff') as Role, invoice.uploaded_by, user!.id, invoice.review_status)) {
    notFound();
  }

  const s = (n: unknown) => (n == null ? '' : String(n));
  const supplier = invoice.suppliers as { id: string; name: string } | null;
  const items = [...(invoice.invoice_items ?? [])]
    .sort((a: { line_no: number }, b: { line_no: number }) => a.line_no - b.line_no)
    .map((it: Record<string, unknown>) => ({
      description: String(it.description), quantity: s(it.quantity), unit: it.unit ? String(it.unit) : '',
      unitPrice: s(it.unit_price), amount: s(it.amount),
      nameEn: (it.name_en as string | null) ?? null,
      nameZh: (it.name_zh as string | null) ?? null,
    }));

  const initial: ReviewFormValues = {
    locationId: invoice.location_id,
    supplierId: supplier?.id ?? null,
    supplierName: supplier?.name ?? '',
    invoiceNumber: invoice.invoice_number ?? '',
    invoiceDate: invoice.invoice_date ?? '',
    category: invoice.category as Category,
    subtotal: s(invoice.subtotal), gst: s(invoice.gst_amount), total: s(invoice.total),
    items: items.length ? items : [EMPTY_ITEM],
    extractionRaw: null,
  };

  return (
    <ReviewForm
      initial={initial}
      locations={locations ?? []}
      filePaths={invoice.file_paths ?? []}
      duplicates={[]}
      newSupplier={false}
      submitUrl={`/api/invoices/${id}`}
      method="PATCH"
    />
  );
}
