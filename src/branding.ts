// White-label configuration — the one file a customer deployment edits.
export const BRANDING = {
  // Per-locale shape so other customers can localize; Ming Yuan uses the
  // English name in both languages (裕华园 is an outlet, not the company).
  appName: { en: 'Ming Yuan F&B', 'zh-CN': 'Ming Yuan F&B' } as Record<string, string>,
  logoGlyph: 'MY', // 1–2 chars shown in the gradient logo tile
  logoUrl: null as string | null, // optional /public path; overrides logoGlyph
  accent: '#0052ff',
  accentSecondary: '#4d7cff',
};

export function brandName(locale: string): string {
  return BRANDING.appName[locale] ?? BRANDING.appName.en;
}
