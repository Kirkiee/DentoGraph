import React, { useEffect, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import { useNavigate } from "react-router-dom";

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

function DentistXrays() {
  const navigate = useNavigate();

  const [records, setRecords] = useState([]);
  const [xrays, setXrays] = useState([]);
  const [teeth, setTeeth] = useState([]);

  const [selectedRecordId, setSelectedRecordId] = useState("");
  const [selectedToothId, setSelectedToothId] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  const [loadingRecords, setLoadingRecords] = useState(true);
  const [loadingXrays, setLoadingXrays] = useState(false);
  const [loadingTeeth, setLoadingTeeth] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
      fetchTeethByRecord(selectedRecordId);
    } else {
      setXrays([]);
      setTeeth([]);
      setSelectedToothId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRecordId]);

  const fetchRecords = async () => {
    try {
      setLoadingRecords(true);
      setError("");

      const response = await API.get("/api/dental-records", authHeaders);
      setRecords(response.data.dental_records || []);

      if ((response.data.dental_records || []).length > 0) {
        setSelectedRecordId(response.data.dental_records[0].record_id);
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

  const fetchTeethByRecord = async (recordId) => {
    try {
      setLoadingTeeth(true);

      const response = await API.get(
        `/api/dental-records/${recordId}`,
        authHeaders,
      );
      setTeeth(response.data.teeth || []);
    } catch (err) {
      console.error("Fetch teeth error:", err);
      setTeeth([]);
    } finally {
      setLoadingTeeth(false);
    }
  };

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0] || null);
  };

  const handleUploadXray = async (e) => {
    e.preventDefault();

    if (!selectedRecordId) {
      setError("Please select a dental record first.");
      return;
    }

    if (!selectedFile) {
      setError("Please choose an X-ray file to upload.");
      return;
    }

    try {
      setUploading(true);
      setMessage("");
      setError("");

      const formData = new FormData();
      formData.append("xray", selectedFile);
      formData.append("record_id", selectedRecordId);

      if (selectedToothId) {
        formData.append("tooth_id", selectedToothId);
      }

      await API.post("/api/xrays/upload", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      setMessage("X-ray uploaded successfully.");
      setSelectedFile(null);
      setSelectedToothId("");

      const fileInput = document.getElementById("xray-file-input");
      if (fileInput) {
        fileInput.value = "";
      }

      fetchXraysByRecord(selectedRecordId);
    } catch (err) {
      setError(
        formatSubscriptionError(
          err.response?.data?.error,
          "Unable to upload X-ray.",
        ),
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteXray = async (xrayId) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this X-ray record?",
    );

    if (!confirmDelete) return;

    try {
      setDeleting(true);
      setMessage("");
      setError("");

      await API.delete(`/api/xrays/${xrayId}`, authHeaders);

      setMessage("X-ray deleted successfully.");
      fetchXraysByRecord(selectedRecordId);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to delete X-ray.");
    } finally {
      setDeleting(false);
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
    <DashboardLayout role="Dentist">
      <div className="appointments-layout">
        <div className="appointment-form-card">
          <h2>Upload X-ray</h2>
          <p>
            Upload dental X-rays for a selected patient record. You may attach
            the X-ray to a specific tooth if tooth records are available.
          </p>

          <div className="info-message" style={{ marginBottom: "16px" }}>
            <strong>Subscription Reminder:</strong>
            <br />
            X-ray uploads are limited by the clinic subscription plan. If the
            clinic reaches its X-ray count or storage limit, ask the Clinic
            Owner to upgrade the subscription.
          </div>

          {message && <div className="success-message">{message}</div>}
          {error && <div className="error-message">{error}</div>}

          <form className="appointment-form" onSubmit={handleUploadXray}>
            <div className="form-group">
              <label>Dental Record</label>
              <select
                value={selectedRecordId}
                onChange={(e) => setSelectedRecordId(e.target.value)}
                required
                disabled={loadingRecords}
              >
                <option value="">Select Dental Record</option>
                {records.map((record) => (
                  <option key={record.record_id} value={record.record_id}>
                    Record #{record.record_id} -{" "}
                    {record.patient_name || `Patient ID ${record.patient_id}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Tooth</label>
              <select
                value={selectedToothId}
                onChange={(e) => setSelectedToothId(e.target.value)}
                disabled={!selectedRecordId || loadingTeeth}
              >
                <option value="">General X-ray / No specific tooth</option>
                {teeth.map((tooth) => (
                  <option key={tooth.tooth_id} value={tooth.tooth_id}>
                    Tooth #{tooth.tooth_number} -{" "}
                    {tooth.tooth_status || "Normal"}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>X-ray File</label>
              <input
                id="xray-file-input"
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.gif,.pdf"
                onChange={handleFileChange}
                required
              />
            </div>

            <button
              type="submit"
              className="primary-button"
              disabled={uploading}
            >
              {uploading ? "Uploading..." : "Upload X-ray"}
            </button>
          </form>
        </div>

        <div className="appointments-list-card">
          <div className="appointments-header">
            <div>
              <h2>Dentist X-rays</h2>
              <p>
                View uploaded X-rays, open files, and use AI-assisted annotation
                suggestions for review.
              </p>
            </div>

            <button
              className="secondary-button"
              onClick={() => {
                fetchRecords();
                if (selectedRecordId) {
                  fetchXraysByRecord(selectedRecordId);
                  fetchTeethByRecord(selectedRecordId);
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
                  <strong>Patient:</strong>{" "}
                  {selectedRecord.patient_name ||
                    `Patient ID ${selectedRecord.patient_id}`}
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
              <h3>No dental records found</h3>
              <p>Create a dental record first before uploading X-ray images.</p>
            </div>
          ) : loadingXrays ? (
            <p>Loading X-rays...</p>
          ) : xrays.length === 0 ? (
            <div className="empty-state">
              <h3>No X-rays uploaded</h3>
              <p>X-rays for the selected record will appear here.</p>
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
                            navigate(`/dentist/xrays/${xray.xray_id}/annotate`)
                          }
                        >
                          AI Annotate
                        </button>
                      )}

                      <button
                        className="danger-button"
                        onClick={() => handleDeleteXray(xray.xray_id)}
                        disabled={deleting}
                      >
                        {deleting ? "Deleting..." : "Delete"}
                      </button>
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

export default DentistXrays;
