import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../api/axios";
import AuthLayout from "../components/auth/AuthLayout";
import AuthInput from "../components/auth/AuthInput";
import AuthButton from "../components/auth/AuthButton";
import PasswordInput from "../components/auth/PasswordInput";
import ThemeToggle from "../components/ThemeToggle";

function Login() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [rememberMe, setRememberMe] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);

  const [unverifiedEmail, setUnverifiedEmail] = useState("");

  const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
  };

  const handleChange = (e) => {
    setError("");
    setMessage("");
    setUnverifiedEmail("");

    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const redirectByRole = (role) => {
    switch (role) {
      case "Admin":
        navigate("/admin/dashboard", { replace: true });
        break;
      case "Clinic Owner":
        navigate("/clinic-owner/dashboard", { replace: true });
        break;
      case "Dentist":
        navigate("/dentist/dashboard", { replace: true });
        break;
      case "Assistant":
      case "Dental Assistant":
        navigate("/assistant/dashboard", { replace: true });
        break;
      case "Patient":
        navigate("/patient/dashboard", { replace: true });
        break;
      default:
        navigate("/", { replace: true });
    }
  };

  const handleResendVerification = async () => {
    const emailToVerify =
      unverifiedEmail || formData.email.trim().toLowerCase();

    if (!emailToVerify) {
      setError("Please enter your email address first.");
      return;
    }

    if (!isValidEmail(emailToVerify)) {
      setError("Please enter a valid email address.");
      return;
    }

    try {
      setResendingVerification(true);
      setError("");
      setMessage("");

      const response = await API.post("/api/users/resend-verification", {
        email: emailToVerify,
      });

      setMessage(
        response.data?.message ||
          "Verification email sent. Please check your inbox.",
      );
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to resend verification email.",
      );
    } finally {
      setResendingVerification(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setMessage("");
    setUnverifiedEmail("");

    const cleanEmail = formData.email.trim().toLowerCase();
    const password = formData.password;

    if (!cleanEmail || !password) {
      setError("Please enter your email and password.");
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);

    try {
      const response = await API.post("/api/users/login", {
        email: cleanEmail,
        password,
        rememberMe,
      });

      const { token, user } = response.data || {};

      if (!token || !user) {
        setError("Login failed. Please try again.");
        return;
      }

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("rememberMe", rememberMe ? "true" : "false");

      redirectByRole(user.role);
    } catch (err) {
      const status = err.response?.status;
      const responseData = err.response?.data || {};
      const apiError = responseData.error;

      if (status === 429) {
        setError("Too many login attempts. Please try again after 15 minutes.");
      } else if (status === 403 && responseData.email_unverified) {
        setUnverifiedEmail(cleanEmail);
        setError(
          apiError ||
            "Your email address is not verified. Please verify your email before logging in.",
        );
      } else if (
        status === 403 &&
        apiError?.toLowerCase().includes("inactive")
      ) {
        setError(apiError);
      } else {
        setError(apiError || "Invalid email or password.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome to DentoGraph"
      subtitle="Sign in to manage your dental records and clinic workflows"
    >
      <ThemeToggle />

      <Link to="/" className="auth-back-link">
        ← Back to Landing Page
      </Link>

      {message && <div className="auth-success">{message}</div>}
      {error && <div className="auth-error">{error}</div>}

      {unverifiedEmail && (
        <div className="auth-info" style={{ marginBottom: "16px" }}>
          <strong>Email verification required</strong>
          <br />
          Please verify <strong>{unverifiedEmail}</strong> before logging in. If
          you did not receive the email, you can request another verification
          link below.
        </div>
      )}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <AuthInput
          label="Email Address"
          type="email"
          name="email"
          placeholder="Enter your email"
          value={formData.email}
          onChange={handleChange}
          icon="✉"
          autoComplete="email"
          disabled={loading || resendingVerification}
        />

        <PasswordInput
          label="Password"
          name="password"
          placeholder="Enter your password"
          value={formData.password}
          onChange={handleChange}
          icon="🔒"
          autoComplete="current-password"
          disabled={loading || resendingVerification}
          required
        />

        <div className="auth-options">
          <label className="auth-check">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={loading || resendingVerification}
            />
            Remember me
          </label>

          <button
            type="button"
            className="auth-link"
            onClick={() => navigate("/forgot-password")}
            disabled={loading || resendingVerification}
          >
            Forgot password?
          </button>
        </div>

        <AuthButton type="submit" disabled={loading || resendingVerification}>
          {loading ? "Signing in..." : "Sign In"}
        </AuthButton>

        {unverifiedEmail && (
          <button
            type="button"
            className="secondary-button"
            onClick={handleResendVerification}
            disabled={loading || resendingVerification}
            style={{ width: "100%", marginTop: "12px" }}
          >
            {resendingVerification
              ? "Sending verification email..."
              : "Resend Verification Email"}
          </button>
        )}
      </form>

      <p className="auth-footer">
        Don&apos;t have an account?{" "}
        <button
          type="button"
          className="auth-link"
          onClick={() => navigate("/register")}
          disabled={loading || resendingVerification}
        >
          Register as Patient
        </button>
      </p>
    </AuthLayout>
  );
}

export default Login;
