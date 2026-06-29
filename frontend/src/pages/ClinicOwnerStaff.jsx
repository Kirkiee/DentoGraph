import React, { useEffect, useState } from "react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import API from "../api/axios";
import { useNavigate } from "react-router-dom";

function ClinicOwnerStaff() {
  const navigate = useNavigate();

  const [clinic, setClinic] = useState(null);
  const [staff, setStaff] = useState([]);

  const [formData, setFormData] = useState({
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

  useEffect(() => {
    fetchStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await API.get("/api/users/clinic-owner/staff");

      setClinic(response.data.clinic || null);
      setStaff(response.data.staff || []);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load clinic staff.");
    } finally {
      setLoading(false);
    }
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

  const handleCreateStaff = async (e) => {
    e.preventDefault();

    const cleanName = formData.name.trim();
    const cleanEmail = formData.email.trim().toLowerCase();
    const cleanPassword = formData.password;

    if (!cleanName || !cleanEmail || !cleanPassword) {
      setError("Name, email, and password are required.");
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (cleanPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    try {
      setCreating(true);
      setMessage("");
      setError("");

      const payload = {
        ...formData,
        name: cleanName,
        email: cleanEmail,
      };

      const response = await API.post("/api/users/clinic-owner/staff", payload);

      setMessage(
        response.data.message ||
          "Staff account created successfully. A verification email has been sent.",
      );

      resetForm();
      fetchStaff();
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
      fetchStaff();
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

      fetchStaff();
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

  return (
    <DashboardLayout role="Clinic Owner">
      <div className="appointments-layout">
        <div className="appointment-form-card">
          <h2>Add Clinic Staff</h2>

          <p>
            Create dentist or dental assistant accounts under your clinic.
            Account limits follow your current subscription plan.
          </p>

          {clinic && (
            <div className="info-message" style={{ marginBottom: "16px" }}>
              <strong>Clinic:</strong> {clinic.clinic_name}
              <br />
              <strong>Current Plan:</strong> {clinic.plan_name || "No Plan"}
              <br />
              <strong>Dentist Limit:</strong>{" "}
              {clinic.max_dentists ?? "Unlimited"}
              <br />
              <strong>Assistant Limit:</strong>{" "}
              {clinic.max_assistants ?? "Unlimited"}
            </div>
          )}

          {message && <div className="success-message">{message}</div>}
          {error && <div className="error-message">{error}</div>}

          <form className="appointment-form" onSubmit={handleCreateStaff}>
            <div className="form-group">
              <label>Staff Role</label>
              <select
                name="staff_role"
                value={formData.staff_role}
                onChange={handleChange}
                disabled={creating}
              >
                <option value="Dentist">Dentist</option>
                <option value="Assistant">Dental Assistant</option>
              </select>
            </div>

            <div className="form-group">
              <label>Full Name</label>
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
              <label>Email Address</label>
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

            <div className="form-group">
              <label>Temporary Password</label>
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
                The staff member must verify their email before logging in.
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

            <AuthButtonReplacement disabled={creating}>
              {creating ? "Creating..." : "Create Staff Account"}
            </AuthButtonReplacement>
          </form>
        </div>

        <div className="appointments-list-card">
          <div className="appointments-header">
            <div>
              <h2>Clinic Staff</h2>
              <p>
                Manage dentists and dental assistants assigned to your clinic.
              </p>
            </div>

            <div
              className="appointment-actions"
              style={{ flexDirection: "row" }}
            >
              <button
                className="secondary-button"
                onClick={() => navigate("/clinic-owner/dashboard")}
              >
                Back to Dashboard
              </button>

              <button
                className="secondary-button"
                onClick={fetchStaff}
                disabled={loading}
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          {loading ? (
            <p>Loading clinic staff...</p>
          ) : staff.length === 0 ? (
            <div className="empty-state">
              <h3>No staff yet</h3>
              <p>Created dentist and assistant accounts will appear here.</p>
            </div>
          ) : (
            <div className="appointments-list">
              {staff.map((person) => {
                const isVerified = Boolean(person.email_verified);
                const isInactive = person.status === "Inactive";
                const isResending = resendingId === person.user_id;

                return (
                  <div className="appointment-item" key={person.user_id}>
                    <div className="appointment-info">
                      <div className="appointment-title-row">
                        <h3>{person.name}</h3>

                        <span className="status-badge status-scheduled">
                          {getRoleLabel(person)}
                        </span>
                      </div>

                      <p>
                        <strong>Email:</strong> {person.email}
                      </p>

                      <p>
                        <strong>Account Status:</strong>{" "}
                        <span className={getStatusClass(person.status)}>
                          {person.status || "Active"}
                        </span>
                      </p>

                      <p>
                        <strong>Email Verification:</strong>{" "}
                        <span className={getVerificationClass(isVerified)}>
                          {getVerificationLabel(isVerified)}
                        </span>
                      </p>

                      <p>
                        <strong>License Number:</strong>{" "}
                        {getLicenseNumber(person)}
                      </p>

                      {person.role_name === "Dentist" && (
                        <p>
                          <strong>Specialization:</strong>{" "}
                          {person.specialization || "General Dentistry"}
                        </p>
                      )}

                      <p>
                        <strong>Availability:</strong> {getAvailability(person)}
                      </p>

                      <p>
                        <strong>Created At:</strong>{" "}
                        {formatDate(person.created_at)}
                      </p>
                    </div>

                    <div className="clinic-staff-actions">
                      {!isVerified && !isInactive && (
                        <button
                          className="secondary-button clinic-staff-btn"
                          onClick={() => handleResendVerification(person)}
                          disabled={
                            updatingStatus || loading || creating || isResending
                          }
                        >
                          {isResending ? "Sending..." : "Resend Email"}
                        </button>
                      )}

                      <button
                        className={
                          person.status === "Inactive"
                            ? "primary-button clinic-staff-btn"
                            : "danger-button clinic-staff-btn"
                        }
                        onClick={() => openStatusModal(person)}
                        disabled={updatingStatus || isResending}
                      >
                        {person.status === "Inactive"
                          ? "Activate"
                          : "Deactivate"}
                      </button>
                    </div>
                  </div>
                );
              })}
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
                  Change the account status for this staff member. Inactive
                  users should not be able to access the system.
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

function AuthButtonReplacement({ children, disabled }) {
  return (
    <button type="submit" className="primary-button" disabled={disabled}>
      {children}
    </button>
  );
}

export default ClinicOwnerStaff;
