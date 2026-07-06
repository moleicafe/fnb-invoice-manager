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
