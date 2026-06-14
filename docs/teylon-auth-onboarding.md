# Teylon — Auth, Registration & Onboarding (exact spec)

This removes ambiguity around how people get into the app. **Follow this exactly.**

## Core principle: no passwords, no email. Phone + OTP only.

There is **no separate "register" page**. With phone OTP, the first time a phone number signs in,
Supabase Auth creates the auth user automatically. "Registration" = **first OTP login + onboarding**.
Do **not** build email/password signup, social login, or a username field.

---

## The one login flow (everyone)

```
/login
  → enter phone (E.164, e.g. +9477xxxxxxx)
  → Supabase sends SMS OTP
  → enter 6-digit code → verifyOtp
  → POST-LOGIN ROUTER decides where to go (below)
```

### Post-login router (runs after every successful OTP verify)

```
Does a profile row already exist for this phone?
│
├─ YES, and it has no linked auth user yet  → LINK it to this auth user (set profiles.id),
│        clear is_shadow. Role is already set (e.g. agent-created driver, or a pre-created owner).
│        → go straight to /home.
│
├─ YES, already linked  → returning user → /home.
│
└─ NO profile at all  → brand-new user → /onboarding.
```

> **Account linking by phone (v1):** this single rule handles two cases at once —
> (a) a **driver** whose account an agent created, and (b) a **pre-created/shadow owner** whose
> phone an agent entered. They just log in and land on their account. (The richer "claim" UX —
> searching and confirming historical records — is the 1.1 feature; the basic phone-link is v1.)

---

## /onboarding (only for brand-new phones)

Ask **role** first. **Only two self-serve roles:** Owner and Agent.
(Drivers are always created by an agent — a driver never self-registers. Workers never log in in v1.
Factory is Phase 2.)

### If they pick **Owner**
1. Enter full name.
2. Create `profiles` row: role='owner', phone, full_name, generate `qr_code`, is_shadow=false.
3. Offer (optional, skippable) "Add your first field" → name, rate/kg, lunch, bonus.
4. → /home (owner dashboard).

### If they pick **Agent**
1. Enter full name + **organisation name**.
2. Create `orgs` row, then `profiles` row: role='agent', org_id=new org, phone, full_name, qr_code.
3. → /home (agent dashboard). From there the agent can create drivers (`/drivers/new`).

---

## How each role's account is actually created (summary)

| Role | How the account is created | Logs in? |
|---|---|---|
| **Owner** | Self-registers (onboarding) **OR** created as a shadow by an agent, later linked on first login | Yes (phone OTP) |
| **Agent** | Self-registers + creates an org | Yes (phone OTP) |
| **Driver** | **Created by the agent** at `/drivers/new` (name, phone, lorry id). Driver then logs in with that phone → auto-linked | Yes (phone OTP) |
| **Worker (plucker)** | Created by owner or agent. **No login in v1** — pure record. Claimable in 1.1 | No (v1) |
| **Factory** | Phase 2 | Phase 2 |

---

## Shadow owners (created during collection)

When an agent collects from a new owner, they create a shadow owner on the spot
(`/owners/new`): name + phone, is_shadow=true, no auth user. Collections log against it immediately.
If that owner later logs in with the same phone, the post-login router links them (above).
**No blocking, ever** — the agent keeps working whether or not the owner ever logs in.

---

## Session, logout, guards
- Supabase manages the session (JWT, refresh). Use `supabase.auth.getSession()`.
- **Logout** lives in `/account`.
- **Route guards:** middleware redirects unauthenticated users to `/login`. Each role route-group
  layout checks `profiles.role` and redirects if the role doesn't match. RLS is the real backstop.
- A user with no profile (mid-onboarding) is allowed only on `/onboarding`.

---

## Scope guardrails — do NOT build these in v1 (avoid scope creep)
- ❌ Email/password or social login (phone OTP only).
- ❌ The full **claim** experience (searching + confirming historical records) — that's **1.1**. The basic phone-link on login IS in v1.
- ❌ **Worker login / worker self-registration** — workers are records only in v1.
- ❌ **Factory** accounts/screens — **Phase 2**.
- ❌ **Automatic payouts / money movement** — v1 tracks and marks paid only; rails are **Phase 3**.
- ❌ Deep offline sync — v1 is online-first with a light queue only.
