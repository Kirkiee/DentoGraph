import React, { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Turnstile } from "@marsidev/react-turnstile";
import API from "../api/axios";
import AuthLayout from "../components/auth/AuthLayout";
import AuthInput from "../components/auth/AuthInput";
import AuthButton from "../components/auth/AuthButton";
import PasswordInput from "../components/auth/PasswordInput";
import ThemeToggle from "../components/ThemeToggle";

function Register() {
  const navigate = useNavigate();
  const turnstileRef = useRef(null);

  // Public registration should only create Patient accounts.
  // Make sure this matches the Patient role_id in your roles table.
  const PATIENT_ROLE_ID = 3;

  const siteKey = process.env.REACT_APP_TURNSTILE_SITE_KEY;

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    contact_number: "",
    clinic_id: "",
    password: "",
    confirmPassword: "",
  });

  const [clinics, setClinics] = useState([]);
  const [loadingClinics, setLoadingClinics] = useState(true);

  const [agree, setAgree] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");

  const [error, setError] = useState("");
  const [passwordRules, setPasswordRules] = useState([]);
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchClinics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchClinics = async () => {
    try {
      setLoadingClinics(true);

      const response = await API.get("/api/clinics/public/list");
      setClinics(response.data.clinics || []);
    } catch (err) {
      console.error("Fetch public clinics error:", err);
      setClinics([]);
      setError(
        "Unable to load clinic list. Please refresh the page or contact the clinic.",
      );
    } finally {
      setLoadingClinics(false);
    }
  };

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

  const cleanPhoneNumber = (value) => {
    return String(value || "").trim();
  };

  const resetTurnstile = () => {
    setTurnstileToken("");

    if (turnstileRef.current) {
      turnstileRef.current.reset();
    }
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

  const resetForm = () => {
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      contact_number: "",
      clinic_id: "",
      password: "",
      confirmPassword: "",
    });

    setAgree(false);
    resetTurnstile();
  };

  const selectedClinic = clinics.find(
    (clinic) => Number(clinic.clinic_id) === Number(formData.clinic_id),
  );

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading) return;

    setError("");
    setPasswordRules([]);
    setSuccess("");

    const firstName = formData.firstName.trim();
    const lastName = formData.lastName.trim();
    const cleanEmail = formData.email.trim().toLowerCase();
    const contactNumber = cleanPhoneNumber(formData.contact_number);
    const clinicId = formData.clinic_id;
    const password = formData.password;
    const confirmPassword = formData.confirmPassword;

    if (!firstName || !lastName) {
      setError("First name and last name are required.");
      return;
    }

    if (!cleanEmail) {
      setError("Email address is required.");
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!clinicId) {
      setError("Please select the clinic you are registering under.");
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

    if (!agree) {
      setError("Please agree to the Terms of Service and Privacy Policy.");
      return;
    }

    if (!turnstileToken) {
      setError("Please complete the CAPTCHA verification.");
      return;
    }

    setLoading(true);

    try {
      const fullName = `${firstName} ${lastName}`.trim();

      const response = await API.post("/api/users/register", {
        name: fullName,
        email: cleanEmail,
        password,
        role_id: PATIENT_ROLE_ID,
        clinic_id: Number(clinicId),
        contact_number: contactNumber || null,
        turnstileToken,
      });

      setSuccess(
        response.data?.message ||
          "Patient account created successfully. Please check your email to verify your account.",
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
      } else if (status === 403) {
        setError(
          apiError ||
            "Public registration is only allowed for patient accounts.",
        );
      } else if (status === 400 && err.response?.data?.captcha_required) {
        setError(apiError || "Please complete the CAPTCHA verification.");
      } else if (status === 400) {
        setError(apiError || "Please check your registration details.");
      } else {
        setError(apiError || "Registration failed. Please try again.");
      }

      resetTurnstile();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create Patient Account"
      subtitle="Register under your selected clinic location workspace"
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
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-required-note">
            Fields marked with <span>*</span> are required.
          </div>

          <div className="auth-row">
            <AuthInput
              label="First Name"
              name="firstName"
              placeholder="Juan"
              value={formData.firstName}
              onChange={handleChange}
              icon="👤"
              autoComplete="given-name"
              disabled={loading}
              required
            />

            <AuthInput
              label="Last Name"
              name="lastName"
              placeholder="Dela Cruz"
              value={formData.lastName}
              onChange={handleChange}
              autoComplete="family-name"
              disabled={loading}
              required
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
            autoComplete="email"
            disabled={loading}
            required
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
            autoComplete="tel"
            disabled={loading}
          />

          <div className="auth-field">
            <label htmlFor="clinic_id">
              Clinic <span className="auth-required">*</span>
            </label>

            <select
              id="clinic_id"
              name="clinic_id"
              value={formData.clinic_id}
              onChange={handleChange}
              required
              disabled={loading || loadingClinics}
              className="auth-input"
            >
              <option value="">
                {loadingClinics
                  ? "Loading clinic locations..."
                  : "Select your clinic location"}
              </option>

              {clinics
                .filter((clinic) => clinic.status !== "Inactive")
                .map((clinic) => (
                  <option key={clinic.clinic_id} value={clinic.clinic_id}>
                    {clinic.clinic_name}
                  </option>
                ))}
            </select>
          </div>

          {selectedClinic && (
            <div className="auth-note">
              You are registering under{" "}
              <strong>{selectedClinic.clinic_name}</strong>. Your appointments,
              dentists, dental records, and X-rays will be connected to this
              clinic location workspace.
            </div>
          )}

          {!loadingClinics && clinics.length === 0 && (
            <div className="auth-error">
              No active clinic locations are available for registration yet.
            </div>
          )}

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
            Password must have at least 8 characters, one uppercase letter, one
            lowercase letter, one number, and one special character.
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

          <AuthButton
            type="submit"
            disabled={
              loading || loadingClinics || clinics.length === 0 || !siteKey
            }
          >
            {loading ? "Creating Account..." : "Create Patient Account"}
          </AuthButton>
        </form>
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
            Register another patient
          </button>
        </div>
      )}

      <p className="auth-footer">
        Already have an account?{" "}
        <button
          type="button"
          className="auth-link"
          onClick={() => navigate("/auth/login")}
          disabled={loading}
        >
          Sign in
        </button>
      </p>

      <div className="auth-note">
        Dentists and dental assistants are registered through a subscribed
        clinic owner account and assigned to a specific clinic location.
      </div>
    </AuthLayout>
  );
}

export default Register;
