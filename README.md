# Teylon

Tea collection & payment tracking for the Sri Lankan up-country tea trade. A Glide Ceylon product.
Mobile-first **PWA** (Next.js + React + TypeScript) on **Supabase** (Postgres, Auth, RLS, Edge Functions).

> Scaffolded starter — M0 foundation + the start of M1 (collection screen). Built but **not yet run/tested**;
> follow the setup below to install and start. See `teylon-build-spec.md` and the product plan for the full design.

## Prerequisites
- Node 18+ and npm
- A free Supabase project (https://supabase.com)

## Setup

```bash
# 1. install dependencies
npm install

# 2. configure environment
cp .env.local.example .env.local
#   then fill NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
#   from Supabase → Project Settings → API

# 3. create the database
#   In Supabase → SQL Editor, run, in order:
#     supabase/migrations/0001_init.sql
#     supabase/migrations/0002_rls.sql

# 4. (for login) enable Phone auth in Supabase → Authentication → Providers,
#    and connect an SMS provider (e.g. Twilio).

# 5. run
npm run dev
#   open http://localhost:3000
```

## What's here so far
- `app/page.tsx` — landing
- `app/login/page.tsx` — phone OTP sign-in (needs SMS provider)
- `app/collect/page.tsx` — the M1 core: per-plucker weights + running total (local demo; wire to Edge Function next)
- `supabase/migrations/0001_init.sql` — full schema (money in integer cents)
- `supabase/migrations/0002_rls.sql` — Row-Level Security (owner/agent walls; factory ledger private)
- `lib/` — Supabase client + money helpers

## Next steps (from the build spec)
1. **Edge Function `record_collection`** — turn the collect screen's submit into real visit + lines, notify owner.
2. **`/feed`** (owner) — mandatory confirm / escalate.
3. Worker pay summary, driver cash reconciliation, deductions, monthly settlement.

See `teylon-build-spec.md` for the schema, Edge Function logic, screens, and CEO-demo milestone order.

## Icons
Add `public/icon-192.png` and `public/icon-512.png` for the installable PWA (any Teylon logo works).
