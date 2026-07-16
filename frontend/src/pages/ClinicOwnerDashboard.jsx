import React, { useEffect, useMemo, useState } from "react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import API from "../api/axios";
import { useNavigate } from "react-router-dom";

function ClinicOwnerDashboard() {
  const navigate = useNavigate();

  const [clinicLocations, setClinicLocations] = useState([]);
  const [selectedClinicId, setSelectedClinicId] = useState(
    () => localStorage.getItem("clinicOwnerSelectedClinicId") || "",
  );
  const [selectedLocationUsage, setSelectedLocationUsage] = useState(null);
  const [aggregateClinic, setAggregateClinic] = useState(null);
  const [aggregateUsage, setAggregateUsage] = useState(null);
  const [reportSummary, setReportSummary] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const storedUser = localStorage.getItem("user");
  const user = storedUser ? JSON.parse(storedUser) : null;

  const selectedLocation = useMemo(() => {
    return (
      clinicLocations.find(
        (location) => String(location.clinic_id) === String(selectedClinicId),
      ) || null
    );
  }, [clinicLocations, selectedClinicId]);

  const sharedSubscriptionSource = aggregateClinic || selectedLocation || null;

  const clinicLocationLimit =
    sharedSubscriptionSource?.max_clinics ??
    sharedSubscriptionSource?.max_clinic_locations ??
    sharedSubscriptionSource?.clinic_location_limit ??
    sharedSubscriptionSource?.location_limit ??
    null;

  useEffect(() => {
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedClinicId) {
      localStorage.setItem(
        "clinicOwnerSelectedClinicId",
        String(selectedClinicId),
      );
      fetchSelectedLocationUsage(selectedClinicId);
    } else {
      setSelectedLocationUsage(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClinicId]);

  const fetchDashboardData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const [locationsResponse, usageResponse, reportResponse] =
        await Promise.all([
          API.get("/api/clinics/owner/locations"),
          API.get("/api/clinics/owner/usage"),
          API.get("/api/reports/clinic-owner-summary"),
        ]);

      const locations =
        locationsResponse.data.locations ||
        locationsResponse.data.clinics ||
        locationsResponse.data.clinic_locations ||
        [];

      setClinicLocations(locations);
      setAggregateClinic(usageResponse.data.clinic || null);
      setAggregateUsage(usageResponse.data.usage || null);
      setReportSummary(reportResponse.data || null);

      if (locations.length > 0) {
        setSelectedClinicId((currentClinicId) => {
          const currentStillExists = locations.some(
            (location) =>
              String(location.clinic_id) === String(currentClinicId),
          );

          return currentStillExists
            ? String(currentClinicId)
            : String(locations[0].clinic_id);
        });
      } else {
        setSelectedClinicId("");
        setSelectedLocationUsage(null);
      }
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Unable to load clinic owner dashboard data.",
      );
      setClinicLocations([]);
      setSelectedClinicId("");
      setSelectedLocationUsage(null);
      setAggregateClinic(null);
      setAggregateUsage(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchSelectedLocationUsage = async (clinicId) => {
    if (!clinicId) return;

    try {
      const [response, reportResponse] = await Promise.all([
        API.get(`/api/clinics/owner/locations/${clinicId}/usage`),
        API.get(`/api/reports/clinic-owner-summary?clinic_id=${clinicId}`),
      ]);

      setSelectedLocationUsage({
        clinic: response.data.clinic || null,
        usage: response.data.usage || null,
      });
    } catch (err) {
      console.error("Selected location usage error:", err);
      setSelectedLocationUsage(null);
    }
  };

  const handleLocationChange = (e) => {
    setSelectedClinicId(e.target.value);
    setMessageSafe("");
  };

  const setMessageSafe = () => {
    setError("");
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

  const formatDate = (dateValue) => {
    if (!dateValue) return "N/A";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) return "N/A";

    return date.toLocaleDateString("en-PH", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
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
      <div className="appointment-item clinic-owner-usage-card">
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

  const locationUsage = selectedLocationUsage?.usage || null;
  const locationClinic = selectedLocationUsage?.clinic || selectedLocation;

  const summaryCards = [
    {
      label: "Clinic Locations",
      value: clinicLocations.length,
      description: `Shared limit: ${formatLimit(clinicLocationLimit)}`,
    },
    {
      label: "Total Dentists",
      value: aggregateUsage?.dentists || 0,
      description: `Shared limit: ${formatLimit(
        sharedSubscriptionSource?.max_dentists,
      )}`,
    },
    {
      label: "Total Assistants",
      value: aggregateUsage?.assistants || 0,
      description: `Shared limit: ${formatLimit(
        sharedSubscriptionSource?.max_assistants,
      )}`,
    },
    {
      label: "Total Patients",
      value: aggregateUsage?.patients || 0,
      description: `Shared limit: ${formatLimit(
        sharedSubscriptionSource?.max_patients,
      )}`,
    },
    {
      label: "Dental Records",
      value: aggregateUsage?.records || 0,
      description: `Shared limit: ${formatLimit(
        sharedSubscriptionSource?.max_records,
      )}`,
    },
    {
      label: "X-rays",
      value: aggregateUsage?.xrays || 0,
      description: `Shared limit: ${formatLimit(
        sharedSubscriptionSource?.max_xrays,
      )}`,
    },
    {
      label: "Storage Used",
      value: `${aggregateUsage?.storage_used_mb || 0} MB`,
      description: `Shared limit: ${formatLimit(
        sharedSubscriptionSource?.storage_limit_mb,
      )} MB`,
    },
    {
      label: "Shared Plan",
      value: sharedSubscriptionSource?.plan_name || "No Plan",
      description:
        sharedSubscriptionSource?.billing_cycle || "No billing cycle",
    },
  ];

  const quickActions = [
    {
      title: "Staff Management",
      description: "Add and manage staff per clinic location.",
      buttonLabel: "Manage Staff",
      className: "primary-button",
      path: "/clinic-owner/staff",
    },
    {
      title: "Subscription",
      description: "View the shared subscription for all clinic locations.",
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
      title: "Clinic Locations",
      description: "Update clinic location details and branch information.",
      buttonLabel: "Manage Locations",
      className: "secondary-button",
      path: "/clinic-owner/profile",
    },
  ];

  return (
    <DashboardLayout role="Clinic Owner">
      <div className="appointments-list-card clinic-owner-dashboard-page">
        <div className="appointments-header">
          <div>
            <h2>Clinic Owner Dashboard</h2>
            <p>
              Welcome back, {user?.name || "Clinic Owner"}. Manage your clinic
              locations, shared subscription, usage limits, staff access, and
              payments.
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
        ) : clinicLocations.length === 0 ? (
          <div className="empty-state">
            <h3>No clinic locations found</h3>
            <p>
              This account is not linked to any clinic location yet. Please
              register or add a clinic location first.
            </p>
          </div>
        ) : (
          <>
            <div className="info-message">
              <strong>Shared Subscription:</strong>{" "}
              {sharedSubscriptionSource?.plan_name || "No Plan"}
              <br />
              This Clinic Owner account has{" "}
              <strong>{clinicLocations.length}</strong> clinic location
              {clinicLocations.length === 1 ? "" : "s"}. Usage below is
              aggregated across all locations because the subscription is shared
              under one Clinic Owner account.
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
                  <h2>My Clinic Locations</h2>
                  <p>
                    These are the active branch locations under this clinic
                    owner account.
                  </p>
                </div>

                <button
                  className="secondary-button"
                  onClick={() => navigate("/clinic-owner/profile")}
                >
                  Manage Locations
                </button>
              </div>

              <div className="patient-quick-action-grid">
                {clinicLocations.map((location) => (
                  <div
                    className="patient-quick-action-card"
                    key={location.clinic_id}
                  >
                    <div>
                      <div className="appointment-title-row">
                        <h3>{location.clinic_name}</h3>
                        <span className="status-badge status-scheduled">
                          {location.status || "Active"}
                        </span>
                      </div>

                      <p>
                        <strong>Address:</strong> {location.address || "N/A"}
                      </p>

                      <p>
                        <strong>Contact:</strong>{" "}
                        {location.contact_number || "N/A"}
                      </p>

                      <p>
                        <strong>Services:</strong> {location.services || "N/A"}
                      </p>
                    </div>

                    <div className="appointment-actions">
                      <button
                        className="primary-button"
                        onClick={() => {
                          setSelectedClinicId(String(location.clinic_id));
                          navigate("/clinic-owner/staff");
                        }}
                      >
                        Manage Staff
                      </button>

                      <button
                        className="secondary-button"
                        onClick={() => navigate("/clinic-owner/profile")}
                      >
                        Edit Location
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {reportSummary && (
              <div className="patient-dashboard-section">
                <div className="appointments-header">
                  <div>
                    <h2>
                      {reportSummary.scope === "location"
                        ? "Selected Location Analytics"
                        : "Account-Wide Analytics"}
                    </h2>
                    <p>
                      Operational totals include only valid patient, dentist,
                      and clinic-location relationships.
                    </p>
                  </div>
                </div>

                <div className="patient-dashboard-summary-grid">
                  <div className="patient-dashboard-card">
                    <span>Total Appointments</span>
                    <strong>
                      {reportSummary.summaries?.appointments
                        ?.total_appointments || 0}
                    </strong>
                    <p>Appointments within the current report scope.</p>
                  </div>

                  <div className="patient-dashboard-card">
                    <span>Active Records</span>
                    <strong>
                      {reportSummary.summaries?.records?.active_records || 0}
                    </strong>
                    <p>Same-location active dental records.</p>
                  </div>

                  <div className="patient-dashboard-card">
                    <span>X-rays</span>
                    <strong>
                      {reportSummary.summaries?.xrays?.total_xrays || 0}
                    </strong>
                    <p>Authorized X-rays within the current scope.</p>
                  </div>

                  <div className="patient-dashboard-card">
                    <span>Storage Used</span>
                    <strong>
                      {Number(
                        reportSummary.summaries?.xrays?.storage_used_mb || 0,
                      ).toFixed(2)}{" "}
                      MB
                    </strong>
                    <p>Shared storage consumed by scoped X-ray files.</p>
                  </div>
                </div>
              </div>
            )}

            <div className="patient-dashboard-section">
              <div className="appointments-header">
                <div>
                  <h2>Selected Location Usage</h2>
                  <p>
                    View staff and record usage for one clinic location while
                    keeping subscription limits shared across all locations.
                  </p>
                </div>
              </div>

              <div className="clinic-location-panel">
                <div className="clinic-location-grid">
                  <div className="clinic-location-field">
                    <label>Clinic Location</label>
                    <select
                      value={selectedClinicId}
                      onChange={handleLocationChange}
                      disabled={refreshing}
                    >
                      {clinicLocations.map((location) => (
                        <option
                          key={location.clinic_id}
                          value={location.clinic_id}
                        >
                          {location.clinic_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="clinic-location-field">
                    <label>Shared Subscription</label>
                    <div className="clinic-location-readonly">
                      {sharedSubscriptionSource?.plan_name || "No active plan"}
                    </div>
                  </div>
                </div>

                {locationClinic && (
                  <div className="clinic-location-note">
                    <strong>{locationClinic.clinic_name}</strong> is currently
                    selected. Its branch usage is shown below, while the plan
                    limits still come from the shared Clinic Owner subscription.
                  </div>
                )}
              </div>

              <div className="appointments-list">
                {renderUsageCard(
                  "Dentists in Selected Location",
                  locationUsage?.dentists || 0,
                  sharedSubscriptionSource?.max_dentists,
                  "Dentist accounts assigned to this branch.",
                )}

                {renderUsageCard(
                  "Assistants in Selected Location",
                  locationUsage?.assistants || 0,
                  sharedSubscriptionSource?.max_assistants,
                  "Dental assistant accounts assigned to this branch.",
                )}

                {renderUsageCard(
                  "Patients in Selected Location",
                  locationUsage?.patients || 0,
                  sharedSubscriptionSource?.max_patients,
                  "Unique patients with active records under this branch.",
                )}

                {renderUsageCard(
                  "Records in Selected Location",
                  locationUsage?.records || 0,
                  sharedSubscriptionSource?.max_records,
                  "Active dental records created under this branch.",
                )}

                {renderUsageCard(
                  "X-rays in Selected Location",
                  locationUsage?.xrays || 0,
                  sharedSubscriptionSource?.max_xrays,
                  "X-ray files uploaded under this branch records.",
                )}

                {renderUsageCard(
                  "Storage Used in Selected Location",
                  locationUsage?.storage_used_mb || 0,
                  sharedSubscriptionSource?.storage_limit_mb,
                  "Total X-ray file storage used by this branch in MB.",
                )}
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
                  <h2>Current Shared Subscription</h2>
                  <p>
                    This subscription is shared by all clinic locations under
                    this Clinic Owner account.
                  </p>
                </div>

                <button
                  className="primary-button"
                  onClick={() => navigate("/clinic-owner/subscription")}
                >
                  View Plans
                </button>
              </div>

              <div className="appointment-item clinic-owner-subscription-card">
                <div className="appointment-info">
                  <div className="appointment-title-row">
                    <h3>
                      {sharedSubscriptionSource?.plan_name ||
                        "No Subscription Plan"}
                    </h3>

                    <span className="status-badge status-completed">
                      {sharedSubscriptionSource?.billing_cycle || "N/A"}
                    </span>
                  </div>

                  <p>
                    <strong>Plan Tier:</strong>{" "}
                    {sharedSubscriptionSource?.plan_tier || "N/A"}
                  </p>

                  <p>
                    <strong>Price:</strong>{" "}
                    {formatPrice(sharedSubscriptionSource?.price)}
                  </p>

                  <p>
                    <strong>Storage Limit:</strong>{" "}
                    {formatLimit(sharedSubscriptionSource?.storage_limit_mb)} MB
                  </p>

                  <p>
                    <strong>Dentist Limit:</strong>{" "}
                    {formatLimit(sharedSubscriptionSource?.max_dentists)}
                  </p>

                  <p>
                    <strong>Assistant Limit:</strong>{" "}
                    {formatLimit(sharedSubscriptionSource?.max_assistants)}
                  </p>

                  <p>
                    <strong>Patient Limit:</strong>{" "}
                    {formatLimit(sharedSubscriptionSource?.max_patients)}
                  </p>

                  <p>
                    <strong>Record Limit:</strong>{" "}
                    {formatLimit(sharedSubscriptionSource?.max_records)}
                  </p>

                  <p>
                    <strong>X-ray Limit:</strong>{" "}
                    {formatLimit(sharedSubscriptionSource?.max_xrays)}
                  </p>

                  <p>
                    <strong>Subscription Status:</strong>{" "}
                    {sharedSubscriptionSource?.subscription_status ||
                      sharedSubscriptionSource?.status ||
                      "N/A"}
                  </p>

                  <p>
                    <strong>Subscription End Date:</strong>{" "}
                    {formatDate(
                      sharedSubscriptionSource?.subscription_end_date,
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="patient-dashboard-section">
              <div className="appointments-header">
                <div>
                  <h2>Aggregated Usage Limits</h2>
                  <p>
                    These totals count all clinic locations owned by this Clinic
                    Owner account.
                  </p>
                </div>
              </div>

              <div className="appointments-list">
                {renderUsageCard(
                  "Clinic Locations",
                  clinicLocations.length,
                  clinicLocationLimit,
                  "Total branches under this Clinic Owner account.",
                )}

                {renderUsageCard(
                  "Total Dentists",
                  aggregateUsage?.dentists || 0,
                  sharedSubscriptionSource?.max_dentists,
                  "Dentist accounts across all clinic locations.",
                )}

                {renderUsageCard(
                  "Total Dental Assistants",
                  aggregateUsage?.assistants || 0,
                  sharedSubscriptionSource?.max_assistants,
                  "Dental assistant accounts across all clinic locations.",
                )}

                {renderUsageCard(
                  "Total Patients",
                  aggregateUsage?.patients || 0,
                  sharedSubscriptionSource?.max_patients,
                  "Unique patients across all clinic locations.",
                )}

                {renderUsageCard(
                  "Total Dental Records",
                  aggregateUsage?.records || 0,
                  sharedSubscriptionSource?.max_records,
                  "Active dental records across all clinic locations.",
                )}

                {renderUsageCard(
                  "Total X-rays",
                  aggregateUsage?.xrays || 0,
                  sharedSubscriptionSource?.max_xrays,
                  "X-ray files across all clinic locations.",
                )}

                {renderUsageCard(
                  "Total Storage Used",
                  aggregateUsage?.storage_used_mb || 0,
                  sharedSubscriptionSource?.storage_limit_mb,
                  "Total X-ray file storage used across all locations in MB.",
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
