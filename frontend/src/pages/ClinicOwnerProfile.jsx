import React, { useEffect, useState } from "react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import API from "../api/axios";
import { useNavigate } from "react-router-dom";
import PasswordInput from "../components/auth/PasswordInput";

function ClinicOwnerProfile() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    clinic_name: "",
    address: "",
    latitude: "",
    longitude: "",
    services: "",
    contact_number: "",
    opening_hours: "",
  });

  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const [originalClinic, setOriginalClinic] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordRules, setPasswordRules] = useState([]);

  useEffect(() => {
    fetchClinicProfile();
  }, []);

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

  const fetchClinicProfile = async () => {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      const response = await API.get("/api/clinics/owner/my-clinic");

      const clinic = response.data.clinic;

      setOriginalClinic(clinic);

      setFormData({
        clinic_name: clinic?.clinic_name || "",
        address: clinic?.address || "",
        latitude: clinic?.latitude || "",
        longitude: clinic?.longitude || "",
        services: clinic?.services || "",
        contact_number: clinic?.contact_number || "",
        opening_hours: clinic?.opening_hours || "",
      });
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load clinic profile.");
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

  const handlePasswordChange = (e) => {
    setPasswordMessage("");
    setPasswordError("");
    setPasswordRules([]);

    setPasswordForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleReset = () => {
    if (!originalClinic) return;

    setMessage("");
    setError("");

    setFormData({
      clinic_name: originalClinic.clinic_name || "",
      address: originalClinic.address || "",
      latitude: originalClinic.latitude || "",
      longitude: originalClinic.longitude || "",
      services: originalClinic.services || "",
      contact_number: originalClinic.contact_number || "",
      opening_hours: originalClinic.opening_hours || "",
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.clinic_name || !formData.address) {
      setError("Clinic name and address are required.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      setError("");

      const response = await API.put("/api/clinics/owner/my-clinic", {
        clinic_name: formData.clinic_name,
        address: formData.address,
        latitude: formData.latitude || null,
        longitude: formData.longitude || null,
        services: formData.services || null,
        contact_number: formData.contact_number || null,
        opening_hours: formData.opening_hours || null,
      });

      setMessage(response.data.message || "Clinic profile updated.");
      setOriginalClinic(response.data.clinic || originalClinic);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to update clinic profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    setPasswordMessage("");
    setPasswordError("");
    setPasswordRules([]);

    if (
      !passwordForm.current_password ||
      !passwordForm.new_password ||
      !passwordForm.confirm_password
    ) {
      setPasswordError("Please complete all password fields.");
      return;
    }

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordError("New password and confirm password do not match.");
      return;
    }

    if (passwordForm.current_password === passwordForm.new_password) {
      setPasswordError("New password must be different from current password.");
      return;
    }

    const passwordStrengthError = validatePasswordStrength(
      passwordForm.new_password,
    );

    if (passwordStrengthError) {
      setPasswordError(passwordStrengthError);
      return;
    }

    try {
      setChangingPassword(true);

      const response = await API.put("/api/users/change-password", {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
        confirm_password: passwordForm.confirm_password,
      });

      setPasswordMessage(
        response.data?.message || "Password changed successfully.",
      );

      setPasswordForm({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });

      setShowPasswordForm(false);
    } catch (err) {
      const apiRules = err.response?.data?.password_rules;

      if (Array.isArray(apiRules)) {
        setPasswordRules(apiRules);
      }

      setPasswordError(
        err.response?.data?.error || "Unable to change password.",
      );
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <DashboardLayout role="Clinic Owner">
      <div className="appointments-layout">
        <div>
          <div className="appointment-form-card">
            <h2>Clinic Profile</h2>
            <p>
              Update your clinic details shown in your clinic owner dashboard
              and future clinic discovery features.
            </p>

            {message && <div className="success-message">{message}</div>}
            {error && <div className="error-message">{error}</div>}

            {loading ? (
              <p>Loading clinic profile...</p>
            ) : (
              <form className="appointment-form" onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Clinic Name</label>
                  <input
                    type="text"
                    name="clinic_name"
                    value={formData.clinic_name}
                    onChange={handleChange}
                    placeholder="Enter clinic name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Clinic Address</label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="Enter clinic address"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Contact Number</label>
                  <input
                    type="text"
                    name="contact_number"
                    value={formData.contact_number}
                    onChange={handleChange}
                    placeholder="Example: 09123456789"
                  />
                </div>

                <div className="form-group">
                  <label>Services Offered</label>
                  <textarea
                    name="services"
                    value={formData.services}
                    onChange={handleChange}
                    placeholder="Example: General Dentistry, Cleaning, Extraction, Orthodontics"
                    rows="4"
                  />
                </div>

                <div className="form-group">
                  <label>Opening Hours</label>
                  <textarea
                    name="opening_hours"
                    value={formData.opening_hours}
                    onChange={handleChange}
                    placeholder="Example: Monday to Saturday, 9:00 AM - 5:00 PM"
                    rows="4"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Latitude</label>
                    <input
                      type="number"
                      step="any"
                      name="latitude"
                      value={formData.latitude}
                      onChange={handleChange}
                      placeholder="Optional"
                    />
                  </div>

                  <div className="form-group">
                    <label>Longitude</label>
                    <input
                      type="number"
                      step="any"
                      name="longitude"
                      value={formData.longitude}
                      onChange={handleChange}
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div
                  className="appointment-actions"
                  style={{ marginTop: "12px" }}
                >
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleReset}
                    disabled={saving}
                  >
                    Reset
                  </button>

                  <button
                    type="submit"
                    className="primary-button"
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="appointment-form-card" style={{ marginTop: "20px" }}>
            <h2>Account Security</h2>

            <p>
              Update your password regularly to keep your DentoGraph clinic
              owner account secure.
            </p>

            {passwordMessage && (
              <div className="success-message">{passwordMessage}</div>
            )}

            {passwordError && (
              <div className="error-message">{passwordError}</div>
            )}

            {passwordRules.length > 0 && (
              <div className="error-message">
                <strong>Password must follow these rules:</strong>
                <ul>
                  {passwordRules.map((rule, index) => (
                    <li key={index}>{rule}</li>
                  ))}
                </ul>
              </div>
            )}

            {!showPasswordForm ? (
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  setShowPasswordForm(true);
                  setPasswordMessage("");
                  setPasswordError("");
                  setPasswordRules([]);
                }}
              >
                Change Password
              </button>
            ) : (
              <form
                className="appointment-form"
                onSubmit={handleChangePassword}
              >
                <PasswordInput
                  label="Current Password"
                  name="current_password"
                  placeholder="Enter current password"
                  value={passwordForm.current_password}
                  onChange={handlePasswordChange}
                  icon="🔒"
                  autoComplete="current-password"
                  disabled={changingPassword}
                  required
                />

                <PasswordInput
                  label="New Password"
                  name="new_password"
                  placeholder="Enter new password"
                  value={passwordForm.new_password}
                  onChange={handlePasswordChange}
                  icon="🔒"
                  autoComplete="new-password"
                  disabled={changingPassword}
                  required
                />

                <PasswordInput
                  label="Confirm New Password"
                  name="confirm_password"
                  placeholder="Confirm new password"
                  value={passwordForm.confirm_password}
                  onChange={handlePasswordChange}
                  icon="🔒"
                  autoComplete="new-password"
                  disabled={changingPassword}
                  required
                />

                <div className="info-message" style={{ marginTop: "16px" }}>
                  Password must have at least 8 characters, one uppercase
                  letter, one lowercase letter, one number, and one special
                  character.
                </div>

                <div
                  className="appointment-actions"
                  style={{ marginTop: "16px" }}
                >
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={changingPassword}
                    onClick={() => {
                      setShowPasswordForm(false);
                      setPasswordForm({
                        current_password: "",
                        new_password: "",
                        confirm_password: "",
                      });
                      setPasswordError("");
                      setPasswordMessage("");
                      setPasswordRules([]);
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="primary-button"
                    disabled={changingPassword}
                  >
                    {changingPassword ? "Changing..." : "Save New Password"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        <div className="appointments-list-card">
          <div className="appointments-header">
            <div>
              <h2>Profile Preview</h2>
              <p>This is how your clinic information is currently saved.</p>
            </div>

            <button
              className="secondary-button"
              onClick={() => navigate("/clinic-owner/dashboard")}
            >
              Back to Dashboard
            </button>
          </div>

          {loading ? (
            <p>Loading preview...</p>
          ) : (
            <div className="appointment-item">
              <div className="appointment-info">
                <div className="appointment-title-row">
                  <h3>{formData.clinic_name || "Clinic Name"}</h3>

                  <span className="status-badge status-scheduled">
                    {originalClinic?.status || "Active"}
                  </span>
                </div>

                <p>
                  <strong>Address:</strong> {formData.address || "N/A"}
                </p>

                <p>
                  <strong>Contact Number:</strong>{" "}
                  {formData.contact_number || "N/A"}
                </p>

                <p>
                  <strong>Services:</strong> {formData.services || "N/A"}
                </p>

                <p>
                  <strong>Opening Hours:</strong>{" "}
                  {formData.opening_hours || "N/A"}
                </p>

                <p>
                  <strong>Latitude:</strong> {formData.latitude || "N/A"}
                </p>

                <p>
                  <strong>Longitude:</strong> {formData.longitude || "N/A"}
                </p>

                <p>
                  <strong>Subscription Plan:</strong>{" "}
                  {originalClinic?.plan_name || "N/A"}
                </p>

                <p>
                  <strong>Owner:</strong> {originalClinic?.owner_name || "N/A"}
                </p>

                <p>
                  <strong>Owner Email:</strong>{" "}
                  {originalClinic?.owner_email || "N/A"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default ClinicOwnerProfile;
