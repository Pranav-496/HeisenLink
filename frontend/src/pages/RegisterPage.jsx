import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import AuthShell from "../components/AuthShell.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { apiErrorMessage } from "../utils/errors.js";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState({ username: "", email: "", password: "", confirm_password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (form.password !== form.confirm_password) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const data = await register(form);
      navigate(`/verify-email?email=${encodeURIComponent(data.email)}`, {
        state: { isPending: true },
      });
    } catch (err) {
      setError(apiErrorMessage(err, "Registration failed. Please check your details."));
    } finally {
      setLoading(false);
    }
  };

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  return (
    <AuthShell>
      <section className="auth-card">
        <div>
          <p className="auth-eyebrow">Join HeisenLink</p>
          <h1>Create account</h1>
          <p className="auth-copy">Verify your email with a one-time code before entering the platform.</p>
        </div>
        <form onSubmit={submit}>
          <label>Full Name<input value={form.full_name || ""} onChange={update("full_name")} /></label>
          <label>Username<input required value={form.username} onChange={update("username")} /></label>
          <label>Email<input required type="email" value={form.email} onChange={update("email")} /></label>
          <label>Password<input required minLength={8} type="password" value={form.password} onChange={update("password")} /></label>
          <label>Confirm password<input required minLength={8} type="password" value={form.confirm_password} onChange={update("confirm_password")} /></label>
          {error && <p className="error">{error}</p>}
          <button className="auth-submit" disabled={loading} type="submit">
            {loading ? "Creating..." : "Continue"} <ArrowRight size={17} />
          </button>
        </form>
        <div className="auth-links">
          <span>Already verified?</span>
          <Link to="/auth">Log in</Link>
        </div>
      </section>
    </AuthShell>
  );
}
