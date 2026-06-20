import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../api/axios";
import AuthLayout from "../components/auth/AuthLayout";
import AuthInput from "../components/auth/AuthInput";
import AuthButton from "../components/auth/AuthButton";
import ThemeToggle from "../components/ThemeToggle";

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

  const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
  };

  const validatePasswordStrength = (password) => {
    const value = String(password || "");

    if (value.length < 8) {
      return "Password must be at least 8 characters long.";
    }

    if (!/[A-Z]/.test(value)) {
      return "Password must contain at least one uppercase letter.";
    }

    if (!/[a-z]/.test(value)) {
      return "Password must contain at least one lowercase letter.";
    }

    if (!/[0-9]/.test(value)) {
      return "Password must contain at least one number.";
    }

    if (!/[^A-Za-z0-9]/.test(value)) {
      return "Password must contain at least one special character.";
    }

    return null;
  };

  const cleanText = (value) => {
    return String(value || "").trim();
  };

  const handleChange = (e) => {
    setError("");
    setSuccess("");

    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const ownerName = cleanText(formData.owner_name);
    const ownerEmail = cleanText(formData.owner_email).toLowerCase();
    const password = formData.password;
    const confirmPassword = formData.confirmPassword;
    const clinicName = cleanText(formData.clinic_name);
    const address = cleanText(formData.address);
    const contactNumber = cleanText(formData.contact_number);
    const services = cleanText(formData.services);
    const openingHours = cleanText(formData.opening_hours);

    if (!ownerName) {
      setError("Clinic owner name is required.");
      return;
    }

    if (!ownerEmail) {
      setError("Owner email is required.");
      return;
    }

    if (!isValidEmail(ownerEmail)) {
      setError("Please enter a valid owner email address.");
      return;
    }

    const passwordError = validatePasswordStrength(password);

    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!clinicName) {
      setError("Clinic name is required.");
      return;
    }

    if (!address) {
      setError("Clinic address is required.");
      return;
    }

    if (!services) {
      setError("Please enter at least one clinic service.");
      return;
    }

    if (!openingHours) {
      setError("Opening hours are required.");
      return;
    }

    if (!agree) {
      setError("Please agree to the Terms of Service and Privacy Policy.");
      return;
    }

    try {
      setLoading(true);

      const response = await API.post("/api/clinics/register", {
        owner_name: ownerName,
        owner_email: ownerEmail,
        password,
        clinic_name: clinicName,
        address,
        contact_number: contactNumber || null,
        services,
        opening_hours: openingHours,
      });

      setSuccess(
        response.data?.message ||
          "Clinic registered successfully. You may now log in.",
      );

      setTimeout(() => {
        navigate("/auth/login", { replace: true });
      }, 1500);
    } catch (err) {
      const status = err.response?.status;
      const apiError = err.response?.data?.error;

      if (status === 429) {
        setError("Too many registration attempts. Please try again later.");
      } else if (status === 400) {
        setError(apiError || "Please check your clinic registration details.");
      } else if (status === 403) {
        setError(apiError || "Clinic registration is not allowed.");
      } else {
        setError(apiError || "Clinic registration failed. Please try again.");
      }
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
      <ThemeToggle />

      <Link to="/" className="auth-back-link">
        ← Back to Landing Page
      </Link>

      {error && <div className="auth-error">{error}</div>}
      {success && <div className="auth-success">{success}</div>}

      <div className="info-message" style={{ marginBottom: "16px" }}>
        <strong>Default Plan:</strong> New clinics are automatically assigned
        the Free plan. You can upgrade later once the payment gateway is added.
      </div>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="auth-row">
          <AuthInput
            label="Clinic Owner Name"
            name="owner_name"
            placeholder="Dr. Juan Dela Cruz"
            value={formData.owner_name}
            onChange={handleChange}
            icon="👤"
            autoComplete="name"
          />

          <AuthInput
            label="Owner Email"
            type="email"
            name="owner_email"
            placeholder="owner@clinic.com"
            value={formData.owner_email}
            onChange={handleChange}
            icon="✉"
            autoComplete="email"
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
            autoComplete="new-password"
          />

          <AuthInput
            label="Confirm Password"
            type="password"
            name="confirmPassword"
            placeholder="Confirm password"
            value={formData.confirmPassword}
            onChange={handleChange}
            autoComplete="new-password"
          />
        </div>

        <div className="auth-note">
          Password must have at least 8 characters, one uppercase letter, one
          lowercase letter, one number, and one special character.
        </div>

        <AuthInput
          label="Clinic Name"
          name="clinic_name"
          placeholder="Dela Cruz Dental Clinic"
          value={formData.clinic_name}
          onChange={handleChange}
          icon="🏥"
          autoComplete="organization"
        />

        <AuthInput
          label="Clinic Address"
          name="address"
          placeholder="123 Sample Street, Quezon City"
          value={formData.address}
          onChange={handleChange}
          icon="📍"
          autoComplete="street-address"
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
          autoComplete="tel"
        />

        <div className="auth-textarea-group">
          <label>Services Offered</label>
          <textarea
            name="services"
            value={formData.services}
            onChange={handleChange}
            placeholder="Example: General Dentistry, Cleaning, Extraction, Orthodontics"
            rows="4"
            disabled={loading}
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
            disabled={loading}
          />
        </div>

        <label className="auth-check">
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            disabled={loading}
          />
          <span>I agree to the Terms of Service and Privacy Policy</span>
        </label>

        <AuthButton type="submit" disabled={loading || success}>
          {loading ? "Registering Clinic..." : "Register Clinic"}
        </AuthButton>
      </form>

      <p className="auth-footer">
        Already registered?{" "}
        <button
          type="button"
          className="auth-link"
          onClick={() => navigate("/auth/login")}
          disabled={loading}
        >
          Sign in
        </button>
      </p>
    </AuthLayout>
  );
}

export default ClinicRegister;
