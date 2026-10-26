import QuoteContinuation from "./QuoteContinuation";
import {
  Check,
  Minus,
  X,
  ArrowDown,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { type RouteResult as Result } from "../routeValidation";
import { money } from "../cards";
export default function RouteResult({
  result,
  change,
}: {
  result: Result;
  change: () => void;
}) {
  return (
    <section
      className={"route-result " + (result.valid ? "valid" : "invalid")}
      aria-labelledby="route-result-title"
    >
      <div className="route-result-heading" role="status">
        <span className="route-result-icon">
          {result.valid ? <Check size={23} /> : <X size={23} />}
        </span>
        <div>
          <span className="eyebrow">STRUCTURAL CHECK COMPLETE</span>
          <h2 id="route-result-title">
            {result.valid ? "REQUEST VALID" : "REQUEST CANNOT CONTINUE"}
          </h2>
        </div>
      </div>
      {!result.valid && (
        <ul className="route-failures">
          {result.failures.map((f) => (
            <li key={f.code} data-reason-code={f.code}>
              <strong>{f.message}</strong>
            </li>
          ))}
        </ul>
      )}
      <div className="validated-pair">
        <div>
          <span className="eyebrow">FROM</span>
          <h3>{result.source_card.nickname}</h3>
          <p>
            {result.source_card.issuer} · {result.source_card.card_name}
          </p>
          <span className="masked">•••• {result.source_card.last_four}</span>
          <small>
            Available Credit{" "}
            <strong>{money(result.source_card.available_credit)}</strong>
          </small>
        </div>
        <ArrowDown size={18} />
        <div>
          <span className="eyebrow">TO</span>
          <h3>{result.destination_card.nickname}</h3>
          <p>
            {result.destination_card.issuer} ·{" "}
            {result.destination_card.card_name}
          </p>
          <span className="masked">
            •••• {result.destination_card.last_four}
          </span>
          <small>
            Outstanding{" "}
            <strong>
              {money(result.destination_card.outstanding_balance)}
            </strong>
          </small>
        </div>
      </div>
      <div className="validated-amount">
        <span>Amount</span>
        <strong>{money(result.amount)}</strong>
      </div>
      <ul className="route-checks">
        {result.checks.map((c) => (
          <li
            key={c.code}
            className={
              c.passed === true
                ? "passed"
                : c.passed === false
                  ? "failed"
                  : "not-evaluated"
            }
          >
            {c.passed === true ? (
              <Check size={15} />
            ) : c.passed === false ? (
              <X size={15} />
            ) : (
              <Minus size={15} />
            )}
            <span>
              {c.message}
              {c.passed === null && (
                <small>Not evaluated: enter a valid amount first.</small>
              )}
            </span>
            <span className="sr-only">
              {c.passed === true
                ? "Passed"
                : c.passed === false
                  ? "Failed"
                  : "Not evaluated"}
            </span>
          </li>
        ))}
      </ul>
      {result.valid ? (
        <>
          <QuoteContinuation
            request={{
              source_card_id: result.source_card.id,
              destination_card_id: result.destination_card.id,
              amount: result.amount,
            }}
          />
          <p className="route-result-note">
            <ShieldCheck size={14} /> Structure checked only. No funds are moved
            or reserved.
          </p>
        </>
      ) : (
        <button className="secondary-button full" onClick={change}>
          Change Request
        </button>
      )}
    </section>
  );
}
