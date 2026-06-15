-- Teylon money model v2 (2026-06-15):
-- TWO rates — worker wage (~Rs.40/kg, fields.rate_per_kg_cents, unchanged) and
-- TEA rate (agent->owner, ~Rs.120/kg, new). Plus crew payouts, per-owner pay
-- mode default, and owner-fronted worker pay (reimbursed at settlement).

-- ── Tea rate ─────────────────────────────────────────────────────────────
-- Agent-wide default, optional per-field override, applied (+ audited) per visit.
alter table orgs   add column if not exists default_tea_rate_cents int not null default 0;
alter table fields add column if not exists tea_rate_cents int;            -- per-field override (optional)

alter table collection_visits add column if not exists tea_rate_cents int; -- applied tea rate (audit)
alter table collection_visits add column if not exists tea_rate_overridden_by uuid references profiles(id);
alter table collection_visits add column if not exists pay_mode text
  check (pay_mode in ('instant','monthly'));                              -- chosen for this collection

-- ── Per-owner pay-mode default (driver prefills from this, may override) ──
alter table profiles add column if not exists pay_mode text not null default 'monthly'
  check (pay_mode in ('instant','monthly'));

-- ── Payments: classify + owner-fronted flag + worker payee ──────────────
alter table payments add column if not exists from_pocket boolean not null default false;
alter table payments add column if not exists category text;  -- 'worker' | 'advance' | 'tea' | 'crew'
alter table payments add column if not exists worker_id uuid references workers(id);

-- ── Settlement: show owner-fronted reimbursements as their own line ──────
alter table settlements add column if not exists reimbursements_cents int not null default 0;

-- ── Crew payouts (loaders + lorry driver), paid from the driver's float ──
create table if not exists crew_payouts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  driver_id uuid references drivers(id),
  driver_cash_day_id uuid references driver_cash_days(id),
  day date not null default current_date,
  name text not null,
  role text,                          -- 'loader' | 'lorry_driver' | other
  amount_cents int not null,
  note text,
  created_at timestamptz default now()
);
create index if not exists idx_crew_org on crew_payouts(org_id);
create index if not exists idx_crew_cash_day on crew_payouts(driver_cash_day_id);

alter table crew_payouts enable row level security;
drop policy if exists crew_org on crew_payouts;
create policy crew_org on crew_payouts for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());
