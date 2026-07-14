import React, { useEffect, useMemo, useState } from "react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import API from "../api/axios";
import { useNavigate } from "react-router-dom";

function ClinicOwnerStaff() {
  const navigate = useNavigate();

  const [clinicLocations, setClinicLocations] = useState([]);
  const [selectedClinicId, setSelectedClinicId] = useState("");
  const [clinic, setClinic] = useState(null);
  const [staff, setStaff] = useState([]);

  const [formData, setFormData] = useState({
    clinic_id: "",
    name: "",
    email: "",
    password: "",
    staff_role: "Dentist",
    license_number: "",
    specialization: "",
    availability: "",
  });

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [resendingId, setResendingId] = useState(null);

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState("Active");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedClinic = useMemo(() => {
    return (
      clinicLocations.find(
        (location) => String(location.clinic_id) === String(selectedClinicId),
      ) || null
    );
  }, [clinicLocations, selectedClinicId]);

  useEffect(() => {
    fetchClinicLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedClinicId) {
      fetchStaff(selectedClinicId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClinicId]);

  const fetchClinicLocations = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await API.get("/api/clinics/owner/locations");

      const locations =
        response.data.locations ||
        response.data.clinics ||
        response.data.clinic_locations ||
        [];

      setClinicLocations(locations);

      if (locations.length > 0) {
        const firstClinicId = String(locations[0].clinic_id);

        setSelectedClinicId(firstClinicId);
        setFormData((prev) => ({
          ...prev,
          clinic_id: firstClinicId,
        }));
      } else {
        setSelectedClinicId("");
        setClinic(null);
        setStaff([]);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load clinic locations.");
      setClinicLocations([]);
      setSelectedClinicId("");
      setClinic(null);
      setStaff([]);
      setLoading(false);
    }
  };

  const fetchStaff = async (clinicId = selectedClinicId) => {
    if (!clinicId) {
      setStaff([]);
      setClinic(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await API.get(
        `/api/users/clinic-owner/staff?clinic_id=${clinicId}`,
      );

      setClinic(response.data.clinic || selectedClinic || null);
      setStaff(response.data.staff || []);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load clinic staff.");
      setStaff([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClinicChange = (e) => {
    const clinicId = e.target.value;

    setMessage("");
    setError("");
    setSelectedClinicId(clinicId);
    setFormData((prev) => ({
      ...prev,
      clinic_id: clinicId,
    }));
  };

  const handleChange = (e) => {
    setMessage("");
    setError("");

    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const resetForm = () => {
    setFormData({
      clinic_id: selectedClinicId || "",
      name: "",
      email: "",
      password: "",
      staff_role: "Dentist",
      license_number: "",
      specialization: "",
      availability: "",
    });
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

  const handleCreateStaff = async (e) => {
    e.preventDefault();

    if (creating) return;

    const cleanName = formData.name.trim();
    const cleanEmail = formData.email.trim().toLowerCase();
    const cleanPassword = formData.password;
    const clinicId = formData.clinic_id || selectedClinicId;

    setMessage("");
    setError("");

    if (!clinicId) {
      setError("Please select the clinic location for this staff account.");
      return;
    }

    if (!cleanName) {
      setError("Staff full name is required.");
      return;
    }

    if (!cleanEmail) {
      setError("Staff email address is required.");
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      setError("Please enter a valid staff email address.");
      return;
    }

    const passwordError = validatePasswordStrength(cleanPassword);

    if (passwordError) {
      setError(passwordError);
      return;
    }

    try {
      setCreating(true);

      const payload = {
        ...formData,
        clinic_id: Number(clinicId),
        name: cleanName,
        email: cleanEmail,
        license_number: formData.license_number.trim() || null,
        specialization:
          formData.staff_role === "Dentist"
            ? formData.specialization.trim() || null
            : null,
        availability: formData.availability.trim() || null,
      };

      const response = await API.post("/api/users/clinic-owner/staff", payload);

      setMessage(
        response.data.message ||
          "Staff account created successfully. A verification email has been sent.",
      );

      resetForm();
      fetchStaff(clinicId);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to create staff account.");
    } finally {
      setCreating(false);
    }
  };

  const openStatusModal = (person) => {
    setSelectedStaff(person);
    setSelectedStatus(person.status || "Active");
    setMessage("");
    setError("");
    setShowStatusModal(true);
  };

  const closeStatusModal = () => {
    if (updatingStatus) return;

    setShowStatusModal(false);
    setSelectedStaff(null);
    setSelectedStatus("Active");
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();

    if (!selectedStaff) {
      setError("No staff member selected.");
      return;
    }

    try {
      setUpdatingStatus(true);
      setMessage("");
      setError("");

      const response = await API.put(
        `/api/users/clinic-owner/staff/${selectedStaff.user_id}/status`,
        {
          status: selectedStatus,
        },
      );

      setMessage(
        response.data.message ||
          `${selectedStaff.name}'s account status updated successfully.`,
      );

      closeStatusModal();
      fetchStaff(selectedClinicId);
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to update staff account status.",
      );
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleResendVerification = async (person) => {
    if (!person?.user_id) {
      setError("No staff member selected.");
      return;
    }

    try {
      setResendingId(person.user_id);
      setMessage("");
      setError("");

      const response = await API.post(
        `/api/users/clinic-owner/staff/${person.user_id}/resend-verification`,
      );

      setMessage(
        response.data?.message ||
          `Verification email resent to ${person.name}.`,
      );

      fetchStaff(selectedClinicId);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Unable to resend staff verification email.",
      );
    } finally {
      setResendingId(null);
    }
  };

  const getRoleLabel = (person) => {
    if (person.role_name === "Dentist") return "Dentist";
    return "Dental Assistant";
  };

  const getLicenseNumber = (person) => {
    return (
      person.dentist_license_number || person.assistant_license_number || "N/A"
    );
  };

  const getAvailability = (person) => {
    return (
      person.dentist_availability || person.assistant_availability || "N/A"
    );
  };

  const getSpecialization = (person) => {
    if (person.role_name !== "Dentist") return "N/A";
    return person.specialization || "General Dentistry";
  };

  const getStaffClinicName = (person) => {
    return (
      person.clinic_name ||
      person.dentist_clinic_name ||
      person.assistant_clinic_name ||
      clinic?.clinic_name ||
      selectedClinic?.clinic_name ||
      "N/A"
    );
  };

  const getStatusClass = (status) => {
    switch (status) {
      case "Inactive":
        return "status-badge status-cancelled";
      case "Active":
      default:
        return "status-badge status-scheduled";
    }
  };

  const getVerificationClass = (emailVerified) => {
    return emailVerified
      ? "status-badge status-completed"
      : "status-badge status-pending";
  };

  const getVerificationLabel = (emailVerified) => {
    return emailVerified ? "Verified" : "Unverified";
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return "N/A";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) return "N/A";

    return date.toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const dentistCount = staff.filter(
    (person) => person.role_name === "Dentist",
  ).length;

  const assistantCount = staff.filter((person) =>
    ["Assistant", "Dental Assistant"].includes(person.role_name),
  ).length;

  const activeStaffCount = staff.filter(
    (person) => person.status !== "Inactive",
  ).length;

  const unverifiedStaffCount = staff.filter(
    (person) => !person.email_verified,
  ).length;

  const displayedClinic = clinic || selectedClinic;

  return (
    <DashboardLayout role="Clinic Owner">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>Clinic Staff Management</h2>
            <p>
              Manage dentist and dental assistant accounts for each clinic
              location under your clinic owner account.
            </p>
          </div>

          <div className="appointment-actions" style={{ flexDirection: "row" }}>
            <button
              className="secondary-button"
              onClick={() => navigate("/clinic-owner/dashboard")}
              disabled={loading || creating || updatingStatus}
            >
              Back to Dashboard
            </button>

            <button
              className="secondary-button"
              onClick={() => fetchStaff(selectedClinicId)}
              disabled={
                loading || creating || updatingStatus || !selectedClinicId
              }
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}

        <div className="staff-section">
          <div className="appointments-header">
            <div>
              <h2>Location Assignment</h2>
              <p>
                Choose the clinic location where staff will be viewed or added.
              </p>
            </div>
          </div>

          <div className="clinic-location-panel">
            <div className="clinic-location-grid">
              <div className="clinic-location-field">
                <label>
                  Clinic Location <span className="auth-required">*</span>
                </label>

                <select
                  name="clinic_id"
                  value={selectedClinicId}
                  onChange={handleClinicChange}
                  disabled={loading || creating || updatingStatus}
                  required
                >
                  {clinicLocations.length === 0 ? (
                    <option value="">No clinic locations available</option>
                  ) : (
                    clinicLocations.map((location) => (
                      <option
                        key={location.clinic_id}
                        value={location.clinic_id}
                      >
                        {location.clinic_name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="clinic-location-field">
                <label>Shared Subscription</label>
                <div className="clinic-location-readonly">
                  {displayedClinic?.plan_name ||
                    selectedClinic?.plan_name ||
                    "No active plan"}
                </div>
              </div>
            </div>

            {displayedClinic && (
              <div className="clinic-location-note">
                <strong>{displayedClinic.clinic_name}</strong> is the active
                clinic location for this page. Staff created here will be
                assigned to this location, while subscription limits are shared
                across all locations under your clinic owner account.
              </div>
            )}
          </div>
        </div>

        <div className="staff-section">
          <div className="appointments-header">
            <div>
              <h2>Clinic Summary</h2>
              <p>
                This section shows the selected clinic location and current
                staff usage.
              </p>
            </div>
          </div>

          <div className="staff-summary-grid">
            <div className="staff-summary-card">
              <span>Selected Location</span>
              <strong>
                {displayedClinic?.clinic_name || "No clinic loaded"}
              </strong>
              <p>{displayedClinic?.plan_name || "No active plan"}</p>
            </div>

            <div className="staff-summary-card">
              <span>Total Staff</span>
              <strong>{staff.length}</strong>
              <p>{activeStaffCount} active account(s)</p>
            </div>

            <div className="staff-summary-card">
              <span>Dentists</span>
              <strong>
                {dentistCount}
                {displayedClinic?.max_dentists !== null &&
                displayedClinic?.max_dentists !== undefined
                  ? ` / ${displayedClinic.max_dentists}`
                  : ""}
              </strong>
              <p>Dental provider accounts</p>
            </div>

            <div className="staff-summary-card">
              <span>Assistants</span>
              <strong>
                {assistantCount}
                {displayedClinic?.max_assistants !== null &&
                displayedClinic?.max_assistants !== undefined
                  ? ` / ${displayedClinic.max_assistants}`
                  : ""}
              </strong>
              <p>Clinic support accounts</p>
            </div>

            <div className="staff-summary-card">
              <span>Unverified</span>
              <strong>{unverifiedStaffCount}</strong>
              <p>Waiting for email verification</p>
            </div>
          </div>
        </div>

        <div className="staff-section">
          <div className="appointments-header">
            <div>
              <h2>Add Staff Account</h2>
              <p>
                Create a user account under the selected clinic location. Staff
                must verify their email before logging in.
              </p>
            </div>
          </div>

          <div className="staff-form-card">
            <div className="info-message" style={{ marginBottom: "16px" }}>
              Fields marked with <span className="auth-required">*</span> are
              required. Staff accounts are separate user accounts, but each one
              is assigned to a specific clinic location.
            </div>

            <form className="appointment-form" onSubmit={handleCreateStaff}>
              <div className="form-row">
                <div className="form-group">
                  <label>
                    Clinic Location <span className="auth-required">*</span>
                  </label>
                  <select
                    name="clinic_id"
                    value={formData.clinic_id}
                    onChange={handleChange}
                    disabled={creating || loading}
                    required
                  >
                    {clinicLocations.length === 0 ? (
                      <option value="">No clinic locations available</option>
                    ) : (
                      clinicLocations.map((location) => (
                        <option
                          key={location.clinic_id}
                          value={location.clinic_id}
                        >
                          {location.clinic_name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="form-group">
                  <label>
                    Staff Role <span className="auth-required">*</span>
                  </label>
                  <select
                    name="staff_role"
                    value={formData.staff_role}
                    onChange={handleChange}
                    disabled={creating}
                    required
                  >
                    <option value="Dentist">Dentist</option>
                    <option value="Assistant">Dental Assistant</option>
                  </select>
                </div>
              </div>

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
                    placeholder="Enter staff full name"
                    disabled={creating}
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
                    placeholder="staff@clinic.com"
                    disabled={creating}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>
                    Temporary Password <span className="auth-required">*</span>
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Minimum 8 characters"
                    disabled={creating}
                    required
                  />
                  <small>
                    Must include uppercase, lowercase, number, and special
                    character.
                  </small>
                </div>

                <div className="form-group">
                  <label>License Number</label>
                  <input
                    type="text"
                    name="license_number"
                    value={formData.license_number}
                    onChange={handleChange}
                    placeholder={
                      formData.staff_role === "Dentist"
                        ? "Example: DEN-12345"
                        : "Example: AST-12345"
                    }
                    disabled={creating}
                  />
                </div>
              </div>

              <div className="form-row">
                {formData.staff_role === "Dentist" && (
                  <div className="form-group">
                    <label>Specialization</label>
                    <input
                      type="text"
                      name="specialization"
                      value={formData.specialization}
                      onChange={handleChange}
                      placeholder="Example: General Dentistry"
                      disabled={creating}
                    />
                  </div>
                )}

                <div className="form-group">
                  <label>Availability</label>
                  <input
                    type="text"
                    name="availability"
                    value={formData.availability}
                    onChange={handleChange}
                    placeholder="Example: Monday to Friday, 9:00 AM - 5:00 PM"
                    disabled={creating}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="primary-button"
                disabled={creating || !formData.clinic_id}
              >
                {creating ? "Creating..." : "Create Staff Account"}
              </button>
            </form>
          </div>
        </div>

        <div className="staff-section">
          <div className="appointments-header">
            <div>
              <h2>Clinic Staff List</h2>
              <p>
                View staff user accounts, email verification, account status,
                and role-specific details for the selected clinic location.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="payment-loading-card">
              <p>Loading clinic staff...</p>
            </div>
          ) : staff.length === 0 ? (
            <div className="empty-state">
              <h3>No staff yet</h3>
              <p>Created dentist and assistant accounts will appear here.</p>
            </div>
          ) : (
            <div className="staff-table-wrapper">
              <table className="staff-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Clinic Location</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Email Verification</th>
                    <th>License</th>
                    <th>Specialization</th>
                    <th>Availability</th>
                    <th>Created At</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {staff.map((person) => {
                    const isVerified = Boolean(person.email_verified);
                    const isInactive = person.status === "Inactive";
                    const isResending = resendingId === person.user_id;

                    return (
                      <tr key={person.user_id}>
                        <td>
                          <strong>{person.name}</strong>
                        </td>

                        <td>
                          <span className="staff-email-text">
                            {person.email}
                          </span>
                        </td>

                        <td>{getStaffClinicName(person)}</td>

                        <td>{getRoleLabel(person)}</td>

                        <td>
                          <span className={getStatusClass(person.status)}>
                            {person.status || "Active"}
                          </span>
                        </td>

                        <td>
                          <span className={getVerificationClass(isVerified)}>
                            {getVerificationLabel(isVerified)}
                          </span>
                        </td>

                        <td>{getLicenseNumber(person)}</td>

                        <td>{getSpecialization(person)}</td>

                        <td>{getAvailability(person)}</td>

                        <td>{formatDate(person.created_at)}</td>

                        <td>
                          <div className="staff-table-actions">
                            {!isVerified && !isInactive && (
                              <button
                                className="secondary-button"
                                onClick={() => handleResendVerification(person)}
                                disabled={
                                  updatingStatus ||
                                  loading ||
                                  creating ||
                                  isResending
                                }
                              >
                                {isResending ? "Sending..." : "Resend"}
                              </button>
                            )}

                            <button
                              className={
                                person.status === "Inactive"
                                  ? "primary-button"
                                  : "danger-button"
                              }
                              onClick={() => openStatusModal(person)}
                              disabled={updatingStatus || isResending}
                            >
                              {person.status === "Inactive"
                                ? "Activate"
                                : "Deactivate"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showStatusModal && selectedStaff && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>Update Staff Status</h3>
                <p>
                  Change the account status for this staff user. Inactive users
                  should not be able to access the system.
                </p>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closeStatusModal}
                disabled={updatingStatus}
              >
                ×
              </button>
            </div>

            <form className="modal-form" onSubmit={handleUpdateStatus}>
              <div className="info-message">
                <strong>Staff:</strong> {selectedStaff.name}
                <br />
                <strong>Email:</strong> {selectedStaff.email}
                <br />
                <strong>Clinic Location:</strong>{" "}
                {getStaffClinicName(selectedStaff)}
                <br />
                <strong>Role:</strong> {getRoleLabel(selectedStaff)}
                <br />
                <strong>Current Status:</strong>{" "}
                {selectedStaff.status || "Active"}
                <br />
                <strong>Email Verification:</strong>{" "}
                {getVerificationLabel(Boolean(selectedStaff.email_verified))}
              </div>

              <div className="form-group">
                <label>New Status</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  required
                  disabled={updatingStatus}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeStatusModal}
                  disabled={updatingStatus}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className={
                    selectedStatus === "Inactive"
                      ? "danger-button"
                      : "primary-button"
                  }
                  disabled={updatingStatus}
                >
                  {updatingStatus ? "Saving..." : "Update Status"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default ClinicOwnerStaff;
