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
      const keyword = searchTerm.toLowerCase();

      result = result.filter((payment) => {
        return (
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

    return date.toLocaleString();
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

  return (
    <DashboardLayout role="Admin">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>Payment Monitoring</h2>
            <p>
              View all clinic subscription payments, checkout sessions, and
              payment statuses.
            </p>
          </div>

          <div className="appointment-actions" style={{ flexDirection: "row" }}>
            <button
              className="secondary-button"
              onClick={() => navigate("/admin/dashboard")}
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

        <div className="report-section">
          <div className="appointments-list">
            <div className="appointment-item">
              <div className="appointment-info">
                <h3>Total Paid Revenue</h3>
                <p>{formatPrice(totalPaidAmount)}</p>
              </div>
            </div>

            <div className="appointment-item">
              <div className="appointment-info">
                <h3>Paid Payments</h3>
                <p>{countByStatus("Paid")}</p>
              </div>
            </div>

            <div className="appointment-item">
              <div className="appointment-info">
                <h3>Pending Payments</h3>
                <p>{countByStatus("Pending")}</p>
              </div>
            </div>

            <div className="appointment-item">
              <div className="appointment-info">
                <h3>Cancelled Payments</h3>
                <p>{countByStatus("Cancelled")}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="report-section">
          <div className="appointments-header">
            <div>
              <h2>Filters</h2>
              <p>Search by clinic, owner, email, plan, or checkout session.</p>
            </div>
          </div>

          <div className="appointment-form">
            <div className="form-row">
              <div className="form-group">
                <label>Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
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
                  placeholder="Search clinic, owner, email, plan..."
                />
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <p>Loading payment records...</p>
        ) : filteredPayments.length === 0 ? (
          <div className="empty-state">
            <h3>No payments found</h3>
            <p>No payment records match your current filters.</p>
          </div>
        ) : (
          <div className="appointments-list">
            {filteredPayments.map((payment) => (
              <div className="appointment-item" key={payment.payment_id}>
                <div className="appointment-info">
                  <div className="appointment-title-row">
                    <h3>{payment.plan_name || "Subscription Payment"}</h3>

                    <span className={getStatusClass(payment.status)}>
                      {payment.status || "Pending"}
                    </span>
                  </div>

                  <p>
                    <strong>Payment ID:</strong> {payment.payment_id}
                  </p>

                  <p>
                    <strong>Clinic:</strong> {payment.clinic_name || "N/A"}
                  </p>

                  <p>
                    <strong>Owner:</strong> {payment.owner_name || "N/A"}
                  </p>

                  <p>
                    <strong>Owner Email:</strong> {payment.owner_email || "N/A"}
                  </p>

                  <p>
                    <strong>Amount:</strong> {formatPrice(payment.amount)}
                  </p>

                  <p>
                    <strong>Billing Cycle:</strong>{" "}
                    {payment.billing_cycle || "N/A"}
                  </p>

                  <p>
                    <strong>Checkout Session:</strong>{" "}
                    {payment.checkout_session_id || "N/A"}
                  </p>

                  <p>
                    <strong>Created At:</strong>{" "}
                    {formatDate(payment.created_at)}
                  </p>

                  <p>
                    <strong>Paid At:</strong> {formatDate(payment.paid_at)}
                  </p>
                </div>

                <div className="appointment-actions">
                  {payment.status === "Pending" && (
                    <>
                      {payment.checkout_url && (
                        <button
                          className="secondary-button"
                          onClick={() =>
                            (window.location.href = payment.checkout_url)
                          }
                        >
                          Open Checkout
                        </button>
                      )}

                      <button
                        className="primary-button"
                        onClick={() => handleManualConfirm(payment.payment_id)}
                        disabled={confirmingId === payment.payment_id}
                      >
                        {confirmingId === payment.payment_id
                          ? "Confirming..."
                          : "Manual Confirm"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default AdminPayments;
