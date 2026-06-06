import React, { useEffect, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";

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

  const [clinics, setClinics] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      setError("");

      await Promise.all([fetchProfile(), fetchClinics()]);
    } catch (err) {
      setError("Unable to load assistant profile data.");
    } finally {
      setLoading(false);
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
    setProfile((prev) => ({
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
        "/api/assistants/profile",
        {
          name: profile.name,
          email: profile.email,
          license_number: profile.license_number,
          availability: profile.availability,
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

  return (
    <DashboardLayout role="Assistant">
      <div className="profile-container">
        <div className="profile-card">
          <h2>My Profile</h2>
          <p>
            Manage your assistant account details, assigned clinic, license
            information, and availability.
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
      </div>
    </DashboardLayout>
  );
}

export default AssistantProfile;
