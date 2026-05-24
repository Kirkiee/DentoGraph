import React, { useEffect, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";

function AdminReports() {
  const [users, setUsers] = useState([]);
  const [appointments, setAppointments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const token = localStorage.getItem("token");

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  useEffect(() => {
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError("");

      const usersResponse = await API.get(
        "/api/users/admin/users",
        authHeaders,
      );

      const appointmentsResponse = await API.get(
        "/api/appointments",
        authHeaders,
      );

      setUsers(usersResponse.data.users || []);
      setAppointments(appointmentsResponse.data.appointments || []);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load reports.");
    } finally {
      setLoading(false);
    }
  };

  const countUsersByRole = (roleName) => {
    return users.filter((user) => user.role_name === roleName).length;
  };

  const countAppointmentsByStatus = (status) => {
    return appointments.filter((appointment) => appointment.status === status)
      .length;
  };

  const totalUsers = users.length;
  const activeUsers = users.filter((user) => user.status === "Active").length;
  const inactiveUsers = users.filter(
    (user) => user.status === "Inactive",
  ).length;

  const totalPatients = countUsersByRole("Patient");
  const totalDentists = countUsersByRole("Dentist");
  const totalAssistants = countUsersByRole("Assistant");
  const totalAdmins = countUsersByRole("Admin");

  const totalAppointments = appointments.length;
  const pendingAppointments = countAppointmentsByStatus("Pending");
  const scheduledAppointments = countAppointmentsByStatus("Scheduled");
  const completedAppointments = countAppointmentsByStatus("Completed");
  const cancelledAppointments = countAppointmentsByStatus("Cancelled");

  const rescheduleRequests = appointments.filter(
    (appointment) => appointment.reschedule_request,
  ).length;

  const recentAppointments = [...appointments]
    .sort((a, b) => new Date(b.appointment_date) - new Date(a.appointment_date))
    .slice(0, 5);

  const recentUsers = [...users]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);

  return (
    <DashboardLayout role="Admin">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>Reports & Analytics</h2>
            <p>
              View system summaries for users, appointments, and reschedule
              activity.
            </p>
          </div>

          <button
            className="secondary-button"
            onClick={fetchReports}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {loading ? (
          <p>Loading reports...</p>
        ) : (
          <>
            <div className="report-section">
              <div className="appointments-header">
                <div>
                  <h2>User Summary</h2>
                  <p>Overview of registered users and account activity.</p>
                </div>
              </div>

              <div className="dashboard-grid">
                <div className="dashboard-card">
                  <h3>Total Users</h3>
                  <strong>{totalUsers}</strong>
                </div>

                <div className="dashboard-card">
                  <h3>Active Users</h3>
                  <strong>{activeUsers}</strong>
                </div>

                <div className="dashboard-card">
                  <h3>Inactive Users</h3>
                  <strong>{inactiveUsers}</strong>
                </div>

                <div className="dashboard-card">
                  <h3>Admins</h3>
                  <strong>{totalAdmins}</strong>
                </div>
              </div>

              <div className="dashboard-grid" style={{ marginTop: "18px" }}>
                <div className="dashboard-card">
                  <h3>Patients</h3>
                  <strong>{totalPatients}</strong>
                </div>

                <div className="dashboard-card">
                  <h3>Dentists</h3>
                  <strong>{totalDentists}</strong>
                </div>

                <div className="dashboard-card">
                  <h3>Assistants</h3>
                  <strong>{totalAssistants}</strong>
                </div>

                <div className="dashboard-card">
                  <h3>Clinical Staff</h3>
                  <strong>{totalDentists + totalAssistants}</strong>
                </div>
              </div>
            </div>

            <div className="report-section">
              <div className="appointments-header">
                <div>
                  <h2>Appointment Summary</h2>
                  <p>
                    Overview of appointment statuses and reschedule requests.
                  </p>
                </div>
              </div>

              <div className="dashboard-grid">
                <div className="dashboard-card">
                  <h3>Total Appointments</h3>
                  <strong>{totalAppointments}</strong>
                </div>

                <div className="dashboard-card">
                  <h3>Pending</h3>
                  <strong>{pendingAppointments}</strong>
                </div>

                <div className="dashboard-card">
                  <h3>Scheduled</h3>
                  <strong>{scheduledAppointments}</strong>
                </div>

                <div className="dashboard-card">
                  <h3>Completed</h3>
                  <strong>{completedAppointments}</strong>
                </div>
              </div>

              <div className="dashboard-grid" style={{ marginTop: "18px" }}>
                <div className="dashboard-card">
                  <h3>Cancelled</h3>
                  <strong>{cancelledAppointments}</strong>
                </div>

                <div className="dashboard-card">
                  <h3>Reschedule Requests</h3>
                  <strong>{rescheduleRequests}</strong>
                </div>

                <div className="dashboard-card">
                  <h3>Open Appointments</h3>
                  <strong>{pendingAppointments + scheduledAppointments}</strong>
                </div>

                <div className="dashboard-card">
                  <h3>Closed Appointments</h3>
                  <strong>
                    {completedAppointments + cancelledAppointments}
                  </strong>
                </div>
              </div>
            </div>

            <div className="report-two-column">
              <div className="report-panel">
                <div className="appointments-header">
                  <div>
                    <h2>Recent Users</h2>
                    <p>Latest registered accounts.</p>
                  </div>
                </div>

                {recentUsers.length === 0 ? (
                  <div className="empty-state">
                    <h3>No users found</h3>
                    <p>Registered users will appear here.</p>
                  </div>
                ) : (
                  <div className="appointments-list">
                    {recentUsers.map((user) => (
                      <div className="appointment-item" key={user.user_id}>
                        <div className="appointment-info">
                          <div className="appointment-title-row">
                            <h3>{user.name}</h3>

                            <span className="status-badge status-scheduled">
                              {user.role_name || "No Role"}
                            </span>
                          </div>

                          <p>
                            <strong>Email:</strong> {user.email}
                          </p>

                          <p>
                            <strong>Status:</strong> {user.status}
                          </p>

                          <p>
                            <strong>Created:</strong>{" "}
                            {user.created_at
                              ? new Date(user.created_at).toLocaleString()
                              : "N/A"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="report-panel">
                <div className="appointments-header">
                  <div>
                    <h2>Recent Appointments</h2>
                    <p>Latest appointment records in the system.</p>
                  </div>
                </div>

                {recentAppointments.length === 0 ? (
                  <div className="empty-state">
                    <h3>No appointments found</h3>
                    <p>Appointment records will appear here.</p>
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
                            {appointment.patient_name ||
                              `Patient ID ${appointment.patient_id}`}
                          </p>

                          <p>
                            <strong>Dentist:</strong>{" "}
                            {appointment.dentist_name ||
                              `Dentist ID ${appointment.dentist_id}`}
                          </p>

                          <p>
                            <strong>Clinic:</strong>{" "}
                            {appointment.clinic_name || "No assigned clinic"}
                          </p>

                          <p>
                            <strong>Date:</strong>{" "}
                            {appointment.appointment_date
                              ? new Date(
                                  appointment.appointment_date,
                                ).toLocaleString()
                              : "N/A"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

export default AdminReports;
