import React, { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Turnstile } from "@marsidev/react-turnstile";
import API from "../api/axios";
import AuthLayout from "../components/auth/AuthLayout";
import AuthInput from "../components/auth/AuthInput";
import AuthButton from "../components/auth/AuthButton";
import PasswordInput from "../components/auth/PasswordInput";
import ThemeToggle from "../components/ThemeToggle";

const CLINIC_SERVICE_CATEGORIES = [
  {
    category: "Consultation and Preventive Care",
    services: [
      "Dental Consultation",
      "Comprehensive Oral Examination",
      "Routine Dental Check-up",
      "Treatment Planning",
      "Oral Health Education",
      "Dental Prophylaxis / Teeth Cleaning",
      "Deep Cleaning / Scaling and Root Planing",
      "Fluoride Treatment",
      "Pit and Fissure Sealants",
      "Oral Cancer Screening",
      "Periodontal Screening",
      "Halitosis / Bad Breath Management",
      "Preventive Dentistry",
    ],
  },
  {
    category: "Diagnostic and Imaging Services",
    services: [
      "Digital Dental X-ray",
      "Periapical X-ray",
      "Bitewing X-ray",
      "Occlusal X-ray",
      "Panoramic X-ray",
      "Cephalometric X-ray",
      "Cone Beam CT / CBCT Scan",
      "Intraoral Photography",
      "Digital Dental Scanning",
      "Study Casts / Dental Impressions",
      "Temporomandibular Joint / TMJ Assessment",
    ],
  },
  {
    category: "Restorative Dentistry",
    services: [
      "Tooth-Colored Filling / Composite Restoration",
      "Amalgam Filling",
      "Temporary Filling",
      "Glass Ionomer Restoration",
      "Inlay and Onlay",
      "Dental Bonding",
      "Full-Mouth Rehabilitation",
      "Restoration Repair or Replacement",
    ],
  },
  {
    category: "Endodontic Services",
    services: [
      "Root Canal Treatment",
      "Root Canal Retreatment",
      "Pulpotomy",
      "Pulpectomy",
      "Vital Pulp Therapy",
      "Apicoectomy",
      "Management of Dental Abscess",
      "Emergency Endodontic Treatment",
    ],
  },
  {
    category: "Oral Surgery and Extractions",
    services: [
      "Simple Tooth Extraction",
      "Surgical Tooth Extraction",
      "Wisdom Tooth Extraction",
      "Impacted Tooth Surgery",
      "Alveoloplasty",
      "Frenectomy",
      "Gingivectomy",
      "Incision and Drainage",
      "Biopsy of Oral Lesions",
      "Removal of Oral Cysts",
      "Pre-Prosthetic Surgery",
      "Management of Dental Trauma",
      "Emergency Dental Care",
    ],
  },
  {
    category: "Periodontal and Gum Care",
    services: [
      "Gingivitis Treatment",
      "Periodontitis Treatment",
      "Scaling and Root Planing",
      "Periodontal Maintenance",
      "Gum Contouring",
      "Gum Grafting",
      "Crown Lengthening",
      "Periodontal Surgery",
      "Bone Grafting",
      "Guided Tissue Regeneration",
      "Peri-Implant Disease Management",
    ],
  },
  {
    category: "Prosthodontics and Tooth Replacement",
    services: [
      "Complete Dentures",
      "Partial Dentures",
      "Flexible Dentures",
      "Immediate Dentures",
      "Denture Repair",
      "Denture Reline or Rebase",
      "Dental Crowns",
      "Dental Bridges",
      "Porcelain-Fused-to-Metal Crowns",
      "Zirconia Crowns",
      "E-Max Crowns and Veneers",
      "Implant-Supported Crown",
      "Implant-Supported Bridge",
      "Implant-Supported Denture",
      "Dental Implant Placement",
      "Dental Implant Restoration",
      "Maxillofacial Prosthetics",
    ],
  },
  {
    category: "Orthodontic Services",
    services: [
      "Orthodontic Consultation",
      "Metal Braces",
      "Ceramic Braces",
      "Self-Ligating Braces",
      "Lingual Braces",
      "Clear Aligners",
      "Retainers",
      "Space Maintainers",
      "Habit-Breaking Appliances",
      "Palatal Expander",
      "Functional Orthodontic Appliances",
      "Interceptive Orthodontics",
      "Orthodontic Adjustment",
      "Braces Removal",
      "Dentofacial Orthopedics",
    ],
  },
  {
    category: "Cosmetic and Aesthetic Dentistry",
    services: [
      "Professional Teeth Whitening",
      "Dental Veneers",
      "Composite Veneers",
      "Porcelain Veneers",
      "Smile Design",
      "Cosmetic Dental Bonding",
      "Tooth Recontouring",
      "Gum Depigmentation",
      "Gummy Smile Correction",
      "Diastema / Gap Closure",
      "Tooth Jewelry",
    ],
  },
  {
    category: "Pediatric Dentistry",
    services: [
      "Pediatric Dental Consultation",
      "Pediatric Oral Examination",
      "Pediatric Dental Cleaning",
      "Fluoride Treatment for Children",
      "Pit and Fissure Sealants for Children",
      "Pediatric Tooth Filling",
      "Pulpotomy for Primary Teeth",
      "Pulpectomy for Primary Teeth",
      "Stainless Steel Crown",
      "Primary Tooth Extraction",
      "Space Maintainer",
      "Early Orthodontic Assessment",
      "Behavior Management for Children",
      "Special Needs Pediatric Dentistry",
    ],
  },
  {
    category: "TMJ, Orofacial Pain, and Sleep Dentistry",
    services: [
      "TMJ Disorder Management",
      "Orofacial Pain Management",
      "Bruxism / Teeth Grinding Management",
      "Night Guard / Occlusal Splint",
      "Sports Mouthguard",
      "Sleep Apnea Oral Appliance",
      "Snoring Appliance",
      "Occlusal Adjustment",
    ],
  },
  {
    category: "Special Care and Sedation",
    services: [
      "Dental Care for Persons with Disabilities",
      "Geriatric Dentistry",
      "Dental Care for Medically Compromised Patients",
      "Dental Anxiety Management",
      "Conscious Sedation",
      "Nitrous Oxide Sedation",
      "Local Anesthesia",
      "Hospital-Based Dental Treatment",
      "Home-Service Dentistry",
    ],
  },
];

const CLINIC_SERVICE_OPTIONS = CLINIC_SERVICE_CATEGORIES.flatMap(
  (group) => group.services,
);

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
    latitude: "",
    longitude: "",
    contact_number: "",
    services: [],
    opening_hours: "",
  });

  const [agree, setAgree] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");

  const [error, setError] = useState("");
  const [passwordRules, setPasswordRules] = useState([]);
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeResults, setGeocodeResults] = useState([]);
  const [coordinateMessage, setCoordinateMessage] = useState("");

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
      latitude: "",
      longitude: "",
      contact_number: "",
      services: [],
      opening_hours: "",
    });

    setAgree(false);
    setGeocodeResults([]);
    setCoordinateMessage("");
    resetTurnstile();
  };

  const handleChange = (e) => {
    setError("");
    setPasswordRules([]);
    setSuccess("");

    if (e.target.name === "address") {
      setCoordinateMessage("");
    }

    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
      ...(e.target.name === "address" ? { latitude: "", longitude: "" } : {}),
    }));

    if (e.target.name === "address") {
      setGeocodeResults([]);
    }
  };

  const handleServiceToggle = (service) => {
    setError("");
    setPasswordRules([]);
    setSuccess("");

    setFormData((previous) => {
      const currentServices = Array.isArray(previous.services)
        ? previous.services
        : [];

      const isSelected = currentServices.includes(service);

      return {
        ...previous,
        services: isSelected
          ? currentServices.filter((item) => item !== service)
          : [...currentServices, service],
      };
    });
  };

  const handleLocateAddress = async () => {
    const address = cleanText(formData.address);

    if (address.length < 5) {
      setError("Enter a more complete clinic address before locating it.");
      return;
    }

    try {
      setGeocoding(true);
      setError("");
      setSuccess("");
      setGeocodeResults([]);

      const response = await API.get("/api/clinics/geocode", {
        params: { address },
      });

      const results = response.data?.results || [];
      setGeocodeResults(results);

      if (results.length === 0) {
        setError(
          "No matching Philippine address was found. Add the street, barangay, city, and province, then try again.",
        );
      }
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Unable to locate the clinic address right now.",
      );
    } finally {
      setGeocoding(false);
    }
  };

  const selectGeocodeResult = (result) => {
    setFormData((prev) => ({
      ...prev,
      address: result.display_name || prev.address,
      latitude: String(result.latitude),
      longitude: String(result.longitude),
    }));

    setGeocodeResults([]);
    setError("");
    setCoordinateMessage(
      "Clinic coordinates were generated from the selected address.",
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading) return;

    setError("");
    setPasswordRules([]);
    setSuccess("");
    setCoordinateMessage("");

    const ownerName = cleanText(formData.owner_name);
    const ownerEmail = cleanText(formData.owner_email).toLowerCase();
    const password = formData.password;
    const confirmPassword = formData.confirmPassword;
    const clinicName = cleanText(formData.clinic_name);
    const address = cleanText(formData.address);
    const latitude = cleanText(formData.latitude);
    const longitude = cleanText(formData.longitude);
    const contactNumber = cleanText(formData.contact_number);
    const selectedServices = Array.isArray(formData.services)
      ? formData.services
      : [];
    const services = selectedServices.join(", ");
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

    if (!latitude || !longitude) {
      setError(
        "Locate the clinic address and select a matching result before registering.",
      );
      return;
    }

    if (!services) {
      setError("Please select at least one clinic service.");
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
        latitude: Number(latitude),
        longitude: Number(longitude),
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
            {coordinateMessage && (
              <div className="auth-success clinic-coordinate-success">
                {coordinateMessage}
              </div>
            )}

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

            <div className="clinic-register-address-field">
              <label className="auth-label" htmlFor="clinic-register-address">
                Clinic Location Address <span className="auth-required">*</span>
              </label>

              <div className="clinic-register-address-row">
                <input
                  id="clinic-register-address"
                  type="text"
                  name="address"
                  className="auth-input"
                  placeholder="Street, barangay, city, province"
                  value={formData.address}
                  onChange={handleChange}
                  autoComplete="street-address"
                  disabled={loading}
                  required
                />

                <button
                  type="button"
                  className="auth-secondary-button clinic-register-locate-button"
                  onClick={handleLocateAddress}
                  disabled={
                    loading ||
                    geocoding ||
                    cleanText(formData.address).length < 5
                  }
                >
                  {geocoding ? "Locating..." : "Locate Address"}
                </button>
              </div>

              <small className="clinic-register-address-help">
                Enter the complete Philippine address, then select the correct
                result to generate the coordinates automatically.
              </small>

              {geocodeResults.length > 0 && (
                <div className="clinic-register-address-results">
                  {geocodeResults.map((result) => (
                    <button
                      type="button"
                      className="clinic-register-address-result"
                      key={`${result.place_id}-${result.latitude}-${result.longitude}`}
                      onClick={() => selectGeocodeResult(result)}
                      disabled={loading}
                    >
                      <strong>{result.display_name}</strong>
                      <span>
                        {Number(result.latitude).toFixed(6)},{" "}
                        {Number(result.longitude).toFixed(6)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="auth-row clinic-register-coordinate-grid">
              <div className="auth-field">
                <label>Generated Latitude</label>
                <input
                  type="text"
                  className="auth-input"
                  value={formData.latitude || "Locate the address first"}
                  readOnly
                  disabled
                />
              </div>

              <div className="auth-field">
                <label>Generated Longitude</label>
                <input
                  type="text"
                  className="auth-input"
                  value={formData.longitude || "Locate the address first"}
                  readOnly
                  disabled
                />
              </div>
            </div>

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

            <fieldset className="clinic-service-selector">
              <legend>
                Services Offered <span className="auth-required">*</span>
              </legend>

              <p className="clinic-service-selector-help">
                Select all dental services available at this clinic location.
              </p>

              <div className="clinic-service-category-list">
                {CLINIC_SERVICE_CATEGORIES.map((group) => (
                  <section
                    className="clinic-service-category"
                    key={group.category}
                  >
                    <h4>{group.category}</h4>

                    <div className="clinic-service-options">
                      {group.services.map((service) => {
                        const isSelected = formData.services.includes(service);

                        return (
                          <label
                            key={service}
                            className={`clinic-service-option ${
                              isSelected ? "selected" : ""
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleServiceToggle(service)}
                              disabled={loading}
                            />

                            <span className="clinic-service-option-check">
                              {isSelected ? "✓" : ""}
                            </span>

                            <span>{service}</span>
                          </label>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>

              <div className="clinic-service-selection-summary">
                <strong>{formData.services.length}</strong>{" "}
                {formData.services.length === 1
                  ? "service selected"
                  : "services selected"}
              </div>
            </fieldset>

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
                I agree to the{" "}
                <Link
                  className="auth-policy-link"
                  to="/terms-of-service"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  className="auth-policy-link"
                  to="/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Privacy Policy
                </Link>{" "}
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
