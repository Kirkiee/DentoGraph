import React, { useEffect, useState } from "react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import API from "../api/axios";
import { useNavigate } from "react-router-dom";

function ClinicOwnerPaymentSuccess() {
  const navigate = useNavigate();

  const [clinic, setClinic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    fetchUpdatedClinic();
  }, []);

  const fetchUpdatedClinic = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const response = await API.get("/api/clinics/owner/my-clinic");

      setClinic(response.data.clinic || null);
    } catch (err) {
      console.error("Payment success clinic fetch error:", err);
      setErrorMessage(
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Payment was successful, but the updated clinic details could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout role="Clinic Owner">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>Payment Successful</h2>
            <p>Your checkout has been completed.</p>
          </div>
        </div>

        <div
          className="success-message"
          style={{
            marginBottom: "18px",
            padding: "14px 16px",
            borderRadius: "14px",
            background: "rgba(72, 187, 120, 0.14)",
            border: "1px solid rgba(72, 187, 120, 0.35)",
            color: "#9ae6b4",
            fontWeight: "700",
          }}
        >
          Your payment was completed successfully. Your subscription upgrade has
          been processed.
        </div>

        {loading ? (
          <div className="appointment-item">
            <div className="appointment-info">
              <p>Loading updated clinic details...</p>
            </div>
          </div>
        ) : errorMessage ? (
          <div
            className="appointment-item"
            style={{
              borderColor: "rgba(245, 101, 101, 0.4)",
            }}
          >
            <div className="appointment-info">
              <h3>Unable to load updated clinic details</h3>
              <p>{errorMessage}</p>
              <p>
                You may still go back to the subscription page to check your
                current plan.
              </p>
            </div>
          </div>
        ) : (
          <div className="appointment-item">
            <div className="appointment-info">
              <div className="appointment-title-row">
                <h3>{clinic?.clinic_name || "Your Clinic"}</h3>

                <span className="status-badge status-completed">
                  {clinic?.plan_name || "Updated Plan"}
                </span>
              </div>

              <p>
                <strong>Current Plan:</strong> {clinic?.plan_name || "N/A"}
              </p>

              <p>
                <strong>Plan Tier:</strong> {clinic?.plan_tier || "N/A"}
              </p>

              <p>
                <strong>Billing Cycle:</strong>{" "}
                {clinic?.billing_cycle || "N/A"}
              </p>

              <p>
                <strong>Storage Limit:</strong>{" "}
                {clinic?.storage_limit_mb || "N/A"} MB
              </p>
            </div>
          </div>
        )}

        <div className="appointment-actions" style={{ marginTop: "18px" }}>
          <button
            className="primary-button"
            onClick={() => navigate("/clinic-owner/subscription")}
          >
            View Subscription
          </button>

          <button
            className="secondary-button"
            onClick={() => navigate("/clinic-owner/dashboard")}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default ClinicOwnerPaymentSuccess;