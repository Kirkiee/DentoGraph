import React, { useEffect, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import { useNavigate } from "react-router-dom";

const RECORD_SOURCE_OPTIONS = [
  {
    value: "NEW_SYSTEM_RECORD",
    label: "New System Record",
    description: "A new dental record created directly in DentoGraph.",
  },
  {
    value: "OLD_ENCODED_RECORD",
    label: "Old Encoded Record",
    description: "Old patient record manually encoded into the system.",
  },
  {
    value: "SCANNED_OLD_RECORD",
    label: "Scanned Old Record",
    description: "Record based on uploaded or scanned previous clinic records.",
  },
  {
    value: "PDA_BASED_RECORD",
    label: "PDA-Based Record",
    description: "Record created using the PDA dental chart/form as basis.",
  },
];

const formatSubscriptionError = (errorMessage, fallbackMessage) => {
  const backendError = errorMessage || fallbackMessage;
  const lowerError = backendError.toLowerCase();

  if (
    lowerError.includes("limit") ||
    lowerError.includes("subscription") ||
    lowerError.includes("storage")
  ) {
    return `${backendError} Please ask the Clinic Owner to upgrade the clinic subscription.`;
  }

  return backendError;
};

function AssistantDentalRecords() {
  const navigate = useNavigate();

  const [records, setRecords] = useState([]);
  const [patients, setPatients] = useState([]);
  const [dentists, setDentists] = useState([]);

  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [selectedDentistId, setSelectedDentistId] = useState("");

  const [recordSource, setRecordSource] = useState("NEW_SYSTEM_RECORD");
  const [sourceNotes, setSourceNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [policyError, setPolicyError] = useState(null);

  const token = localStorage.getItem("token");

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  useEffect(() => {
    fetchRecords();
    fetchPatients();
    fetchDentists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      setError("");
      setPolicyError(null);

      const response = await API.get("/api/dental-records", authHeaders);
      setRecords(response.data.dental_records || []);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load dental records.");
    } finally {
      setLoading(false);
    }
  };

  const fetchPatients = async () => {
    try {
      const response = await API.get(
        "/api/dental-records/patients/list",
        authHeaders,
      );

      setPatients(response.data.patients || []);
    } catch (err) {
      console.error("Fetch patients error:", err);
    }
  };

  const fetchDentists = async () => {
    try {
      const response = await API.get(
        "/api/dental-records/dentists/list",
        authHeaders,
      );

      const fetchedDentists = response.data.dentists || [];
      setDentists(fetchedDentists);

      if (fetchedDentists.length === 1) {
        setSelectedDentistId(String(fetchedDentists[0].dentist_id));
      }
    } catch (err) {
      console.error("Fetch dentists error:", err);
    }
  };

  const getPatientDentitionLabel = (dentitionType) => {
    if (dentitionType === "Child") return "Child / Primary Teeth";
    if (dentitionType === "Adult") return "Adult / Permanent Teeth";

    return "Dentition type not set";
  };

  const getPatientOptionLabel = (patient) => {
    const dentitionLabel = getPatientDentitionLabel(patient.dentition_type);

    return `${patient.patient_name} - ${patient.email} (${dentitionLabel})`;
  };

  const getDentistOptionLabel = (dentist) => {
    const dentistName =
      dentist.dentist_name || `Dentist #${dentist.dentist_id}`;
    const clinicName = dentist.clinic_name || "No clinic name";

    return `${dentistName} - ${clinicName}`;
  };

  const getRecordSourceLabel = (recordSourceValue) => {
    const foundSource = RECORD_SOURCE_OPTIONS.find(
      (option) => option.value === recordSourceValue,
    );

    return foundSource?.label || "New System Record";
  };

  const getRecordSourceDescription = (recordSourceValue) => {
    const foundSource = RECORD_SOURCE_OPTIONS.find(
      (option) => option.value === recordSourceValue,
    );

    return foundSource?.description || RECORD_SOURCE_OPTIONS[0].description;
  };

  const selectedPatient = patients.find(
    (patient) => Number(patient.patient_id) === Number(selectedPatientId),
  );

  const selectedDentist = dentists.find(
    (dentist) => Number(dentist.dentist_id) === Number(selectedDentistId),
  );

  const resetCreateForm = () => {
    setSelectedPatientId("");
    setRecordSource("NEW_SYSTEM_RECORD");
    setSourceNotes("");

    if (dentists.length !== 1) {
      setSelectedDentistId("");
    }
  };

  const handleCreateRecord = async (e) => {
    e.preventDefault();

    if (!selectedPatientId) {
      setError("Please select a patient first.");
      setPolicyError(null);
      return;
    }

    if (!selectedDentistId) {
      setError("Please select an assigned dentist first.");
      setPolicyError(null);
      return;
    }

    try {
      setCreating(true);
      setMessage("");
      setError("");
      setPolicyError(null);

      const response = await API.post(
        "/api/dental-records",
        {
          patient_id: Number(selectedPatientId),
          dentist_id: Number(selectedDentistId),
          record_source: recordSource,
          source_notes: sourceNotes.trim() || null,
        },
        authHeaders,
      );

      if (response.data.existing) {
        setMessage("Dental record already exists. Opening existing record...");

        const existingRecordId = response.data.dental_record?.record_id;

        resetCreateForm();

        if (existingRecordId) {
          navigate(`/assistant/dental-records/${existingRecordId}`);
        }

        return;
      }

      setMessage(
        response.data.message || "Dental record created successfully.",
      );

      const newRecordId = response.data.dental_record?.record_id;

      resetCreateForm();

      await fetchRecords();

      if (newRecordId) {
        navigate(`/assistant/dental-records/${newRecordId}`);
      }
    } catch (err) {
      const responseData = err.response?.data;

      const formattedError = formatSubscriptionError(
        responseData?.error,
        "Unable to create dental record.",
      );

      if (responseData?.policy || responseData?.existing_record) {
        setPolicyError({
          message: formattedError,
          policy: responseData.policy || null,
          existingRecord: responseData.existing_record || null,
        });

        setError("");
      } else {
        setError(formattedError);
        setPolicyError(null);
      }
    } finally {
      setCreating(false);
    }
  };

  const getRecordStatusClass = (status) => {
    switch (status) {
      case "Archived":
        return "status-badge status-cancelled";
      case "Active":
      default:
        return "status-badge status-scheduled";
    }
  };

  const getRecordSourceClass = (recordSourceValue) => {
    switch (recordSourceValue) {
      case "OLD_ENCODED_RECORD":
        return "status-badge status-pending";
      case "SCANNED_OLD_RECORD":
        return "status-badge status-scheduled";
      case "PDA_BASED_RECORD":
        return "status-badge status-completed";
      case "NEW_SYSTEM_RECORD":
      default:
        return "status-badge status-scheduled";
    }
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return "N/A";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "N/A";
    }

    return date.toLocaleString();
  };

  return (
    <DashboardLayout role="Assistant">
      <div className="appointments-layout">
        <div className="appointment-form-card">
          <h2>Create Dental Record</h2>

          <p>
            Select a patient and assign the dental record under a dentist from
            your clinic. This record can later contain tooth details,
            treatments, X-rays, old records, PDA forms, and clinical notes.
          </p>

          <div className="info-message" style={{ marginBottom: "16px" }}>
            <strong>Dental Record Creation Policy:</strong>
            <br />A dental record can only be created for an existing patient
            profile with Adult/Child dentition type set. The selected dentist
            must have an appointment connection with the patient, and only one
            active dental record is allowed per patient per clinic. Archived
            records cannot be modified.
          </div>

          {selectedPatient && (
            <div className="info-message" style={{ marginBottom: "16px" }}>
              <strong>Selected Patient:</strong> {selectedPatient.patient_name}
              <br />
              <strong>Email:</strong> {selectedPatient.email}
              <br />
              <strong>Dentition Type:</strong>{" "}
              {getPatientDentitionLabel(selectedPatient.dentition_type)}
              {!selectedPatient.dentition_type && (
                <>
                  <br />
                  <strong>Action Needed:</strong> This patient must update their
                  profile and select Adult or Child before a dental record can
                  be created.
                </>
              )}
            </div>
          )}

          {selectedDentist && (
            <div className="info-message" style={{ marginBottom: "16px" }}>
              <strong>Assigned Dentist:</strong>{" "}
              {selectedDentist.dentist_name ||
                `Dentist #${selectedDentist.dentist_id}`}
              <br />
              <strong>Email:</strong> {selectedDentist.email || "N/A"}
              <br />
              <strong>Clinic:</strong>{" "}
              {selectedDentist.clinic_name || "No clinic name"}
            </div>
          )}

          {message && <div className="success-message">{message}</div>}
          {error && <div className="error-message">{error}</div>}

          {policyError && (
            <div className="error-message">
              <strong>{policyError.message}</strong>

              {policyError.existingRecord && (
                <div style={{ marginTop: "10px" }}>
                  <p>
                    <strong>Existing Active Record:</strong> Record #
                    {policyError.existingRecord.record_id}
                  </p>

                  <p>
                    <strong>Assigned Dentist:</strong>{" "}
                    {policyError.existingRecord.dentist_name || "N/A"}
                  </p>

                  <p>
                    <strong>Clinic:</strong>{" "}
                    {policyError.existingRecord.clinic_name || "N/A"}
                  </p>

                  <p>
                    <strong>Status:</strong>{" "}
                    {policyError.existingRecord.status || "Active"}
                  </p>

                  <p>
                    <strong>Record Source:</strong>{" "}
                    {getRecordSourceLabel(
                      policyError.existingRecord.record_source,
                    )}
                  </p>

                  {policyError.existingRecord.source_notes && (
                    <p>
                      <strong>Source Notes:</strong>{" "}
                      {policyError.existingRecord.source_notes}
                    </p>
                  )}

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      navigate(
                        `/assistant/dental-records/${policyError.existingRecord.record_id}`,
                      )
                    }
                    style={{ marginTop: "8px" }}
                  >
                    Open Existing Record
                  </button>
                </div>
              )}

              {policyError.policy?.rules?.length > 0 && (
                <div style={{ marginTop: "10px" }}>
                  <strong>{policyError.policy.name || "Policy Rules"}:</strong>

                  <ul style={{ marginTop: "8px", paddingLeft: "20px" }}>
                    {policyError.policy.rules.map((rule, index) => (
                      <li key={index}>{rule}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <form className="appointment-form" onSubmit={handleCreateRecord}>
            <div className="form-group">
              <label>Patient</label>

              <select
                value={selectedPatientId}
                onChange={(e) => {
                  setSelectedPatientId(e.target.value);
                  setMessage("");
                  setError("");
                  setPolicyError(null);
                }}
                required
              >
                <option value="">Select Patient</option>

                {patients.map((patient) => (
                  <option key={patient.patient_id} value={patient.patient_id}>
                    {getPatientOptionLabel(patient)}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Assigned Dentist</label>

              <select
                value={selectedDentistId}
                onChange={(e) => {
                  setSelectedDentistId(e.target.value);
                  setMessage("");
                  setError("");
                  setPolicyError(null);
                }}
                required
              >
                <option value="">Select Dentist</option>

                {dentists.map((dentist) => (
                  <option key={dentist.dentist_id} value={dentist.dentist_id}>
                    {getDentistOptionLabel(dentist)}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Record Source</label>

              <select
                value={recordSource}
                onChange={(e) => {
                  setRecordSource(e.target.value);
                  setMessage("");
                  setError("");
                  setPolicyError(null);
                }}
                required
              >
                {RECORD_SOURCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="info-message">
              <strong>{getRecordSourceLabel(recordSource)}:</strong>{" "}
              {getRecordSourceDescription(recordSource)}
            </div>

            <div className="form-group">
              <label>Source Notes</label>

              <textarea
                value={sourceNotes}
                onChange={(e) => setSourceNotes(e.target.value)}
                placeholder={
                  recordSource === "NEW_SYSTEM_RECORD"
                    ? "Example: New dental record created after today's consultation."
                    : recordSource === "OLD_ENCODED_RECORD"
                      ? "Example: Manually encoded from the patient's previous paper record."
                      : recordSource === "SCANNED_OLD_RECORD"
                        ? "Example: Based on scanned old record uploaded by clinic staff."
                        : "Example: Created using PDA dental chart/form as reference."
                }
                rows="4"
              />
            </div>

            {patients.length === 0 && (
              <div className="info-message">
                No available patients were found. Only patients with appointment
                connections in your clinic can be used for dental record
                creation.
              </div>
            )}

            {dentists.length === 0 && (
              <div className="info-message">
                No available dentists were found. A dentist from your assigned
                clinic is required before creating a dental record.
              </div>
            )}

            <button
              type="submit"
              className="primary-button"
              disabled={creating || !selectedPatientId || !selectedDentistId}
            >
              {creating ? "Creating..." : "Create Dental Record"}
            </button>
          </form>
        </div>

        <div className="appointments-list-card">
          <div className="appointments-header">
            <div>
              <h2>Dental Records</h2>

              <p>
                View dental records for patients under your assigned clinic and
                assist with tooth status updates, treatments, and 3D dental
                visualization.
              </p>
            </div>

            <button
              className="secondary-button"
              onClick={() => {
                fetchRecords();
                fetchPatients();
                fetchDentists();
              }}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {loading ? (
            <p>Loading dental records...</p>
          ) : records.length === 0 ? (
            <div className="empty-state">
              <h3>No dental records yet</h3>
              <p>Created patient dental records will appear here.</p>
            </div>
          ) : (
            <div className="appointments-list">
              {records.map((record) => (
                <div className="appointment-item" key={record.record_id}>
                  <div className="appointment-info">
                    <div className="appointment-title-row">
                      <h3>Record #{record.record_id}</h3>

                      <span className={getRecordStatusClass(record.status)}>
                        {record.status || "Active"}
                      </span>
                    </div>

                    <p>
                      <strong>Patient:</strong>{" "}
                      {record.patient_name || `Patient ID ${record.patient_id}`}
                    </p>

                    <p>
                      <strong>Patient Type:</strong>{" "}
                      {getPatientDentitionLabel(record.dentition_type)}
                    </p>

                    <p>
                      <strong>Record Source:</strong>{" "}
                      <span
                        className={getRecordSourceClass(record.record_source)}
                      >
                        {getRecordSourceLabel(record.record_source)}
                      </span>
                    </p>

                    {record.source_notes && (
                      <p>
                        <strong>Source Notes:</strong> {record.source_notes}
                      </p>
                    )}

                    <p>
                      <strong>Dentist:</strong>{" "}
                      {record.dentist_name || `Dentist ID ${record.dentist_id}`}
                    </p>

                    <p>
                      <strong>Clinic:</strong>{" "}
                      {record.clinic_name || "No assigned clinic"}
                    </p>

                    <p>
                      <strong>Date Created:</strong>{" "}
                      {formatDate(record.date_created)}
                    </p>

                    <p>
                      <strong>Last Updated:</strong>{" "}
                      {formatDate(record.last_updated)}
                    </p>
                  </div>

                  <div className="appointment-actions">
                    <button
                      className="secondary-button"
                      onClick={() =>
                        navigate(
                          `/assistant/dental-records/${record.record_id}`,
                        )
                      }
                    >
                      View Details
                    </button>

                    <button
                      className="primary-button"
                      onClick={() =>
                        navigate(
                          `/assistant/dental-records/${record.record_id}/3d-view`,
                        )
                      }
                    >
                      3D View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default AssistantDentalRecords;
