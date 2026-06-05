import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../api/axios";
import AuthLayout from "../components/auth/AuthLayout";
import AuthInput from "../components/auth/AuthInput";
import AuthButton from "../components/auth/AuthButton";

function ClinicRegister() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    owner_name: "",
    owner_email: "",
    password: "",
    confirmPassword: "",
    clinic_name: "",
    address: "",
    contact_number: "",
    services: "",
    opening_hours: "",
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

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (!agree) {
      setError("Please agree to the Terms of Service and Privacy Policy.");
      return;
    }

    try {
      setLoading(true);

      const response = await API.post("/api/clinics/register", {
        owner_name: formData.owner_name,
        owner_email: formData.owner_email,
        password: formData.password,
        clinic_name: formData.clinic_name,
        address: formData.address,
        contact_number: formData.contact_number,
        services: formData.services,
        opening_hours: formData.opening_hours,
      });

      setSuccess(
        response.data.message ||
          "Clinic registered successfully. You may now log in.",
      );

      setTimeout(() => {
        navigate("/auth/login");
      }, 1500);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Clinic registration failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Register Your Clinic"
      subtitle="Create a clinic owner account and start with the Free plan"
      wide
    >
      <Link to="/" className="auth-back-link">
        ← Back to Landing Page
      </Link>

      {error && <div className="auth-error">{error}</div>}
      {success && <div className="auth-success">{success}</div>}

      <div className="info-message" style={{ marginBottom: "16px" }}>
        <strong>Default Plan:</strong> New clinics are automatically assigned
        the Free plan. You can upgrade later once the payment gateway is added.
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-row">
          <AuthInput
            label="Clinic Owner Name"
            name="owner_name"
            placeholder="Dr. Juan Dela Cruz"
            value={formData.owner_name}
            onChange={handleChange}
            icon="👤"
          />

          <AuthInput
            label="Owner Email"
            type="email"
            name="owner_email"
            placeholder="owner@clinic.com"
            value={formData.owner_email}
            onChange={handleChange}
            icon="✉"
          />
        </div>

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

        <AuthInput
          label="Clinic Name"
          name="clinic_name"
          placeholder="Dela Cruz Dental Clinic"
          value={formData.clinic_name}
          onChange={handleChange}
          icon="🏥"
        />

        <AuthInput
          label="Clinic Address"
          name="address"
          placeholder="123 Sample Street, Quezon City"
          value={formData.address}
          onChange={handleChange}
          icon="📍"
        />

        <AuthInput
          label="Clinic Contact Number"
          type="tel"
          name="contact_number"
          placeholder="09123456789"
          value={formData.contact_number}
          onChange={handleChange}
          icon="☎"
          required={false}
        />

        <div className="auth-textarea-group">
          <label>Services Offered</label>
          <textarea
            name="services"
            value={formData.services}
            onChange={handleChange}
            placeholder="Example: General Dentistry, Cleaning, Extraction, Orthodontics"
            rows="4"
          />
        </div>

        <div className="auth-textarea-group">
          <label>Opening Hours</label>
          <textarea
            name="opening_hours"
            value={formData.opening_hours}
            onChange={handleChange}
            placeholder="Example: Monday to Saturday, 9:00 AM - 5:00 PM"
            rows="4"
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
          {loading ? "Registering Clinic..." : "Register Clinic"}
        </AuthButton>
      </form>

      <p className="auth-footer">
        Already registered?{" "}
        <button
          type="button"
          className="auth-link"
          onClick={() => navigate("/auth/login")}
        >
          Sign in
        </button>
      </p>
    </AuthLayout>
  );
}

export default ClinicRegister;
