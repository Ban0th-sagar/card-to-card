import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  ShieldCheck,
  Layers,
  LockKeyhole,
  Route as RouteIcon,
  Check,
} from "lucide-react";
import Brand from "../components/Brand";
export default function Landing() {
  return (
    <div className="landing">
      <header className="public-header">
        <Brand />
        <nav>
          <a className="quiet-link" href="#approach">
            Our approach
          </a>
          <Link className="quiet-link" to="/login">
            Sign In
          </Link>
          <Link className="button small" to="/register">
            Get Started <ArrowUpRight size={15} />
          </Link>
        </nav>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="live-dot" /> A CLEARER PICTURE OF YOUR CREDIT
            </div>
            <h1>
              Manage your credit cards from one{" "}
              <span>intelligent platform.</span>
            </h1>
            <h2>Smarter credit routing.</h2>
            <p>
              CardRoute helps users understand and manage multiple credit
              obligations from one place.
            </p>
            <div className="hero-actions">
              <Link className="button" to="/register">
                Get Started <ArrowRight size={18} />
              </Link>
              <Link className="text-button" to="/login">
                Sign In <ArrowUpRight size={17} />
              </Link>
            </div>
            <div className="hero-note">
              <ShieldCheck size={17} /> Thoughtfully built. Secure by design.
            </div>
          </div>
          <div
            className="hero-visual"
            aria-label="Illustration of an organized credit overview"
          >
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="visual-label">
              <span className="live-dot" /> YOUR FINANCIAL PICTURE, CONNECTED
            </div>
            <div className="abstract-card back-card">
              <span>CARDROUTE</span>
              <Layers size={24} />
              <div className="card-line" />
              <div className="card-line short" />
            </div>
            <div className="abstract-card front-card">
              <div className="card-top">
                <span>CARDROUTE / OVERVIEW</span>
                <RouteIcon size={23} />
              </div>
              <span className="visual-sub">A fresh perspective</span>
              <h3>Clarity starts here.</h3>
              <div className="card-bottom">
                <span>YOUR CREDIT. YOUR CONTROL.</span>
                <span className="mini-chip" />
              </div>
            </div>
            <div className="floating-note">
              <span className="note-icon">
                <Check size={17} />
              </span>
              <div>
                A simpler starting point
                <small>Built around you, from day one.</small>
              </div>
            </div>
            <div className="visual-index">
              01 <span>—</span> THE BIGGER PICTURE
            </div>
          </div>
        </section>
        <section className="approach" id="approach">
          <div>
            <div className="eyebrow">LESS NOISE. MORE PERSPECTIVE.</div>
            <h2>
              Your credit deserves
              <br />a little more clarity.
            </h2>
          </div>
          <div className="feature">
            <Layers />
            <h3>One organized space</h3>
            <p>
              A considered foundation for a clearer view of your credit
              obligations.
            </p>
          </div>
          <div className="feature">
            <LockKeyhole />
            <h3>Security at the core</h3>
            <p>
              Protected sessions and secure account access, built in from the
              start.
            </p>
          </div>
        </section>
      </main>
      <footer>
        <Brand />
        <span>Smarter credit routing.</span>
        <small>© {new Date().getFullYear()} CardRoute</small>
      </footer>
    </div>
  );
}
