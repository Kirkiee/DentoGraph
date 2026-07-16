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
  const [availabilitySchedule, setAvailabilitySchedule] = useState([]);
  const [clinicServices, setClinicServices] = useState([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);
  const [unavailableDates, setUnavailableDates] = useState([]);
  const [newUnavailableDate, setNewUnavailableDate] = useState({
    unavailable_date: "",
    reason: "",
  });
  const [savingAvailability, setSavingAvailability] = useState(false);

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

      await Promise.all([fetchProfile(), fetchClinics(), fetchAvailability()]);
    } catch (err) {
      setError("Unable to load dentist profile data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
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
      clinic_id: dentist.clinic_id || "",
      clinic_name: dentist.clinic_name || "",
      account_status: dentist.account_status || "",
      profile_status: dentist.profile_status || "",
    });
  };

  const fetchAvailability = async () => {
    const response = await API.get("/api/dentists/availability", authHeaders);
    setAvailabilitySchedule(response.data.schedule || []);
    setClinicServices(response.data.clinic_services || []);
    setSelectedServiceIds(response.data.selected_service_ids || []);
    setUnavailableDates(response.data.unavailable_dates || []);
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

  const updateScheduleDay = (day, field, value) => {
    setAvailabilitySchedule((current) =>
      current.map((item) =>
        Number(item.day_of_week) === Number(day)
          ? {
              ...item,
              [field]: field === "is_available" ? Boolean(value) : value,
            }
          : item,
      ),
    );
  };

  const toggleService = (serviceId) => {
    setSelectedServiceIds((current) =>
      current.includes(Number(serviceId))
        ? current.filter((id) => id !== Number(serviceId))
        : [...current, Number(serviceId)],
    );
  };

  const saveAvailability = async () => {
    try {
      setSavingAvailability(true);
      setMessage("");
      setError("");
      const response = await API.put(
        "/api/dentists/availability",
        { schedule: availabilitySchedule, service_ids: selectedServiceIds },
        authHeaders,
      );
      setMessage(response.data.message || "Availability saved successfully.");
      await fetchAvailability();
    } catch (err) {
      setError(err.response?.data?.error || "Unable to save availability.");
    } finally {
      setSavingAvailability(false);
    }
  };

  const addUnavailableDate = async () => {
    if (!newUnavailableDate.unavailable_date) {
      setError("Select an unavailable date.");
      return;
    }
    try {
      await API.post(
        "/api/dentists/availability/unavailable-dates",
        newUnavailableDate,
        authHeaders,
      );
      setNewUnavailableDate({ unavailable_date: "", reason: "" });
      await fetchAvailability();
    } catch (err) {
      setError(err.response?.data?.error || "Unable to add unavailable date.");
    }
  };

  const removeUnavailableDate = async (id) => {
    try {
      await API.delete(
        `/api/dentists/availability/unavailable-dates/${id}`,
        authHeaders,
      );
      await fetchAvailability();
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to remove unavailable date.",
      );
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !profile.name.trim() ||
      !profile.email.trim() ||
      !profile.license_number.trim() ||
      !profile.specialization.trim()
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
          name: profile.name.trim(),
          email: profile.email.trim().toLowerCase(),
          license_number: profile.license_number.trim(),
          specialization: profile.specialization.trim(),
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
    <DashboardLayout role="Dentist">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>My Profile</h2>
            <p>
              Manage your dentist account details, professional information,
              clinic assignment, availability, and account security.
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
                <p>Your dentist profile condition.</p>
              </div>

              <div className="patient-dashboard-card">
                <span>Assigned Clinic</span>
                <strong>
                  {profile.clinic_name || selectedClinic?.clinic_name || "None"}
                </strong>
                <p>Clinic currently linked to your profile.</p>
              </div>

              <div className="patient-dashboard-card">
                <span>Specialization</span>
                <strong>{profile.specialization || "Not set"}</strong>
                <p>Your declared professional focus.</p>
              </div>
            </div>

            <form
              className="profile-form dentist-profile-form"
              onSubmit={handleSubmit}
            >
              <div className="patient-dashboard-section">
                <div className="appointments-header">
                  <div>
                    <h2>Basic Account Information</h2>
                    <p>Update your name and contact email.</p>
                  </div>
                </div>

                <div className="dentist-profile-grid">
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
                    <h2>Professional Information</h2>
                    <p>
                      Keep your license, specialization, and availability
                      updated.
                    </p>
                  </div>
                </div>

                <div className="dentist-profile-grid">
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
                      placeholder="Example: General Dentistry, Orthodontics"
                      required
                    />
                  </div>
                  <div className="profile-field dentist-profile-full">
                    <label>Availability</label>
                    <div className="info-message">
                      Managed below using the structured weekly availability
                      editor.
                    </div>
                  </div>
                </div>
              </div>

              <div className="patient-dashboard-section">
                <div className="appointments-header">
                  <div>
                    <h2>Clinic Assignment</h2>
                    <p>
                      Review or update the clinic connected to your dentist
                      account.
                    </p>
                  </div>
                </div>

                <div className="dentist-profile-grid">
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

                <div className="info-message">
                  Clinic assignment may affect which patient records,
                  appointments, and X-rays are visible to your dentist account.
                </div>
              </div>

              <div className="appointment-actions dentist-profile-save-actions">
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

      <div className="appointments-list-card phase11-dentist-availability-page">
        <div className="appointments-header">
          <div>
            <h2>Structured Dentist Availability</h2>
            <p>
              Set weekly working hours, optional breaks, appointment duration,
              services, and blocked dates. Patients only see generated available
              schedules.
            </p>
          </div>
        </div>
        <div className="phase11-schedule-list">
          {availabilitySchedule.map((day) => (
            <div
              className={`phase11-schedule-row ${day.is_available ? "active" : "closed"}`}
              key={day.day_of_week}
            >
              <label className="phase11-day-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(day.is_available)}
                  onChange={(e) =>
                    updateScheduleDay(
                      day.day_of_week,
                      "is_available",
                      e.target.checked,
                    )
                  }
                />
                <strong>{day.day_name}</strong>
              </label>
              <div>
                <label>Start</label>
                <input
                  type="time"
                  value={day.start_time || "09:00"}
                  disabled={!day.is_available}
                  onChange={(e) =>
                    updateScheduleDay(
                      day.day_of_week,
                      "start_time",
                      e.target.value,
                    )
                  }
                />
              </div>
              <div>
                <label>End</label>
                <input
                  type="time"
                  value={day.end_time || "17:00"}
                  disabled={!day.is_available}
                  onChange={(e) =>
                    updateScheduleDay(
                      day.day_of_week,
                      "end_time",
                      e.target.value,
                    )
                  }
                />
              </div>
              <div>
                <label>Break Start</label>
                <input
                  type="time"
                  value={day.break_start_time || ""}
                  disabled={!day.is_available}
                  onChange={(e) =>
                    updateScheduleDay(
                      day.day_of_week,
                      "break_start_time",
                      e.target.value,
                    )
                  }
                />
              </div>
              <div>
                <label>Break End</label>
                <input
                  type="time"
                  value={day.break_end_time || ""}
                  disabled={!day.is_available}
                  onChange={(e) =>
                    updateScheduleDay(
                      day.day_of_week,
                      "break_end_time",
                      e.target.value,
                    )
                  }
                />
              </div>
              <div>
                <label>Slot</label>
                <select
                  value={day.slot_duration_minutes || 30}
                  disabled={!day.is_available}
                  onChange={(e) =>
                    updateScheduleDay(
                      day.day_of_week,
                      "slot_duration_minutes",
                      Number(e.target.value),
                    )
                  }
                >
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                  <option value="45">45 min</option>
                  <option value="60">60 min</option>
                </select>
              </div>
            </div>
          ))}
        </div>
        <div className="patient-dashboard-section">
          <div className="appointments-header">
            <div>
              <h3>Services You Provide</h3>
              <p>
                Only services offered by your assigned clinic can be selected.
              </p>
            </div>
          </div>
          <div className="phase11-service-checks">
            {clinicServices.map((service) => (
              <label key={service.service_id}>
                <input
                  type="checkbox"
                  checked={selectedServiceIds.includes(
                    Number(service.service_id),
                  )}
                  onChange={() => toggleService(service.service_id)}
                />
                <span>{service.service_name}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="patient-dashboard-section">
          <div className="appointments-header">
            <div>
              <h3>Unavailable Dates</h3>
              <p>
                Block leave, training, holidays, or other dates outside the
                weekly schedule.
              </p>
            </div>
          </div>
          <div className="phase11-block-date-form">
            <input
              type="date"
              min={new Date().toISOString().slice(0, 10)}
              value={newUnavailableDate.unavailable_date}
              onChange={(e) =>
                setNewUnavailableDate((prev) => ({
                  ...prev,
                  unavailable_date: e.target.value,
                }))
              }
            />
            <input
              type="text"
              placeholder="Reason (optional)"
              value={newUnavailableDate.reason}
              onChange={(e) =>
                setNewUnavailableDate((prev) => ({
                  ...prev,
                  reason: e.target.value,
                }))
              }
            />
            <button
              type="button"
              className="secondary-button"
              onClick={addUnavailableDate}
            >
              Add Date
            </button>
          </div>
          <div className="phase11-blocked-dates">
            {unavailableDates.map((item) => (
              <span key={item.unavailable_date_id}>
                <b>{item.unavailable_date}</b>
                {item.reason && ` — ${item.reason}`}
                <button
                  type="button"
                  onClick={() =>
                    removeUnavailableDate(item.unavailable_date_id)
                  }
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
        <div className="appointment-actions">
          <button
            type="button"
            className="primary-button"
            onClick={saveAvailability}
            disabled={savingAvailability}
          >
            {savingAvailability ? "Saving..." : "Save Availability"}
          </button>
        </div>
      </div>

      <div className="appointments-list-card dentist-security-card">
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
          <div className="dentist-security-summary">
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
            className="profile-form dentist-password-form"
            onSubmit={handleChangePassword}
          >
            <div className="dentist-profile-grid">
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

            <div className="appointment-actions dentist-profile-save-actions">
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

export default DentistProfile;
