import React, { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Turnstile } from "@marsidev/react-turnstile";
import API from "../api/axios";
import AuthLayout from "../components/auth/AuthLayout";
import AuthInput from "../components/auth/AuthInput";
import PasswordInput from "../components/auth/PasswordInput";
import ThemeToggle from "../components/ThemeToggle";

function Login() {
  const navigate = useNavigate();
  const turnstileRef = useRef(null);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
  });

  const [turnstileToken, setTurnstileToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const siteKey = process.env.REACT_APP_TURNSTILE_SITE_KEY;

  const getNormalizedRole = (user) => {
    return user?.role || user?.role_name || "";
  };

  const redirectByRole = (role) => {
    switch (role) {
      case "Admin":
        navigate("/admin/dashboard");
        break;
      case "Clinic Owner":
        navigate("/clinic-owner/dashboard");
        break;
      case "Dentist":
        navigate("/dentist/dashboard");
        break;
      case "Patient":
        navigate("/patient/dashboard");
        break;
      case "Assistant":
      case "Dental Assistant":
        navigate("/assistant/dashboard");
        break;
      default:
        navigate("/");
        break;
    }
  };

  const resetTurnstile = () => {
    setTurnstileToken("");

    if (turnstileRef.current) {
      turnstileRef.current.reset();
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormData((previousData) => ({
      ...previousData,
      [name]: type === "checkbox" ? checked : value,
    }));

    setError("");
    setMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading) return;

    const cleanEmail = formData.email.trim().toLowerCase();

    setError("");
    setMessage("");
    setUnverifiedEmail("");

    if (!cleanEmail || !formData.password) {
      setError("Email and password are required.");
      return;
    }

    if (!turnstileToken) {
      setError("Please complete the CAPTCHA verification.");
      return;
    }

    try {
      setLoading(true);

      const response = await API.post("/api/users/login", {
        email: cleanEmail,
        password: formData.password,
        rememberMe: formData.rememberMe,
        turnstileToken,
      });

      const { token, user } = response.data;
      const normalizedRole = getNormalizedRole(user);

      if (!token || !user || !normalizedRole) {
        setError("Login response is missing account role details.");
        resetTurnstile();
        return;
      }

      const storedUser = {
        ...user,
        role: normalizedRole,
        role_name: user.role_name || normalizedRole,
      };

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(storedUser));

      if (formData.rememberMe) {
        localStorage.setItem("rememberMe", "true");
      } else {
        localStorage.removeItem("rememberMe");
      }

      redirectByRole(normalizedRole);
    } catch (err) {
      const status = err.response?.status;
      const apiError = err.response?.data?.error;
      const emailUnverified = err.response?.data?.email_unverified;

      if (emailUnverified) {
        setUnverifiedEmail(formData.email.trim().toLowerCase());
        setError(
          apiError ||
            "Your email address is not verified. Please verify your email before logging in.",
        );
      } else if (status === 429) {
        setError("Too many failed login attempts. Please try again later.");
      } else if (status === 400 && err.response?.data?.captcha_required) {
        setError(apiError || "Please complete the CAPTCHA verification.");
      } else if (status === 401) {
        setError(apiError || "Invalid email or password.");
      } else if (status === 403) {
        setError(apiError || "You are not allowed to access this account.");
      } else {
        setError(apiError || "Unable to log in. Please try again.");
      }

      resetTurnstile();
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    const emailToVerify =
      unverifiedEmail || formData.email.trim().toLowerCase();

    if (!emailToVerify) {
      setError("Please enter your email address first.");
      return;
    }

    if (!turnstileToken) {
      setError("Please complete the CAPTCHA verification before resending.");
      return;
    }

    try {
      setResendingVerification(true);
      setError("");
      setMessage("");

      const response = await API.post("/api/users/resend-verification", {
        email: emailToVerify,
        turnstileToken,
      });

      setMessage(
        response.data?.message ||
          "Verification email sent. Please check your inbox.",
      );

      resetTurnstile();
    } catch (err) {
      const status = err.response?.status;
      const apiError = err.response?.data?.error;

      if (status === 429) {
        setError("Too many resend attempts. Please try again later.");
      } else if (status === 400 && err.response?.data?.captcha_required) {
        setError(apiError || "Please complete the CAPTCHA verification.");
      } else {
        setError(apiError || "Unable to resend verification email.");
      }

      resetTurnstile();
    } finally {
      setResendingVerification(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome Back"
      subtitle="Log in to continue using DentoGraph."
    >
      <ThemeToggle />

      <Link to="/" className="auth-back-link">
        ← Back to Landing Page
      </Link>

      <form onSubmit={handleSubmit} className="auth-form">
        {error && <div className="auth-error">{error}</div>}
        {message && <div className="auth-success">{message}</div>}

        <AuthInput
          label="Email Address"
          type="email"
          name="email"
          placeholder="Enter your email address"
          value={formData.email}
          onChange={handleChange}
          required
          disabled={loading || resendingVerification}
          autoComplete="email"
        />

        <PasswordInput
          label="Password"
          name="password"
          placeholder="Enter your password"
          value={formData.password}
          onChange={handleChange}
          required
          disabled={loading || resendingVerification}
          autoComplete="current-password"
        />

        <div className="auth-options-row">
          <label className="auth-checkbox-label">
            <input
              type="checkbox"
              name="rememberMe"
              checked={formData.rememberMe}
              onChange={handleChange}
              disabled={loading || resendingVerification}
            />
            <span>Remember me</span>
          </label>

          <Link to="/forgot-password" className="auth-link">
            Forgot password?
          </Link>
        </div>

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

        <button
          type="submit"
          className="auth-button"
          disabled={loading || resendingVerification || !siteKey}
        >
          {loading ? "Logging in..." : "Log In"}
        </button>

        {unverifiedEmail && (
          <button
            type="button"
            className="auth-secondary-button"
            onClick={handleResendVerification}
            disabled={loading || resendingVerification || !siteKey}
          >
            {resendingVerification
              ? "Sending verification..."
              : "Resend Verification Email"}
          </button>
        )}

        <p className="auth-footer">
          Don&apos;t have an account?{" "}
          <Link to="/auth/register" className="auth-link">
            Create a patient account
          </Link>
        </p>

        <p className="auth-footer">
          Registering a clinic?{" "}
          <Link to="/auth/clinic-register" className="auth-link">
            Create a clinic account
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}

export default Login;
