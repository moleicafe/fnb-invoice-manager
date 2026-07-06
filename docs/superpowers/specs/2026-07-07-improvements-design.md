# App Improvements — Design (Batch 2)

**Date:** 2026-07-07
**Status:** Decisions approved by owner (batch upload = wizard; bilingual names = two columns; white-label = config-based; analysis = dashboard + AI insights)
**Builds on:** `2026-07-04-invoice-mgmt-design.md` (v1 spec). Statement reconciliation remains deferred to a later batch.

## 1. Batch upload (wizard review)

Today multi-select means "pages of one invoice". New model:

- Upload screen gains a mode toggle: **"multiple invoices"** (default — each file is one invoice) vs **"one multi-page invoice"** (old behavior).
- Batch flow: up to **10 files** per batch → all upload to storage first → `/api/extract` is called **per file in parallel** (`Promise.allSettled`) → wizard steps through review forms with a progress indicator ("3 / 10").
- Each step reuses `ReviewForm` unchanged; submit saves that invoice and advances. A **Skip** action advances without saving (the uploaded file stays in storage — acceptable orphan). Failed extractions show the existing failure banner + blank form for that step.
- After the last step: a small completion summary with a link to the invoice list.
- Human-verify-before-save invariant is preserved for every invoice.

New i18n keys: `upload.modeMultiple`, `upload.modeSinglePages`, `upload.progress` (with `{current}`/`{total}`), `upload.skip`, `upload.batchDone`, `upload.viewInvoices`.

## 2. Standardized bilingual item names (two columns)

- **Migration 003:** `invoice_items` gains `name_en text` and `name_zh text` (both nullable).
- The **verbatim `description` stays untouched** (audit trail, spec v1 rule).
- Extraction schema gains per-line `name_en` / `name_zh`: concise, standardized product names in English and Simplified Chinese (e.g. "切有机菜花 (次品)" → en "Organic Cauliflower (defective)", zh "有机菜花（次品）"). Claude fills them in the same extraction call — no extra API cost. Null when the AI can't translate confidently.
- `saveInvoiceSchema` items gain `nameEn`/`nameZh` (nullable); POST/PATCH persist them.
- **Display:** invoice detail shows the standardized name for the current UI locale under the verbatim description (muted, small); dashboard groups items by `name_en` with fallback to `description`.
- **v1 limitation (accepted):** standardized names are not editable in the review form (keeps the mobile line-item table usable); a wrong translation can be fixed later via the catalog feature if/when it lands.

## 3. Extraction spinner

The uploading/extracting states show a spinning loader (CSS `animate-spin` SVG arc in accent color) + the existing mono uppercase status label. Batch wizard shows per-file progress ("extracting 3 / 10"). `prefers-reduced-motion` already globally handled.

## 4. White-label branding (config-based)

- New `src/branding.ts` — the single file a customer deployment edits:
  ```ts
  export const BRANDING = {
    // Per-locale shape so other customers can localize; Ming Yuan uses the
    // English name in both languages (裕华园 is an outlet, not the company).
    appName: { en: 'Ming Yuan F&B', 'zh-CN': 'Ming Yuan F&B' },
    logoGlyph: 'MY',            // 1–2 chars shown in the gradient logo tile
    logoUrl: null as string | null, // optional /public path; overrides glyph
    accent: '#0052FF',
    accentSecondary: '#4D7CFF',
  };
  ```
- Header, login headline, and `<title>` metadata read `BRANDING.appName[locale]` instead of `messages.common.appName` (the message key is removed from both files — parity test keeps guarding the rest).
- Accent colors are injected as CSS-variable overrides in the root layout so one config edit re-skins buttons, gradients, chips, and shadows.
- Each customer = their own deployment (own Supabase + Vercel project + this config). Multi-tenancy is explicitly out of scope.

## 4b. Outlets (data correction)

The real outlet list is exactly two (the v1 seed guesses were wrong):
**Woodlands 兀兰** and **Chinese Garden 裕华园**. Migration 003 deactivates all
existing seeded locations and inserts these two as active outlets. The
existing location picker on the review form already covers "select which
outlet the invoice is for" — this is a data fix, not a new feature. Old
invoices keep their original location reference (inactive locations still
display by name; they just stop appearing in pickers/filters).

## 5. Cursor fix

Tailwind v4 preflight sets `cursor: default` on buttons. Add to `globals.css`:
`button:not(:disabled) { cursor: pointer; }` — fixes the language switcher and every other `<button>` at once.

## 6. Analysis dashboard + AI insights

- **New tab `/dashboard` — admin-only** (spec v1 §6): nav link rendered only for admins; the page itself re-checks the role server-side and 404s otherwise.
- **Computed sections** (server-queried, charts rendered with `recharts` client components):
  1. Monthly spend, last 6 months (bar)
  2. Current-month spend by category (donut or bar) with month picker via search param
  3. Top 8 suppliers by spend in the selected month (horizontal bars)
  4. Top items by spend (grouped by `name_en`, fallback `description`) with unit-price trend sparkline vs prior months
  5. Counters: pending-review count, unpaid total, payments due within 14 days
- **AI insights panel:**
  - **Migration 003** also creates `insight_reports`: `id`, `period_month date unique`, `content_md text`, `model text`, `created_at`. RLS: admin-only read/write.
  - `POST /api/insights` (admin-only): aggregates the selected month's data (totals, category deltas vs previous month, supplier concentration, biggest unit-price movers), sends the JSON to `claude-opus-4-8`, stores a **bilingual markdown report** (中文 section first, then English) in the cache table. Regenerate button overwrites.
  - Dashboard renders the cached report (lightweight markdown rendering); "Generate/Regenerate" visible to admins. Caching = one API call per month per regenerate click, not per view.
- New i18n namespace `dashboard.*` (~15 keys, both locales).

## Cost & guardrails

Batch capped at 10 files/click (~US$0.30–0.50 per batch); insights cached per month and admin-gated. The full per-user rate limiter (v1 spec §8) remains queued.

## Out of scope (this batch)

Statement reconciliation, Excel export, suppliers/users admin screens, item catalog table, conversational analyst agent, multi-tenancy.
