import React, { useState } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import AuthLayout from "../components/auth/AuthLayout";
import AuthInput from "../components/auth/AuthInput";
import AuthButton from "../components/auth/AuthButton";
import ThemeToggle from "../components/ThemeToggle";

function ResendVerification() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isValidEmail = (value) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

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

    try {
      setLoading(true);

      const response = await API.post("/api/users/resend-verification", {
        email: cleanEmail,
      });

      setMessage(
        response.data?.message ||
          "If the email exists and is not yet verified, a verification link has been prepared.",
      );
    } catch (err) {
      const status = err.response?.status;
      const apiError = err.response?.data?.error;

      if (status === 429) {
        setError("Too many attempts. Please try again later.");
      } else {
        setError(apiError || "Unable to resend verification link.");
      }
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
        />

        <AuthButton type="submit" disabled={loading}>
          {loading ? "Preparing verification link..." : "Resend Verification"}
        </AuthButton>
      </form>
    </AuthLayout>
  );
}

export default ResendVerification;
