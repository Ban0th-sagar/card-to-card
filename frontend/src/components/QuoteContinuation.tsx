import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { api } from "../api";
import type { Quote, QuoteRequest } from "../quotes";
export default function QuoteContinuation({
  request,
}: {
  request: QuoteRequest;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const navigate = useNavigate();
  useEffect(
    () => () => {
      generation.current++;
      controller.current?.abort();
    },
    [],
  );
  async function quote() {
    const version = ++generation.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError("");
    try {
      const result = await api<Quote>("/routes/quote", {
        method: "POST",
        body: JSON.stringify(request),
        signal: abort.signal,
      });
      if (version === generation.current)
        navigate(
          result.quote_id
            ? "/route-options?quote=" + result.quote_id
            : "/route-options",
          { state: { analysis: result, request } },
        );
    } catch (e) {
      if (version === generation.current && (e as Error).name !== "AbortError")
        setError((e as Error).message);
    } finally {
      if (version === generation.current) setBusy(false);
    }
  }
  return (
    <>
      {error && (
        <div className="message error" role="alert">
          {error}
        </div>
      )}
      <button
        type="button"
        className="button full"
        disabled={busy}
        onClick={quote}
      >
        {busy ? "Generating Quote…" : "Continue to Route Options"}{" "}
        {!busy && <ArrowRight size={16} />}
      </button>
    </>
  );
}
