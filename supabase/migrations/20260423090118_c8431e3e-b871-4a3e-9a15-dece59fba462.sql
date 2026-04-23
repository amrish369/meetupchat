-- Waitlist for landing page signups
create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  referral_source text,
  created_at timestamptz not null default now()
);
alter table public.waitlist enable row level security;

-- Anyone can join the waitlist
create policy "Anyone can join waitlist"
  on public.waitlist for insert
  to anon, authenticated
  with check (true);

-- Reports filed by users during chat
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_session text not null,
  reported_session text not null,
  reason text not null,
  details text,
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;

create policy "Anyone can submit reports"
  on public.reports for insert
  to anon, authenticated
  with check (true);

-- Banned sessions (auto-ban after N reports — handled later)
create table public.bans (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique,
  reason text,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);
alter table public.bans enable row level security;

create policy "Anyone can read bans for self-check"
  on public.bans for select
  to anon, authenticated
  using (true);

-- Helpful index
create index reports_reported_session_idx on public.reports(reported_session);