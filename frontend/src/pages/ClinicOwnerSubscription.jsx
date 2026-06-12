import React, { useEffect, useState } from "react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import API from "../api/axios";
import { useNavigate } from "react-router-dom";

function ClinicOwnerSubscription() {
  const navigate = useNavigate();

  const [clinic, setClinic] = useState(null);
  const [usage, setUsage] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  const fetchSubscriptionData = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await API.get("/api/clinics/owner/usage");

      setClinic(response.data.clinic || null);
      setUsage(response.data.usage || null);
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to load subscription details.",
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

  const getBadgeClass = (used, limit) => {
    if (limit === null || limit === undefined || Number(limit) <= 0) {
      return "status-badge status-scheduled";
    }

    const percent = (Number(used || 0) / Number(limit)) * 100;

    if (percent >= 100) return "status-badge status-cancelled";
    if (percent >= 80) return "status-badge status-pending";

    return "status-badge status-completed";
  };

  const renderLimitRow = (label, used, limit) => {
    const percent = getUsagePercent(used, limit);

    return (
      <div className="appointment-item" key={label}>
        <div className="appointment-info" style={{ width: "100%" }}>
          <div className="appointment-title-row">
            <h3>{label}</h3>

            <span className={getBadgeClass(used, limit)}>
              {used} / {formatLimit(limit)}
            </span>
          </div>

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

  const plannedPlans = [
    {
      name: "Free",
      price: "₱0.00",
      description: "Default plan for newly registered clinics.",
      features: [
        "1 clinic",
        "1 dentist",
        "1 dental assistant",
        "Limited patients, records, X-rays, and storage",
      ],
      current: clinic?.plan_name === "Free",
    },
    {
      name: "Standard",
      price: "Monthly",
      description: "For clinics that need more staff and record capacity.",
      features: [
        "More dentists",
        "More assistants",
        "Higher record limit",
        "Higher X-ray and storage limit",
      ],
      current: clinic?.plan_name === "Standard",
    },
    {
      name: "Premium",
      price: "Custom",
      description: "For larger or growing dental clinic operations.",
      features: [
        "Expanded clinic capacity",
        "Advanced reporting",
        "Higher storage allocation",
        "Better multi-clinic scalability",
      ],
      current: clinic?.plan_name === "Premium",
    },
  ];

  return (
    <DashboardLayout role="Clinic Owner">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>Subscription</h2>
            <p>
              View your current clinic plan, usage limits, and future upgrade
              options.
            </p>
          </div>

          <div className="appointment-actions" style={{ flexDirection: "row" }}>
            <button
              className="secondary-button"
              onClick={() => navigate("/clinic-owner/dashboard")}
            >
              Back to Dashboard
            </button>

            <button
              className="secondary-button"
              onClick={fetchSubscriptionData}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        {loading ? (
          <p>Loading subscription details...</p>
        ) : !clinic ? (
          <div className="empty-state">
            <h3>No subscription found</h3>
            <p>
              This account is not linked to a clinic subscription. Please
              contact the system administrator.
            </p>
          </div>
        ) : (
          <>
            <div className="info-message">
              <strong>Clinic:</strong> {clinic.clinic_name}
              <br />
              <strong>Current Plan:</strong> {clinic.plan_name || "No Plan"}
              <br />
              <strong>Billing Cycle:</strong> {clinic.billing_cycle || "N/A"}
            </div>

            <div className="report-section">
              <div className="appointments-header">
                <div>
                  <h2>Current Plan Details</h2>
                  <p>Your clinic is currently using this subscription plan.</p>
                </div>
              </div>

              <div className="appointment-item">
                <div className="appointment-info">
                  <div className="appointment-title-row">
                    <h3>{clinic.plan_name || "No Subscription Plan"}</h3>

                    <span className="status-badge status-completed">
                      {clinic.plan_tier || "Active"}
                    </span>
                  </div>

                  <p>
                    <strong>Price:</strong> {formatPrice(clinic.price)}
                  </p>

                  <p>
                    <strong>Billing Cycle:</strong>{" "}
                    {clinic.billing_cycle || "N/A"}
                  </p>

                  <p>
                    <strong>Max Dentists:</strong>{" "}
                    {formatLimit(clinic.max_dentists)}
                  </p>

                  <p>
                    <strong>Max Assistants:</strong>{" "}
                    {formatLimit(clinic.max_assistants)}
                  </p>

                  <p>
                    <strong>Max Patients:</strong>{" "}
                    {formatLimit(clinic.max_patients)}
                  </p>

                  <p>
                    <strong>Max Records:</strong>{" "}
                    {formatLimit(clinic.max_records)}
                  </p>

                  <p>
                    <strong>Max X-rays:</strong> {formatLimit(clinic.max_xrays)}
                  </p>

                  <p>
                    <strong>Storage Limit:</strong>{" "}
                    {formatLimit(clinic.storage_limit_mb)} MB
                  </p>
                </div>
              </div>
            </div>

            <div className="report-section">
              <div className="appointments-header">
                <div>
                  <h2>Current Usage</h2>
                  <p>
                    These values show how much of your current subscription is
                    already being used.
                  </p>
                </div>
              </div>

              <div className="appointments-list">
                {renderLimitRow(
                  "Dentists",
                  usage?.dentists || 0,
                  clinic.max_dentists,
                )}

                {renderLimitRow(
                  "Dental Assistants",
                  usage?.assistants || 0,
                  clinic.max_assistants,
                )}

                {renderLimitRow(
                  "Patients",
                  usage?.patients || 0,
                  clinic.max_patients,
                )}

                {renderLimitRow(
                  "Dental Records",
                  usage?.records || 0,
                  clinic.max_records,
                )}

                {renderLimitRow("X-rays", usage?.xrays || 0, clinic.max_xrays)}

                {renderLimitRow(
                  "Storage Used",
                  usage?.storage_used_mb || 0,
                  clinic.storage_limit_mb,
                )}
              </div>
            </div>

            <div className="report-section">
              <div className="appointments-header">
                <div>
                  <h2>Available Plans</h2>
                  <p>
                    Upgrade buttons are placeholders for now. The next step will
                    connect them to PayMongo checkout.
                  </p>
                </div>
              </div>

              <div className="appointments-list">
                {plannedPlans.map((plan) => (
                  <div className="appointment-item" key={plan.name}>
                    <div className="appointment-info">
                      <div className="appointment-title-row">
                        <h3>{plan.name}</h3>

                        <span
                          className={
                            plan.current
                              ? "status-badge status-completed"
                              : "status-badge status-scheduled"
                          }
                        >
                          {plan.current ? "Current Plan" : "Available"}
                        </span>
                      </div>

                      <p>
                        <strong>Price:</strong> {plan.price}
                      </p>

                      <p>{plan.description}</p>

                      <ul>
                        {plan.features.map((feature) => (
                          <li key={feature}>{feature}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="appointment-actions">
                      <button
                        className={
                          plan.current ? "secondary-button" : "primary-button"
                        }
                        disabled={plan.current}
                        onClick={() =>
                          alert(
                            `PayMongo checkout for ${plan.name} plan will be added next.`,
                          )
                        }
                      >
                        {plan.current ? "Current" : "Upgrade"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

export default ClinicOwnerSubscription;
