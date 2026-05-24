import React, { useEffect, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import { useNavigate } from "react-router-dom";

function DentistDentalRecords() {
  const navigate = useNavigate();

  const [records, setRecords] = useState([]);
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const token = localStorage.getItem("token");

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  useEffect(() => {
    fetchRecords();
    fetchPatients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      setError("");

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

  const handleCreateRecord = async (e) => {
    e.preventDefault();

    if (!selectedPatientId) {
      setError("Please select a patient first.");
      return;
    }

    try {
      setCreating(true);
      setMessage("");
      setError("");

      const response = await API.post(
        "/api/dental-records",
        {
          patient_id: Number(selectedPatientId),
        },
        authHeaders,
      );

      if (response.data.existing) {
        setMessage("Dental record already exists. Opening existing record...");
        setSelectedPatientId("");

        const existingRecordId = response.data.dental_record?.record_id;

        if (existingRecordId) {
          navigate(`/dentist/dental-records/${existingRecordId}`);
        }

        return;
      }

      setMessage("Dental record created successfully.");
      setSelectedPatientId("");
      fetchRecords();
    } catch (err) {
      setError(err.response?.data?.error || "Unable to create dental record.");
    } finally {
      setCreating(false);
    }
  };

  const openArchiveModal = (record) => {
    setSelectedRecord(record);
    setMessage("");
    setError("");
    setShowArchiveModal(true);
  };

  const closeArchiveModal = () => {
    setShowArchiveModal(false);
    setSelectedRecord(null);
  };

  const handleArchiveRecord = async (e) => {
    e.preventDefault();

    if (!selectedRecord) {
      setError("No dental record selected for archiving.");
      return;
    }

    try {
      setArchiving(true);
      setMessage("");
      setError("");

      await API.put(
        `/api/dental-records/${selectedRecord.record_id}/archive`,
        {},
        authHeaders,
      );

      setMessage(`Record #${selectedRecord.record_id} archived successfully.`);
      closeArchiveModal();
      fetchRecords();
    } catch (err) {
      setError(err.response?.data?.error || "Unable to archive dental record.");
    } finally {
      setArchiving(false);
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

  return (
    <DashboardLayout role="Dentist">
      <div className="appointments-layout">
        <div className="appointment-form-card">
          <h2>Create Dental Record</h2>
          <p>
            Select a patient to create a new dental record. This record can
            later contain tooth details, treatments, and clinical notes.
          </p>

          {message && <div className="success-message">{message}</div>}
          {error && <div className="error-message">{error}</div>}

          <form className="appointment-form" onSubmit={handleCreateRecord}>
            <div className="form-group">
              <label>Patient</label>
              <select
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                required
              >
                <option value="">Select Patient</option>
                {patients.map((patient) => (
                  <option key={patient.patient_id} value={patient.patient_id}>
                    {patient.patient_name} - {patient.email}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="primary-button"
              disabled={creating}
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
                View dental records created for patients under your assigned
                dentist account.
              </p>
            </div>

            <button
              className="secondary-button"
              onClick={fetchRecords}
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
                      <strong>Dentist:</strong>{" "}
                      {record.dentist_name || `Dentist ID ${record.dentist_id}`}
                    </p>

                    <p>
                      <strong>Clinic:</strong>{" "}
                      {record.clinic_name || "No assigned clinic"}
                    </p>

                    <p>
                      <strong>Date Created:</strong>{" "}
                      {record.date_created
                        ? new Date(record.date_created).toLocaleString()
                        : "N/A"}
                    </p>

                    <p>
                      <strong>Last Updated:</strong>{" "}
                      {record.last_updated
                        ? new Date(record.last_updated).toLocaleString()
                        : "N/A"}
                    </p>
                  </div>

                  <div className="appointment-actions">
                    <button
                      className="secondary-button"
                      onClick={() =>
                        navigate(`/dentist/dental-records/${record.record_id}`)
                      }
                    >
                      View Details
                    </button>

                    <button
                      className="danger-button"
                      disabled={archiving}
                      onClick={() => openArchiveModal(record)}
                    >
                      Archive
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showArchiveModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>Archive Dental Record</h3>
                <p>
                  Confirm that you want to archive this dental record. Archived
                  records will be hidden from the normal records list.
                </p>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closeArchiveModal}
              >
                ×
              </button>
            </div>

            <form className="modal-form" onSubmit={handleArchiveRecord}>
              <div className="form-group">
                <label>Record</label>
                <input
                  type="text"
                  value={
                    selectedRecord ? `Record #${selectedRecord.record_id}` : ""
                  }
                  disabled
                />
              </div>

              <div className="form-group">
                <label>Patient</label>
                <input
                  type="text"
                  value={
                    selectedRecord?.patient_name ||
                    `Patient ID ${selectedRecord?.patient_id || ""}`
                  }
                  disabled
                />
              </div>

              <div className="form-group">
                <label>Dentist</label>
                <input
                  type="text"
                  value={
                    selectedRecord?.dentist_name ||
                    `Dentist ID ${selectedRecord?.dentist_id || ""}`
                  }
                  disabled
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeArchiveModal}
                >
                  Go Back
                </button>

                <button
                  type="submit"
                  className="danger-button"
                  disabled={archiving}
                >
                  {archiving ? "Archiving..." : "Confirm Archive"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default DentistDentalRecords;
