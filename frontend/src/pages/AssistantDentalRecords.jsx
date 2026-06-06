import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";

function AssistantDentalRecords() {
  const navigate = useNavigate();

  const [records, setRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [loading, setLoading] = useState(true);
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
  }, []);

  useEffect(() => {
    filterRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, searchTerm]);

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

  const filterRecords = () => {
    if (searchTerm.trim() === "") {
      setFilteredRecords(records);
      return;
    }

    const term = searchTerm.toLowerCase();

    const filtered = records.filter(
      (record) =>
        record.patient_name?.toLowerCase().includes(term) ||
        record.dentist_name?.toLowerCase().includes(term) ||
        String(record.record_id).includes(term),
    );

    setFilteredRecords(filtered);
  };

  return (
    <DashboardLayout role="Assistant">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>Dental Records</h2>
            <p>
              View patient dental records and assist in updating tooth
              information.
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

        {error && <div className="error-message">{error}</div>}

        <div className="appointment-filters">
          <div className="form-group">
            <label>Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by record ID, patient, or dentist"
            />
          </div>

          <div className="form-group">
            <label>Total Records</label>
            <input type="text" value={records.length} disabled />
          </div>
        </div>

        {loading ? (
          <p>Loading dental records...</p>
        ) : filteredRecords.length === 0 ? (
          <div className="empty-state">
            <h3>No dental records found</h3>
            <p>Dental records created by dentists will appear here.</p>
          </div>
        ) : (
          <div className="appointments-list">
            {filteredRecords.map((record) => (
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
                      navigate(`/assistant/records/${record.record_id}`)
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
    </DashboardLayout>
  );
}

export default AssistantDentalRecords;
