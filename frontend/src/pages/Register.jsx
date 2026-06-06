import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../api/axios";
import AuthLayout from "../components/auth/AuthLayout";
import AuthInput from "../components/auth/AuthInput";
import AuthButton from "../components/auth/AuthButton";

function Register() {
  const navigate = useNavigate();

  const PATIENT_ROLE_ID = 3;

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    contact_number: "",
    password: "",
    confirmPassword: "",
  });

  const [agree, setAgree] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!agree) {
      setError("Please agree to the Terms of Service and Privacy Policy.");
      return;
    }

    setLoading(true);

    try {
      const fullName = `${formData.firstName} ${formData.lastName}`.trim();

      await API.post("/api/users/register", {
        name: fullName,
        email: formData.email,
        password: formData.password,
        role_id: PATIENT_ROLE_ID,
      });

      setSuccess("Patient account created successfully. You may now log in.");

      setTimeout(() => {
        navigate("/auth/login");
      }, 1200);
    } catch (err) {
      setError(
        err.response?.data?.error || "Registration failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create Patient Account"
      subtitle="Register as a patient to access DentoGraph"
      wide
    >
      <Link to="/" className="auth-back-link">
        ← Back to Landing Page
      </Link>

      {error && <div className="auth-error">{error}</div>}
      {success && <div className="auth-success">{success}</div>}

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-row">
          <AuthInput
            label="First Name"
            name="firstName"
            placeholder="Juan"
            value={formData.firstName}
            onChange={handleChange}
            icon="👤"
          />

          <AuthInput
            label="Last Name"
            name="lastName"
            placeholder="Dela Cruz"
            value={formData.lastName}
            onChange={handleChange}
          />
        </div>

        <AuthInput
          label="Email Address"
          type="email"
          name="email"
          placeholder="juan@example.com"
          value={formData.email}
          onChange={handleChange}
          icon="✉"
        />

        <AuthInput
          label="Phone Number"
          type="tel"
          name="contact_number"
          placeholder="09123456789"
          value={formData.contact_number}
          onChange={handleChange}
          icon="☎"
          required={false}
        />

        <div className="auth-row">
          <AuthInput
            label="Password"
            type="password"
            name="password"
            placeholder="Create password"
            value={formData.password}
            onChange={handleChange}
            icon="🔒"
          />

          <AuthInput
            label="Confirm Password"
            type="password"
            name="confirmPassword"
            placeholder="Confirm password"
            value={formData.confirmPassword}
            onChange={handleChange}
          />
        </div>

        <label className="auth-check">
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
          />
          <span>I agree to the Terms of Service and Privacy Policy</span>
        </label>

        <AuthButton type="submit" disabled={loading}>
          {loading ? "Creating Account..." : "Create Patient Account"}
        </AuthButton>
      </form>

      <p className="auth-footer">
        Already have an account?{" "}
        <button className="auth-link" onClick={() => navigate("/auth/login")}>
          Sign in
        </button>
      </p>

      <div className="auth-note">
        Dentists and dental assistants are registered through a subscribed
        clinic account.
      </div>
    </AuthLayout>
  );
}

export default Register;
