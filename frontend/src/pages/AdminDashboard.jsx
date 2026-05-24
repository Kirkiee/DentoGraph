import React, { useEffect, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import { useNavigate } from "react-router-dom";

function AdminDashboard() {
  const navigate = useNavigate();

  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const token = localStorage.getItem("token");
  const storedUser = localStorage.getItem("user");
  const user = storedUser ? JSON.parse(storedUser) : null;

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  useEffect(() => {
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await API.get("/api/dashboard/admin", authHeaders);
      setDashboardData(response.data);
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to load admin dashboard data.",
      );
    } finally {
      setLoading(false);
    }
  };

  const getRoleCount = (roleName) => {
    if (!dashboardData?.roles) return 0;

    const role = dashboardData.roles.find(
      (item) => item.role_name === roleName,
    );

    return role?.count || 0;
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return "N/A";
    return new Date(dateValue).toLocaleString();
  };

  const users = dashboardData?.users || {};
  const clinics = dashboardData?.clinics || {};
  const appointments = dashboardData?.appointments || {};
  const dentalRecords = dashboardData?.dental_records || {};
  const xrays = dashboardData?.xrays || {};
  const subscriptions = dashboardData?.subscriptions || {};
  const recentAppointments = dashboardData?.recent_appointments || [];

  return (
    <DashboardLayout role="Admin">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>Admin Dashboard</h2>
            <p>
              Welcome back, {user?.name || "Admin"}. Here is a live overview of
              users, clinics, appointments, records, and system activity.
            </p>
          </div>

          <button
            className="secondary-button"
            onClick={fetchDashboardData}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {loading ? (
          <p>Loading dashboard...</p>
        ) : !dashboardData ? (
          <div className="empty-state">
            <h3>No dashboard data found</h3>
            <p>Dashboard data will appear once the system has records.</p>
          </div>
        ) : (
          <>
            <div className="dashboard-grid" style={{ marginBottom: "24px" }}>
              <div className="dashboard-card">
                <h3>Total Users</h3>
                <strong>{users.total_users || 0}</strong>
              </div>

              <div className="dashboard-card">
                <h3>Active Users</h3>
                <strong>{users.active_users || 0}</strong>
              </div>

              <div className="dashboard-card">
                <h3>Clinics</h3>
                <strong>{clinics.total_clinics || 0}</strong>
              </div>

              <div className="dashboard-card">
                <h3>Appointments</h3>
                <strong>{appointments.total_appointments || 0}</strong>
              </div>
            </div>

            <div className="dashboard-grid" style={{ marginBottom: "24px" }}>
              <div className="dashboard-card">
                <h3>Patients</h3>
                <strong>{getRoleCount("Patient")}</strong>
              </div>

              <div className="dashboard-card">
                <h3>Dentists</h3>
                <strong>{getRoleCount("Dentist")}</strong>
              </div>

              <div className="dashboard-card">
                <h3>Assistants</h3>
                <strong>
                  {getRoleCount("Assistant") + getRoleCount("Dental Assistant")}
                </strong>
              </div>

              <div className="dashboard-card">
                <h3>Admins</h3>
                <strong>{getRoleCount("Admin")}</strong>
              </div>
            </div>

            <div className="dashboard-grid" style={{ marginBottom: "24px" }}>
              <div className="dashboard-card">
                <h3>Pending Appointments</h3>
                <strong>{appointments.pending_appointments || 0}</strong>
              </div>

              <div className="dashboard-card">
                <h3>Scheduled</h3>
                <strong>{appointments.scheduled_appointments || 0}</strong>
              </div>

              <div className="dashboard-card">
                <h3>Completed</h3>
                <strong>{appointments.completed_appointments || 0}</strong>
              </div>

              <div className="dashboard-card">
                <h3>Reschedule Requests</h3>
                <strong>{appointments.reschedule_requests || 0}</strong>
              </div>
            </div>

            <div className="dashboard-grid" style={{ marginBottom: "24px" }}>
              <div className="dashboard-card">
                <h3>Active Records</h3>
                <strong>{dentalRecords.active_records || 0}</strong>
              </div>

              <div className="dashboard-card">
                <h3>Archived Records</h3>
                <strong>{dentalRecords.archived_records || 0}</strong>
              </div>

              <div className="dashboard-card">
                <h3>X-rays Uploaded</h3>
                <strong>{xrays.total_xrays || 0}</strong>
              </div>

              <div className="dashboard-card">
                <h3>Active Plans</h3>
                <strong>{subscriptions.active_plans || 0}</strong>
              </div>
            </div>

            <div className="report-section">
              <div className="appointments-header">
                <div>
                  <h2>Quick Actions</h2>
                  <p>
                    Open important admin modules directly from the dashboard.
                  </p>
                </div>
              </div>

              <div
                className="appointment-actions"
                style={{ flexDirection: "row", flexWrap: "wrap" }}
              >
                <button
                  className="primary-button"
                  onClick={() => navigate("/admin/users")}
                >
                  Manage Users
                </button>

                <button
                  className="secondary-button"
                  onClick={() => navigate("/admin/clinics")}
                >
                  Manage Clinics
                </button>

                <button
                  className="secondary-button"
                  onClick={() => navigate("/admin/dental-records")}
                >
                  Dental Records
                </button>

                <button
                  className="secondary-button"
                  onClick={() => navigate("/admin/reports")}
                >
                  View Reports
                </button>
              </div>
            </div>

            <div className="report-section">
              <div className="appointments-header">
                <div>
                  <h2>Recent Appointments</h2>
                  <p>Latest appointment activity across the system.</p>
                </div>
              </div>

              {recentAppointments.length === 0 ? (
                <div className="empty-state">
                  <h3>No recent appointments</h3>
                  <p>Recent appointment activity will appear here.</p>
                </div>
              ) : (
                <div className="appointments-list">
                  {recentAppointments.map((appointment) => (
                    <div
                      className="appointment-item"
                      key={appointment.appointment_id}
                    >
                      <div className="appointment-info">
                        <div className="appointment-title-row">
                          <h3>
                            {appointment.appointment_type ||
                              "Dental Consultation"}
                          </h3>

                          <span className="status-badge status-scheduled">
                            {appointment.status}
                          </span>
                        </div>

                        <p>
                          <strong>Patient:</strong>{" "}
                          {appointment.patient_name || "N/A"}
                        </p>

                        <p>
                          <strong>Dentist:</strong>{" "}
                          {appointment.dentist_name || "N/A"}
                        </p>

                        <p>
                          <strong>Clinic:</strong>{" "}
                          {appointment.clinic_name || "No assigned clinic"}
                        </p>

                        <p>
                          <strong>Date:</strong>{" "}
                          {formatDate(appointment.appointment_date)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

export default AdminDashboard;
