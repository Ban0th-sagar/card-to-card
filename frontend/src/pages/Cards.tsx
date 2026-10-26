import { Link, useLocation } from "react-router-dom";
import { Plus, ShieldCheck } from "lucide-react";
import { useResource } from "../hooks/useResource";
import { type Card } from "../cards";
import {
  CardSummary,
  EmptyCards,
  ResourceState,
} from "../components/CardSummary";
export default function Cards() {
  const { data, loading, error, retry } = useResource<Card[]>("/cards");
  const location = useLocation();
  return (
    <main className="page">
      <div className="page-heading cards-page-heading">
        <div>
          <div className="eyebrow">YOUR CREDIT, ORGANIZED</div>
          <h1>
            Your Cards<span className="mint">.</span>
          </h1>
          <p>Manage your credit cards in one place.</p>
        </div>
        <Link className="button" to="/cards/new">
          <Plus size={17} /> Add Card
        </Link>
      </div>
      {location.state?.message && (
        <div className="message success" role="status">
          {location.state.message}
        </div>
      )}
      <ResourceState loading={loading} error={error} retry={retry} />
      {data &&
        (data.length ? (
          <>
            <div className="collection-caption">
              <span>
                {data.length} {data.length === 1 ? "CARD" : "CARDS"} IN YOUR
                WORKSPACE
              </span>
              <span>YOUR PERSONAL OVERVIEW</span>
            </div>
            <div className="credit-grid">
              {data.map((card) => (
                <CardSummary key={card.id} card={card} />
              ))}
            </div>
          </>
        ) : (
          <section className="cards-section cards-empty">
            <EmptyCards />
          </section>
        ))}
      <div className="metadata-note">
        <ShieldCheck size={16} />
        <span>
          Only card metadata. Never your full card number, CVV or PIN.
        </span>
      </div>
    </main>
  );
}
