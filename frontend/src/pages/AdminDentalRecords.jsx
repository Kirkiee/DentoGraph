import React, { useEffect, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import { useNavigate } from "react-router-dom";

function AdminDentalRecords() {
  const navigate = useNavigate();

  const [records, setRecords] = useState([]);
  const [statusFilter, setStatusFilter] = useState("Active");
  const [searchTerm, setSearchTerm] = useState("");

  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);

  const [showRestoreModal, setShowRestoreModal] = useState(false);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await API.get(
        `/api/dental-records?status=${statusFilter}`,
        authHeaders,
      );

      setRecords(response.data.dental_records || []);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load dental records.");
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = records.filter((record) => {
    if (!searchTerm.trim()) return true;

    const term = searchTerm.toLowerCase();

    return (
      String(record.record_id).includes(term) ||
      record.patient_name?.toLowerCase().includes(term) ||
      record.patient_email?.toLowerCase().includes(term) ||
      record.dentist_name?.toLowerCase().includes(term) ||
      record.clinic_name?.toLowerCase().includes(term)
    );
  });

  const openRestoreModal = (record) => {
    setSelectedRecord(record);
    setMessage("");
    setError("");
    setShowRestoreModal(true);
  };

  const closeRestoreModal = () => {
    setShowRestoreModal(false);
    setSelectedRecord(null);
  };

  const handleRestoreRecord = async (e) => {
    e.preventDefault();

    if (!selectedRecord) {
      setError("No dental record selected for restoration.");
      return;
    }

    try {
      setRestoring(true);
      setMessage("");
      setError("");

      await API.put(
        `/api/dental-records/${selectedRecord.record_id}/restore`,
        {},
        authHeaders,
      );

      setMessage(`Record #${selectedRecord.record_id} restored successfully.`);
      closeRestoreModal();
      fetchRecords();
    } catch (err) {
      setError(err.response?.data?.error || "Unable to restore dental record.");
    } finally {
      setRestoring(false);
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case "Archived":
        return "status-badge status-cancelled";
      case "Active":
      default:
        return "status-badge status-scheduled";
    }
  };

  const activeCount = records.filter(
    (record) => record.status === "Active",
  ).length;
  const archivedCount = records.filter(
    (record) => record.status === "Archived",
  ).length;

  return (
    <DashboardLayout role="Admin">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>Dental Records Management</h2>
            <p>
              View active and archived dental records. Restore archived records
              when needed.
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

        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}

        <div className="dashboard-grid" style={{ marginBottom: "24px" }}>
          <div className="dashboard-card">
            <h3>Listed Records</h3>
            <strong>{filteredRecords.length}</strong>
          </div>

          <div className="dashboard-card">
            <h3>Current Filter</h3>
            <strong>{statusFilter}</strong>
          </div>

          <div className="dashboard-card">
            <h3>Active in List</h3>
            <strong>{activeCount}</strong>
          </div>

          <div className="dashboard-card">
            <h3>Archived in List</h3>
            <strong>{archivedCount}</strong>
          </div>
        </div>

        <div className="appointment-filters">
          <div className="form-group">
            <label>Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search record ID, patient, dentist, clinic, or email"
            />
          </div>

          <div className="form-group">
            <label>Record Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="Active">Active</option>
              <option value="Archived">Archived</option>
              <option value="All">All</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p>Loading dental records...</p>
        ) : filteredRecords.length === 0 ? (
          <div className="empty-state">
            <h3>No dental records found</h3>
            <p>Dental records matching the selected filter will appear here.</p>
          </div>
        ) : (
          <div className="appointments-list">
            {filteredRecords.map((record) => (
              <div className="appointment-item" key={record.record_id}>
                <div className="appointment-info">
                  <div className="appointment-title-row">
                    <h3>Record #{record.record_id}</h3>

                    <span className={getStatusClass(record.status)}>
                      {record.status || "Active"}
                    </span>
                  </div>

                  <p>
                    <strong>Patient:</strong>{" "}
                    {record.patient_name || `Patient ID ${record.patient_id}`}
                  </p>

                  <p>
                    <strong>Patient Email:</strong>{" "}
                    {record.patient_email || "N/A"}
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
                      navigate(`/admin/dental-records/${record.record_id}`)
                    }
                  >
                    View Details
                  </button>

                  {record.status === "Archived" && (
                    <button
                      className="primary-button"
                      disabled={restoring}
                      onClick={() => openRestoreModal(record)}
                    >
                      Restore
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showRestoreModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>Restore Dental Record</h3>
                <p>
                  Confirm that you want to restore this archived dental record.
                  It will appear again in normal record lists.
                </p>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closeRestoreModal}
              >
                ×
              </button>
            </div>

            <form className="modal-form" onSubmit={handleRestoreRecord}>
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
                  onClick={closeRestoreModal}
                >
                  Go Back
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={restoring}
                >
                  {restoring ? "Restoring..." : "Confirm Restore"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default AdminDentalRecords;
