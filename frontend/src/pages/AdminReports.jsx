import React, { useEffect, useMemo, useRef, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";

const REPORT_MODULES = [
  {
    id: "overview",
    label: "System Overview",
    description: "System-wide totals across all core modules.",
  },
  {
    id: "users",
    label: "Users",
    description: "Account totals by role and account status.",
  },
  {
    id: "clinics",
    label: "Clinics",
    description: "Clinic locations, ownership, and plan distribution.",
  },
  {
    id: "appointments",
    label: "Appointments",
    description: "Appointment status totals and recent schedules.",
  },
  {
    id: "records",
    label: "Dental Records",
    description: "Active and archived records by clinic.",
  },
  {
    id: "xrays",
    label: "X-rays & AI",
    description: "X-ray storage and annotation review activity.",
  },
  {
    id: "subscriptions",
    label: "Subscriptions",
    description: "Plan utilization and clinic capacity monitoring.",
  },
  {
    id: "payments",
    label: "Payments",
    description: "Payment status and confirmed revenue totals.",
  },
];

function AdminReports() {
  const [reportData, setReportData] = useState(null);
  const [activeModule, setActiveModule] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [subscriptionSearch, setSubscriptionSearch] = useState("");
  const [subscriptionPlanFilter, setSubscriptionPlanFilter] = useState("All");
  const [visibleSubscriptionCount, setVisibleSubscriptionCount] = useState(10);

  const printAreaRef = useRef(null);

  const token = localStorage.getItem("token");

  const authHeaders = useMemo(
    () => ({
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }),
    [token],
  );

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
      setError(err.response?.data?.error || "Unable to load admin reports.");
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (value) => Number(value || 0).toLocaleString("en-PH");

  const formatCurrency = (value) =>
    Number(value || 0).toLocaleString("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

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

    if (Number.isNaN(date.getTime())) {
      return "N/A";
    }

    return date.toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusClass = (status) => {
    const normalized = String(status || "").toLowerCase();

    if (
      ["completed", "active", "confirmed", "paid", "normal"].includes(
        normalized,
      )
    ) {
      return "status-badge status-completed";
    }

    if (
      ["cancelled", "inactive", "rejected", "failed", "limit reached"].includes(
        normalized,
      )
    ) {
      return "status-badge status-cancelled";
    }

    return "status-badge status-pending";
  };

  const getUsagePercent = (used, max) => {
    const usedNumber = Number(used || 0);
    const maxNumber = Number(max || 0);

    if (!Number.isFinite(maxNumber) || maxNumber <= 0) {
      return 0;
    }

    return Math.min((usedNumber / maxNumber) * 100, 100);
  };

  const formatUsage = (used, max, unit = "") => {
    const usedValue = used ?? 0;

    if (max === null || max === undefined) {
      return `${usedValue}${unit} / No limit`;
    }

    return `${usedValue}${unit} / ${max}${unit}`;
  };

  const getUsageStatus = (clinic) => {
    const percentages = [
      getUsagePercent(clinic.owner_location_count, clinic.max_clinics),
      getUsagePercent(clinic.dentists_used, clinic.max_dentists),
      getUsagePercent(clinic.assistants_used, clinic.max_assistants),
      getUsagePercent(clinic.patients_used, clinic.max_patients),
      getUsagePercent(clinic.records_used, clinic.max_records),
      getUsagePercent(clinic.xrays_used, clinic.max_xrays),
      getUsagePercent(clinic.storage_used_mb, clinic.storage_limit_mb),
    ];

    const highest = Math.max(...percentages);

    if (highest >= 100) {
      return {
        label: "Limit Reached",
        className: "status-badge status-cancelled",
      };
    }

    if (highest >= 80) {
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

  const printActiveModule = () => {
    const printContent = printAreaRef.current;

    if (!printContent) {
      setError("The selected report is not ready to print.");
      return;
    }

    const printWindow = window.open("", "_blank", "width=1200,height=800");

    if (!printWindow) {
      setError(
        "The print window was blocked. Please allow pop-ups for this site and try again.",
      );
      return;
    }

    const reportTitle = `${activeModuleDetails.label} Report`;
    const generatedAt = formatDate(new Date().toISOString());

    printWindow.document.open();
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />
          <title>${reportTitle}</title>

          <style>
            @page {
              size: A4 landscape;
              margin: 12mm;
            }

            * {
              box-sizing: border-box;
            }

            html,
            body {
              margin: 0;
              padding: 0;
              color: #111827;
              background: #ffffff;
              font-family:
                Arial,
                Helvetica,
                sans-serif;
              font-size: 12px;
            }

            body {
              padding: 8px;
            }

            .print-report-shell {
              width: 100%;
            }

            .print-report-brand {
              display: flex;
              align-items: flex-start;
              justify-content: space-between;
              gap: 20px;
              margin-bottom: 16px;
              padding-bottom: 12px;
              border-bottom: 2px solid #111827;
            }

            .print-report-brand h1 {
              margin: 0 0 5px;
              font-size: 22px;
            }

            .print-report-brand p {
              margin: 0;
              color: #4b5563;
              line-height: 1.45;
            }

            .print-report-meta {
              color: #4b5563;
              font-size: 11px;
              text-align: right;
              white-space: nowrap;
            }

            .admin-report-print-header {
              display: none !important;
            }

            .module-report-section,
            .module-report-subsection {
              margin: 0;
              padding: 0;
              border: 0;
              background: transparent;
            }

            .module-report-subsection {
              margin-top: 22px;
            }

            .module-report-subsection h3 {
              margin: 0 0 10px;
              font-size: 16px;
            }

            .module-report-grid {
              display: grid;
              grid-template-columns: repeat(4, minmax(0, 1fr));
              gap: 9px;
            }

            .module-report-card {
              min-width: 0;
              padding: 12px;
              border: 1px solid #111827;
              border-radius: 8px;
              break-inside: avoid;
              background: #ffffff;
            }

            .module-report-card span {
              display: block;
              margin-bottom: 5px;
              color: #4b5563;
              font-size: 10px;
              font-weight: 700;
            }

            .module-report-card strong {
              display: block;
              margin-bottom: 4px;
              font-size: 19px;
            }

            .module-report-card p {
              margin: 0;
              color: #4b5563;
              font-size: 10px;
              line-height: 1.35;
            }

            .admin-report-table-wrap {
              width: 100%;
              overflow: visible;
              border: 1px solid #111827;
              border-radius: 0;
            }

            .admin-report-table {
              width: 100%;
              min-width: 0;
              border-collapse: collapse;
              table-layout: auto;
            }

            .admin-report-table thead {
              display: table-header-group;
            }

            .admin-report-table tr {
              break-inside: avoid;
            }

            .admin-report-table th,
            .admin-report-table td {
              padding: 6px 7px;
              border: 1px solid #111827;
              text-align: left;
              vertical-align: top;
              font-size: 9px;
            }

            .admin-report-table th {
              background: #f3f4f6;
              font-weight: 800;
              text-transform: uppercase;
            }

            .admin-report-table td small {
              display: block;
              margin-top: 3px;
              color: #4b5563;
              font-size: 8px;
            }

            .status-badge {
              display: inline-block;
              padding: 2px 6px;
              border: 1px solid #111827;
              border-radius: 999px;
              color: #111827;
              background: #ffffff;
              font-size: 8px;
              font-weight: 700;
            }

            .info-message,
            .empty-state {
              margin-top: 14px;
              padding: 12px;
              border: 1px solid #111827;
              border-radius: 8px;
              color: #111827;
              background: #ffffff;
            }

            .empty-state h3 {
              margin: 0 0 5px;
            }

            .empty-state p,
            .info-message p {
              margin: 0;
            }

            .no-print,
            .admin-report-filter-grid,
            .admin-report-load-more,
            button {
              display: none !important;
            }

            @media print {
              body {
                padding: 0;
              }
            }
          </style>
        </head>

        <body>
          <div class="print-report-shell">
            <header class="print-report-brand">
              <div>
                <h1>${reportTitle}</h1>
                <p>${activeModuleDetails.description}</p>
              </div>

              <div class="print-report-meta">
                <div>DentoGraph Administrator Report</div>
                <div>Generated: ${generatedAt}</div>
              </div>
            </header>

            ${printContent.innerHTML}
          </div>

          <script>
            window.addEventListener("load", function () {
              window.setTimeout(function () {
                window.print();
              }, 250);
            });

            window.addEventListener("afterprint", function () {
              window.close();
            });
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
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

  const subscriptionPlanOptions = useMemo(
    () => [
      "All",
      ...new Set(
        subscriptionUsage.map((clinic) => clinic.plan_name).filter(Boolean),
      ),
    ],
    [subscriptionUsage],
  );

  const filteredSubscriptionUsage = useMemo(() => {
    const searchValue = subscriptionSearch.trim().toLowerCase();

    return subscriptionUsage.filter((clinic) => {
      const matchesSearch =
        !searchValue ||
        String(clinic.clinic_name || "")
          .toLowerCase()
          .includes(searchValue) ||
        String(clinic.owner_name || "")
          .toLowerCase()
          .includes(searchValue) ||
        String(clinic.owner_email || "")
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
  }, [subscriptionPlanFilter, subscriptionSearch, subscriptionUsage]);

  const visibleSubscriptionUsage = filteredSubscriptionUsage.slice(
    0,
    visibleSubscriptionCount,
  );

  const nearLimitCount = subscriptionUsage.filter(
    (clinic) => getUsageStatus(clinic).label === "Near Limit",
  ).length;

  const limitReachedCount = subscriptionUsage.filter(
    (clinic) => getUsageStatus(clinic).label === "Limit Reached",
  ).length;

  const activeModuleDetails =
    REPORT_MODULES.find((module) => module.id === activeModule) ||
    REPORT_MODULES[0];

  const renderCards = (cards) => (
    <div className="module-report-grid">
      {cards.map((card) => (
        <article className="module-report-card" key={card.label}>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
          <p>{card.description}</p>
        </article>
      ))}
    </div>
  );

  const renderTable = (headers, rows, emptyText) => (
    <div className="admin-report-table-wrap">
      {rows.length === 0 ? (
        <div className="empty-state">
          <h3>No report entries</h3>
          <p>{emptyText}</p>
        </div>
      ) : (
        <table className="admin-report-table">
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      )}
    </div>
  );

  const overviewCards = [
    {
      label: "Total Users",
      value: formatNumber(users.total_users),
      description: "All registered system accounts.",
    },
    {
      label: "Clinic Owners",
      value: formatNumber(clinics.total_owner_accounts),
      description: "SaaS tenant accounts.",
    },
    {
      label: "Clinic Locations",
      value: formatNumber(
        clinics.total_clinic_locations || clinics.total_clinics,
      ),
      description: "All registered clinic branches.",
    },
    {
      label: "Appointments",
      value: formatNumber(appointments.total_appointments),
      description: "All appointment records.",
    },
    {
      label: "Dental Records",
      value: formatNumber(records.total_records),
      description: "All patient dental records.",
    },
    {
      label: "X-rays",
      value: formatNumber(xrays.total_xrays),
      description: "Uploaded X-ray files.",
    },
    {
      label: "Paid Revenue",
      value: formatCurrency(payments.total_paid_amount),
      description: "Confirmed subscription payments.",
    },
  ];

  const userCards = [
    {
      label: "Active Users",
      value: formatNumber(users.active_users),
      description: "Accounts currently allowed to sign in.",
    },
    {
      label: "Inactive Users",
      value: formatNumber(users.inactive_users),
      description: "Accounts currently disabled.",
    },
    {
      label: "Patients",
      value: formatNumber(users.patients),
      description: "Registered patient accounts.",
    },
    {
      label: "Dentists",
      value: formatNumber(users.dentists),
      description: "Registered dentist accounts.",
    },
    {
      label: "Assistants",
      value: formatNumber(users.assistants),
      description: "Registered dental assistant accounts.",
    },
    {
      label: "Administrators",
      value: formatNumber(users.admins),
      description: "System administrator accounts.",
    },
  ];

  const clinicCards = [
    {
      label: "Clinic Locations",
      value: formatNumber(
        clinics.total_clinic_locations || clinics.total_clinics,
      ),
      description: "All clinic branches.",
    },
    {
      label: "Clinic Owners",
      value: formatNumber(clinics.total_owner_accounts),
      description: "Distinct owner accounts.",
    },
    {
      label: "Active Locations",
      value: formatNumber(clinics.active_clinics),
      description: "Locations marked Active.",
    },
    {
      label: "Inactive Locations",
      value: formatNumber(clinics.inactive_clinics),
      description: "Locations marked Inactive.",
    },
    {
      label: "Subscribed Locations",
      value: formatNumber(clinics.subscribed_clinics),
      description: "Locations with assigned subscription plans.",
    },
  ];

  const appointmentCards = [
    {
      label: "Total Appointments",
      value: formatNumber(appointments.total_appointments),
      description: "All appointment records.",
    },
    {
      label: "Pending",
      value: formatNumber(appointments.pending),
      description: "Awaiting clinic review.",
    },
    {
      label: "Scheduled",
      value: formatNumber(appointments.scheduled),
      description: "Confirmed upcoming schedules.",
    },
    {
      label: "Completed",
      value: formatNumber(appointments.completed),
      description: "Finished appointments.",
    },
    {
      label: "Cancelled",
      value: formatNumber(appointments.cancelled),
      description: "Cancelled schedules.",
    },
  ];

  const recordCards = [
    {
      label: "Total Records",
      value: formatNumber(records.total_records),
      description: "All dental records.",
    },
    {
      label: "Active Records",
      value: formatNumber(records.active_records),
      description: "Currently active patient records.",
    },
    {
      label: "Archived Records",
      value: formatNumber(records.archived_records),
      description: "Archived patient records.",
    },
  ];

  const xrayCards = [
    {
      label: "Total X-rays",
      value: formatNumber(xrays.total_xrays),
      description: "Uploaded X-ray files.",
    },
    {
      label: "Storage Used",
      value: formatStorage(xrays.total_storage_mb),
      description: "Total X-ray storage.",
    },
    {
      label: "Annotations",
      value: formatNumber(annotations.total_annotations),
      description: "All X-ray annotations.",
    },
    {
      label: "AI Generated",
      value: formatNumber(annotations.ai_generated),
      description: "AI-assisted findings.",
    },
    {
      label: "Suggested",
      value: formatNumber(annotations.suggested),
      description: "Awaiting dentist review.",
    },
    {
      label: "Confirmed",
      value: formatNumber(annotations.confirmed),
      description: "Confirmed by a dentist.",
    },
    {
      label: "Rejected",
      value: formatNumber(annotations.rejected),
      description: "Rejected AI suggestions.",
    },
    {
      label: "Manual",
      value: formatNumber(annotations.manual_annotations),
      description: "Dentist-created annotations.",
    },
  ];

  const subscriptionCards = [
    {
      label: "Locations Monitored",
      value: formatNumber(subscriptionUsage.length),
      description: "Clinic locations with usage data.",
    },
    {
      label: "Near Limit",
      value: formatNumber(nearLimitCount),
      description: "At least one resource is 80% or higher.",
    },
    {
      label: "Limit Reached",
      value: formatNumber(limitReachedCount),
      description: "At least one resource reached its limit.",
    },
    {
      label: "Filtered Results",
      value: formatNumber(filteredSubscriptionUsage.length),
      description: "Locations matching the current filters.",
    },
  ];

  const paymentCards = [
    {
      label: "Total Payments",
      value: formatNumber(payments.total_payments),
      description: "All payment records.",
    },
    {
      label: "Paid",
      value: formatNumber(payments.paid_payments),
      description: "Completed payment records.",
    },
    {
      label: "Pending",
      value: formatNumber(payments.pending_payments),
      description: "Awaiting checkout or webhook confirmation.",
    },
    {
      label: "Cancelled",
      value: formatNumber(payments.cancelled_payments),
      description: "Cancelled payment attempts.",
    },
    {
      label: "Failed",
      value: formatNumber(payments.failed_payments),
      description: "Failed payment attempts.",
    },
    {
      label: "Paid Revenue",
      value: formatCurrency(payments.total_paid_amount),
      description: "Confirmed paid amount.",
    },
  ];

  const renderModuleContent = () => {
    switch (activeModule) {
      case "users":
        return (
          <>
            {renderCards(userCards)}
            <div className="info-message">
              User totals are grouped by role and account status. Detailed
              account changes remain available under User Management and Audit
              Logs.
            </div>
          </>
        );

      case "clinics":
        return (
          <>
            {renderCards(clinicCards)}

            <section className="module-report-subsection">
              <h3>Clinic Locations by Subscription Plan</h3>
              {renderTable(
                ["Plan", "Clinic Locations", "Owner Accounts"],
                clinicsByPlan.map((item) => (
                  <tr key={item.plan_name}>
                    <td>{item.plan_name}</td>
                    <td>{formatNumber(item.clinic_count)}</td>
                    <td>{formatNumber(item.owner_account_count)}</td>
                  </tr>
                )),
                "No clinic plan distribution is available.",
              )}
            </section>
          </>
        );

      case "appointments":
        return (
          <>
            {renderCards(appointmentCards)}

            <section className="module-report-subsection">
              <h3>Recent Appointments</h3>
              {renderTable(
                [
                  "Appointment ID",
                  "Patient",
                  "Dentist",
                  "Clinic",
                  "Schedule",
                  "Status",
                ],
                recentAppointments.map((appointment) => (
                  <tr key={appointment.appointment_id}>
                    <td>#{appointment.appointment_id}</td>
                    <td>{appointment.patient_name || "N/A"}</td>
                    <td>{appointment.dentist_name || "N/A"}</td>
                    <td>{appointment.clinic_name || "N/A"}</td>
                    <td>{formatDate(appointment.appointment_date)}</td>
                    <td>
                      <span className={getStatusClass(appointment.status)}>
                        {appointment.status || "Pending"}
                      </span>
                    </td>
                  </tr>
                )),
                "No recent appointments are available.",
              )}
            </section>
          </>
        );

      case "records":
        return (
          <>
            {renderCards(recordCards)}

            <section className="module-report-subsection">
              <h3>Active Dental Records by Clinic</h3>
              {renderTable(
                ["Clinic ID", "Clinic Location", "Active Records"],
                recordsByClinic.map((clinic) => (
                  <tr key={clinic.clinic_id}>
                    <td>#{clinic.clinic_id}</td>
                    <td>{clinic.clinic_name}</td>
                    <td>{formatNumber(clinic.record_count)}</td>
                  </tr>
                )),
                "No clinic dental-record totals are available.",
              )}
            </section>
          </>
        );

      case "xrays":
        return (
          <>
            {renderCards(xrayCards)}

            <section className="module-report-subsection">
              <h3>X-ray Usage by Clinic</h3>
              {renderTable(
                ["Clinic ID", "Clinic Location", "X-rays", "Storage"],
                xraysByClinic.map((clinic) => (
                  <tr key={clinic.clinic_id}>
                    <td>#{clinic.clinic_id}</td>
                    <td>{clinic.clinic_name}</td>
                    <td>{formatNumber(clinic.xray_count)}</td>
                    <td>{formatStorage(clinic.storage_mb)}</td>
                  </tr>
                )),
                "No clinic X-ray totals are available.",
              )}
            </section>
          </>
        );

      case "subscriptions":
        return (
          <>
            {renderCards(subscriptionCards)}

            <section className="module-report-subsection no-print">
              <div className="admin-report-filter-grid">
                <div className="form-group">
                  <label>Search Subscription Usage</label>
                  <input
                    type="text"
                    value={subscriptionSearch}
                    onChange={(event) => {
                      setSubscriptionSearch(event.target.value);
                      setVisibleSubscriptionCount(10);
                    }}
                    placeholder="Search clinic, owner, email, or plan..."
                  />
                </div>

                <div className="form-group">
                  <label>Plan</label>
                  <select
                    value={subscriptionPlanFilter}
                    onChange={(event) => {
                      setSubscriptionPlanFilter(event.target.value);
                      setVisibleSubscriptionCount(10);
                    }}
                  >
                    {subscriptionPlanOptions.map((plan) => (
                      <option key={plan} value={plan}>
                        {plan === "All" ? "All Plans" : plan}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section className="module-report-subsection">
              <h3>Subscription Capacity by Clinic Location</h3>
              {renderTable(
                [
                  "Clinic / Owner",
                  "Plan",
                  "Locations",
                  "Dentists",
                  "Assistants",
                  "Patients",
                  "Records",
                  "X-rays",
                  "Storage",
                  "Status",
                ],
                visibleSubscriptionUsage.map((clinic) => {
                  const usageStatus = getUsageStatus(clinic);

                  return (
                    <tr key={clinic.clinic_id}>
                      <td>
                        <strong>{clinic.clinic_name}</strong>
                        <small>
                          {clinic.owner_name || "No owner name"}
                          {clinic.owner_email ? ` • ${clinic.owner_email}` : ""}
                        </small>
                      </td>
                      <td>
                        {clinic.plan_name}
                        <small>{clinic.subscription_scope}</small>
                      </td>
                      <td>
                        {formatUsage(
                          clinic.owner_location_count,
                          clinic.max_clinics,
                        )}
                      </td>
                      <td>
                        {formatUsage(clinic.dentists_used, clinic.max_dentists)}
                      </td>
                      <td>
                        {formatUsage(
                          clinic.assistants_used,
                          clinic.max_assistants,
                        )}
                      </td>
                      <td>
                        {formatUsage(clinic.patients_used, clinic.max_patients)}
                      </td>
                      <td>
                        {formatUsage(clinic.records_used, clinic.max_records)}
                      </td>
                      <td>
                        {formatUsage(clinic.xrays_used, clinic.max_xrays)}
                      </td>
                      <td>
                        {formatUsage(
                          Number(clinic.storage_used_mb || 0).toFixed(2),
                          clinic.storage_limit_mb,
                          " MB",
                        )}
                      </td>
                      <td>
                        <span className={usageStatus.className}>
                          {usageStatus.label}
                        </span>
                      </td>
                    </tr>
                  );
                }),
                "No subscription usage records match the current filters.",
              )}

              {visibleSubscriptionCount < filteredSubscriptionUsage.length && (
                <div className="admin-report-load-more no-print">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      setVisibleSubscriptionCount((count) => count + 10)
                    }
                  >
                    Load More
                  </button>
                </div>
              )}
            </section>
          </>
        );

      case "payments":
        return (
          <>
            {renderCards(paymentCards)}
            <div className="info-message">
              Detailed transaction rows, checkout references, and cancellation
              actions remain available in the separate Admin Payment History
              module.
            </div>
          </>
        );

      case "overview":
      default:
        return <>{renderCards(overviewCards)}</>;
    }
  };

  return (
    <DashboardLayout role="Admin">
      <div className="appointments-list-card admin-module-reports-page">
        <div className="appointments-header no-print">
          <div>
            <h2>Module-Specific Reports</h2>
            <p>
              Open one module at a time to review its totals, tables, and
              printable report.
            </p>
          </div>

          <div className="appointment-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={fetchReports}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh Reports"}
            </button>

            <button
              type="button"
              className="primary-button"
              onClick={printActiveModule}
              disabled={loading || !reportData}
            >
              Print Current Module
            </button>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <nav
          className="admin-report-module-tabs no-print"
          aria-label="Admin report modules"
        >
          {REPORT_MODULES.map((module) => (
            <button
              type="button"
              key={module.id}
              className={`admin-report-module-tab ${
                activeModule === module.id ? "active" : ""
              }`}
              onClick={() => setActiveModule(module.id)}
              aria-pressed={activeModule === module.id}
            >
              {module.label}
            </button>
          ))}
        </nav>

        {loading ? (
          <div className="payment-loading-card">
            <p>Loading module reports...</p>
          </div>
        ) : !reportData ? (
          <div className="empty-state">
            <h3>No report data found</h3>
            <p>Report data could not be loaded from the server.</p>
          </div>
        ) : (
          <main
            ref={printAreaRef}
            className="admin-report-print-area"
            data-report-module={activeModule}
          >
            <header className="admin-report-print-header">
              <div>
                <p className="admin-report-eyebrow">DentoGraph Administrator</p>
                <h2>{activeModuleDetails.label} Report</h2>
                <p>{activeModuleDetails.description}</p>
              </div>

              <div className="admin-report-generated">
                Generated: {formatDate(new Date().toISOString())}
              </div>
            </header>

            <section className="module-report-section">
              {renderModuleContent()}
            </section>
          </main>
        )}
      </div>
    </DashboardLayout>
  );
}

export default AdminReports;
