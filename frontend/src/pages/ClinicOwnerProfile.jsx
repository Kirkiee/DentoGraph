import React, { useEffect, useMemo, useState } from "react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import API from "../api/axios";
import { useNavigate } from "react-router-dom";
import PasswordInput from "../components/auth/PasswordInput";

function ClinicOwnerProfile() {
  const navigate = useNavigate();

  const emptyLocationForm = {
    clinic_name: "",
    address: "",
    latitude: "",
    longitude: "",
    services: "",
    contact_number: "",
    opening_hours: "",
  };

  const [clinicLocations, setClinicLocations] = useState([]);
  const [selectedClinicId, setSelectedClinicId] = useState("");
  const [locationForm, setLocationForm] = useState(emptyLocationForm);
  const [newLocationForm, setNewLocationForm] = useState(emptyLocationForm);

  const [showEditLocation, setShowEditLocation] = useState(false);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const [loading, setLoading] = useState(true);
  const [savingLocation, setSavingLocation] = useState(false);
  const [addingLocation, setAddingLocation] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordRules, setPasswordRules] = useState([]);

  const selectedLocation = useMemo(() => {
    return (
      clinicLocations.find(
        (location) => String(location.clinic_id) === String(selectedClinicId),
      ) || null
    );
  }, [clinicLocations, selectedClinicId]);

  const sharedPlanName =
    selectedLocation?.plan_name ||
    clinicLocations.find((location) => location.plan_name)?.plan_name ||
    "No active plan";

  useEffect(() => {
    fetchClinicLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedLocation) {
      setLocationForm({
        clinic_name: selectedLocation.clinic_name || "",
        address: selectedLocation.address || "",
        latitude: selectedLocation.latitude || "",
        longitude: selectedLocation.longitude || "",
        services: selectedLocation.services || "",
        contact_number: selectedLocation.contact_number || "",
        opening_hours: selectedLocation.opening_hours || "",
      });
    }
  }, [selectedLocation]);

  const fetchClinicLocations = async () => {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      const response = await API.get("/api/clinics/owner/locations");

      const locations =
        response.data.locations ||
        response.data.clinics ||
        response.data.clinic_locations ||
        [];

      setClinicLocations(locations);

      if (locations.length > 0) {
        setSelectedClinicId((currentClinicId) => {
          const stillExists = locations.some(
            (location) =>
              String(location.clinic_id) === String(currentClinicId),
          );

          return stillExists
            ? String(currentClinicId)
            : String(locations[0].clinic_id);
        });
      } else {
        setSelectedClinicId("");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load clinic locations.");
      setClinicLocations([]);
      setSelectedClinicId("");
    } finally {
      setLoading(false);
    }
  };

  const validatePasswordStrength = (password) => {
    const value = String(password || "");

    if (value.length < 8) return "Password must be at least 8 characters long.";
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

  const handleLocationFormChange = (e) => {
    setMessage("");
    setError("");

    setLocationForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleNewLocationChange = (e) => {
    setMessage("");
    setError("");

    setNewLocationForm((prev) => ({
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

  const openEditLocation = (location) => {
    setSelectedClinicId(String(location.clinic_id));
    setShowEditLocation(true);
    setShowAddLocation(false);
    setMessage("");
    setError("");
  };

  const handleUpdateLocation = async (e) => {
    e.preventDefault();

    if (!selectedClinicId) {
      setError("Please select a clinic location to update.");
      return;
    }

    if (!locationForm.clinic_name.trim() || !locationForm.address.trim()) {
      setError("Clinic name and address are required.");
      return;
    }

    try {
      setSavingLocation(true);
      setMessage("");
      setError("");

      const response = await API.put(
        `/api/clinics/owner/locations/${selectedClinicId}`,
        {
          clinic_name: locationForm.clinic_name.trim(),
          address: locationForm.address.trim(),
          latitude: locationForm.latitude || null,
          longitude: locationForm.longitude || null,
          services: locationForm.services || null,
          contact_number: locationForm.contact_number || null,
          opening_hours: locationForm.opening_hours || null,
        },
      );

      const updatedLocation = response.data.clinic || null;

      setClinicLocations((prev) =>
        prev.map((location) =>
          String(location.clinic_id) === String(selectedClinicId)
            ? { ...location, ...(updatedLocation || locationForm) }
            : location,
        ),
      );

      setMessage(response.data.message || "Clinic location updated.");
      setShowEditLocation(false);
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to update clinic location.",
      );
    } finally {
      setSavingLocation(false);
    }
  };

  const handleAddLocation = async (e) => {
    e.preventDefault();

    const clinicName = newLocationForm.clinic_name.trim();
    const address = newLocationForm.address.trim();

    if (!clinicName || !address) {
      setError("Clinic name and address are required.");
      return;
    }

    try {
      setAddingLocation(true);
      setMessage("");
      setError("");

      const response = await API.post("/api/clinics/owner/locations", {
        clinic_name: clinicName,
        address,
        latitude: newLocationForm.latitude || null,
        longitude: newLocationForm.longitude || null,
        services: newLocationForm.services || null,
        contact_number: newLocationForm.contact_number || null,
        opening_hours: newLocationForm.opening_hours || null,
      });

      const newLocation = response.data.clinic;

      setClinicLocations((prev) => [...prev, newLocation]);
      setSelectedClinicId(String(newLocation.clinic_id));
      setNewLocationForm(emptyLocationForm);
      setShowAddLocation(false);
      setMessage(response.data.message || "Clinic location added.");
    } catch (err) {
      setError(err.response?.data?.error || "Unable to add clinic location.");
    } finally {
      setAddingLocation(false);
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

  const renderLocationFields = (data, onChange, disabled) => {
    return (
      <>
        <div className="form-row">
          <div className="form-group">
            <label>
              Clinic Location Name <span className="auth-required">*</span>
            </label>
            <input
              type="text"
              name="clinic_name"
              value={data.clinic_name}
              onChange={onChange}
              placeholder="Example: BrightSmile Makati"
              disabled={disabled}
              required
            />
          </div>

          <div className="form-group">
            <label>
              Address <span className="auth-required">*</span>
            </label>
            <input
              type="text"
              name="address"
              value={data.address}
              onChange={onChange}
              placeholder="Enter clinic address"
              disabled={disabled}
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Contact Number</label>
            <input
              type="text"
              name="contact_number"
              value={data.contact_number}
              onChange={onChange}
              placeholder="Example: 09123456789"
              disabled={disabled}
            />
          </div>

          <div className="form-group">
            <label>Opening Hours</label>
            <input
              type="text"
              name="opening_hours"
              value={data.opening_hours}
              onChange={onChange}
              placeholder="Example: Mon-Sat, 9:00 AM - 5:00 PM"
              disabled={disabled}
            />
          </div>
        </div>

        <div className="form-group">
          <label>Services Offered</label>
          <textarea
            name="services"
            value={data.services}
            onChange={onChange}
            placeholder="Example: General Dentistry, Cleaning, Extraction, Orthodontics"
            rows="4"
            disabled={disabled}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Latitude</label>
            <input
              type="number"
              step="any"
              name="latitude"
              value={data.latitude}
              onChange={onChange}
              placeholder="Optional"
              disabled={disabled}
            />
          </div>

          <div className="form-group">
            <label>Longitude</label>
            <input
              type="number"
              step="any"
              name="longitude"
              value={data.longitude}
              onChange={onChange}
              placeholder="Optional"
              disabled={disabled}
            />
          </div>
        </div>
      </>
    );
  };

  return (
    <DashboardLayout role="Clinic Owner">
      <div className="appointments-list-card clinic-owner-profile-page">
        <div className="appointments-header">
          <div>
            <h2>Clinic Locations</h2>
            <p>
              Manage clinic branches in a cleaner, sectioned layout. Each
              location has separate operations, while the subscription is
              shared.
            </p>
          </div>

          <div className="appointment-actions" style={{ flexDirection: "row" }}>
            <button
              type="button"
              className="secondary-button"
              onClick={() => navigate("/clinic-owner/dashboard")}
            >
              Back to Dashboard
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={fetchClinicLocations}
              disabled={loading || savingLocation || addingLocation}
            >
              Refresh
            </button>
          </div>
        </div>

        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}

        <div className="info-message">
          <strong>Shared Subscription:</strong> {sharedPlanName}. Staff,
          patients, records, and X-rays remain separated by location, but plan
          limits are shared under this Clinic Owner account.
        </div>

        {loading ? (
          <div className="payment-loading-card">
            <p>Loading clinic locations...</p>
          </div>
        ) : (
          <>
            <div className="staff-summary-grid">
              <div className="staff-summary-card">
                <span>Total Locations</span>
                <strong>{clinicLocations.length}</strong>
                <p>Branches under your account</p>
              </div>

              <div className="staff-summary-card">
                <span>Shared Plan</span>
                <strong>{sharedPlanName}</strong>
                <p>Applies to all locations</p>
              </div>

              <div className="staff-summary-card">
                <span>Selected Location</span>
                <strong>{selectedLocation?.clinic_name || "None"}</strong>
                <p>{selectedLocation?.status || "No location selected"}</p>
              </div>
            </div>

            <div className="patient-dashboard-section">
              <div className="appointments-header">
                <div>
                  <h2>Saved Locations</h2>
                  <p>
                    View the important details only. Use Edit Location to see or
                    change full branch information.
                  </p>
                </div>

                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    setShowAddLocation(true);
                    setShowEditLocation(false);
                    setMessage("");
                    setError("");
                  }}
                >
                  Add Location
                </button>
              </div>

              {clinicLocations.length === 0 ? (
                <div className="empty-state">
                  <h3>No locations yet</h3>
                  <p>Add your first clinic location to continue.</p>
                </div>
              ) : (
                <div className="patient-quick-action-grid">
                  {clinicLocations.map((location) => (
                    <div
                      className="patient-quick-action-card clinic-location-card"
                      key={location.clinic_id}
                    >
                      <div>
                        <div className="appointment-title-row">
                          <h3>{location.clinic_name || "Clinic Location"}</h3>

                          <span className="status-badge status-scheduled">
                            {location.status || "Active"}
                          </span>
                        </div>

                        <p>
                          <strong>Address:</strong> {location.address || "N/A"}
                        </p>

                        <p>
                          <strong>Contact:</strong>{" "}
                          {location.contact_number || "N/A"}
                        </p>

                        <p>
                          <strong>Opening Hours:</strong>{" "}
                          {location.opening_hours || "N/A"}
                        </p>
                      </div>

                      <div className="appointment-actions">
                        <button
                          className="primary-button"
                          onClick={() => openEditLocation(location)}
                        >
                          Edit Location
                        </button>

                        <button
                          className="secondary-button"
                          onClick={() => navigate("/clinic-owner/staff")}
                        >
                          Manage Staff
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {showEditLocation && selectedLocation && (
              <div className="patient-dashboard-section">
                <div className="appointments-header">
                  <div>
                    <h2>Edit Location</h2>
                    <p>
                      Update only the selected branch. This does not change your
                      shared subscription.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setShowEditLocation(false)}
                    disabled={savingLocation}
                  >
                    Close
                  </button>
                </div>

                <form
                  className="appointment-form"
                  onSubmit={handleUpdateLocation}
                >
                  {renderLocationFields(
                    locationForm,
                    handleLocationFormChange,
                    savingLocation,
                  )}

                  <div className="appointment-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        setLocationForm({
                          clinic_name: selectedLocation.clinic_name || "",
                          address: selectedLocation.address || "",
                          latitude: selectedLocation.latitude || "",
                          longitude: selectedLocation.longitude || "",
                          services: selectedLocation.services || "",
                          contact_number: selectedLocation.contact_number || "",
                          opening_hours: selectedLocation.opening_hours || "",
                        });
                      }}
                      disabled={savingLocation}
                    >
                      Reset
                    </button>

                    <button
                      type="submit"
                      className="primary-button"
                      disabled={savingLocation}
                    >
                      {savingLocation ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {showAddLocation && (
              <div className="patient-dashboard-section">
                <div className="appointments-header">
                  <div>
                    <h2>Add Location</h2>
                    <p>
                      Add a new branch under the same Clinic Owner account and
                      shared subscription.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setShowAddLocation(false);
                      setNewLocationForm(emptyLocationForm);
                    }}
                    disabled={addingLocation}
                  >
                    Cancel
                  </button>
                </div>

                <form className="appointment-form" onSubmit={handleAddLocation}>
                  {renderLocationFields(
                    newLocationForm,
                    handleNewLocationChange,
                    addingLocation,
                  )}

                  <button
                    type="submit"
                    className="primary-button"
                    disabled={addingLocation}
                  >
                    {addingLocation ? "Adding..." : "Add Clinic Location"}
                  </button>
                </form>
              </div>
            )}
          </>
        )}

        <div className="patient-dashboard-section">
          <div className="appointments-header">
            <div>
              <h2>Account Security</h2>
              <p>
                Keep password management separate from clinic location editing.
              </p>
            </div>

            {!showPasswordForm && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setShowPasswordForm(true);
                  setPasswordMessage("");
                  setPasswordError("");
                  setPasswordRules([]);
                }}
              >
                Change Password
              </button>
            )}
          </div>

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

          {showPasswordForm ? (
            <form className="appointment-form" onSubmit={handleChangePassword}>
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

              <div className="info-message">
                Password must have at least 8 characters, one uppercase letter,
                one lowercase letter, one number, and one special character.
              </div>

              <div className="appointment-actions">
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
          ) : (
            <div className="info-message">
              Password changes are hidden by default to keep this page focused
              on clinic location management.
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default ClinicOwnerProfile;
