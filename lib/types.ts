export type Role = "owner" | "agent" | "driver" | "worker" | "factory";

export interface Org {
  id: string;
  name: string;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  role: Role;
  org_id: string | null;
  qr_code: string | null;
  is_shadow: boolean;
  created_by: string | null;
  created_at: string;
}

export interface Field {
  id: string;
  owner_id: string;
  name: string;
  location: string | null;
  acreage: number | null;
  rate_per_kg_cents: number;
  lunch_allowance_cents: number;
  bonus_rule: Record<string, unknown> | null;
  created_at: string;
}

export interface Worker {
  id: string;
  profile_id: string | null;
  name: string;
  phone: string | null;
  field_id: string | null;
  owner_id: string | null;
  org_id: string | null;
  bonus_cents: number;
  qr_code: string | null;
  is_shadow: boolean;
  created_by: string | null;
  created_at: string;
}

export interface Driver {
  id: string;
  profile_id: string;
  org_id: string;
  lorry_identifier: string;
  vehicle_details: string | null;
  created_at: string;
}

export interface DriverCashDay {
  id: string;
  driver_id: string;
  day: string;
  float_out_cents: number;
  paid_out_cents: number;
  brought_back_cents: number | null;
  status: "open" | "reconciled" | "short" | "over";
  note: string | null;
  reconciled_at: string | null;
  created_at: string;
}

export interface CollectionVisit {
  id: string;
  org_id: string;
  driver_id: string | null;
  field_id: string;
  owner_id: string;
  collected_at: string;
  total_kg: number | null;
  note: string | null;
  status: "collected" | "priced" | "settled";
  owner_confirmed: boolean;
  confirmed_at: string | null;
  escalated: boolean;
  escalation_note: string | null;
  escalated_at: string | null;
  created_at: string;
}

export interface CollectionLine {
  id: string;
  visit_id: string;
  worker_id: string;
  kg: number;
  created_at: string;
}

export interface FactorySubmission {
  id: string;
  org_id: string;
  factory_id: string | null;
  submitted_kg: number;
  accepted_kg: number | null;
  factory_rate_cents: number | null;
  loss_pct: number | null;
  submitted_at: string;
}

export interface Deduction {
  id: string;
  owner_id: string;
  org_id: string;
  type: "fertilizer" | "government" | "side_business" | "advance";
  amount_cents: number;
  note: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  org_id: string | null;
  amount_cents: number;
  mode: "instant" | "monthly";
  weight_basis_kg: number | null;
  charged_to: string | null;
  payee_id: string | null;
  disbursed_by: string | null;
  driver_id: string | null;
  driver_cash_day_id: string | null;
  visit_id: string | null;
  note: string | null;
  status: "recorded" | "confirmed";
  paid_at: string;
}

export interface Settlement {
  id: string;
  org_id: string;
  owner_id: string;
  period_start: string;
  period_end: string;
  total_submitted_kg: number;
  avg_rate_cents: number;
  loss_adjustment_pct: number;
  gross_cents: number;
  deductions_cents: number;
  net_cents: number;
  computed_at: string;
}
