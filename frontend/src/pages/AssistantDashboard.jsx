import React, { useEffect, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import { useNavigate } from "react-router-dom";

function AssistantDashboard() {
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

      const response = await API.get("/api/dashboard/assistant", authHeaders);
      setDashboardData(response.data);
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to load assistant dashboard data.",
      );
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return "N/A";
    return new Date(dateValue).toLocaleString();
  };

  const assistant = dashboardData?.assistant || {};
  const appointments = dashboardData?.appointments || {};
  const dentalRecords = dashboardData?.dental_records || {};
  const xrays = dashboardData?.xrays || {};
  const dentists = dashboardData?.dentists || {};
  const recentAppointments = dashboardData?.recent_appointments || [];

  return (
    <DashboardLayout role="Assistant">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>Assistant Dashboard</h2>
            <p>
              Welcome back, {user?.name || "Assistant"}. Here is a live summary
              of your assigned clinic, appointments, dental records, and X-rays.
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
            <p>Your dashboard data will appear once records are available.</p>
          </div>
        ) : (
          <>
            <div className="appointment-item" style={{ marginBottom: "24px" }}>
              <div className="appointment-info">
                <div className="appointment-title-row">
                  <h3>Assigned Clinic</h3>
                  <span className="status-badge status-scheduled">
                    {assistant.clinic_name || "No assigned clinic"}
                  </span>
                </div>

                <p>
                  <strong>Assistant ID:</strong>{" "}
                  {assistant.assistant_id || "N/A"}
                </p>

                <p>
                  <strong>Clinic:</strong>{" "}
                  {assistant.clinic_name || "No assigned clinic"}
                </p>
              </div>
            </div>

            <div className="dashboard-grid" style={{ marginBottom: "24px" }}>
              <div className="dashboard-card">
                <h3>Clinic Appointments</h3>
                <strong>{appointments.total_appointments || 0}</strong>
              </div>

              <div className="dashboard-card">
                <h3>Pending</h3>
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
            </div>

            <div className="dashboard-grid" style={{ marginBottom: "24px" }}>
              <div className="dashboard-card">
                <h3>Reschedule Requests</h3>
                <strong>{appointments.reschedule_requests || 0}</strong>
              </div>

              <div className="dashboard-card">
                <h3>Clinic Dentists</h3>
                <strong>{dentists.clinic_dentists || 0}</strong>
              </div>

              <div className="dashboard-card">
                <h3>Active Records</h3>
                <strong>{dentalRecords.active_records || 0}</strong>
              </div>

              <div className="dashboard-card">
                <h3>X-rays Uploaded</h3>
                <strong>{xrays.total_xrays || 0}</strong>
              </div>
            </div>

            <div className="report-section">
              <div className="appointments-header">
                <div>
                  <h2>Quick Actions</h2>
                  <p>Open your main assistant modules directly.</p>
                </div>
              </div>

              <div
                className="appointment-actions"
                style={{ flexDirection: "row", flexWrap: "wrap" }}
              >
                <button
                  className="primary-button"
                  onClick={() => navigate("/assistant/appointments")}
                >
                  Manage Appointments
                </button>

                <button
                  className="secondary-button"
                  onClick={() => navigate("/assistant/records")}
                >
                  Dental Records
                </button>

                <button
                  className="secondary-button"
                  onClick={() => navigate("/assistant/xrays")}
                >
                  X-rays
                </button>

                <button
                  className="secondary-button"
                  onClick={() => navigate("/assistant/profile")}
                >
                  My Profile
                </button>
              </div>
            </div>

            <div className="report-section">
              <div className="appointments-header">
                <div>
                  <h2>Recent Clinic Appointments</h2>
                  <p>Latest appointment activity under your assigned clinic.</p>
                </div>
              </div>

              {recentAppointments.length === 0 ? (
                <div className="empty-state">
                  <h3>No recent appointments</h3>
                  <p>Clinic appointment activity will appear here.</p>
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

export default AssistantDashboard;
