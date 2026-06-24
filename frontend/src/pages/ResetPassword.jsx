import React, { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import API from "../api/axios";
import AuthLayout from "../components/auth/AuthLayout";
import AuthButton from "../components/auth/AuthButton";
import PasswordInput from "../components/auth/PasswordInput";
import ThemeToggle from "../components/ThemeToggle";

function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    new_password: "",
    confirm_password: "",
  });

  const [error, setError] = useState("");
  const [passwordRules, setPasswordRules] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setError("");
    setMessage("");
    setPasswordRules([]);

    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setMessage("");
    setPasswordRules([]);

    if (!formData.new_password || !formData.confirm_password) {
      setError("Please enter and confirm your new password.");
      return;
    }

    if (formData.new_password !== formData.confirm_password) {
      setError("New password and confirm password do not match.");
      return;
    }

    try {
      setLoading(true);

      const response = await API.post("/api/users/reset-password", {
        token,
        new_password: formData.new_password,
        confirm_password: formData.confirm_password,
      });

      setMessage(
        response.data?.message ||
          "Password reset successfully. You may now log in.",
      );

      setFormData({
        new_password: "",
        confirm_password: "",
      });

      setTimeout(() => {
        navigate("/auth/login");
      }, 1500);
    } catch (err) {
      const apiError = err.response?.data?.error;
      const rules = err.response?.data?.password_rules;

      if (Array.isArray(rules)) {
        setPasswordRules(rules);
      }

      setError(apiError || "Unable to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Reset Password"
      subtitle="Create a new secure password for your DentoGraph account"
    >
      <ThemeToggle />

      <Link to="/auth/login" className="auth-back-link">
        ← Back to Login
      </Link>

      {error && <div className="auth-error">{error}</div>}
      {message && <div className="auth-success">{message}</div>}

      {passwordRules.length > 0 && (
        <div className="auth-error">
          <strong>Password must follow these rules:</strong>
          <ul>
            {passwordRules.map((rule, index) => (
              <li key={index}>{rule}</li>
            ))}
          </ul>
        </div>
      )}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <PasswordInput
          label="New Password"
          name="new_password"
          placeholder="Enter your new password"
          value={formData.new_password}
          onChange={handleChange}
          icon="🔒"
          autoComplete="new-password"
          disabled={loading}
          required
        />

        <PasswordInput
          label="Confirm New Password"
          name="confirm_password"
          placeholder="Confirm your new password"
          value={formData.confirm_password}
          onChange={handleChange}
          icon="🔒"
          autoComplete="new-password"
          disabled={loading}
          required
        />

        <AuthButton type="submit" disabled={loading}>
          {loading ? "Resetting password..." : "Reset Password"}
        </AuthButton>
      </form>
    </AuthLayout>
  );
}

export default ResetPassword;
