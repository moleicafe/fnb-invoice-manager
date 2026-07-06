import type { SupabaseClient } from '@supabase/supabase-js';
import { type InvoiceRow, type ItemRow, monthKey, monthlyTotals, totalsBy, itemStats, counters } from './aggregate';

function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

function lastMonths(month: string, n: number): string[] {
  const [y, m] = month.split('-').map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

function prevMonth(month: string): string {
  return lastMonths(month, 2)[0];
}

export async function fetchDashboardData(supabase: SupabaseClient, month: string) {
  const months = lastMonths(month, 6);
  const { from: rangeFrom } = monthRange(months[0]);
  const { to: rangeTo } = monthRange(month);
  const sel = monthRange(month);
  const prev = monthRange(prevMonth(month));

  const [invRes, curItemsRes, prevItemsRes, openRes] = await Promise.all([
    supabase.from('invoices')
      .select('invoice_date, total, category, payment_status, review_status, payment_due_date, suppliers(name)')
      .gte('invoice_date', rangeFrom).lte('invoice_date', rangeTo).limit(5000),
    supabase.from('invoice_items')
      .select('name_en, description, quantity, unit, unit_price, amount, invoices!inner(invoice_date)')
      .gte('invoices.invoice_date', sel.from).lte('invoices.invoice_date', sel.to).limit(10000),
    supabase.from('invoice_items')
      .select('name_en, description, quantity, unit, unit_price, amount, invoices!inner(invoice_date)')
      .gte('invoices.invoice_date', prev.from).lte('invoices.invoice_date', prev.to).limit(10000),
    supabase.from('invoices')
      .select('invoice_date, total, category, payment_status, review_status, payment_due_date, suppliers(name)')
      .or('payment_status.eq.unpaid,review_status.eq.pending_review').limit(5000),
  ]);

  const toInvoiceRow = (r: Record<string, unknown>): InvoiceRow => ({
    invoice_date: r.invoice_date as string | null,
    total: r.total == null ? null : Number(r.total),
    category: String(r.category),
    supplier_name: (r.suppliers as { name: string } | null)?.name ?? '—',
    payment_status: String(r.payment_status),
    review_status: String(r.review_status),
    payment_due_date: (r.payment_due_date as string | null) ?? null,
  });
  const toItemRow = (r: Record<string, unknown>): ItemRow => ({
    name_en: (r.name_en as string | null) ?? null,
    description: String(r.description),
    quantity: r.quantity == null ? null : Number(r.quantity),
    unit: (r.unit as string | null) ?? null,
    unit_price: r.unit_price == null ? null : Number(r.unit_price),
    amount: r.amount == null ? null : Number(r.amount),
    invoice_date: ((r.invoices as { invoice_date: string | null } | null)?.invoice_date) ?? null,
  });

  const all = (invRes.data ?? []).map(toInvoiceRow);
  const inMonth = all.filter((r) => r.invoice_date != null && monthKey(r.invoice_date) === month);
  const open = (openRes.data ?? []).map(toInvoiceRow);
  const todayIso = new Date().toISOString().slice(0, 10);

  return {
    month,
    months,
    monthly: monthlyTotals(all, months),
    categories: totalsBy(inMonth, 'category'),
    suppliers: totalsBy(inMonth, 'supplier_name').slice(0, 8),
    items: itemStats((curItemsRes.data ?? []).map(toItemRow), (prevItemsRes.data ?? []).map(toItemRow)).slice(0, 10),
    counters: counters(open, todayIso),
  };
}
export type DashboardData = Awaited<ReturnType<typeof fetchDashboardData>>;
