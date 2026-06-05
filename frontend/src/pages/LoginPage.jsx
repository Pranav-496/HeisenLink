import { GoogleLogin } from "@react-oauth/google";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import AuthShell from "../components/AuthShell.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { apiErrorMessage } from "../utils/errors.js";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, googleLogin } = useAuth();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await login(form);
      navigate("/");
    } catch (err) {
      if (err.response?.data?.requires_verification) {
        navigate(`/verify-email?email=${encodeURIComponent(err.response.data.email)}`, {
          state: { devOtp: err.response.data.dev_otp },
        });
        return;
      }
      setError(apiErrorMessage(err, "Login failed. Please check your connection and credentials."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <section className="auth-card">
        <div>
          <p className="auth-eyebrow">HeisenLink</p>
          <h1>Log in</h1>
          <p className="auth-copy">The science of social connection.</p>
        </div>
        <form onSubmit={submit}>
          <label>
            Username
            <input required value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
          </label>
          <label>
            Password
            <input required type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="auth-submit" disabled={loading} type="submit">
            {loading ? "Logging in..." : "Log In"} <ArrowRight size={17} />
          </button>
        </form>
        <div className="auth-links">
          <Link to="/forgot-password">Forgot password?</Link>
          <Link to="/register">Create account</Link>
        </div>
        <div className="oauth-wrap">
          <GoogleLogin
            onSuccess={async ({ credential }) => {
              const result = await googleLogin(credential);
              if (result.requires_verification) {
                navigate(`/verify-email?email=${encodeURIComponent(result.email)}`, {
                  state: { devOtp: result.dev_otp },
                });
              } else {
                navigate("/");
              }
            }}
            onError={() => setError("Google login failed.")}
          />
        </div>
      </section>
    </AuthShell>
  );
}
