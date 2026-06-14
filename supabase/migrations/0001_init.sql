-- Teylon initial schema
-- Money stored as integer CENTS of LKR. Run in Supabase SQL editor or via CLI migration.

create extension if not exists "pgcrypto";

-- Orgs (an agent business)
create table if not exists orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- Profiles (extends auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null,
  phone text unique,
  role text not null check (role in ('owner','agent','driver','worker','factory')),
  org_id uuid references orgs(id),
  qr_code text unique,
  is_shadow boolean default false,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- Fields (owned by an owner)
create table if not exists fields (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id),
  name text not null,
  location text,
  acreage numeric,
  rate_per_kg_cents int not null,
  lunch_allowance_cents int default 0,
  bonus_rule jsonb,
  created_at timestamptz default now()
);

-- Workers (pluckers)
create table if not exists workers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id),
  name text not null,
  phone text,
  field_id uuid references fields(id),
  owner_id uuid references profiles(id),
  org_id uuid references orgs(id),
  bonus_cents int not null default 0,
  qr_code text unique,
  is_shadow boolean default true,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- Drivers (employee of an org)
create table if not exists drivers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id),
  org_id uuid not null references orgs(id),
  lorry_identifier text not null,
  vehicle_details text,
  created_at timestamptz default now()
);

-- Driver daily cash reconciliation
create table if not exists driver_cash_days (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references drivers(id),
  day date not null,
  float_out_cents int not null default 0,
  paid_out_cents int not null default 0,
  brought_back_cents int,
  status text not null default 'open' check (status in ('open','reconciled','short','over')),
  note text,
  reconciled_at timestamptz,
  created_at timestamptz default now(),
  unique (driver_id, day)
);

-- Collection visit (one lorry stop at one field)
create table if not exists collection_visits (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  driver_id uuid references drivers(id),
  field_id uuid not null references fields(id),
  owner_id uuid not null references profiles(id),
  collected_at timestamptz default now(),
  total_kg numeric,
  note text,
  status text not null default 'collected' check (status in ('collected','priced','settled')),
  owner_confirmed boolean default false,
  confirmed_at timestamptz,
  escalated boolean default false,
  escalation_note text,
  escalated_at timestamptz,
  created_at timestamptz default now()
);

-- One line per plucker in a visit
create table if not exists collection_lines (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references collection_visits(id) on delete cascade,
  worker_id uuid not null references workers(id),
  kg numeric not null,
  created_at timestamptz default now()
);

-- Agent <-> Factory leg (PRIVATE to org)
create table if not exists factory_submissions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  factory_id uuid references profiles(id),
  submitted_kg numeric not null,
  accepted_kg numeric,
  factory_rate_cents int,
  loss_pct numeric generated always as
    (case when submitted_kg > 0 and accepted_kg is not null
      then (submitted_kg - accepted_kg) / submitted_kg * 100 else null end) stored,
  submitted_at timestamptz default now()
);

-- Deductions against an owner
create table if not exists deductions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id),
  org_id uuid not null references orgs(id),
  type text not null check (type in ('fertilizer','government','side_business','advance')),
  amount_cents int not null,
  note text,
  created_at timestamptz default now()
);

-- Payments
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references orgs(id),
  amount_cents int not null,
  mode text not null check (mode in ('instant','monthly')),
  weight_basis_kg numeric,
  charged_to uuid references profiles(id),
  payee_id uuid references profiles(id),
  disbursed_by uuid references profiles(id),
  driver_id uuid references drivers(id),
  driver_cash_day_id uuid references driver_cash_days(id),
  visit_id uuid references collection_visits(id),
  note text,
  status text not null default 'recorded' check (status in ('recorded','confirmed')),
  paid_at timestamptz default now()
);

-- Monthly settlement
create table if not exists settlements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  owner_id uuid not null references profiles(id),
  period_start date not null,
  period_end date not null,
  total_submitted_kg numeric not null,
  avg_rate_cents int not null,
  loss_adjustment_pct numeric default 0,
  gross_cents int not null,
  deductions_cents int not null,
  net_cents int not null,
  computed_at timestamptz default now()
);

-- Helpful indexes
create index if not exists idx_visits_org on collection_visits(org_id);
create index if not exists idx_visits_owner on collection_visits(owner_id);
create index if not exists idx_lines_visit on collection_lines(visit_id);
create index if not exists idx_deductions_owner on deductions(owner_id);
create index if not exists idx_payments_charged_to on payments(charged_to);
