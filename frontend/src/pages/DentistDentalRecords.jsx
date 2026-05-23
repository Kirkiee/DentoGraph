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

      await API.post(
        "/api/dental-records",
        {
          patient_id: Number(selectedPatientId),
        },
        authHeaders,
      );

      setMessage("Dental record created successfully.");
      setSelectedPatientId("");
      fetchRecords();
    } catch (err) {
      setError(err.response?.data?.error || "Unable to create dental record.");
    } finally {
      setCreating(false);
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
                View dental records created for patients under the DentoGraph
                system.
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
                      <span className="status-badge status-scheduled">
                        Active
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

export default DentistDentalRecords;
