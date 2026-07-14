import React, { useEffect, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import PasswordInput from "../components/auth/PasswordInput";

function AssistantProfile() {
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    license_number: "",
    availability: "",
    clinic_id: "",
    clinic_name: "",
    account_status: "",
    profile_status: "",
  });

  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const [clinics, setClinics] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordRules, setPasswordRules] = useState([]);

  const token = localStorage.getItem("token");

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  useEffect(() => {
    fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const fetchInitialData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      await Promise.all([fetchProfile(), fetchClinics()]);
    } catch (err) {
      setError("Unable to load assistant profile data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchProfile = async () => {
    const response = await API.get("/api/assistants/profile", authHeaders);
    const assistant = response.data.assistant;

    setProfile({
      name: assistant.name || "",
      email: assistant.email || "",
      license_number: assistant.license_number || "",
      availability: assistant.availability || "",
      clinic_id: assistant.clinic_id || "",
      clinic_name: assistant.clinic_name || "",
      account_status: assistant.account_status || "",
      profile_status: assistant.profile_status || "",
    });
  };

  const fetchClinics = async () => {
    const response = await API.get("/api/clinics", authHeaders);
    setClinics(response.data.clinics || []);
  };

  const handleChange = (e) => {
    setMessage("");
    setError("");

    setProfile((prev) => ({
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !profile.name.trim() ||
      !profile.email.trim() ||
      !profile.license_number.trim() ||
      !profile.availability.trim()
    ) {
      setError("Please complete all required fields.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      setError("");

      const response = await API.put(
        "/api/assistants/profile",
        {
          name: profile.name.trim(),
          email: profile.email.trim().toLowerCase(),
          license_number: profile.license_number.trim(),
          availability: profile.availability.trim(),
          clinic_id: profile.clinic_id ? Number(profile.clinic_id) : null,
        },
        authHeaders,
      );

      const updatedAssistant = response.data.assistant;

      setProfile({
        name: updatedAssistant.name || "",
        email: updatedAssistant.email || "",
        license_number: updatedAssistant.license_number || "",
        availability: updatedAssistant.availability || "",
        clinic_id: updatedAssistant.clinic_id || "",
        clinic_name: updatedAssistant.clinic_name || "",
        account_status: updatedAssistant.account_status || "",
        profile_status: updatedAssistant.profile_status || "",
      });

      const storedUser = localStorage.getItem("user");

      if (storedUser) {
        const user = JSON.parse(storedUser);

        localStorage.setItem(
          "user",
          JSON.stringify({
            ...user,
            name: updatedAssistant.name,
            email: updatedAssistant.email,
          }),
        );
      }

      setMessage("Profile updated successfully.");
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to update assistant profile.",
      );
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

      const response = await API.put(
        "/api/users/change-password",
        {
          current_password: passwordForm.current_password,
          new_password: passwordForm.new_password,
          confirm_password: passwordForm.confirm_password,
        },
        authHeaders,
      );

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

  const closePasswordForm = () => {
    setShowPasswordForm(false);
    setPasswordForm({
      current_password: "",
      new_password: "",
      confirm_password: "",
    });
    setPasswordError("");
    setPasswordMessage("");
    setPasswordRules([]);
  };

  const selectedClinic = clinics.find(
    (clinic) => Number(clinic.clinic_id) === Number(profile.clinic_id),
  );

  const renderLoadingState = () => {
    return (
      <div className="patient-profile-loading">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="loading-card" key={index}>
            <div className="loading-line loading-title"></div>
            <div className="loading-line loading-text"></div>
            <div className="loading-line loading-text"></div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <DashboardLayout role="Assistant">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>My Profile</h2>
            <p>
              Manage your assistant account details, assigned clinic, license
              information, availability, and account security.
            </p>
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={() => fetchInitialData(true)}
            disabled={loading || refreshing}
          >
            {loading || refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {message && <div className="success-message">{message}</div>}

        {error && (
          <div className="error-message">
            <strong>Profile notice</strong>
            <p>{error}</p>
          </div>
        )}

        {loading ? (
          renderLoadingState()
        ) : (
          <>
            <div className="patient-dashboard-summary-grid">
              <div className="patient-dashboard-card">
                <span>Account Status</span>
                <strong>{profile.account_status || "Active"}</strong>
                <p>Your login account condition.</p>
              </div>

              <div className="patient-dashboard-card">
                <span>Profile Status</span>
                <strong>{profile.profile_status || "Active"}</strong>
                <p>Your assistant profile condition.</p>
              </div>

              <div className="patient-dashboard-card">
                <span>Assigned Clinic</span>
                <strong>
                  {profile.clinic_name || selectedClinic?.clinic_name || "None"}
                </strong>
                <p>Clinic currently linked to your account.</p>
              </div>

              <div className="patient-dashboard-card">
                <span>Role Access</span>
                <strong>Assistant</strong>
                <p>Supports appointments, records, and X-ray workflow.</p>
              </div>
            </div>

            <form
              className="profile-form assistant-profile-form"
              onSubmit={handleSubmit}
            >
              <div className="patient-dashboard-section">
                <div className="appointments-header">
                  <div>
                    <h2>Basic Account Information</h2>
                    <p>Update your name and contact email.</p>
                  </div>
                </div>

                <div className="assistant-profile-grid">
                  <div className="profile-field">
                    <label>Name</label>
                    <input
                      type="text"
                      name="name"
                      value={profile.name}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="profile-field">
                    <label>Email</label>
                    <input
                      type="email"
                      name="email"
                      value={profile.email}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="patient-dashboard-section">
                <div className="appointments-header">
                  <div>
                    <h2>Assistant Information</h2>
                    <p>
                      Keep your license information and availability updated.
                    </p>
                  </div>
                </div>

                <div className="assistant-profile-grid">
                  <div className="profile-field">
                    <label>License Number</label>
                    <input
                      type="text"
                      name="license_number"
                      value={profile.license_number}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="profile-field assistant-profile-full">
                    <label>Availability</label>
                    <textarea
                      name="availability"
                      value={profile.availability}
                      onChange={handleChange}
                      placeholder="Example: Monday to Friday, 9:00 AM - 5:00 PM"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="patient-dashboard-section">
                <div className="appointments-header">
                  <div>
                    <h2>Clinic Assignment</h2>
                    <p>
                      Review or update the clinic connected to your account.
                    </p>
                  </div>
                </div>

                <div className="assistant-profile-grid">
                  <div className="profile-field">
                    <label>Assigned Clinic</label>
                    <select
                      name="clinic_id"
                      value={profile.clinic_id}
                      onChange={handleChange}
                    >
                      <option value="">No assigned clinic</option>
                      {clinics
                        .filter(
                          (clinic) =>
                            clinic.status === "Active" ||
                            Number(clinic.clinic_id) ===
                              Number(profile.clinic_id),
                        )
                        .map((clinic) => (
                          <option
                            key={clinic.clinic_id}
                            value={clinic.clinic_id}
                          >
                            {clinic.clinic_name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="profile-field">
                    <label>Current Clinic</label>
                    <input
                      type="text"
                      value={profile.clinic_name || "No assigned clinic"}
                      disabled
                    />
                  </div>

                  <div className="profile-field">
                    <label>Account Status</label>
                    <input
                      type="text"
                      value={profile.account_status || "Active"}
                      disabled
                    />
                  </div>

                  <div className="profile-field">
                    <label>Profile Status</label>
                    <input
                      type="text"
                      value={profile.profile_status || "Active"}
                      disabled
                    />
                  </div>
                </div>

                <div className="info-message assistant-profile-info-message">
                  Clinic assignment may affect which appointments, dental
                  records, and X-rays are visible to your assistant account.
                </div>
              </div>

              <div className="appointment-actions assistant-profile-save-actions">
                <button
                  type="submit"
                  className="primary-button"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Profile Changes"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>

      <div className="appointments-list-card assistant-security-card">
        <div className="appointments-header">
          <div>
            <h2>Account Security</h2>
            <p>
              Update your password regularly to keep your DentoGraph account
              secure.
            </p>
          </div>
        </div>

        {passwordMessage && (
          <div className="success-message">{passwordMessage}</div>
        )}

        {passwordError && (
          <div className="error-message">
            <strong>Password notice</strong>
            <p>{passwordError}</p>
          </div>
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
          <div className="assistant-security-summary">
            <div className="info-message">
              Password must have at least 8 characters, one uppercase letter,
              one lowercase letter, one number, and one special character.
            </div>

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
          </div>
        ) : (
          <form
            className="profile-form assistant-password-form"
            onSubmit={handleChangePassword}
          >
            <div className="assistant-profile-grid">
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
            </div>

            <div className="info-message">
              Password must have at least 8 characters, one uppercase letter,
              one lowercase letter, one number, and one special character.
            </div>

            <div className="appointment-actions assistant-profile-save-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={changingPassword}
                onClick={closePasswordForm}
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
    </DashboardLayout>
  );
}

export default AssistantProfile;
