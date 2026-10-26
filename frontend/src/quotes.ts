import type { RouteResult } from "./routeValidation";
export type QuoteRequest = {
  source_card_id: string;
  destination_card_id: string;
  amount: string;
};
export type Quote = Omit<RouteResult, "valid"> & {
  quote_id?: string;
  route_type: "CARD_TO_CARD";
  eligible: boolean;
  status?: "ACTIVE" | "EXPIRED" | "INVALIDATED";
  fee_percentage?: string;
  fee_amount?: string;
  tax_amount?: string;
  total_source_impact?: string;
  destination_payment_amount?: string;
  currency: "INR";
  expires_at?: string;
  server_time: string;
  preview_source_available?: string;
  preview_destination_outstanding?: string;
  demo_limit: string;
  simulation_only: boolean;
};
export function requestFromQuote(q: Quote): QuoteRequest {
  return {
    source_card_id: q.source_card.id,
    destination_card_id: q.destination_card.id,
    amount: q.amount,
  };
}
