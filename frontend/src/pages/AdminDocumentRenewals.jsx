import React, { useEffect, useState } from "react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import API from "../api/axios";

function AdminDocumentRenewals() {
  const [renewals, setRenewals] = useState([]);
  const [statusFilter, setStatusFilter] = useState("Pending");
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState(null);
  const [openingDocument, setOpeningDocument] = useState("");
  const [selectedRenewal, setSelectedRenewal] = useState(null);
  const [decision, setDecision] = useState("Approved");
  const [rejectionReason, setRejectionReason] = useState("");
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");

  const fetchRenewals = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await API.get("/api/clinics/admin/document-renewals", {
        params: { status: statusFilter },
      });
      setRenewals(
        Array.isArray(response.data?.renewals) ? response.data.renewals : [],
      );
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to load document renewals.",
      );
      setRenewals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRenewals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const formatDate = (value, includeTime = false) => {
    if (!value) return "N/A";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "N/A";
    return date.toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "short",
      day: "2-digit",
      ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    });
  };

  const getStatusClass = (status) => {
    if (status === "Approved") return "status-badge status-completed";
    if (status === "Rejected") return "status-badge status-cancelled";
    return "status-badge status-pending";
  };

  const openDocument = async (renewal, version) => {
    const key = `${renewal.renewal_id}-${version}`;
    try {
      setOpeningDocument(key);
      setError("");
      const response = await API.get(
        `/api/clinics/admin/document-renewals/${renewal.renewal_id}/document/${version}`,
        { responseType: "blob" },
      );
      const blobUrl = URL.createObjectURL(response.data);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (err) {
      setError(
        err.response?.data?.error || `Unable to open the ${version} document.`,
      );
    } finally {
      setOpeningDocument("");
    }
  };

  const openReviewModal = (renewal, selectedDecision) => {
    setSelectedRenewal(renewal);
    setDecision(selectedDecision);
    setRejectionReason("");
    setModalError("");
    setShowReviewModal(true);
  };

  const closeReviewModal = () => {
    if (reviewingId) return;
    setShowReviewModal(false);
    setSelectedRenewal(null);
    setRejectionReason("");
    setModalError("");
  };

  const submitReview = async (event) => {
    event.preventDefault();
    if (!selectedRenewal) return;
    const cleanReason = rejectionReason.trim();
    if (decision === "Rejected" && cleanReason.length < 5) {
      setModalError("Enter a rejection reason with at least 5 characters.");
      return;
    }

    try {
      setReviewingId(selectedRenewal.renewal_id);
      setModalError("");
      const response = await API.put(
        `/api/clinics/admin/document-renewals/${selectedRenewal.renewal_id}/review`,
        {
          decision,
          rejection_reason: decision === "Rejected" ? cleanReason : null,
        },
      );
      setMessage(
        response.data?.message || "Document renewal reviewed successfully.",
      );
      closeReviewModal();
      await fetchRenewals();
    } catch (err) {
      setModalError(
        err.response?.data?.error || "Unable to review this renewal.",
      );
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <DashboardLayout role="Admin">
      <div className="appointments-list-card admin-document-renewals-page">
        <div className="appointments-header">
          <div>
            <h2>Verification Document Renewals</h2>
            <p>
              Compare the currently approved document with the replacement
              before approving or rejecting the renewal request.
            </p>
          </div>
          <button
            className="secondary-button"
            onClick={fetchRenewals}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}

        <div className="admin-renewal-filter-card">
          <div className="form-group">
            <label>Status</label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Cancelled">Cancelled</option>
              <option value="All">All</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">
            Loading document renewal requests...
          </div>
        ) : renewals.length === 0 ? (
          <div className="empty-state">
            No document renewal requests match this filter.
          </div>
        ) : (
          <div className="admin-renewal-list">
            {renewals.map((renewal) => (
              <article className="admin-renewal-card" key={renewal.renewal_id}>
                <div className="admin-renewal-card-header">
                  <div>
                    <h3>{renewal.document_label}</h3>
                    <p>
                      {renewal.clinic_name} · {renewal.owner_name}
                    </p>
                  </div>
                  <span className={getStatusClass(renewal.status)}>
                    {renewal.status}
                  </span>
                </div>

                <div className="admin-renewal-summary-grid">
                  <div>
                    <span>Current Expiration</span>
                    <strong>
                      {formatDate(renewal.previous_expiration_date)}
                    </strong>
                  </div>
                  <div>
                    <span>Proposed Expiration</span>
                    <strong>
                      {formatDate(renewal.proposed_expiration_date)}
                    </strong>
                  </div>
                  <div>
                    <span>Submitted</span>
                    <strong>{formatDate(renewal.submitted_at, true)}</strong>
                  </div>
                  <div>
                    <span>Owner Email</span>
                    <strong>{renewal.owner_email}</strong>
                  </div>
                </div>

                {renewal.owner_remarks && (
                  <div className="info-message">
                    <strong>Owner remarks:</strong> {renewal.owner_remarks}
                  </div>
                )}

                {renewal.rejection_reason && (
                  <div className="error-message">
                    <strong>Rejection reason:</strong>{" "}
                    {renewal.rejection_reason}
                  </div>
                )}

                <div className="admin-renewal-actions">
                  <button
                    className="secondary-button"
                    onClick={() => openDocument(renewal, "current")}
                    disabled={
                      openingDocument === `${renewal.renewal_id}-current`
                    }
                  >
                    {openingDocument === `${renewal.renewal_id}-current`
                      ? "Opening..."
                      : "Open Current Document"}
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => openDocument(renewal, "replacement")}
                    disabled={
                      openingDocument === `${renewal.renewal_id}-replacement`
                    }
                  >
                    {openingDocument === `${renewal.renewal_id}-replacement`
                      ? "Opening..."
                      : "Open Replacement"}
                  </button>
                  {renewal.status === "Pending" && (
                    <>
                      <button
                        className="primary-button"
                        onClick={() => openReviewModal(renewal, "Approved")}
                      >
                        Approve
                      </button>
                      <button
                        className="danger-button"
                        onClick={() => openReviewModal(renewal, "Rejected")}
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        {showReviewModal && selectedRenewal && (
          <div className="modal-overlay">
            <div className="modal-card admin-document-renewal-review-modal">
              <div className="modal-header">
                <div>
                  <h3>
                    {decision === "Approved"
                      ? "Approve Document Renewal"
                      : "Reject Document Renewal"}
                  </h3>
                  <p>
                    {selectedRenewal.document_label} ·{" "}
                    {selectedRenewal.clinic_name}
                  </p>
                </div>
                <button
                  type="button"
                  className="modal-close-button"
                  onClick={closeReviewModal}
                  disabled={Boolean(reviewingId)}
                >
                  ×
                </button>
              </div>

              <form onSubmit={submitReview}>
                {decision === "Approved" ? (
                  <div className="info-message">
                    Approval replaces the active verification document and
                    official expiration date. The previous approved file remains
                    archived in the renewal history.
                  </div>
                ) : (
                  <div className="form-group">
                    <label>Rejection Reason *</label>
                    <textarea
                      value={rejectionReason}
                      onChange={(event) =>
                        setRejectionReason(event.target.value)
                      }
                      rows={4}
                      minLength={5}
                      maxLength={1000}
                      required
                      disabled={Boolean(reviewingId)}
                    />
                  </div>
                )}

                {modalError && (
                  <div className="error-message">{modalError}</div>
                )}

                <div className="modal-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={closeReviewModal}
                    disabled={Boolean(reviewingId)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={
                      decision === "Approved"
                        ? "primary-button"
                        : "danger-button"
                    }
                    disabled={Boolean(reviewingId)}
                  >
                    {reviewingId
                      ? "Saving Review..."
                      : decision === "Approved"
                        ? "Confirm Approval"
                        : "Confirm Rejection"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default AdminDocumentRenewals;
