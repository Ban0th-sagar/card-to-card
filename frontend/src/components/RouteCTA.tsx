import { Link } from "react-router-dom";
import { ArrowUpRight, Route as RouteIcon } from "lucide-react";
import { useResource } from "../hooks/useResource";
import { type Card } from "../cards";
export default function RouteCTA() {
  const { data, loading, error } = useResource<Card[]>("/cards");
  const ready = data && data.filter((c) => c.status === "ACTIVE").length >= 2;
  return (
    <section className="dashboard-route-cta">
      <span className="note-icon">
        <RouteIcon size={22} />
      </span>
      <div>
        <h2>Pay Another Card</h2>
        <p>
          {loading
            ? "Checking your active cards…"
            : error
              ? "Open Pay / Route to check your cards."
              : ready
                ? "Select two cards and check your request. No money moves."
                : "You need at least two active cards before creating a card-to-card route."}
        </p>
      </div>
      <Link className="button" to={ready || error ? "/route" : "/cards/new"}>
        {ready || error ? "Pay Another Card" : "Add Card"}
        <ArrowUpRight size={16} />
      </Link>
    </section>
  );
}
