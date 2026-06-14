# Teylon — Sitemap & Routing (one app, role-gated)

**One app. Everyone logs into the same Teylon PWA.** After login, the user's `profiles.role`
(`owner | agent | driver | worker | factory`) decides their home, their bottom-nav, and which
routes they can reach. Drivers are employees of an agent's org; agents can do everything a driver
can plus org management.

---

## Entry & routing flow

```
/login  ──(phone OTP)──▶  has profile?
                              │
                  no ────────▶ /onboarding  (pick role; agent creates/joins org; owner adds first field)
                              │
                  yes ───────▶ /  ──(redirect by role)──▶  /home   (role-aware dashboard)
```

- `/` is a **role-aware redirect** — never a page itself. Reads the session + profile, sends owners/agents/drivers to their `/home`.
- **Route protection:** Next.js middleware checks the Supabase session; a server layout per role-group checks `role` and 404s/redirects if mismatched. RLS in Postgres is the real security backstop.

---

## Recommended folder structure (Next.js App Router route groups)

```
app/
  login/                     ✅ exists
  onboarding/                ⬜ pick role / org / first field
  (shared)/
    home/                    ⬜ role-aware dashboard (renders owner|agent|driver view)
    account/                 ⬜ profile, language (EN/SI/TA), logout
    account/qr/              ⬜ my QR code (owner & driver)
    notifications/           ⬜ alerts: confirms, escalations, cash flags
  (owner)/
    feed/                    ⬜ collections to confirm / escalate   ← core owner screen
    feed/[visitId]/          ⬜ visit detail + Confirm / Escalate
    fields/                  ⬜ my fields list
    fields/new/              ⬜ add field (rate ≥ floor, lunch, bonus)
    fields/[id]/             ⬜ edit field + its workers
    workers/                 ⬜ my pluckers
    workers/new/             ⬜ add plucker
    workers/[id]/            ⬜ worker detail: pay owed, mark paid
    balance/                 ⬜ what the agent owes me (instant log / monthly estimate)
    deductions/              ⬜ what's been charged to me (read-only)
    payments/                ⬜ payment history (to workers, from agent)
    claim/                   ⬜ (1.1) claim records an agent created
  (agent)/
    collect/                 ✅ exists (UI) — scan/find owner → per-plucker lines  (shared w/ driver)
    collections/             ⬜ visits list (today / history)
    collections/[id]/        ⬜ visit detail
    owners/                  ⬜ owners list
    owners/new/              ⬜ create shadow owner on the spot
    owners/[id]/             ⬜ owner balance, history, instant vs monthly
    deductions/              ⬜ deductions list
    deductions/new/          ⬜ log fertilizer / govt / side-biz / advance
    drivers/                 ⬜ drivers list
    drivers/new/             ⬜ create driver + lorry identifier
    cash/                    ⬜ cash overview across drivers
    cash/[driverId]/         ⬜ a driver's day: float, paid-out, brought-back, reconcile
    settlements/             ⬜ monthly settlements list
    settlements/new/         ⬜ run settlement (period + soft loss dial)
    settlements/[id]/        ⬜ settlement breakdown (auditable)
    factory/                 ⬜ (Phase 2) factory submissions, submitted vs accepted, loss
  (driver)/
    today/                   ⬜ driver home: today's route + cash float status
    cash/                    ⬜ my cash day (float / paid-out / brought-back / reconcile)
    # driver reuses (agent)/collect and /collections for the collection flow
```

✅ = scaffolded · ⬜ = to build

---

## Bottom navigation (per role)

- **Owner:** Home · **Confirm** (`/feed`) · Fields · Balance · Account
- **Agent:** Home · **Collect** · Owners · Cash · More (drivers, deductions, settlements, factory)
- **Driver:** Home (`/today`) · **Collect** · Cash · Account

`/home` renders the right dashboard by role:
- **Owner home:** pending confirmations count, what I'm owed this month, recent visits.
- **Agent home:** today's collections + total kg, owner balances summary, cash status, alerts.
- **Driver home:** today's stops, current cash float, quick "New collection".

---

## Access matrix (who can reach what)

| Area | Owner | Agent | Driver |
|---|---|---|---|
| `/feed`, `/fields`, `/workers`, `/balance` | ✅ | — | — |
| `/collect`, `/collections` | — | ✅ | ✅ |
| `/owners`, `/deductions/new`, `/settlements`, `/drivers` | — | ✅ | — |
| `/cash` (own day) | — | ✅ (all drivers) | ✅ (own only) |
| `/factory` (Phase 2) | — | ✅ | — |
| `/home`, `/account`, `/notifications` | ✅ | ✅ | ✅ |
| `/account/qr` | ✅ | — | ✅ |

(Backed by Postgres RLS — see `supabase/migrations/0002_rls.sql`.)

---

## Multi-device / responsive (phone AND PC)

One responsive web app serves every device — no separate desktop build. Per role:

- **Driver → phone-first.** Used at the lorry. Centered mobile container, bottom nav, big touch targets, QR camera. Desktop just shows the same centered mobile layout.
- **Agent & Owner → fully responsive.** They use both phone and PC.
  - **Phone (`< md`):** stacked cards, bottom tab nav, mobile container.
  - **Desktop (`≥ md`/`lg`):** **left sidebar nav** (replaces bottom nav), **multi-column dashboards**, and **real tables** for the data-heavy screens — owner balances, settlements, cash reconciliation, deductions, collections history. Use the wide screen; don't just stretch the phone layout.
- **Auth/onboarding** screens: centered mobile-width card on all devices.

Implementation: the root layout imposes **no width lock**. Build a `(driver)`/auth shell that centers to `max-w-md`, and an `(agent)`/`(owner)` shell that is `max-w-md` + bottom-nav on mobile but switches to a sidebar + fluid content at `md:`/`lg:` via Tailwind breakpoints. Tables collapse to cards on mobile.

---

## Build priority (matches the milestones)

1. **M1:** `/onboarding`, `/home` (role-aware), wire `/collect` → `record_collection`, owner `/feed` + `/feed/[id]` confirm/escalate, `/account/qr` (generate) + scan in `/collect`.
2. **M2:** `/workers/[id]` pay, agent `/cash` + `/cash/[driverId]`, `/drivers` + `/drivers/new`.
3. **M3:** `/deductions` (both sides), `/settlements/*`, owner `/balance`.
4. **M4:** `/factory` data capture, `/notifications`, `/claim` (1.1), PWA install + offline queue.
