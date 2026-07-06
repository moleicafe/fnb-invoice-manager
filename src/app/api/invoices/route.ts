import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { computeDueDate, hasArithmeticWarning } from '@/lib/invoice/checks';
import { saveInvoiceSchema } from '@/lib/invoice/save-schema';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = saveInvoiceSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  const b = parsed.data;

  // Resolve or create the supplier
  let supplierId = b.supplierId;
  let termsDays = 0;
  if (supplierId) {
    const { data: supplier } = await supabase
      .from('suppliers').select('payment_terms_days').eq('id', supplierId).single();
    if (!supplier) return NextResponse.json({ error: 'supplier_not_found' }, { status: 400 });
    termsDays = supplier.payment_terms_days;
  } else {
    const { data: created, error } = await supabase
      .from('suppliers')
      .insert({ name: b.supplierName, default_category: b.category })
      .select('id, payment_terms_days')
      .single();
    if (error || !created) return NextResponse.json({ error: 'supplier_create_failed' }, { status: 500 });
    supplierId = created.id;
    termsDays = created.payment_terms_days;
  }

  // Duplicate gate (server-side, authoritative)
  if (b.invoiceNumber && !b.confirmedDuplicate) {
    const { data: dupes } = await supabase
      .from('invoices').select('id, invoice_date, total')
      .eq('supplier_id', supplierId).eq('invoice_number', b.invoiceNumber);
    if (dupes && dupes.length > 0) {
      return NextResponse.json({ error: 'duplicate', duplicates: dupes }, { status: 409 });
    }
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      supplier_id: supplierId,
      location_id: b.locationId,
      invoice_number: b.invoiceNumber,
      invoice_date: b.invoiceDate,
      subtotal: b.subtotal,
      gst_amount: b.gstAmount,
      total: b.total,
      category: b.category,
      payment_due_date: b.invoiceDate ? computeDueDate(b.invoiceDate, termsDays) : null,
      arithmetic_warning: hasArithmeticWarning(b.subtotal, b.gstAmount, b.total),
      file_paths: b.filePaths,
      uploaded_by: user.id,
      extraction_raw: b.extractionRaw ?? null,
    })
    .select('id')
    .single();
  if (invoiceError || !invoice) return NextResponse.json({ error: 'insert_failed' }, { status: 500 });

  if (b.items.length > 0) {
    const { error: itemsError } = await supabase.from('invoice_items').insert(
      b.items.map((it, i) => ({
        invoice_id: invoice.id,
        line_no: i + 1,
        description: it.description,
        quantity: it.quantity,
        unit: it.unit,
        unit_price: it.unitPrice,
        amount: it.amount,
        name_en: it.nameEn,
        name_zh: it.nameZh,
      })),
    );
    if (itemsError) return NextResponse.json({ error: 'items_insert_failed' }, { status: 500 });
  }

  return NextResponse.json({ id: invoice.id });
}
