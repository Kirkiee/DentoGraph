import React, { useEffect, useState } from "react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import API from "../api/axios";
import { useNavigate } from "react-router-dom";

function ClinicOwnerSubscription() {
  const navigate = useNavigate();

  const [clinic, setClinic] = useState(null);
  const [usage, setUsage] = useState(null);
  const [plans, setPlans] = useState([]);

  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);

  const [error, setError] = useState("");

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  const fetchSubscriptionData = async () => {
    try {
      setLoading(true);
      setError("");

      const usageResponse = await API.get("/api/clinics/owner/usage");
      const plansResponse = await API.get("/api/subscriptions/active-plans");

      setClinic(usageResponse.data.clinic || null);
      setUsage(usageResponse.data.usage || null);
      setPlans(plansResponse.data.plans || []);
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

  const formatDate = (dateValue) => {
    if (!dateValue) return "N/A";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) return "N/A";

    return date.toLocaleString();
  };

  const getDaysRemaining = (endDateValue) => {
    if (!endDateValue) return "N/A";

    const endDate = new Date(endDateValue);
    const today = new Date();

    if (Number.isNaN(endDate.getTime())) return "N/A";

    const differenceMs = endDate.getTime() - today.getTime();
    const days = Math.ceil(differenceMs / (1000 * 60 * 60 * 24));

    if (days < 0) return "Expired";
    if (days === 0) return "Expires today";

    return `${days} day${days === 1 ? "" : "s"} remaining`;
  };

  const getSubscriptionStatusClass = (status, endDateValue) => {
    const endDate = endDateValue ? new Date(endDateValue) : null;
    const today = new Date();

    if (endDate && !Number.isNaN(endDate.getTime()) && endDate < today) {
      return "status-badge status-cancelled";
    }

    if (status === "Active") return "status-badge status-completed";
    if (status === "Expired") return "status-badge status-cancelled";
    if (status === "Pending") return "status-badge status-pending";

    return "status-badge status-scheduled";
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

  const parseFeatures = (features) => {
    if (!features) return [];

    return String(features)
      .split(",")
      .map((feature) => feature.trim())
      .filter(Boolean);
  };

  const getDefaultFeatures = (plan) => {
    return [
      `${formatLimit(plan.max_clinics)} clinic limit`,
      `${formatLimit(plan.max_dentists)} dentist limit`,
      `${formatLimit(plan.max_assistants)} assistant limit`,
      `${formatLimit(plan.max_patients)} patient limit`,
      `${formatLimit(plan.max_records)} dental record limit`,
      `${formatLimit(plan.max_xrays)} X-ray limit`,
      `${formatLimit(plan.storage_limit_mb)} MB storage limit`,
    ];
  };

  const getPlanFeatures = (plan) => {
    const parsed = parseFeatures(plan.features);

    if (parsed.length > 0) {
      return parsed;
    }

    return getDefaultFeatures(plan);
  };

  const isCurrentPlan = (plan) => {
    return Number(clinic?.subscription_plan_id) === Number(plan.plan_id);
  };

  const getPlanChangeType = (plan) => {
    const currentPrice = Number(clinic?.price || 0);
    const selectedPrice = Number(plan.price || 0);

    if (selectedPrice > currentPrice) return "Upgrade";
    if (selectedPrice < currentPrice) return "Downgrade";

    return "Change";
  };

  const formatViolations = (violations) => {
    if (!Array.isArray(violations) || violations.length === 0) {
      return "";
    }

    return `\n\nCurrent usage exceeding selected plan:\n- ${violations.join(
      "\n- ",
    )}`;
  };

  const handleChangePlan = async (plan) => {
    if (isCurrentPlan(plan)) return;

    if (Number(plan.price || 0) <= 0) {
      const confirmFreeChange = window.confirm(
        "This plan does not require checkout. The system will only allow this change if your clinic usage fits the selected plan limits. Continue?",
      );

      if (!confirmFreeChange) return;

      try {
        setCheckoutLoading(true);
        setSelectedPlan(plan.plan_name);
        setError("");

        const response = await API.put("/api/payments/change-free-plan", {
          plan_id: plan.plan_id,
        });

        alert(
          response.data.message || "Subscription plan changed successfully.",
        );
        fetchSubscriptionData();
      } catch (err) {
        const backendError =
          err.response?.data?.error || "Unable to change subscription plan.";

        const violationsText = formatViolations(err.response?.data?.violations);

        alert(`${backendError}${violationsText}`);
      } finally {
        setCheckoutLoading(false);
        setSelectedPlan(null);
      }

      return;
    }

    try {
      setCheckoutLoading(true);
      setSelectedPlan(plan.plan_name);
      setError("");

      const response = await API.post("/api/payments/create-checkout", {
        plan_id: plan.plan_id,
      });

      const checkoutUrl = response.data.checkout_url;

      if (!checkoutUrl) {
        alert("Checkout URL was not returned.");
        return;
      }

      window.location.href = checkoutUrl;
    } catch (err) {
      const backendError =
        err.response?.data?.error || "Unable to prepare plan change checkout.";

      const violationsText = formatViolations(err.response?.data?.violations);

      alert(`${backendError}${violationsText}`);
    } finally {
      setCheckoutLoading(false);
      setSelectedPlan(null);
    }
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

  return (
    <DashboardLayout role="Clinic Owner">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>Subscription</h2>
            <p>
              View your current clinic plan, usage limits, subscription period,
              and available plan change options.
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
              <br />
              <strong>Subscription Status:</strong>{" "}
              {clinic.subscription_status || "Active"}
              <br />
              <strong>Subscription Ends:</strong>{" "}
              {formatDate(clinic.subscription_end_date)}
            </div>

            <div className="report-section">
              <div className="appointments-header">
                <div>
                  <h2>Subscription Period</h2>
                  <p>
                    These dates show when the current subscription started and
                    when it is expected to end.
                  </p>
                </div>
              </div>

              <div className="appointment-item">
                <div className="appointment-info">
                  <div className="appointment-title-row">
                    <h3>Subscription Status</h3>

                    <span
                      className={getSubscriptionStatusClass(
                        clinic.subscription_status,
                        clinic.subscription_end_date,
                      )}
                    >
                      {clinic.subscription_status || "Active"}
                    </span>
                  </div>

                  <p>
                    <strong>Start Date:</strong>{" "}
                    {formatDate(clinic.subscription_start_date)}
                  </p>

                  <p>
                    <strong>End Date:</strong>{" "}
                    {formatDate(clinic.subscription_end_date)}
                  </p>

                  <p>
                    <strong>Time Remaining:</strong>{" "}
                    {getDaysRemaining(clinic.subscription_end_date)}
                  </p>
                </div>
              </div>
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
                    <strong>Max Clinics:</strong>{" "}
                    {formatLimit(clinic.max_clinics)}
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
                  <h2>Available Subscription Plans</h2>
                  <p>
                    Choose a subscription plan to change your clinic plan.
                    Checkout is blocked if the selected plan cannot support the
                    clinic's current usage.
                  </p>
                </div>
              </div>

              {plans.length === 0 ? (
                <div className="empty-state">
                  <h3>No active plans</h3>
                  <p>No active subscription plans are available right now.</p>
                </div>
              ) : (
                <div className="appointments-list">
                  {plans.map((plan) => {
                    const current = isCurrentPlan(plan);
                    const features = getPlanFeatures(plan);
                    const changeType = getPlanChangeType(plan);

                    return (
                      <div className="appointment-item" key={plan.plan_id}>
                        <div className="appointment-info">
                          <div className="appointment-title-row">
                            <h3>{plan.plan_name}</h3>

                            <span
                              className={
                                current
                                  ? "status-badge status-completed"
                                  : "status-badge status-scheduled"
                              }
                            >
                              {current ? "Current Plan" : `${changeType} Plan`}
                            </span>
                          </div>

                          <p>
                            <strong>Price:</strong> {formatPrice(plan.price)}
                          </p>

                          <p>
                            <strong>Billing Cycle:</strong>{" "}
                            {plan.billing_cycle || "N/A"}
                          </p>

                          <p>
                            <strong>Storage:</strong>{" "}
                            {plan.storage_limit ||
                              `${formatLimit(plan.storage_limit_mb)} MB`}
                          </p>

                          <ul>
                            {features.map((feature) => (
                              <li key={feature}>{feature}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="appointment-actions">
                          <button
                            className={
                              current ? "secondary-button" : "primary-button"
                            }
                            disabled={current || checkoutLoading}
                            onClick={() => handleChangePlan(plan)}
                          >
                            {current
                              ? "Current"
                              : checkoutLoading &&
                                  selectedPlan === plan.plan_name
                                ? "Preparing Checkout..."
                                : "Change Plan"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

export default ClinicOwnerSubscription;
