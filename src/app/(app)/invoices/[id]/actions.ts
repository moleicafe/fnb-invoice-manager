'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('unauthorized');
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('user_id', user.id).single();
  if (profile?.role !== 'admin') throw new Error('forbidden');
  return { supabase, user };
}

export async function approveInvoice(id: string) {
  const { supabase, user } = await requireAdmin();
  await supabase.from('invoices')
    .update({ review_status: 'approved', approved_by: user.id })
    .eq('id', id);
  revalidatePath(`/invoices/${id}`);
}

export async function markInvoicePaid(id: string) {
  const { supabase } = await requireAdmin();
  await supabase.from('invoices')
    .update({ payment_status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', id);
  revalidatePath(`/invoices/${id}`);
}

export async function deleteInvoice(id: string) {
  const { supabase } = await requireAdmin();
  const { data: invoice } = await supabase
    .from('invoices').select('file_paths').eq('id', id).single();
  if (invoice?.file_paths?.length) {
    await supabase.storage.from('invoices').remove(invoice.file_paths);
  }
  await supabase.from('invoices').delete().eq('id', id);
  redirect('/invoices');
}
