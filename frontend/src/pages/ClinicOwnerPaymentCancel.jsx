import React from "react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import { useNavigate } from "react-router-dom";

function ClinicOwnerPaymentCancel() {
  const navigate = useNavigate();

  return (
    <DashboardLayout role="Clinic Owner">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>Payment Cancelled</h2>
            <p>Your checkout was cancelled before payment was completed.</p>
          </div>
        </div>

        <div className="error-message">
          No payment was completed, and your clinic subscription was not
          upgraded.
        </div>

        <div className="appointment-item">
          <div className="appointment-info">
            <h3>What happened?</h3>
            <p>
              You returned from PayMongo without completing the payment. Your
              current subscription plan is still active.
            </p>

            <p>
              You may go back to the subscription page and try upgrading again.
              Any pending checkout records can still appear in your payment
              history.
            </p>
          </div>
        </div>

        <div className="appointment-actions" style={{ marginTop: "18px" }}>
          <button
            className="primary-button"
            onClick={() => navigate("/clinic-owner/subscription")}
          >
            Back to Subscription
          </button>

          <button
            className="secondary-button"
            onClick={() => navigate("/clinic-owner/payments")}
          >
            View Payment History
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default ClinicOwnerPaymentCancel;
