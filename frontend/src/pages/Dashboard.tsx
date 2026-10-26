import { Link } from "react-router-dom";
import {
  CreditCard,
  Layers,
  Activity,
  ShieldCheck,
  ArrowUpRight,
  CalendarDays,
} from "lucide-react";
import { useAuth } from "../auth";
import { useResource } from "../hooks/useResource";
import { type Summary, money, dueDate } from "../cards";
import {
  CardSummary,
  EmptyCards,
  ResourceState,
  Utilization,
} from "../components/CardSummary";
import RouteCTA from "../components/RouteCTA";
export default function Dashboard() {
  const { user } = useAuth();
  const { data, loading, error, retry } = useResource<Summary>("/dashboard");
  return (
    <main className="page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR FINANCIAL OVERVIEW</div>
          <h1>
            Hello, {user?.name}
            <span className="mint">.</span>
          </h1>
          <p>A clear view. A confident start.</p>
        </div>
        <span className="status-pill">
          <span className="live-dot" /> Personal workspace
        </span>
      </div>
      <ResourceState loading={loading} error={error} retry={retry} />
      {data && (
        <>
          <RouteCTA />
          <div className="summary-grid">
            {[
              ["Total Cards", String(data.total_cards), CreditCard],
              ["Total Credit Limit", money(data.total_credit_limit), Layers],
              ["Total Outstanding", money(data.total_outstanding), Activity],
              [
                "Total Available Credit",
                money(data.total_available_credit),
                ShieldCheck,
              ],
            ].map(([label, value, Icon]) => (
              <div
                className="summary-card"
                data-testid={String(label)}
                key={String(label)}
              >
                <div>
                  <span>{String(label)}</span>
                  <Icon size={18} />
                </div>
                <strong>{String(value)}</strong>
                <small>
                  {data.total_cards
                    ? "Across your cards"
                    : "Ready for your first card"}
                </small>
              </div>
            ))}
          </div>
          <div className="dashboard-insights">
            <section className="portfolio-panel">
              <div className="section-heading">
                <h2>PORTFOLIO UTILIZATION</h2>
                <Layers size={17} />
              </div>
              <Utilization value={data.portfolio_utilization} />
              <p>
                Combined outstanding as a share of your total credit limit.
                Context only, not financial advice.
              </p>
            </section>
            <section className="upcoming-panel">
              <div className="section-heading">
                <h2>UPCOMING DUE</h2>
                <CalendarDays size={17} />
              </div>
              {data.upcoming_due ? (
                <Link
                  className="upcoming-content"
                  to={"/cards/" + data.upcoming_due.id}
                >
                  <div>
                    <strong>{data.upcoming_due.nickname}</strong>
                    <span>
                      {data.upcoming_due.issuer_name} ·{" "}
                      {data.upcoming_due.card_name}
                    </span>
                    <small>•••• {data.upcoming_due.last_four}</small>
                  </div>
                  <div>
                    <strong>{money(data.upcoming_due.minimum_due)}</strong>
                    <span>Minimum Due</span>
                    <small>{dueDate(data.upcoming_due.due_date)}</small>
                  </div>
                </Link>
              ) : (
                <p className="no-upcoming">No upcoming payments.</p>
              )}
            </section>
          </div>
          <section className="cards-section dashboard-cards">
            <div className="section-heading">
              <h2>
                YOUR CARDS <span>{data.total_cards}</span>
              </h2>
              <Link to="/cards">
                View All Cards <ArrowUpRight size={13} />
              </Link>
            </div>
            {data.cards.length ? (
              <div className="credit-grid">
                {data.cards.map((card) => (
                  <CardSummary key={card.id} card={card} />
                ))}
              </div>
            ) : (
              <EmptyCards />
            )}
          </section>
        </>
      )}
    </main>
  );
}
