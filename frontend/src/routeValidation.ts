import { minor } from "./cards";
export type RouteSnapshot = {
  id: string;
  nickname: string;
  issuer: string;
  card_name: string;
  last_four: string;
  status: string;
};
export type RouteResult = {
  valid: boolean;
  source_card: RouteSnapshot & { available_credit: string };
  destination_card: RouteSnapshot & { outstanding_balance: string };
  amount: string;
  reason_codes: string[];
  failures: { code: string; message: string }[];
  checks: { code: string; passed: boolean | null; message: string }[];
};
export function decimalAmount(paise: bigint) {
  return `${paise / 100n}.${String(paise % 100n).padStart(2, "0")}`;
}
export function quickAmount(outstanding: string, percentage: 25 | 50) {
  const paise = minor(outstanding);
  return paise === null
    ? ""
    : decimalAmount((paise * BigInt(percentage) + 50n) / 100n);
}
