import React, { useEffect, useMemo, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";

function ClinicPatientTransfers() {
  const [requests, setRequests] = useState([]);
  const [authorizedClinicIds, setAuthorizedClinicIds] = useState([]);
  const [direction, setDirection] = useState("all");
  const [statusFilter, setStatusFilter] = useState("Pending");
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewDecision, setReviewDecision] = useState("Approve");
  const [rejectionReason, setRejectionReason] = useState("");
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [loadingPackage, setLoadingPackage] = useState(false);

  const token = localStorage.getItem("token");
  const authHeaders = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const loadRequests = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await API.get(
        `/api/patient-transfers/clinic/requests?direction=${direction}`,
        authHeaders,
      );

      setRequests(response.data.requests || []);
      setAuthorizedClinicIds(
        (response.data.authorized_clinic_ids || []).map(Number),
      );
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Unable to load patient transfer requests.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction]);

  const filteredRequests = useMemo(() => {
    if (statusFilter === "All") return requests;

    if (statusFilter === "Pending") {
      return requests.filter((request) =>
        ["Pending Source Approval", "Pending Destination Approval"].includes(
          request.transfer_status,
        ),
      );
    }

    return requests.filter(
      (request) => request.transfer_status === statusFilter,
    );
  }, [requests, statusFilter]);

  const canReview = (request) => {
    if (request.transfer_status === "Pending Source Approval") {
      return authorizedClinicIds.includes(Number(request.source_clinic_id));
    }

    if (request.transfer_status === "Pending Destination Approval") {
      return authorizedClinicIds.includes(
        Number(request.destination_clinic_id),
      );
    }

    return false;
  };

  const openReview = (request, decision) => {
    setReviewTarget(request);
    setReviewDecision(decision);
    setRejectionReason("");
    setError("");
  };

  const submitReview = async () => {
    if (!reviewTarget) return;

    try {
      setReviewingId(reviewTarget.transfer_id);
      setMessage("");
      setError("");

      const response = await API.put(
        `/api/patient-transfers/clinic/requests/${reviewTarget.transfer_id}/review`,
        {
          decision: reviewDecision,
          rejection_reason:
            reviewDecision === "Reject" ? rejectionReason : null,
        },
        authHeaders,
      );

      setMessage(response.data.message);
      setReviewTarget(null);
      await loadRequests();
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to review the transfer request.",
      );
    } finally {
      setReviewingId(null);
    }
  };

  const openPackage = async (transferId) => {
    try {
      setLoadingPackage(true);
      setError("");

      const response = await API.get(
        `/api/patient-transfers/requests/${transferId}/package`,
        authHeaders,
      );

      setSelectedPackage(response.data);
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to open the transfer package.",
      );
    } finally {
      setLoadingPackage(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="appointments-list-card patient-transfer-page">
        <div className="appointments-header">
          <div>
            <h1>Patient Information Transfers</h1>
            <p>
              Review consent-based outgoing and incoming transfer requests. Both
              clinics must approve before the package becomes available.
            </p>
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={loadRequests}
            disabled={loading}
          >
            Refresh
          </button>
        </div>

        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}

        <div className="patient-transfer-filters">
          <div className="form-group">
            <label htmlFor="transfer-direction">Direction</label>
            <select
              id="transfer-direction"
              value={direction}
              onChange={(event) => setDirection(event.target.value)}
            >
              <option value="all">All</option>
              <option value="outgoing">Outgoing from My Clinic</option>
              <option value="incoming">Incoming to My Clinic</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="transfer-status">Status</label>
            <select
              id="transfer-status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Expired">Expired</option>
              <option value="All">All</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="loading-message">Loading transfer requests...</div>
        ) : filteredRequests.length === 0 ? (
          <div className="empty-state">
            No transfer requests match the selected filters.
          </div>
        ) : (
          <div className="patient-transfer-list">
            {filteredRequests.map((request) => (
              <article
                className="patient-transfer-card"
                key={request.transfer_id}
              >
                <div className="patient-transfer-card-header">
                  <div>
                    <h3>{request.patient_name}</h3>
                    <p>{request.patient_email}</p>
                  </div>

                  <span
                    className={`patient-transfer-status patient-transfer-status-${String(
                      request.transfer_status,
                    )
                      .toLowerCase()
                      .replaceAll(" ", "-")}`}
                  >
                    {request.transfer_status}
                  </span>
                </div>

                <div className="patient-transfer-route">
                  <strong>{request.source_clinic_name}</strong>
                  <span>→</span>
                  <strong>{request.destination_clinic_name}</strong>
                </div>

                <div className="patient-transfer-consent-box">
                  <strong>Recorded Patient Consent</strong>
                  <p>{request.consent_statement}</p>
                  <small>
                    Confirmed{" "}
                    {new Date(request.patient_consent_at).toLocaleString(
                      "en-PH",
                    )}
                  </small>
                </div>

                <div className="patient-transfer-meta">
                  <span>
                    Profile: {request.include_profile ? "Included" : "Excluded"}
                  </span>
                  <span>
                    Records:{" "}
                    {request.include_dental_records ? "Included" : "Excluded"}
                  </span>
                  <span>
                    X-rays: {request.include_xrays ? "Included" : "Excluded"}
                  </span>
                  <span>
                    Appointments:{" "}
                    {request.include_appointments ? "Included" : "Excluded"}
                  </span>
                </div>

                {request.source_reviewed_by_name && (
                  <p>
                    Source reviewed by {request.source_reviewed_by_name}
                    {request.source_reviewed_at
                      ? ` on ${new Date(
                          request.source_reviewed_at,
                        ).toLocaleString("en-PH")}`
                      : ""}
                  </p>
                )}

                {request.destination_reviewed_by_name && (
                  <p>
                    Destination reviewed by{" "}
                    {request.destination_reviewed_by_name}
                    {request.destination_reviewed_at
                      ? ` on ${new Date(
                          request.destination_reviewed_at,
                        ).toLocaleString("en-PH")}`
                      : ""}
                  </p>
                )}

                {request.rejection_reason && (
                  <div className="error-message">
                    <strong>Rejection reason:</strong>{" "}
                    {request.rejection_reason}
                  </div>
                )}

                <div className="appointment-actions">
                  {canReview(request) && (
                    <>
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => openReview(request, "Approve")}
                        disabled={reviewingId === request.transfer_id}
                      >
                        Approve
                      </button>

                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => openReview(request, "Reject")}
                        disabled={reviewingId === request.transfer_id}
                      >
                        Reject
                      </button>
                    </>
                  )}

                  {request.transfer_status === "Approved" &&
                    authorizedClinicIds.includes(
                      Number(request.destination_clinic_id),
                    ) && (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => openPackage(request.transfer_id)}
                        disabled={loadingPackage}
                      >
                        {loadingPackage
                          ? "Opening..."
                          : "Open Transfer Package"}
                      </button>
                    )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {reviewTarget && (
        <div className="modal-overlay">
          <div className="modal-card patient-transfer-review-modal">
            <div className="modal-header">
              <div>
                <h3>{reviewDecision} Transfer Request</h3>
                <p>
                  {reviewTarget.source_clinic_name} →{" "}
                  {reviewTarget.destination_clinic_name}
                </p>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={() => setReviewTarget(null)}
              >
                ×
              </button>
            </div>

            <div className="info-message">
              Approving the source stage sends the request to the destination
              clinic. Approving the destination stage generates the authorized,
              read-only transfer package.
            </div>

            {reviewDecision === "Reject" && (
              <div className="form-group">
                <label htmlFor="transfer-rejection-reason">
                  Rejection Reason <span className="auth-required">*</span>
                </label>
                <textarea
                  id="transfer-rejection-reason"
                  value={rejectionReason}
                  onChange={(event) => setRejectionReason(event.target.value)}
                  rows="4"
                  required
                />
              </div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setReviewTarget(null)}
              >
                Cancel
              </button>

              <button
                type="button"
                className={
                  reviewDecision === "Approve"
                    ? "primary-button"
                    : "danger-button"
                }
                onClick={submitReview}
                disabled={
                  reviewingId === reviewTarget.transfer_id ||
                  (reviewDecision === "Reject" && !rejectionReason.trim())
                }
              >
                {reviewingId === reviewTarget.transfer_id
                  ? "Saving..."
                  : `${reviewDecision} Request`}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedPackage && (
        <div className="modal-overlay">
          <div className="modal-card patient-transfer-package-modal">
            <div className="modal-header">
              <div>
                <h3>Authorized Patient Records</h3>
                <p>{selectedPackage.notice}</p>
              </div>
              <button
                type="button"
                className="modal-close-button"
                onClick={() => setSelectedPackage(null)}
              >
                ×
              </button>
            </div>

            <TransferRecordContent data={selectedPackage} />

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setSelectedPackage(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function TransferRecordContent({ data }) {
  const profile = data?.records?.patient_profile;
  const records = data?.records?.dental_records || [];
  const xrays = data?.records?.xrays || [];
  const appointments = data?.records?.appointments || [];

  const formatDate = (value) =>
    value ? new Date(value).toLocaleString("en-PH") : "N/A";

  return (
    <div className="patient-transfer-record-content">
      <section>
        <h4>Patient Profile</h4>
        {profile ? (
          <div className="patient-transfer-detail-grid">
            <span>
              <strong>Name</strong>
              {profile.name}
            </span>
            <span>
              <strong>Email</strong>
              {profile.email}
            </span>
            <span>
              <strong>Contact</strong>
              {profile.contact_number || "N/A"}
            </span>
            <span>
              <strong>Date of Birth</strong>
              {profile.date_of_birth || "N/A"}
            </span>
            <span>
              <strong>Gender</strong>
              {profile.gender || "N/A"}
            </span>
            <span>
              <strong>Dentition</strong>
              {profile.dentition_type || "N/A"}
            </span>
            <span className="patient-transfer-detail-wide">
              <strong>Address</strong>
              {profile.address || "N/A"}
            </span>
            <span className="patient-transfer-detail-wide">
              <strong>Medical History</strong>
              {profile.medical_history || "None recorded"}
            </span>
          </div>
        ) : (
          <p>Patient profile was not included.</p>
        )}
      </section>

      <section>
        <h4>Dental Records ({records.length})</h4>
        {records.length === 0 ? (
          <p>No dental records were included.</p>
        ) : (
          <div className="patient-transfer-record-list">
            {records.map((record) => (
              <article
                key={record.record_id}
                className="patient-transfer-record-card"
              >
                <div>
                  <strong>Record #{record.record_id}</strong>
                  <span>{record.status || "Active"}</span>
                </div>
                <p>Dentist: {record.dentist_name || "N/A"}</p>
                <p>Source: {record.source_clinic_name}</p>
                <p>Created: {formatDate(record.date_created)}</p>
                <p>Notes: {record.source_notes || "None"}</p>

                <div className="patient-transfer-tooth-grid">
                  {(record.teeth || []).map((tooth) => (
                    <div
                      key={tooth.tooth_id}
                      className="patient-transfer-tooth-card"
                    >
                      <strong>Tooth {tooth.tooth_number}</strong>
                      <span>{tooth.tooth_status}</span>
                      {(tooth.treatments || []).map((treatment) => (
                        <small key={treatment.treatment_id}>
                          {treatment.procedure_type} ·{" "}
                          {formatDate(treatment.treatment_date)}
                        </small>
                      ))}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section>
        <h4>X-rays ({xrays.length})</h4>
        {xrays.length === 0 ? (
          <p>No X-rays were included.</p>
        ) : (
          <div className="patient-transfer-table-wrap">
            <table className="patient-transfer-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Record</th>
                  <th>Tooth</th>
                  <th>Dentist</th>
                  <th>Uploaded</th>
                  <th>File</th>
                </tr>
              </thead>
              <tbody>
                {xrays.map((xray) => (
                  <tr key={xray.xray_id}>
                    <td>{xray.xray_id}</td>
                    <td>{xray.record_id}</td>
                    <td>{xray.tooth_number || "General"}</td>
                    <td>{xray.dentist_name || "N/A"}</td>
                    <td>{formatDate(xray.upload_date)}</td>
                    <td>
                      <a href={xray.file_path} target="_blank" rel="noreferrer">
                        Open X-ray
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h4>Appointments ({appointments.length})</h4>
        {appointments.length === 0 ? (
          <p>No appointments were included.</p>
        ) : (
          <div className="patient-transfer-table-wrap">
            <table className="patient-transfer-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Dentist</th>
                  <th>Status</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appointment) => (
                  <tr key={appointment.appointment_id}>
                    <td>{formatDate(appointment.appointment_date)}</td>
                    <td>{appointment.appointment_type || "N/A"}</td>
                    <td>{appointment.dentist_name || "N/A"}</td>
                    <td>{appointment.status}</td>
                    <td>{appointment.notes || "None"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default ClinicPatientTransfers;
