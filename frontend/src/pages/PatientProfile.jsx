import React, { useEffect, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";

function PatientProfile() {
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    contact_number: "",
    date_of_birth: "",
    address: "",
    gender: "",
    medical_history: "",
    dentition_type: "Adult",
    account_status: "",
  });

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
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatDateForInput = (dateValue) => {
    if (!dateValue) return "";

    if (typeof dateValue === "string") {
      const dateOnlyMatch = dateValue.match(/^(\d{4}-\d{2}-\d{2})/);

      if (dateOnlyMatch) {
        return dateOnlyMatch[1];
      }
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await API.get("/api/patients/profile", authHeaders);
      const patient = response.data.patient;

      setProfile({
        name: patient.name || "",
        email: patient.email || "",
        contact_number: patient.contact_number || "",
        date_of_birth: formatDateForInput(patient.date_of_birth),
        address: patient.address || "",
        gender: patient.gender || "",
        medical_history: patient.medical_history || "",
        dentition_type: patient.dentition_type || "Adult",
        account_status: patient.account_status || "",
      });
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load patient profile.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setProfile((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!profile.name || !profile.email) {
      setError("Name and email are required.");
      return;
    }

    if (!["Adult", "Child"].includes(profile.dentition_type)) {
      setError("Please select a valid patient dentition type.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      setError("");

      const response = await API.put(
        "/api/patients/profile",
        {
          name: profile.name,
          email: profile.email,
          contact_number: profile.contact_number,
          date_of_birth: profile.date_of_birth || null,
          address: profile.address,
          gender: profile.gender,
          medical_history: profile.medical_history,
          dentition_type: profile.dentition_type,
        },
        authHeaders,
      );

      const updatedPatient = response.data.patient;

      setProfile({
        name: updatedPatient.name || "",
        email: updatedPatient.email || "",
        contact_number: updatedPatient.contact_number || "",
        date_of_birth: formatDateForInput(updatedPatient.date_of_birth),
        address: updatedPatient.address || "",
        gender: updatedPatient.gender || "",
        medical_history: updatedPatient.medical_history || "",
        dentition_type: updatedPatient.dentition_type || "Adult",
        account_status: updatedPatient.account_status || "",
      });

      const storedUser = localStorage.getItem("user");

      if (storedUser) {
        const user = JSON.parse(storedUser);

        localStorage.setItem(
          "user",
          JSON.stringify({
            ...user,
            name: updatedPatient.name,
            email: updatedPatient.email,
          }),
        );
      }

      setMessage("Profile updated successfully.");
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to update patient profile.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout role="Patient">
      <div className="profile-container">
        <div className="profile-card">
          <h2>My Profile</h2>

          <p>
            Manage your patient account details, contact information, medical
            background, and dentition type.
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
                  <label>Contact Number</label>

                  <input
                    type="text"
                    name="contact_number"
                    value={profile.contact_number}
                    onChange={handleChange}
                    placeholder="Example: 09123456789"
                  />
                </div>

                <div className="profile-field">
                  <label>Date of Birth</label>

                  <input
                    type="date"
                    name="date_of_birth"
                    value={profile.date_of_birth}
                    onChange={handleChange}
                  />
                </div>

                <div className="profile-field">
                  <label>Gender</label>

                  <select
                    name="gender"
                    value={profile.gender}
                    onChange={handleChange}
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>

                <div className="profile-field">
                  <label>Dentition Type</label>

                  <select
                    name="dentition_type"
                    value={profile.dentition_type}
                    onChange={handleChange}
                    required
                  >
                    <option value="Adult">Adult / Permanent Teeth</option>
                    <option value="Child">Child / Primary Teeth</option>
                  </select>
                </div>

                <div className="profile-field">
                  <label>Account Status</label>

                  <input
                    type="text"
                    value={profile.account_status || "Active"}
                    disabled
                  />
                </div>
              </div>

              <div className="info-message" style={{ marginTop: "16px" }}>
                <strong>Dentition Type Guide:</strong> Adult patients use
                permanent FDI tooth numbers 11–18, 21–28, 31–38, and 41–48.
                Child patients use primary FDI tooth numbers 51–55, 61–65,
                71–75, and 81–85.
              </div>

              <div className="profile-field">
                <label>Address</label>

                <textarea
                  name="address"
                  value={profile.address}
                  onChange={handleChange}
                  placeholder="Enter your complete address"
                />
              </div>

              <div className="profile-field">
                <label>Medical History</label>

                <textarea
                  name="medical_history"
                  value={profile.medical_history}
                  onChange={handleChange}
                  placeholder="Enter allergies, previous conditions, medications, or other relevant notes"
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

export default PatientProfile;
