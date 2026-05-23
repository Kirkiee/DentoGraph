import React from "react";
import DashboardLayout from "../components/dashboard/DashboardLayout";

function DentistProfile() {
  const storedUser = localStorage.getItem("user");
  const user = storedUser ? JSON.parse(storedUser) : null;

  return (
    <DashboardLayout role="Dentist">
      <div className="profile-container">
        <div className="profile-card">
          <h2>My Profile</h2>
          <p>
            View your dentist account information. Full profile editing can be
            added later once the dentist profile endpoint is ready.
          </p>

          <div className="profile-form">
            <div className="profile-grid">
              <div className="profile-field">
                <label>Name</label>
                <input type="text" value={user?.name || ""} disabled />
              </div>

              <div className="profile-field">
                <label>Email</label>
                <input type="email" value={user?.email || ""} disabled />
              </div>

              <div className="profile-field">
                <label>Role</label>
                <input type="text" value={user?.role || "Dentist"} disabled />
              </div>

              <div className="profile-field">
                <label>Account Status</label>
                <input type="text" value={user?.status || "Active"} disabled />
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default DentistProfile;
