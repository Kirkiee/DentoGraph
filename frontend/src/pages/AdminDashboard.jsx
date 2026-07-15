import React, { useEffect, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import { useNavigate } from "react-router-dom";

function AdminDashboard() {
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

      const response = await API.get("/api/dashboard/admin", authHeaders);
      setDashboardData(response.data);
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to load admin dashboard data.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
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

  const users = dashboardData?.users || {};
  const clinics = dashboardData?.clinics || {};
  const appointments = dashboardData?.appointments || {};
  const dentalRecords = dashboardData?.dental_records || {};
  const xrays = dashboardData?.xrays || {};
  const subscriptions = dashboardData?.subscriptions || {};
  const recentAppointments = dashboardData?.recent_appointments || [];

  const summaryCards = [
    {
      label: "Total Users",
      value: users.total_users || 0,
      description: "All registered accounts in the system.",
    },
    {
      label: "Clinic Owners",
      value: clinics.total_owner_accounts || getRoleCount("Clinic Owner") || 0,
      description: "SaaS client accounts managing clinic locations.",
    },
    {
      label: "Clinic Locations",
      value: clinics.total_clinic_locations || clinics.total_clinics || 0,
      description: "All clinic locations registered in DentoGraph.",
    },
    {
      label: "Active Locations",
      value: clinics.active_clinics || 0,
      description: "Clinic locations currently active in the system.",
    },
    {
      label: "Appointments",
      value: appointments.total_appointments || 0,
      description: "All appointment records across clinic locations.",
    },
    {
      label: "Dental Records",
      value: dentalRecords.total_records || 0,
      description: "All dental records created in the system.",
    },
    {
      label: "X-rays",
      value: xrays.total_xrays || 0,
      description: "All uploaded dental X-ray images.",
    },
    {
      label: "Active Plans",
      value: subscriptions.active_plans || 0,
      description: "Shared subscription plans currently available.",
    },
  ];

  const roleCards = [
    {
      label: "Patients",
      value: getRoleCount("Patient"),
      description: "Registered patient accounts.",
    },
    {
      label: "Dentists",
      value: getRoleCount("Dentist"),
      description: "Registered dentist accounts.",
    },
    {
      label: "Assistants",
      value: getRoleCount("Assistant") + getRoleCount("Dental Assistant"),
      description: "Registered assistant accounts.",
    },
    {
      label: "Clinic Owners",
      value: getRoleCount("Clinic Owner"),
      description: "Clinic owner accounts.",
    },
  ];

  const appointmentCards = [
    {
      label: "Pending",
      value: appointments.pending_appointments || 0,
      description: "Appointments waiting for approval or action.",
    },
    {
      label: "Scheduled",
      value: appointments.scheduled_appointments || 0,
      description: "Confirmed upcoming appointments.",
    },
    {
      label: "Completed",
      value: appointments.completed_appointments || 0,
      description: "Appointments marked as completed.",
    },
    {
      label: "Reschedule Requests",
      value: appointments.reschedule_requests || 0,
      description: "Appointments with requested schedule changes.",
    },
  ];

  const systemCards = [
    {
      label: "Active Records",
      value: dentalRecords.active_records || 0,
      description: "Dental records currently active.",
    },
    {
      label: "Archived Records",
      value: dentalRecords.archived_records || 0,
      description: "Dental records archived in the system.",
    },
    {
      label: "Shared Plans",
      value: subscriptions.total_plans || 0,
      description: "Plans configured for clinic owner subscriptions.",
    },
    {
      label: "Active Shared Plans",
      value: subscriptions.active_plans || 0,
      description: "Subscription plans currently active.",
    },
  ];

  const quickActions = [
    {
      title: "User Management",
      description: "Create, update, activate, deactivate, and assign roles.",
      buttonLabel: "Manage Users",
      className: "primary-button",
      path: "/admin/users",
    },
    {
      title: "Clinic Management",
      description: "Manage clinic locations, owners, maps, and shared plans.",
      buttonLabel: "Manage Clinics",
      className: "secondary-button",
      path: "/admin/clinics",
    },
    {
      title: "Reports",
      description: "Open module-specific reports and printable summaries.",
      buttonLabel: "View Reports",
      className: "secondary-button",
      path: "/admin/reports",
    },
    {
      title: "Payments",
      description: "Review shared subscription payments and transactions.",
      buttonLabel: "View Payments",
      className: "secondary-button",
      path: "/admin/payments",
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

  const renderCardGrid = (cards) => {
    return (
      <div className="patient-dashboard-summary-grid">
        {cards.map((card) => (
          <div className="patient-dashboard-card" key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <p>{card.description}</p>
          </div>
        ))}
      </div>
    );
  };

  return (
    <DashboardLayout role="Admin">
      <div className="appointments-list-card admin-dashboard-page">
        <div className="appointments-header">
          <div>
            <h2>Admin Dashboard</h2>
            <p>
              Welcome back, {user?.name || "Admin"}. Monitor users, clinic owner
              accounts, clinic locations, shared subscriptions, records, X-rays,
              and recent activity.
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
            <p>Dashboard data will appear once the system has records.</p>
          </div>
        ) : (
          <>
            <div className="info-message">
              <strong>SaaS Overview:</strong> This dashboard summarizes the main
              DentoGraph modules using the new structure: clinic owner accounts,
              multiple clinic locations, and shared subscriptions.
            </div>

            {renderCardGrid(summaryCards)}

            <div className="patient-dashboard-section">
              <div className="appointments-header">
                <div>
                  <h2>User Roles</h2>
                  <p>Breakdown of registered accounts by user type.</p>
                </div>

                <button
                  className="secondary-button"
                  onClick={() => navigate("/admin/users")}
                >
                  Manage Users
                </button>
              </div>

              {renderCardGrid(roleCards)}
            </div>

            <div className="patient-dashboard-section">
              <div className="appointments-header">
                <div>
                  <h2>Appointment Status</h2>
                  <p>Current system-wide appointment activity.</p>
                </div>
              </div>

              {renderCardGrid(appointmentCards)}
            </div>

            <div className="patient-dashboard-section">
              <div className="appointments-header">
                <div>
                  <h2>Records and Shared Subscriptions</h2>
                  <p>
                    Overview of dental records and shared subscription plan
                    setup.
                  </p>
                </div>
              </div>

              {renderCardGrid(systemCards)}
            </div>

            <div className="patient-dashboard-section">
              <div className="appointments-header">
                <div>
                  <h2>Quick Actions</h2>
                  <p>Open the admin modules commonly used during demos.</p>
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
                  <h2>Recent Appointments</h2>
                  <p>Latest appointment activity across the system.</p>
                </div>

                <button
                  className="secondary-button"
                  onClick={() => navigate("/admin/reports")}
                >
                  View Reports
                </button>
              </div>

              {recentAppointments.length === 0 ? (
                <div className="empty-state">
                  <h3>No recent appointments</h3>
                  <p>Recent appointment activity will appear here.</p>
                </div>
              ) : (
                <div className="payment-table-wrapper admin-dashboard-appointments-wrapper">
                  <table className="payment-table admin-dashboard-appointments-table">
                    <thead>
                      <tr>
                        <th>Appointment</th>
                        <th>Patient</th>
                        <th>Dentist</th>
                        <th>Clinic Location</th>
                        <th>Status</th>
                        <th>Date</th>
                      </tr>
                    </thead>

                    <tbody>
                      {recentAppointments.map((appointment) => (
                        <tr key={appointment.appointment_id}>
                          <td>
                            <strong>
                              {appointment.appointment_type ||
                                "Dental Consultation"}
                            </strong>
                            <br />
                            <span className="muted-text">
                              #{appointment.appointment_id}
                            </span>
                          </td>

                          <td>{appointment.patient_name || "N/A"}</td>

                          <td>{appointment.dentist_name || "N/A"}</td>

                          <td>
                            {appointment.clinic_name || "No assigned location"}
                          </td>

                          <td>
                            <span
                              className={`status-badge ${getStatusClass(
                                appointment.status,
                              )}`}
                            >
                              {appointment.status || "Scheduled"}
                            </span>
                          </td>

                          <td>{formatDate(appointment.appointment_date)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
