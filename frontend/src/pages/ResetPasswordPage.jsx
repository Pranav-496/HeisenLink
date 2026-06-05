import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";

import AuthShell from "../components/AuthShell.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { apiErrorMessage } from "../utils/errors.js";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { resetPassword } = useAuth();
  const [form, setForm] = useState({
    email: params.get("email") || "",
    otp: "",
    password: "",
    confirm_password: "",
  });
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
      await resetPassword(form);
      navigate("/auth");
    } catch (err) {
      setError(apiErrorMessage(err, "Could not reset password."));
    } finally {
      setLoading(false);
    }
  };

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  return (
    <AuthShell>
      <section className="auth-card">
        <div>
          <p className="auth-eyebrow">New password</p>
          <h1>Reset password</h1>
          <p className="auth-copy">Use the OTP from your email and choose a new password.</p>
          {location.state?.devOtp && <p className="dev-otp">Local reset OTP: <strong>{location.state.devOtp}</strong></p>}
        </div>
        <form onSubmit={submit}>
          <label>Email<input required type="email" value={form.email} onChange={update("email")} /></label>
          <label>OTP<input required inputMode="numeric" maxLength={6} value={form.otp} onChange={update("otp")} /></label>
          <label>New password<input required minLength={8} type="password" value={form.password} onChange={update("password")} /></label>
          <label>Confirm password<input required minLength={8} type="password" value={form.confirm_password} onChange={update("confirm_password")} /></label>
          {error && <p className="error">{error}</p>}
          <button className="auth-submit" disabled={loading} type="submit">
            {loading ? "Resetting..." : "Reset password"} <ArrowRight size={17} />
          </button>
        </form>
        <div className="auth-links">
          <Link to="/auth">Back to login</Link>
        </div>
      </section>
    </AuthShell>
  );
}
