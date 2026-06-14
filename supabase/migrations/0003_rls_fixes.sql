-- Teylon RLS fixes — missing INSERT/SELECT policies for client-side onboarding.
-- Edge Functions use the service role and bypass RLS, so only the rows that the
-- browser inserts directly need these. Idempotent: safe to re-run.

-- PROFILES: a user may create their OWN profile row during onboarding.
drop policy if exists profiles_self_insert on profiles;
create policy profiles_self_insert on profiles for insert
  with check (id = auth.uid());

-- ORGS: an authenticated user may create an org (agent onboarding);
-- members may read their own org. (No org membership exists yet at the moment
-- of creation, so insert is gated only on being authenticated.)
drop policy if exists orgs_insert on orgs;
create policy orgs_insert on orgs for insert
  with check (auth.uid() is not null);

drop policy if exists orgs_member_read on orgs;
create policy orgs_member_read on orgs for select
  using (id = current_org_id());

-- Allow an agent to rename their own org later (optional, harmless for v1).
drop policy if exists orgs_member_update on orgs;
create policy orgs_member_update on orgs for update
  using (id = current_org_id()) with check (id = current_org_id());
