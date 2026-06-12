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

  const handleCreateStaff = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.password) {
      setError("Name, email, and password are required.");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    try {
      setCreating(true);
      setMessage("");
      setError("");

      const response = await API.post(
        "/api/users/clinic-owner/staff",
        formData,
      );

      setMessage(
        response.data.message || "Staff account created successfully.",
      );
      resetForm();
      fetchStaff();
    } catch (err) {
      setError(err.response?.data?.error || "Unable to create staff account.");
    } finally {
      setCreating(false);
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

  const formatDate = (dateValue) => {
    if (!dateValue) return "N/A";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) return "N/A";

    return date.toLocaleString();
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
                placeholder="Minimum 6 characters"
                required
              />
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
                Dentists and dental assistants currently assigned to your
                clinic.
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
              {staff.map((person) => (
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
                      <strong>Status:</strong> {person.status || "Active"}
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
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
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
