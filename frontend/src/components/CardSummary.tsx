import { Link } from "react-router-dom";
import { ArrowUpRight, CreditCard, Plus } from "lucide-react";
import { type Card, money, percent, dueDate, utilizationLabel } from "../cards";
export function Utilization({ value }: { value: string }) {
  return (
    <div className="utilization">
      <div>
        <span>
          Utilization <strong>{percent(value)}</strong>
        </span>
        <small>{utilizationLabel(value)}</small>
      </div>
      <div
        role="meter"
        aria-label="Credit utilization"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Number(value)}
        className="utilization-track"
      >
        <span style={{ width: Math.min(100, Number(value)) + "%" }} />
      </div>
    </div>
  );
}
export function CardSummary({ card }: { card: Card }) {
  return (
    <article className="credit-card">
      <div className="credit-card-face">
        <div className="credit-face-top">
          <span>{card.issuer_name}</span>
          <span className={"card-status " + card.status.toLowerCase()}>
            {card.status}
          </span>
        </div>
        <h3>{card.nickname}</h3>
        <p>{card.card_name}</p>
        <div className="credit-face-bottom">
          <span className="masked">•••• {card.last_four}</span>
          <span>{card.network}</span>
        </div>
      </div>
      <div className="credit-card-info">
        <dl className="card-amounts">
          <div>
            <dt>Credit Limit</dt>
            <dd>{money(card.credit_limit)}</dd>
          </div>
          <div>
            <dt>Outstanding</dt>
            <dd>{money(card.outstanding_balance)}</dd>
          </div>
          <div>
            <dt>Available Credit</dt>
            <dd>{money(card.available_credit)}</dd>
          </div>
        </dl>
        <Utilization value={card.utilization_percentage} />
        <div className="card-due">
          <div>
            <span>Minimum Due</span>
            <strong>{money(card.minimum_due)}</strong>
          </div>
          <div>
            <span>Due Date</span>
            <strong>{dueDate(card.due_date)}</strong>
          </div>
        </div>
        {card.status === "ACTIVE" && (
          <Link
            className="card-source-link"
            to={"/route?source=" + encodeURIComponent(card.id)}
          >
            Use as Source <ArrowUpRight size={14} />
          </Link>
        )}
        <Link className="card-details-link" to={"/cards/" + card.id}>
          View Details <ArrowUpRight size={16} />
        </Link>
      </div>
    </article>
  );
}
export function EmptyCards() {
  return (
    <div className="empty-state">
      <div className="empty-card-icon">
        <CreditCard size={31} />
        <span>
          <Plus size={13} />
        </span>
      </div>
      <h2>No cards added yet.</h2>
      <p>
        Add your first card to bring your credit picture together.
        <br />
        Only the last four digits and card metadata are needed.
      </p>
      <Link className="button" to="/cards/new">
        <Plus size={17} /> Add Your First Card
      </Link>
    </div>
  );
}
export function ResourceState({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: string;
  retry: () => void;
}) {
  return loading ? (
    <div className="resource-loading" role="status">
      Loading your cards…
    </div>
  ) : error ? (
    <div className="message error" role="alert">
      {error}{" "}
      <button className="secondary-button" onClick={retry}>
        Try Again
      </button>
    </div>
  ) : null;
}
