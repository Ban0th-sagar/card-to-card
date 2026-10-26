import { useEffect, useRef, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  Clock3,
  RefreshCw,
  ArrowDown,
  ShieldCheck,
  Route as RouteIcon,
} from "lucide-react";
import { api } from "../api";
import { money } from "../cards";
import { type Quote, type QuoteRequest, requestFromQuote } from "../quotes";
export default function RouteOptions() {
  const [params] = useSearchParams();
  const quoteId = params.get("quote");
  const location = useLocation();
  const navigate = useNavigate();
  const initial = location.state?.analysis as Quote | undefined;
  const [quote, setQuote] = useState<Quote | null>(initial || null);
  const [loading, setLoading] = useState(Boolean(quoteId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [, setTick] = useState(0);
  const anchor = useRef({
    server: initial ? Date.parse(initial.server_time) : Date.now(),
    monotonic: performance.now(),
  });
  const action = useRef(0);
  const request = quote
    ? requestFromQuote(quote)
    : (location.state?.request as QuoteRequest | undefined);
  function accept(q: Quote) {
    anchor.current = {
      server: Date.parse(q.server_time),
      monotonic: performance.now(),
    };
    setQuote(q);
    setTick((n) => n + 1);
  }
  useEffect(() => {
    let active = true;
    setError("");
    if (quoteId) {
      setLoading(true);
      api<Quote>("/routes/quotes/" + encodeURIComponent(quoteId))
        .then((q) => {
          if (active) accept(q);
        })
        .catch((e) => {
          if (active) {
            setQuote(null);
            setError(e.message);
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    } else {
      const current = location.state?.analysis as Quote | undefined;
      if (current) accept(current);
      else setQuote(null);
      setLoading(false);
    }
    return () => {
      active = false;
      action.current++;
    };
  }, [quoteId, location.key]);
  useEffect(() => {
    const timer = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  // Use server time plus monotonic elapsed time; backend GET still authorizes continuation.
  const serverNow =
    anchor.current.server + (performance.now() - anchor.current.monotonic);
  const seconds = quote?.expires_at
    ? Math.max(0, Math.ceil((Date.parse(quote.expires_at) - serverNow) / 1000))
    : 0;
  const expired = Boolean(
    quote?.expires_at && (seconds === 0 || quote.status === "EXPIRED"),
  );
  const eligible = Boolean(
    quote?.eligible && quote.status === "ACTIVE" && !expired,
  );
  const checks =
    quote?.checks.map((c) =>
      c.code === "QUOTE_NOT_EXPIRED" ? { ...c, passed: !expired } : c,
    ) || [];
  const countdown =
    String(Math.floor(seconds / 60)).padStart(2, "0") +
    ":" +
    String(seconds % 60).padStart(2, "0");
  async function refresh() {
    if (!request) return;
    const version = ++action.current;
    setBusy(true);
    setError("");
    try {
      if (quote?.quote_id) await api<Quote>("/routes/quotes/" + quote.quote_id);
      const next = await api<Quote>("/routes/quote", {
        method: "POST",
        body: JSON.stringify(request),
      });
      if (version === action.current) {
        accept(next);
        navigate(
          next.quote_id
            ? "/route-options?quote=" + next.quote_id
            : "/route-options",
          { replace: true, state: { analysis: next, request } },
        );
      }
    } catch (e) {
      if (version === action.current) setError((e as Error).message);
    } finally {
      if (version === action.current) setBusy(false);
    }
  }
  async function proceed() {
    if (!quote?.quote_id || !eligible) return;
    const version = ++action.current;
    setBusy(true);
    setError("");
    try {
      const current = await api<Quote>("/routes/quotes/" + quote.quote_id);
      if (version === action.current) {
        accept(current);
        if (
          current.eligible &&
          current.status === "ACTIVE" &&
          Date.parse(current.expires_at!) > Date.parse(current.server_time)
        )
          navigate("/payment", { state: { quoteId: current.quote_id } });
      }
    } catch (e) {
      if (version === action.current) {
        setQuote(null);
        setError((e as Error).message);
      }
    } finally {
      if (version === action.current) setBusy(false);
    }
  }
  return (
    <main className="page quote-page">
      <Link className="back-link" to="/route">
        <ArrowLeft size={15} /> Change Request
      </Link>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR ROUTE ANALYSIS</div>
          <h1>
            Card-to-Card Route<span className="mint">.</span>
          </h1>
          <p>Understand the estimated cost before you go further.</p>
        </div>
        <span className="status-pill">Simulation eligibility only</span>
      </div>
      {loading && (
        <div className="resource-loading" role="status">
          Checking your quote…
        </div>
      )}
      {error && (
        <div className="message error" role="alert">
          {error}
        </div>
      )}
      {!loading && !quote && !error && (
        <section className="placeholder">
          <span className="note-icon">
            <RouteIcon size={28} />
          </span>
          <h2>Start with a checked request.</h2>
          <p>
            Select two active cards and validate an amount before requesting
            route options.
          </p>
          <Link className="button" to="/route">
            Check a Request <ArrowRight size={16} />
          </Link>
        </section>
      )}
      {!loading && quote && (
        <>
          <section
            className={"quote-banner " + (eligible ? "eligible" : "ineligible")}
          >
            <span className="quote-banner-icon">
              {eligible ? <Check size={24} /> : <X size={24} />}
            </span>
            <div>
              <div className="eyebrow">CARD-TO-CARD ROUTE</div>
              <h2 aria-live="polite">
                {expired
                  ? "QUOTE EXPIRED"
                  : quote.status === "INVALIDATED"
                    ? "QUOTE INVALIDATED"
                    : eligible
                      ? "ELIGIBLE"
                      : "NOT ELIGIBLE"}
              </h2>
              <p>
                {expired
                  ? "Request another quote to continue."
                  : eligible
                    ? "Your simulated route meets the current eligibility checks."
                    : "Review the explanation below or change your request."}
              </p>
            </div>
            {quote.expires_at && (
              <div className="quote-timer">
                <Clock3 size={16} />
                <div>
                  <span>Quote expires in</span>
                  <strong aria-label="Quote countdown">{countdown}</strong>
                </div>
              </div>
            )}
          </section>
          <div className="quote-layout">
            <div>
              <section className="quote-pair">
                <div>
                  <span className="eyebrow">FROM</span>
                  <h3>{quote.source_card.nickname}</h3>
                  <p>
                    {quote.source_card.issuer} · {quote.source_card.card_name}
                  </p>
                  <span className="masked">
                    •••• {quote.source_card.last_four}
                  </span>
                </div>
                <ArrowDown size={21} />
                <div>
                  <span className="eyebrow">TO</span>
                  <h3>{quote.destination_card.nickname}</h3>
                  <p>
                    {quote.destination_card.issuer} ·{" "}
                    {quote.destination_card.card_name}
                  </p>
                  <span className="masked">
                    •••• {quote.destination_card.last_four}
                  </span>
                </div>
              </section>
              {!eligible && !expired && (
                <section className="quote-failures">
                  {quote.reason_codes.includes("EXCEEDS_ROUTE_LIMIT") && (
                    <>
                      <h3>ROUTE LIMIT EXCEEDED</h3>
                      <p>
                        Maximum current Card-to-Card route:{" "}
                        <strong>{money(quote.demo_limit)}</strong>
                      </p>
                    </>
                  )}
                  {quote.reason_codes.includes(
                    "INSUFFICIENT_CREDIT_AFTER_FEES",
                  ) && <h3>INSUFFICIENT CREDIT AFTER FEES</h3>}
                  {quote.failures.map((f) => (
                    <p key={f.code}>{f.message}</p>
                  ))}
                </section>
              )}
              {eligible && quote.preview_source_available !== undefined && (
                <section className="quote-previews">
                  <div className="section-heading">
                    <h2>ESTIMATED BALANCE PREVIEW</h2>
                    <span>Not applied</span>
                  </div>
                  <div>
                    <span>Source Available Credit</span>
                    <p>
                      <span>{money(quote.source_card.available_credit)}</span>
                      <ArrowRight size={15} />
                      <strong>{money(quote.preview_source_available)}</strong>
                    </p>
                    <small>After Estimated Transaction</small>
                  </div>
                  <div>
                    <span>Destination Outstanding</span>
                    <p>
                      <span>
                        {money(quote.destination_card.outstanding_balance)}
                      </span>
                      <ArrowRight size={15} />
                      <strong>
                        {money(quote.preview_destination_outstanding!)}
                      </strong>
                    </p>
                    <small>After Estimated Payment</small>
                  </div>
                  <p className="preview-only-note">
                    Preview only. Your stored card balances remain unchanged.
                  </p>
                </section>
              )}
              <section className="quote-checklist">
                <div className="section-heading">
                  <h2>ELIGIBILITY CHECKS</h2>
                </div>
                <ul className="route-checks">
                  {checks.map((c) => (
                    <li key={c.code} className={c.passed ? "passed" : "failed"}>
                      {c.passed ? <Check size={15} /> : <X size={15} />}
                      <span>{c.message}</span>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="why-route">
                <ShieldCheck size={21} />
                <div>
                  <h2>WHY THIS ROUTE?</h2>
                  <p>
                    {eligible
                      ? "CardRoute found this simulated Card-to-Card route eligible based on your selected cards, available credit, destination outstanding, route limits and estimated fee."
                      : "Only eligible, current simulation quotes can continue."}
                  </p>
                  <span>
                    Simulation eligibility only. No real provider is connected.
                  </span>
                </div>
              </section>
            </div>
            <aside className="quote-cost">
              <div className="section-heading">
                <h2>YOUR ESTIMATE</h2>
                <span>INR</span>
              </div>
              <dl>
                {[
                  ["Transfer Amount", money(quote.amount)],
                  [
                    "Estimated Fee",
                    quote.fee_amount === undefined
                      ? "Not quoted"
                      : money(quote.fee_amount),
                  ],
                  [
                    "Tax",
                    quote.tax_amount === undefined
                      ? "Not quoted"
                      : money(quote.tax_amount),
                  ],
                  [
                    "Total Source Impact",
                    quote.total_source_impact === undefined
                      ? "Not quoted"
                      : money(quote.total_source_impact),
                  ],
                  [
                    "Destination Payment",
                    quote.destination_payment_amount === undefined
                      ? "Not quoted"
                      : money(quote.destination_payment_amount),
                  ],
                ].map(([label, value]) => (
                  <div key={label} data-testid={label}>
                    <dt>
                      {label}
                      {label === "Estimated Fee" &&
                        quote.fee_percentage !== undefined && (
                          <small>{quote.fee_percentage}% simulation fee</small>
                        )}
                    </dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              {!eligible && (
                <div className="current-availability">
                  <span>Current Available at Quote</span>
                  <strong>{money(quote.source_card.available_credit)}</strong>
                </div>
              )}
              {quote.quote_id && (
                <button
                  className="button full"
                  disabled={!eligible || busy || loading}
                  onClick={proceed}
                >
                  {busy ? "Checking…" : "Continue to Payment"}{" "}
                  <ArrowRight size={16} />
                </button>
              )}
              {(!eligible || expired) && request && (
                <button
                  className="secondary-button full"
                  disabled={busy}
                  onClick={refresh}
                >
                  <RefreshCw size={15} />
                  {busy ? "Refreshing…" : "Refresh Quote"}
                </button>
              )}
              {!eligible && (
                <Link className="text-button" to="/route">
                  Change Request <ArrowRight size={15} />
                </Link>
              )}
              <p className="quote-cost-note">
                An estimate for simulation only. Continuing opens the Step 5
                placeholder; it does not execute a payment.
              </p>
            </aside>
          </div>
        </>
      )}
    </main>
  );
}
