-- PEAK ADMIN - execute in Supabase SQL Editor.
-- Create your sole administrator in Supabase Auth first, then set the admin UUID below.
create extension if not exists pgcrypto;
create table if not exists public.peak_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table if not exists public.peak_operations (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null,
  local_order_id bigint not null,
  created_at timestamptz not null,
  client text not null,
  phone text not null default '',
  account_link text not null default '',
  deposit numeric(14,2) not null check (deposit >= 0),
  withdrawal numeric(14,2) not null check (withdrawal >= 0),
  blogger numeric(14,2) not null check (blogger >= 0),
  deleted_at timestamptz,
  synced_at timestamptz not null default now(),
  unique(device_id,local_order_id)
);
create index if not exists peak_operations_created_idx on public.peak_operations(created_at desc);
alter table public.peak_admins enable row level security;
alter table public.peak_operations enable row level security;
revoke all on public.peak_admins from anon,authenticated;
revoke all on public.peak_operations from anon;
grant select on public.peak_operations to authenticated;
create policy "Admin reads operations" on public.peak_operations
 for select to authenticated
 using (exists(select 1 from public.peak_admins a where a.user_id=(select auth.uid())));
-- No browser/client write access. Writes must go through a server endpoint
-- authenticating each registered device and enforcing ownership + rate limits.
-- Never expose Supabase service_role credentials in the desktop app or website.
