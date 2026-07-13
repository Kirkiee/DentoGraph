import React, { useEffect, useState } from "react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import API from "../api/axios";
import { useNavigate } from "react-router-dom";

function ClinicOwnerDashboard() {
  const navigate = useNavigate();

  const [clinic, setClinic] = useState(null);
  const [usage, setUsage] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const storedUser = localStorage.getItem("user");
  const user = storedUser ? JSON.parse(storedUser) : null;

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

      const [clinicResponse, usageResponse] = await Promise.all([
        API.get("/api/clinics/owner/my-clinic"),
        API.get("/api/clinics/owner/usage"),
      ]);

      setClinic(clinicResponse.data.clinic || null);
      setUsage(usageResponse.data.usage || null);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Unable to load clinic owner dashboard data.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatLimit = (value) => {
    if (value === null || value === undefined) return "Unlimited";
    return value;
  };

  const formatPrice = (price) => {
    const amount = Number(price || 0);

    return `₱${amount.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const getUsagePercent = (used, limit) => {
    if (limit === null || limit === undefined || Number(limit) <= 0) {
      return 0;
    }

    const percent = (Number(used || 0) / Number(limit)) * 100;

    if (percent > 100) return 100;
    return percent;
  };

  const getUsageStatusClass = (used, limit) => {
    if (limit === null || limit === undefined || Number(limit) <= 0) {
      return "status-badge status-scheduled";
    }

    const percent = (Number(used || 0) / Number(limit)) * 100;

    if (percent >= 100) return "status-badge status-cancelled";
    if (percent >= 80) return "status-badge status-pending";

    return "status-badge status-completed";
  };

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

  const renderUsageCard = (label, used, limit, helperText = "") => {
    const percent = getUsagePercent(used, limit);

    return (
      <div className="appointment-item">
        <div className="appointment-info" style={{ width: "100%" }}>
          <div className="appointment-title-row">
            <h3>{label}</h3>

            <span className={getUsageStatusClass(used, limit)}>
              {used} / {formatLimit(limit)}
            </span>
          </div>

          {helperText && <p>{helperText}</p>}

          <div className="usage-progress-track">
            <div
              className="usage-progress-fill"
              style={{ width: `${percent}%` }}
            ></div>
          </div>
        </div>
      </div>
    );
  };

  const summaryCards = [
    {
      label: "Dentists",
      value: usage?.dentists || 0,
      description: `Limit: ${formatLimit(clinic?.max_dentists)}`,
    },
    {
      label: "Dental Assistants",
      value: usage?.assistants || 0,
      description: `Limit: ${formatLimit(clinic?.max_assistants)}`,
    },
    {
      label: "Patients",
      value: usage?.patients || 0,
      description: `Limit: ${formatLimit(clinic?.max_patients)}`,
    },
    {
      label: "Dental Records",
      value: usage?.records || 0,
      description: `Limit: ${formatLimit(clinic?.max_records)}`,
    },
    {
      label: "X-rays",
      value: usage?.xrays || 0,
      description: `Limit: ${formatLimit(clinic?.max_xrays)}`,
    },
    {
      label: "Storage Used",
      value: `${usage?.storage_used_mb || 0} MB`,
      description: `Limit: ${formatLimit(clinic?.storage_limit_mb)} MB`,
    },
    {
      label: "Plan",
      value: clinic?.plan_name || "No Plan",
      description: clinic?.billing_cycle || "No billing cycle",
    },
    {
      label: "Clinic Status",
      value: clinic?.status || "N/A",
      description: "Current clinic account status.",
    },
  ];

  const quickActions = [
    {
      title: "Staff Management",
      description: "Add and manage dentists and dental assistants.",
      buttonLabel: "Manage Staff",
      className: "primary-button",
      path: "/clinic-owner/staff",
    },
    {
      title: "Subscription",
      description: "View plans, limits, upgrades, and subscription status.",
      buttonLabel: "View Subscription",
      className: "secondary-button",
      path: "/clinic-owner/subscription",
    },
    {
      title: "Payments",
      description: "Review payment history and pending payment records.",
      buttonLabel: "View Payments",
      className: "secondary-button",
      path: "/clinic-owner/payments",
    },
    {
      title: "Clinic Profile",
      description: "Update clinic address, services, and opening hours.",
      buttonLabel: "Edit Clinic",
      className: "secondary-button",
      path: "/clinic-owner/profile",
    },
  ];

  return (
    <DashboardLayout role="Clinic Owner">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>Clinic Owner Dashboard</h2>
            <p>
              Welcome back, {user?.name || "Clinic Owner"}. Manage your clinic,
              subscription plan, usage limits, staff access, and payments.
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
        ) : !clinic ? (
          <div className="empty-state">
            <h3>No clinic found</h3>
            <p>
              This account is not linked to a clinic. Please contact the system
              administrator.
            </p>
          </div>
        ) : (
          <>
            <div className="info-message">
              <strong>Current Plan:</strong> {clinic.plan_name || "No Plan"}
              <br />
              Your clinic status is <strong>{clinic.status || "N/A"}</strong>.
              Usage below is based on your current subscription limits.
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
                  <h2>Clinic Information</h2>
                  <p>Basic clinic profile details shown to system users.</p>
                </div>

                <button
                  className="secondary-button"
                  onClick={() => navigate("/clinic-owner/profile")}
                >
                  Edit Clinic Profile
                </button>
              </div>

              <div className="appointment-item">
                <div className="appointment-info">
                  <div className="appointment-title-row">
                    <h3>{clinic.clinic_name}</h3>

                    <span className="status-badge status-scheduled">
                      {clinic.status || "Active"}
                    </span>
                  </div>

                  <p>
                    <strong>Owner:</strong> {clinic.owner_name || "N/A"}
                  </p>

                  <p>
                    <strong>Owner Email:</strong> {clinic.owner_email || "N/A"}
                  </p>

                  <p>
                    <strong>Address:</strong> {clinic.address || "N/A"}
                  </p>

                  <p>
                    <strong>Contact Number:</strong>{" "}
                    {clinic.contact_number || "N/A"}
                  </p>

                  <p>
                    <strong>Services:</strong> {clinic.services || "N/A"}
                  </p>

                  <p>
                    <strong>Opening Hours:</strong>{" "}
                    {clinic.opening_hours || "N/A"}
                  </p>
                </div>
              </div>
            </div>

            <div className="patient-dashboard-section">
              <div className="appointments-header">
                <div>
                  <h2>Quick Actions</h2>
                  <p>
                    Open the clinic owner modules commonly used during demos.
                  </p>
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
                  <h2>Current Subscription</h2>
                  <p>
                    Review the clinic plan currently assigned to this clinic.
                  </p>
                </div>

                <button
                  className="primary-button"
                  onClick={() => navigate("/clinic-owner/subscription")}
                >
                  View Plans
                </button>
              </div>

              <div className="appointment-item">
                <div className="appointment-info">
                  <div className="appointment-title-row">
                    <h3>{clinic.plan_name || "No Subscription Plan"}</h3>

                    <span className="status-badge status-completed">
                      {clinic.billing_cycle || "N/A"}
                    </span>
                  </div>

                  <p>
                    <strong>Plan Tier:</strong> {clinic.plan_tier || "N/A"}
                  </p>

                  <p>
                    <strong>Price:</strong> {formatPrice(clinic.price)}
                  </p>

                  <p>
                    <strong>Storage Limit:</strong>{" "}
                    {formatLimit(clinic.storage_limit_mb)} MB
                  </p>

                  <p>
                    <strong>Dentist Limit:</strong>{" "}
                    {formatLimit(clinic.max_dentists)}
                  </p>

                  <p>
                    <strong>Assistant Limit:</strong>{" "}
                    {formatLimit(clinic.max_assistants)}
                  </p>

                  <p>
                    <strong>Patient Limit:</strong>{" "}
                    {formatLimit(clinic.max_patients)}
                  </p>

                  <p>
                    <strong>Record Limit:</strong>{" "}
                    {formatLimit(clinic.max_records)}
                  </p>

                  <p>
                    <strong>X-ray Limit:</strong>{" "}
                    {formatLimit(clinic.max_xrays)}
                  </p>
                </div>
              </div>
            </div>

            <div className="patient-dashboard-section">
              <div className="appointments-header">
                <div>
                  <h2>Usage Limits</h2>
                  <p>
                    These limits are based on the current subscription plan.
                  </p>
                </div>
              </div>

              <div className="appointments-list">
                {renderUsageCard(
                  "Dentists",
                  usage?.dentists || 0,
                  clinic.max_dentists,
                  "Dentist accounts assigned to your clinic.",
                )}

                {renderUsageCard(
                  "Dental Assistants",
                  usage?.assistants || 0,
                  clinic.max_assistants,
                  "Dental assistant accounts assigned to your clinic.",
                )}

                {renderUsageCard(
                  "Patients",
                  usage?.patients || 0,
                  clinic.max_patients,
                  "Unique patients with active records under your clinic.",
                )}

                {renderUsageCard(
                  "Dental Records",
                  usage?.records || 0,
                  clinic.max_records,
                  "Active dental records created under your clinic.",
                )}

                {renderUsageCard(
                  "X-rays",
                  usage?.xrays || 0,
                  clinic.max_xrays,
                  "X-ray files uploaded under your clinic records.",
                )}

                {renderUsageCard(
                  "Storage Used",
                  usage?.storage_used_mb || 0,
                  clinic.storage_limit_mb,
                  "Total X-ray file storage used in MB.",
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

export default ClinicOwnerDashboard;
