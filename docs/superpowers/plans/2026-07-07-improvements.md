# Batch 2 Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Batch upload wizard, bilingual standardized item names, extraction spinner, config-based white-labelling (Ming Yuan F&B), cursor fix, outlet data correction, and an admin analysis dashboard with cached AI insights.

**Architecture:** Extends the deployed v1 app (Next.js 16 + Supabase + Anthropic). One new migration (003), one new admin route (`/dashboard`), one new API route (`/api/insights`), a branding config consumed by shell/login/theme, and a reworked upload flow. All existing invariants hold: verbatim descriptions untouched, human-verify-before-save, i18n key parity, RLS as the enforcement layer.

**Tech Stack additions:** `recharts` (client-side charts). Nothing else.

**Spec:** `docs/superpowers/specs/2026-07-07-improvements-design.md` (+ v1 spec for the invariants).

## Global Constraints

- Extraction model stays `claude-opus-4-8` exactly; insights use the same model. API keys server-only.
- All UI strings via `messages/en.json` + `messages/zh-CN.json` (identical key sets — parity test); **exception:** the app/brand name moves OUT of messages into `src/branding.ts`.
- Verbatim `invoice_items.description` is never modified; `name_en`/`name_zh` are additive.
- Batch = max 10 files per upload; pages-mode = max 5 files (existing `/api/extract` cap).
- Dashboard and insights are admin-only: nav link hidden for staff AND server-side role check (404 for staff).
- `src/lib/**` uses relative imports only; components may use `@/`.
- Commit after every task, imperative mood, trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- `npm test` and `npm run build` must pass at the end of every task.

## File Structure (new/modified)

```
src/branding.ts                         NEW  white-label config
supabase/migrations/003_batch2.sql      NEW  name_en/zh, insight_reports, outlet reseed
src/components/ui/spinner.tsx           NEW  accent spinner
src/lib/analytics/aggregate.ts          NEW  pure aggregation fns (TDD)
src/lib/analytics/fetch.ts              NEW  dashboard data fetch (server)
src/lib/insights/prompt.ts              NEW  insights prompt builder (pure)
src/components/SimpleMarkdown.tsx       NEW  minimal md renderer (##, -, p)
src/components/charts/*.tsx             NEW  recharts client components (3)
src/app/(app)/dashboard/page.tsx        NEW  admin dashboard
src/app/(app)/dashboard/InsightsPanel.tsx NEW client panel
src/app/api/insights/route.ts           NEW  generate/cache insights
src/app/globals.css                     MOD  cursor rule
src/app/layout.tsx                      MOD  branding title + accent CSS overrides
src/app/(app)/layout.tsx                MOD  branding name/logo, admin-only dashboard link
src/app/login/page.tsx                  MOD  branding name
src/app/(app)/upload/UploadFlow.tsx     MOD  batch wizard + spinner
src/components/ReviewForm.tsx           MOD  optional onSaved prop
src/lib/extraction/schema.ts            MOD  name_en/name_zh per line
src/lib/extraction/extract.ts           MOD  prompt addition
src/lib/invoice/save-schema.ts          MOD  nameEn/nameZh
src/app/api/invoices/route.ts           MOD  persist names
src/app/api/invoices/[id]/route.ts      MOD  persist names
src/app/(app)/invoices/[id]/page.tsx    MOD  show localized standardized name
messages/{en,zh-CN}.json                MOD  remove common.appName; add upload/dashboard/nav keys
tests/extraction-schema.test.ts         MOD  name fields
tests/analytics-aggregate.test.ts       NEW  TDD
```

---

### Task 1: Cursor fix + Spinner component

**Files:**
- Modify: `src/app/globals.css`
- Create: `src/components/ui/spinner.tsx`
- Modify: `src/app/(app)/upload/UploadFlow.tsx` (extracting-state block only)

**Interfaces:**
- Consumes: existing `animate-spin` (Tailwind built-in), design tokens
- Produces: `<Spinner className?>` — accent-colored spinning arc, `aria-hidden`

- [ ] **Step 1: Append to `src/app/globals.css`** (after the `body` block):

```css
/* Tailwind v4 preflight sets cursor:default on buttons; restore the web norm */
button:not(:disabled) {
  cursor: pointer;
}
```

- [ ] **Step 2: Create `src/components/ui/spinner.tsx`**

```tsx
export function Spinner({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin text-accent ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M12 2a10 10 0 0 1 10 10h-4a6 6 0 0 0-6-6V2z"
      />
    </svg>
  );
}
```

- [ ] **Step 3: Use it in `UploadFlow.tsx`** — in the non-`pick` branch, replace the pulsing-dot `<span className="relative flex h-3 w-3">…</span>` block with:

```tsx
<Spinner className="h-8 w-8" />
```

and add `import { Spinner } from '@/components/ui/spinner';` at the top. Keep the mono status label below it unchanged.

- [ ] **Step 4: Verify** — `npm test` (all pass) and `npm run build` (exit 0). Manual: hover the language switcher → pointer cursor.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/components/ui/spinner.tsx "src/app/(app)/upload/UploadFlow.tsx"
git commit -m "Restore button pointer cursor and add extraction spinner"
```

---

### Task 2: White-label branding config

**Files:**
- Create: `src/branding.ts`
- Modify: `src/app/layout.tsx`, `src/app/(app)/layout.tsx`, `src/app/login/page.tsx`, `messages/en.json`, `messages/zh-CN.json`

**Interfaces:**
- Produces: `BRANDING` const and `brandName(locale: string): string` — consumed by layouts/login and later tasks. `common.appName` is REMOVED from both message files (parity preserved by removing from both).

- [ ] **Step 1: Create `src/branding.ts`**

```ts
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
```

- [ ] **Step 2: Root layout** — in `src/app/layout.tsx`: add

```ts
import { BRANDING } from '@/branding';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: BRANDING.appName.en };
```

and change `<body className="min-h-screen">` to inject the brand accent as CSS-variable overrides (re-skins every gradient/button/chip):

```tsx
<body
  className="min-h-screen"
  style={{
    ['--color-accent' as string]: BRANDING.accent,
    ['--color-accent-secondary' as string]: BRANDING.accentSecondary,
  }}
>
```

- [ ] **Step 3: App shell** — in `src/app/(app)/layout.tsx`: import `{ BRANDING, brandName }` and `getLocale` from `next-intl/server`; read `const locale = await getLocale();`. Replace the logo tile contents `发` with:

```tsx
{BRANDING.logoUrl ? (
  // eslint-disable-next-line @next/next/no-img-element
  <img src={BRANDING.logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />
) : (
  BRANDING.logoGlyph
)}
```

(keep the surrounding gradient `<span>`; when `logoUrl` is set render the `<img>` INSTEAD of the gradient span — wrap in a ternary at the span level) and replace `{t('common.appName')}` with `{brandName(locale)}`.

Simplest correct span-level ternary:

```tsx
{BRANDING.logoUrl ? (
  // eslint-disable-next-line @next/next/no-img-element
  <img src={BRANDING.logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover shadow-accent" />
) : (
  <span className="gradient-accent flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-accent-foreground shadow-accent">
    {BRANDING.logoGlyph}
  </span>
)}
```

- [ ] **Step 4: Login page** — replace the `tCommon('appName')` headline source with branding: drop `const tCommon = useTranslations('common');`, add `import { brandName } from '@/branding';` and `import { useLocale } from 'next-intl';`, then `const appName = brandName(useLocale());` (keep the existing gradient-last-word logic operating on `appName`).

- [ ] **Step 5: Remove `common.appName`** from BOTH `messages/en.json` and `messages/zh-CN.json`. Run `npm test` — the parity test must still pass (both removed) and no other test may reference the key.

- [ ] **Step 6: Verify** — `npm run build` exit 0; grep confirms no remaining `common.appName` usage: `grep -rn "appName" src messages` shows only `branding.ts` + layout/login imports.

- [ ] **Step 7: Commit**

```bash
git add src/branding.ts src/app/layout.tsx "src/app/(app)/layout.tsx" src/app/login/page.tsx messages
git commit -m "Add config-based white-label branding (Ming Yuan F&B)"
```

---

### Task 3: Migration 003 + bilingual item names end-to-end

**Files:**
- Create: `supabase/migrations/003_batch2.sql`
- Modify: `src/lib/extraction/schema.ts`, `src/lib/extraction/extract.ts`, `src/lib/invoice/save-schema.ts`, `src/app/api/invoices/route.ts`, `src/app/api/invoices/[id]/route.ts`, `src/components/ReviewForm.tsx` (submit payload only), `src/app/(app)/upload/UploadFlow.tsx` (initial-values mapping only), `src/app/(app)/invoices/[id]/page.tsx` (display)
- Test: `tests/extraction-schema.test.ts` (extend)

**Interfaces:**
- Produces: `lineItemSchema` gains `name_en: string|null`, `name_zh: string|null`; `saveInvoiceSchema` items gain `nameEn`/`nameZh` (nullable, default null via `.nullable().default(null)` is NOT used — keep plain `.nullable()` and always send them); `invoice_items` DB columns `name_en`,`name_zh`; `insight_reports` table (used by Task 7); locations reseeded.
- **NOTE:** the controller applies the migration to the live database via the Supabase MCP tool — the implementer only creates the file.

- [ ] **Step 1: Create `supabase/migrations/003_batch2.sql`**

```sql
-- Bilingual standardized item names (verbatim description stays untouched)
alter table invoice_items add column name_en text, add column name_zh text;

-- Cached monthly AI insight reports (admin-only)
create table insight_reports (
  id uuid primary key default gen_random_uuid(),
  period_month date not null unique,
  content_md text not null,
  model text not null,
  created_at timestamptz not null default now()
);
alter table insight_reports enable row level security;
create policy "admin all" on insight_reports for all to authenticated
  using (is_admin()) with check (is_admin());

-- Outlet correction: the real outlets are exactly these two
update locations set active = false;
insert into locations (name, type) values
  ('Woodlands 兀兰', 'outlet'),
  ('Chinese Garden 裕华园', 'outlet');
```

- [ ] **Step 2 (TDD): extend `tests/extraction-schema.test.ts`** — in the `valid` fixture's line item add `name_en: 'Organic Cauliflower (defective)', name_zh: '有机菜花（次品）'`, and add tests:

```ts
it('accepts null standardized names', () => {
  const sparseNames = {
    ...valid,
    line_items: [{ ...valid.line_items[0], name_en: null, name_zh: null }],
  };
  expect(invoiceExtractionSchema.parse(sparseNames).line_items[0].name_en).toBeNull();
});
it('rejects a line item missing the name fields', () => {
  const { name_en: _en, name_zh: _zh, ...noNames } = valid.line_items[0];
  expect(invoiceExtractionSchema.safeParse({ ...valid, line_items: [noNames] }).success).toBe(false);
});
```

Run: `npm test` → FAIL (fixture now has unknown keys is fine for zod objects? No — zod strips unknown keys by default, so the FIRST failing signal is the new tests: missing-fields test fails because schema currently accepts items without names, and the parse-equality assertion in the existing 'accepts a complete invoice extraction' test fails because parse() strips `name_en`/`name_zh`). Expected: at least 2 failures.

- [ ] **Step 3: Update `src/lib/extraction/schema.ts`** — add to `lineItemSchema`:

```ts
  name_en: z.string().nullable(),
  name_zh: z.string().nullable(),
```

Run: `npm test` → PASS.

- [ ] **Step 4: Update the extraction prompt** in `src/lib/extraction/extract.ts` — inside `EXTRACTION_PROMPT`, after the verbatim-description bullet, add:

```
- name_en / name_zh: a concise standardized product name for the line item in
  BOTH English and Simplified Chinese (translate whichever is missing; strip
  item codes, sizes and pack counts). Example: "切有机菜花 (次品)" ->
  name_en "Organic Cauliflower (defective)", name_zh "有机菜花（次品）".
  Use null only when you cannot identify the product.
```

- [ ] **Step 5: Persist the names.**
  - `src/lib/invoice/save-schema.ts` — `itemSchema` gains `nameEn: z.string().nullable(), nameZh: z.string().nullable(),`
  - Both `src/app/api/invoices/route.ts` and `src/app/api/invoices/[id]/route.ts` — in the items insert mapping add `name_en: it.nameEn, name_zh: it.nameZh,`
  - `src/components/ReviewForm.tsx` — `ReviewItemValues` gains `nameEn: string | null; nameZh: string | null;`, `EMPTY_ITEM` gains `nameEn: null, nameZh: null`, and the submit mapping adds `nameEn: it.nameEn, nameZh: it.nameZh,` (they ride along invisibly; not editable in v1 per spec).
  - `src/app/(app)/upload/UploadFlow.tsx` — the `line_items` → items mapping adds `nameEn: li.name_en, nameZh: li.name_zh,` (and the `ExtractResponse` line-item type gains `name_en: string | null; name_zh: string | null;`). `blankValues()` items use `EMPTY_ITEM` already — no change.
  - Edit page `src/app/(app)/invoices/[id]/edit/page.tsx` — items mapping adds `nameEn: (it.name_en as string | null) ?? null, nameZh: (it.name_zh as string | null) ?? null,`

- [ ] **Step 6: Display on detail page** — `src/app/(app)/invoices/[id]/page.tsx`: import `getLocale` from `next-intl/server`, read `const locale = await getLocale();`, and in the items table description cell render the localized standardized name under the verbatim text when present:

```tsx
<td className="p-3">
  {String(it.description)}
  {(locale === 'en' ? it.name_en : it.name_zh) != null && (
    <span className="mt-0.5 block text-xs text-muted-foreground">
      {String(locale === 'en' ? it.name_en : it.name_zh)}
    </span>
  )}
</td>
```

- [ ] **Step 7: Verify** — `npm test` all green; `npm run build` exit 0.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/003_batch2.sql src/lib/extraction src/lib/invoice/save-schema.ts src/app/api/invoices src/components/ReviewForm.tsx "src/app/(app)/upload/UploadFlow.tsx" "src/app/(app)/invoices/[id]" tests/extraction-schema.test.ts
git commit -m "Add bilingual standardized item names end to end"
```

---

### Task 4: Batch upload wizard

**Files:**
- Modify: `src/components/ReviewForm.tsx` (add `onSaved` prop), `src/app/(app)/upload/UploadFlow.tsx` (rework), `messages/en.json`, `messages/zh-CN.json`

**Interfaces:**
- Consumes: `/api/extract` per file; `ReviewForm` (unchanged contract otherwise); `Spinner` (Task 1)
- Produces: `ReviewForm` prop `onSaved?: (id: string) => void` (default behavior unchanged: `router.push`)

- [ ] **Step 1: `ReviewForm` onSaved** — add `onSaved?: (id: string) => void;` to props; in `submit()` replace `router.push(\`/invoices/${id}\`);` with:

```ts
if (props.onSaved) {
  setBusy(false);
  props.onSaved(id as string);
} else {
  router.push(`/invoices/${id}`);
}
```

- [ ] **Step 2: Add i18n keys** to the `upload` namespace in BOTH message files:

en:
```json
"modeMultiple": "Each file is a separate invoice",
"modeSinglePages": "All files are pages of one invoice",
"progress": "Invoice {current} of {total}",
"skip": "Skip",
"batchDone": "{saved} of {total} invoices saved",
"uploadMore": "Upload more",
"viewInvoices": "View invoices"
```

zh-CN:
```json
"modeMultiple": "每个文件是一张独立发票",
"modeSinglePages": "所有文件是同一张发票的多页",
"progress": "第 {current} 张，共 {total} 张",
"skip": "跳过",
"batchDone": "已保存 {saved} / {total} 张发票",
"uploadMore": "继续上传",
"viewInvoices": "查看发票"
```

- [ ] **Step 3: Rework `UploadFlow.tsx`.** Keep `ExtractResponse`, `s()`, `blankValues()` (unchanged semantics). Replace the single-job state machine with a job queue. Complete component logic:

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { ReviewForm, EMPTY_ITEM, type ReviewFormValues } from '@/components/ReviewForm';
import { Spinner } from '@/components/ui/spinner';
import { buttonStyles } from '@/components/ui/button';

type Phase = 'pick' | 'working' | 'wizard' | 'done';
type Mode = 'batch' | 'pages';

interface Job {
  filePaths: string[];
  banner: 'failed' | 'wrongDocType' | null;
  initial: ReviewFormValues;
  duplicates: { id: string }[];
  newSupplier: boolean;
}

/* ExtractResponse + s() as before (with name_en/name_zh from Task 3) */

export function UploadFlow(props: { locations: { id: string; name: string }[]; defaultLocationId: string }) {
  const t = useTranslations('upload');
  const [mode, setMode] = useState<Mode>('batch');
  const [phase, setPhase] = useState<Phase>('pick');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [current, setCurrent] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [settled, setSettled] = useState(0);
  const [total, setTotal] = useState(0);
  const [pickError, setPickError] = useState(false);

  /* blankValues() as before */

  async function extractJob(paths: string[]): Promise<Job> {
    const res = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths }),
    });
    setSettled((n) => n + 1);
    if (!res.ok) {
      return { filePaths: paths, banner: 'failed', initial: blankValues(), duplicates: [], newSupplier: true };
    }
    const payload = (await res.json()) as ExtractResponse;
    const e = payload.extraction;
    return {
      filePaths: paths,
      banner: e.document_type !== 'invoice' ? 'wrongDocType' : null,
      initial: {
        /* same mapping as today (locationId, supplier, dates, money, items incl. nameEn/nameZh, extractionRaw) */
      },
      duplicates: payload.duplicates,
      newSupplier: !payload.matchedSupplier,
    };
  }

  async function onFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).slice(0, mode === 'batch' ? 10 : 5);
    setPickError(false);
    setPhase('working');
    setSettled(0);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const uploaded: string[] = [];
    for (const file of files) {
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase() || '.jpg';
      const path = `${user!.id}/${crypto.randomUUID()}${ext}`;
      const { error } = await supabase.storage.from('invoices').upload(path, file);
      if (error) {
        setPickError(true);
        setPhase('pick');
        return;
      }
      uploaded.push(path);
    }

    const groups = mode === 'pages' ? [uploaded] : uploaded.map((p) => [p]);
    setTotal(groups.length);
    const results = await Promise.all(groups.map((g) => extractJob(g)));
    setJobs(results);
    setCurrent(0);
    setSavedCount(0);
    setPhase('wizard');
  }

  function advance() {
    if (current + 1 < jobs.length) setCurrent(current + 1);
    else setPhase('done');
  }

  /* renders:
     - pick: mode radio group + dropzone (as today) + pickError banner
     - working: <Spinner className="h-8 w-8" /> + mono label `${t('extracting')} ${settled}/${total}`
     - wizard: progress line t('progress', {current: current+1, total: jobs.length}),
       Skip button (buttonStyles('ghost','md')) calling advance(),
       banner for jobs[current].banner (extractionFailed / wrongDocType),
       <ReviewForm key={current} {...jobs[current]-derived props}
         onSaved={() => { setSavedCount((n)=>n+1); advance(); }} />
     - done: card with t('batchDone', {saved: savedCount, total: jobs.length}),
       <Link className={buttonStyles('primary','lg')} href="/invoices">{t('viewInvoices')}</Link>
       + a reset button (t('uploadMore')) restoring phase 'pick'. */
}
```

Implementation notes (binding):
- The mode toggle renders in `pick` phase as two radio-styled buttons above the dropzone; selected = accent border/bg (`border-accent/40 bg-accent/5 text-accent`), unselected = `border-border text-muted-foreground`. Both use `type="button"`.
- `ReviewForm` receives `initial={jobs[current].initial}`, `locations`, `filePaths={jobs[current].filePaths}`, `duplicates`, `newSupplier`, `submitUrl="/api/invoices"`, `method="POST"`, and the `onSaved` above. `key={current}` forces state reset between steps.
- Parallel extraction: `Promise.all` is safe because `extractJob` never throws (all failure paths return a Job).
- The old single-file flow is subsumed: one file in batch mode = wizard of 1.

- [ ] **Step 4: Verify** — `npm test` (parity incl. new keys) + `npm run build`. Manual (needs dev server + Supabase): batch-upload 2–3 sample photos → spinner with counter → wizard 1/3 → save, skip, save → done screen shows "2 of 3".

- [ ] **Step 5: Commit**

```bash
git add src/components/ReviewForm.tsx "src/app/(app)/upload/UploadFlow.tsx" messages
git commit -m "Add batch upload wizard with per-file review"
```

---

### Task 5: Analytics aggregation library (TDD)

**Files:**
- Create: `src/lib/analytics/aggregate.ts`
- Test: `tests/analytics-aggregate.test.ts`

**Interfaces:**
- Produces (consumed by Tasks 6 & 7 — signatures binding):

```ts
export interface InvoiceRow {
  invoice_date: string | null; total: number | null; category: string;
  supplier_name: string; payment_status: string; review_status: string;
  payment_due_date: string | null;
}
export interface ItemRow {
  name_en: string | null; description: string; quantity: number | null;
  unit: string | null; unit_price: number | null; amount: number | null;
  invoice_date: string | null;
}
export function monthKey(date: string): string;                    // '2026-07-04' -> '2026-07'
export function monthlyTotals(rows: InvoiceRow[], months: string[]): { month: string; total: number }[];
export function totalsBy(rows: InvoiceRow[], key: 'category' | 'supplier_name'): { name: string; total: number }[]; // desc by total
export function itemStats(current: ItemRow[], previous: ItemRow[]): {
  name: string; total: number; qty: number; avgUnitPrice: number | null;
  prevAvgUnitPrice: number | null; priceDeltaPct: number | null;
}[]; // grouped by name_en ?? description, desc by total
export function counters(rows: InvoiceRow[], todayIso: string): {
  pendingReview: number; unpaidTotal: number; dueSoonTotal: number; // due within 14 days, unpaid
};
```

- [ ] **Step 1: Write failing tests** `tests/analytics-aggregate.test.ts` — cover: `monthKey` basic; `monthlyTotals` fills zero for empty months and sums correctly; `totalsBy` groups + sorts desc; `itemStats` groups by `name_en` fallback `description`, computes qty-weighted `avgUnitPrice` (sum(amount)/sum(quantity) when both present, else null), `priceDeltaPct` null when either side null and correct otherwise (e.g. 5.0 → 5.5 = +10); `counters` counts pending, sums unpaid totals, and sums unpaid due within 14 days of `todayIso` inclusive. Use small literal fixtures (3–6 rows). Run → FAIL (module not found).

- [ ] **Step 2: Implement `src/lib/analytics/aggregate.ts`** — pure TS, no imports. Rules: skip rows with null `invoice_date` in monthly grouping; treat null `total`/`amount` as 0 in sums; `avgUnitPrice = sumAmount / sumQty` only when `sumQty > 0` and at least one row had non-null amount & quantity; `priceDeltaPct = ((cur - prev) / prev) * 100` rounded to 1 decimal.

- [ ] **Step 3: Run → PASS; commit**

```bash
git add src/lib/analytics/aggregate.ts tests/analytics-aggregate.test.ts
git commit -m "Add analytics aggregation functions"
```

---

### Task 6: Dashboard page + charts + nav gating

**Files:**
- Create: `src/lib/analytics/fetch.ts`, `src/app/(app)/dashboard/page.tsx`, `src/components/charts/MonthlyBar.tsx`, `src/components/charts/CategoryBars.tsx`, `src/components/charts/SupplierBars.tsx`
- Modify: `src/app/(app)/layout.tsx` (admin-only nav link), `messages/en.json`, `messages/zh-CN.json`

**Interfaces:**
- Consumes: Task 5 functions; supabase server client
- Produces: `fetchDashboardData(supabase, month: string)` → `{ months, monthly, categories, suppliers, items, counters }` (also used by Task 7); route `/dashboard` (admin-only)

- [ ] **Step 1: Install recharts** — `npm install recharts` (exit 0).

- [ ] **Step 2: i18n** — add to BOTH files: `nav.dashboard` ("Dashboard" / "数据分析") and namespace `dashboard`: `title` ("Analysis" / "数据分析"), `month` ("Month" / "月份"), `monthlySpend` ("Monthly spend" / "月度支出"), `byCategory` ("By category" / "按类别"), `topSuppliers` ("Top suppliers" / "主要供应商"), `topItems` ("Top items" / "主要商品"), `item` ("Item" / "商品"), `spend` ("Spend" / "支出"), `avgUnitPrice` ("Avg unit price" / "平均单价"), `priceDelta` ("vs last month" / "环比"), `pendingReview` ("Pending review" / "待审核"), `unpaidTotal` ("Unpaid total" / "未付款总额"), `dueSoon` ("Due in 14 days" / "14 天内到期"), `insights` ("AI insights" / "AI 分析"), `generate` ("Generate" / "生成分析"), `regenerate` ("Regenerate" / "重新生成"), `generating` ("Generating…" / "生成中…"), `noReport` ("No report yet for this month." / "本月尚未生成分析报告。"), `noData` ("No data" / "暂无数据").

- [ ] **Step 3: `src/lib/analytics/fetch.ts`** (server-only helper; relative imports):

```ts
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
```

- [ ] **Step 4: Chart components** — three small `'use client'` files using recharts with token colors. `MonthlyBar.tsx`:

```tsx
'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export function MonthlyBar({ data }: { data: { month: string; total: number }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={data}>
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={48} />
          <Tooltip formatter={(v) => Number(v).toFixed(2)} cursor={{ fill: 'rgba(0,82,255,0.04)' }} />
          <Bar dataKey="total" fill="#0052ff" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

`CategoryBars.tsx` and `SupplierBars.tsx`: same pattern with `layout="vertical"`, `dataKey="name"` on YAxis (`width={140}`, truncate long names via `tickFormatter={(v) => String(v).slice(0, 18)}`), `dataKey="total"` Bar with `radius={[0, 6, 6, 0]}`, container heights `h-56`/`h-72`. Props: `{ data: { name: string; total: number }[] }`.

- [ ] **Step 5: `src/app/(app)/dashboard/page.tsx`** — server component:
  - `const { id } = ...` not needed; read `searchParams: Promise<{ month?: string }>`; default `month = new Date().toISOString().slice(0, 7)`; validate with `/^\d{4}-\d{2}$/` else default.
  - Admin gate: fetch user + profile role; `if (profile?.role !== 'admin') notFound();`
  - `const data = await fetchDashboardData(supabase, month);` and cached report: `const { data: report } = await supabase.from('insight_reports').select('content_md, created_at').eq('period_month', `${month}-01`).maybeSingle();`
  - Layout: `font-display` title + `<form method="GET">` month picker (`<input type="month" name="month" defaultValue={month} className={fieldStyles} />` + apply button `buttonStyles('primary','md')`); 3 counter cards (Card, big `tabular-nums` numbers: pendingReview count, unpaidTotal `toFixed(2)`, dueSoonTotal `toFixed(2)`); Card with `t('dashboard.monthlySpend')` + `<MonthlyBar data={data.monthly} />`; two-col grid: Card byCategory + `<CategoryBars data={data.categories.map(c => ({ ...c, name: t(`categories.${c.name}`) }))} />` (translate category keys server-side), Card topSuppliers + `<SupplierBars data={data.suppliers} />`; Card topItems: table (item / spend / avg unit price / vs last month with `+x.x%` in red when >0, emerald when <0, '—' when null); `<InsightsPanel month={month} initialReport={report?.content_md ?? null} />` (Task 7 — create the file in THIS task as a stub rendering `null`, replaced in Task 7; keeps this task buildable).
  - Empty-data cells render `t('dashboard.noData')`.

- [ ] **Step 6: Nav gating** — `src/app/(app)/layout.tsx`: fetch role (`createClient` from `@/lib/supabase/server`, `auth.getUser()`, profiles select role) and render the dashboard link only for admins:

```tsx
{profile?.role === 'admin' && (
  <Link href="/dashboard" className="rounded-lg px-3 py-2 text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground">
    {t('nav.dashboard')}
  </Link>
)}
```

- [ ] **Step 7: Verify** — `npm test`, `npm run build` (route `ƒ /dashboard` listed). Manual: staff account gets 404 + no link; admin sees charts.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/lib/analytics "src/app/(app)/dashboard" src/components/charts "src/app/(app)/layout.tsx" messages
git commit -m "Add admin analysis dashboard with charts"
```

---

### Task 7: AI insights (route + panel)

**Files:**
- Create: `src/lib/insights/prompt.ts`, `src/app/api/insights/route.ts`, `src/components/SimpleMarkdown.tsx`
- Modify: `src/app/(app)/dashboard/InsightsPanel.tsx` (replace Task 6 stub)

**Interfaces:**
- Consumes: `fetchDashboardData` (Task 6), `DashboardData` type
- Produces: `POST /api/insights` body `{ month: 'YYYY-MM' }` → 200 `{ content: string }` | 401/403/400/502; `insight_reports` row upserted on `period_month = month-01`

- [ ] **Step 1: `src/lib/insights/prompt.ts`** (pure; relative imports):

```ts
import type { DashboardData } from '../analytics/fetch';

export function buildInsightsPrompt(data: DashboardData): string {
  return `You are a purchasing analyst for a Singapore F&B business (outlets + central kitchen).
Below is aggregated purchasing data for ${data.month} (monthly totals include the five prior months;
item price deltas compare to the previous month). Amounts are SGD.

${JSON.stringify(
    {
      month: data.month,
      monthlyTotals: data.monthly,
      categoryTotals: data.categories,
      topSuppliers: data.suppliers,
      topItems: data.items,
      open: data.counters,
    },
    null,
    2,
  )}

Write a concise monthly purchasing report in Markdown with TWO sections:
first "## 中文分析" in Simplified Chinese, then "## English Analysis" with the
same content in English. In each section cover, as short bullet lists under
bold mini-headings: overall spend vs recent months; category mix shifts;
supplier concentration (flag any supplier above ~40% of spend); notable unit
price increases or decreases (use the priceDeltaPct values; call out anything
beyond ±10%); and 2-3 actionable suggestions. Keep each section under 350
words. Base every claim strictly on the data above; if the data is too sparse
to conclude something, say so rather than inventing trends.`;
}
```

- [ ] **Step 2: `src/app/api/insights/route.ts`**

```ts
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { fetchDashboardData } from '@/lib/analytics/fetch';
import { buildInsightsPrompt } from '@/lib/insights/prompt';

export const maxDuration = 60;

const MODEL = 'claude-opus-4-8';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('user_id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = (await request.json()) as { month?: unknown };
  if (typeof body.month !== 'string' || !/^\d{4}-\d{2}$/.test(body.month)) {
    return NextResponse.json({ error: 'invalid_month' }, { status: 400 });
  }

  const data = await fetchDashboardData(supabase, body.month);

  let content: string;
  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      thinking: { type: 'adaptive' },
      messages: [{ role: 'user', content: buildInsightsPrompt(data) }],
    });
    if (response.stop_reason === 'refusal') throw new Error('refusal');
    content = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { text: string }).text)
      .join('\n')
      .trim();
    if (!content) throw new Error('empty');
  } catch (e) {
    console.error('insights generation failed', e);
    return NextResponse.json({ error: 'generation_failed' }, { status: 502 });
  }

  const { error } = await supabase.from('insight_reports').upsert(
    { period_month: `${body.month}-01`, content_md: content, model: MODEL },
    { onConflict: 'period_month' },
  );
  if (error) return NextResponse.json({ error: 'save_failed' }, { status: 500 });

  return NextResponse.json({ content });
}
```

- [ ] **Step 3: `src/components/SimpleMarkdown.tsx`** — minimal renderer (##/### headings, `-` bullets grouped into `<ul>`, `**bold**` inline, blank lines split paragraphs). ~40 lines, no dependencies; renders within `text-sm leading-relaxed` prose-ish spacing (`h3: mt-4 font-semibold`, `ul: my-2 list-disc pl-5 space-y-1`).

- [ ] **Step 4: Replace the `InsightsPanel` stub** — `'use client'`; props `{ month: string; initialReport: string | null }`; state `report`, `busy`, `error`; button (`Button` primary md) label `t('dashboard.generate')`/`regenerate` per report presence, disabled+`t('dashboard.generating')` with `<Spinner className="h-4 w-4" />` while busy; on click `POST /api/insights` → setReport(content) (and `router.refresh()`); non-OK → inline red error text (`t('review.saveFailed')` reused). Renders `<SimpleMarkdown text={report} />` inside a Card titled with a `SectionLabel`(`t('dashboard.insights')`), or `t('dashboard.noReport')` muted when null.

- [ ] **Step 5: Verify** — `npm test`, `npm run build` (`ƒ /api/insights` listed). Manual (admin, live env): Generate on a month with data → bilingual report renders; second click regenerates; row visible in `insight_reports`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/insights src/app/api/insights src/components/SimpleMarkdown.tsx "src/app/(app)/dashboard/InsightsPanel.tsx"
git commit -m "Add cached AI monthly insights"
```

---

### Task 8 (controller, not subagent): Apply migration 003 live + final review + deploy

- [ ] Apply `003_batch2.sql` to the live Supabase project via MCP `apply_migration`; verify with a `list_tables`/select that `invoice_items.name_en` exists, `insight_reports` exists, and active locations = the two outlets.
- [ ] Final whole-branch review (requesting-code-review template), fix wave if needed.
- [ ] Push to `main` → Vercel auto-deploys (after the user has repointed Vercel to `fnb-invoice-manager`).
- [ ] Golden re-run: `npm run extract:sample -- samples/golden/photo-04.jpg` → line item now carries `name_en`/`name_zh`.

## Self-review notes

- Spec coverage: batch wizard → T4; bilingual names → T3; spinner → T1; white-label → T2; cursor → T1; outlets → T3 SQL (+controller apply); dashboard+insights → T5–T7; guardrails (caps, cache, admin gates) embedded in T4/T6/T7.
- Type consistency: `DashboardData` produced in T6 consumed in T7; `ReviewItemValues.nameEn/nameZh` (T3) consumed by T4's wizard mapping; `Spinner` (T1) used in T4/T7; parity test guards all new i18n keys.
- `InsightsPanel` stub created in T6 so the dashboard builds before T7 lands.
