import { Link } from "react-router-dom";
import { Layers, ArrowRight } from "lucide-react";
export default function Placeholder({ kind }: { kind: "Activity" }) {
  const text = "Activity will appear here when future features are enabled.";
  return (
    <main className="page">
      <div className="eyebrow">YOUR WORKSPACE</div>
      <h1>{kind}</h1>
      <section className="placeholder">
        <div className="note-icon">
          <Layers size={29} />
        </div>
        <span className="step-badge">COMING LATER</span>
        <h2>A little more clarity, on the way.</h2>
        <p>{text}</p>
        <Link className="text-button" to="/dashboard">
          Back to Dashboard <ArrowRight size={17} />
        </Link>
      </section>
    </main>
  );
}
