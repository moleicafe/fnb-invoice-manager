# Invoice Management Web App — Design

**Date:** 2026-07-04
**Status:** Approved by owner (brainstorming session)

## 1. Purpose

A bilingual (Simplified Chinese / English) web app for a Singapore F&B business (mala hotpot, Chinese buns, mixed rice) with multiple outlets and a central kitchen. Staff photograph or upload supplier invoices; AI extracts the data; the owners (admins) review, track spending, track payments owed, and export monthly figures for the accountant.

Inspired by [Shinasom/invoice_mgmt_no_db](https://github.com/Shinasom/invoice_mgmt_no_db) (Streamlit + AI extraction, no persistence), but rebuilt as a persistent, multi-user, mobile-friendly business tool.

**Priorities (in order):**
1. Organize & archive invoices — never lose a paper invoice again
2. Track spending & costs — spend per outlet/category/supplier; ingredient price trends
3. Track payments owed — paid/unpaid with due dates from supplier credit terms; monthly supplier statements (账单) reconciled against received invoices
4. Accounting & GST prep — monthly Excel export with GST (9%) broken out

**Hard requirements:**
- Upload both **photos** (paper invoices) and **PDFs** (emailed invoices)
- **Bilingual UI** — Simplified Chinese and English with a convenient toggle
- Staff at outlets/central kitchen upload from **phones**; owners administer
- Near-free hosting; **Anthropic API** for AI extraction

## 2. Architecture

Single **Next.js (App Router, TypeScript)** app deployed on **Vercel** (free tier), backed by **Supabase** (free tier):

| Concern | Technology |
|---|---|
| Web app + API routes | Next.js on Vercel |
| Database | Supabase Postgres (with Row Level Security) |
| Auth (logins, roles) | Supabase Auth (email + password) |
| File storage | Supabase Storage, private bucket `invoices/` |
| AI extraction | Anthropic API, model `claude-opus-4-8`, vision + structured outputs |
| i18n | `next-intl`, locales `zh-CN` and `en` |
| Excel export | `exceljs` (or similar), generated server-side |

Rules:
- The Anthropic API key lives only in server environment variables; all AI calls happen in server routes.
- Files upload to Storage **first**, extraction second — an extraction failure never loses the document.
- Original files are kept indefinitely.

**Estimated running cost:** hosting S$0 (free tiers); AI ≈ US$0.03–0.05 per invoice → roughly US$10–15/month at a few hundred invoices/month.

## 3. Data model

All tables in Supabase Postgres. RLS enforces role rules (§6).

- **profiles** — `user_id (auth.users FK)`, `display_name`, `role` (`admin` | `staff`), `home_location_id`, `preferred_locale`
- **locations** — `id`, `name`, `type` (`outlet` | `central_kitchen`), `active`
- **suppliers** — `id`, `name`, `aliases text[]` (name variants for fuzzy matching), `default_category`, `payment_terms_days` (default 0 = cash), `active`
- **invoices** — `id`, `supplier_id`, `location_id`, `invoice_number`, `invoice_date`, `currency` (default `SGD`), `subtotal`, `gst_amount`, `total`, `category` (`meat` | `vegetables` | `rice_dry_goods` | `packaging` | `rent_services` | `misc`), `review_status` (`pending_review` | `approved` | `needs_manual_entry`), `payment_status` (`unpaid` | `paid`), `payment_due_date` (computed: invoice_date + supplier terms; editable), `paid_at`, `file_paths text[]` (multi-page support), `uploaded_by`, `approved_by`, `extraction_raw jsonb` (audit), `arithmetic_warning boolean`, `created_at`, `updated_at`
- **invoice_items** — `id`, `invoice_id`, `line_no`, `description` (original language, as extracted), `quantity`, `unit`, `unit_price`, `amount`
- **statements** — monthly supplier statements (账单): `id`, `supplier_id`, `location_id` (nullable — statements are often per-outlet), `period_month`, `total_due`, `file_paths text[]`, `reconcile_status` (`open` | `partial` | `complete`), `paid_at` (nullable), `uploaded_by`, `extraction_raw jsonb`, timestamps
- **statement_lines** — `id`, `statement_id`, `invoice_number`, `invoice_date`, `amount`, `matched_invoice_id` (nullable FK → invoices), `match_status` (`matched` | `missing_invoice` | `amount_mismatch`)

Duplicate detection: on save, warn if an invoice with the same `(supplier_id, invoice_number)` exists; secondary heuristic warns on same supplier + date + total. Warn-and-confirm, never silently reject.

## 4. AI extraction flow

1. Staff selects outlet (defaults to their home location) and uploads photo(s)/PDF from their phone → files stored in Supabase Storage.
2. Server route sends the file(s) to `claude-opus-4-8` — image content blocks for photos, document block for PDFs — with **structured outputs** (`output_config.format`, JSON schema) requesting: supplier name, invoice number, invoice date, line items (description, quantity, unit, unit price, amount), subtotal, GST amount, total. Works on Chinese, English, and mixed-language invoices.
3. Supplier name is fuzzy-matched against `suppliers.name` + `aliases`. No match → a new supplier row is created and flagged for admin attention.
4. Duplicate check (§3) runs; the uploader is warned if a likely duplicate exists.
5. Invoice saved as `pending_review` with a pre-filled editable form (fields + line items). The uploader corrects anything misread and submits.
6. Admins see a pending-review queue; approving sets `review_status = approved`. Admins can edit any field at any time.
7. `payment_due_date` auto-computes from supplier terms; marking paid sets `payment_status` and `paid_at`.

Arithmetic check: if `subtotal + gst_amount` differs from `total` by more than S$0.05, set `arithmetic_warning` and show a banner on the review form — warn, don't block.

### Statement reconciliation flow

1. At upload, the user chooses document type: **invoice** or **monthly statement**. The AI also classifies the document and the app warns on a mismatch (e.g. a statement uploaded as an invoice).
2. For statements, extraction returns: supplier, period, and the list of `(invoice_number, date, amount)` lines plus the total due.
3. Each line is matched against stored invoices for that supplier: primary key is normalized `invoice_number`; fallback is date + amount. Match statuses:
   - `matched` — invoice exists and the amount agrees
   - `missing_invoice` — the supplier billed for an invoice we never recorded (chase the paper, or the delivery never happened)
   - `amount_mismatch` — invoice exists but amounts differ
4. The reconciliation screen shows the statement lines with their statuses side-by-side with the statement file. Admins resolve mismatches (edit an invoice, add a missing one from its file, or dismiss a line).
5. **Mark statement paid** (admin): sets the statement's `paid_at` and marks all matched invoices `paid` in one action.

## 5. Screens

1. **Login** — email + password.
2. **Upload** (mobile-first) — outlet picker, camera/file picker (multi-photo for multi-page invoices), progress indicator, then the pre-filled review form.
3. **Invoices list** — filters: supplier, outlet, category, date range, review status, payment status; free-text search; row tap → detail.
4. **Invoice detail** — extracted fields + line items side-by-side with the original photo/PDF viewer; actions: edit, approve (admin), mark paid (admin), delete (admin, with confirm).
5. **Dashboard** (admin) — monthly spend by category / outlet / supplier; pending-review count; payments due within 14 days; **ingredient price trends**: for top line items by spend, unit price over time per supplier.
6. **Suppliers** — list with payment terms, aliases, running totals; add/edit (admin).
7. **Export** (admin) — month picker → Excel workbook: sheet 1 = one row per invoice with GST broken out; sheet 2 = all line items. CSV alternative.
8. **Users & settings** (admin) — create staff accounts, assign roles and home outlets, manage locations.
9. **Statements** — list of uploaded statements with reconcile status; detail view = extracted lines with match statuses side-by-side with the original file; actions: resolve mismatches, mark statement paid (admin).

## 6. Roles & permissions

| Capability | Staff | Admin |
|---|---|---|
| Upload + correct extraction (invoices & statements) | ✅ | ✅ |
| View invoice list/detail | ✅ (read-only after submit) | ✅ |
| Edit any invoice, approve, mark paid, delete | ❌ | ✅ |
| Reconcile statements (resolve mismatches, mark paid) | ❌ | ✅ |
| Dashboard, exports, suppliers, users | ❌ | ✅ |

Enforced both in the UI and via Supabase Row Level Security policies.

## 7. Bilingual UI

- Toggle (中文 / EN) in the header; choice persisted to `profiles.preferred_locale`.
- All UI strings in `messages/zh-CN.json` and `messages/en.json` via `next-intl`. zh-CN is the default locale.
- Invoice **content** (descriptions, supplier names) is displayed exactly as extracted — no machine translation of data.

## 8. Error handling

- **Extraction failure** (blurry photo, API error, refusal, timeout): invoice saved as `needs_manual_entry`, file retained, blank editable form offered. Server retries transient API errors (SDK default backoff).
- **Arithmetic mismatch**: warning banner, submission allowed (§4).
- **Duplicates**: warn-and-confirm (§3).
- **Slow/mobile networks**: client shows upload progress; failed uploads are retryable without re-taking the photo.
- **Cost guard**: per-user rate limit on the extraction route (e.g. 20 extractions / 10 minutes) to stop runaway API spend.

## 9. Testing

- **Unit tests** (Vitest): extraction JSON schema validation, GST arithmetic check, due-date computation, supplier fuzzy-matching, statement-line matching (matched / missing / mismatch), export shaping.
- **Golden set**: real documents from the business in `samples/golden/` (gitignored — private data): 8 phone photos of paper invoices (English, bilingual, thermal receipts), 2 rent invoice PDFs, 4 monthly statement PDFs (Chinese). Used to tune the extraction prompt and re-run when the prompt/model changes.
- **E2E smoke** (Playwright): upload → review → approve → appears in list; language toggle.
- **Manual**: full flow on an actual phone before staff rollout.

## 10. Out of scope (v1)

- Delivery verification (checking goods received vs invoice)
- Inventory/stock management, recipe costing, revenue integration
- Machine translation of invoice content
- Accounting-software integrations (Xero etc.) — Excel export only
- Native mobile app (responsive web only)
