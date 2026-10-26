import { useState } from "react";
import { Link, NavLink, Navigate, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  CreditCard,
  Route as RouteIcon,
  Activity,
  UserRound,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "../auth";
import { api } from "../api";
import Brand from "./Brand";
const navigation = [
  ["/dashboard", "Dashboard", LayoutDashboard],
  ["/cards", "Cards", CreditCard],
  ["/route", "Pay / Route", RouteIcon],
  ["/activity", "Activity", Activity],
  ["/profile", "Profile", UserRound],
] as const;
export function Protected() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="loading" role="status">
        Loading your workspace…
      </div>
    );
  return user ? <Shell /> : <Navigate to="/login" replace />;
}
function Shell() {
  const { user, setUser } = useAuth();
  const [error, setError] = useState("");
  const navigate = useNavigate();
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
      setUser(null);
      navigate("/login");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="workspace-label">PERSONAL WORKSPACE</div>
        <nav>
          {navigation.map(([path, label, Icon]) => (
            <NavLink key={path} to={path}>
              <Icon size={19} />
              <span>{label}</span>
              {path === "/dashboard" && <span className="nav-dot" />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="secure-note">
            <ShieldCheck size={19} />
            <div>
              Built on trust.<small>Secure account access</small>
            </div>
          </div>
          <button className="account-row" onClick={() => navigate("/profile")}>
            <span className="avatar">{user?.name[0].toUpperCase()}</span>
            <span>
              {user?.name}
              <small>Personal account</small>
            </span>
            <ChevronRight size={16} />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="workspace-header">
          <span>
            CARDROUTE <span className="header-slash">/</span>{" "}
            <span className="muted">Your workspace</span>
          </span>
          <Link
            to="/profile"
            className="avatar small-avatar"
            aria-label="Open profile"
          >
            {user?.name[0].toUpperCase()}
          </Link>
        </header>
        {error && (
          <div className="message error" role="alert">
            {error}
          </div>
        )}
        <Outlet context={{ logout }} />
        <footer className="workspace-footer">
          <span>Smarter credit routing.</span>
          <span>
            <span className="live-dot" /> Secure workspace
          </span>
        </footer>
      </div>
      <nav className="mobile-nav">
        {navigation.map(([path, label, Icon]) => (
          <NavLink key={path} to={path}>
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
