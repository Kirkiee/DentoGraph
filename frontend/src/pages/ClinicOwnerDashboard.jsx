import React from "react";
import DashboardLayout from "../components/dashboard/DashboardLayout";

function ClinicOwnerDashboard() {
  const storedUser = localStorage.getItem("user");
  const user = storedUser ? JSON.parse(storedUser) : null;

  return (
    <DashboardLayout role="Clinic Owner">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>Clinic Owner Dashboard</h2>
            <p>
              Manage your clinic subscription, staff, usage limits, and clinic
              profile.
            </p>
          </div>
        </div>

        <div className="info-message">
          <strong>Welcome:</strong> {user?.name || "Clinic Owner"}
          <br />
          Your clinic was registered with the Free plan by default. The next
          steps are to display your clinic details, usage limits, and upgrade
          options.
        </div>

        <div className="appointments-list">
          <div className="appointment-item">
            <div className="appointment-info">
              <h3>Subscription Management</h3>
              <p>
                View your current plan, usage limits, and upgrade options. This
                will later connect to PayMongo.
              </p>
            </div>
          </div>

          <div className="appointment-item">
            <div className="appointment-info">
              <h3>Clinic Profile</h3>
              <p>
                View and update your clinic name, address, contact number,
                services, and opening hours.
              </p>
            </div>
          </div>

          <div className="appointment-item">
            <div className="appointment-info">
              <h3>Staff Management</h3>
              <p>
                Add dentists and dental assistants under your clinic based on
                your subscription limits.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default ClinicOwnerDashboard;
