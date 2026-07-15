import React, { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Turnstile } from "@marsidev/react-turnstile";
import API from "../api/axios";
import AuthLayout from "../components/auth/AuthLayout";
import AuthInput from "../components/auth/AuthInput";
import AuthButton from "../components/auth/AuthButton";
import PasswordInput from "../components/auth/PasswordInput";
import ThemeToggle from "../components/ThemeToggle";

function ClinicRegister() {
  const navigate = useNavigate();
  const turnstileRef = useRef(null);

  const siteKey = process.env.REACT_APP_TURNSTILE_SITE_KEY;

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
  const [turnstileToken, setTurnstileToken] = useState("");

  const [error, setError] = useState("");
  const [passwordRules, setPasswordRules] = useState([]);
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

  const resetTurnstile = () => {
    setTurnstileToken("");

    if (turnstileRef.current) {
      turnstileRef.current.reset();
    }
  };

  const resetForm = () => {
    setFormData({
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

    setAgree(false);
    resetTurnstile();
  };

  const handleChange = (e) => {
    setError("");
    setPasswordRules([]);
    setSuccess("");

    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading) return;

    setError("");
    setPasswordRules([]);
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
      setError("Clinic location name is required.");
      return;
    }

    if (!address) {
      setError("Clinic location address is required.");
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

    if (!turnstileToken) {
      setError("Please complete the CAPTCHA verification.");
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
        turnstileToken,
      });

      setSuccess(
        response.data?.message ||
          "Clinic owner account and first clinic location created successfully. Please check the clinic owner email to verify the account.",
      );

      resetForm();
    } catch (err) {
      const status = err.response?.status;
      const apiError = err.response?.data?.error;
      const apiPasswordRules = err.response?.data?.password_rules;

      if (Array.isArray(apiPasswordRules)) {
        setPasswordRules(apiPasswordRules);
      }

      if (status === 429) {
        setError("Too many registration attempts. Please try again later.");
      } else if (status === 400 && err.response?.data?.captcha_required) {
        setError(apiError || "Please complete the CAPTCHA verification.");
      } else if (status === 400) {
        setError(apiError || "Please check your clinic registration details.");
      } else if (status === 403) {
        setError(apiError || "Clinic registration is not allowed.");
      } else {
        setError(apiError || "Clinic registration failed. Please try again.");
      }

      resetTurnstile();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Register Your Clinic"
      subtitle="Create a clinic owner account and first clinic location workspace"
      wide
    >
      <ThemeToggle />

      <Link to="/" className="auth-back-link">
        ← Back to Landing Page
      </Link>

      {error && <div className="auth-error">{error}</div>}

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

      {success && <div className="auth-success">{success}</div>}

      {!success && (
        <>
          <div className="info-message" style={{ marginBottom: "16px" }}>
            <strong>Default Setup:</strong> This creates one Clinic Owner
            account and the first clinic location. The account starts with the
            Free shared subscription and can add more locations after upgrading.
          </div>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="auth-required-note">
              Fields marked with <span>*</span> are required.
            </div>

            <div className="auth-row">
              <AuthInput
                label="Clinic Owner Name"
                name="owner_name"
                placeholder="Dr. Juan Dela Cruz"
                value={formData.owner_name}
                onChange={handleChange}
                icon="👤"
                autoComplete="name"
                disabled={loading}
                required
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
                disabled={loading}
                required
              />
            </div>

            <div className="auth-row">
              <PasswordInput
                label="Password"
                name="password"
                placeholder="Create password"
                value={formData.password}
                onChange={handleChange}
                icon="🔒"
                autoComplete="new-password"
                disabled={loading}
                required
              />

              <PasswordInput
                label="Confirm Password"
                name="confirmPassword"
                placeholder="Confirm password"
                value={formData.confirmPassword}
                onChange={handleChange}
                icon="🔒"
                autoComplete="new-password"
                disabled={loading}
                required
              />
            </div>

            <div className="auth-note">
              Password must have at least 8 characters, one uppercase letter,
              one lowercase letter, one number, and one special character.
            </div>

            <AuthInput
              label="Clinic Location Name"
              name="clinic_name"
              placeholder="Dela Cruz Dental Clinic - Main Branch"
              value={formData.clinic_name}
              onChange={handleChange}
              icon="🏥"
              autoComplete="organization"
              disabled={loading}
              required
            />

            <AuthInput
              label="Clinic Location Address"
              name="address"
              placeholder="123 Sample Street, Quezon City"
              value={formData.address}
              onChange={handleChange}
              icon="📍"
              autoComplete="street-address"
              disabled={loading}
              required
            />

            <AuthInput
              label="Clinic Location Contact Number"
              type="tel"
              name="contact_number"
              placeholder="09123456789"
              value={formData.contact_number}
              onChange={handleChange}
              icon="☎"
              required={false}
              autoComplete="tel"
              disabled={loading}
            />

            <div className="auth-note">
              This first clinic location will be linked to the Clinic Owner
              account. Additional locations can be managed later from the Clinic
              Owner portal.
            </div>

            <div className="auth-textarea-group">
              <label>
                Services Offered <span className="auth-required">*</span>
              </label>
              <textarea
                name="services"
                value={formData.services}
                onChange={handleChange}
                placeholder="Example: General Dentistry, Cleaning, Extraction, Orthodontics"
                rows="4"
                disabled={loading}
                required
              />
            </div>

            <div className="auth-textarea-group">
              <label>
                Opening Hours <span className="auth-required">*</span>
              </label>
              <textarea
                name="opening_hours"
                value={formData.opening_hours}
                onChange={handleChange}
                placeholder="Example: Monday to Saturday, 9:00 AM - 5:00 PM"
                rows="4"
                disabled={loading}
                required
              />
            </div>

            <label className="auth-check">
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => {
                  setAgree(e.target.checked);
                  setError("");
                }}
                disabled={loading}
              />
              <span>
                I agree to the Terms of Service and Privacy Policy{" "}
                <strong className="auth-required">*</strong>
              </span>
            </label>

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

            <AuthButton type="submit" disabled={loading || !siteKey}>
              {loading ? "Registering Clinic..." : "Register Clinic Location"}
            </AuthButton>
          </form>
        </>
      )}

      {success && (
        <div className="auth-form">
          <AuthButton type="button" onClick={() => navigate("/auth/login")}>
            Go to Login
          </AuthButton>

          <button
            type="button"
            className="auth-link"
            onClick={() => {
              setSuccess("");
              setError("");
              setPasswordRules([]);
              resetTurnstile();
            }}
          >
            Register another clinic owner
          </button>
        </div>
      )}

      <p className="auth-footer">
        Already have a clinic owner account?{" "}
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
