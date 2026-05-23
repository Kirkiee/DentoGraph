import React from "react";
import DashboardLayout from "../components/dashboard/DashboardLayout";

function AssistantProfile() {
  const storedUser = localStorage.getItem("user");
  const user = storedUser ? JSON.parse(storedUser) : null;

  return (
    <DashboardLayout role="Assistant">
      <div className="profile-container">
        <div className="profile-card">
          <h2>My Profile</h2>
          <p>
            View your assistant account information. Full profile editing can be
            added later once the assistant profile endpoint is ready.
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
                <input type="text" value={user?.role || "Assistant"} disabled />
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

export default AssistantProfile;
