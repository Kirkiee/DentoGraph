import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import API from "../api/axios";

const EMPTY_FORM = {
  clinic_id: "",
  name: "",
  email: "",
  contact_number: "",
  address: "",
  date_of_birth: "",
  gender: "",
  medical_history: "",
  dentition_type: "Adult",
  emergency_contact_name: "",
  emergency_contact_number: "",
  temporary_password: "",
  consent_confirmed: false,
};

const getStoredRole = () => {
  try {
    const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
    return storedUser.role || "";
  } catch {
    return "";
  }
};

function WalkInPatientRegistration() {
  const role = getStoredRole();

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [clinics, setClinics] = useState([]);
  const [registrationMode, setRegistrationMode] = useState("");
  const [loadingContext, setLoadingContext] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [contextError, setContextError] = useState("");
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [credentials, setCredentials] = useState(null);
  const [passwordCopied, setPasswordCopied] = useState(false);

  const selectedClinic = useMemo(
    () =>
      clinics.find(
        (clinic) => Number(clinic.clinic_id) === Number(formData.clinic_id),
      ) || null,
    [clinics, formData.clinic_id],
  );

  const activeClinics = useMemo(
    () => clinics.filter((clinic) => clinic.status === "Active"),
    [clinics],
  );

  const isOwnerSelection = registrationMode === "OWNER_LOCATION_SELECTION";

  const fetchContext = async () => {
    try {
      setLoadingContext(true);
      setContextError("");

      const response = await API.get("/api/walk-in-patients/context");
      const loadedClinics = Array.isArray(response.data?.clinics)
        ? response.data.clinics
        : [];

      setClinics(loadedClinics);
      setRegistrationMode(response.data?.registration_mode || "");

      const defaultClinic =
        loadedClinics.find((clinic) => clinic.status === "Active") ||
        loadedClinics[0];

      setFormData((previous) => ({
        ...previous,
        clinic_id: defaultClinic ? String(defaultClinic.clinic_id) : "",
      }));
    } catch (err) {
      setContextError(
        err.response?.data?.error ||
          "Unable to load the walk-in registration context.",
      );
    } finally {
      setLoadingContext(false);
    }
  };

  useEffect(() => {
    fetchContext();
  }, []);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));

    setFormError("");
    setSuccessMessage("");
  };

  const validateForm = () => {
    if (!formData.clinic_id) {
      return "Select a clinic location.";
    }

    if (!formData.name.trim()) {
      return "Enter the patient's full name.";
    }

    if (!formData.email.trim()) {
      return "Enter the patient's email address.";
    }

    if (!formData.contact_number.trim()) {
      return "Enter the patient's contact number.";
    }

    if (!["Adult", "Child"].includes(formData.dentition_type)) {
      return "Select Adult or Child dental chart type.";
    }

    if (formData.temporary_password && formData.temporary_password.length < 8) {
      return "The temporary password must contain at least 8 characters.";
    }

    if (!formData.consent_confirmed) {
      return "Confirm that the patient gave consent for account creation.";
    }

    return "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setFormError(validationError);
      return;
    }

    try {
      setSubmitting(true);
      setFormError("");
      setSuccessMessage("");
      setCredentials(null);
      setPasswordCopied(false);

      const payload = {
        ...formData,
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        contact_number: formData.contact_number.trim(),
        address: formData.address.trim(),
        medical_history: formData.medical_history.trim(),
        emergency_contact_name: formData.emergency_contact_name.trim(),
        emergency_contact_number: formData.emergency_contact_number.trim(),
        temporary_password: formData.temporary_password,
        consent_confirmed: Boolean(formData.consent_confirmed),
      };

      const response = await API.post("/api/walk-in-patients", payload);

      const createdCredentials = response.data?.temporary_credentials || null;

      setCredentials(createdCredentials);
      setSuccessMessage(
        response.data?.message ||
          "Walk-in patient account created successfully.",
      );

      setFormData((previous) => ({
        ...EMPTY_FORM,
        clinic_id: previous.clinic_id,
        dentition_type: "Adult",
      }));
    } catch (err) {
      setFormError(
        err.response?.data?.error ||
          "Unable to create the walk-in patient account.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const copyTemporaryPassword = async () => {
    if (!credentials?.temporary_password) return;

    try {
      await navigator.clipboard.writeText(credentials.temporary_password);
      setPasswordCopied(true);
    } catch {
      setPasswordCopied(false);
    }
  };

  const closeCredentials = () => {
    setCredentials(null);
    setSuccessMessage("");
    setPasswordCopied(false);
  };

  return (
    <DashboardLayout role={role}>
      <div className="appointments-list-card clinic-owner-staff-page walk-in-registration-page">
        <div className="appointments-header">
          <div>
            <h2>Walk-in Patient Registration</h2>
            <p>
              Create a Patient account for a customer who is registering
              directly at the clinic.
            </p>
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={fetchContext}
            disabled={loadingContext || submitting}
          >
            {loadingContext ? "Loading..." : "Refresh Clinic"}
          </button>
        </div>

        <div className="info-message walk-in-registration-notice">
          <strong>Registration rules:</strong> The Patient account will be
          assigned to one clinic location. No appointment or dental record is
          created automatically. The temporary password is shown only after a
          successful registration.
        </div>

        {contextError && (
          <div className="error-message">
            <strong>Clinic access error</strong>
            <p>{contextError}</p>
          </div>
        )}

        {formError && (
          <div className="error-message">
            <strong>Registration notice</strong>
            <p>{formError}</p>
          </div>
        )}

        {successMessage && !credentials && (
          <div className="success-message">{successMessage}</div>
        )}

        {loadingContext ? (
          <div className="loading-state">
            Loading authorized clinic location...
          </div>
        ) : clinics.length === 0 ? (
          <div className="empty-state">
            No clinic location is available for walk-in registration.
          </div>
        ) : (
          <form
            className="appointment-form walk-in-registration-form"
            onSubmit={handleSubmit}
          >
            <section className="staff-section walk-in-form-section">
              <div className="appointments-header">
                <div>
                  <h2>Clinic Assignment</h2>
                  <p>
                    {isOwnerSelection
                      ? "Choose one active clinic location that you own."
                      : "The patient will be assigned to your clinic location."}
                  </p>
                </div>
              </div>

              <div className="clinic-location-panel">
                <div className="clinic-location-grid walk-in-location-grid">
                  <div className="clinic-location-field">
                    <label>
                      Clinic Location <span className="auth-required">*</span>
                    </label>

                    <select
                      name="clinic_id"
                      value={formData.clinic_id}
                      onChange={handleChange}
                      disabled={!isOwnerSelection || submitting}
                      required
                    >
                      <option value="">Select clinic location</option>
                      {clinics.map((clinic) => (
                        <option
                          key={clinic.clinic_id}
                          value={clinic.clinic_id}
                          disabled={clinic.status !== "Active"}
                        >
                          {clinic.clinic_name}
                          {clinic.status !== "Active"
                            ? ` (${clinic.status})`
                            : ""}
                        </option>
                      ))}
                    </select>

                    {activeClinics.length === 0 && (
                      <small className="walk-in-field-warning">
                        No active clinic location is available.
                      </small>
                    )}
                  </div>

                  <div className="clinic-location-field">
                    <label>Registration Access</label>
                    <div className="clinic-location-readonly">
                      {isOwnerSelection
                        ? "Owned clinic location"
                        : "Assigned clinic location"}
                    </div>
                  </div>
                </div>

                {selectedClinic && (
                  <div className="clinic-location-note">
                    <strong>{selectedClinic.clinic_name}</strong> is the clinic
                    location where this Patient account will be assigned. No
                    appointment or dental record will be created automatically.
                  </div>
                )}
              </div>
            </section>

            <section className="staff-section walk-in-form-section">
              <div className="appointments-header">
                <div>
                  <h2>Patient Account</h2>
                  <p>
                    These credentials will be used by the patient to access
                    DentoGraph.
                  </p>
                </div>
              </div>

              <div className="staff-form-card walk-in-form-card">
                <div className="form-row">
                  <div className="form-group">
                    <label>
                      Full Name <span className="auth-required">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Enter patient full name"
                      disabled={submitting}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      Email Address <span className="auth-required">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="patient@example.com"
                      disabled={submitting}
                      autoComplete="off"
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>
                      Contact Number <span className="auth-required">*</span>
                    </label>
                    <input
                      type="tel"
                      name="contact_number"
                      value={formData.contact_number}
                      onChange={handleChange}
                      placeholder="09XXXXXXXXX"
                      disabled={submitting}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Temporary Password</label>
                    <input
                      type="text"
                      name="temporary_password"
                      value={formData.temporary_password}
                      onChange={handleChange}
                      placeholder="Leave blank to generate automatically"
                      disabled={submitting}
                      autoComplete="off"
                      minLength="8"
                    />
                    <small>
                      Leave blank to let DentoGraph generate a secure temporary
                      password.
                    </small>
                  </div>
                </div>
              </div>
            </section>

            <section className="staff-section walk-in-form-section">
              <div className="appointments-header">
                <div>
                  <h2>Patient Profile</h2>
                  <p>
                    Record the patient's identifying and dental chart
                    information.
                  </p>
                </div>
              </div>

              <div className="staff-form-card walk-in-form-card">
                <div className="form-row">
                  <div className="form-group">
                    <label>Date of Birth</label>
                    <input
                      type="date"
                      name="date_of_birth"
                      value={formData.date_of_birth}
                      onChange={handleChange}
                      disabled={submitting}
                      max={new Date().toISOString().split("T")[0]}
                    />
                  </div>

                  <div className="form-group">
                    <label>Gender</label>
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                      disabled={submitting}
                    >
                      <option value="">Select gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Prefer not to say">
                        Prefer not to say
                      </option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>
                      Dental Chart Type <span className="auth-required">*</span>
                    </label>
                    <select
                      name="dentition_type"
                      value={formData.dentition_type}
                      onChange={handleChange}
                      disabled={submitting}
                      required
                    >
                      <option value="Adult">Adult</option>
                      <option value="Child">Child</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Home Address</label>
                    <input
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      placeholder="Enter patient home address"
                      disabled={submitting}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Medical History or Important Notes</label>
                  <textarea
                    name="medical_history"
                    value={formData.medical_history}
                    onChange={handleChange}
                    placeholder="Enter allergies, medical conditions, medications, or leave blank"
                    rows="4"
                    disabled={submitting}
                  />
                </div>
              </div>
            </section>

            <section className="staff-section walk-in-form-section">
              <div className="appointments-header">
                <div>
                  <h2>Emergency Contact</h2>
                  <p>
                    Add the person the clinic may contact during an emergency.
                  </p>
                </div>
              </div>

              <div className="staff-form-card walk-in-form-card">
                <div className="form-row">
                  <div className="form-group">
                    <label>Emergency Contact Name</label>
                    <input
                      type="text"
                      name="emergency_contact_name"
                      value={formData.emergency_contact_name}
                      onChange={handleChange}
                      placeholder="Enter contact person's name"
                      disabled={submitting}
                    />
                  </div>

                  <div className="form-group">
                    <label>Emergency Contact Number</label>
                    <input
                      type="tel"
                      name="emergency_contact_number"
                      value={formData.emergency_contact_number}
                      onChange={handleChange}
                      placeholder="Enter emergency contact number"
                      disabled={submitting}
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="staff-section walk-in-consent-section">
              <div className="staff-form-card walk-in-form-card">
                <label className="walk-in-consent-control">
                  <input
                    type="checkbox"
                    name="consent_confirmed"
                    checked={formData.consent_confirmed}
                    onChange={handleChange}
                    disabled={submitting}
                  />

                  <span>
                    I confirm that the patient or authorized guardian gave
                    permission for this clinic to create and manage this
                    DentoGraph Patient account.{" "}
                    <span className="auth-required">*</span>
                  </span>
                </label>
              </div>
            </section>

            <div className="walk-in-form-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  setFormData((previous) => ({
                    ...EMPTY_FORM,
                    clinic_id: previous.clinic_id,
                  }))
                }
                disabled={submitting}
              >
                Clear Form
              </button>

              <button
                type="submit"
                className="primary-button"
                disabled={
                  submitting ||
                  activeClinics.length === 0 ||
                  !formData.clinic_id
                }
              >
                {submitting
                  ? "Creating Patient Account..."
                  : "Create Walk-in Patient"}
              </button>
            </div>
          </form>
        )}

        {credentials && (
          <div
            className="modal-overlay"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                event.preventDefault();
              }
            }}
          >
            <div
              className="modal-card walk-in-credentials-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="walk-in-credentials-title"
            >
              <div className="modal-header">
                <div>
                  <h3 id="walk-in-credentials-title">
                    Patient Account Created
                  </h3>
                  <p>
                    Give these temporary credentials directly to the patient.
                  </p>
                </div>
              </div>

              <div className="success-message">{successMessage}</div>

              <div className="walk-in-credential-warning">
                This password is displayed only once. The patient must change it
                after signing in.
              </div>

              <div className="walk-in-credential-card">
                <div>
                  <span>Email Address</span>
                  <strong>{credentials.email}</strong>
                </div>

                <div>
                  <span>Temporary Password</span>
                  <strong className="walk-in-temporary-password">
                    {credentials.temporary_password}
                  </strong>
                </div>
              </div>

              <div className="walk-in-credential-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={copyTemporaryPassword}
                >
                  {passwordCopied ? "Password Copied" : "Copy Password"}
                </button>

                <button
                  type="button"
                  className="primary-button"
                  onClick={closeCredentials}
                >
                  I Have Saved the Credentials
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default WalkInPatientRegistration;
