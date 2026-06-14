import React, { useEffect, useState } from "react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import API from "../api/axios";
import { useNavigate } from "react-router-dom";

function ClinicOwnerPayments() {
  const navigate = useNavigate();

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      const response = await API.get("/api/payments/my-payments");

      setPayments(response.data.payments || []);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load payment history.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelPayment = async (paymentId) => {
    const confirmCancel = window.confirm(
      "Are you sure you want to cancel this pending payment record?",
    );

    if (!confirmCancel) return;

    try {
      setCancellingId(paymentId);
      setError("");
      setMessage("");

      const response = await API.put(`/api/payments/cancel/${paymentId}`);

      setMessage(
        response.data.message || "Pending payment cancelled successfully.",
      );

      fetchPayments();
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to cancel pending payment.",
      );
    } finally {
      setCancellingId(null);
    }
  };

  const formatPrice = (amount) => {
    const value = Number(amount || 0);

    return `₱${value.toLocaleString("en-PH", {
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

  const getStatusClass = (status) => {
    if (status === "Paid") return "status-badge status-completed";
    if (status === "Pending") return "status-badge status-pending";
    if (status === "Cancelled") return "status-badge status-cancelled";
    if (status === "Failed") return "status-badge status-cancelled";

    return "status-badge status-scheduled";
  };

  return (
    <DashboardLayout role="Clinic Owner">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>Payment History</h2>
            <p>View your clinic subscription payment records.</p>
          </div>

          <div className="appointment-actions" style={{ flexDirection: "row" }}>
            <button
              className="secondary-button"
              onClick={() => navigate("/clinic-owner/subscription")}
            >
              Back to Subscription
            </button>

            <button
              className="secondary-button"
              onClick={fetchPayments}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}

        {loading ? (
          <p>Loading payment history...</p>
        ) : payments.length === 0 ? (
          <div className="empty-state">
            <h3>No payments yet</h3>
            <p>Your subscription payments will appear here.</p>
          </div>
        ) : (
          <div className="appointments-list">
            {payments.map((payment) => (
              <div className="appointment-item" key={payment.payment_id}>
                <div className="appointment-info">
                  <div className="appointment-title-row">
                    <h3>{payment.plan_name || "Subscription Payment"}</h3>

                    <span className={getStatusClass(payment.status)}>
                      {payment.status || "Pending"}
                    </span>
                  </div>

                  <p>
                    <strong>Clinic:</strong> {payment.clinic_name || "N/A"}
                  </p>

                  <p>
                    <strong>Amount:</strong> {formatPrice(payment.amount)}
                  </p>

                  <p>
                    <strong>Currency:</strong> {payment.currency || "PHP"}
                  </p>

                  <p>
                    <strong>Billing Cycle:</strong>{" "}
                    {payment.billing_cycle || "N/A"}
                  </p>

                  <p>
                    <strong>Created At:</strong>{" "}
                    {formatDate(payment.created_at)}
                  </p>

                  <p>
                    <strong>Paid At:</strong> {formatDate(payment.paid_at)}
                  </p>

                  <p>
                    <strong>Checkout Session:</strong>{" "}
                    {payment.checkout_session_id || "N/A"}
                  </p>
                </div>

                {payment.status === "Pending" && (
                  <div className="appointment-actions">
                    {payment.checkout_url && (
                      <button
                        className="primary-button"
                        onClick={() =>
                          (window.location.href = payment.checkout_url)
                        }
                      >
                        Continue Payment
                      </button>
                    )}

                    <button
                      className="danger-button"
                      onClick={() => handleCancelPayment(payment.payment_id)}
                      disabled={cancellingId === payment.payment_id}
                    >
                      {cancellingId === payment.payment_id
                        ? "Cancelling..."
                        : "Cancel Payment"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default ClinicOwnerPayments;
