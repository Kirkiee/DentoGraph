import React, { useEffect, useState } from "react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import API from "../api/axios";
import { useNavigate } from "react-router-dom";

function ClinicOwnerDashboard() {
  const navigate = useNavigate();

  const [clinic, setClinic] = useState(null);
  const [usage, setUsage] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const storedUser = localStorage.getItem("user");
  const user = storedUser ? JSON.parse(storedUser) : null;

  useEffect(() => {
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError("");

      const clinicResponse = await API.get("/api/clinics/owner/my-clinic");

      const usageResponse = await API.get("/api/clinics/owner/usage");

      setClinic(clinicResponse.data.clinic || null);
      setUsage(usageResponse.data.usage || null);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Unable to load clinic owner dashboard data.",
      );
    } finally {
      setLoading(false);
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

          <div
            style={{
              width: "100%",
              height: "10px",
              background: "#e2e8f0",
              borderRadius: "999px",
              overflow: "hidden",
              marginTop: "12px",
            }}
          >
            <div
              style={{
                width: `${percent}%`,
                height: "100%",
                background: "#2b6cb0",
                borderRadius: "999px",
              }}
            ></div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout role="Clinic Owner">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>Clinic Owner Dashboard</h2>
            <p>
              Manage your clinic profile, subscription plan, usage limits, and
              staff access.
            </p>
          </div>

          <button
            className="secondary-button"
            onClick={fetchDashboardData}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {loading ? (
          <p>Loading clinic owner dashboard...</p>
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
              <strong>Welcome:</strong> {user?.name || "Clinic Owner"}
              <br />
              Your clinic is currently using the{" "}
              <strong>{clinic.plan_name || "No Plan"}</strong> plan.
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

            <div className="report-section">
              <div className="appointments-header">
                <div>
                  <h2>Current Subscription</h2>
                  <p>
                    Your clinic was assigned the Free plan by default. Upgrade
                    options will be connected to PayMongo later.
                  </p>
                </div>
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

                <div className="appointment-actions">
                  <button
                    className="primary-button"
                    onClick={() =>
                      alert("PayMongo upgrade flow will be added next.")
                    }
                  >
                    Upgrade Plan
                  </button>
                </div>
              </div>
            </div>

            <div className="report-section">
              <div className="appointments-header">
                <div>
                  <h2>Usage Limits</h2>
                  <p>
                    These limits are based on your current subscription plan.
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

            <div className="report-section">
              <div className="appointments-header">
                <div>
                  <h2>Clinic Management</h2>
                  <p>
                    Manage staff accounts and prepare your clinic for
                    subscription upgrades.
                  </p>
                </div>
              </div>

              <div className="appointments-list">
                <div className="appointment-item">
                  <div className="appointment-info">
                    <h3>Staff Management</h3>
                    <p>
                      Add dentists and dental assistants under your clinic.
                      Creation is limited by your current subscription plan.
                    </p>
                  </div>

                  <div className="appointment-actions">
                    <button
                      className="primary-button"
                      onClick={() => navigate("/clinic-owner/staff")}
                    >
                      Manage Staff
                    </button>
                  </div>
                </div>

                <div className="appointment-item">
                  <div className="appointment-info">
                    <h3>Subscription Upgrade</h3>
                    <p>
                      Upgrade your plan to increase staff, record, X-ray, and
                      storage limits. PayMongo integration will handle this
                      later.
                    </p>
                  </div>

                  <div className="appointment-actions">
                    <button
                      className="secondary-button"
                      onClick={() =>
                        alert("Subscription upgrade page will be added next.")
                      }
                    >
                      View Plans
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

export default ClinicOwnerDashboard;
