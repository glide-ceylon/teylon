-- Teylon Row-Level Security
-- Walls: owners see only their own data; agents/drivers see their org;
-- factory_submissions are never visible to owners.

-- Helper: current user's org_id from their profile
create or replace function current_org_id()
returns uuid language sql stable security definer as $$
  select org_id from profiles where id = auth.uid()
$$;

create or replace function current_user_role()
returns text language sql stable security definer as $$
  select role from profiles where id = auth.uid()
$$;

alter table orgs enable row level security;
alter table profiles enable row level security;
alter table fields enable row level security;
alter table workers enable row level security;
alter table drivers enable row level security;
alter table driver_cash_days enable row level security;
alter table collection_visits enable row level security;
alter table collection_lines enable row level security;
alter table factory_submissions enable row level security;
alter table deductions enable row level security;
alter table payments enable row level security;
alter table settlements enable row level security;

-- PROFILES: a user can read themselves; org members read their org's profiles
create policy profiles_self_read on profiles for select
  using (id = auth.uid() or org_id = current_org_id());
create policy profiles_self_update on profiles for update
  using (id = auth.uid());

-- FIELDS: owner reads/writes own; org (agent/driver) can read
create policy fields_owner on fields for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy fields_org_read on fields for select
  using (current_user_role() in ('agent','driver'));

-- WORKERS: owner of the field, or org members
create policy workers_owner on workers for all
  using (exists (select 1 from fields f where f.id = workers.field_id and f.owner_id = auth.uid()))
  with check (true);
create policy workers_org_read on workers for select
  using (current_user_role() in ('agent','driver'));

-- COLLECTION VISITS: org sees its own; owner sees their own; owner may confirm/escalate
create policy visits_org on collection_visits for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());
create policy visits_owner_read on collection_visits for select
  using (owner_id = auth.uid());
create policy visits_owner_confirm on collection_visits for update
  using (owner_id = auth.uid());

-- COLLECTION LINES: follow the visit
create policy lines_via_visit on collection_lines for all
  using (exists (select 1 from collection_visits v where v.id = collection_lines.visit_id
    and (v.org_id = current_org_id() or v.owner_id = auth.uid())))
  with check (exists (select 1 from collection_visits v where v.id = collection_lines.visit_id
    and v.org_id = current_org_id()));

-- DRIVERS / CASH: org only
create policy drivers_org on drivers for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());
create policy cash_org on driver_cash_days for all
  using (exists (select 1 from drivers d where d.id = driver_cash_days.driver_id and d.org_id = current_org_id()))
  with check (true);

-- DEDUCTIONS: org writes; owner reads own
create policy deductions_org on deductions for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());
create policy deductions_owner_read on deductions for select
  using (owner_id = auth.uid());

-- PAYMENTS: org writes; owner/worker read where involved
create policy payments_org on payments for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());
create policy payments_party_read on payments for select
  using (charged_to = auth.uid() or payee_id = auth.uid());

-- SETTLEMENTS: org writes; owner reads own
create policy settlements_org on settlements for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());
create policy settlements_owner_read on settlements for select
  using (owner_id = auth.uid());

-- FACTORY SUBMISSIONS: org ONLY. Owners never see this (the private margin wall).
create policy factory_org_only on factory_submissions for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());
