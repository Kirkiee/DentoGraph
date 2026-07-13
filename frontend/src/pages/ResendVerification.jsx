import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Turnstile } from "@marsidev/react-turnstile";
import API from "../api/axios";
import AuthLayout from "../components/auth/AuthLayout";
import AuthInput from "../components/auth/AuthInput";
import AuthButton from "../components/auth/AuthButton";
import ThemeToggle from "../components/ThemeToggle";

function ResendVerification() {
  const turnstileRef = useRef(null);

  const siteKey =
    process.env.REACT_APP_TURNSTILE_SITE_KEY || "1x00000000000000000000AA";

  const [email, setEmail] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isValidEmail = (value) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
  };

  const resetTurnstile = () => {
    setTurnstileToken("");

    if (turnstileRef.current) {
      turnstileRef.current.reset();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading) return;

    setMessage("");
    setError("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Please enter your email address.");
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!turnstileToken) {
      setError("Please complete the CAPTCHA verification.");
      return;
    }

    try {
      setLoading(true);

      const response = await API.post("/api/users/resend-verification", {
        email: cleanEmail,
        turnstileToken,
      });

      setMessage(
        response.data?.message ||
          "If the email exists and is not yet verified, a verification link has been prepared.",
      );

      setEmail("");
      resetTurnstile();
    } catch (err) {
      const status = err.response?.status;
      const apiError = err.response?.data?.error;

      if (status === 429) {
        setError("Too many attempts. Please try again later.");
      } else if (status === 400 && err.response?.data?.captcha_required) {
        setError(apiError || "Please complete the CAPTCHA verification.");
      } else {
        setError(apiError || "Unable to resend verification link.");
      }

      resetTurnstile();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Resend Verification"
      subtitle="Enter your email address to prepare a new verification link"
    >
      <ThemeToggle />

      <Link to="/auth/login" className="auth-back-link">
        ← Back to Login
      </Link>

      {error && <div className="auth-error">{error}</div>}
      {message && <div className="auth-success">{message}</div>}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <AuthInput
          label="Email Address"
          type="email"
          name="email"
          placeholder="Enter your account email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError("");
            setMessage("");
          }}
          icon="✉"
          autoComplete="email"
          disabled={loading}
          required
        />

        {siteKey ? (
          <div className="turnstile-wrapper">
            <Turnstile
              ref={turnstileRef}
              siteKey={siteKey}
              onSuccess={(token) => {
                setTurnstileToken(token);
                setError("");
              }}
              onExpire={() => {
                setTurnstileToken("");
              }}
              onError={() => {
                setTurnstileToken("");
                setError(
                  "CAPTCHA failed to load. Please refresh and try again.",
                );
              }}
              options={{
                theme: "auto",
                size: "normal",
              }}
            />
          </div>
        ) : (
          <div className="auth-error">
            Turnstile site key is missing. Please check frontend .env.
          </div>
        )}

        <AuthButton type="submit" disabled={loading || !siteKey}>
          {loading ? "Preparing verification link..." : "Resend Verification"}
        </AuthButton>
      </form>
    </AuthLayout>
  );
}

export default ResendVerification;
