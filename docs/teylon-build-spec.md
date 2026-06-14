# Teylon — Build-Ready Spec (for Claude Code)

*Hand this to Claude Code to start the build. Read alongside `teylon-product-plan.md` in this folder. Goal of v1: a working slice that impresses the Glide Ceylon CEO, then hardens into a real pilot on the founder's father's field.*

---

## 0. Stack (fixed)

- **Frontend:** Next.js (App Router) + React + TypeScript, mobile-first, **installable PWA**. Tailwind CSS for fast clean UI.
- **Backend:** Supabase — Postgres, Auth (phone OTP), Row-Level Security, Realtime, Edge Functions (Deno/TS), Storage.
- **QR:** `html5-qrcode` (scan) + `qrcode` (generate).
- **Data:** `@supabase/supabase-js` + TanStack Query. Service worker + IndexedDB for light offline queue.
- **Push:** Web Push (Android) + SMS (Twilio) as backup for critical alerts.
- **Hosting:** Vercel (free) + Supabase (free). Target cost: $0 early; ~$25/mo Supabase Pro when the pause/limits matter.

> NOTE: The starter scaffold already exists in this repo (package.json, configs, `lib/`, `app/page.tsx`, `app/login`, `app/collect`, and `supabase/migrations/0001_init.sql` + `0002_rls.sql`). Do NOT re-run create-next-app — continue from the existing files.

---

## 1. Roles & access

`profiles.role ∈ {owner, agent, driver, worker, factory}`. (worker/factory mostly records in v1.)
- **agent** — top of an org; creates drivers; sees own org's collections, owner balances, deductions, cash, and the private factory ledger.
- **driver** — employee of an agent; runs collection + daily cash.
- **owner** — sees only their own fields/workers/collections/balances/deductions; confirms collections.
- **worker** — a record (claimable later in 1.1).
- **factory** — Phase 2.

---

## 2. Database schema

Already written in `supabase/migrations/0001_init.sql` (schema) and `0002_rls.sql` (Row-Level Security). Money is stored as integer **cents of LKR**. Run both in the Supabase SQL editor (0001 then 0002).

Tables: `orgs, profiles, fields, workers, drivers, driver_cash_days, collection_visits, collection_lines, factory_submissions, deductions, payments, settlements`.

---

## 3. Row-Level Security (summary — full policies in 0002_rls.sql)

- **owner** reads only rows where they are `owner_id`; may update only `collection_visits.owner_confirmed/escalated` for their own visits.
- **agent/driver** read/insert rows where `org_id` = their org; drivers limited to their own cash + visits.
- **factory_submissions**: visible ONLY to org members (never owners) — the agent↔factory wall.
- Helpers `current_org_id()` / `current_role()` read from the user's profile.

---

## 4. Edge Functions (business logic — keep money math server-side & replayable)

1. **`record_collection`** — input: field/owner, array of `{worker_id|new_worker, kg}`. Creates visit + lines, sets `total_kg`, fires owner push/SMS "X kg recorded by [lorry] — confirm". Enforces `rate >= area_floor`.
2. **`confirm_collection`** — owner confirms or escalates. Sets flags. (Lorry record stands until resolved.)
3. **`record_payment`** — books a payment with `charged_to` + `disbursed_by`. If `disbursed_by = driver`, also (a) decrements that owner's agent-owed balance and (b) adds to the driver's `driver_cash_days.paid_out_cents`. Implements the **pass-through** (driver pays worker on owner's behalf = *agent paid owner* + *owner paid worker*).
4. **`reconcile_cash_day`** — at end of day: compute `paid_out`, take `brought_back`, set status `reconciled|short|over`, flag shortfalls.
5. **`compute_settlement`** — for a regular owner + period: roll up visits → `total_submitted_kg`, apply daily factory rates + the **agent-set `loss_adjustment_pct` dial** → `avg_rate_cents`; subtract deductions → `net_cents`. **Stores the result as a `settlements` row** (auditable, re-runnable). Dial defaults to 0.
6. **`worker_pay_summary`** — per field/period: per-worker `kg × rate (+ lunch/bonus)`.

All amounts in integer cents. Every function writes an audit trail (who/when).

---

## 5. Screens (web routes, role-gated)

**Shared:** `/login` (phone OTP — DONE), `/onboarding` (pick role / org).

**Agent / Driver:**
- `/collect` — scan owner QR → field; add a line per plucker; running total; submit. *(UI scaffolded — needs wiring to `record_collection`.)*
- `/collections` — today's visits + totals.
- `/owners/[id]` — balance (instant vs monthly), history.
- `/deductions/new` — log fertilizer/advance against an owner.
- `/drivers` *(agent)* — create driver + lorry identifier.
- `/cash` — float out, paid-out list, brought-back, reconcile.
- `/factory` *(agent, Phase 2)* — submissions, loss.

**Owner:**
- `/feed` — collections to **confirm** (mandatory) or **escalate**.
- `/fields` — manage fields (rate ≥ floor, lunch/bonus) + workers.
- `/workers/[id]` — pay owed, mark paid.
- `/balance` — what the agent owes me (instant log / monthly estimate).
- `/deductions` — what's been charged to me.

---

## 6. Milestones (CEO-demo first)

- **M0 — Setup:** scaffold + Supabase + schema + phone-OTP auth + deploy. *(Scaffold DONE; needs Supabase project + env + deploy.)*
- **M1 — Core loop (the demo):** QR generate for an owner; wire `/collect` to `record_collection`; owner gets notified and confirms in `/feed`. *Outcome: scan → enter weights → owner confirms, live.*
- **M2 — Pay + cash:** worker pay summary; driver `/cash` float + reconcile; `record_payment` with pass-through.
- **M3 — Settlement:** deductions; `compute_settlement` monthly average with loss dial; owner `/balance`.
- **M4 — Polish + pilot:** loss-data capture (submitted vs accepted), escalation flow, PWA install + offline queue, seed the father's real field.

**For the CEO meeting, M0–M1 (plus a seeded demo dataset) is enough to show the whole vision on a phone.**

---

## 7. CEO demo script (≈3 min)

1. Open the URL on a phone — show it installs to the home screen (looks like an app, $0 to run).
2. As the **driver**: scan an owner's QR → add three pluckers' weights → submit.
3. Switch to the **owner's** phone: the collection appears → tap **Confirm** (mandatory receipt — "the trust layer no notebook gives you").
4. Show the **owner balance** updating, and a **monthly settlement** with the loss dial — "the agent's margin stays private; the owner sees only his side."
5. Close: *"Teylon is the on-the-ground collection + ledger layer under Glide Ceylon — it feeds Spicett's existing tea-dealer network with clean, trusted supply data."*

---

## 8. Next build steps (continue from the scaffold)

1. Create the Supabase project; run `supabase/migrations/0001_init.sql` then `0002_rls.sql`; fill `.env.local`.
2. `npm install` then `npm run dev` to confirm the scaffold runs.
3. Build the `record_collection` + `confirm_collection` Edge Functions; wire `/collect` submit to it; build owner `/feed` → **M1**.
4. Continue per milestones (M2 → M4).

*Everything money-related lives in Edge Functions + Postgres, stored as records, so it's auditable and the loss dial is re-tunable. Keep amounts in integer cents throughout.*
