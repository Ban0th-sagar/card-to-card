export const networks = [
  "Visa",
  "Mastercard",
  "RuPay",
  "American Express",
  "Other",
] as const;
export const statuses = ["ACTIVE", "INACTIVE", "BLOCKED"] as const;
export type Card = {
  card_to_card_source_enabled: boolean;
  card_to_card_destination_enabled: boolean;
  id: string;
  nickname: string;
  issuer_name: string;
  card_name: string;
  network: (typeof networks)[number];
  last_four: string;
  credit_limit: string;
  outstanding_balance: string;
  available_credit: string;
  minimum_due: string;
  utilization_percentage: string;
  due_date: string;
  status: (typeof statuses)[number];
  created_at: string;
  updated_at: string;
};
export type CardValues = Pick<
  Card,
  | "card_to_card_source_enabled"
  | "card_to_card_destination_enabled"
  | "nickname"
  | "issuer_name"
  | "card_name"
  | "network"
  | "last_four"
  | "credit_limit"
  | "outstanding_balance"
  | "minimum_due"
  | "due_date"
  | "status"
>;
export type Summary = {
  total_cards: number;
  total_credit_limit: string;
  total_outstanding: string;
  total_available_credit: string;
  portfolio_utilization: string;
  cards: Card[];
  upcoming_due: Card | null;
};
export function minor(value: string): bigint | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const [whole, decimal = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt(decimal.padEnd(2, "0"));
}
export function money(value: string) {
  const amount = minor(value);
  if (amount === null) return "—";
  const fraction = amount % 100n;
  return (
    "₹" +
    new Intl.NumberFormat("en-IN").format(amount / 100n) +
    (fraction ? "." + String(fraction).padStart(2, "0") : "")
  );
}
export function percent(value: string) {
  return (
    Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 }) + "%"
  );
}
export function utilizationLabel(value: string) {
  const n = Number(value);
  return n <= 30
    ? "Low"
    : n <= 50
      ? "Moderate"
      : n <= 75
        ? "High"
        : "Very High";
}
export function dueDate(value: string) {
  return new Date(value + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
export function preview(limit: string, outstanding: string) {
  const l = minor(limit),
    o = minor(outstanding);
  if (l === null || o === null || l <= 0n || o > l) return null;
  const available = l - o;
  const ratio = (o * 10000n + l / 2n) / l;
  return {
    available: `${available / 100n}.${String(available % 100n).padStart(2, "0")}`,
    utilization: `${ratio / 100n}.${String(ratio % 100n).padStart(2, "0")}`,
  };
}
