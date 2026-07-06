export function isValidIsoDate(s: string): boolean {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function computeDueDate(invoiceDate: string, termsDays: number): string {
  if (!isValidIsoDate(invoiceDate)) {
    throw new Error(`invalid invoice date: ${invoiceDate}`);
  }
  const d = new Date(`${invoiceDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + termsDays);
  return d.toISOString().slice(0, 10);
}

export function hasArithmeticWarning(
  subtotal: number | null,
  gst: number | null,
  total: number | null,
  toleranceDollars = 0.05,
): boolean {
  if (subtotal == null || total == null) return false;
  const expected = subtotal + (gst ?? 0);
  return Math.abs(expected - total) > toleranceDollars + 1e-9;
}
