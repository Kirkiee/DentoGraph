import React, { useEffect, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import PasswordInput from "../components/auth/PasswordInput";

function AdminProfile() {
  const [admin, setAdmin] = useState({
    name: "",
    email: "",
    role: "Admin",
  });

  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const [loading, setLoading] = useState(true);
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
    fetchAdminProfile();
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

  const fetchAdminProfile = async () => {
    try {
      setLoading(true);
      setError("");

      const storedUser = localStorage.getItem("user");

      if (storedUser) {
        const user = JSON.parse(storedUser);

        setAdmin({
          name: user.name || "Admin",
          email: user.email || "",
          role: user.role || "Admin",
        });
      }

      const response = await API.get("/api/users/profile", authHeaders);

      if (response.data?.user) {
        setAdmin((prev) => ({
          ...prev,
          email: response.data.user.email || prev.email,
          role: response.data.user.role || prev.role,
        }));
      }
    } catch (err) {
      setError("Unable to load admin profile.");
    } finally {
      setLoading(false);
    }
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
    <DashboardLayout role="Admin">
      <div className="profile-container">
        <div className="profile-card">
          <h2>Admin Profile</h2>

          <p>View your admin account details and manage account security.</p>

          {message && <div className="profile-success">{message}</div>}
          {error && <div className="profile-error">{error}</div>}

          {loading ? (
            <p>Loading profile...</p>
          ) : (
            <div className="profile-form">
              <div className="profile-grid">
                <div className="profile-field">
                  <label>Name</label>
                  <input type="text" value={admin.name || "Admin"} disabled />
                </div>

                <div className="profile-field">
                  <label>Email</label>
                  <input type="email" value={admin.email} disabled />
                </div>

                <div className="profile-field">
                  <label>Role</label>
                  <input type="text" value={admin.role || "Admin"} disabled />
                </div>
              </div>

              <div className="info-message" style={{ marginTop: "16px" }}>
                Admin profile details are controlled through user management.
              </div>
            </div>
          )}
        </div>

        <div className="profile-card" style={{ marginTop: "20px" }}>
          <h2>Account Security</h2>

          <p>
            Update your password regularly to keep your DentoGraph admin account
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

export default AdminProfile;
