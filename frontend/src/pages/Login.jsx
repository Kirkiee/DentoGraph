import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../api/axios";
import AuthLayout from "../components/auth/AuthLayout";
import AuthInput from "../components/auth/AuthInput";
import AuthButton from "../components/auth/AuthButton";

function Login() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
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
      case "Assistant":
      case "Dental Assistant":
        navigate("/assistant/dashboard");
        break;
      case "Patient":
        navigate("/patient/dashboard");
        break;
      default:
        navigate("/");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await API.post("/api/users/login", formData);

      const { token, user } = response.data;

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("rememberMe", rememberMe ? "true" : "false");

      redirectByRole(user.role);
    } catch (err) {
      setError(err.response?.data?.error || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome to DentoGraph"
      subtitle="Sign in to manage your dental records and clinic workflows"
    >
      <Link to="/" className="auth-back-link">
        ← Back to Landing Page
      </Link>

      {error && <div className="auth-error">{error}</div>}

      <form className="auth-form" onSubmit={handleSubmit}>
        <AuthInput
          label="Email Address"
          type="email"
          name="email"
          placeholder="Enter your email"
          value={formData.email}
          onChange={handleChange}
          icon="✉"
        />

        <AuthInput
          label="Password"
          type="password"
          name="password"
          placeholder="Enter your password"
          value={formData.password}
          onChange={handleChange}
          icon="🔒"
        />

        <div className="auth-options">
          <label className="auth-check">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            Remember me
          </label>

          <button
            type="button"
            className="auth-link"
            onClick={() => alert("Forgot password will be added later.")}
          >
            Forgot password?
          </button>
        </div>

        <AuthButton type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Sign In"}
        </AuthButton>
      </form>

      <p className="auth-footer">
        Don&apos;t have an account?{" "}
        <button className="auth-link" onClick={() => navigate("/register")}>
          Register as Patient
        </button>
      </p>
    </AuthLayout>
  );
}

export default Login;
