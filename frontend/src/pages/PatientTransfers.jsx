import React, { useEffect, useMemo, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";

function PatientTransfers() {
  const [sourceClinic, setSourceClinic] = useState(null);
  const [clinics, setClinics] = useState([]);
  const [requests, setRequests] = useState([]);
  const [formData, setFormData] = useState({
    destination_clinic_id: "",
    include_profile: true,
    include_dental_records: true,
    include_xrays: true,
    include_appointments: false,
    consent_confirmed: false,
    consent_statement:
      "I authorize my current clinic to securely transfer the selected information to the destination clinic for continuity of dental care.",
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [loadingPackage, setLoadingPackage] = useState(false);

  const token = localStorage.getItem("token");
  const authHeaders = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const [clinicResponse, requestResponse] = await Promise.all([
        API.get("/api/patient-transfers/destination-clinics", authHeaders),
        API.get("/api/patient-transfers/patient/requests", authHeaders),
      ]);

      setSourceClinic(clinicResponse.data.source_clinic || null);
      setClinics(clinicResponse.data.clinics || []);
      setRequests(requestResponse.data.requests || []);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Unable to load patient information transfers.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedClinic = useMemo(
    () =>
      clinics.find(
        (clinic) =>
          Number(clinic.clinic_id) === Number(formData.destination_clinic_id),
      ) || null,
    [clinics, formData.destination_clinic_id],
  );

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setSubmitting(true);
      setMessage("");
      setError("");

      const response = await API.post(
        "/api/patient-transfers/requests",
        formData,
        authHeaders,
      );

      setMessage(response.data.message);
      setFormData((current) => ({
        ...current,
        destination_clinic_id: "",
        consent_confirmed: false,
      }));
      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to submit the transfer request.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const cancelRequest = async (transferId) => {
    try {
      setUpdatingId(transferId);
      setMessage("");
      setError("");

      const response = await API.put(
        `/api/patient-transfers/patient/requests/${transferId}/cancel`,
        {},
        authHeaders,
      );

      setMessage(response.data.message);
      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to cancel the transfer request.",
      );
    } finally {
      setUpdatingId(null);
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

  const statusClass = (status) =>
    `patient-transfer-status patient-transfer-status-${String(status || "")
      .toLowerCase()
      .replaceAll(" ", "-")}`;

  return (
    <DashboardLayout>
      <div className="appointments-list-card patient-transfer-page">
        <div className="appointments-header">
          <div>
            <h1>Patient Information Transfer</h1>
            <p>
              Request a controlled, consent-based transfer to another clinic.
              Your current clinic and the destination clinic must both approve.
            </p>
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={loadData}
            disabled={loading}
          >
            Refresh
          </button>
        </div>

        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}

        <div className="info-message">
          <strong>Privacy notice:</strong> The original clinic keeps its
          historical records. The destination clinic receives a read-only
          package containing only the categories you authorize.
        </div>

        <section className="patient-dashboard-section">
          <div className="appointments-header">
            <div>
              <h2>New Transfer Request</h2>
              <p>
                Current clinic:{" "}
                <strong>{sourceClinic?.clinic_name || "Loading..."}</strong>
              </p>
            </div>
          </div>

          <form className="patient-transfer-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="destination_clinic_id">
                Destination Clinic <span className="auth-required">*</span>
              </label>
              <select
                id="destination_clinic_id"
                value={formData.destination_clinic_id}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    destination_clinic_id: event.target.value,
                  }))
                }
                required
              >
                <option value="">Select destination clinic</option>
                {clinics.map((clinic) => (
                  <option key={clinic.clinic_id} value={clinic.clinic_id}>
                    {clinic.clinic_name}
                  </option>
                ))}
              </select>
              {selectedClinic && (
                <small>
                  {selectedClinic.address || "Address not available"} ·{" "}
                  {selectedClinic.contact_number || "No contact number"}
                </small>
              )}
            </div>

            <fieldset className="patient-transfer-scopes">
              <legend>Information to Transfer</legend>

              {[
                ["include_profile", "Patient profile and contact information"],
                ["include_dental_records", "Dental records and clinical notes"],
                ["include_xrays", "X-ray records and related findings"],
                ["include_appointments", "Appointment history"],
              ].map(([name, label]) => (
                <label key={name}>
                  <input
                    type="checkbox"
                    checked={formData[name]}
                    onChange={(event) =>
                      setFormData((current) => ({
                        ...current,
                        [name]: event.target.checked,
                      }))
                    }
                  />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>

            <div className="form-group">
              <label htmlFor="consent_statement">
                Consent Statement <span className="auth-required">*</span>
              </label>
              <textarea
                id="consent_statement"
                value={formData.consent_statement}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    consent_statement: event.target.value,
                  }))
                }
                rows="4"
                required
              />
            </div>

            <label className="patient-transfer-consent">
              <input
                type="checkbox"
                checked={formData.consent_confirmed}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    consent_confirmed: event.target.checked,
                  }))
                }
                required
              />
              <span>
                I confirm that I am the patient or authorized representative,
                and I voluntarily consent to this transfer.
              </span>
            </label>

            <button
              type="submit"
              className="primary-button"
              disabled={submitting}
            >
              {submitting ? "Submitting..." : "Submit Transfer Request"}
            </button>
          </form>
        </section>

        <section className="patient-dashboard-section">
          <div className="appointments-header">
            <div>
              <h2>Transfer History</h2>
              <p>
                Track source approval, destination approval, and final access.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="loading-message">Loading transfer requests...</div>
          ) : requests.length === 0 ? (
            <div className="empty-state">No transfer requests found.</div>
          ) : (
            <div className="patient-transfer-list">
              {requests.map((request) => (
                <article
                  className="patient-transfer-card"
                  key={request.transfer_id}
                >
                  <div className="patient-transfer-card-header">
                    <div>
                      <h3>
                        {request.source_clinic_name} →{" "}
                        {request.destination_clinic_name}
                      </h3>
                      <p>
                        Submitted{" "}
                        {new Date(request.created_at).toLocaleString("en-PH")}
                      </p>
                    </div>

                    <span className={statusClass(request.transfer_status)}>
                      {request.transfer_status}
                    </span>
                  </div>

                  <div className="patient-transfer-meta">
                    <span>
                      Profile:{" "}
                      {request.include_profile ? "Included" : "Excluded"}
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

                  {request.rejection_reason && (
                    <div className="error-message">
                      <strong>Rejection reason:</strong>{" "}
                      {request.rejection_reason}
                    </div>
                  )}

                  <div className="appointment-actions">
                    {[
                      "Pending Source Approval",
                      "Pending Destination Approval",
                    ].includes(request.transfer_status) && (
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => cancelRequest(request.transfer_id)}
                        disabled={updatingId === request.transfer_id}
                      >
                        {updatingId === request.transfer_id
                          ? "Cancelling..."
                          : "Cancel Request"}
                      </button>
                    )}

                    {request.transfer_status === "Approved" && (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => openPackage(request.transfer_id)}
                        disabled={loadingPackage}
                      >
                        {loadingPackage
                          ? "Opening..."
                          : "View Transferred Package"}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {selectedPackage && (
        <div className="modal-overlay">
          <div className="modal-card patient-transfer-package-modal">
            <div className="modal-header">
              <div>
                <h3>Approved Patient Records</h3>
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

export default PatientTransfers;
