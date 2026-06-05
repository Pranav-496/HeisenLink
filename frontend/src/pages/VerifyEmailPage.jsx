import { ArrowRight, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";

import AuthShell from "../components/AuthShell.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { apiErrorMessage } from "../utils/errors.js";

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { verifyEmail, verifyPending, resendOtp } = useAuth();
  const [email, setEmail] = useState(params.get("email") || "");
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [seconds, setSeconds] = useState(45);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (seconds <= 0) return undefined;
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [seconds]);

  const setDigit = (index, value) => {
    const nextValue = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = nextValue;
    setDigits(next);
    if (nextValue && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus();
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      if (location.state?.isPending) {
        await verifyPending({ email, otp: digits.join("") });
      } else {
        await verifyEmail({ email, otp: digits.join("") });
      }
      navigate("/");
    } catch (err) {
      setError(apiErrorMessage(err, "Verification failed."));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError("");
    setMessage("");
    try {
      const data = await resendOtp(email);
      setMessage(data.detail);
      setSeconds(45);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not resend OTP."));
    }
  };

  return (
    <AuthShell>
      <section className="auth-card otp-card">
        <div>
          <p className="auth-eyebrow">Email verification</p>
          <h1>Enter OTP</h1>
          <p className="auth-copy">We sent a 6-digit code to your email. It expires shortly and can only be used once.</p>
        </div>
        <form onSubmit={submit}>
          <label>Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <div className="otp-grid">
            {digits.map((digit, index) => (
              <input
                aria-label={`OTP digit ${index + 1}`}
                id={`otp-${index}`}
                inputMode="numeric"
                key={index}
                maxLength={1}
                value={digit}
                onChange={(event) => setDigit(index, event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Backspace" && !digits[index] && index > 0) {
                    document.getElementById(`otp-${index - 1}`)?.focus();
                  }
                }}
              />
            ))}
          </div>
          {message && <p className="success">{message}</p>}
          {error && <p className="error">{error}</p>}
          <button className="auth-submit" disabled={loading || digits.join("").length !== 6} type="submit">
            {loading ? "Verifying..." : "Verify email"} <ArrowRight size={17} />
          </button>
        </form>
        <button className="resend-button" disabled={seconds > 0 || !email} onClick={resend}>
          <RotateCcw size={16} /> {seconds > 0 ? `Resend in ${seconds}s` : "Resend OTP"}
        </button>
        <div className="auth-links">
          <Link to="/auth">Back to login</Link>
        </div>
      </section>
    </AuthShell>
  );
}
