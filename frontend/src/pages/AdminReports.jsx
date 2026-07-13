import React, { useEffect, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";

function AdminReports() {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [subscriptionSearch, setSubscriptionSearch] = useState("");
  const [subscriptionPlanFilter, setSubscriptionPlanFilter] = useState("All");
  const [visibleSubscriptionCount, setVisibleSubscriptionCount] = useState(10);

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

  const formatDate = (dateValue) => {
    if (!dateValue) return "N/A";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) return "N/A";

    return date.toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
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
      case "Paid":
        return "status-badge status-completed";
      case "Cancelled":
      case "Inactive":
      case "Rejected":
      case "Failed":
        return "status-badge status-cancelled";
      case "Pending":
      case "Suggested":
      case "Scheduled":
      default:
        return "status-badge status-scheduled";
    }
  };

  const getUsageStatus = (clinic) => {
    const usageValues = [
      getUsagePercent(clinic.dentists_used, clinic.max_dentists),
      getUsagePercent(clinic.assistants_used, clinic.max_assistants),
      getUsagePercent(clinic.patients_used, clinic.max_patients),
      getUsagePercent(clinic.records_used, clinic.max_records),
      getUsagePercent(clinic.xrays_used, clinic.max_xrays),
      getUsagePercent(clinic.storage_used_mb, clinic.storage_limit_mb),
    ];

    const highestUsage = Math.max(...usageValues);

    if (highestUsage >= 100) {
      return {
        label: "Limit Reached",
        className: "status-badge status-cancelled",
      };
    }

    if (highestUsage >= 80) {
      return {
        label: "Near Limit",
        className: "status-badge status-pending",
      };
    }

    return {
      label: "Normal",
      className: "status-badge status-completed",
    };
  };

  const summaries = reportData?.summaries || {};
  const appointments = summaries.appointments || {};
  const records = summaries.records || {};
  const xrays = summaries.xrays || {};
  const annotations = summaries.annotations || {};
  const clinics = summaries.clinics || {};
  const users = summaries.users || {};
  const payments = summaries.payments || {};

  const charts = reportData?.charts || {};
  const clinicsByPlan = charts.clinics_by_plan || [];
  const recordsByClinic = charts.records_by_clinic || [];
  const xraysByClinic = charts.xrays_by_clinic || [];
  const subscriptionUsage = reportData?.subscription_usage || [];
  const recentAppointments = reportData?.recent_appointments || [];

  const subscriptionPlanOptions = [
    "All",
    ...new Set(
      subscriptionUsage.map((clinic) => clinic.plan_name).filter(Boolean),
    ),
  ];

  const filteredSubscriptionUsage = subscriptionUsage.filter((clinic) => {
    const searchValue = subscriptionSearch.trim().toLowerCase();

    const matchesSearch =
      !searchValue ||
      String(clinic.clinic_name || "")
        .toLowerCase()
        .includes(searchValue) ||
      String(clinic.plan_name || "")
        .toLowerCase()
        .includes(searchValue);

    const matchesPlan =
      subscriptionPlanFilter === "All" ||
      clinic.plan_name === subscriptionPlanFilter;

    return matchesSearch && matchesPlan;
  });

  const visibleSubscriptionUsage = filteredSubscriptionUsage.slice(
    0,
    visibleSubscriptionCount,
  );

  const nearLimitCount = subscriptionUsage.filter((clinic) => {
    const usageStatus = getUsageStatus(clinic);
    return usageStatus.label === "Near Limit";
  }).length;

  const limitReachedCount = subscriptionUsage.filter((clinic) => {
    const usageStatus = getUsageStatus(clinic);
    return usageStatus.label === "Limit Reached";
  }).length;

  const overviewCards = [
    {
      label: "Total Users",
      value: formatNumber(users.total_users),
      description: "All registered accounts",
    },
    {
      label: "Total Clinics",
      value: formatNumber(clinics.total_clinics),
      description: "Clinic/client profiles",
    },
    {
      label: "Appointments",
      value: formatNumber(appointments.total_appointments),
      description: "All appointment records",
    },
    {
      label: "Dental Records",
      value: formatNumber(records.total_records),
      description: "Patient dental records",
    },
    {
      label: "X-rays",
      value: formatNumber(xrays.total_xrays),
      description: "Uploaded X-ray files",
    },
  ];

  const userReportCards = [
    {
      label: "Active Users",
      value: formatNumber(users.active_users),
      description: "Accounts with system access",
    },
    {
      label: "Inactive Users",
      value: formatNumber(users.inactive_users),
      description: "Disabled accounts",
    },
    {
      label: "Patients",
      value: formatNumber(users.patients),
      description: "Patient user accounts",
    },
    {
      label: "Dentists",
      value: formatNumber(users.dentists),
      description: "Dentist accounts",
    },
    {
      label: "Assistants",
      value: formatNumber(users.assistants),
      description: "Dental assistant accounts",
    },
    {
      label: "Admins",
      value: formatNumber(users.admins),
      description: "System admin accounts",
    },
  ];

  const clinicReportCards = [
    {
      label: "Total Clinics",
      value: formatNumber(clinics.total_clinics),
      description: "Registered clinic profiles",
    },
    {
      label: "Active Clinics",
      value: formatNumber(clinics.active_clinics),
      description: "Clinics currently active",
    },
    {
      label: "Inactive Clinics",
      value: formatNumber(clinics.inactive_clinics),
      description: "Clinics marked inactive",
    },
    {
      label: "Subscribed Clinics",
      value: formatNumber(clinics.subscribed_clinics),
      description: "Clinics with assigned plans",
    },
  ];

  const appointmentReportCards = [
    {
      label: "Pending",
      value: formatNumber(appointments.pending),
      description: "Waiting for review",
    },
    {
      label: "Scheduled",
      value: formatNumber(appointments.scheduled),
      description: "Confirmed schedules",
    },
    {
      label: "Completed",
      value: formatNumber(appointments.completed),
      description: "Finished appointments",
    },
    {
      label: "Cancelled",
      value: formatNumber(appointments.cancelled),
      description: "Cancelled appointments",
    },
  ];

  const dentalRecordCards = [
    {
      label: "Total Records",
      value: formatNumber(records.total_records),
      description: "All dental records",
    },
    {
      label: "Active Records",
      value: formatNumber(records.active_records),
      description: "Currently active records",
    },
    {
      label: "Archived Records",
      value: formatNumber(records.archived_records),
      description: "Archived patient records",
    },
  ];

  const xrayAiCards = [
    {
      label: "Total X-rays",
      value: formatNumber(xrays.total_xrays),
      description: "Uploaded X-ray files",
    },
    {
      label: "Storage Used",
      value: formatStorage(xrays.total_storage_mb),
      description: "X-ray file storage",
    },
    {
      label: "Total Annotations",
      value: formatNumber(annotations.total_annotations),
      description: "All X-ray annotations",
    },
    {
      label: "AI Generated",
      value: formatNumber(annotations.ai_generated),
      description: "AI-assisted findings",
    },
    {
      label: "Pending Review",
      value: formatNumber(annotations.suggested),
      description: "Needs dentist review",
    },
    {
      label: "Confirmed",
      value: formatNumber(annotations.confirmed),
      description: "Dentist-confirmed findings",
    },
    {
      label: "Rejected",
      value: formatNumber(annotations.rejected),
      description: "Rejected findings",
    },
    {
      label: "Manual",
      value: formatNumber(annotations.manual_annotations),
      description: "Dentist-added annotations",
    },
  ];

  const subscriptionSummaryCards = [
    {
      label: "Total Clinics",
      value: formatNumber(subscriptionUsage.length),
      description: "Clinics with usage data",
    },
    {
      label: "Visible Clinics",
      value: `${Math.min(
        visibleSubscriptionCount,
        filteredSubscriptionUsage.length,
      )} of ${filteredSubscriptionUsage.length}`,
      description: "Shown after filters",
    },
    {
      label: "Near Limit",
      value: formatNumber(nearLimitCount),
      description: "At least one usage type is 80%+",
    },
    {
      label: "Limit Reached",
      value: formatNumber(limitReachedCount),
      description: "At least one plan limit is full",
    },
  ];

  const paymentReportCards = [
    {
      label: "Total Payments",
      value: formatNumber(payments.total_payments),
      description: "All payment records",
    },
    {
      label: "Paid Payments",
      value: formatNumber(payments.paid_payments),
      description: "Completed payments",
    },
    {
      label: "Pending Payments",
      value: formatNumber(payments.pending_payments),
      description: "Awaiting checkout/webhook",
    },
    {
      label: "Paid Revenue",
      value: `₱${Number(payments.total_paid_amount || 0).toLocaleString(
        "en-PH",
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        },
      )}`,
      description: "Confirmed paid amount",
    },
  ];

  const renderReportCards = (cards) => (
    <div className="module-report-grid">
      {cards.map((card) => (
        <div className="module-report-card" key={card.label}>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
          <p>{card.description}</p>
        </div>
      ))}
    </div>
  );

  return (
    <DashboardLayout role="Admin">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>Reports & Analytics</h2>
            <p>
              View module-specific reports for users, clinics, appointments,
              dental records, X-rays, AI annotations, subscriptions, and
              payments.
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
          <div className="payment-loading-card">
            <p>Loading reports...</p>
          </div>
        ) : !reportData ? (
          <div className="empty-state">
            <h3>No report data found</h3>
            <p>Report data could not be loaded from the server.</p>
          </div>
        ) : (
          <>
            <div className="module-report-section">
              <div className="appointments-header">
                <div>
                  <h2>System Overview</h2>
                  <p>Main totals across all system modules.</p>
                </div>
              </div>

              {renderReportCards(overviewCards)}
            </div>

            <div className="module-report-section">
              <div className="appointments-header">
                <div>
                  <h2>User Reports</h2>
                  <p>
                    Breakdown of system user accounts by role and account
                    status.
                  </p>
                </div>
              </div>

              {renderReportCards(userReportCards)}
            </div>

            <div className="module-report-section">
              <div className="appointments-header">
                <div>
                  <h2>Clinic Reports</h2>
                  <p>
                    Summary of clinic/client profiles and subscription
                    assignments.
                  </p>
                </div>
              </div>

              {renderReportCards(clinicReportCards)}

              <div className="module-report-subsection">
                <h3>Clinics by Subscription Plan</h3>

                {clinicsByPlan.length === 0 ? (
                  <div className="empty-state">
                    <h3>No subscription data</h3>
                    <p>Clinic plan assignments will appear here.</p>
                  </div>
                ) : (
                  <div className="module-report-table-wrapper">
                    <table className="module-report-table">
                      <thead>
                        <tr>
                          <th>Plan</th>
                          <th>Clinic Count</th>
                          <th>Visual Usage</th>
                        </tr>
                      </thead>

                      <tbody>
                        {clinicsByPlan.map((item) => (
                          <tr key={item.plan_name || "No Plan"}>
                            <td>
                              <strong>{item.plan_name || "No Plan"}</strong>
                            </td>
                            <td>
                              {formatNumber(item.clinic_count)} clinic
                              {Number(item.clinic_count) === 1 ? "" : "s"}
                            </td>
                            <td>
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
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="module-report-section">
              <div className="appointments-header">
                <div>
                  <h2>Appointment Reports</h2>
                  <p>Appointment status totals across all clinics.</p>
                </div>
              </div>

              {renderReportCards(appointmentReportCards)}

              <div className="module-report-subsection">
                <h3>Recent Appointments</h3>

                {recentAppointments.length === 0 ? (
                  <div className="empty-state">
                    <h3>No appointments found</h3>
                    <p>Appointment records will appear here.</p>
                  </div>
                ) : (
                  <div className="module-report-table-wrapper">
                    <table className="module-report-table">
                      <thead>
                        <tr>
                          <th>Appointment ID</th>
                          <th>Patient</th>
                          <th>Dentist</th>
                          <th>Clinic</th>
                          <th>Status</th>
                          <th>Date</th>
                        </tr>
                      </thead>

                      <tbody>
                        {recentAppointments.map((appointment) => (
                          <tr key={appointment.appointment_id}>
                            <td>
                              <strong>#{appointment.appointment_id}</strong>
                            </td>
                            <td>{appointment.patient_name || "N/A"}</td>
                            <td>{appointment.dentist_name || "N/A"}</td>
                            <td>
                              {appointment.clinic_name || "No assigned clinic"}
                            </td>
                            <td>
                              <span
                                className={getStatusClass(appointment.status)}
                              >
                                {appointment.status || "Pending"}
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
            </div>

            <div className="module-report-section">
              <div className="appointments-header">
                <div>
                  <h2>Dental Record Reports</h2>
                  <p>Record totals and record activity grouped by clinic.</p>
                </div>
              </div>

              {renderReportCards(dentalRecordCards)}

              <div className="module-report-subsection">
                <h3>Records by Clinic</h3>

                {recordsByClinic.length === 0 ? (
                  <div className="empty-state">
                    <h3>No clinic records</h3>
                    <p>Dental record activity will appear here.</p>
                  </div>
                ) : (
                  <div className="module-report-table-wrapper">
                    <table className="module-report-table">
                      <thead>
                        <tr>
                          <th>Clinic</th>
                          <th>Record Count</th>
                          <th>Visual Usage</th>
                        </tr>
                      </thead>

                      <tbody>
                        {recordsByClinic.map((item) => (
                          <tr key={item.clinic_id}>
                            <td>
                              <strong>{item.clinic_name || "Clinic"}</strong>
                            </td>
                            <td>
                              {formatNumber(item.record_count)} record
                              {Number(item.record_count) === 1 ? "" : "s"}
                            </td>
                            <td>
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
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="module-report-section">
              <div className="appointments-header">
                <div>
                  <h2>X-ray and AI Reports</h2>
                  <p>
                    X-ray upload activity, storage usage, and AI-assisted
                    annotation review status.
                  </p>
                </div>
              </div>

              {renderReportCards(xrayAiCards)}

              <div className="module-report-subsection">
                <h3>X-ray Usage by Clinic</h3>

                {xraysByClinic.length === 0 ? (
                  <div className="empty-state">
                    <h3>No X-ray usage found</h3>
                    <p>
                      X-ray uploads will appear here once records are created.
                    </p>
                  </div>
                ) : (
                  <div className="module-report-table-wrapper">
                    <table className="module-report-table">
                      <thead>
                        <tr>
                          <th>Clinic</th>
                          <th>X-ray Count</th>
                          <th>Storage Used</th>
                        </tr>
                      </thead>

                      <tbody>
                        {xraysByClinic.map((item) => (
                          <tr key={item.clinic_id}>
                            <td>
                              <strong>{item.clinic_name || "Clinic"}</strong>
                            </td>
                            <td>
                              {formatNumber(item.xray_count)} X-ray
                              {Number(item.xray_count) === 1 ? "" : "s"}
                            </td>
                            <td>{formatStorage(item.storage_mb)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="module-report-section">
              <div className="appointments-header">
                <div>
                  <h2>Subscription Usage Reports</h2>
                  <p>
                    Quickly review clinic usage against subscription plan
                    limits. Admins can search, filter by plan, and scan usage in
                    a compact table.
                  </p>
                </div>
              </div>

              {renderReportCards(subscriptionSummaryCards)}

              <div className="module-report-filter-card">
                <div className="appointment-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label>Search Clinic</label>
                      <input
                        type="text"
                        value={subscriptionSearch}
                        onChange={(e) => {
                          setSubscriptionSearch(e.target.value);
                          setVisibleSubscriptionCount(10);
                        }}
                        placeholder="Search by clinic name or plan..."
                      />
                    </div>

                    <div className="form-group">
                      <label>Plan</label>
                      <select
                        value={subscriptionPlanFilter}
                        onChange={(e) => {
                          setSubscriptionPlanFilter(e.target.value);
                          setVisibleSubscriptionCount(10);
                        }}
                      >
                        {subscriptionPlanOptions.map((plan) => (
                          <option key={plan} value={plan}>
                            {plan}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Visible Clinics</label>
                      <input
                        type="text"
                        value={`${Math.min(
                          visibleSubscriptionCount,
                          filteredSubscriptionUsage.length,
                        )} of ${filteredSubscriptionUsage.length}`}
                        disabled
                      />
                    </div>
                  </div>
                </div>
              </div>

              {subscriptionUsage.length === 0 ? (
                <div className="empty-state">
                  <h3>No usage data found</h3>
                  <p>Subscription usage data will appear here.</p>
                </div>
              ) : filteredSubscriptionUsage.length === 0 ? (
                <div className="empty-state">
                  <h3>No matching clinics</h3>
                  <p>No clinic usage records match your current filters.</p>
                </div>
              ) : (
                <>
                  <div className="subscription-clean-table-wrapper">
                    <table className="subscription-clean-table">
                      <thead>
                        <tr>
                          <th>Clinic</th>
                          <th>Plan</th>
                          <th>Dentists</th>
                          <th>Assistants</th>
                          <th>Patients</th>
                          <th>Records</th>
                          <th>X-rays</th>
                          <th>Storage</th>
                          <th>Usage Status</th>
                        </tr>
                      </thead>

                      <tbody>
                        {visibleSubscriptionUsage.map((clinic) => {
                          const usageStatus = getUsageStatus(clinic);

                          return (
                            <tr key={clinic.clinic_id}>
                              <td>
                                <strong>
                                  {clinic.clinic_name || "Clinic"}
                                </strong>
                              </td>

                              <td>{clinic.plan_name || "No Plan"}</td>

                              <td>
                                <div className="subscription-usage-cell">
                                  <span>
                                    {formatUsage(
                                      clinic.dentists_used,
                                      clinic.max_dentists,
                                    )}
                                  </span>
                                  <div className="usage-bar compact-usage-bar">
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
                              </td>

                              <td>
                                <div className="subscription-usage-cell">
                                  <span>
                                    {formatUsage(
                                      clinic.assistants_used,
                                      clinic.max_assistants,
                                    )}
                                  </span>
                                  <div className="usage-bar compact-usage-bar">
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
                              </td>

                              <td>
                                <div className="subscription-usage-cell">
                                  <span>
                                    {formatUsage(
                                      clinic.patients_used,
                                      clinic.max_patients,
                                    )}
                                  </span>
                                  <div className="usage-bar compact-usage-bar">
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
                              </td>

                              <td>
                                <div className="subscription-usage-cell">
                                  <span>
                                    {formatUsage(
                                      clinic.records_used,
                                      clinic.max_records,
                                    )}
                                  </span>
                                  <div className="usage-bar compact-usage-bar">
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
                              </td>

                              <td>
                                <div className="subscription-usage-cell">
                                  <span>
                                    {formatUsage(
                                      clinic.xrays_used,
                                      clinic.max_xrays,
                                    )}
                                  </span>
                                  <div className="usage-bar compact-usage-bar">
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
                              </td>

                              <td>
                                <div className="subscription-usage-cell">
                                  <span>
                                    {formatUsage(
                                      clinic.storage_used_mb,
                                      clinic.storage_limit_mb,
                                      " MB",
                                    )}
                                  </span>
                                  <div className="usage-bar compact-usage-bar">
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
                              </td>

                              <td>
                                <span className={usageStatus.className}>
                                  {usageStatus.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {visibleSubscriptionCount <
                    filteredSubscriptionUsage.length && (
                    <div className="module-report-load-more">
                      <button
                        className="secondary-button"
                        onClick={() =>
                          setVisibleSubscriptionCount(
                            (currentCount) => currentCount + 10,
                          )
                        }
                      >
                        Show More Clinics
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="module-report-section">
              <div className="appointments-header">
                <div>
                  <h2>Payment Reports</h2>
                  <p>
                    Payment summary values will appear when the backend includes
                    payment totals in the admin summary response.
                  </p>
                </div>
              </div>

              {renderReportCards(paymentReportCards)}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

export default AdminReports;
