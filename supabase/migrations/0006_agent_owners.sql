-- Teylon: explicit agent <-> owner link (many-to-many).
-- A self-registered owner has no org_id (they can be served by several agents).
-- An agent "adopts" an owner by scanning their QR, creating a shadow owner, or
-- recording a collection. This link is what makes an owner show in the agent's
-- owner lists (settlement, deductions, owners) without leaking unrelated owners.

create table if not exists agent_owners (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  owner_id uuid not null references profiles(id),
  created_at timestamptz default now(),
  unique (org_id, owner_id)
);
create index if not exists idx_agent_owners_org on agent_owners(org_id);
create index if not exists idx_agent_owners_owner on agent_owners(owner_id);

alter table agent_owners enable row level security;

drop policy if exists agent_owners_org on agent_owners;
create policy agent_owners_org on agent_owners for all
  using (org_id = current_org_id()) with check (org_id = current_org_id());

-- Let an agent/driver read the profile of any owner their org has adopted,
-- even if that owner isn't an org member (org_id is null).
drop policy if exists profiles_agent_owner_read on profiles;
create policy profiles_agent_owner_read on profiles for select
  using (
    exists (
      select 1 from agent_owners ao
      where ao.owner_id = profiles.id and ao.org_id = current_org_id()
    )
  );
