import React, { useEffect, useMemo, useState } from "react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import API from "../api/axios";

function AdminStaffCredentials() {
  const [applications, setApplications] = useState([]);
  const [statusFilter, setStatusFilter] = useState("Pending");
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState(null);
  const [openingDocument, setOpeningDocument] = useState("");
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [decision, setDecision] = useState("Approved");
  const [rejectionReason, setRejectionReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const token = localStorage.getItem("token");

  const filteredCount = useMemo(() => applications.length, [applications]);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await API.get("/api/users/admin/staff-credentials", {
        params: { status: statusFilter },
      });

      setApplications(response.data?.applications || []);
    } catch (err) {
      setApplications([]);
      setError(
        err.response?.data?.error ||
          "Unable to load staff credential applications.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const formatDate = (value) => {
    if (!value) return "N/A";

    return new Date(value).toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const openDocument = async (application, documentType) => {
    const documentKey = `${application.credential_id}-${documentType}`;

    try {
      setOpeningDocument(documentKey);
      setError("");

      const response = await API.get(
        `/api/users/admin/staff-credentials/${application.credential_id}/document/${documentType}`,
        {
          responseType: "blob",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const objectUrl = URL.createObjectURL(response.data);
      window.open(objectUrl, "_blank", "noopener,noreferrer");

      window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 60000);
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to open the credential document.",
      );
    } finally {
      setOpeningDocument("");
    }
  };

  const openReviewModal = (application, nextDecision) => {
    setSelectedApplication(application);
    setDecision(nextDecision);
    setRejectionReason("");
    setMessage("");
    setError("");
  };

  const closeReviewModal = () => {
    if (reviewingId) return;

    setSelectedApplication(null);
    setDecision("Approved");
    setRejectionReason("");
  };

  const submitReview = async (event) => {
    event.preventDefault();

    if (!selectedApplication) return;

    if (decision === "Rejected" && !rejectionReason.trim()) {
      setError("Enter the reason for rejecting the credentials.");
      return;
    }

    try {
      setReviewingId(selectedApplication.credential_id);
      setMessage("");
      setError("");

      const response = await API.put(
        `/api/users/admin/staff-credentials/${selectedApplication.credential_id}/review`,
        {
          decision,
          rejection_reason:
            decision === "Rejected" ? rejectionReason.trim() : null,
        },
      );

      setMessage(response.data?.message || "Credential review saved.");
      closeReviewModal();
      await fetchApplications();
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to save the credential review.",
      );
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <DashboardLayout role="Admin">
      <div className="appointments-list-card admin-staff-credentials-page">
        <div className="appointments-header">
          <div>
            <h2>Staff Credential Verification</h2>
            <p>
              Review Dentist and Dental Assistant credentials before activating
              their clinic accounts.
            </p>
          </div>

          <div className="appointment-actions" style={{ flexDirection: "row" }}>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              disabled={loading}
            >
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="All">All Applications</option>
            </select>

            <button
              type="button"
              className="secondary-button"
              onClick={fetchApplications}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}

        <div className="staff-summary-grid">
          <div className="staff-summary-card">
            <span>Current Filter</span>
            <strong>{statusFilter}</strong>
            <p>Credential verification status</p>
          </div>

          <div className="staff-summary-card">
            <span>Applications</span>
            <strong>{filteredCount}</strong>
            <p>Matching applications</p>
          </div>
        </div>

        {loading ? (
          <div className="payment-loading-card">
            <p>Loading credential applications...</p>
          </div>
        ) : applications.length === 0 ? (
          <div className="empty-state">
            <h3>No credential applications found</h3>
            <p>No staff applications match the selected status.</p>
          </div>
        ) : (
          <div className="admin-credential-grid">
            {applications.map((application) => (
              <article
                className="admin-credential-card"
                key={application.credential_id}
              >
                <div className="appointment-title-row">
                  <div>
                    <h3>{application.name}</h3>
                    <p>{application.email}</p>
                  </div>

                  <span
                    className={`status-badge credential-status-${String(
                      application.verification_status,
                    ).toLowerCase()}`}
                  >
                    {application.verification_status}
                  </span>
                </div>

                <div className="admin-credential-details">
                  <p>
                    <strong>Role:</strong> {application.staff_role}
                  </p>
                  <p>
                    <strong>Clinic:</strong> {application.clinic_name}
                  </p>
                  <p>
                    <strong>Clinic Owner:</strong>{" "}
                    {application.clinic_owner_name || "N/A"}
                  </p>
                  <p>
                    <strong>Credential Number:</strong>{" "}
                    {application.credential_number}
                  </p>
                  <p>
                    <strong>Qualification:</strong>{" "}
                    {application.qualification_name || "N/A"}
                  </p>
                  <p>
                    <strong>License Expiration:</strong>{" "}
                    {application.license_expiration_date || "N/A"}
                  </p>
                  <p>
                    <strong>Qualification Expiration:</strong>{" "}
                    {application.qualification_expiration_date || "N/A"}
                  </p>
                  <p>
                    <strong>Email Status:</strong>{" "}
                    {application.email_verified
                      ? "Verified by Clinic Owner"
                      : "Not Verified"}
                  </p>
                  <p>
                    <strong>Submitted:</strong>{" "}
                    {formatDate(application.submitted_at)}
                  </p>
                </div>

                {application.rejection_reason && (
                  <div className="error-message">
                    <strong>Rejection reason:</strong>{" "}
                    {application.rejection_reason}
                  </div>
                )}

                <div className="appointment-actions admin-credential-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => openDocument(application, "primary")}
                    disabled={
                      openingDocument === `${application.credential_id}-primary`
                    }
                  >
                    {openingDocument === `${application.credential_id}-primary`
                      ? "Opening..."
                      : "View Credential"}
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => openDocument(application, "government-id")}
                    disabled={
                      openingDocument ===
                      `${application.credential_id}-government-id`
                    }
                  >
                    {openingDocument ===
                    `${application.credential_id}-government-id`
                      ? "Opening..."
                      : "View Government ID"}
                  </button>

                  {application.verification_status === "Pending" && (
                    <>
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => openReviewModal(application, "Approved")}
                      >
                        Approve
                      </button>

                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => openReviewModal(application, "Rejected")}
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
      </div>

      {selectedApplication && (
        <div className="modal-overlay">
          <form
            className="modal-card admin-credential-review-modal"
            onSubmit={submitReview}
          >
            <div className="modal-header">
              <div>
                <h3>
                  {decision === "Approved"
                    ? "Approve Credentials"
                    : "Reject Credentials"}
                </h3>
                <p>
                  {selectedApplication.name} — {selectedApplication.staff_role}
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

            {decision === "Approved" ? (
              <div className="info-message">
                Approval will activate the staff account. No separate email
                verification is required because the account was created by an
                authenticated clinic owner.
              </div>
            ) : (
              <>
                <div className="error-message">
                  Rejecting this application permanently deletes the pending
                  account, staff profile, credential record, and uploaded
                  documents.
                </div>

                <div className="form-group">
                  <label>
                    Rejection Reason <span className="auth-required">*</span>
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(event) => setRejectionReason(event.target.value)}
                    placeholder="Explain why the credentials are being rejected."
                    rows="5"
                    required
                  />
                </div>
              </>
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
                  decision === "Approved" ? "primary-button" : "danger-button"
                }
                disabled={Boolean(reviewingId)}
              >
                {reviewingId
                  ? "Saving..."
                  : decision === "Approved"
                    ? "Confirm Approval"
                    : "Confirm Rejection"}
              </button>
            </div>
          </form>
        </div>
      )}
    </DashboardLayout>
  );
}

export default AdminStaffCredentials;
