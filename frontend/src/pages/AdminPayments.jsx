import React, { useEffect, useState } from "react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import API from "../api/axios";
import { useNavigate } from "react-router-dom";

function AdminPayments() {
  const navigate = useNavigate();

  const [payments, setPayments] = useState([]);
  const [filteredPayments, setFilteredPayments] = useState([]);

  const [statusFilter, setStatusFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");

  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchPayments();
  }, []);

  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payments, statusFilter, searchTerm]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      const response = await API.get("/api/payments/admin/all-payments");

      setPayments(response.data.payments || []);
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to load admin payment records.",
      );
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let result = [...payments];

    if (statusFilter !== "All") {
      result = result.filter((payment) => payment.status === statusFilter);
    }

    if (searchTerm.trim()) {
      const keyword = searchTerm.trim().toLowerCase();

      result = result.filter((payment) => {
        return (
          String(payment.payment_id || "")
            .toLowerCase()
            .includes(keyword) ||
          String(payment.clinic_name || "")
            .toLowerCase()
            .includes(keyword) ||
          String(payment.owner_name || "")
            .toLowerCase()
            .includes(keyword) ||
          String(payment.owner_email || "")
            .toLowerCase()
            .includes(keyword) ||
          String(payment.plan_name || "")
            .toLowerCase()
            .includes(keyword) ||
          String(payment.billing_cycle || "")
            .toLowerCase()
            .includes(keyword) ||
          String(payment.checkout_session_id || "")
            .toLowerCase()
            .includes(keyword)
        );
      });
    }

    setFilteredPayments(result);
  };

  const handleManualConfirm = async (paymentId) => {
    const confirmAction = window.confirm(
      "Manually confirm this payment? Use this only as an admin backup if the webhook did not process the payment.",
    );

    if (!confirmAction) return;

    try {
      setConfirmingId(paymentId);
      setError("");
      setMessage("");

      const response = await API.put(
        `/api/payments/manual-confirm/${paymentId}`,
      );

      setMessage(response.data.message || "Payment manually confirmed.");
      fetchPayments();
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to manually confirm payment.",
      );
    } finally {
      setConfirmingId(null);
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

  const cancelledOrFailedCount = payments.filter(
    (payment) => payment.status === "Cancelled" || payment.status === "Failed",
  ).length;

  return (
    <DashboardLayout role="Admin">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>Payment Monitoring</h2>
            <p>
              View all clinic subscription payments, checkout sessions, payment
              statuses, and admin backup confirmation actions.
            </p>
          </div>

          <div className="appointment-actions" style={{ flexDirection: "row" }}>
            <button
              className="secondary-button"
              onClick={() => navigate("/admin/dashboard")}
              disabled={loading}
            >
              Back to Dashboard
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

        <div className="payment-section">
          <div className="appointments-header">
            <div>
              <h2>Payment Summary</h2>
              <p>System-wide payment overview for clinic subscriptions.</p>
            </div>
          </div>

          <div className="payment-summary-grid admin-payment-summary-grid">
            <div className="payment-summary-card">
              <span>Total Paid Revenue</span>
              <strong>{formatPrice(totalPaidAmount)}</strong>
              <p>Confirmed paid amount</p>
            </div>

            <div className="payment-summary-card">
              <span>Total Records</span>
              <strong>{payments.length}</strong>
              <p>All payment records</p>
            </div>

            <div className="payment-summary-card">
              <span>Paid Payments</span>
              <strong>{countByStatus("Paid")}</strong>
              <p>Successfully completed</p>
            </div>

            <div className="payment-summary-card">
              <span>Pending Payments</span>
              <strong>{countByStatus("Pending")}</strong>
              <p>Awaiting checkout or webhook</p>
            </div>

            <div className="payment-summary-card">
              <span>Cancelled / Failed</span>
              <strong>{cancelledOrFailedCount}</strong>
              <p>Unsuccessful payment records</p>
            </div>
          </div>
        </div>

        <div className="payment-section">
          <div className="appointments-header">
            <div>
              <h2>Payment Filters</h2>
              <p>
                Search by payment ID, clinic, owner, email, plan, or checkout.
              </p>
            </div>
          </div>

          <div className="payment-filter-card">
            <div className="appointment-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    disabled={loading}
                  >
                    <option value="All">All</option>
                    <option value="Paid">Paid</option>
                    <option value="Pending">Pending</option>
                    <option value="Cancelled">Cancelled</option>
                    <option value="Failed">Failed</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Search</label>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search clinic, owner, email, plan, payment ID..."
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label>Visible Records</label>
                  <input
                    type="text"
                    value={`${filteredPayments.length} of ${payments.length}`}
                    disabled
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="payment-section">
          <div className="appointments-header">
            <div>
              <h2>Payment Records</h2>
              <p>Detailed table of all clinic subscription payment records.</p>
            </div>
          </div>

          {loading ? (
            <div className="payment-loading-card">
              <p>Loading payment records...</p>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="empty-state">
              <h3>No payments found</h3>
              <p>No payment records match your current filters.</p>
            </div>
          ) : (
            <div className="payment-table-wrapper">
              <table className="payment-table">
                <thead>
                  <tr>
                    <th>Payment ID</th>
                    <th>Clinic</th>
                    <th>Owner</th>
                    <th>Email</th>
                    <th>Plan</th>
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
                  {filteredPayments.map((payment) => (
                    <tr key={payment.payment_id}>
                      <td>
                        <strong>{payment.payment_id}</strong>
                      </td>

                      <td>{payment.clinic_name || "N/A"}</td>

                      <td>{payment.owner_name || "N/A"}</td>

                      <td>
                        <span className="payment-session-text">
                          {payment.owner_email || "N/A"}
                        </span>
                      </td>

                      <td>{payment.plan_name || "Subscription"}</td>

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
                                className="secondary-button"
                                onClick={() =>
                                  (window.location.href = payment.checkout_url)
                                }
                              >
                                Checkout
                              </button>
                            )}

                            <button
                              className="primary-button"
                              onClick={() =>
                                handleManualConfirm(payment.payment_id)
                              }
                              disabled={confirmingId === payment.payment_id}
                            >
                              {confirmingId === payment.payment_id
                                ? "Confirming..."
                                : "Confirm"}
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

export default AdminPayments;
