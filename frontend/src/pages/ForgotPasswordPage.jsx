import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import AuthShell from "../components/AuthShell.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { apiErrorMessage } from "../utils/errors.js";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await forgotPassword(email);
      navigate(`/reset-password?email=${encodeURIComponent(email)}`, {
        state: { devOtp: data.dev_otp },
      });
    } catch (err) {
      setError(apiErrorMessage(err, "Could not start password reset."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <section className="auth-card">
        <div>
          <p className="auth-eyebrow">Password reset</p>
          <h1>Forgot password?</h1>
          <p className="auth-copy">Enter your verified email and we will send a single-use reset code.</p>
        </div>
        <form onSubmit={submit}>
          <label>Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          {error && <p className="error">{error}</p>}
          <button className="auth-submit" disabled={loading} type="submit">
            {loading ? "Sending..." : "Send reset code"} <ArrowRight size={17} />
          </button>
        </form>
        <div className="auth-links">
          <Link to="/auth">Back to login</Link>
        </div>
      </section>
    </AuthShell>
  );
}
