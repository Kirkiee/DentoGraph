import React, { useEffect, useState } from "react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import API from "../api/axios";
import { useNavigate } from "react-router-dom";

function ClinicOwnerPaymentSuccess() {
  const navigate = useNavigate();

  const [clinic, setClinic] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUpdatedClinic();
  }, []);

  const fetchUpdatedClinic = async () => {
    try {
      setLoading(true);

      const response = await API.get("/api/clinics/owner/my-clinic");

      setClinic(response.data.clinic || null);
    } catch (err) {
      console.error("Payment success clinic fetch error:", err);
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

        <div className="success-message">
          Your payment was completed successfully. Your subscription upgrade has
          been processed.
        </div>

        {loading ? (
          <p>Loading updated clinic details...</p>
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
                <strong>Billing Cycle:</strong> {clinic?.billing_cycle || "N/A"}
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
