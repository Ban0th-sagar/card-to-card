import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { UserRound, LogOut } from "lucide-react";
import { useAuth } from "../auth";
import { api, type User } from "../api";
export default function Profile() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const name = new FormData(e.currentTarget).get("name");
      setUser(
        await api<User>("/users/me", {
          method: "PATCH",
          body: JSON.stringify({ name }),
        }),
      );
      setEditing(false);
      setSuccess("Your name has been updated.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      await api("/auth/logout", { method: "POST" });
      setUser(null);
      navigate("/login");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="page">
      <div className="eyebrow">PERSONAL DETAILS</div>
      <h1>
        Your profile<span className="mint">.</span>
      </h1>
      <p className="muted">The details that make this space yours.</p>
      <section className="profile-card">
        <div className="profile-top">
          <span className="avatar large-avatar">
            {user?.name[0].toUpperCase()}
          </span>
          <div>
            <h2>{user?.name}</h2>
            <p>{user?.email}</p>
          </div>
          <span className="status-pill">{user?.role}</span>
        </div>
        {error && (
          <div className="message error" role="alert">
            {error}
          </div>
        )}
        {success && (
          <div className="message success" role="status">
            {success}
          </div>
        )}
        {editing ? (
          <form onSubmit={save}>
            <label>
              Full Name
              <input
                name="name"
                defaultValue={user?.name}
                required
                maxLength={100}
              />
            </label>
            <div className="form-actions">
              <button className="button" disabled={busy}>
                {busy ? "Saving…" : "Save Changes"}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <dl>
              <div>
                <dt>User Name</dt>
                <dd>{user?.name}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{user?.email}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>{user?.role}</dd>
              </div>
              <div>
                <dt>Account Created</dt>
                <dd>
                  {new Date(user!.created_at).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </dd>
              </div>
            </dl>
            <div className="form-actions">
              <button
                className="button"
                onClick={() => {
                  setEditing(true);
                  setSuccess("");
                }}
              >
                Edit Profile <UserRound size={16} />
              </button>
              <button
                className="secondary-button"
                disabled={busy}
                onClick={logout}
              >
                <LogOut size={16} /> Logout
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
