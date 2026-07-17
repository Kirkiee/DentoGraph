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
    include_appointments: true,
    consent_confirmed: false,
    consent_statement:
      "I authorize the transfer of my active clinic assignment to the selected destination clinic. I understand that my previous clinic records will remain preserved as read-only historical records for continuity of care.",
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [loadingPackage, setLoadingPackage] = useState(false);
  const [historyStatusFilter, setHistoryStatusFilter] = useState("All");
  const [historySearch, setHistorySearch] = useState("");
  const [clinicSearch, setClinicSearch] = useState("");
  const [clinicAreaFilter, setClinicAreaFilter] = useState("All");
  const [clinicSort, setClinicSort] = useState("Name A-Z");

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
          "Unable to load Patient transfer requests.",
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

  const clinicAreas = useMemo(() => {
    const areas = new Set();

    clinics.forEach((clinic) => {
      const address = String(clinic.address || "").trim();
      if (!address) return;

      const parts = address
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);

      const area = parts.at(-1);
      if (area) areas.add(area);
    });

    return Array.from(areas).sort((a, b) => a.localeCompare(b));
  }, [clinics]);

  const filteredClinics = useMemo(() => {
    const search = clinicSearch.trim().toLowerCase();

    const results = clinics.filter((clinic) => {
      const address = String(clinic.address || "");
      const parts = address
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
      const area = parts.at(-1) || "";

      const matchesSearch =
        !search ||
        String(clinic.clinic_name || "")
          .toLowerCase()
          .includes(search) ||
        address.toLowerCase().includes(search) ||
        String(clinic.contact_number || "")
          .toLowerCase()
          .includes(search);

      const matchesArea =
        clinicAreaFilter === "All" || area === clinicAreaFilter;

      return matchesSearch && matchesArea;
    });

    return [...results].sort((a, b) => {
      if (clinicSort === "Name Z-A") {
        return String(b.clinic_name || "").localeCompare(
          String(a.clinic_name || ""),
        );
      }

      return String(a.clinic_name || "").localeCompare(
        String(b.clinic_name || ""),
      );
    });
  }, [clinics, clinicSearch, clinicAreaFilter, clinicSort]);

  const filteredRequests = useMemo(() => {
    const search = historySearch.trim().toLowerCase();

    return requests.filter((request) => {
      const matchesStatus =
        historyStatusFilter === "All" ||
        request.transfer_status === historyStatusFilter;

      const matchesSearch =
        !search ||
        String(request.source_clinic_name || "")
          .toLowerCase()
          .includes(search) ||
        String(request.destination_clinic_name || "")
          .toLowerCase()
          .includes(search) ||
        String(request.transfer_id || "").includes(search);

      return matchesStatus && matchesSearch;
    });
  }, [requests, historyStatusFilter, historySearch]);

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
      setClinicSearch("");
      setClinicAreaFilter("All");
      setClinicSort("Name A-Z");
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
        err.response?.data?.error || "Unable to open transferred records.",
      );
    } finally {
      setLoadingPackage(false);
    }
  };

  const statusClass = (status) =>
    `patient-transfer-status patient-transfer-status-${String(status || "")
      .toLowerCase()
      .replaceAll(" ", "-")}`;

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

  return (
    <DashboardLayout>
      <div className="appointments-list-card patient-transfer-page">
        <div className="appointments-header">
          <div>
            <h1>Transfer to Another Clinic</h1>
            <p>
              Move your active clinic assignment to another clinic. Your current
              clinic and destination clinic must both approve before the
              transfer takes effect.
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

        <section className="patient-transfer-process">
          <div className="patient-transfer-process-heading">
            <div>
              <span className="patient-transfer-eyebrow">
                How the transfer works
              </span>
              <h2>One request, two clinic approvals</h2>
              <p>
                Your account stays the same. Only your active clinic assignment
                changes after both clinics approve.
              </p>
            </div>
          </div>

          <div className="patient-transfer-process-grid">
            <article>
              <span>1</span>
              <div>
                <strong>Submit Request</strong>
                <p>
                  Select the clinic that will become your new active clinic.
                </p>
              </div>
            </article>

            <article>
              <span>2</span>
              <div>
                <strong>Current Clinic Review</strong>
                <p>Your current clinic confirms the outgoing transfer.</p>
              </div>
            </article>

            <article>
              <span>3</span>
              <div>
                <strong>Destination Review</strong>
                <p>
                  The destination clinic accepts responsibility for future care.
                </p>
              </div>
            </article>

            <article>
              <span>4</span>
              <div>
                <strong>Transfer Completed</strong>
                <p>
                  Your previous care episode becomes historical and a new active
                  care episode begins at the destination clinic.
                </p>
              </div>
            </article>
          </div>
        </section>

        <div className="info-message patient-transfer-privacy-note">
          <strong>Your records are preserved:</strong> Previous dental records,
          X-rays, treatments, and appointment history remain connected to the
          clinic and Dentist that originally created them. They become read-only
          historical records after the transfer.
        </div>

        <section className="patient-dashboard-section">
          <div className="appointments-header">
            <div>
              <h2>Request a Clinic Transfer</h2>
              <p>
                Current clinic:{" "}
                <strong>{sourceClinic?.clinic_name || "Loading..."}</strong>
              </p>
            </div>
          </div>

          <form className="patient-transfer-form" onSubmit={handleSubmit}>
            <div className="patient-transfer-clinic-selector">
              <div className="patient-transfer-clinic-selector-heading">
                <div>
                  <label>
                    Destination Clinic <span className="auth-required">*</span>
                  </label>
                  <p>
                    Search and compare active clinics before selecting your new
                    clinic assignment.
                  </p>
                </div>

                <span className="status-badge status-scheduled">
                  {filteredClinics.length} clinic
                  {filteredClinics.length === 1 ? "" : "s"} found
                </span>
              </div>

              <div className="patient-transfer-clinic-filters">
                <div className="form-group patient-transfer-clinic-search">
                  <label htmlFor="destination_clinic_search">
                    Search Clinic
                  </label>
                  <input
                    id="destination_clinic_search"
                    type="search"
                    value={clinicSearch}
                    onChange={(event) => setClinicSearch(event.target.value)}
                    placeholder="Clinic name, address, or contact number"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="destination_clinic_area">Area</label>
                  <select
                    id="destination_clinic_area"
                    value={clinicAreaFilter}
                    onChange={(event) =>
                      setClinicAreaFilter(event.target.value)
                    }
                  >
                    <option value="All">All Areas</option>
                    {clinicAreas.map((area) => (
                      <option key={area} value={area}>
                        {area}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="destination_clinic_sort">Sort</label>
                  <select
                    id="destination_clinic_sort"
                    value={clinicSort}
                    onChange={(event) => setClinicSort(event.target.value)}
                  >
                    <option value="Name A-Z">Name A-Z</option>
                    <option value="Name Z-A">Name Z-A</option>
                  </select>
                </div>
              </div>

              <input
                type="hidden"
                name="destination_clinic_id"
                value={formData.destination_clinic_id}
                required
              />

              {loading ? (
                <div className="loading-message">
                  Loading destination clinics...
                </div>
              ) : filteredClinics.length === 0 ? (
                <div className="empty-state">
                  <h3>No destination clinics found</h3>
                  <p>
                    Change the search text or area filter to see more clinics.
                  </p>
                </div>
              ) : (
                <div className="patient-transfer-clinic-grid">
                  {filteredClinics.map((clinic) => {
                    const isSelected =
                      Number(formData.destination_clinic_id) ===
                      Number(clinic.clinic_id);

                    return (
                      <button
                        key={clinic.clinic_id}
                        type="button"
                        className={`patient-transfer-clinic-option ${
                          isSelected ? "selected" : ""
                        }`}
                        onClick={() =>
                          setFormData((current) => ({
                            ...current,
                            destination_clinic_id: String(clinic.clinic_id),
                          }))
                        }
                        aria-pressed={isSelected}
                      >
                        <span className="patient-transfer-clinic-option-main">
                          <strong>{clinic.clinic_name}</strong>
                          <small>
                            {clinic.address || "Address not available"}
                          </small>
                          <small>
                            {clinic.contact_number || "No contact number"}
                          </small>
                        </span>

                        <span className="patient-transfer-clinic-option-action">
                          {isSelected ? "Selected" : "Select Clinic"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedClinic && (
                <div className="patient-transfer-selected-clinic">
                  <div>
                    <span>Selected destination</span>
                    <strong>{selectedClinic.clinic_name}</strong>
                    <small>
                      {selectedClinic.address || "Address not available"} ·{" "}
                      {selectedClinic.contact_number || "No contact number"}
                    </small>
                  </div>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      setFormData((current) => ({
                        ...current,
                        destination_clinic_id: "",
                      }))
                    }
                  >
                    Change Selection
                  </button>
                </div>
              )}
            </div>

            <div className="patient-transfer-outcome">
              <h3>What will happen after final approval</h3>

              <div className="patient-transfer-outcome-grid">
                <div>
                  <strong>Active clinic changes</strong>
                  <span>
                    {sourceClinic?.clinic_name || "Current clinic"} →{" "}
                    {selectedClinic?.clinic_name ||
                      "Selected destination clinic"}
                  </span>
                </div>

                <div>
                  <strong>Previous care becomes historical</strong>
                  <span>
                    Existing records remain read-only under their original
                    clinic.
                  </span>
                </div>

                <div>
                  <strong>New care episode begins</strong>
                  <span>
                    Future appointments and new clinical records belong to the
                    destination clinic.
                  </span>
                </div>

                <div>
                  <strong>Same Patient account</strong>
                  <span>
                    Your Patient ID, login, and account remain unchanged.
                  </span>
                </div>
              </div>
            </div>

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
                I confirm that I am the Patient or authorized representative,
                and I voluntarily request this clinic transfer.
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
              <h2>My Transfer Requests</h2>
              <p>
                Track each approval stage and the final clinic reassignment.
              </p>
            </div>
          </div>

          <div className="patient-transfer-table-filters">
            <div className="form-group">
              <label htmlFor="patient-transfer-search">Search</label>
              <input
                id="patient-transfer-search"
                type="search"
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
                placeholder="Source clinic, destination clinic, or request ID"
              />
            </div>

            <div className="form-group">
              <label htmlFor="patient-transfer-status">Status</label>
              <select
                id="patient-transfer-status"
                value={historyStatusFilter}
                onChange={(event) => setHistoryStatusFilter(event.target.value)}
              >
                <option value="All">All Statuses</option>
                <option value="Pending Source Approval">
                  Pending Source Approval
                </option>
                <option value="Pending Destination Approval">
                  Pending Destination Approval
                </option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Expired">Expired</option>
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
            <div className="patient-transfer-table-wrap">
              <table className="patient-transfer-table patient-transfer-history-table">
                <thead>
                  <tr>
                    <th>Request</th>
                    <th>Current Clinic</th>
                    <th>Destination Clinic</th>
                    <th>Submitted</th>
                    <th>Status</th>
                    <th>Records</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRequests.map((request) => (
                    <tr key={request.transfer_id}>
                      <td>#{request.transfer_id}</td>
                      <td>{request.source_clinic_name}</td>
                      <td>{request.destination_clinic_name}</td>
                      <td>{formatDate(request.created_at)}</td>
                      <td>
                        <span className={statusClass(request.transfer_status)}>
                          {request.transfer_status}
                        </span>
                      </td>
                      <td>
                        <div className="patient-transfer-table-records">
                          <span>
                            Profile:{" "}
                            {request.include_profile ? "Included" : "Excluded"}
                          </span>
                          <span>
                            Records:{" "}
                            {request.include_dental_records
                              ? "Included"
                              : "Excluded"}
                          </span>
                          <span>
                            X-rays:{" "}
                            {request.include_xrays ? "Included" : "Excluded"}
                          </span>
                          <span>
                            Appointments:{" "}
                            {request.include_appointments
                              ? "Included"
                              : "Excluded"}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="patient-transfer-table-actions">
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
                                : "Cancel"}
                            </button>
                          )}

                          {request.transfer_status === "Approved" && (
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => openPackage(request.transfer_id)}
                              disabled={loadingPackage}
                            >
                              View Records
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
