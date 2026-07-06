import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { extractDocument, type DocumentFile } from '@/lib/extraction/extract';
import { matchSupplier } from '@/lib/suppliers/match';
import { matchLocation } from '@/lib/locations/match';

export const maxDuration = 60; // Vercel: extraction can take ~30s on multi-page documents

const MEDIA: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

function mediaTypeFor(p: string): string | null {
  const dot = p.lastIndexOf('.');
  return dot === -1 ? null : (MEDIA[p.slice(dot).toLowerCase()] ?? null);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await request.json()) as { paths?: unknown };
  const paths = body.paths;
  if (!Array.isArray(paths) || paths.length === 0 || paths.length > 5 ||
      !paths.every((p) => typeof p === 'string' && mediaTypeFor(p))) {
    return NextResponse.json({ error: 'invalid_paths' }, { status: 400 });
  }

  const files: DocumentFile[] = [];
  for (const p of paths as string[]) {
    const { data, error } = await supabase.storage.from('invoices').download(p);
    if (error || !data) return NextResponse.json({ error: 'download_failed' }, { status: 400 });
    files.push({ data: Buffer.from(await data.arrayBuffer()), mediaType: mediaTypeFor(p)! });
  }

  let extraction;
  try {
    extraction = await extractDocument(files);
  } catch (e) {
    console.error('extraction failed', e);
    return NextResponse.json({ error: 'extraction_failed' }, { status: 502 });
  }

  const [{ data: suppliers }, { data: locations }] = await Promise.all([
    supabase
      .from('suppliers')
      .select('id, name, aliases, default_category, payment_terms_days')
      .eq('active', true),
    supabase.from('locations').select('id, name, aliases').eq('active', true),
  ]);

  const matchedSupplier = extraction.supplier_name
    ? matchSupplier(extraction.supplier_name, suppliers ?? [])
    : null;

  const matchedLocationId = matchLocation(extraction.outlet, locations ?? [])?.id ?? null;

  let duplicates: { id: string; invoice_date: string | null; total: number | null }[] = [];
  if (matchedSupplier && extraction.invoice_number) {
    const { data: dupes } = await supabase
      .from('invoices')
      .select('id, invoice_date, total')
      .eq('supplier_id', matchedSupplier.id)
      .eq('invoice_number', extraction.invoice_number);
    duplicates = dupes ?? [];
  }

  return NextResponse.json({ extraction, matchedSupplier, matchedLocationId, duplicates });
}
