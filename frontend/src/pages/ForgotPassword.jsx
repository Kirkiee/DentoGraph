import React, { useState } from "react";
import { Link } from "react-router-dom";
import API from "../api/axios";
import AuthLayout from "../components/auth/AuthLayout";
import AuthInput from "../components/auth/AuthInput";
import AuthButton from "../components/auth/AuthButton";
import ThemeToggle from "../components/ThemeToggle";

function ForgotPassword() {
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

      const response = await API.post("/api/users/forgot-password", {
        email: cleanEmail,
      });

      setMessage(
        response.data?.message ||
          "If an account with that email exists, a password reset link has been prepared.",
      );
    } catch (err) {
      const status = err.response?.status;
      const apiError = err.response?.data?.error;

      if (status === 429) {
        setError("Too many forgot password attempts. Please try again later.");
      } else {
        setError(apiError || "Unable to process forgot password request.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Forgot Password"
      subtitle="Enter your email address to prepare a password reset link"
    >
      <ThemeToggle />

      <Link to="/login" className="auth-back-link">
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
          {loading ? "Preparing reset link..." : "Send Reset Link"}
        </AuthButton>
      </form>
    </AuthLayout>
  );
}

export default ForgotPassword;
