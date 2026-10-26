import { Link } from "react-router-dom";
import { ArrowLeft, LockKeyhole } from "lucide-react";
export default function PaymentPlaceholder() {
  return (
    <main className="page">
      <div className="eyebrow">THE NEXT STEP</div>
      <h1>
        Payment<span className="mint">.</span>
      </h1>
      <section className="placeholder">
        <span className="note-icon">
          <LockKeyhole size={28} />
        </span>
        <span className="step-badge">STEP 05</span>
        <h2>Payment transaction execution will be implemented in Step 5.</h2>
        <p>No payment has been initiated. Your card balances are unchanged.</p>
        <Link className="text-button" to="/route">
          <ArrowLeft size={16} /> Back to Request
        </Link>
      </section>
    </main>
  );
}
