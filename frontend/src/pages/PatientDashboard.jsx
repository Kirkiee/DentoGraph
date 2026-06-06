import React, { useEffect, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import { useNavigate } from "react-router-dom";

function PatientDashboard() {
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

      const response = await API.get("/api/dashboard/patient", authHeaders);
      setDashboardData(response.data);
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to load patient dashboard data.",
      );
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return "N/A";
    return new Date(dateValue).toLocaleString();
  };

  const appointments = dashboardData?.appointments || {};
  const dentalRecords = dashboardData?.dental_records || {};
  const xrays = dashboardData?.xrays || {};
  const upcomingAppointments = dashboardData?.upcoming_appointments || [];
  const recentRecords = dashboardData?.recent_records || [];

  return (
    <DashboardLayout role="Patient">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>Patient Dashboard</h2>
            <p>
              Welcome back, {user?.name || "Patient"}. Here is your live
              appointment, dental record, and X-ray summary.
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
            <div className="dashboard-grid" style={{ marginBottom: "24px" }}>
              <div className="dashboard-card">
                <h3>Total Appointments</h3>
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
                <h3>Cancelled</h3>
                <strong>{appointments.cancelled_appointments || 0}</strong>
              </div>

              <div className="dashboard-card">
                <h3>Reschedule Requests</h3>
                <strong>{appointments.reschedule_requests || 0}</strong>
              </div>

              <div className="dashboard-card">
                <h3>Dental Records</h3>
                <strong>{dentalRecords.total_records || 0}</strong>
              </div>

              <div className="dashboard-card">
                <h3>X-rays</h3>
                <strong>{xrays.total_xrays || 0}</strong>
              </div>
            </div>

            <div className="report-section">
              <div className="appointments-header">
                <div>
                  <h2>Quick Actions</h2>
                  <p>Open your main patient modules directly.</p>
                </div>
              </div>

              <div
                className="appointment-actions"
                style={{ flexDirection: "row", flexWrap: "wrap" }}
              >
                <button
                  className="primary-button"
                  onClick={() => navigate("/patient/appointments")}
                >
                  Book Appointment
                </button>

                <button
                  className="secondary-button"
                  onClick={() => navigate("/patient/records")}
                >
                  My Dental Records
                </button>

                <button
                  className="secondary-button"
                  onClick={() => navigate("/patient/xrays")}
                >
                  My X-rays
                </button>

                <button
                  className="secondary-button"
                  onClick={() => navigate("/patient/profile")}
                >
                  My Profile
                </button>
              </div>
            </div>

            <div className="report-section">
              <div className="appointments-header">
                <div>
                  <h2>Upcoming Appointments</h2>
                  <p>Your pending and scheduled dental appointments.</p>
                </div>
              </div>

              {upcomingAppointments.length === 0 ? (
                <div className="empty-state">
                  <h3>No upcoming appointments</h3>
                  <p>Book an appointment to see it listed here.</p>
                </div>
              ) : (
                <div className="appointments-list">
                  {upcomingAppointments.map((appointment) => (
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

            <div className="report-section">
              <div className="appointments-header">
                <div>
                  <h2>Recent Dental Records</h2>
                  <p>Your latest dental record activity.</p>
                </div>
              </div>

              {recentRecords.length === 0 ? (
                <div className="empty-state">
                  <h3>No dental records yet</h3>
                  <p>Your dental records will appear here once created.</p>
                </div>
              ) : (
                <div className="appointments-list">
                  {recentRecords.map((record) => (
                    <div className="appointment-item" key={record.record_id}>
                      <div className="appointment-info">
                        <div className="appointment-title-row">
                          <h3>Record #{record.record_id}</h3>

                          <span className="status-badge status-scheduled">
                            Active
                          </span>
                        </div>

                        <p>
                          <strong>Dentist:</strong>{" "}
                          {record.dentist_name || "N/A"}
                        </p>

                        <p>
                          <strong>Clinic:</strong>{" "}
                          {record.clinic_name || "No assigned clinic"}
                        </p>

                        <p>
                          <strong>Date Created:</strong>{" "}
                          {formatDate(record.date_created)}
                        </p>

                        <p>
                          <strong>Last Updated:</strong>{" "}
                          {formatDate(record.last_updated)}
                        </p>
                      </div>

                      <div className="appointment-actions">
                        <button
                          className="secondary-button"
                          onClick={() =>
                            navigate(`/patient/records/${record.record_id}`)
                          }
                        >
                          View Record
                        </button>
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

export default PatientDashboard;
