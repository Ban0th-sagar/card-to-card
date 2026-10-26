import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowDownUp,
  ArrowRight,
  Plus,
  Route as RouteIcon,
} from "lucide-react";
import { api } from "../api";
import { type Card, minor } from "../cards";
import { type RouteResult, quickAmount } from "../routeValidation";
import { useResource } from "../hooks/useResource";
import { ResourceState } from "../components/CardSummary";
import RouteCardSelector from "../components/RouteCardSelector";
import ValidationResult from "../components/RouteResult";
export default function PayRoute() {
  const [params] = useSearchParams();
  const {
    data: cards,
    loading,
    error: loadError,
    retry,
  } = useResource<Card[]>("/cards");
  const [sourceId, setSourceId] = useState(params.get("source") || "");
  const [destinationId, setDestinationId] = useState("");
  const [amount, setAmount] = useState("");
  const [quick, setQuick] = useState("Custom");
  const [result, setResult] = useState<RouteResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sequence = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const amountInput = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(
    () => () => {
      sequence.current++;
      pending.current?.abort();
    },
    [],
  );
  const active = cards?.filter((c) => c.status === "ACTIVE") || [];
  const source = active.find((c) => c.id === sourceId);
  const destination = active.find((c) => c.id === destinationId);
  function invalidate() {
    sequence.current++;
    pending.current?.abort();
    pending.current = null;
    setBusy(false);
    setResult(null);
    setError("");
  }
  function chooseSource(id: string) {
    invalidate();
    setSourceId(id);
  }
  function chooseDestination(id: string) {
    invalidate();
    setDestinationId(id);
    setQuick("Custom");
  }
  function swap() {
    invalidate();
    setSourceId(destinationId);
    setDestinationId(sourceId);
    setQuick("Custom");
  }
  function chooseQuick(label: string) {
    if (!destination) return;
    invalidate();
    setQuick(label);
    setAmount(
      label === "Minimum Due"
        ? destination.minimum_due
        : label === "25% of Outstanding"
          ? quickAmount(destination.outstanding_balance, 25)
          : label === "50% of Outstanding"
            ? quickAmount(destination.outstanding_balance, 50)
            : label === "Full Outstanding"
              ? destination.outstanding_balance
              : "",
    );
    if (label === "Custom") amountInput.current?.focus();
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    invalidate();
    if (!source || !destination) {
      setError("Choose an active source and destination card.");
      return;
    }
    if (source.id === destination.id) {
      setError("Source and destination cards must be different.");
      return;
    }
    const paise = minor(amount);
    if (paise === null || paise <= 0n) {
      setError(
        "Enter an amount greater than zero with no more than two decimal places.",
      );
      return;
    }
    const controller = new AbortController();
    pending.current = controller;
    const version = sequence.current;
    setBusy(true);
    try {
      const response = await api<RouteResult>("/card-route/validate", {
        method: "POST",
        body: JSON.stringify({
          source_card_id: source.id,
          destination_card_id: destination.id,
          amount,
        }),
        signal: controller.signal,
      });
      if (version === sequence.current) setResult(response);
    } catch (e) {
      if (version === sequence.current && (e as Error).name !== "AbortError")
        setError((e as Error).message);
    } finally {
      if (version === sequence.current) {
        setBusy(false);
        pending.current = null;
      }
    }
  }
  const usable = active.length >= 2;
  return (
    <main className="page route-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">A CLEARER PATH STARTS HERE</div>
          <h1>
            Pay Another Card<span className="mint">.</span>
          </h1>
          <p>
            Select the credit facility you want to use and the card obligation
            you want to handle.
          </p>
        </div>
        <span className="status-pill">
          <span className="live-dot" /> Request check only
        </span>
      </div>
      <ResourceState loading={loading} error={loadError} retry={retry} />
      {cards && !usable && (
        <section className="route-empty">
          <span className="empty-card-icon">
            <RouteIcon size={30} />
          </span>
          <h2>
            {cards.length === 0
              ? "Add your first card to get started."
              : active.length === 1
                ? "Add another card to create a card-to-card route."
                : "You need at least two active cards before creating a card-to-card route."}
          </h2>
          <p>
            {cards.length
              ? "Only ACTIVE cards can be used. You can manage card status from Cards."
              : "Bring your cards into one workspace, then check a request between two active cards."}
          </p>
          <Link className="button" to="/cards/new">
            <Plus size={17} /> Add Card
          </Link>
          {cards.length > 0 && (
            <Link className="text-button" to="/cards">
              Manage Cards <ArrowRight size={15} />
            </Link>
          )}
        </section>
      )}
      {cards && usable && (
        <div className="route-layout">
          <form ref={form} className="route-form" onSubmit={submit}>
            <div className="route-form-intro">
              <span>BUILD YOUR REQUEST</span>
              <small>01 — 03</small>
            </div>
            <RouteCardSelector
              kind="source"
              cards={cards}
              value={sourceId}
              otherId={destinationId}
              onChange={chooseSource}
            />
            <div className="route-connector">
              <span />
              <button
                type="button"
                className="swap-button"
                aria-label="Swap Cards"
                disabled={!source || !destination}
                onClick={swap}
              >
                <ArrowDownUp size={16} /> Swap
              </button>
              <span />
            </div>
            <RouteCardSelector
              kind="destination"
              cards={cards}
              value={destinationId}
              otherId={sourceId}
              onChange={chooseDestination}
            />
            <div className="route-arrow">
              <ArrowDown size={17} />
            </div>
            <div className="route-amount">
              <label htmlFor="route-amount">
                <span className="route-step">03</span>AMOUNT
              </label>
              <div className="route-currency">
                <span aria-hidden="true">₹</span>
                <input
                  aria-label="AMOUNT"
                  id="route-amount"
                  ref={amountInput}
                  value={amount}
                  onChange={(e) => {
                    invalidate();
                    setAmount(e.target.value);
                    setQuick("Custom");
                  }}
                  placeholder="0.00"
                  inputMode="decimal"
                  maxLength={15}
                  autoComplete="off"
                  aria-describedby="route-amount-help"
                />
              </div>
              <small id="route-amount-help">
                Enter a positive INR amount, with up to two decimal places.
              </small>
              <div className="quick-amounts" aria-label="Quick amount choices">
                {[
                  "Minimum Due",
                  "25% of Outstanding",
                  "50% of Outstanding",
                  "Full Outstanding",
                  "Custom",
                ].map((label) => (
                  <button
                    type="button"
                    key={label}
                    disabled={!destination}
                    aria-pressed={quick === label}
                    onClick={() => chooseQuick(label)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {error && (
              <div className="message error" role="alert">
                {error}
              </div>
            )}
            <button
              className="button full check-request"
              disabled={busy || !source || !destination}
            >
              {busy ? "Checking Request…" : "Check Request"}{" "}
              {!busy && <ArrowRight size={17} />}
            </button>
            <p className="route-form-note">
              This checks your request structure. It does not initiate a
              payment.
            </p>
          </form>
          <aside className="route-result-column">
            {result ? (
              <ValidationResult
                result={result}
                change={() => {
                  invalidate();
                  form.current?.scrollIntoView({
                    block: "start",
                    behavior: "smooth",
                  });
                  amountInput.current?.focus();
                }}
              />
            ) : (
              <section className="route-guide">
                <div className="route-guide-icon">
                  <RouteIcon size={28} />
                </div>
                <div className="eyebrow">UNDERSTAND BEFORE YOU CONTINUE</div>
                <h2>
                  Two cards.
                  <br />
                  One clear request.
                </h2>
                <p>
                  Choose a source, choose a destination, then check whether the
                  amount fits both cards.
                </p>
                <ol>
                  <li>
                    <span>01</span>
                    <div>
                      <strong>From your available credit</strong>
                      <p>The source needs enough available credit.</p>
                    </div>
                  </li>
                  <li>
                    <span>02</span>
                    <div>
                      <strong>Within your outstanding</strong>
                      <p>The amount cannot exceed the destination balance.</p>
                    </div>
                  </li>
                  <li>
                    <span>03</span>
                    <div>
                      <strong>A structural check</strong>
                      <p>
                        No money moves. Pricing and provider eligibility come in
                        Step 4.
                      </p>
                    </div>
                  </li>
                </ol>
                {busy && (
                  <div role="status" className="route-checking">
                    Checking current card data…
                  </div>
                )}
              </section>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
