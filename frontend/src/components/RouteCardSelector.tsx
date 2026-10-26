import { type Card, money, dueDate } from "../cards";
export default function RouteCardSelector({
  kind,
  cards,
  value,
  otherId,
  onChange,
}: {
  kind: "source" | "destination";
  cards: Card[];
  value: string;
  otherId: string;
  onChange: (id: string) => void;
}) {
  const card = cards.find((c) => c.id === value && c.status === "ACTIVE");
  const source = kind === "source";
  const id = "route-" + kind;
  return (
    <div className={"route-selector " + kind}>
      <label htmlFor={id}>
        <span className="route-step">{source ? "01" : "02"}</span>
        {source ? "FROM CARD" : "TO CARD"}
      </label>
      <select
        aria-label={source ? "FROM CARD" : "TO CARD"}
        id={id}
        value={card?.id || ""}
        onChange={(e) => onChange(e.target.value)}
        required
      >
        <option value="">
          {source ? "Choose your source card" : "Choose your destination card"}
        </option>
        {cards.map((c) => (
          <option
            value={c.id}
            key={c.id}
            disabled={c.status !== "ACTIVE" || c.id === otherId}
          >
            {c.nickname} · {c.issuer_name} {c.card_name} · •••• {c.last_four} ·{" "}
            {source
              ? "Available " +
                money(c.available_credit) +
                " / Outstanding " +
                money(c.outstanding_balance)
              : "Outstanding " +
                money(c.outstanding_balance) +
                " / Min due " +
                money(c.minimum_due) +
                " / " +
                dueDate(c.due_date)}{" "}
            · {c.status}
            {c.id === otherId ? " · Already selected" : ""}
          </option>
        ))}
      </select>
      {card ? (
        <div className="route-selected-card">
          <div className="route-selected-identity">
            <div>
              <h3>{card.nickname}</h3>
              <p>
                {card.issuer_name} · {card.card_name}
              </p>
            </div>
            <span className="card-status active">{card.status}</span>
          </div>
          <div className="route-selected-balance">
            <span className="masked">•••• {card.last_four}</span>
            <div>
              <span>{source ? "Available Credit" : "Outstanding"}</span>
              <strong>
                {money(
                  source ? card.available_credit : card.outstanding_balance,
                )}
              </strong>
            </div>
          </div>
          <div className="route-selected-meta">
            {source ? (
              <span>
                Outstanding <strong>{money(card.outstanding_balance)}</strong>
              </span>
            ) : (
              <>
                <span>
                  Minimum Due <strong>{money(card.minimum_due)}</strong>
                </span>
                <span>
                  Due <strong>{dueDate(card.due_date)}</strong>
                </span>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="route-select-hint">
          {source
            ? "Choose the credit facility you want to use."
            : "Choose the card obligation you want to handle."}
        </div>
      )}
    </div>
  );
}
