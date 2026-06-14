# Teylon — context for Claude Code

Teylon is a tea collection & payment tracking app for the Sri Lankan up-country tea trade — a Glide Ceylon product. Read these two docs first; they contain the full product design and the technical build plan:

- `docs/teylon-product-plan.md` — the complete product plan (players, money rules, decisions, naming).
- `docs/teylon-build-spec.md` — the build-ready spec (stack, schema, RLS, Edge Functions, screens, milestones, CEO-demo script).
- `docs/teylon-sitemap.md` — the full page/route map. **One app, role-gated** — owner, agent, and driver all log into the same PWA; `profiles.role` drives home, nav, and route access. Use the folder structure (Next.js route groups) and access matrix there as the source of truth for which pages to build.
- `docs/teylon-auth-onboarding.md` — **exact** auth/registration/onboarding spec. Phone+OTP only (no email/password). "Registration" = first OTP login + onboarding. Read this before building login/onboarding/role flows. It also has a **scope guardrails** list of what NOT to build in v1 — respect it.

## Stack
Next.js (App Router) + React + TypeScript, **responsive PWA**, Tailwind. Backend: **Supabase** (Postgres, Auth phone-OTP, RLS, Edge Functions, Realtime, Storage). Hosted on Vercel. Money is stored as **integer cents of LKR** everywhere.

## Responsive / multi-device (important)
One app serves phone AND PC. **Driver** = phone-first (centered mobile container, bottom nav, QR camera). **Agent & Owner** = fully responsive: mobile shows stacked cards + bottom nav; **desktop (`md:`/`lg:`) shows a left sidebar + multi-column dashboards + real tables** for balances, settlements, cash, deductions. The root layout has **no width lock** — build per-role-group shells (see `docs/teylon-sitemap.md` → "Multi-device / responsive"). Don't just stretch the phone layout on desktop.

## Current status (what exists)
This repo is a **scaffold only — not yet run or wired to the database.** Built so far:
- Configs: `package.json`, `tsconfig.json`, `next.config.js`, Tailwind/PostCSS, `.env.local.example`.
- `lib/supabaseClient.ts`, `lib/money.ts`.
- Screens: `app/page.tsx` (landing), `app/login/page.tsx` (phone OTP), `app/collect/page.tsx` (collection entry — **local demo only, not saving to DB yet**).
- DB: `supabase/migrations/0001_init.sql` (schema) + `0002_rls.sql` (RLS). **Not yet run in Supabase.**

## What is NOT built yet (the rest of v1)
Owner `/feed` (confirm/escalate), worker pay, driver `/cash` reconciliation, deductions, monthly settlement, QR scan/generate wiring, notifications, and ALL Edge Functions. None of the money logic is wired up.

## Setup before building
1. Create a Supabase project. Run `supabase/migrations/0001_init.sql` then `0002_rls.sql` in the SQL editor.
2. Copy `.env.local.example` → `.env.local`, fill `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. `npm install` then `npm run dev` to confirm the scaffold runs.

## Build order (do this next — follow the milestones in the build spec)
1. **M1 (the CEO-demo core loop):** Edge Function `record_collection`; wire `app/collect` submit to it; build owner `/feed` to confirm/escalate; QR generate + scan.
2. **M2:** worker pay summary; driver `/cash` float + reconcile; `record_payment` with the driver-pays-on-behalf pass-through.
3. **M3:** deductions; `compute_settlement` (monthly average with the soft loss dial); owner `/balance`.
4. **M4:** capture submitted-vs-accepted kg (loss data), escalation polish, PWA install + offline queue, seed the father's real field.

Keep all money math in Edge Functions + Postgres, stored as records (auditable, replayable). Amounts in integer cents.
