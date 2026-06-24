import React, { useEffect, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import PasswordInput from "../components/auth/PasswordInput";

function DentistProfile() {
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    license_number: "",
    specialization: "",
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

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      setError("");

      await Promise.all([fetchProfile(), fetchClinics()]);
    } catch (err) {
      setError("Unable to load dentist profile data.");
    } finally {
      setLoading(false);
    }
  };

  const fetchProfile = async () => {
    const response = await API.get("/api/dentists/profile", authHeaders);
    const dentist = response.data.dentist;

    setProfile({
      name: dentist.name || "",
      email: dentist.email || "",
      license_number: dentist.license_number || "",
      specialization: dentist.specialization || "",
      availability: dentist.availability || "",
      clinic_id: dentist.clinic_id || "",
      clinic_name: dentist.clinic_name || "",
      account_status: dentist.account_status || "",
      profile_status: dentist.profile_status || "",
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
      !profile.name ||
      !profile.email ||
      !profile.license_number ||
      !profile.specialization ||
      !profile.availability
    ) {
      setError("Please complete all required fields.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      setError("");

      const response = await API.put(
        "/api/dentists/profile",
        {
          name: profile.name,
          email: profile.email,
          license_number: profile.license_number,
          specialization: profile.specialization,
          availability: profile.availability,
          clinic_id: profile.clinic_id ? Number(profile.clinic_id) : null,
        },
        authHeaders,
      );

      const updatedDentist = response.data.dentist;

      setProfile({
        name: updatedDentist.name || "",
        email: updatedDentist.email || "",
        license_number: updatedDentist.license_number || "",
        specialization: updatedDentist.specialization || "",
        availability: updatedDentist.availability || "",
        clinic_id: updatedDentist.clinic_id || "",
        clinic_name: updatedDentist.clinic_name || "",
        account_status: updatedDentist.account_status || "",
        profile_status: updatedDentist.profile_status || "",
      });

      const storedUser = localStorage.getItem("user");

      if (storedUser) {
        const user = JSON.parse(storedUser);

        localStorage.setItem(
          "user",
          JSON.stringify({
            ...user,
            name: updatedDentist.name,
            email: updatedDentist.email,
          }),
        );
      }

      setMessage("Profile updated successfully.");
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to update dentist profile.",
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

  return (
    <DashboardLayout role="Dentist">
      <div className="profile-container">
        <div className="profile-card">
          <h2>My Profile</h2>
          <p>
            Manage your dentist account details, professional information,
            assigned clinic, and availability.
          </p>

          {message && <div className="profile-success">{message}</div>}
          {error && <div className="profile-error">{error}</div>}

          {loading ? (
            <p>Loading profile...</p>
          ) : (
            <form className="profile-form" onSubmit={handleSubmit}>
              <div className="profile-grid">
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

                <div className="profile-field">
                  <label>Specialization</label>
                  <input
                    type="text"
                    name="specialization"
                    value={profile.specialization}
                    onChange={handleChange}
                    required
                  />
                </div>

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
                        <option key={clinic.clinic_id} value={clinic.clinic_id}>
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

              <div className="profile-field">
                <label>Availability</label>
                <textarea
                  name="availability"
                  value={profile.availability}
                  onChange={handleChange}
                  placeholder="Example: Monday to Friday, 9:00 AM - 5:00 PM"
                  required
                />
              </div>

              <button
                type="submit"
                className="profile-button"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </form>
          )}
        </div>

        <div className="profile-card" style={{ marginTop: "20px" }}>
          <h2>Account Security</h2>

          <p>
            Update your password regularly to keep your DentoGraph account
            secure.
          </p>

          {passwordMessage && (
            <div className="profile-success">{passwordMessage}</div>
          )}

          {passwordError && (
            <div className="profile-error">{passwordError}</div>
          )}

          {passwordRules.length > 0 && (
            <div className="profile-error">
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
              className="profile-button"
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
            <form className="profile-form" onSubmit={handleChangePassword}>
              <div className="profile-grid">
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

              <div className="info-message" style={{ marginTop: "16px" }}>
                Password must have at least 8 characters, one uppercase letter,
                one lowercase letter, one number, and one special character.
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  flexWrap: "wrap",
                  marginTop: "16px",
                }}
              >
                <button
                  type="submit"
                  className="profile-button"
                  disabled={changingPassword}
                >
                  {changingPassword ? "Changing..." : "Save New Password"}
                </button>

                <button
                  type="button"
                  className="profile-button secondary"
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
              </div>
            </form>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default DentistProfile;
