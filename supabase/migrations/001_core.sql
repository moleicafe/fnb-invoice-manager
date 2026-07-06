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
