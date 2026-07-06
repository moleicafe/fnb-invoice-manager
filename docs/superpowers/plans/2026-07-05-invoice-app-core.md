# Invoice App Core (Plan 1 of 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deployed, bilingual (zh-CN/en) Next.js + Supabase web app where staff photograph supplier invoices, Claude extracts full line items, and users review/correct/save them into a filterable invoice archive with role-based permissions.

**Architecture:** Single Next.js App Router app on Vercel; Supabase provides Postgres (with RLS), auth, and private file storage. All Anthropic API calls happen in server routes. Files upload to storage *first*, extraction second, so a failed extraction never loses a document.

**Tech Stack:** Next.js 15 (TypeScript, App Router), Tailwind CSS v4, Supabase (`@supabase/supabase-js`, `@supabase/ssr`), `next-intl` (cookie-based locale, no URL prefixes), `@anthropic-ai/sdk` + `zod` structured outputs, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-04-invoice-mgmt-design.md`. Plan 2 (dashboard, price trends, statement reconciliation, Excel export, user management screen, Playwright E2E) follows after this plan ships.

## Global Constraints

- Model for extraction: `claude-opus-4-8` exactly. API key only in server env (`ANTHROPIC_API_KEY`); never sent to the browser.
- All UI strings come from `messages/en.json` + `messages/zh-CN.json` via `next-intl`; the two files must have identical key sets (guarded by a unit test). Default locale `zh-CN`.
- Invoice *content* (descriptions, supplier names) is stored and displayed verbatim — never translated.
- Categories enum (spec §3): `meat | vegetables | rice_dry_goods | packaging | rent_services | misc`.
- Currency default `SGD`; GST arithmetic tolerance S$0.05; GST fields nullable (some suppliers aren't GST-registered).
- `samples/` is gitignored (real business data) — never commit anything under it.
- Node.js ≥ 20.9 required (uses `node --env-file`).
- Commit after every task; imperative-mood messages.
- In `src/lib/**`, use relative imports only (the golden-sample script runs these files outside Next's bundler); `@/` alias is fine in `src/app/**` and `src/components/**`.

## File Structure (end state of Plan 1)

```
messages/{en,zh-CN}.json          UI strings (identical key sets)
supabase/migrations/001_core.sql  schema, RLS, storage bucket, seed
scripts/extract-sample.ts         golden-set harness (runs against samples/golden)
src/middleware.ts                 auth-gate + session refresh
src/i18n/request.ts               cookie-based locale resolution
src/lib/supabase/{client,server}.ts
src/lib/categories.ts             category enum (single source of truth)
src/lib/invoice/checks.ts         due-date + GST arithmetic (pure)
src/lib/suppliers/match.ts        normalize + fuzzy match (pure)
src/lib/auth/permissions.ts       role gates (pure)
src/lib/auth/actions.ts           signOut server action
src/lib/extraction/schema.ts      zod extraction schema
src/lib/extraction/extract.ts     Claude call (buildable outside Next)
src/app/layout.tsx, page.tsx, globals.css
src/app/login/page.tsx
src/app/(app)/layout.tsx          nav shell (auth'd area)
src/app/(app)/upload/page.tsx + UploadFlow.tsx
src/app/(app)/invoices/page.tsx   list + filters
src/app/(app)/invoices/[id]/page.tsx + actions.ts + Actions.tsx
src/app/(app)/invoices/[id]/edit/page.tsx
src/components/{LanguageSwitcher,ReviewForm}.tsx
src/app/api/extract/route.ts      storage → Claude → supplier match → dup check
src/app/api/invoices/route.ts     create invoice + items
src/app/api/invoices/[id]/route.ts  update invoice + items
tests/*.test.ts                   Vitest unit tests
```

---

### Task 1: Scaffold Next.js + Tailwind + Vitest

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `vitest.config.ts`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Consumes: nothing (first task; repo already contains docs/, samples/ [gitignored], README, .gitignore)
- Produces: `npm run dev|build|test` all working; `@/*` alias → `src/*`

We scaffold manually (not `create-next-app`) because the repo is non-empty and we want deterministic file contents.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "fnb-invoice-manager",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "extract:sample": "node --env-file=.env.local --import tsx scripts/extract-sample.ts"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm install next@latest react@latest react-dom@latest @supabase/supabase-js@latest @supabase/ssr@latest next-intl@latest @anthropic-ai/sdk@latest zod@latest
npm install -D typescript@latest @types/node@latest @types/react@latest @types/react-dom@latest vitest@latest tsx@latest tailwindcss@latest @tailwindcss/postcss@latest
```

Expected: both commands exit 0; `package.json` gains dependencies.

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Write `next.config.ts`, `postcss.config.mjs`, `src/app/globals.css`**

`next.config.ts`:
```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {};

export default nextConfig;
```

`postcss.config.mjs`:
```js
export default { plugins: { '@tailwindcss/postcss': {} } };
```

`src/app/globals.css`:
```css
@import 'tailwindcss';
```

- [ ] **Step 5: Write `src/app/layout.tsx` and `src/app/page.tsx`**

`src/app/layout.tsx`:
```tsx
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
```

`src/app/page.tsx`:
```tsx
export default function Home() {
  return <main className="p-6">F&B Invoice Manager</main>;
}
```

- [ ] **Step 6: Write `vitest.config.ts` and smoke test**

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
});
```

`tests/smoke.test.ts`:
```ts
import { it, expect } from 'vitest';

it('vitest runs', () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 7: Verify build and tests**

Run: `npm run build`
Expected: `✓ Compiled successfully` (exit 0).

Run: `npm test`
Expected: `1 passed`.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts postcss.config.mjs vitest.config.ts src tests
git commit -m "Scaffold Next.js app with Tailwind and Vitest"
```

---

### Task 2: Bilingual i18n foundation (next-intl, cookie locale)

**Files:**
- Create: `messages/en.json`, `messages/zh-CN.json`, `src/i18n/request.ts`, `src/components/LanguageSwitcher.tsx`
- Modify: `next.config.ts`, `src/app/layout.tsx`
- Test: `tests/i18n-parity.test.ts`

**Interfaces:**
- Consumes: scaffold from Task 1
- Produces: `useTranslations(ns)` works in any component; `LanguageSwitcher` component; locale = cookie `NEXT_LOCALE` (`'zh-CN'` default, `'en'` alternative). **All later tasks must add UI strings to BOTH message files** — the parity test fails otherwise.

- [ ] **Step 1: Write the parity test**

`tests/i18n-parity.test.ts`:
```ts
import { it, expect } from 'vitest';
import en from '../messages/en.json';
import zh from '../messages/zh-CN.json';

function keyPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null
      ? keyPaths(v as Record<string, unknown>, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  );
}

it('en and zh-CN have identical message keys', () => {
  expect(keyPaths(en).sort()).toEqual(keyPaths(zh).sort());
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `../messages/en.json`.

- [ ] **Step 3: Write both message files**

`messages/en.json`:
```json
{
  "common": {
    "appName": "F&B Invoice Manager",
    "save": "Save",
    "cancel": "Cancel",
    "edit": "Edit",
    "delete": "Delete",
    "loading": "Loading…",
    "signOut": "Sign out"
  },
  "auth": {
    "signIn": "Sign in",
    "email": "Email",
    "password": "Password",
    "signInError": "Sign-in failed. Check your email and password."
  },
  "nav": {
    "upload": "Upload",
    "invoices": "Invoices"
  },
  "upload": {
    "title": "Upload invoice",
    "selectLocation": "Outlet / kitchen",
    "selectFiles": "Take photo or choose files",
    "uploading": "Uploading…",
    "extracting": "Reading invoice with AI…",
    "extractionFailed": "AI could not read this document. Please fill in the details manually.",
    "wrongDocType": "This looks like a monthly statement, not an invoice. Statement support is coming soon — you can still save it manually."
  },
  "review": {
    "title": "Check the extracted details",
    "supplier": "Supplier",
    "newSupplierHint": "New supplier — will be created",
    "invoiceNumber": "Invoice number",
    "invoiceDate": "Invoice date",
    "category": "Category",
    "subtotal": "Subtotal",
    "gst": "GST",
    "total": "Total",
    "items": "Line items",
    "description": "Description",
    "quantity": "Qty",
    "unit": "Unit",
    "unitPrice": "Unit price",
    "amount": "Amount",
    "addItem": "Add line",
    "removeItem": "Remove",
    "arithmeticWarning": "Subtotal + GST does not match the total. Please double-check.",
    "duplicateConfirm": "An invoice with this supplier and invoice number already exists. Save anyway?",
    "submit": "Save invoice"
  },
  "invoices": {
    "title": "Invoices",
    "status": "Review status",
    "paymentStatus": "Payment",
    "location": "Location",
    "from": "From",
    "to": "To",
    "apply": "Filter",
    "clear": "Clear",
    "date": "Date",
    "number": "No.",
    "total": "Total",
    "all": "All",
    "pending_review": "Pending review",
    "approved": "Approved",
    "needs_manual_entry": "Manual entry",
    "unpaid": "Unpaid",
    "paid": "Paid",
    "empty": "No invoices yet"
  },
  "detail": {
    "approve": "Approve",
    "markPaid": "Mark as paid",
    "deleteConfirm": "Delete this invoice?",
    "original": "Original document",
    "dueDate": "Payment due"
  },
  "categories": {
    "meat": "Meat",
    "vegetables": "Vegetables",
    "rice_dry_goods": "Rice & dry goods",
    "packaging": "Packaging",
    "rent_services": "Rent & services",
    "misc": "Miscellaneous"
  }
}
```

`messages/zh-CN.json`:
```json
{
  "common": {
    "appName": "餐饮发票管理",
    "save": "保存",
    "cancel": "取消",
    "edit": "编辑",
    "delete": "删除",
    "loading": "加载中…",
    "signOut": "退出登录"
  },
  "auth": {
    "signIn": "登录",
    "email": "邮箱",
    "password": "密码",
    "signInError": "登录失败，请检查邮箱和密码。"
  },
  "nav": {
    "upload": "上传",
    "invoices": "发票"
  },
  "upload": {
    "title": "上传发票",
    "selectLocation": "门店 / 中央厨房",
    "selectFiles": "拍照或选择文件",
    "uploading": "正在上传…",
    "extracting": "AI 识别中…",
    "extractionFailed": "AI 无法识别该文件，请手动填写。",
    "wrongDocType": "这看起来是月度账单而不是发票。账单功能即将推出——您仍可手动保存。"
  },
  "review": {
    "title": "核对识别结果",
    "supplier": "供应商",
    "newSupplierHint": "新供应商——将自动创建",
    "invoiceNumber": "发票号码",
    "invoiceDate": "发票日期",
    "category": "类别",
    "subtotal": "小计",
    "gst": "消费税 (GST)",
    "total": "总额",
    "items": "明细",
    "description": "品名",
    "quantity": "数量",
    "unit": "单位",
    "unitPrice": "单价",
    "amount": "金额",
    "addItem": "添加一行",
    "removeItem": "删除",
    "arithmeticWarning": "小计 + GST 与总额不符，请核对。",
    "duplicateConfirm": "已存在相同供应商和发票号码的发票，仍要保存吗？",
    "submit": "保存发票"
  },
  "invoices": {
    "title": "发票",
    "status": "审核状态",
    "paymentStatus": "付款状态",
    "location": "门店",
    "from": "从",
    "to": "至",
    "apply": "筛选",
    "clear": "清除",
    "date": "日期",
    "number": "号码",
    "total": "总额",
    "all": "全部",
    "pending_review": "待审核",
    "approved": "已审核",
    "needs_manual_entry": "手动录入",
    "unpaid": "未付款",
    "paid": "已付款",
    "empty": "暂无发票"
  },
  "detail": {
    "approve": "审核通过",
    "markPaid": "标记已付款",
    "deleteConfirm": "确定删除该发票？",
    "original": "原始文件",
    "dueDate": "付款到期日"
  },
  "categories": {
    "meat": "肉类",
    "vegetables": "蔬菜",
    "rice_dry_goods": "米粮干货",
    "packaging": "包装耗材",
    "rent_services": "租金及服务",
    "misc": "其他"
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire next-intl**

`src/i18n/request.ts`:
```ts
import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export default getRequestConfig(async () => {
  const store = await cookies();
  const locale = store.get('NEXT_LOCALE')?.value === 'en' ? 'en' : 'zh-CN';
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
```

Replace `next.config.ts`:
```ts
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {};

export default withNextIntl(nextConfig);
```

Replace `src/app/layout.tsx`:
```tsx
import './globals.css';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale}>
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Write `src/components/LanguageSwitcher.tsx`**

```tsx
'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();

  function switchTo(next: string) {
    document.cookie = `NEXT_LOCALE=${next};path=/;max-age=31536000`;
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={() => switchTo(locale === 'en' ? 'zh-CN' : 'en')}
      className="text-sm underline"
    >
      {locale === 'en' ? '中文' : 'EN'}
    </button>
  );
}
```

- [ ] **Step 7: Verify build**

Run: `npm run build`
Expected: compiles with no type errors.

- [ ] **Step 8: Commit**

```bash
git add messages src/i18n src/components/LanguageSwitcher.tsx next.config.ts src/app/layout.tsx tests/i18n-parity.test.ts
git commit -m "Add bilingual i18n foundation with cookie-based locale"
```

---

### Task 3: Supabase project, schema migration, auth middleware, login

**Files:**
- Create: `.env.example`, `supabase/migrations/001_core.sql`, `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/middleware.ts`, `src/app/login/page.tsx`, `src/lib/auth/actions.ts`

**Interfaces:**
- Consumes: i18n from Task 2 (`useTranslations('auth')`)
- Produces: `createClient()` (browser, from `src/lib/supabase/client.ts`) and `createClient(): Promise<SupabaseClient>` (server, from `src/lib/supabase/server.ts`); every route except `/login` requires a session; DB schema + RLS + private `invoices` storage bucket. Later tasks assume tables/columns exactly as in the SQL below.

- [ ] **Step 1 (HUMAN SETUP — cannot be done by an agent): Create the Supabase project**

1. Create a project at supabase.com (free tier, region Singapore).
2. Project Settings → API: copy the Project URL and `anon` key.
3. Create `.env.local` (gitignored) with real values, matching `.env.example` below.

`.env.example` (commit this file):
```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
ANTHROPIC_API_KEY=sk-ant-YOUR-KEY
```

- [ ] **Step 2: Write `supabase/migrations/001_core.sql`**

```sql
-- Enums
create type user_role as enum ('admin','staff');
create type location_type as enum ('outlet','central_kitchen');
create type invoice_category as enum ('meat','vegetables','rice_dry_goods','packaging','rent_services','misc');
create type review_status as enum ('pending_review','approved','needs_manual_entry');
create type payment_status as enum ('unpaid','paid');
create type reconcile_status as enum ('open','partial','complete');
create type statement_match_status as enum ('matched','missing_invoice','amount_mismatch');

-- Tables
create table locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type location_type not null default 'outlet',
  active boolean not null default true
);

create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role user_role not null default 'staff',
  home_location_id uuid references locations(id),
  preferred_locale text not null default 'zh-CN'
);

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  aliases text[] not null default '{}',
  default_category invoice_category,
  payment_terms_days int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references suppliers(id),
  location_id uuid not null references locations(id),
  invoice_number text,
  invoice_date date,
  currency text not null default 'SGD',
  subtotal numeric(12,2),
  gst_amount numeric(12,2),
  total numeric(12,2),
  category invoice_category not null default 'misc',
  review_status review_status not null default 'pending_review',
  payment_status payment_status not null default 'unpaid',
  payment_due_date date,
  paid_at timestamptz,
  file_paths text[] not null default '{}',
  uploaded_by uuid not null references auth.users(id),
  approved_by uuid references auth.users(id),
  extraction_raw jsonb,
  arithmetic_warning boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index invoices_supplier_idx on invoices(supplier_id);
create index invoices_location_idx on invoices(location_id);
create index invoices_date_idx on invoices(invoice_date desc);

create table invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  line_no int not null,
  description text not null,
  quantity numeric(12,3),
  unit text,
  unit_price numeric(12,4),
  amount numeric(12,2)
);
create index invoice_items_invoice_idx on invoice_items(invoice_id);

-- Statement tables (schema now, features in Plan 2)
create table statements (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references suppliers(id),
  location_id uuid references locations(id),
  period_month date,
  total_due numeric(12,2),
  reconcile_status reconcile_status not null default 'open',
  paid_at timestamptz,
  file_paths text[] not null default '{}',
  uploaded_by uuid not null references auth.users(id),
  extraction_raw jsonb,
  created_at timestamptz not null default now()
);

create table statement_lines (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references statements(id) on delete cascade,
  invoice_number text,
  invoice_date date,
  amount numeric(12,2),
  matched_invoice_id uuid references invoices(id) on delete set null,
  match_status statement_match_status not null default 'missing_invoice'
);
create index statement_lines_statement_idx on statement_lines(statement_id);

-- Helpers
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where user_id = auth.uid() and role = 'admin');
$$;

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger invoices_updated_at before update on invoices
  for each row execute function set_updated_at();

-- RLS
alter table locations enable row level security;
alter table profiles enable row level security;
alter table suppliers enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
alter table statements enable row level security;
alter table statement_lines enable row level security;

create policy "read own or admin" on profiles for select to authenticated
  using (user_id = auth.uid() or is_admin());
create policy "update own or admin" on profiles for update to authenticated
  using (user_id = auth.uid() or is_admin());

create policy "authenticated read" on locations for select to authenticated using (true);
create policy "admin write" on locations for all to authenticated
  using (is_admin()) with check (is_admin());

create policy "authenticated read" on suppliers for select to authenticated using (true);
create policy "authenticated insert" on suppliers for insert to authenticated with check (true);
create policy "admin update" on suppliers for update to authenticated using (is_admin());
create policy "admin delete" on suppliers for delete to authenticated using (is_admin());

create policy "authenticated read" on invoices for select to authenticated using (true);
create policy "insert own" on invoices for insert to authenticated
  with check (uploaded_by = auth.uid());
create policy "update own pending or admin" on invoices for update to authenticated
  using (is_admin() or (uploaded_by = auth.uid() and review_status = 'pending_review'));
create policy "admin delete" on invoices for delete to authenticated using (is_admin());

create policy "authenticated read" on invoice_items for select to authenticated using (true);
create policy "write via invoice rule" on invoice_items for insert to authenticated
  with check (exists (
    select 1 from invoices i where i.id = invoice_id
      and (is_admin() or (i.uploaded_by = auth.uid() and i.review_status = 'pending_review'))
  ));
create policy "update via invoice rule" on invoice_items for update to authenticated
  using (exists (
    select 1 from invoices i where i.id = invoice_id
      and (is_admin() or (i.uploaded_by = auth.uid() and i.review_status = 'pending_review'))
  ));
create policy "delete via invoice rule" on invoice_items for delete to authenticated
  using (exists (
    select 1 from invoices i where i.id = invoice_id
      and (is_admin() or (i.uploaded_by = auth.uid() and i.review_status = 'pending_review'))
  ));

create policy "authenticated read" on statements for select to authenticated using (true);
create policy "insert own" on statements for insert to authenticated
  with check (uploaded_by = auth.uid());
create policy "admin update" on statements for update to authenticated using (is_admin());
create policy "admin delete" on statements for delete to authenticated using (is_admin());
create policy "authenticated read" on statement_lines for select to authenticated using (true);
create policy "admin write" on statement_lines for all to authenticated
  using (is_admin()) with check (is_admin());

-- Storage: private bucket for invoice files
insert into storage.buckets (id, name, public) values ('invoices', 'invoices', false)
  on conflict (id) do nothing;
create policy "authenticated upload invoices" on storage.objects for insert to authenticated
  with check (bucket_id = 'invoices');
create policy "authenticated read invoices" on storage.objects for select to authenticated
  using (bucket_id = 'invoices');

-- Seed locations (owner renames these in Supabase later if needed)
insert into locations (name, type) values
  ('中央厨房 Central Kitchen', 'central_kitchen'),
  ('兀兰 Woodlands MRT — 千味山东大包', 'outlet'),
  ('文礼 Boon Lay — 裕华园山东大包', 'outlet'),
  ('西安面馆', 'outlet');
```

- [ ] **Step 3 (HUMAN SETUP): Apply the migration and create users**

1. Supabase Dashboard → SQL Editor → paste `001_core.sql` → Run. Expected: "Success. No rows returned".
2. Authentication → Users → Add user (email + password) for the developer account; add a second one for testing the staff role.
3. Promote the first to admin — SQL Editor:
```sql
update profiles set role = 'admin'
where user_id = (select id from auth.users where email = 'YOUR-EMAIL');
```
4. Verify: `select display_name, role from profiles;` → two rows, one `admin`, one `staff`.

- [ ] **Step 4: Write the Supabase clients**

`src/lib/supabase/client.ts`:
```ts
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

`src/lib/supabase/server.ts`:
```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // called from a Server Component — middleware refreshes sessions instead
          }
        },
      },
    },
  );
}
```

- [ ] **Step 5: Write `src/middleware.ts` (session refresh + auth gate)**

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user && request.nextUrl.pathname !== '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)'],
};
```

- [ ] **Step 6: Write login page and signOut action**

`src/app/login/page.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export default function LoginPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(false);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(true);
      setBusy(false);
      return;
    }
    router.push('/upload');
    router.refresh();
  }

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-4 p-6 pt-16">
      <div className="flex justify-end"><LanguageSwitcher /></div>
      <h1 className="text-xl font-semibold">{t('signIn')}</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          {t('email')}
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="rounded border p-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('password')}
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
            className="rounded border p-2" />
        </label>
        {error && <p className="text-sm text-red-600">{t('signInError')}</p>}
        <button type="submit" disabled={busy}
          className="rounded bg-blue-600 p-2 text-white disabled:opacity-50">
          {t('signIn')}
        </button>
      </form>
    </main>
  );
}
```

`src/lib/auth/actions.ts`:
```ts
'use server';

import { redirect } from 'next/navigation';
import { createClient } from './../supabase/server';

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
```

- [ ] **Step 7: Verify manually**

Run: `npm run dev`
- Visiting `http://localhost:3000/` redirects to `/login`.
- Signing in with the admin user redirects to `/upload` (404 for now — built in Task 8; that's expected).
- Language switcher on the login page flips 中文/EN.

Run: `npm run build` — Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add .env.example supabase src/lib/supabase src/middleware.ts src/app/login src/lib/auth/actions.ts
git commit -m "Add Supabase schema with RLS, auth middleware, and login page"
```

---

### Task 4: Domain logic — due dates and GST arithmetic (TDD)

**Files:**
- Create: `src/lib/invoice/checks.ts`
- Test: `tests/invoice-checks.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `computeDueDate(invoiceDate: string, termsDays: number): string` (ISO in → ISO out) and `hasArithmeticWarning(subtotal: number | null, gst: number | null, total: number | null, toleranceDollars?: number): boolean`. Used by Tasks 7–10 and the ReviewForm (client-safe, pure).

- [ ] **Step 1: Write the failing tests**

`tests/invoice-checks.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { computeDueDate, hasArithmeticWarning } from '../src/lib/invoice/checks';

describe('computeDueDate', () => {
  it('adds the supplier terms to the invoice date', () => {
    expect(computeDueDate('2026-07-04', 30)).toBe('2026-08-03');
  });
  it('handles zero terms (cash / C.O.D.)', () => {
    expect(computeDueDate('2026-07-04', 0)).toBe('2026-07-04');
  });
  it('rolls over month and year ends', () => {
    expect(computeDueDate('2025-12-20', 14)).toBe('2026-01-03');
  });
  it('throws on an invalid date', () => {
    expect(() => computeDueDate('not-a-date', 30)).toThrow();
  });
});

describe('hasArithmeticWarning', () => {
  it('accepts subtotal + gst = total (EBUY sample: 8.50 + 0.77 = 9.27)', () => {
    expect(hasArithmeticWarning(8.5, 0.77, 9.27)).toBe(false);
  });
  it('flags a mismatch beyond S$0.05', () => {
    expect(hasArithmeticWarning(100, 9, 110)).toBe(true);
  });
  it('tolerates rounding within S$0.05', () => {
    expect(hasArithmeticWarning(100.0, 9.0, 109.04)).toBe(false);
  });
  it('treats missing GST as zero (non-GST supplier: subtotal = total)', () => {
    expect(hasArithmeticWarning(147.83, null, 147.83)).toBe(false);
  });
  it('never warns when subtotal or total is missing', () => {
    expect(hasArithmeticWarning(null, 5, 100)).toBe(false);
    expect(hasArithmeticWarning(100, 5, null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `../src/lib/invoice/checks`.

- [ ] **Step 3: Write `src/lib/invoice/checks.ts`**

```ts
export function computeDueDate(invoiceDate: string, termsDays: number): string {
  const d = new Date(`${invoiceDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`invalid invoice date: ${invoiceDate}`);
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all suites).

- [ ] **Step 5: Commit**

```bash
git add src/lib/invoice/checks.ts tests/invoice-checks.test.ts
git commit -m "Add due-date and GST arithmetic checks"
```

---

### Task 5: Supplier normalization and fuzzy matching (TDD)

**Files:**
- Create: `src/lib/suppliers/match.ts`
- Test: `tests/supplier-match.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `normalizeSupplierName(name: string): string`, `diceCoefficient(a: string, b: string): number`, `matchSupplier(extractedName: string, suppliers: SupplierRecord[], threshold?: number): SupplierRecord | null` where `SupplierRecord = { id: string; name: string; aliases: string[] }` (extra properties allowed). Used by Task 7.

- [ ] **Step 1: Write the failing tests**

`tests/supplier-match.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { normalizeSupplierName, diceCoefficient, matchSupplier } from '../src/lib/suppliers/match';

const suppliers = [
  { id: '1', name: 'Mega Packaging Plastic Pte Ltd', aliases: [] },
  { id: '2', name: 'DA DE FRESH PTE LTD', aliases: ['大德生鲜私人有限公司', '大德生鲜'] },
  { id: '3', name: 'Oh Chuan Aun Eggs Trading', aliases: [] },
];

describe('normalizeSupplierName', () => {
  it('lowercases and strips punctuation and legal suffixes', () => {
    expect(normalizeSupplierName('Mega Packaging Plastic Pte. Ltd.')).toBe('mega packaging plastic');
  });
  it('keeps Chinese characters', () => {
    expect(normalizeSupplierName('大德生鲜私人有限公司')).toBe('大德生鲜私人有限公司');
  });
});

describe('diceCoefficient', () => {
  it('is 1 for identical strings', () => {
    expect(diceCoefficient('abcd', 'abcd')).toBe(1);
  });
  it('is 0 for disjoint strings', () => {
    expect(diceCoefficient('abcd', 'wxyz')).toBe(0);
  });
});

describe('matchSupplier', () => {
  it('matches exactly ignoring case and suffixes', () => {
    expect(matchSupplier('MEGA PACKAGING PLASTIC PTE LTD', suppliers)?.id).toBe('1');
  });
  it('matches via a Chinese alias', () => {
    expect(matchSupplier('大德生鲜', suppliers)?.id).toBe('2');
  });
  it('matches close variants above the threshold', () => {
    expect(matchSupplier('Mega Packging Plastic', suppliers)?.id).toBe('1');
  });
  it('returns null when nothing is close', () => {
    expect(matchSupplier('Totally Different Trading', suppliers)).toBeNull();
  });
  it('returns null for empty input', () => {
    expect(matchSupplier('', suppliers)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `../src/lib/suppliers/match`.

- [ ] **Step 3: Write `src/lib/suppliers/match.ts`**

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/suppliers/match.ts tests/supplier-match.test.ts
git commit -m "Add supplier name normalization and fuzzy matching"
```

---

### Task 6: Extraction schema, Claude call, and golden-sample harness

**Files:**
- Create: `src/lib/categories.ts`, `src/lib/extraction/schema.ts`, `src/lib/extraction/extract.ts`, `scripts/extract-sample.ts`
- Test: `tests/extraction-schema.test.ts`

**Interfaces:**
- Consumes: nothing new (relative imports only — these files also run under `tsx` outside Next)
- Produces:
  - `CATEGORIES` const tuple + `Category` type (`src/lib/categories.ts`)
  - `invoiceExtractionSchema` (zod) + `InvoiceExtraction` type
  - `extractDocument(files: DocumentFile[], client?: Anthropic): Promise<InvoiceExtraction>` where `DocumentFile = { data: Buffer; mediaType: string }`
  - `toContentBlocks(files: DocumentFile[])` (exported for tests)
  - `npm run extract:sample -- <files…>` golden harness

- [ ] **Step 1: Write `src/lib/categories.ts`**

```ts
export const CATEGORIES = [
  'meat',
  'vegetables',
  'rice_dry_goods',
  'packaging',
  'rent_services',
  'misc',
] as const;

export type Category = (typeof CATEGORIES)[number];
```

- [ ] **Step 2: Write the failing schema tests**

`tests/extraction-schema.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { invoiceExtractionSchema } from '../src/lib/extraction/schema';
import { toContentBlocks } from '../src/lib/extraction/extract';

const valid = {
  document_type: 'invoice',
  supplier_name: 'EBUY PTE. LTD.',
  invoice_number: '260704000669-1',
  invoice_date: '2026-07-04',
  line_items: [
    { description: '切有机菜花 (次品) Cut Organic Cauliflower (Defective)', quantity: 8.5, unit: 'kg', unit_price: 1.0, amount: 8.5 },
  ],
  subtotal: 8.5,
  gst_amount: 0.77,
  total: 9.27,
  suggested_category: 'vegetables',
};

describe('invoiceExtractionSchema', () => {
  it('accepts a complete invoice extraction', () => {
    expect(invoiceExtractionSchema.parse(valid)).toEqual(valid);
  });
  it('accepts nulls for fields a document may not print', () => {
    const sparse = { ...valid, invoice_number: null, subtotal: null, gst_amount: null, suggested_category: null };
    expect(invoiceExtractionSchema.parse(sparse).gst_amount).toBeNull();
  });
  it('rejects an unknown document_type', () => {
    expect(invoiceExtractionSchema.safeParse({ ...valid, document_type: 'receipt' }).success).toBe(false);
  });
  it('rejects a non-ISO date', () => {
    expect(invoiceExtractionSchema.safeParse({ ...valid, invoice_date: '04/07/2026' }).success).toBe(false);
  });
});

describe('toContentBlocks', () => {
  it('maps PDFs to document blocks and images to image blocks', () => {
    const blocks = toContentBlocks([
      { data: Buffer.from('a'), mediaType: 'application/pdf' },
      { data: Buffer.from('b'), mediaType: 'image/jpeg' },
    ]);
    expect(blocks[0].type).toBe('document');
    expect(blocks[1].type).toBe('image');
  });
  it('throws on unsupported types', () => {
    expect(() => toContentBlocks([{ data: Buffer.from('x'), mediaType: 'text/plain' }])).toThrow();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `../src/lib/extraction/schema`.

- [ ] **Step 4: Write `src/lib/extraction/schema.ts`**

```ts
import { z } from 'zod';
import { CATEGORIES } from '../categories';

export const lineItemSchema = z.object({
  description: z.string(),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  unit_price: z.number().nullable(),
  amount: z.number().nullable(),
});

export const invoiceExtractionSchema = z.object({
  document_type: z.enum(['invoice', 'statement', 'other']),
  supplier_name: z.string().nullable(),
  invoice_number: z.string().nullable(),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  line_items: z.array(lineItemSchema),
  subtotal: z.number().nullable(),
  gst_amount: z.number().nullable(),
  total: z.number().nullable(),
  suggested_category: z.enum(CATEGORIES).nullable(),
});

export type InvoiceExtraction = z.infer<typeof invoiceExtractionSchema>;
```

- [ ] **Step 5: Write `src/lib/extraction/extract.ts`**

```ts
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { invoiceExtractionSchema, type InvoiceExtraction } from './schema';

export interface DocumentFile {
  data: Buffer;
  mediaType: string;
}

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const EXTRACTION_PROMPT = `You are reading a document a Singapore F&B business received from a supplier.
It may be a delivery invoice, tax invoice, thermal receipt, or a monthly statement (账单) that lists
many invoice numbers. Text may be English, Simplified Chinese, or mixed. Photos may be crumpled,
faint, or partially covered.

Classify document_type first:
- "invoice": a single invoice or receipt for one delivery/charge
- "statement": a monthly statement listing multiple invoice numbers with amounts
- "other": anything else

For an invoice, extract:
- supplier_name: the ISSUING company. The buyer is MING YUAN F&B PTE LTD (裕华园 / 千味山东大包 /
  西安面馆 outlets) — never return the buyer as the supplier.
- invoice_number and invoice_date (convert any printed format to YYYY-MM-DD).
- every line item, with description copied VERBATIM in its original language (do not translate).
- quantity, unit, unit_price, amount as plain numbers; null when not printed.
- subtotal, gst_amount (the GST/tax line), total — null when the document does not print the value.
  Never compute a missing value yourself.
- suggested_category: one of meat, vegetables, rice_dry_goods, packaging, rent_services, misc,
  judged from the goods (rent_services covers rent, management fees, utilities, cleaning).

For a statement or other document, fill supplier_name and total if visible; leave the rest
null and line_items empty.`;

export function toContentBlocks(files: DocumentFile[]) {
  return files.map((f) => {
    const data = f.data.toString('base64');
    if (f.mediaType === 'application/pdf') {
      return {
        type: 'document' as const,
        source: { type: 'base64' as const, media_type: 'application/pdf' as const, data },
      };
    }
    if (!IMAGE_TYPES.has(f.mediaType)) throw new Error(`unsupported file type: ${f.mediaType}`);
    return {
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: f.mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
        data,
      },
    };
  });
}

export async function extractDocument(
  files: DocumentFile[],
  client: Anthropic = new Anthropic(),
): Promise<InvoiceExtraction> {
  const response = await client.messages.parse({
    model: 'claude-opus-4-8',
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    messages: [
      {
        role: 'user',
        content: [...toContentBlocks(files), { type: 'text', text: EXTRACTION_PROMPT }],
      },
    ],
    output_config: { format: zodOutputFormat(invoiceExtractionSchema) },
  });
  if (response.stop_reason === 'refusal') throw new Error('extraction_refused');
  if (!response.parsed_output) throw new Error('extraction_unparseable');
  return response.parsed_output;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all suites).

- [ ] **Step 7: Write the golden-sample harness `scripts/extract-sample.ts`**

```ts
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { extractDocument } from '../src/lib/extraction/extract';

const MEDIA: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('usage: npm run extract:sample -- <file> [more files = pages of ONE document]');
    process.exit(1);
  }
  const files = await Promise.all(
    args.map(async (f) => {
      const mediaType = MEDIA[path.extname(f).toLowerCase()];
      if (!mediaType) throw new Error(`unsupported extension: ${f}`);
      return { data: await readFile(f), mediaType };
    }),
  );
  const started = Date.now();
  const result = await extractDocument(files);
  console.log(JSON.stringify(result, null, 2));
  console.error(`\nextracted in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 8: Run the harness against real samples (needs `ANTHROPIC_API_KEY` in `.env.local`)**

Run: `npm run extract:sample -- samples/golden/photo-01.jpg`
Expected: JSON with `document_type: "invoice"`, `supplier_name` ≈ "Mega Packaging Plastic Pte Ltd", 11 line items, `total: 147.83`, `gst_amount: null`.

Run: `npm run extract:sample -- samples/golden/statement-dade-shandongdabao-2025-11.pdf`
Expected: `document_type: "statement"` (invoice fields mostly null — statements are Plan 2).

Run: `npm run extract:sample -- samples/golden/ttl-rent-invoice-2025-11-0060.pdf`
Expected: `document_type: "invoice"`, `suggested_category: "rent_services"`, `subtotal: 24816.51`, `gst_amount: 2233.49`, `total: 27050`.

If a field is systematically wrong across samples, adjust `EXTRACTION_PROMPT` (not the schema) and re-run all three.

- [ ] **Step 9: Commit**

```bash
git add src/lib/categories.ts src/lib/extraction scripts/extract-sample.ts tests/extraction-schema.test.ts
git commit -m "Add Claude invoice extraction with structured outputs and golden-sample harness"
```

---

### Task 7: /api/extract route (storage → Claude → supplier match → duplicate check)

**Files:**
- Create: `src/app/api/extract/route.ts`

**Interfaces:**
- Consumes: `extractDocument` (Task 6), `matchSupplier` (Task 5), Supabase server client (Task 3)
- Produces: `POST /api/extract` with body `{ paths: string[] }` (storage object paths in the `invoices` bucket, ≤ 5 = pages of ONE document). Response 200:
  `{ extraction: InvoiceExtraction, matchedSupplier: { id, name, aliases, default_category, payment_terms_days } | null, duplicates: { id, invoice_date, total }[] }`.
  Errors: 401 `{error:'unauthorized'}`, 400 `{error:'invalid_paths'|'download_failed'}`, 502 `{error:'extraction_failed'}` (client falls back to manual entry).

- [ ] **Step 1: Write `src/app/api/extract/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { extractDocument, type DocumentFile } from '@/lib/extraction/extract';
import { matchSupplier } from '@/lib/suppliers/match';

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

  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, name, aliases, default_category, payment_terms_days')
    .eq('active', true);

  const matchedSupplier = extraction.supplier_name
    ? matchSupplier(extraction.supplier_name, suppliers ?? [])
    : null;

  let duplicates: { id: string; invoice_date: string | null; total: number | null }[] = [];
  if (matchedSupplier && extraction.invoice_number) {
    const { data: dupes } = await supabase
      .from('invoices')
      .select('id, invoice_date, total')
      .eq('supplier_id', matchedSupplier.id)
      .eq('invoice_number', extraction.invoice_number);
    duplicates = dupes ?? [];
  }

  return NextResponse.json({ extraction, matchedSupplier, duplicates });
}
```

- [ ] **Step 2: Verify types and build**

Run: `npm run build`
Expected: exit 0, route listed as `ƒ /api/extract`.

- [ ] **Step 3: Manual smoke test**

With `npm run dev` running and a signed-in browser session: upload any golden sample manually via Supabase Dashboard → Storage → `invoices` bucket (e.g. path `test/photo-01.jpg`), then from the browser devtools console:
```js
await (await fetch('/api/extract', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ paths: ['test/photo-01.jpg'] }),
})).json();
```
Expected: `{ extraction: {...}, matchedSupplier: null, duplicates: [] }` (no suppliers exist yet).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/extract/route.ts
git commit -m "Add extraction API route with supplier matching and duplicate check"
```

---

### Task 8: Upload & review flow (app shell, storage upload, ReviewForm, save API)

**Files:**
- Create: `src/app/(app)/layout.tsx`, `src/app/(app)/upload/page.tsx`, `src/app/(app)/upload/UploadFlow.tsx`, `src/components/ReviewForm.tsx`, `src/lib/invoice/save-schema.ts`, `src/app/api/invoices/route.ts`
- Modify: `src/app/page.tsx` (redirect to `/upload`)

**Interfaces:**
- Consumes: `/api/extract` (Task 7), `computeDueDate`/`hasArithmeticWarning` (Task 4), `CATEGORIES` (Task 6), supabase clients (Task 3), i18n keys (Task 2)
- Produces:
  - `POST /api/invoices` body (all money fields `number | null`, strings already trimmed):
    ```ts
    {
      locationId: string; supplierId: string | null; supplierName: string;
      invoiceNumber: string | null; invoiceDate: string | null; // YYYY-MM-DD
      category: Category; subtotal: number | null; gstAmount: number | null; total: number | null;
      filePaths: string[]; extractionRaw: unknown | null; confirmedDuplicate: boolean;
      items: { description: string; quantity: number | null; unit: string | null;
               unitPrice: number | null; amount: number | null }[];
    }
    ```
    Responses: 200 `{ id }` · 409 `{ error: 'duplicate', duplicates }` · 400/401 errors.
  - `ReviewForm` component (reused by Task 10's edit page):
    `props: { initial: ReviewFormValues; locations: {id,name}[]; filePaths: string[]; duplicates: {id}[]; newSupplier: boolean; submitUrl: string; method: 'POST' | 'PATCH' }`
    with `ReviewFormValues` as defined in Step 3 (exported from `ReviewForm.tsx`).

- [ ] **Step 1: App shell — `src/app/(app)/layout.tsx`**

```tsx
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { signOut } from '@/lib/auth/actions';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations();
  return (
    <div className="mx-auto max-w-5xl">
      <header className="flex items-center gap-4 border-b bg-white p-4">
        <span className="font-semibold">{t('common.appName')}</span>
        <nav className="flex gap-3 text-sm">
          <Link href="/upload" className="underline">{t('nav.upload')}</Link>
          <Link href="/invoices" className="underline">{t('nav.invoices')}</Link>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <LanguageSwitcher />
          <form action={signOut}>
            <button type="submit" className="text-sm text-gray-500 underline">{t('common.signOut')}</button>
          </form>
        </div>
      </header>
      <main className="p-4">{children}</main>
    </div>
  );
}
```

Replace `src/app/page.tsx`:
```tsx
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/upload');
}
```

- [ ] **Step 2: Upload page (server) — `src/app/(app)/upload/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server';
import { UploadFlow } from './UploadFlow';

export default async function UploadPage() {
  const supabase = await createClient();
  const [{ data: locations }, { data: { user } }] = await Promise.all([
    supabase.from('locations').select('id, name').eq('active', true).order('name'),
    supabase.auth.getUser(),
  ]);
  const { data: profile } = await supabase
    .from('profiles')
    .select('home_location_id')
    .eq('user_id', user!.id)
    .single();

  return (
    <UploadFlow
      locations={locations ?? []}
      defaultLocationId={profile?.home_location_id ?? locations?.[0]?.id ?? ''}
    />
  );
}
```

- [ ] **Step 3: `src/components/ReviewForm.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CATEGORIES, type Category } from '../lib/categories';
import { hasArithmeticWarning } from '../lib/invoice/checks';

export interface ReviewItemValues {
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  amount: string;
}

export interface ReviewFormValues {
  locationId: string;
  supplierId: string | null;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  category: Category;
  subtotal: string;
  gst: string;
  total: string;
  items: ReviewItemValues[];
  extractionRaw: unknown | null;
}

export const EMPTY_ITEM: ReviewItemValues = { description: '', quantity: '', unit: '', unitPrice: '', amount: '' };

function num(s: string): number | null {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : null;
}

export function ReviewForm(props: {
  initial: ReviewFormValues;
  locations: { id: string; name: string }[];
  filePaths: string[];
  duplicates: { id: string }[];
  newSupplier: boolean;
  submitUrl: string;
  method: 'POST' | 'PATCH';
}) {
  const t = useTranslations();
  const router = useRouter();
  const [v, setV] = useState(props.initial);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const arithmeticWarning = hasArithmeticWarning(num(v.subtotal), num(v.gst), num(v.total));

  function setItem(i: number, patch: Partial<ReviewItemValues>) {
    setV((cur) => ({ ...cur, items: cur.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) }));
  }

  async function submit(confirmedDuplicate: boolean) {
    setBusy(true);
    setServerError(null);
    const res = await fetch(props.submitUrl, {
      method: props.method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locationId: v.locationId,
        supplierId: v.supplierId,
        supplierName: v.supplierName.trim(),
        invoiceNumber: v.invoiceNumber.trim() || null,
        invoiceDate: v.invoiceDate || null,
        category: v.category,
        subtotal: num(v.subtotal),
        gstAmount: num(v.gst),
        total: num(v.total),
        filePaths: props.filePaths,
        extractionRaw: v.extractionRaw,
        confirmedDuplicate,
        items: v.items
          .filter((it) => it.description.trim())
          .map((it) => ({
            description: it.description.trim(),
            quantity: num(it.quantity),
            unit: it.unit.trim() || null,
            unitPrice: num(it.unitPrice),
            amount: num(it.amount),
          })),
      }),
    });
    if (res.status === 409) {
      setBusy(false);
      if (window.confirm(t('review.duplicateConfirm'))) await submit(true);
      return;
    }
    if (!res.ok) {
      setBusy(false);
      setServerError(`save failed (${res.status})`);
      return;
    }
    const { id } = await res.json();
    router.push(`/invoices/${id}`);
  }

  const input = 'rounded border p-2 text-sm';

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); void submit(false); }}
      className="flex flex-col gap-4"
    >
      <h1 className="text-lg font-semibold">{t('review.title')}</h1>

      {props.duplicates.length > 0 && (
        <p className="rounded bg-amber-100 p-2 text-sm">{t('review.duplicateConfirm')}</p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          {t('upload.selectLocation')}
          <select className={input} value={v.locationId}
            onChange={(e) => setV({ ...v, locationId: e.target.value })}>
            {props.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('review.supplier')}
          <input required className={input} value={v.supplierName}
            onChange={(e) => setV({ ...v, supplierName: e.target.value, supplierId: null })} />
          {props.newSupplier && <span className="text-xs text-blue-600">{t('review.newSupplierHint')}</span>}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('review.invoiceNumber')}
          <input className={input} value={v.invoiceNumber}
            onChange={(e) => setV({ ...v, invoiceNumber: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('review.invoiceDate')}
          <input type="date" className={input} value={v.invoiceDate}
            onChange={(e) => setV({ ...v, invoiceDate: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t('review.category')}
          <select className={input} value={v.category}
            onChange={(e) => setV({ ...v, category: e.target.value as Category })}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{t(`categories.${c}`)}</option>)}
          </select>
        </label>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">{t('review.items')}</legend>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="p-1">{t('review.description')}</th>
                <th className="p-1 w-20">{t('review.quantity')}</th>
                <th className="p-1 w-16">{t('review.unit')}</th>
                <th className="p-1 w-24">{t('review.unitPrice')}</th>
                <th className="p-1 w-24">{t('review.amount')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {v.items.map((it, i) => (
                <tr key={i}>
                  <td className="p-1"><input className={`${input} w-full`} value={it.description}
                    onChange={(e) => setItem(i, { description: e.target.value })} /></td>
                  <td className="p-1"><input inputMode="decimal" className={`${input} w-full`} value={it.quantity}
                    onChange={(e) => setItem(i, { quantity: e.target.value })} /></td>
                  <td className="p-1"><input className={`${input} w-full`} value={it.unit}
                    onChange={(e) => setItem(i, { unit: e.target.value })} /></td>
                  <td className="p-1"><input inputMode="decimal" className={`${input} w-full`} value={it.unitPrice}
                    onChange={(e) => setItem(i, { unitPrice: e.target.value })} /></td>
                  <td className="p-1"><input inputMode="decimal" className={`${input} w-full`} value={it.amount}
                    onChange={(e) => setItem(i, { amount: e.target.value })} /></td>
                  <td className="p-1">
                    <button type="button" className="text-xs text-red-600 underline"
                      onClick={() => setV((cur) => ({ ...cur, items: cur.items.filter((_, j) => j !== i) }))}>
                      {t('review.removeItem')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" className="self-start text-sm text-blue-600 underline"
          onClick={() => setV((cur) => ({ ...cur, items: [...cur.items, EMPTY_ITEM] }))}>
          {t('review.addItem')}
        </button>
      </fieldset>

      <div className="grid grid-cols-3 gap-3">
        {(['subtotal', 'gst', 'total'] as const).map((f) => (
          <label key={f} className="flex flex-col gap-1 text-sm">
            {t(`review.${f}`)}
            <input inputMode="decimal" className={input} value={v[f]}
              onChange={(e) => setV({ ...v, [f]: e.target.value })} />
          </label>
        ))}
      </div>

      {arithmeticWarning && (
        <p className="rounded bg-amber-100 p-2 text-sm">{t('review.arithmeticWarning')}</p>
      )}
      {serverError && <p className="text-sm text-red-600">{serverError}</p>}

      <button type="submit" disabled={busy}
        className="rounded bg-blue-600 p-3 text-white disabled:opacity-50">
        {t('review.submit')}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: `src/app/(app)/upload/UploadFlow.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { ReviewForm, EMPTY_ITEM, type ReviewFormValues } from '@/components/ReviewForm';

type Phase = 'pick' | 'uploading' | 'extracting' | 'review';

interface ExtractResponse {
  extraction: {
    document_type: 'invoice' | 'statement' | 'other';
    supplier_name: string | null;
    invoice_number: string | null;
    invoice_date: string | null;
    line_items: { description: string; quantity: number | null; unit: string | null; unit_price: number | null; amount: number | null }[];
    subtotal: number | null;
    gst_amount: number | null;
    total: number | null;
    suggested_category: string | null;
  };
  matchedSupplier: { id: string; name: string; default_category: string | null } | null;
  duplicates: { id: string }[];
}

const s = (n: number | null) => (n == null ? '' : String(n));

export function UploadFlow(props: { locations: { id: string; name: string }[]; defaultLocationId: string }) {
  const t = useTranslations('upload');
  const [phase, setPhase] = useState<Phase>('pick');
  const [banner, setBanner] = useState<string | null>(null);
  const [filePaths, setFilePaths] = useState<string[]>([]);
  const [review, setReview] = useState<{ initial: ReviewFormValues; duplicates: { id: string }[]; newSupplier: boolean } | null>(null);

  function blankValues(): ReviewFormValues {
    return {
      locationId: props.defaultLocationId, supplierId: null, supplierName: '',
      invoiceNumber: '', invoiceDate: '', category: 'misc',
      subtotal: '', gst: '', total: '', items: [EMPTY_ITEM], extractionRaw: null,
    };
  }

  async function onFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).slice(0, 5);
    setBanner(null);
    setPhase('uploading');

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const paths: string[] = [];
    for (const file of files) {
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase() || '.jpg';
      const path = `${user!.id}/${crypto.randomUUID()}${ext}`;
      const { error } = await supabase.storage.from('invoices').upload(path, file);
      if (error) {
        setBanner(t('extractionFailed'));
        setPhase('pick');
        return;
      }
      paths.push(path);
    }
    setFilePaths(paths);
    setPhase('extracting');

    const res = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths }),
    });
    if (!res.ok) {
      // File is safe in storage — offer manual entry (spec §8)
      setBanner(t('extractionFailed'));
      setReview({ initial: blankValues(), duplicates: [], newSupplier: true });
      setPhase('review');
      return;
    }
    const payload = (await res.json()) as ExtractResponse;
    const e = payload.extraction;
    if (e.document_type !== 'invoice') setBanner(t('wrongDocType'));
    setReview({
      initial: {
        locationId: props.defaultLocationId,
        supplierId: payload.matchedSupplier?.id ?? null,
        supplierName: payload.matchedSupplier?.name ?? e.supplier_name ?? '',
        invoiceNumber: e.invoice_number ?? '',
        invoiceDate: e.invoice_date ?? '',
        category: (e.suggested_category ?? payload.matchedSupplier?.default_category ?? 'misc') as ReviewFormValues['category'],
        subtotal: s(e.subtotal), gst: s(e.gst_amount), total: s(e.total),
        items: e.line_items.length
          ? e.line_items.map((li) => ({
              description: li.description, quantity: s(li.quantity), unit: li.unit ?? '',
              unitPrice: s(li.unit_price), amount: s(li.amount),
            }))
          : [EMPTY_ITEM],
        extractionRaw: e,
      },
      duplicates: payload.duplicates,
      newSupplier: !payload.matchedSupplier,
    });
    setPhase('review');
  }

  if (phase === 'review' && review) {
    return (
      <div className="flex flex-col gap-3">
        {banner && <p className="rounded bg-amber-100 p-2 text-sm">{banner}</p>}
        <ReviewForm
          initial={review.initial}
          locations={props.locations}
          filePaths={filePaths}
          duplicates={review.duplicates}
          newSupplier={review.newSupplier}
          submitUrl="/api/invoices"
          method="POST"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 pt-8">
      <h1 className="text-lg font-semibold">{t('title')}</h1>
      {banner && <p className="rounded bg-amber-100 p-2 text-sm">{banner}</p>}
      {phase === 'pick' ? (
        <label className="cursor-pointer rounded-lg border-2 border-dashed p-10 text-center text-sm text-gray-600">
          {t('selectFiles')}
          <input
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => void onFiles(e.target.files)}
          />
        </label>
      ) : (
        <p className="text-sm text-gray-600">
          {phase === 'uploading' ? t('uploading') : t('extracting')}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Shared save schema + `src/app/api/invoices/route.ts`**

`src/lib/invoice/save-schema.ts` (shared with Task 10's PATCH route — Next.js route files may only export handlers, so the schema cannot live in `route.ts`):
```ts
import { z } from 'zod';
import { CATEGORIES } from '../categories';

const itemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  unitPrice: z.number().nullable(),
  amount: z.number().nullable(),
});

export const saveInvoiceSchema = z.object({
  locationId: z.string().uuid(),
  supplierId: z.string().uuid().nullable(),
  supplierName: z.string().min(1),
  invoiceNumber: z.string().nullable(),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  category: z.enum(CATEGORIES),
  subtotal: z.number().nullable(),
  gstAmount: z.number().nullable(),
  total: z.number().nullable(),
  filePaths: z.array(z.string()).min(1),
  extractionRaw: z.unknown().nullable(),
  confirmedDuplicate: z.boolean(),
  items: z.array(itemSchema),
});

export type SaveInvoiceBody = z.infer<typeof saveInvoiceSchema>;
```

`src/app/api/invoices/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { computeDueDate, hasArithmeticWarning } from '@/lib/invoice/checks';
import { saveInvoiceSchema } from '@/lib/invoice/save-schema';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = saveInvoiceSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  const b = parsed.data;

  // Resolve or create the supplier
  let supplierId = b.supplierId;
  let termsDays = 0;
  if (supplierId) {
    const { data: supplier } = await supabase
      .from('suppliers').select('payment_terms_days').eq('id', supplierId).single();
    if (!supplier) return NextResponse.json({ error: 'supplier_not_found' }, { status: 400 });
    termsDays = supplier.payment_terms_days;
  } else {
    const { data: created, error } = await supabase
      .from('suppliers')
      .insert({ name: b.supplierName, default_category: b.category })
      .select('id, payment_terms_days')
      .single();
    if (error || !created) return NextResponse.json({ error: 'supplier_create_failed' }, { status: 500 });
    supplierId = created.id;
    termsDays = created.payment_terms_days;
  }

  // Duplicate gate (server-side, authoritative)
  if (b.invoiceNumber && !b.confirmedDuplicate) {
    const { data: dupes } = await supabase
      .from('invoices').select('id, invoice_date, total')
      .eq('supplier_id', supplierId).eq('invoice_number', b.invoiceNumber);
    if (dupes && dupes.length > 0) {
      return NextResponse.json({ error: 'duplicate', duplicates: dupes }, { status: 409 });
    }
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      supplier_id: supplierId,
      location_id: b.locationId,
      invoice_number: b.invoiceNumber,
      invoice_date: b.invoiceDate,
      subtotal: b.subtotal,
      gst_amount: b.gstAmount,
      total: b.total,
      category: b.category,
      payment_due_date: b.invoiceDate ? computeDueDate(b.invoiceDate, termsDays) : null,
      arithmetic_warning: hasArithmeticWarning(b.subtotal, b.gstAmount, b.total),
      file_paths: b.filePaths,
      uploaded_by: user.id,
      extraction_raw: b.extractionRaw ?? null,
    })
    .select('id')
    .single();
  if (invoiceError || !invoice) return NextResponse.json({ error: 'insert_failed' }, { status: 500 });

  if (b.items.length > 0) {
    const { error: itemsError } = await supabase.from('invoice_items').insert(
      b.items.map((it, i) => ({
        invoice_id: invoice.id,
        line_no: i + 1,
        description: it.description,
        quantity: it.quantity,
        unit: it.unit,
        unit_price: it.unitPrice,
        amount: it.amount,
      })),
    );
    if (itemsError) return NextResponse.json({ error: 'items_insert_failed' }, { status: 500 });
  }

  return NextResponse.json({ id: invoice.id });
}
```

- [ ] **Step 6: Verify build and the full flow manually**

Run: `npm run build` — Expected: exit 0.

With `npm run dev`, signed in as the staff user:
1. `/upload` → choose `samples/golden/photo-01.jpg` → progress states appear → review form pre-filled with Mega Packaging data and 11 items.
2. Correct any field → save → redirected to `/invoices/<id>` (404 until Task 9-10 — the URL containing a UUID is the success signal for now; verify the rows in Supabase Table Editor: 1 invoice + 11 items, supplier auto-created, `payment_due_date` = invoice date since terms default 0).
3. Upload the same file again → duplicate confirm dialog appears (invoice number matches) → cancel.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)" src/components/ReviewForm.tsx src/lib/invoice/save-schema.ts src/app/api/invoices/route.ts src/app/page.tsx
git commit -m "Add upload flow with AI extraction review and invoice save API"
```

---

### Task 9: Invoices list with filters

**Files:**
- Create: `src/app/(app)/invoices/page.tsx`

**Interfaces:**
- Consumes: schema (Task 3), i18n (Task 2)
- Produces: `/invoices` — filterable list; every row links to `/invoices/[id]` (Task 10)

- [ ] **Step 1: Write `src/app/(app)/invoices/page.tsx`**

```tsx
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const t = await getTranslations();
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: locations } = await supabase
    .from('locations').select('id, name').eq('active', true).order('name');

  let query = supabase
    .from('invoices')
    .select('id, invoice_number, invoice_date, total, category, review_status, payment_status, suppliers(name), locations(name)')
    .order('invoice_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(200);
  if (sp.status) query = query.eq('review_status', sp.status);
  if (sp.payment) query = query.eq('payment_status', sp.payment);
  if (sp.location) query = query.eq('location_id', sp.location);
  if (sp.from) query = query.gte('invoice_date', sp.from);
  if (sp.to) query = query.lte('invoice_date', sp.to);
  const { data: invoices } = await query;

  const rel = (v: unknown) => (v as { name: string } | null)?.name ?? '—';
  const select = 'rounded border p-2 text-sm';

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">{t('invoices.title')}</h1>

      <form method="GET" className="flex flex-wrap items-end gap-2 text-sm">
        <label className="flex flex-col gap-1">
          {t('invoices.status')}
          <select name="status" defaultValue={sp.status ?? ''} className={select}>
            <option value="">{t('invoices.all')}</option>
            <option value="pending_review">{t('invoices.pending_review')}</option>
            <option value="approved">{t('invoices.approved')}</option>
            <option value="needs_manual_entry">{t('invoices.needs_manual_entry')}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          {t('invoices.paymentStatus')}
          <select name="payment" defaultValue={sp.payment ?? ''} className={select}>
            <option value="">{t('invoices.all')}</option>
            <option value="unpaid">{t('invoices.unpaid')}</option>
            <option value="paid">{t('invoices.paid')}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          {t('invoices.location')}
          <select name="location" defaultValue={sp.location ?? ''} className={select}>
            <option value="">{t('invoices.all')}</option>
            {(locations ?? []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          {t('invoices.from')}
          <input type="date" name="from" defaultValue={sp.from ?? ''} className={select} />
        </label>
        <label className="flex flex-col gap-1">
          {t('invoices.to')}
          <input type="date" name="to" defaultValue={sp.to ?? ''} className={select} />
        </label>
        <button type="submit" className="rounded bg-blue-600 px-3 py-2 text-white">{t('invoices.apply')}</button>
        <Link href="/invoices" className="px-2 py-2 underline">{t('invoices.clear')}</Link>
      </form>

      {(invoices ?? []).length === 0 ? (
        <p className="text-sm text-gray-500">{t('invoices.empty')}</p>
      ) : (
        <div className="overflow-x-auto rounded border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-gray-500">
                <th className="p-2">{t('invoices.date')}</th>
                <th className="p-2">{t('review.supplier')}</th>
                <th className="p-2">{t('invoices.number')}</th>
                <th className="p-2">{t('invoices.location')}</th>
                <th className="p-2">{t('review.category')}</th>
                <th className="p-2 text-right">{t('invoices.total')}</th>
                <th className="p-2">{t('invoices.status')}</th>
                <th className="p-2">{t('invoices.paymentStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {(invoices ?? []).map((inv) => (
                <tr key={inv.id} className="border-b hover:bg-gray-50">
                  <td className="p-2">
                    <Link href={`/invoices/${inv.id}`} className="block">{inv.invoice_date ?? '—'}</Link>
                  </td>
                  <td className="p-2">{rel(inv.suppliers)}</td>
                  <td className="p-2">{inv.invoice_number ?? '—'}</td>
                  <td className="p-2">{rel(inv.locations)}</td>
                  <td className="p-2">{t(`categories.${inv.category}`)}</td>
                  <td className="p-2 text-right">{inv.total != null ? Number(inv.total).toFixed(2) : '—'}</td>
                  <td className="p-2">{t(`invoices.${inv.review_status}`)}</td>
                  <td className="p-2">{t(`invoices.${inv.payment_status}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npm run build` — exit 0.
In the browser: `/invoices` shows the invoice(s) saved in Task 8; each filter narrows results; `Clear` resets.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/invoices/page.tsx"
git commit -m "Add invoices list with filters"
```

---

### Task 10: Invoice detail — file viewer, permissions, approve / mark paid / delete / edit

**Files:**
- Create: `src/lib/auth/permissions.ts`, `src/app/(app)/invoices/[id]/page.tsx`, `src/app/(app)/invoices/[id]/actions.ts`, `src/app/(app)/invoices/[id]/Actions.tsx`, `src/app/(app)/invoices/[id]/edit/page.tsx`, `src/app/api/invoices/[id]/route.ts`
- Test: `tests/permissions.test.ts`

**Interfaces:**
- Consumes: `ReviewForm` + `saveInvoiceSchema` (Task 8), `computeDueDate`/`hasArithmeticWarning` (Task 4), schema/RLS (Task 3)
- Produces: `canEditInvoice(role, uploadedBy, userId, reviewStatus): boolean`; `PATCH /api/invoices/[id]` (same body as POST; replaces fields + all items); server actions `approveInvoice(id)`, `markInvoicePaid(id)`, `deleteInvoice(id)`

- [ ] **Step 1: Write the failing permissions tests**

`tests/permissions.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { canEditInvoice } from '../src/lib/auth/permissions';

describe('canEditInvoice', () => {
  it('admin can edit anything', () => {
    expect(canEditInvoice('admin', 'someone-else', 'me', 'approved')).toBe(true);
  });
  it('staff can edit their own pending invoice', () => {
    expect(canEditInvoice('staff', 'me', 'me', 'pending_review')).toBe(true);
  });
  it('staff cannot edit their own invoice after approval', () => {
    expect(canEditInvoice('staff', 'me', 'me', 'approved')).toBe(false);
  });
  it("staff cannot edit someone else's invoice", () => {
    expect(canEditInvoice('staff', 'someone-else', 'me', 'pending_review')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test` — Expected: FAIL, module not found.

- [ ] **Step 3: Write `src/lib/auth/permissions.ts`**

```ts
export type Role = 'admin' | 'staff';

export function canEditInvoice(
  role: Role,
  uploadedBy: string,
  userId: string,
  reviewStatus: string,
): boolean {
  return role === 'admin' || (uploadedBy === userId && reviewStatus === 'pending_review');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` — Expected: PASS.

- [ ] **Step 5: Server actions — `src/app/(app)/invoices/[id]/actions.ts`**

RLS is the enforcement layer; these actions also check the role for clean UX errors.

```ts
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
```

- [ ] **Step 6: Detail page — `src/app/(app)/invoices/[id]/page.tsx`**

```tsx
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { Actions } from './Actions';

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations();
  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, suppliers(name), locations(name), invoice_items(*)')
    .eq('id', id)
    .single();
  if (!invoice) notFound();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('user_id', user!.id).single();

  const { data: signed } = await supabase.storage
    .from('invoices')
    .createSignedUrls(invoice.file_paths ?? [], 3600);

  const items = [...(invoice.invoice_items ?? [])].sort(
    (a: { line_no: number }, b: { line_no: number }) => a.line_no - b.line_no,
  );
  const rel = (v: unknown) => (v as { name: string } | null)?.name ?? '—';
  const money = (v: unknown) => (v == null ? '—' : Number(v).toFixed(2));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-gray-500">{t('detail.original')}</h2>
        {(signed ?? []).map((f, i) => {
          const isPdf = (invoice.file_paths[i] as string).toLowerCase().endsWith('.pdf');
          return isPdf ? (
            <iframe key={i} src={f.signedUrl} className="h-[70vh] w-full rounded border" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={f.signedUrl} alt="" className="w-full rounded border" />
          );
        })}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold">{rel(invoice.suppliers)}</h1>
            <p className="text-sm text-gray-500">
              {invoice.invoice_number ?? '—'} · {invoice.invoice_date ?? '—'} · {rel(invoice.locations)}
            </p>
          </div>
          <Actions
            id={invoice.id}
            role={(profile?.role ?? 'staff') as 'admin' | 'staff'}
            userId={user!.id}
            uploadedBy={invoice.uploaded_by}
            reviewStatus={invoice.review_status}
            paymentStatus={invoice.payment_status}
          />
        </div>

        <dl className="grid grid-cols-2 gap-2 rounded border bg-white p-3 text-sm">
          <dt className="text-gray-500">{t('review.category')}</dt>
          <dd>{t(`categories.${invoice.category}`)}</dd>
          <dt className="text-gray-500">{t('invoices.status')}</dt>
          <dd>{t(`invoices.${invoice.review_status}`)}</dd>
          <dt className="text-gray-500">{t('invoices.paymentStatus')}</dt>
          <dd>{t(`invoices.${invoice.payment_status}`)}</dd>
          <dt className="text-gray-500">{t('detail.dueDate')}</dt>
          <dd>{invoice.payment_due_date ?? '—'}</dd>
          <dt className="text-gray-500">{t('review.subtotal')} / {t('review.gst')} / {t('review.total')}</dt>
          <dd>{money(invoice.subtotal)} / {money(invoice.gst_amount)} / {money(invoice.total)}</dd>
        </dl>

        {invoice.arithmetic_warning && (
          <p className="rounded bg-amber-100 p-2 text-sm">{t('review.arithmeticWarning')}</p>
        )}

        <table className="w-full rounded border bg-white text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-gray-500">
              <th className="p-2">{t('review.description')}</th>
              <th className="p-2 text-right">{t('review.quantity')}</th>
              <th className="p-2">{t('review.unit')}</th>
              <th className="p-2 text-right">{t('review.unitPrice')}</th>
              <th className="p-2 text-right">{t('review.amount')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it: Record<string, unknown>) => (
              <tr key={String(it.id)} className="border-b">
                <td className="p-2">{String(it.description)}</td>
                <td className="p-2 text-right">{it.quantity == null ? '—' : String(it.quantity)}</td>
                <td className="p-2">{it.unit == null ? '—' : String(it.unit)}</td>
                <td className="p-2 text-right">{money(it.unit_price)}</td>
                <td className="p-2 text-right">{money(it.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
```

- [ ] **Step 7: Action buttons — `src/app/(app)/invoices/[id]/Actions.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { canEditInvoice, type Role } from '../../../../lib/auth/permissions';
import { approveInvoice, deleteInvoice, markInvoicePaid } from './actions';

export function Actions(props: {
  id: string;
  role: Role;
  userId: string;
  uploadedBy: string;
  reviewStatus: string;
  paymentStatus: string;
}) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const isAdmin = props.role === 'admin';
  const btn = 'rounded border px-2 py-1 text-sm disabled:opacity-50';

  return (
    <div className="flex flex-wrap gap-2">
      {canEditInvoice(props.role, props.uploadedBy, props.userId, props.reviewStatus) && (
        <Link href={`/invoices/${props.id}/edit`} className={btn}>{t('common.edit')}</Link>
      )}
      {isAdmin && props.reviewStatus === 'pending_review' && (
        <button className={`${btn} bg-green-600 text-white`} disabled={pending}
          onClick={() => startTransition(() => approveInvoice(props.id))}>
          {t('detail.approve')}
        </button>
      )}
      {isAdmin && props.paymentStatus === 'unpaid' && (
        <button className={btn} disabled={pending}
          onClick={() => startTransition(() => markInvoicePaid(props.id))}>
          {t('detail.markPaid')}
        </button>
      )}
      {isAdmin && (
        <button className={`${btn} text-red-600`} disabled={pending}
          onClick={() => {
            if (window.confirm(t('detail.deleteConfirm'))) {
              startTransition(() => deleteInvoice(props.id));
            }
          }}>
          {t('common.delete')}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Edit page + PATCH route**

`src/app/(app)/invoices/[id]/edit/page.tsx`:
```tsx
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ReviewForm, EMPTY_ITEM, type ReviewFormValues } from '@/components/ReviewForm';
import type { Category } from '@/lib/categories';

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: invoice }, { data: locations }] = await Promise.all([
    supabase.from('invoices')
      .select('*, suppliers(id, name), invoice_items(*)')
      .eq('id', id).single(),
    supabase.from('locations').select('id, name').eq('active', true).order('name'),
  ]);
  if (!invoice) notFound();

  const s = (n: unknown) => (n == null ? '' : String(n));
  const supplier = invoice.suppliers as { id: string; name: string } | null;
  const items = [...(invoice.invoice_items ?? [])]
    .sort((a: { line_no: number }, b: { line_no: number }) => a.line_no - b.line_no)
    .map((it: Record<string, unknown>) => ({
      description: String(it.description), quantity: s(it.quantity), unit: it.unit ? String(it.unit) : '',
      unitPrice: s(it.unit_price), amount: s(it.amount),
    }));

  const initial: ReviewFormValues = {
    locationId: invoice.location_id,
    supplierId: supplier?.id ?? null,
    supplierName: supplier?.name ?? '',
    invoiceNumber: invoice.invoice_number ?? '',
    invoiceDate: invoice.invoice_date ?? '',
    category: invoice.category as Category,
    subtotal: s(invoice.subtotal), gst: s(invoice.gst_amount), total: s(invoice.total),
    items: items.length ? items : [EMPTY_ITEM],
    extractionRaw: null,
  };

  return (
    <ReviewForm
      initial={initial}
      locations={locations ?? []}
      filePaths={invoice.file_paths ?? []}
      duplicates={[]}
      newSupplier={false}
      submitUrl={`/api/invoices/${id}`}
      method="PATCH"
    />
  );
}
```

`src/app/api/invoices/[id]/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { computeDueDate, hasArithmeticWarning } from '@/lib/invoice/checks';
import { saveInvoiceSchema } from '@/lib/invoice/save-schema';

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = saveInvoiceSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  const b = parsed.data;

  let supplierId = b.supplierId;
  let termsDays = 0;
  if (supplierId) {
    const { data: supplier } = await supabase
      .from('suppliers').select('payment_terms_days').eq('id', supplierId).single();
    if (!supplier) return NextResponse.json({ error: 'supplier_not_found' }, { status: 400 });
    termsDays = supplier.payment_terms_days;
  } else {
    const { data: created, error } = await supabase
      .from('suppliers')
      .insert({ name: b.supplierName, default_category: b.category })
      .select('id, payment_terms_days')
      .single();
    if (error || !created) return NextResponse.json({ error: 'supplier_create_failed' }, { status: 500 });
    supplierId = created.id;
    termsDays = created.payment_terms_days;
  }

  if (b.invoiceNumber && !b.confirmedDuplicate) {
    const { data: dupes } = await supabase
      .from('invoices').select('id, invoice_date, total')
      .eq('supplier_id', supplierId).eq('invoice_number', b.invoiceNumber).neq('id', id);
    if (dupes && dupes.length > 0) {
      return NextResponse.json({ error: 'duplicate', duplicates: dupes }, { status: 409 });
    }
  }

  // RLS decides who may update (admin, or uploader while pending) — zero rows means forbidden
  const { data: updated } = await supabase
    .from('invoices')
    .update({
      supplier_id: supplierId,
      location_id: b.locationId,
      invoice_number: b.invoiceNumber,
      invoice_date: b.invoiceDate,
      subtotal: b.subtotal,
      gst_amount: b.gstAmount,
      total: b.total,
      category: b.category,
      payment_due_date: b.invoiceDate ? computeDueDate(b.invoiceDate, termsDays) : null,
      arithmetic_warning: hasArithmeticWarning(b.subtotal, b.gstAmount, b.total),
    })
    .eq('id', id)
    .select('id');
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  await supabase.from('invoice_items').delete().eq('invoice_id', id);
  if (b.items.length > 0) {
    const { error: itemsError } = await supabase.from('invoice_items').insert(
      b.items.map((it, i) => ({
        invoice_id: id,
        line_no: i + 1,
        description: it.description,
        quantity: it.quantity,
        unit: it.unit,
        unit_price: it.unitPrice,
        amount: it.amount,
      })),
    );
    if (itemsError) return NextResponse.json({ error: 'items_insert_failed' }, { status: 500 });
  }

  return NextResponse.json({ id });
}
```

- [ ] **Step 9: Verify the whole loop manually**

Run: `npm run build` — exit 0. Then with `npm run dev`:
1. As staff: open the Task 8 invoice → original photo renders beside the data; Edit visible (own + pending); Approve/Mark paid/Delete hidden.
2. Edit → change a quantity → save → change visible on detail.
3. As admin: Approve → status flips; staff's Edit disappears on that invoice (approved). Mark paid → payment status flips. Delete another test invoice → row + storage files gone, back at `/invoices`.

- [ ] **Step 10: Run all tests and commit**

Run: `npm test` — Expected: all suites PASS.

```bash
git add src/lib/auth/permissions.ts tests/permissions.test.ts "src/app/(app)/invoices/[id]" src/app/api/invoices
git commit -m "Add invoice detail with role-gated approve, pay, delete, and edit"
```

---

### Task 11: Deploy to Vercel and phone smoke test

**Files:** none (configuration + verification)

**Interfaces:**
- Consumes: everything above; GitHub repo `moleicafe/fnb-invoice-manager` (already the `origin` remote)
- Produces: production URL; Plan 1 done

- [ ] **Step 1: Push**

```bash
git push
```

- [ ] **Step 2 (HUMAN SETUP): Import into Vercel**

1. vercel.com → Add New → Project → import `moleicafe/fnb-invoice-manager` (framework auto-detected: Next.js).
2. Environment variables (Production + Preview): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY` — same values as `.env.local`.
3. Deploy. Expected: build succeeds, URL like `https://fnb-invoice-manager.vercel.app`.

- [ ] **Step 3 (HUMAN): Phone smoke test — the real acceptance test**

On an actual phone (staff conditions):
- [ ] Log in as the staff user; toggle 中文 ↔ EN on the login page.
- [ ] Upload: take a photo of a real paper invoice with the camera → extraction completes in < 60s → review form pre-filled.
- [ ] Fix one field, save, see it in the list and detail with the photo.
- [ ] Log in as admin on another device/browser: approve it, mark it paid.
- [ ] Upload the same invoice again → duplicate warning appears.

- [ ] **Step 4: Record any extraction misses**

For each sample that extracted poorly during testing, note it in `samples/README.md` (gitignored) — these become prompt-tuning inputs and Plan 2 regression cases.

---

## Deferred to Plan 2 (separate plan after this ships)

From spec sections not covered above — **statement reconciliation** (§4 statement flow, §5 screen 9: upload → extract statement lines → match against invoices → resolve → mark statement paid, using the `statements`/`statement_lines` tables already migrated), **dashboard** (§5.4: monthly spend by category/outlet/supplier, pending queue, payments due, ingredient price trends), **suppliers screen** (§5.5: terms, aliases editing), **Excel export** (§5.6 with GST breakout), **users & settings screen** (§5.7), **extraction rate limiting** (§8 cost guard), and **Playwright E2E smoke** (§9).

## Self-review notes

- Spec coverage: §2 architecture → Tasks 1–3; §3 data model → Task 3 (all tables incl. statements); §4 extraction flow → Tasks 6–8; §5 screens 1–4 → Tasks 3, 8, 9, 10; §6 roles → Tasks 3 (RLS) + 10 (permissions); §7 bilingual → Task 2 (+ parity test); §8 error handling → extraction-failure fallback (Task 8), arithmetic warning (Tasks 4/8), duplicates (Tasks 7/8/10); §9 testing → unit tests throughout + golden harness (Task 6). Remaining spec items are explicitly listed in "Deferred to Plan 2" above.
- `review_status = 'needs_manual_entry'` exists in the schema but Plan 1 saves human-completed forms as `pending_review` (a human reviewed the data); the status is reserved for Plan 2 flows.
- Type consistency: `SupplierRecord` generic in Task 5 matches Task 7's wider select; `ReviewFormValues`/`EMPTY_ITEM` shared between Tasks 8 and 10; `saveInvoiceSchema` shared between POST and PATCH.




