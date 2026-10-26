import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { api } from "../api";
import {
  type Card,
  type CardValues,
  networks,
  statuses,
  minor,
  preview,
  money,
  percent,
} from "../cards";
const defaults: CardValues = {
  card_to_card_source_enabled: true,
  card_to_card_destination_enabled: true,
  nickname: "",
  issuer_name: "",
  card_name: "",
  network: "Visa",
  last_four: "",
  credit_limit: "100000",
  outstanding_balance: "10000",
  minimum_due: "2000",
  due_date: "",
  status: "ACTIVE",
};
export default function CardForm({ initial }: { initial?: Card }) {
  const [values, setValues] = useState<CardValues>(
    initial
      ? (Object.fromEntries(
          Object.keys(defaults).map((key) => [
            key,
            initial[key as keyof CardValues],
          ]),
        ) as CardValues)
      : defaults,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const calculation = preview(values.credit_limit, values.outstanding_balance);
  function change(key: keyof CardValues, value: string | boolean) {
    setValues((v) => ({ ...v, [key]: value }));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const limit = minor(values.credit_limit),
      outstanding = minor(values.outstanding_balance),
      minimum = minor(values.minimum_due);
    if (limit === null || outstanding === null || minimum === null) {
      setError("Enter valid amounts with no more than two decimal places.");
      return;
    }
    if (limit <= 0n) {
      setError("Credit limit must be greater than zero.");
      return;
    }
    if (outstanding > limit) {
      setError("Outstanding balance cannot exceed credit limit.");
      return;
    }
    if (minimum > outstanding) {
      setError("Minimum due cannot exceed outstanding balance.");
      return;
    }
    if (
      !values.issuer_name.trim() ||
      !values.card_name.trim() ||
      !values.nickname.trim()
    ) {
      setError("Nickname, issuer name and card name cannot be blank.");
      return;
    }
    setBusy(true);
    try {
      const card = await api<Card>(
        initial ? "/cards/" + initial.id : "/cards",
        { method: initial ? "PATCH" : "POST", body: JSON.stringify(values) },
      );
      navigate("/cards/" + card.id, {
        replace: true,
        state: {
          message: initial
            ? "Card updated successfully."
            : "Card added successfully.",
        },
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const textField = (
    key: "nickname" | "issuer_name" | "card_name",
    label: string,
    placeholder: string,
  ) => (
    <label>
      {label}
      <input
        aria-label={label}
        name={key}
        value={values[key]}
        onChange={(e) => change(key, e.target.value)}
        required
        maxLength={100}
        placeholder={placeholder}
        autoComplete="off"
      />
    </label>
  );
  const amountField = (
    key: "credit_limit" | "outstanding_balance" | "minimum_due",
    label: string,
  ) => (
    <label>
      {label}
      <div className="currency-input">
        <span aria-hidden="true">₹</span>
        <input
          aria-label={label}
          name={key}
          value={values[key]}
          onChange={(e) => change(key, e.target.value)}
          required
          inputMode="decimal"
          pattern="[0-9]+(\.[0-9]{1,2})?"
          maxLength={15}
          title="Enter a non-negative amount with up to two decimal places"
        />
      </div>
    </label>
  );
  return (
    <main className="page">
      <Link
        className="back-link"
        to={initial ? "/cards/" + initial.id : "/cards"}
      >
        <ArrowLeft size={15} /> {initial ? "Back to Card" : "Back to Cards"}
      </Link>
      <div className="eyebrow">
        {initial ? "KEEP YOUR PICTURE CURRENT" : "BUILD YOUR CREDIT PICTURE"}
      </div>
      <h1>
        {initial ? "Edit Card" : "Add Card"}
        <span className="mint">.</span>
      </h1>
      <p>Your card details, organized. No sensitive credentials needed.</p>
      <div className="card-editor-layout">
        <form className="card-editor" onSubmit={submit}>
          {error && (
            <div className="message error" role="alert">
              {error}
            </div>
          )}
          <fieldset disabled={busy}>
            <legend>01 / CARD DETAILS</legend>
            <div className="form-grid">
              {textField("nickname", "Card Nickname", "e.g. My everyday card")}
              {textField("issuer_name", "Issuer Name", "e.g. Nova Bank")}
              {textField("card_name", "Card Name", "e.g. Platinum")}
              <label>
                Network
                <select
                  value={values.network}
                  onChange={(e) => change("network", e.target.value)}
                >
                  {networks.map((network) => (
                    <option key={network}>{network}</option>
                  ))}
                </select>
              </label>
              <label>
                Last 4 Digits
                <input
                  name="last_four"
                  value={values.last_four}
                  onChange={(e) => change("last_four", e.target.value)}
                  required
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  autoComplete="off"
                  placeholder="1234"
                  title="Enter exactly four digits"
                />
              </label>
              <label>
                Status
                <select
                  value={values.status}
                  onChange={(e) => change("status", e.target.value)}
                >
                  {statuses.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-divider">02 / BALANCE & DUE DATE</div>
            <div className="form-grid">
              {amountField("credit_limit", "Credit Limit")}
              {amountField("outstanding_balance", "Outstanding Balance")}
              {amountField("minimum_due", "Minimum Due")}
              <label>
                Due Date
                <input
                  type="date"
                  name="due_date"
                  value={values.due_date}
                  onChange={(e) => change("due_date", e.target.value)}
                  required
                />
              </label>
            </div>
            <p className="form-helper">
              Amounts are in INR. Keep these manually entered balances up to
              date.
            </p>
            <div className="simulation-flags">
              <div className="form-divider">03 / SIMULATION ROUTE SETTINGS</div>
              <p className="form-helper">
                Development flags only. These do not represent real provider
                support.
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={values.card_to_card_source_enabled}
                  onChange={(e) =>
                    change("card_to_card_source_enabled", e.target.checked)
                  }
                />{" "}
                Enable as simulation source
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={values.card_to_card_destination_enabled}
                  onChange={(e) =>
                    change("card_to_card_destination_enabled", e.target.checked)
                  }
                />{" "}
                Enable as simulation destination
              </label>
            </div>
            <div className="form-actions">
              <button className="button" disabled={busy}>
                {busy ? "Saving…" : initial ? "Save Changes" : "Save Card"}{" "}
                {!busy && <ArrowRight size={16} />}
              </button>
              <Link
                className="secondary-button"
                to={initial ? "/cards/" + initial.id : "/cards"}
              >
                Cancel
              </Link>
            </div>
          </fieldset>
        </form>
        <aside className="card-preview">
          <div className="eyebrow">A CLEARER PICTURE</div>
          <div className="preview-face">
            <div>{values.issuer_name || "Your issuer"}</div>
            <h2>{values.nickname || "Your next card"}</h2>
            <p>{values.card_name || "Card name"}</p>
            <div className="credit-face-bottom">
              <span className="masked">•••• {values.last_four || "0000"}</span>
              <span>{values.network}</span>
            </div>
          </div>
          <div className="preview-amount">
            <span>Available Credit</span>
            <strong>{calculation ? money(calculation.available) : "—"}</strong>
          </div>
          <div className="preview-amount">
            <span>Utilization</span>
            <strong>
              {calculation ? percent(calculation.utilization) : "—"}
            </strong>
          </div>
          <p className="form-helper">
            Live preview. Final values are calculated securely by CardRoute when
            you save.
          </p>
          <div className="metadata-note">
            <ShieldCheck size={18} />
            <span>
              Last four digits only. Never enter your full card number or
              security codes.
            </span>
          </div>
        </aside>
      </div>
    </main>
  );
}
