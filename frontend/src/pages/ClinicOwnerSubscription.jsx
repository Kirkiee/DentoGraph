import React, { useEffect, useMemo, useState } from "react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import API from "../api/axios";
import { useNavigate } from "react-router-dom";

function ClinicOwnerSubscription() {
  const navigate = useNavigate();

  const [clinic, setClinic] = useState(null);
  const [usage, setUsage] = useState(null);
  const [clinicLocations, setClinicLocations] = useState([]);
  const [plans, setPlans] = useState([]);

  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);

  const [error, setError] = useState("");
  const [paymentNotice, setPaymentNotice] = useState(null);

  useEffect(() => {
    handlePaymentReturn();
    fetchSubscriptionData();
  }, []);

  const handlePaymentReturn = () => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get("payment");

    if (paymentStatus === "success") {
      setPaymentNotice({
        type: "success",
        message:
          "Payment successful. Your shared subscription is being updated for all clinic locations. Please refresh after a few seconds if the new plan does not appear immediately.",
      });

      window.history.replaceState({}, "", "/clinic-owner/subscription");
    }

    if (paymentStatus === "cancelled") {
      setPaymentNotice({
        type: "cancelled",
        message:
          "Payment was cancelled. No shared subscription changes were applied.",
      });

      window.history.replaceState({}, "", "/clinic-owner/subscription");
    }
  };

  const fetchSubscriptionData = async () => {
    try {
      setLoading(true);
      setError("");

      const [usageResponse, plansResponse, locationsResponse] =
        await Promise.all([
          API.get("/api/clinics/owner/usage"),
          API.get("/api/subscriptions/active-plans"),
          API.get("/api/clinics/owner/locations"),
        ]);

      const locations =
        locationsResponse.data.locations ||
        locationsResponse.data.clinics ||
        locationsResponse.data.clinic_locations ||
        [];

      setClinic(usageResponse.data.clinic || null);
      setUsage(usageResponse.data.usage || null);
      setPlans(plansResponse.data.plans || []);
      setClinicLocations(locations);
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

    return date.toLocaleDateString("en-PH", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
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

  const getExpirationWarning = (endDateValue, status) => {
    if (!endDateValue) return null;

    const endDate = new Date(endDateValue);
    const today = new Date();

    if (Number.isNaN(endDate.getTime())) return null;

    const differenceMs = endDate.getTime() - today.getTime();
    const days = Math.ceil(differenceMs / (1000 * 60 * 60 * 24));

    if (status === "Expired" || days < 0) {
      return {
        type: "expired",
        title: "Shared Subscription Expired",
        message:
          "The shared subscription for this Clinic Owner account has expired. Please renew or change the plan to continue full access across all clinic locations.",
      };
    }

    if (days === 0) {
      return {
        type: "warning",
        title: "Shared Subscription Expires Today",
        message:
          "The shared subscription expires today. Please renew or change the plan soon to avoid service interruption across all clinic locations.",
      };
    }

    if (days <= 7) {
      return {
        type: "warning",
        title: "Shared Subscription Expiring Soon",
        message: `The shared subscription will expire in ${days} day${
          days === 1 ? "" : "s"
        }. Please renew or change the plan soon.`,
      };
    }

    return null;
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
      `${formatLimit(plan.max_clinics)} clinic location limit`,
      `${formatLimit(plan.max_dentists)} dentist limit shared across locations`,
      `${formatLimit(plan.max_assistants)} assistant limit shared across locations`,
      `${formatLimit(plan.max_patients)} patient limit shared across locations`,
      `${formatLimit(plan.max_records)} dental record limit shared across locations`,
      `${formatLimit(plan.max_xrays)} X-ray limit shared across locations`,
      `${formatLimit(plan.storage_limit_mb)} MB storage shared across locations`,
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

    return `\n\nCurrent shared usage exceeding selected plan:\n- ${violations.join(
      "\n- ",
    )}`;
  };

  const handleChangePlan = async (plan) => {
    if (isCurrentPlan(plan)) return;

    if (Number(plan.price || 0) <= 0) {
      const confirmFreeChange = window.confirm(
        "This plan does not require checkout. The system will only allow this change if the shared usage across all clinic locations fits the selected plan limits. Continue?",
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
          response.data.message ||
            "Shared subscription plan changed successfully.",
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

  const renderLimitRow = (label, used, limit, helperText = "") => {
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

  const expirationWarning = getExpirationWarning(
    clinic?.subscription_end_date,
    clinic?.subscription_status,
  );

  const summaryCards = useMemo(() => {
    return [
      {
        label: "Clinic Locations",
        value: clinicLocations.length,
        description: "Locations sharing this subscription",
      },
      {
        label: "Shared Plan",
        value: clinic?.plan_name || "No Plan",
        description: clinic?.billing_cycle || "No billing cycle",
      },
      {
        label: "Subscription Status",
        value: clinic?.subscription_status || "Active",
        description: getDaysRemaining(clinic?.subscription_end_date),
      },
      {
        label: "Storage Used",
        value: `${usage?.storage_used_mb || 0} MB`,
        description: `Limit: ${formatLimit(clinic?.storage_limit_mb)} MB`,
      },
    ];
  }, [clinic, usage, clinicLocations.length]);

  return (
    <DashboardLayout role="Clinic Owner">
      <div className="appointments-list-card clinic-owner-subscription-page">
        <div className="appointments-header">
          <div>
            <h2>Shared Subscription</h2>
            <p>
              Manage the single subscription shared by all clinic locations
              under this Clinic Owner account.
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

        {paymentNotice && (
          <div
            className={
              paymentNotice.type === "success"
                ? "success-message"
                : "info-message"
            }
            style={{ marginBottom: "16px" }}
          >
            {paymentNotice.message}
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        {expirationWarning && !loading && clinic && (
          <div
            className={
              expirationWarning.type === "expired"
                ? "error-message"
                : "info-message"
            }
            style={{ marginBottom: "16px" }}
          >
            <strong>{expirationWarning.title}:</strong>{" "}
            {expirationWarning.message}
          </div>
        )}

        {loading ? (
          <div className="payment-loading-card">
            <p>Loading shared subscription details...</p>
          </div>
        ) : !clinic ? (
          <div className="empty-state">
            <h3>No subscription found</h3>
            <p>
              This account is not linked to a shared subscription. Please
              contact the system administrator.
            </p>
          </div>
        ) : (
          <>
            <div className="info-message">
              <strong>Important:</strong> This subscription applies to the
              entire Clinic Owner account, not just one branch. Plan limits are
              checked against the combined usage of all clinic locations.
            </div>

            <div className="staff-summary-grid">
              {summaryCards.map((card) => (
                <div className="staff-summary-card" key={card.label}>
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                  <p>{card.description}</p>
                </div>
              ))}
            </div>

            <div className="patient-dashboard-section">
              <div className="appointments-header">
                <div>
                  <h2>Subscription Period</h2>
                  <p>
                    These dates control subscription access for all clinic
                    locations under this account.
                  </p>
                </div>
              </div>

              <div className="appointment-item">
                <div className="appointment-info">
                  <div className="appointment-title-row">
                    <h3>{clinic.plan_name || "No Subscription Plan"}</h3>

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

            <div className="patient-dashboard-section">
              <div className="appointments-header">
                <div>
                  <h2>Shared Plan Details</h2>
                  <p>
                    These limits apply to the combined usage of all locations,
                    not to each location individually.
                  </p>
                </div>
              </div>

              <div className="appointment-item">
                <div className="appointment-info">
                  <div className="appointment-title-row">
                    <h3>{clinic.plan_name || "No Subscription Plan"}</h3>

                    <span
                      className={getSubscriptionStatusClass(
                        clinic.subscription_status,
                        clinic.subscription_end_date,
                      )}
                    >
                      {clinic.subscription_status === "Expired"
                        ? "Expired"
                        : clinic.plan_tier || "Active"}
                    </span>
                  </div>

                  <div className="subscription-detail-grid">
                    <p>
                      <strong>Price:</strong> {formatPrice(clinic.price)}
                    </p>

                    <p>
                      <strong>Billing Cycle:</strong>{" "}
                      {clinic.billing_cycle || "N/A"}
                    </p>

                    <p>
                      <strong>Max Clinic Locations:</strong>{" "}
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
                      <strong>Max X-rays:</strong>{" "}
                      {formatLimit(clinic.max_xrays)}
                    </p>

                    <p>
                      <strong>Storage Limit:</strong>{" "}
                      {formatLimit(clinic.storage_limit_mb)} MB
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="patient-dashboard-section">
              <div className="appointments-header">
                <div>
                  <h2>Aggregate Usage</h2>
                  <p>
                    These totals combine all clinic locations under this Clinic
                    Owner account.
                  </p>
                </div>
              </div>

              <div className="appointments-list">
                {renderLimitRow(
                  "Clinic Locations",
                  clinicLocations.length,
                  clinic.max_clinics,
                  "Total branches under this Clinic Owner account.",
                )}

                {renderLimitRow(
                  "Dentists",
                  usage?.dentists || 0,
                  clinic.max_dentists,
                  "Dentist accounts across all locations.",
                )}

                {renderLimitRow(
                  "Dental Assistants",
                  usage?.assistants || 0,
                  clinic.max_assistants,
                  "Dental assistant accounts across all locations.",
                )}

                {renderLimitRow(
                  "Patients",
                  usage?.patients || 0,
                  clinic.max_patients,
                  "Patients assigned across all locations.",
                )}

                {renderLimitRow(
                  "Dental Records",
                  usage?.records || 0,
                  clinic.max_records,
                  "Dental records created across all locations.",
                )}

                {renderLimitRow(
                  "X-rays",
                  usage?.xrays || 0,
                  clinic.max_xrays,
                  "X-ray files uploaded across all locations.",
                )}

                {renderLimitRow(
                  "Storage Used",
                  usage?.storage_used_mb || 0,
                  clinic.storage_limit_mb,
                  "Total X-ray storage used across all locations.",
                )}
              </div>
            </div>

            <div className="patient-dashboard-section">
              <div className="appointments-header">
                <div>
                  <h2>Available Subscription Plans</h2>
                  <p>
                    Changing a plan affects every clinic location under this
                    Clinic Owner account. Checkout is blocked if the combined
                    usage does not fit the selected plan.
                  </p>
                </div>
              </div>

              {plans.length === 0 ? (
                <div className="empty-state">
                  <h3>No active plans</h3>
                  <p>No active subscription plans are available right now.</p>
                </div>
              ) : (
                <div className="patient-quick-action-grid subscription-plan-grid">
                  {plans.map((plan) => {
                    const current = isCurrentPlan(plan);
                    const features = getPlanFeatures(plan);
                    const changeType = getPlanChangeType(plan);

                    return (
                      <div
                        className="patient-quick-action-card subscription-plan-card"
                        key={plan.plan_id}
                      >
                        <div>
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
                                : "Change Shared Plan"}
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
