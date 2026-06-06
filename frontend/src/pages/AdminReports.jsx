import React, { useEffect, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";

function AdminReports() {
  const [reportData, setReportData] = useState(null);
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

      const response = await API.get("/api/reports/admin-summary", authHeaders);
      setReportData(response.data);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load reports.");
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (value) => {
    return Number(value || 0).toLocaleString();
  };

  const formatStorage = (mb) => {
    const storage = Number(mb || 0);

    if (storage >= 1024) {
      return `${(storage / 1024).toFixed(2)} GB`;
    }

    return `${storage.toFixed(2)} MB`;
  };

  const getUsagePercent = (used, max) => {
    const usedNumber = Number(used || 0);
    const maxNumber = Number(max || 0);

    if (maxNumber <= 0) return 0;

    return Math.min((usedNumber / maxNumber) * 100, 100);
  };

  const formatUsage = (used, max, unit = "") => {
    const usedValue = used ?? 0;

    if (max === null || max === undefined) {
      return `${usedValue}${unit} / No limit`;
    }

    return `${usedValue}${unit} / ${max}${unit}`;
  };

  const getStatusClass = (status) => {
    switch (status) {
      case "Completed":
      case "Active":
      case "Confirmed":
        return "status-badge status-completed";
      case "Cancelled":
      case "Inactive":
      case "Rejected":
        return "status-badge status-cancelled";
      case "Pending":
      case "Suggested":
      case "Scheduled":
      default:
        return "status-badge status-scheduled";
    }
  };

  const summaries = reportData?.summaries || {};
  const appointments = summaries.appointments || {};
  const records = summaries.records || {};
  const xrays = summaries.xrays || {};
  const annotations = summaries.annotations || {};
  const clinics = summaries.clinics || {};
  const users = summaries.users || {};

  const charts = reportData?.charts || {};
  const clinicsByPlan = charts.clinics_by_plan || [];
  const recordsByClinic = charts.records_by_clinic || [];
  const xraysByClinic = charts.xrays_by_clinic || [];
  const subscriptionUsage = reportData?.subscription_usage || [];
  const recentAppointments = reportData?.recent_appointments || [];

  return (
    <DashboardLayout role="Admin">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>Reports & Analytics</h2>
            <p>
              View live system summaries for users, clinics, appointments,
              dental records, X-rays, AI annotations, and subscription usage.
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
        ) : !reportData ? (
          <div className="empty-state">
            <h3>No report data found</h3>
            <p>Report data could not be loaded from the server.</p>
          </div>
        ) : (
          <>
            <div className="report-section">
              <div className="appointments-header">
                <div>
                  <h2>System Overview</h2>
                  <p>Main totals from the current database records.</p>
                </div>
              </div>

              <div className="dashboard-grid">
                <div className="dashboard-card">
                  <h3>Total Users</h3>
                  <strong>{formatNumber(users.total_users)}</strong>
                </div>

                <div className="dashboard-card">
                  <h3>Total Clinics</h3>
                  <strong>{formatNumber(clinics.total_clinics)}</strong>
                </div>

                <div className="dashboard-card">
                  <h3>Dental Records</h3>
                  <strong>{formatNumber(records.total_records)}</strong>
                </div>

                <div className="dashboard-card">
                  <h3>Total X-rays</h3>
                  <strong>{formatNumber(xrays.total_xrays)}</strong>
                </div>
              </div>

              <div className="dashboard-grid" style={{ marginTop: "18px" }}>
                <div className="dashboard-card">
                  <h3>Total Appointments</h3>
                  <strong>
                    {formatNumber(appointments.total_appointments)}
                  </strong>
                </div>

                <div className="dashboard-card">
                  <h3>AI Annotations</h3>
                  <strong>{formatNumber(annotations.ai_generated)}</strong>
                </div>

                <div className="dashboard-card">
                  <h3>Pending AI Review</h3>
                  <strong>{formatNumber(annotations.suggested)}</strong>
                </div>

                <div className="dashboard-card">
                  <h3>X-ray Storage Used</h3>
                  <strong>{formatStorage(xrays.total_storage_mb)}</strong>
                </div>
              </div>
            </div>

            <div className="report-section">
              <div className="appointments-header">
                <div>
                  <h2>User Summary</h2>
                  <p>Breakdown of registered users by status and role.</p>
                </div>
              </div>

              <div className="dashboard-grid">
                <div className="dashboard-card">
                  <h3>Active Users</h3>
                  <strong>{formatNumber(users.active_users)}</strong>
                </div>

                <div className="dashboard-card">
                  <h3>Inactive Users</h3>
                  <strong>{formatNumber(users.inactive_users)}</strong>
                </div>

                <div className="dashboard-card">
                  <h3>Patients</h3>
                  <strong>{formatNumber(users.patients)}</strong>
                </div>

                <div className="dashboard-card">
                  <h3>Dentists</h3>
                  <strong>{formatNumber(users.dentists)}</strong>
                </div>
              </div>

              <div className="dashboard-grid" style={{ marginTop: "18px" }}>
                <div className="dashboard-card">
                  <h3>Assistants</h3>
                  <strong>{formatNumber(users.assistants)}</strong>
                </div>

                <div className="dashboard-card">
                  <h3>Admins</h3>
                  <strong>{formatNumber(users.admins)}</strong>
                </div>

                <div className="dashboard-card">
                  <h3>Clinical Staff</h3>
                  <strong>
                    {formatNumber(
                      Number(users.dentists || 0) +
                        Number(users.assistants || 0),
                    )}
                  </strong>
                </div>

                <div className="dashboard-card">
                  <h3>Subscribed Clinics</h3>
                  <strong>{formatNumber(clinics.subscribed_clinics)}</strong>
                </div>
              </div>
            </div>

            <div className="report-section">
              <div className="appointments-header">
                <div>
                  <h2>Appointment Summary</h2>
                  <p>Overview of appointment statuses in the system.</p>
                </div>
              </div>

              <div className="dashboard-grid">
                <div className="dashboard-card">
                  <h3>Pending</h3>
                  <strong>{formatNumber(appointments.pending)}</strong>
                </div>

                <div className="dashboard-card">
                  <h3>Scheduled</h3>
                  <strong>{formatNumber(appointments.scheduled)}</strong>
                </div>

                <div className="dashboard-card">
                  <h3>Completed</h3>
                  <strong>{formatNumber(appointments.completed)}</strong>
                </div>

                <div className="dashboard-card">
                  <h3>Cancelled</h3>
                  <strong>{formatNumber(appointments.cancelled)}</strong>
                </div>
              </div>
            </div>

            <div className="report-section">
              <div className="appointments-header">
                <div>
                  <h2>Dental Records, X-rays, and AI Summary</h2>
                  <p>
                    Shows active records, archived records, uploaded X-rays, and
                    AI annotation review status.
                  </p>
                </div>
              </div>

              <div className="dashboard-grid">
                <div className="dashboard-card">
                  <h3>Active Records</h3>
                  <strong>{formatNumber(records.active_records)}</strong>
                </div>

                <div className="dashboard-card">
                  <h3>Archived Records</h3>
                  <strong>{formatNumber(records.archived_records)}</strong>
                </div>

                <div className="dashboard-card">
                  <h3>Total Annotations</h3>
                  <strong>{formatNumber(annotations.total_annotations)}</strong>
                </div>

                <div className="dashboard-card">
                  <h3>Confirmed Findings</h3>
                  <strong>{formatNumber(annotations.confirmed)}</strong>
                </div>
              </div>

              <div className="dashboard-grid" style={{ marginTop: "18px" }}>
                <div className="dashboard-card">
                  <h3>Suggested</h3>
                  <strong>{formatNumber(annotations.suggested)}</strong>
                </div>

                <div className="dashboard-card">
                  <h3>Rejected</h3>
                  <strong>{formatNumber(annotations.rejected)}</strong>
                </div>

                <div className="dashboard-card">
                  <h3>Manual Annotations</h3>
                  <strong>
                    {formatNumber(annotations.manual_annotations)}
                  </strong>
                </div>

                <div className="dashboard-card">
                  <h3>AI Generated</h3>
                  <strong>{formatNumber(annotations.ai_generated)}</strong>
                </div>
              </div>
            </div>

            <div className="report-two-column">
              <div className="report-panel">
                <div className="appointments-header">
                  <div>
                    <h2>Clinics by Subscription Plan</h2>
                    <p>Number of clinics assigned to each plan.</p>
                  </div>
                </div>

                {clinicsByPlan.length === 0 ? (
                  <div className="empty-state">
                    <h3>No subscription data</h3>
                    <p>Clinic plan assignments will appear here.</p>
                  </div>
                ) : (
                  <div className="appointments-list">
                    {clinicsByPlan.map((item) => (
                      <div className="appointment-item" key={item.plan_name}>
                        <div className="appointment-info">
                          <div className="appointment-title-row">
                            <h3>{item.plan_name}</h3>
                            <span className="status-badge status-scheduled">
                              {item.clinic_count} clinic
                              {Number(item.clinic_count) === 1 ? "" : "s"}
                            </span>
                          </div>

                          <div className="usage-bar">
                            <div
                              className="usage-bar-fill"
                              style={{
                                width: `${Math.min(
                                  Number(item.clinic_count || 0) * 20,
                                  100,
                                )}%`,
                              }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="report-panel">
                <div className="appointments-header">
                  <div>
                    <h2>Records by Clinic</h2>
                    <p>Active dental records grouped by clinic.</p>
                  </div>
                </div>

                {recordsByClinic.length === 0 ? (
                  <div className="empty-state">
                    <h3>No clinic records</h3>
                    <p>Dental record activity will appear here.</p>
                  </div>
                ) : (
                  <div className="appointments-list">
                    {recordsByClinic.slice(0, 8).map((item) => (
                      <div className="appointment-item" key={item.clinic_id}>
                        <div className="appointment-info">
                          <div className="appointment-title-row">
                            <h3>{item.clinic_name}</h3>
                            <span className="status-badge status-scheduled">
                              {item.record_count} record
                              {Number(item.record_count) === 1 ? "" : "s"}
                            </span>
                          </div>

                          <div className="usage-bar">
                            <div
                              className="usage-bar-fill"
                              style={{
                                width: `${Math.min(
                                  Number(item.record_count || 0) * 10,
                                  100,
                                )}%`,
                              }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="report-section">
              <div className="appointments-header">
                <div>
                  <h2>X-ray Usage by Clinic</h2>
                  <p>Uploaded X-rays and storage usage grouped by clinic.</p>
                </div>
              </div>

              {xraysByClinic.length === 0 ? (
                <div className="empty-state">
                  <h3>No X-ray usage found</h3>
                  <p>
                    X-ray uploads will appear here once records are created.
                  </p>
                </div>
              ) : (
                <div className="appointments-list">
                  {xraysByClinic.map((item) => (
                    <div className="appointment-item" key={item.clinic_id}>
                      <div className="appointment-info">
                        <div className="appointment-title-row">
                          <h3>{item.clinic_name}</h3>
                          <span className="status-badge status-scheduled">
                            {item.xray_count} X-ray
                            {Number(item.xray_count) === 1 ? "" : "s"}
                          </span>
                        </div>

                        <p>
                          <strong>Storage Used:</strong>{" "}
                          {formatStorage(item.storage_mb)}
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
                  <h2>Subscription Usage Overview</h2>
                  <p>
                    Tracks actual clinic usage against assigned subscription
                    plan limits.
                  </p>
                </div>
              </div>

              {subscriptionUsage.length === 0 ? (
                <div className="empty-state">
                  <h3>No usage data found</h3>
                  <p>Subscription usage data will appear here.</p>
                </div>
              ) : (
                <div className="appointments-list">
                  {subscriptionUsage.map((clinic) => (
                    <div className="appointment-item" key={clinic.clinic_id}>
                      <div className="appointment-info">
                        <div className="appointment-title-row">
                          <h3>{clinic.clinic_name}</h3>
                          <span className="status-badge status-scheduled">
                            {clinic.plan_name}
                          </span>
                        </div>

                        <div className="usage-grid">
                          <div className="usage-card">
                            <div className="usage-card-header">
                              <h4>Dentists</h4>
                              <span>
                                {formatUsage(
                                  clinic.dentists_used,
                                  clinic.max_dentists,
                                )}
                              </span>
                            </div>
                            <div className="usage-bar">
                              <div
                                className="usage-bar-fill"
                                style={{
                                  width: `${getUsagePercent(
                                    clinic.dentists_used,
                                    clinic.max_dentists,
                                  )}%`,
                                }}
                              ></div>
                            </div>
                          </div>

                          <div className="usage-card">
                            <div className="usage-card-header">
                              <h4>Assistants</h4>
                              <span>
                                {formatUsage(
                                  clinic.assistants_used,
                                  clinic.max_assistants,
                                )}
                              </span>
                            </div>
                            <div className="usage-bar">
                              <div
                                className="usage-bar-fill"
                                style={{
                                  width: `${getUsagePercent(
                                    clinic.assistants_used,
                                    clinic.max_assistants,
                                  )}%`,
                                }}
                              ></div>
                            </div>
                          </div>

                          <div className="usage-card">
                            <div className="usage-card-header">
                              <h4>Patients</h4>
                              <span>
                                {formatUsage(
                                  clinic.patients_used,
                                  clinic.max_patients,
                                )}
                              </span>
                            </div>
                            <div className="usage-bar">
                              <div
                                className="usage-bar-fill"
                                style={{
                                  width: `${getUsagePercent(
                                    clinic.patients_used,
                                    clinic.max_patients,
                                  )}%`,
                                }}
                              ></div>
                            </div>
                          </div>

                          <div className="usage-card">
                            <div className="usage-card-header">
                              <h4>Records</h4>
                              <span>
                                {formatUsage(
                                  clinic.records_used,
                                  clinic.max_records,
                                )}
                              </span>
                            </div>
                            <div className="usage-bar">
                              <div
                                className="usage-bar-fill"
                                style={{
                                  width: `${getUsagePercent(
                                    clinic.records_used,
                                    clinic.max_records,
                                  )}%`,
                                }}
                              ></div>
                            </div>
                          </div>

                          <div className="usage-card">
                            <div className="usage-card-header">
                              <h4>X-rays</h4>
                              <span>
                                {formatUsage(
                                  clinic.xrays_used,
                                  clinic.max_xrays,
                                )}
                              </span>
                            </div>
                            <div className="usage-bar">
                              <div
                                className="usage-bar-fill"
                                style={{
                                  width: `${getUsagePercent(
                                    clinic.xrays_used,
                                    clinic.max_xrays,
                                  )}%`,
                                }}
                              ></div>
                            </div>
                          </div>

                          <div className="usage-card">
                            <div className="usage-card-header">
                              <h4>Storage</h4>
                              <span>
                                {formatUsage(
                                  clinic.storage_used_mb,
                                  clinic.storage_limit_mb,
                                  " MB",
                                )}
                              </span>
                            </div>
                            <div className="usage-bar">
                              <div
                                className="usage-bar-fill"
                                style={{
                                  width: `${getUsagePercent(
                                    clinic.storage_used_mb,
                                    clinic.storage_limit_mb,
                                  )}%`,
                                }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="report-section">
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
                          <h3>Appointment #{appointment.appointment_id}</h3>

                          <span className={getStatusClass(appointment.status)}>
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
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

export default AdminReports;
