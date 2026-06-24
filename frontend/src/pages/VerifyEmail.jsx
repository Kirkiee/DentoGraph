import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import API from "../api/axios";
import AuthLayout from "../components/auth/AuthLayout";
import AuthButton from "../components/auth/AuthButton";
import ThemeToggle from "../components/ThemeToggle";

function VerifyEmail() {
  const { token } = useParams();

  const hasVerifiedRef = useRef(false);

  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Verifying your email address...");

  useEffect(() => {
    if (hasVerifiedRef.current) return;

    hasVerifiedRef.current = true;

    const verifyEmail = async () => {
      if (!token) {
        setStatus("error");
        setMessage("Verification token is missing.");
        return;
      }

      try {
        const response = await API.get(`/api/users/verify-email/${token}`);

        setStatus("success");
        setMessage(
          response.data?.message ||
            "Email verified successfully. You may continue using your account.",
        );
      } catch (err) {
        setStatus("error");
        setMessage(
          err.response?.data?.error ||
            "Email verification link is invalid or expired.",
        );
      }
    };

    verifyEmail();
  }, [token]);

  return (
    <AuthLayout
      title="Email Verification"
      subtitle="Confirm your email address for your DentoGraph account"
    >
      <ThemeToggle />

      {status === "loading" && <div className="auth-success">{message}</div>}

      {status === "success" && (
        <>
          <div className="auth-success">{message}</div>

          <Link to="/auth/login" style={{ textDecoration: "none" }}>
            <AuthButton type="button">Go to Login</AuthButton>
          </Link>
        </>
      )}

      {status === "error" && (
        <>
          <div className="auth-error">{message}</div>

          <p className="auth-footer">
            Need a new verification link?{" "}
            <Link to="/resend-verification" className="auth-link">
              Resend verification
            </Link>
          </p>

          <Link to="/auth/login" className="auth-back-link">
            ← Back to Login
          </Link>
        </>
      )}
    </AuthLayout>
  );
}

export default VerifyEmail;
