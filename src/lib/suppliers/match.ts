export interface SupplierRecord {
  id: string;
  name: string;
  aliases: string[];
}

const LEGAL_SUFFIXES = new Set(['pte', 'ltd', 'llp', 'inc', 'private', 'limited', 'co']);

export function normalizeSupplierName(name: string): string {
  const tokens = name
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  while (tokens.length > 1 && LEGAL_SUFFIXES.has(tokens[tokens.length - 1])) tokens.pop();
  return tokens.join(' ');
}

export function diceCoefficient(a: string, b: string): number {
  if (a === b) return a.length > 0 ? 1 : 0;
  if (a.length < 2 || b.length < 2) return 0;
  const bigrams = (s: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      m.set(g, (m.get(g) ?? 0) + 1);
    }
    return m;
  };
  const A = bigrams(a);
  const B = bigrams(b);
  let overlap = 0;
  for (const [g, c] of A) overlap += Math.min(c, B.get(g) ?? 0);
  return (2 * overlap) / (a.length - 1 + (b.length - 1));
}

export function matchSupplier<T extends SupplierRecord>(
  extractedName: string,
  suppliers: T[],
  threshold = 0.75,
): T | null {
  const target = normalizeSupplierName(extractedName);
  if (!target) return null;
  let best: { supplier: T; score: number } | null = null;
  for (const supplier of suppliers) {
    for (const candidate of [supplier.name, ...supplier.aliases]) {
      const normalized = normalizeSupplierName(candidate);
      if (normalized === target) return supplier;
      const score = diceCoefficient(normalized, target);
      if (!best || score > best.score) best = { supplier, score };
    }
  }
  return best && best.score >= threshold ? best.supplier : null;
}
