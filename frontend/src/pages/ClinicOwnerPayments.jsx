import React, { useEffect, useMemo, useState } from "react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import API from "../api/axios";
import { useNavigate } from "react-router-dom";

function ClinicOwnerPayments() {
  const navigate = useNavigate();

  const [payments, setPayments] = useState([]);
  const [clinicLocations, setClinicLocations] = useState([]);

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

      const [paymentsResponse, locationsResponse] = await Promise.all([
        API.get("/api/payments/my-payments"),
        API.get("/api/clinics/owner/locations"),
      ]);

      const locations =
        locationsResponse.data.locations ||
        locationsResponse.data.clinics ||
        locationsResponse.data.clinic_locations ||
        [];

      setPayments(paymentsResponse.data.payments || []);
      setClinicLocations(locations);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load payment history.");
      setClinicLocations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelPayment = async (paymentId) => {
    const confirmCancel = window.confirm(
      "Are you sure you want to cancel this pending shared subscription payment record?",
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

    return date.toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusClass = (status) => {
    if (status === "Paid") return "status-badge status-completed";
    if (status === "Pending") return "status-badge status-pending";
    if (status === "Cancelled") return "status-badge status-cancelled";
    if (status === "Failed") return "status-badge status-cancelled";

    return "status-badge status-scheduled";
  };

  const countByStatus = (status) => {
    return payments.filter((payment) => payment.status === status).length;
  };

  const totalPaidAmount = payments
    .filter((payment) => payment.status === "Paid")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  const latestPayment = useMemo(() => {
    return [...payments].sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();

      return dateB - dateA;
    })[0];
  }, [payments]);

  const paidPayments = countByStatus("Paid");
  const pendingPayments = countByStatus("Pending");
  const failedOrCancelledPayments =
    countByStatus("Failed") + countByStatus("Cancelled");

  return (
    <DashboardLayout role="Clinic Owner">
      <div className="appointments-list-card clinic-owner-payments-page">
        <div className="appointments-header">
          <div>
            <h2>Shared Subscription Payments</h2>
            <p>
              Review payment records for the Clinic Owner account. Payments
              apply to the shared subscription used by all clinic locations.
            </p>
          </div>

          <div className="appointment-actions" style={{ flexDirection: "row" }}>
            <button
              className="secondary-button"
              onClick={() => navigate("/clinic-owner/subscription")}
              disabled={loading}
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

        <div className="info-message">
          <strong>Shared payment scope:</strong> A completed payment updates the
          Clinic Owner subscription and should apply across all linked clinic
          locations, not just one branch.
        </div>

        <div className="payment-section">
          <div className="appointments-header">
            <div>
              <h2>Payment Summary</h2>
              <p>
                Quick overview of payment activity for the shared subscription.
              </p>
            </div>
          </div>

          <div className="payment-summary-grid">
            <div className="payment-summary-card">
              <span>Clinic Locations</span>
              <strong>{clinicLocations.length}</strong>
              <p>Using the shared subscription</p>
            </div>

            <div className="payment-summary-card">
              <span>Total Records</span>
              <strong>{payments.length}</strong>
              <p>All payment records</p>
            </div>

            <div className="payment-summary-card">
              <span>Paid</span>
              <strong>{paidPayments}</strong>
              <p>Successfully completed</p>
            </div>

            <div className="payment-summary-card">
              <span>Pending</span>
              <strong>{pendingPayments}</strong>
              <p>Awaiting checkout or confirmation</p>
            </div>

            <div className="payment-summary-card">
              <span>Failed / Cancelled</span>
              <strong>{failedOrCancelledPayments}</strong>
              <p>Not completed</p>
            </div>

            <div className="payment-summary-card">
              <span>Total Paid</span>
              <strong>{formatPrice(totalPaidAmount)}</strong>
              <p>Confirmed paid amount</p>
            </div>
          </div>
        </div>

        {latestPayment && (
          <div className="payment-section">
            <div className="appointments-header">
              <div>
                <h2>Latest Payment</h2>
                <p>Most recent shared subscription payment record.</p>
              </div>
            </div>

            <div className="payment-latest-card">
              <div>
                <span>Plan</span>
                <strong>
                  {latestPayment.plan_name || "Subscription Plan"}
                </strong>
              </div>

              <div>
                <span>Amount</span>
                <strong>{formatPrice(latestPayment.amount)}</strong>
              </div>

              <div>
                <span>Status</span>
                <strong>
                  <span className={getStatusClass(latestPayment.status)}>
                    {latestPayment.status || "Pending"}
                  </span>
                </strong>
              </div>

              <div>
                <span>Created</span>
                <strong>{formatDate(latestPayment.created_at)}</strong>
              </div>
            </div>
          </div>
        )}

        <div className="payment-section">
          <div className="appointments-header">
            <div>
              <h2>Payment History</h2>
              <p>Detailed list of shared subscription payment transactions.</p>
            </div>
          </div>

          {loading ? (
            <div className="payment-loading-card">
              <p>Loading payment history...</p>
            </div>
          ) : payments.length === 0 ? (
            <div className="empty-state">
              <h3>No payments yet</h3>
              <p>Your shared subscription payments will appear here.</p>
            </div>
          ) : (
            <div className="payment-table-wrapper">
              <table className="payment-table">
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th>Applied Scope</th>
                    <th>Amount</th>
                    <th>Billing Cycle</th>
                    <th>Status</th>
                    <th>Created At</th>
                    <th>Paid At</th>
                    <th>Checkout Session</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.payment_id}>
                      <td>
                        <strong>{payment.plan_name || "Subscription"}</strong>
                      </td>

                      <td>
                        <span className="payment-scope-text">
                          Shared account
                          {payment.clinic_name
                            ? ` (${payment.clinic_name})`
                            : ""}
                        </span>
                      </td>

                      <td>{formatPrice(payment.amount)}</td>

                      <td>{payment.billing_cycle || "N/A"}</td>

                      <td>
                        <span className={getStatusClass(payment.status)}>
                          {payment.status || "Pending"}
                        </span>
                      </td>

                      <td>{formatDate(payment.created_at)}</td>

                      <td>{formatDate(payment.paid_at)}</td>

                      <td>
                        <span className="payment-session-text">
                          {payment.checkout_session_id || "N/A"}
                        </span>
                      </td>

                      <td>
                        {payment.status === "Pending" ? (
                          <div className="payment-table-actions">
                            {payment.checkout_url && (
                              <button
                                className="primary-button"
                                onClick={() =>
                                  (window.location.href = payment.checkout_url)
                                }
                              >
                                Continue
                              </button>
                            )}

                            <button
                              className="danger-button"
                              onClick={() =>
                                handleCancelPayment(payment.payment_id)
                              }
                              disabled={cancellingId === payment.payment_id}
                            >
                              {cancellingId === payment.payment_id
                                ? "Cancelling..."
                                : "Cancel"}
                            </button>
                          </div>
                        ) : (
                          <span className="muted-text">No action</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default ClinicOwnerPayments;
