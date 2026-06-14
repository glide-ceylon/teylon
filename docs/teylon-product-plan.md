# Teylon — Tea Collection & Payment Tracking — Product Plan (v1)

*Name: **Teylon** (Tea + Ceylon). Premium, unmistakably tea-market, and sits beside the parent brand **Glide Ceylon**. Positioned as the on-the-ground tea-collection + ledger layer of the Glide Ceylon portfolio, feeding Spicett's existing tea-dealer network.*

*Sri Lanka up-country tea trade. Complete standalone backup — captures the full brain-dump and every decision made on 15 Jun 2026.*

---

## 0. Background & context (the real-world setup)

- A **field owner** (the founder's father) owns a **~24-acre tea field**.
- **Pluckers (workers)** pick the tea leaves. Paid **per kg** (roughly **Rs.40/kg**, varies field to field). Some owners also give **lunch** (optional) and a **bonus** (optional, owner's choice).
- After picking, a **lorry comes to collect**. The lorry belongs to an **agent** — a **separate organisation** that runs **multiple lorries** to many fields. The agent is the central commercial relationship.
- The **agent also supplies** fertilizer, government items, and side-business goods to owners. Those costs are **deducted** from what the agent pays the owner.
- The **agent decides which factory** each load goes to. **The factory has no direct relationship with the field owner.** The factory pays the **agent**; the agent pays the **owner**.
- Owners are paid one of two ways: **instant (right-away) payment**, or **month-end average** for regular clients (depends on what the factory paid the agent over the month).
- Goal: a system to track all of this across many owners and many agents, with QR identity to speed up collection, expandable to factories later.

---

## 1. The idea in one line

A neutral platform that tracks tea collection and payments across the chain — **field owners, pluckers, drivers, and lorry agents** — using QR identity for speed, where **either side can use it alone** and the data links up when both are on it. **You are the house** — the network everyone plugs into.

---

## 2. Who it's for (two-sided, each side stands alone)

- A **field owner** can sign up solo to manage his own account without his agent buying in.
- An **agent** can run his whole collection without every owner being a user.
- When **both** are on, their records link and it gets more powerful.

---

## 3. The players & how money flows

```
   PLUCKERS                FIELD OWNER             AGENT (separate org)          FACTORY
   (workers)               (e.g. the dad)          (multi-lorry, employs driver)
      │                         │                         │                         │
      ▼                         ▼                         ▼                         ▼
  weighed at lorry  ──▶  field submitted total  ──▶  agent submits load  ──▶  factory accepts
  (per plucker)          (sum of plucker kg)         to a factory             (accepted kg)

  PAYMENT: Factory ──▶ Agent ──(minus deductions)──▶ Field owner ──▶ Pluckers
                       (driver carries the cash on the ground)
```

- The **field owner's only counterparty is the agent.**
- The **agent owns the factory relationships**; factory pays the agent. What the factory pays is the **agent's private margin** — the owner only sees the rate the agent pays him.

---

## 4. Two core concepts

### A. Three weights (don't have to match)
1. **Per-plucker kg** (at the lorry) → worker pay; sums to →
2. **Field submitted total** → what the agent owes the owner.
3. **Factory-accepted kg** (agent→factory) → agent's earnings; **all losses sit on the agent.**

Worker and owner are paid on the **lorry weight** (1 & 2). The factory leg (3) is the agent's separate world.

### B. Two ledgers
- **Owner ↔ Agent** — transparent to both.
- **Agent ↔ Factory** — agent-only, private (Phase 2 to digitize).

---

## 5. Identity & QR

- **QR-first collection.** Owners + drivers have QR ids. Driver scans owner QR → enters per-plucker weights → done.
- **Three ways to collect:** scan QR / search / create a "shadow" owner on the spot (never block the lorry).
- **Shadow profiles + optional claim.** Agent logs against a placeholder; owner can later **claim** via **phone + SMS OTP** (claim = 1.1, never required).
- **Identity key = phone number** (dedup).
- **Worker profiles** created by owner or agent.

---

## 6. Payment logic

- **Worker pay = area floor, overridable upward only** (~Rs.40/kg) + optional lunch + optional bonus. `kg × rate (+ lunch/bonus)`.
- **Owner payment — two modes:** *instant* (paid on the spot, agent eats loss) or *monthly* (month-end average, loss can leak in).
- **Deductions:** fertilizer, govt, side-business, and cash advances — a per-owner running tab, drawn down at settlement.
- **Loss — factual in data, experimental in formula.** Always record submitted vs accepted kg (= real loss %). Month-end average = `f(daily factory rates, total submitted, loss adjustment)` where loss adjustment is a **soft, agent-set dial** (default 0, monthly clients only).
- **Driver cash (daily reconciliation):** driver (agent's employee, account created by agent, has lorry id) takes a float, pays out during collection, brings back the rest; reconcile `float − paid out − brought back = 0`, flag shortfalls.
- **Driver pays a plucker directly (on owner's behalf):** record the money trail, not trust. Booked as pass-through — *agent paid owner* + *owner paid worker* — cash drawn from driver float. Each payout stores **charged-to** (always the owner for worker pay) and **disbursed-by** (owner or driver).
- **Money movement: v1 = track only.** Records + balances; cash/transfer happens outside, marked paid. Automatic payouts later (legal/compliance).

---

## 7. Data model

`orgs, profiles(role: owner/agent/driver/worker/factory), fields, workers, drivers, driver_cash_days, collection_visits, collection_lines, factory_submissions(private), deductions, payments(charged_to/disbursed_by), settlements`. Full SQL in `supabase/migrations/0001_init.sql`.

---

## 8. Screens

**Agent/Driver:** scan/find owner · collection entry (per-plucker lines) · confirm & send · my collections · deductions · owner balances · drivers (create) · daily cash · factory submissions (Phase 2).

**Owner:** my fields & workers · collections feed (mandatory confirm + escalate) · worker payments · what I'm owed · deductions · claim (1.1).

Both are **online-first**; offline is a fallback (lorry record wins on conflict, owner notified).

---

## 9. Roadmap

- **MVP:** identity + QR, driver accounts + cash, collection + mandatory confirm/escalate, worker pay, deductions + pass-through, instant/monthly tracking, monthly average with loss dial, capture submitted-vs-accepted, online-first, many-agents↔owner.
- **1.1:** claim (phone+OTP); refinements.
- **Phase 2:** full agent↔factory leg; factory logins; loss analytics.
- **Phase 3:** automated payouts; Bluetooth scale; reputation/financing.

---

## 10. Key decisions (v1)

1. Claim → deferred to 1.1.
2. Loss → soft, agent-decided dial (data still captured).
3. Owner confirmation → mandatory, with escalation.
4. Many agents ↔ owner (owner-driven).
5. Online-first; lorry wins on conflict; notify owner.

---

## 11. Tech stack & cost

- **Frontend:** Next.js (React) + TypeScript, mobile-first **PWA** (web-first, not native; native deferred). QR via `html5-qrcode` + `qrcode`. Supabase JS + TanStack Query. Web Push + SMS backup. Hosted on **Vercel (free)**.
- **Backend:** **Supabase** — Postgres, RLS (owner/agent/factory walls), Edge Functions (money math, replayable), Auth (phone OTP), Realtime, Storage.
- **Cost:** Supabase free tier ($0) covers early stage; ~$25/mo Pro removes the 7-day inactivity pause. SMS (Twilio) is the only small recurring cost (claim, 1.1). Owner is fine paying a little to keep it live.

---

## 12. Name

**Teylon** (Tea + Ceylon). Pitch: *"Spicett connects spice and tea dealers; Teylon is the on-the-ground collection + ledger layer that feeds it — the missing groundwork under Glide Ceylon's tea ambitions."*

---

## 13. Role names (multilingual)

| key | English | Sinhala | Tamil |
|---|---|---|---|
| field_owner | Field Owner | වතු හිමියා (watu himiya) | தோட்ட உரிமையாளர் (thotta urimaiyalar) |
| plucker | Plucker | දළු නෙළන්නා (dalu nelanna) | கொழுந்து பறிப்பவர் (kozhunthu parippavar) |
| agent | Agent / Collector | දළු එකතු කරන්නා (dalu ekathu karanna) | சேகரிப்பாளர் (sekarippalar) |
| driver | Driver | රියදුරු (riyaduru) | ஓட்டுநர் (ottunar) |
| factory | Factory | තේ කර්මාන්තශාලාව (te karmanthashalawa) | தேயிலை தொழிற்சாலை (theyilai tholirchalai) |

Each user sees their role in their own language; store one canonical English key. (Native-speaker review recommended.)
