import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { useResource } from "../hooks/useResource";
import { type Card, money, percent, dueDate } from "../cards";
import { api } from "../api";
import { Utilization, ResourceState } from "../components/CardSummary";
import ConfirmRemove from "../components/ConfirmRemove";
export default function CardDetails() {
  const { cardId } = useParams();
  const {
    data: card,
    loading,
    error,
    retry,
  } = useResource<Card>("/cards/" + cardId);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  async function remove() {
    setBusy(true);
    setRemoveError("");
    try {
      await api("/cards/" + cardId, { method: "DELETE" });
      navigate("/cards", {
        replace: true,
        state: { message: "Card removed." },
      });
    } catch (e) {
      setRemoveError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="page">
      <Link className="back-link" to="/cards">
        <ArrowLeft size={15} /> Back to Cards
      </Link>
      <ResourceState loading={loading} error={error} retry={retry} />
      {card && (
        <>
          <div className="page-heading">
            <div>
              <div className="eyebrow">CARD DETAILS</div>
              <h1>
                {card.nickname}
                <span className="mint">.</span>
              </h1>
              <p>Your credit picture, in detail.</p>
            </div>
            <span className={"card-status " + card.status.toLowerCase()}>
              {card.status}
            </span>
          </div>
          {location.state?.message && (
            <div className="message success" role="status">
              {location.state.message}
            </div>
          )}
          <div className="card-detail-layout">
            <section className="detail-identity">
              <div className="credit-card-face">
                <div className="credit-face-top">
                  <span>{card.issuer_name}</span>
                  <span>CARDROUTE</span>
                </div>
                <h2>{card.card_name}</h2>
                <div className="credit-face-bottom">
                  <span className="masked">•••• {card.last_four}</span>
                  <span>{card.network}</span>
                </div>
              </div>
              <div className="detail-identity-footer">
                <span>SELF-REPORTED CARD METADATA</span>
                <p>
                  Balances are entered manually and are not synced with your
                  issuer.
                </p>
              </div>
            </section>
            <section className="detail-financials">
              <div className="section-heading">
                <h2>YOUR CARD OVERVIEW</h2>
              </div>
              <dl className="detail-amounts">
                {[
                  ["Credit Limit", money(card.credit_limit)],
                  ["Outstanding", money(card.outstanding_balance)],
                  ["Available Credit", money(card.available_credit)],
                  ["Utilization", percent(card.utilization_percentage)],
                  ["Minimum Due", money(card.minimum_due)],
                  ["Due Date", dueDate(card.due_date)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <Utilization value={card.utilization_percentage} />
              <p className="form-helper">
                Utilization labels provide context only, not financial advice or
                credit-score guarantees.
              </p>
            </section>
          </div>
          <div className="card-detail-actions">
            <Link className="button" to={"/cards/" + card.id + "/edit"}>
              <Pencil size={16} /> Edit Card
            </Link>
            <button
              className="secondary-button remove-button"
              onClick={() => setConfirm(true)}
            >
              <Trash2 size={16} /> Remove Card
            </button>
          </div>
          {confirm && (
            <ConfirmRemove
              name={card.nickname}
              busy={busy}
              error={removeError}
              cancel={() => {
                setConfirm(false);
                setRemoveError("");
              }}
              confirm={remove}
            />
          )}
        </>
      )}
    </main>
  );
}
