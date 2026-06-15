-- Teylon: vehicles as separate entities, soft-linked to drivers.
-- A driver is a person; the vehicle they drive can change day to day. The
-- driver scans a vehicle's QR (or picks it) to set their "current" vehicle.
-- Idempotent where practical.

create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  identifier text not null,            -- plate / lorry name, e.g. "WP-1234"
  details text,                        -- e.g. "White Isuzu truck"
  created_at timestamptz default now()
);

create index if not exists idx_vehicles_org on vehicles(org_id);

-- Drivers: vehicle is no longer baked in. Keep the old column nullable for
-- backward compatibility, and add the soft "current vehicle" link.
alter table drivers alter column lorry_identifier drop not null;
alter table drivers add column if not exists current_vehicle_id uuid references vehicles(id);

-- Stamp the vehicle used onto each collection for history.
alter table collection_visits add column if not exists vehicle_id uuid references vehicles(id);

-- Per-day log of which lorry the driver drove (one row per driver per day).
alter table driver_cash_days add column if not exists vehicle_id uuid references vehicles(id);

-- RLS: vehicles belong to an org; agents manage, drivers read.
alter table vehicles enable row level security;

drop policy if exists vehicles_org on vehicles;
create policy vehicles_org on vehicles for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());

-- Let a driver update their OWN driver row (to set current_vehicle_id) without
-- being able to touch other drivers in the org.
drop policy if exists drivers_self_update on drivers;
create policy drivers_self_update on drivers for update
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
