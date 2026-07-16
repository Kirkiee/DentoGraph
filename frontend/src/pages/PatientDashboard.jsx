import React, { useEffect, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import { useNavigate } from "react-router-dom";

function PatientDashboard() {
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

      const response = await API.get("/api/dashboard/patient", authHeaders);
      setDashboardData(response.data);
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to load patient dashboard data.",
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

  const appointments = dashboardData?.appointments || {};
  const dentalRecords = dashboardData?.dental_records || {};
  const xrays = dashboardData?.xrays || {};
  const upcomingAppointments = dashboardData?.upcoming_appointments || [];
  const recentRecords = dashboardData?.recent_records || [];

  const summaryCards = [
    {
      label: "Total Appointments",
      value: appointments.total_appointments || 0,
      description: "All appointments under your patient account.",
    },
    {
      label: "Pending",
      value: appointments.pending_appointments || 0,
      description: "Appointments waiting for clinic confirmation.",
    },
    {
      label: "Scheduled",
      value: appointments.scheduled_appointments || 0,
      description: "Confirmed appointments with your dentist.",
    },
    {
      label: "Completed",
      value: appointments.completed_appointments || 0,
      description: "Finished dental visits.",
    },
    {
      label: "Cancelled",
      value: appointments.cancelled_appointments || 0,
      description: "Appointments cancelled by you or the clinic.",
    },
    {
      label: "Reschedule Requests",
      value: appointments.reschedule_requests || 0,
      description: "Requests waiting for clinic review.",
    },
    {
      label: "Dental Records",
      value: dentalRecords.total_records || 0,
      description: "Dental records available for your account.",
    },
    {
      label: "X-rays",
      value: xrays.total_xrays || 0,
      description: "Uploaded X-ray images linked to your records.",
    },
  ];

  const quickActions = [
    {
      title: "Book Appointment",
      description: "Schedule a dental visit with an available clinic dentist.",
      buttonLabel: "Book Now",
      className: "primary-button",
      path: "/patient/appointments",
    },
    {
      title: "Dental Records",
      description: "View your dental chart, diagnoses, and treatment notes.",
      buttonLabel: "View Records",
      className: "secondary-button",
      path: "/patient/records",
    },
    {
      title: "X-rays",
      description: "Review your dental X-rays and AI-assisted findings.",
      buttonLabel: "View X-rays",
      className: "secondary-button",
      path: "/patient/xrays",
    },
    {
      title: "Clinic Discovery",
      description: "Find active clinics available in the system.",
      buttonLabel: "Find Clinics",
      className: "secondary-button",
      path: "/patient/clinics",
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
    <DashboardLayout role="Patient">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>Patient Dashboard</h2>
            <p>
              Welcome back, {user?.name || "Patient"}. View your appointments,
              dental records, X-rays, and patient shortcuts in one place.
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
                  <p>Open the patient modules commonly used during demos.</p>
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
                  <p>Your pending and scheduled dental appointments.</p>
                </div>

                <button
                  className="secondary-button"
                  onClick={() => navigate("/patient/appointments")}
                >
                  Manage Appointments
                </button>
              </div>

              {upcomingAppointments.length === 0 ? (
                <div className="empty-state">
                  <h3>No upcoming appointments</h3>
                  <p>
                    Book an appointment at least 5 to 7 days in advance so the
                    clinic has enough time to review the schedule.
                  </p>
                  <button
                    className="primary-button"
                    onClick={() => navigate("/patient/appointments")}
                  >
                    Book Appointment
                  </button>
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

            <div className="patient-dashboard-section">
              <div className="appointments-header">
                <div>
                  <h2>Recent Dental Records</h2>
                  <p>Your latest dental record activity.</p>
                </div>

                <button
                  className="secondary-button"
                  onClick={() => navigate("/patient/records")}
                >
                  View All Records
                </button>
              </div>

              {recentRecords.length === 0 ? (
                <div className="empty-state">
                  <h3>No dental records yet</h3>
                  <p>
                    Your dental records will appear here once your dentist
                    creates them during or after a consultation.
                  </p>
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

                        <button
                          className="secondary-button"
                          onClick={() =>
                            navigate(
                              `/patient/ar-braces?record_id=${record.record_id}`,
                            )
                          }
                        >
                          AR Preview
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
