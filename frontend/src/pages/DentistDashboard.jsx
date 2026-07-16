import React, { useEffect, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import { useNavigate } from "react-router-dom";

function DentistDashboard() {
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

      const response = await API.get("/api/dashboard/dentist", authHeaders);
      setDashboardData(response.data);
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to load dentist dashboard data.",
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

  const dentist = dashboardData?.dentist || {};
  const appointments = dashboardData?.appointments || {};
  const dentalRecords = dashboardData?.dental_records || {};
  const xrays = dashboardData?.xrays || {};
  const patients = dashboardData?.patients || {};
  const upcomingAppointments = dashboardData?.upcoming_appointments || [];

  const summaryCards = [
    {
      label: "Total Appointments",
      value: appointments.total_appointments || 0,
      description: "All appointments assigned to you.",
    },
    {
      label: "Pending",
      value: appointments.pending_appointments || 0,
      description: "Patient appointments waiting for action.",
    },
    {
      label: "Scheduled",
      value: appointments.scheduled_appointments || 0,
      description: "Confirmed appointments on your schedule.",
    },
    {
      label: "Completed",
      value: appointments.completed_appointments || 0,
      description: "Finished dental consultations.",
    },
    {
      label: "Reschedule Requests",
      value: appointments.reschedule_requests || 0,
      description: "Requests from patients waiting for review.",
    },
    {
      label: "Unique Patients",
      value: patients.total_patients || 0,
      description: "Patients connected to your appointments.",
    },
    {
      label: "Active Records",
      value: dentalRecords.active_records || 0,
      description: "Active dental records handled by you.",
    },
    {
      label: "X-rays Uploaded",
      value: xrays.total_xrays || 0,
      description: "X-ray files connected to your dental records.",
    },
  ];

  const quickActions = [
    {
      title: "Appointments",
      description:
        "Review, schedule, complete, or cancel patient appointments.",
      buttonLabel: "View Appointments",
      className: "primary-button",
      path: "/dentist/appointments",
    },
    {
      title: "Dental Records",
      description: "Open patient records and update treatment information.",
      buttonLabel: "Open Records",
      className: "secondary-button",
      path: "/dentist/dental-records",
    },
    {
      title: "X-rays",
      description: "View uploaded X-rays and AI-assisted review results.",
      buttonLabel: "View X-rays",
      className: "secondary-button",
      path: "/dentist/xrays",
    },
    {
      title: "Profile",
      description: "Manage your dentist profile and clinic assignment details.",
      buttonLabel: "My Profile",
      className: "secondary-button",
      path: "/dentist/profile",
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
    <DashboardLayout role="Dentist">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>Dentist Dashboard</h2>
            <p>
              Welcome back, Dr. {user?.name || "Dentist"}. View your clinic
              assignment, appointments, patients, dental records, and X-rays.
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
                  <h3>Clinic Assignment</h3>

                  <span
                    className={`status-badge ${
                      dentist.clinic_name
                        ? "status-scheduled"
                        : "status-cancelled"
                    }`}
                  >
                    {dentist.clinic_name || "No assigned clinic"}
                  </span>
                </div>

                <p>
                  <strong>Dentist ID:</strong> {dentist.dentist_id || "N/A"}
                </p>

                <p>
                  <strong>Clinic:</strong>{" "}
                  {dentist.clinic_name || "No assigned clinic"}
                </p>

                {!dentist.clinic_name && (
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
                  <p>Open the dentist modules commonly used during demos.</p>
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
                  <h2>Upcoming Appointments</h2>
                  <p>Your latest pending and scheduled patient appointments.</p>
                </div>

                <button
                  className="secondary-button"
                  onClick={() => navigate("/dentist/appointments")}
                >
                  Manage Appointments
                </button>
              </div>

              {upcomingAppointments.length === 0 ? (
                <div className="empty-state">
                  <h3>No upcoming appointments</h3>
                  <p>
                    Pending and scheduled appointments assigned to you will
                    appear here.
                  </p>
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
                          <strong>Date:</strong>{" "}
                          {formatDate(appointment.appointment_date)}
                        </p>
                      </div>

                      <div className="appointment-actions">
                        <button
                          className="secondary-button"
                          onClick={() => navigate("/dentist/appointments")}
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

export default DentistDashboard;
