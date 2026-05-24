import React, { useEffect, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import { useNavigate } from "react-router-dom";

function PatientXrays() {
  const navigate = useNavigate();

  const [records, setRecords] = useState([]);
  const [xrays, setXrays] = useState([]);

  const [selectedRecordId, setSelectedRecordId] = useState("");

  const [loadingRecords, setLoadingRecords] = useState(true);
  const [loadingXrays, setLoadingXrays] = useState(false);

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
  }, []);

  useEffect(() => {
    if (selectedRecordId) {
      fetchXraysByRecord(selectedRecordId);
    } else {
      setXrays([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRecordId]);

  const fetchRecords = async () => {
    try {
      setLoadingRecords(true);
      setError("");

      const response = await API.get(
        "/api/dental-records/patient/my-records/list",
        authHeaders,
      );

      const patientRecords = response.data.dental_records || [];
      setRecords(patientRecords);

      if (patientRecords.length > 0) {
        setSelectedRecordId(patientRecords[0].record_id);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load dental records.");
    } finally {
      setLoadingRecords(false);
    }
  };

  const fetchXraysByRecord = async (recordId) => {
    try {
      setLoadingXrays(true);
      setError("");

      const response = await API.get(
        `/api/xrays/record/${recordId}`,
        authHeaders,
      );
      setXrays(response.data.xrays || []);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load X-rays.");
    } finally {
      setLoadingXrays(false);
    }
  };

  const getFileUrl = (filePath) => {
    if (!filePath) return "";

    const baseURL = process.env.REACT_APP_API_URL || "http://localhost:5000";

    return `${baseURL}/${filePath}`;
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return "N/A";
    return new Date(dateValue).toLocaleString();
  };

  const selectedRecord = records.find(
    (record) => Number(record.record_id) === Number(selectedRecordId),
  );

  return (
    <DashboardLayout role="Patient">
      <div className="appointments-layout">
        <div className="appointment-form-card">
          <h2>My X-rays</h2>
          <p>
            Select one of your dental records to view uploaded X-ray files and
            request AI-assisted review.
          </p>

          {message && <div className="success-message">{message}</div>}
          {error && <div className="error-message">{error}</div>}

          <div className="appointment-form">
            <div className="form-group">
              <label>Dental Record</label>
              <select
                value={selectedRecordId}
                onChange={(e) => setSelectedRecordId(e.target.value)}
                disabled={loadingRecords}
              >
                <option value="">Select Dental Record</option>
                {records.map((record) => (
                  <option key={record.record_id} value={record.record_id}>
                    Record #{record.record_id} -{" "}
                    {record.dentist_name || `Dentist ID ${record.dentist_id}`}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                fetchRecords();
                if (selectedRecordId) {
                  fetchXraysByRecord(selectedRecordId);
                }
              }}
              disabled={loadingRecords || loadingXrays}
            >
              {loadingRecords || loadingXrays ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div className="info-message" style={{ marginTop: "18px" }}>
            AI-assisted X-ray findings are not final diagnoses. You may request
            AI analysis, but results must be reviewed and confirmed by your
            dentist before they are shown as clinical findings.
          </div>
        </div>

        <div className="appointments-list-card">
          <div className="appointments-header">
            <div>
              <h2>X-ray Files</h2>
              <p>
                View X-rays uploaded by your dental care team and open
                dentist-confirmed AI-assisted annotations.
              </p>
            </div>

            <button
              className="secondary-button"
              onClick={() => {
                fetchRecords();
                if (selectedRecordId) {
                  fetchXraysByRecord(selectedRecordId);
                }
              }}
              disabled={loadingRecords || loadingXrays}
            >
              {loadingRecords || loadingXrays ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {selectedRecord && (
            <div className="appointment-item" style={{ marginBottom: "18px" }}>
              <div className="appointment-info">
                <div className="appointment-title-row">
                  <h3>Selected Record #{selectedRecord.record_id}</h3>

                  <span className="status-badge status-scheduled">
                    {selectedRecord.status || "Active"}
                  </span>
                </div>

                <p>
                  <strong>Dentist:</strong>{" "}
                  {selectedRecord.dentist_name ||
                    `Dentist ID ${selectedRecord.dentist_id}`}
                </p>

                <p>
                  <strong>Clinic:</strong>{" "}
                  {selectedRecord.clinic_name || "No assigned clinic"}
                </p>
              </div>
            </div>
          )}

          {loadingRecords ? (
            <p>Loading dental records...</p>
          ) : records.length === 0 ? (
            <div className="empty-state">
              <h3>No dental records yet</h3>
              <p>Your dental records and X-rays will appear here once added.</p>
            </div>
          ) : loadingXrays ? (
            <p>Loading X-rays...</p>
          ) : xrays.length === 0 ? (
            <div className="empty-state">
              <h3>No X-rays uploaded</h3>
              <p>
                X-rays for the selected record will appear here once uploaded.
              </p>
            </div>
          ) : (
            <div className="appointments-list">
              {xrays.map((xray) => {
                const isPdf = xray.file_path?.toLowerCase().endsWith(".pdf");

                return (
                  <div className="appointment-item" key={xray.xray_id}>
                    <div className="appointment-info">
                      <div className="appointment-title-row">
                        <h3>X-ray #{xray.xray_id}</h3>

                        <span className="status-badge status-scheduled">
                          {xray.tooth_number
                            ? `Tooth #${xray.tooth_number}`
                            : "General"}
                        </span>
                      </div>

                      <p>
                        <strong>Record ID:</strong> {xray.record_id}
                      </p>

                      <p>
                        <strong>Tooth:</strong>{" "}
                        {xray.tooth_number
                          ? `Tooth #${xray.tooth_number}`
                          : "No specific tooth"}
                      </p>

                      <p>
                        <strong>Uploaded:</strong>{" "}
                        {formatDate(xray.upload_date)}
                      </p>

                      <p>
                        <strong>File Path:</strong> {xray.file_path}
                      </p>
                    </div>

                    <div className="appointment-actions">
                      <a
                        className="secondary-button"
                        href={getFileUrl(xray.file_path)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open File
                      </a>

                      {!isPdf && (
                        <button
                          className="primary-button"
                          onClick={() =>
                            navigate(
                              `/patient/xrays/${xray.xray_id}/annotations`,
                            )
                          }
                        >
                          AI Review
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default PatientXrays;
