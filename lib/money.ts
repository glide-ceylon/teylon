// All money is stored as integer CENTS of LKR to avoid float errors.

export const toCents = (rupees: number): number => Math.round(rupees * 100);
export const fromCents = (cents: number): number => cents / 100;

export const formatLKR = (cents: number): string =>
  new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 2,
  }).format(cents / 100);
