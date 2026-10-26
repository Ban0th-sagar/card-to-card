import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useLocation } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  ShieldCheck,
  LockKeyhole,
} from "lucide-react";
import { useAuth } from "../auth";
import { api, type User } from "../api";
import Brand from "../components/Brand";
export default function AuthPage({ register = false }: { register?: boolean }) {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(
    useLocation().state?.registered
      ? "Account created. Sign in to get started."
      : "",
  );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setNotice("");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    if (register && data.password !== data.confirm_password) {
      setError("Passwords must match.");
      return;
    }
    setBusy(true);
    try {
      if (register) {
        await api("/auth/register", {
          method: "POST",
          body: JSON.stringify(data),
        });
        navigate("/login", { state: { registered: true } });
      } else {
        const u = await api<User>("/auth/login", {
          method: "POST",
          body: JSON.stringify(data),
        });
        setUser(u);
        navigate("/dashboard", { replace: true });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (user) return <Navigate to="/dashboard" replace />;
  return (
    <div className="auth-page">
      <header className="public-header">
        <Brand />
        <Link className="quiet-link" to="/">
          Back to home <ArrowUpRight size={15} />
        </Link>
      </header>
      <main className="auth-layout">
        <aside className="auth-story">
          <div className="eyebrow">A BETTER STARTING POINT</div>
          <h1>
            Your credit.
            <br />A clearer
            <br />
            <span>perspective.</span>
          </h1>
          <p>Smarter credit routing.</p>
          <div className="story-line" />
          <div className="hero-note">
            <ShieldCheck size={19} /> A secure space, built around you.
          </div>
        </aside>
        <section className="auth-form">
          <span className="section-number">
            {register ? "01 / GET STARTED" : "02 / WELCOME BACK"}
          </span>
          <h2>
            {register ? "Make room for clarity." : "Good to see you again."}
          </h2>
          <p>
            {register
              ? "Create your CardRoute account."
              : "Sign in to your CardRoute account."}
          </p>
          {notice && (
            <div className="message success" role="status">
              {notice}
            </div>
          )}
          {error && (
            <div className="message error" role="alert">
              {error}
            </div>
          )}
          <form onSubmit={submit}>
            {register && (
              <label>
                Full Name
                <input
                  name="name"
                  autoComplete="name"
                  required
                  maxLength={100}
                  placeholder="Your full name"
                />
              </label>
            )}
            <label>
              Email
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                placeholder="you@example.com"
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete={register ? "new-password" : "current-password"}
                required
                minLength={register ? 8 : 1}
                maxLength={128}
                placeholder={
                  register ? "At least 8 characters" : "Enter your password"
                }
              />
            </label>
            {register && (
              <label>
                Confirm Password
                <input
                  name="confirm_password"
                  type="password"
                  autoComplete="new-password"
                  required
                  maxLength={128}
                  placeholder="Re-enter your password"
                />
              </label>
            )}
            {!register && (
              <button
                type="button"
                className="forgot"
                onClick={() =>
                  setNotice("Password recovery will be available soon.")
                }
              >
                Forgot Password
              </button>
            )}
            <button className="button full" disabled={busy}>
              {busy ? "Please wait…" : register ? "Create Account" : "Sign In"}{" "}
              {!busy && <ArrowRight size={17} />}
            </button>
          </form>
          <p className="auth-footer">
            {register ? "Already have an account?" : "New to CardRoute?"}{" "}
            <Link to={register ? "/login" : "/register"}>
              {register ? "Sign In" : "Create Account"}
            </Link>
          </p>
          <div className="form-note">
            <LockKeyhole size={14} /> Your account, securely protected.
          </div>
        </section>
      </main>
    </div>
  );
}
