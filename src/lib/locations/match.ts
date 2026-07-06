export interface LocationRecord {
  id: string;
  name: string;
  aliases: string[];
}

// Match an AI-extracted outlet hint (branch code, Chinese name, address line)
// against outlet names + aliases. Substring match both directions so "wld"
// hits inside "MY-WLDBAO" and "兀兰" hits inside "兀兰地铁站".
export function matchLocation<T extends LocationRecord>(
  hint: string | null,
  locations: T[],
): T | null {
  if (!hint) return null;
  const h = hint.normalize('NFKC').toLowerCase().trim();
  if (!h) return null;
  for (const location of locations) {
    const candidates = [
      ...location.name.normalize('NFKC').toLowerCase().split(/\s+/),
      ...location.aliases.map((a) => a.normalize('NFKC').toLowerCase().trim()),
    ];
    for (const c of candidates) {
      if (c.length < 2) continue;
      if (h.includes(c) || c.includes(h)) return location;
    }
  }
  return null;
}
