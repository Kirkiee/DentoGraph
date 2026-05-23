import React, { useEffect, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";

function PatientXrays() {
  const [records, setRecords] = useState([]);
  const [xrays, setXrays] = useState([]);

  const [selectedRecordId, setSelectedRecordId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingXrays, setLoadingXrays] = useState(false);
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

  const fetchRecords = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await API.get(
        "/api/dental-records/patient/my-records/list",
        authHeaders,
      );

      setRecords(response.data.dental_records || []);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load dental records.");
    } finally {
      setLoading(false);
    }
  };

  const fetchXrays = async (recordId) => {
    if (!recordId) {
      setXrays([]);
      return;
    }

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

  const handleRecordChange = (e) => {
    const recordId = e.target.value;
    setSelectedRecordId(recordId);
    fetchXrays(recordId);
  };

  const getFileUrl = (filePath) => {
    if (!filePath) return "#";

    const normalizedPath = filePath.replace(/\\/g, "/");

    if (normalizedPath.startsWith("http")) {
      return normalizedPath;
    }

    return `http://localhost:5000/${normalizedPath}`;
  };

  const isImageFile = (filePath) => {
    return /\.(jpg|jpeg|png|webp|gif)$/i.test(filePath || "");
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
            Select one of your dental records to view uploaded X-ray images and
            related files.
          </p>

          {error && <div className="error-message">{error}</div>}

          <form className="appointment-form">
            <div className="form-group">
              <label>Dental Record</label>
              <select
                value={selectedRecordId}
                onChange={handleRecordChange}
                disabled={loading}
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
                  fetchXrays(selectedRecordId);
                }
              }}
              disabled={loading || loadingXrays}
            >
              {loading || loadingXrays ? "Refreshing..." : "Refresh"}
            </button>
          </form>
        </div>

        <div className="appointments-list-card">
          <div className="appointments-header">
            <div>
              <h2>X-ray Images</h2>
              <p>
                View X-rays uploaded by your dentist for the selected dental
                record.
              </p>
            </div>
          </div>

          {loading ? (
            <p>Loading dental records...</p>
          ) : records.length === 0 ? (
            <div className="empty-state">
              <h3>No dental records yet</h3>
              <p>
                Your X-rays will appear here once your dentist creates a dental
                record and uploads files.
              </p>
            </div>
          ) : !selectedRecordId ? (
            <div className="empty-state">
              <h3>Select a dental record</h3>
              <p>
                Choose a dental record from the left side to view its uploaded
                X-rays.
              </p>
            </div>
          ) : loadingXrays ? (
            <p>Loading X-rays...</p>
          ) : (
            <>
              {selectedRecord && (
                <div className="appointment-item">
                  <div className="appointment-info">
                    <div className="appointment-title-row">
                      <h3>Record #{selectedRecord.record_id}</h3>
                      <span className="status-badge status-scheduled">
                        Selected
                      </span>
                    </div>

                    <p>
                      <strong>Dentist:</strong>{" "}
                      {selectedRecord.dentist_name ||
                        `Dentist ID ${selectedRecord.dentist_id}`}
                    </p>

                    <p>
                      <strong>Date Created:</strong>{" "}
                      {selectedRecord.date_created
                        ? new Date(selectedRecord.date_created).toLocaleString()
                        : "N/A"}
                    </p>
                  </div>
                </div>
              )}

              <div style={{ marginTop: "22px" }}>
                {xrays.length === 0 ? (
                  <div className="empty-state">
                    <h3>No X-rays uploaded yet</h3>
                    <p>
                      X-ray images for this record will appear here once
                      uploaded by your dentist.
                    </p>
                  </div>
                ) : (
                  <div className="xray-grid">
                    {xrays.map((xray) => (
                      <div className="xray-card" key={xray.xray_id}>
                        <div className="xray-preview">
                          {isImageFile(xray.file_path) ? (
                            <img
                              src={getFileUrl(xray.file_path)}
                              alt={`X-ray ${xray.xray_id}`}
                            />
                          ) : (
                            <div className="xray-pdf-preview">PDF</div>
                          )}
                        </div>

                        <div className="xray-info">
                          <h3>X-ray #{xray.xray_id}</h3>

                          <p>
                            <strong>Tooth:</strong>{" "}
                            {xray.tooth_number
                              ? `Tooth #${xray.tooth_number}`
                              : "General record X-ray"}
                          </p>

                          <p>
                            <strong>Uploaded:</strong>{" "}
                            {xray.upload_date
                              ? new Date(xray.upload_date).toLocaleString()
                              : "N/A"}
                          </p>
                        </div>

                        <div className="xray-actions">
                          <a
                            href={getFileUrl(xray.file_path)}
                            target="_blank"
                            rel="noreferrer"
                            className="secondary-button"
                          >
                            View
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default PatientXrays;
