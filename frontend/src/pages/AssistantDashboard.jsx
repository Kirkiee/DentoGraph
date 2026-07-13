import React, { useEffect, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import { useNavigate } from "react-router-dom";

function AssistantDashboard() {
  const navigate = useNavigate();

  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

  const fetchDashboardData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const response = await API.get("/api/dashboard/assistant", authHeaders);
      setDashboardData(response.data);
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to load assistant dashboard data.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return "N/A";

    return new Date(dateValue).toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getStatusClass = (status) => {
    const normalizedStatus = String(status || "").toLowerCase();

    if (normalizedStatus === "pending") return "status-pending";
    if (normalizedStatus === "scheduled") return "status-scheduled";
    if (normalizedStatus === "completed") return "status-completed";
    if (normalizedStatus === "cancelled") return "status-cancelled";

    return "status-scheduled";
  };

  const assistant = dashboardData?.assistant || {};
  const appointments = dashboardData?.appointments || {};
  const dentalRecords = dashboardData?.dental_records || {};
  const xrays = dashboardData?.xrays || {};
  const dentists = dashboardData?.dentists || {};
  const recentAppointments = dashboardData?.recent_appointments || [];

  const summaryCards = [
    {
      label: "Clinic Appointments",
      value: appointments.total_appointments || 0,
      description: "All appointments under your assigned clinic.",
    },
    {
      label: "Pending",
      value: appointments.pending_appointments || 0,
      description: "Appointments waiting for clinic action.",
    },
    {
      label: "Scheduled",
      value: appointments.scheduled_appointments || 0,
      description: "Confirmed appointments under your clinic.",
    },
    {
      label: "Completed",
      value: appointments.completed_appointments || 0,
      description: "Finished clinic appointments.",
    },
    {
      label: "Reschedule Requests",
      value: appointments.reschedule_requests || 0,
      description: "Requests waiting for review.",
    },
    {
      label: "Clinic Dentists",
      value: dentists.clinic_dentists || 0,
      description: "Dentists assigned to your clinic.",
    },
    {
      label: "Active Records",
      value: dentalRecords.active_records || 0,
      description: "Active dental records under your clinic.",
    },
    {
      label: "X-rays Uploaded",
      value: xrays.total_xrays || 0,
      description: "X-ray files linked to clinic records.",
    },
  ];

  const quickActions = [
    {
      title: "Appointments",
      description: "Assist in managing patient appointment schedules.",
      buttonLabel: "Manage Appointments",
      className: "primary-button",
      path: "/assistant/appointments",
    },
    {
      title: "Dental Records",
      description: "Open clinic dental records for assistance and review.",
      buttonLabel: "Open Records",
      className: "secondary-button",
      path: "/assistant/records",
    },
    {
      title: "X-rays",
      description: "View uploaded X-ray files connected to dental records.",
      buttonLabel: "View X-rays",
      className: "secondary-button",
      path: "/assistant/xrays",
    },
    {
      title: "Profile",
      description: "Review your assistant profile and clinic assignment.",
      buttonLabel: "My Profile",
      className: "secondary-button",
      path: "/assistant/profile",
    },
  ];

  const renderLoadingState = () => {
    return (
      <>
        <div className="patient-dashboard-summary-grid">
          {Array.from({ length: 8 }).map((_, index) => (
            <div className="patient-dashboard-card loading-card" key={index}>
              <div className="loading-line loading-title"></div>
              <div className="loading-line loading-number"></div>
              <div className="loading-line loading-text"></div>
            </div>
          ))}
        </div>

        <div className="patient-dashboard-section">
          <div className="loading-panel">
            <div className="loading-line loading-title"></div>
            <div className="loading-line loading-text"></div>
            <div className="loading-line loading-text"></div>
          </div>
        </div>
      </>
    );
  };

  return (
    <DashboardLayout role="Assistant">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>Assistant Dashboard</h2>
            <p>
              Welcome back, {user?.name || "Assistant"}. View your assigned
              clinic, appointments, records, dentists, and X-ray activity.
            </p>
          </div>

          <button
            className="secondary-button"
            onClick={() => fetchDashboardData(true)}
            disabled={loading || refreshing}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {error && (
          <div className="error-message">
            <strong>Unable to load dashboard.</strong>
            <p>{error}</p>
            <button
              type="button"
              className="secondary-button"
              onClick={() => fetchDashboardData(true)}
              disabled={refreshing}
            >
              Try Again
            </button>
          </div>
        )}

        {loading ? (
          renderLoadingState()
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

                  <span
                    className={`status-badge ${
                      assistant.clinic_name
                        ? "status-scheduled"
                        : "status-cancelled"
                    }`}
                  >
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

                {!assistant.clinic_name && (
                  <div className="info-message" style={{ marginTop: "12px" }}>
                    You are not assigned to a clinic yet. Please contact the
                    clinic owner or system administrator.
                  </div>
                )}
              </div>
            </div>

            <div className="patient-dashboard-summary-grid">
              {summaryCards.map((card) => (
                <div className="patient-dashboard-card" key={card.label}>
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                  <p>{card.description}</p>
                </div>
              ))}
            </div>

            <div className="patient-dashboard-section">
              <div className="appointments-header">
                <div>
                  <h2>Quick Actions</h2>
                  <p>Open the assistant modules commonly used during demos.</p>
                </div>
              </div>

              <div className="patient-quick-action-grid">
                {quickActions.map((action) => (
                  <div className="patient-quick-action-card" key={action.title}>
                    <div>
                      <h3>{action.title}</h3>
                      <p>{action.description}</p>
                    </div>

                    <button
                      className={action.className}
                      onClick={() => navigate(action.path)}
                    >
                      {action.buttonLabel}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="patient-dashboard-section">
              <div className="appointments-header">
                <div>
                  <h2>Recent Clinic Appointments</h2>
                  <p>Latest appointment activity under your assigned clinic.</p>
                </div>

                <button
                  className="secondary-button"
                  onClick={() => navigate("/assistant/appointments")}
                >
                  Manage Appointments
                </button>
              </div>

              {recentAppointments.length === 0 ? (
                <div className="empty-state">
                  <h3>No recent appointments</h3>
                  <p>
                    Clinic appointment activity will appear here once patients
                    book or update appointments.
                  </p>
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

                          <span
                            className={`status-badge ${getStatusClass(
                              appointment.status,
                            )}`}
                          >
                            {appointment.status || "Scheduled"}
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

                      <div className="appointment-actions">
                        <button
                          className="secondary-button"
                          onClick={() => navigate("/assistant/appointments")}
                        >
                          Open Appointment
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

export default AssistantDashboard;
