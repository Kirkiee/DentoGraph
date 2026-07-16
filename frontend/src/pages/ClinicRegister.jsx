import React, { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Turnstile } from "@marsidev/react-turnstile";
import API from "../api/axios";
import AuthLayout from "../components/auth/AuthLayout";
import AuthInput from "../components/auth/AuthInput";
import AuthButton from "../components/auth/AuthButton";
import PasswordInput from "../components/auth/PasswordInput";
import ThemeToggle from "../components/ThemeToggle";
import { CLINIC_SERVICE_CATEGORIES } from "../utils/clinicServices";

function ClinicRegister() {
  const navigate = useNavigate();
  const turnstileRef = useRef(null);
  const businessRegistrationRef = useRef(null);
  const businessPermitRef = useRef(null);
  const ownerGovernmentIdRef = useRef(null);
  const clinicLicenseRef = useRef(null);

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

  const [verificationFiles, setVerificationFiles] = useState({
    business_registration: null,
    business_permit: null,
    owner_government_id: null,
    clinic_license: null,
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

    setVerificationFiles({
      business_registration: null,
      business_permit: null,
      owner_government_id: null,
      clinic_license: null,
    });

    [
      businessRegistrationRef,
      businessPermitRef,
      ownerGovernmentIdRef,
      clinicLicenseRef,
    ].forEach((inputRef) => {
      if (inputRef.current) {
        inputRef.current.value = "";
      }
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

  const ALLOWED_DOCUMENT_TYPES = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

  const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;

  const handleVerificationFileChange = (fieldName, event) => {
    setError("");
    setSuccess("");

    const file = event.target.files?.[0] || null;

    if (!file) {
      setVerificationFiles((previous) => ({
        ...previous,
        [fieldName]: null,
      }));
      return;
    }

    if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
      event.target.value = "";
      setError(
        "Verification documents must be PDF, JPG, JPEG, PNG, or WEBP files.",
      );
      return;
    }

    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
      event.target.value = "";
      setError("Each verification document must not exceed 10 MB.");
      return;
    }

    setVerificationFiles((previous) => ({
      ...previous,
      [fieldName]: file,
    }));
  };

  const formatFileSize = (sizeInBytes) => {
    const sizeInMb = Number(sizeInBytes || 0) / (1024 * 1024);
    return `${sizeInMb.toFixed(sizeInMb >= 1 ? 2 : 3)} MB`;
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
    const servicesPayload = JSON.stringify(selectedServices);
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

    if (selectedServices.length === 0) {
      setError("Please select at least one clinic service.");
      return;
    }

    if (!openingHours) {
      setError("Opening hours are required.");
      return;
    }

    if (!verificationFiles.business_registration) {
      setError("Business registration document is required.");
      return;
    }

    if (!verificationFiles.business_permit) {
      setError("Current business or mayor's permit is required.");
      return;
    }

    if (!verificationFiles.owner_government_id) {
      setError("Clinic Owner government-issued ID is required.");
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

      const registrationPayload = new FormData();

      registrationPayload.append("owner_name", ownerName);
      registrationPayload.append("owner_email", ownerEmail);
      registrationPayload.append("password", password);
      registrationPayload.append("clinic_name", clinicName);
      registrationPayload.append("address", address);
      registrationPayload.append("latitude", latitude);
      registrationPayload.append("longitude", longitude);
      registrationPayload.append("contact_number", contactNumber);
      registrationPayload.append("services", servicesPayload);
      registrationPayload.append("opening_hours", openingHours);
      registrationPayload.append("turnstileToken", turnstileToken);

      registrationPayload.append(
        "business_registration",
        verificationFiles.business_registration,
      );
      registrationPayload.append(
        "business_permit",
        verificationFiles.business_permit,
      );
      registrationPayload.append(
        "owner_government_id",
        verificationFiles.owner_government_id,
      );

      if (verificationFiles.clinic_license) {
        registrationPayload.append(
          "clinic_license",
          verificationFiles.clinic_license,
        );
      }

      const response = await API.post(
        "/api/clinics/register",
        registrationPayload,
      );

      setSuccess(
        response.data?.message ||
          "Clinic application submitted successfully. Your account and clinic will remain inactive until an Administrator approves the submitted documents.",
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
      subtitle="Submit your first clinic location for Administrator verification"
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

      {!success && (
        <>
          <div className="info-message" style={{ marginBottom: "16px" }}>
            <strong>Administrator Approval Required:</strong> Your Clinic Owner
            account and first clinic location will remain inactive while the
            submitted clinic documents are reviewed. The Free shared
            subscription is assigned only after approval.
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

            <fieldset className="clinic-verification-section">
              <legend>
                Clinic Verification Documents{" "}
                <span className="auth-required">*</span>
              </legend>

              <div className="clinic-verification-intro">
                <strong>Administrator validation is required.</strong>
                <span>
                  Upload clear and current documents. Accepted formats: PDF,
                  JPG, JPEG, PNG, and WEBP. Maximum file size: 10 MB each.
                </span>
              </div>

              <div className="clinic-verification-grid">
                <div className="clinic-verification-upload">
                  <label htmlFor="business_registration">
                    Business Registration{" "}
                    <span className="auth-required">*</span>
                  </label>
                  <small>
                    SEC, DTI, CDA, or another applicable business registration
                    document.
                  </small>
                  <input
                    ref={businessRegistrationRef}
                    id="business_registration"
                    name="business_registration"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                    onChange={(event) =>
                      handleVerificationFileChange(
                        "business_registration",
                        event,
                      )
                    }
                    disabled={loading}
                    required
                  />
                  {verificationFiles.business_registration && (
                    <div className="clinic-verification-file-selected">
                      <span>
                        {verificationFiles.business_registration.name}
                      </span>
                      <small>
                        {formatFileSize(
                          verificationFiles.business_registration.size,
                        )}
                      </small>
                    </div>
                  )}
                </div>

                <div className="clinic-verification-upload">
                  <label htmlFor="business_permit">
                    Current Business / Mayor's Permit{" "}
                    <span className="auth-required">*</span>
                  </label>
                  <small>
                    Upload the current permit showing that the clinic is allowed
                    to operate at the registered address.
                  </small>
                  <input
                    ref={businessPermitRef}
                    id="business_permit"
                    name="business_permit"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                    onChange={(event) =>
                      handleVerificationFileChange("business_permit", event)
                    }
                    disabled={loading}
                    required
                  />
                  {verificationFiles.business_permit && (
                    <div className="clinic-verification-file-selected">
                      <span>{verificationFiles.business_permit.name}</span>
                      <small>
                        {formatFileSize(verificationFiles.business_permit.size)}
                      </small>
                    </div>
                  )}
                </div>

                <div className="clinic-verification-upload">
                  <label htmlFor="owner_government_id">
                    Clinic Owner Government-Issued ID{" "}
                    <span className="auth-required">*</span>
                  </label>
                  <small>
                    Upload a clear copy of a valid government-issued ID
                    belonging to the registering Clinic Owner.
                  </small>
                  <input
                    ref={ownerGovernmentIdRef}
                    id="owner_government_id"
                    name="owner_government_id"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                    onChange={(event) =>
                      handleVerificationFileChange("owner_government_id", event)
                    }
                    disabled={loading}
                    required
                  />
                  {verificationFiles.owner_government_id && (
                    <div className="clinic-verification-file-selected">
                      <span>{verificationFiles.owner_government_id.name}</span>
                      <small>
                        {formatFileSize(
                          verificationFiles.owner_government_id.size,
                        )}
                      </small>
                    </div>
                  )}
                </div>

                <div className="clinic-verification-upload">
                  <label htmlFor="clinic_license">
                    Clinic License / Accreditation
                    <span className="clinic-verification-optional">
                      Optional
                    </span>
                  </label>
                  <small>
                    Upload an operating license, accreditation, or another
                    supporting clinic document when available.
                  </small>
                  <input
                    ref={clinicLicenseRef}
                    id="clinic_license"
                    name="clinic_license"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                    onChange={(event) =>
                      handleVerificationFileChange("clinic_license", event)
                    }
                    disabled={loading}
                  />
                  {verificationFiles.clinic_license && (
                    <div className="clinic-verification-file-selected">
                      <span>{verificationFiles.clinic_license.name}</span>
                      <small>
                        {formatFileSize(verificationFiles.clinic_license.size)}
                      </small>
                    </div>
                  )}
                </div>
              </div>

              <div className="clinic-verification-privacy-note">
                Documents are available only to authorized Administrators for
                clinic application review.
              </div>
            </fieldset>

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
              {loading
                ? "Submitting Application..."
                : "Submit Clinic Application"}
            </AuthButton>
          </form>
        </>
      )}

      {success ? (
        <section
          className="clinic-application-confirmation"
          aria-live="polite"
          aria-labelledby="clinic-application-confirmation-title"
        >
          <div
            className="clinic-application-confirmation-icon"
            aria-hidden="true"
          >
            ✓
          </div>

          <div className="clinic-application-confirmation-heading">
            <span>Application Submitted</span>
            <h2 id="clinic-application-confirmation-title">
              Your clinic application is pending Administrator review
            </h2>
          </div>

          <p className="clinic-application-confirmation-message">{success}</p>

          <div className="clinic-application-pending-status">
            <span
              className="clinic-application-pending-dot"
              aria-hidden="true"
            />
            <div>
              <strong>Status: Pending Review</strong>
              <p>
                Your Clinic Owner account and clinic location remain inactive
                until an Administrator validates the submitted information and
                documents.
              </p>
            </div>
          </div>

          <div className="clinic-application-next-steps">
            <h3>What happens next?</h3>

            <ol>
              <li>
                An Administrator reviews the clinic details and verification
                documents.
              </li>
              <li>
                Once approved, the clinic and Clinic Owner account are
                activated.
              </li>
              <li>
                You may then sign in using the registered Clinic Owner email and
                password.
              </li>
            </ol>
          </div>

          <div className="clinic-application-confirmation-note">
            Attempting to sign in before approval will show that the clinic
            application is still pending.
          </div>

          <div className="clinic-application-confirmation-actions">
            <AuthButton type="button" onClick={() => navigate("/auth/login")}>
              Go to Login
            </AuthButton>

            <button
              type="button"
              className="secondary-button clinic-application-another-button"
              onClick={() => {
                setSuccess("");
                setError("");
                setPasswordRules([]);
                resetForm();
              }}
            >
              Submit Another Application
            </button>
          </div>
        </section>
      ) : (
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
      )}
    </AuthLayout>
  );
}

export default ClinicRegister;
