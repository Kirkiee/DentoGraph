import React, { useEffect, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";

function DentistXrays() {
  const [records, setRecords] = useState([]);
  const [teeth, setTeeth] = useState([]);
  const [xrays, setXrays] = useState([]);

  const [formData, setFormData] = useState({
    record_id: "",
    tooth_id: "",
  });

  const [xrayFile, setXrayFile] = useState(null);

  const [loading, setLoading] = useState(true);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedXray, setSelectedXray] = useState(null);

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

  const fetchRecordDetails = async (recordId) => {
    if (!recordId) {
      setTeeth([]);
      setXrays([]);
      return;
    }

    try {
      setLoadingRecord(true);
      setError("");

      const recordResponse = await API.get(
        `/api/dental-records/${recordId}`,
        authHeaders,
      );

      setTeeth(recordResponse.data.teeth || []);

      const xrayResponse = await API.get(
        `/api/xrays/record/${recordId}`,
        authHeaders,
      );

      setXrays(xrayResponse.data.xrays || []);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load X-rays.");
    } finally {
      setLoadingRecord(false);
    }
  };

  const handleRecordChange = (e) => {
    const selectedRecordId = e.target.value;

    setFormData({
      record_id: selectedRecordId,
      tooth_id: "",
    });

    setXrayFile(null);
    setMessage("");
    setError("");

    fetchRecordDetails(selectedRecordId);
  };

  const handleToothChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      tooth_id: e.target.value,
    }));
  };

  const handleFileChange = (e) => {
    const file =
      e.target.files && e.target.files.length > 0 ? e.target.files[0] : null;

    if (!file) {
      setXrayFile(null);
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/gif",
      "application/pdf",
    ];

    const allowedExtensions = /\.(jpg|jpeg|png|webp|gif|pdf)$/i;

    if (
      !allowedTypes.includes(file.type) &&
      !allowedExtensions.test(file.name)
    ) {
      setError("Only JPG, JPEG, PNG, WEBP, GIF, and PDF files are allowed.");
      setXrayFile(null);

      const fileInput = document.getElementById("xray-file-input");
      if (fileInput) {
        fileInput.value = "";
      }

      return;
    }

    setError("");
    setMessage("");
    setXrayFile(file);
  };

  const handleUploadXray = async (e) => {
    e.preventDefault();

    if (!formData.record_id) {
      setError("Please select a dental record first.");
      return;
    }

    if (!xrayFile) {
      setError("Please select an X-ray file to upload.");
      return;
    }

    try {
      setUploading(true);
      setMessage("");
      setError("");

      const uploadData = new FormData();
      uploadData.append("record_id", formData.record_id);

      if (formData.tooth_id) {
        uploadData.append("tooth_id", formData.tooth_id);
      }

      uploadData.append("xray", xrayFile);

      await API.post("/api/xrays/upload", uploadData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      setMessage("X-ray uploaded successfully.");
      setXrayFile(null);

      const fileInput = document.getElementById("xray-file-input");
      if (fileInput) {
        fileInput.value = "";
      }

      fetchRecordDetails(formData.record_id);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to upload X-ray.");
    } finally {
      setUploading(false);
    }
  };

  const openDeleteModal = (xray) => {
    setSelectedXray(xray);
    setMessage("");
    setError("");
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setSelectedXray(null);
  };

  const handleDeleteXray = async (e) => {
    e.preventDefault();

    if (!selectedXray) {
      setError("No X-ray selected for deletion.");
      return;
    }

    try {
      setDeletingId(selectedXray.xray_id);
      setMessage("");
      setError("");

      await API.delete(`/api/xrays/${selectedXray.xray_id}`, authHeaders);

      setMessage("X-ray deleted successfully.");
      closeDeleteModal();
      fetchRecordDetails(formData.record_id);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to delete X-ray.");
    } finally {
      setDeletingId(null);
    }
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

  const getSelectedRecord = () => {
    return records.find(
      (record) => Number(record.record_id) === Number(formData.record_id),
    );
  };

  const selectedRecord = getSelectedRecord();

  return (
    <DashboardLayout role="Dentist">
      <div className="appointments-layout">
        <div className="appointment-form-card">
          <h2>Upload X-ray</h2>
          <p>
            Select a dental record and upload an X-ray image or PDF. You may
            optionally connect the X-ray to a specific tooth.
          </p>

          {message && <div className="success-message">{message}</div>}
          {error && <div className="error-message">{error}</div>}

          <form className="appointment-form" onSubmit={handleUploadXray}>
            <div className="form-group">
              <label>Dental Record</label>
              <select
                name="record_id"
                value={formData.record_id}
                onChange={handleRecordChange}
                required
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
              <label>Related Tooth Optional</label>
              <select
                name="tooth_id"
                value={formData.tooth_id}
                onChange={handleToothChange}
                disabled={!formData.record_id || teeth.length === 0}
              >
                <option value="">No specific tooth</option>
                {teeth.map((tooth) => (
                  <option key={tooth.tooth_id} value={tooth.tooth_id}>
                    Tooth #{tooth.tooth_number} - {tooth.tooth_status}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>X-ray File</label>
              <input
                id="xray-file-input"
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,application/pdf,.jpg,.jpeg,.png,.webp,.gif,.pdf"
                onChange={handleFileChange}
                required
              />

              {xrayFile && <small>Selected file: {xrayFile.name}</small>}
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
              <h2>X-ray Images</h2>
              <p>View uploaded X-rays connected to a selected dental record.</p>
            </div>

            <button
              className="secondary-button"
              onClick={() => {
                fetchRecords();
                if (formData.record_id) {
                  fetchRecordDetails(formData.record_id);
                }
              }}
              disabled={loading || loadingRecord}
            >
              {loading || loadingRecord ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {loading ? (
            <p>Loading dental records...</p>
          ) : !formData.record_id ? (
            <div className="empty-state">
              <h3>Select a dental record</h3>
              <p>
                Choose a dental record from the upload form to view its uploaded
                X-rays.
              </p>
            </div>
          ) : loadingRecord ? (
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
                      <strong>Patient:</strong>{" "}
                      {selectedRecord.patient_name ||
                        `Patient ID ${selectedRecord.patient_id}`}
                    </p>

                    <p>
                      <strong>Dentist:</strong>{" "}
                      {selectedRecord.dentist_name ||
                        `Dentist ID ${selectedRecord.dentist_id}`}
                    </p>
                  </div>
                </div>
              )}

              <div style={{ marginTop: "22px" }}>
                {xrays.length === 0 ? (
                  <div className="empty-state">
                    <h3>No X-rays uploaded yet</h3>
                    <p>
                      Uploaded X-ray images for this dental record will appear
                      here.
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

                          <button
                            className="danger-button"
                            disabled={deletingId === xray.xray_id}
                            onClick={() => openDeleteModal(xray)}
                          >
                            {deletingId === xray.xray_id
                              ? "Deleting..."
                              : "Delete"}
                          </button>
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

      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>Delete X-ray</h3>
                <p>
                  Are you sure you want to delete X-ray #{selectedXray?.xray_id}
                  ? This action cannot be undone.
                </p>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closeDeleteModal}
              >
                ×
              </button>
            </div>

            <form className="modal-form" onSubmit={handleDeleteXray}>
              <div className="form-group">
                <label>Dental Record</label>
                <input
                  type="text"
                  value={
                    selectedXray?.record_id
                      ? `Record #${selectedXray.record_id}`
                      : ""
                  }
                  disabled
                />
              </div>

              <div className="form-group">
                <label>Related Tooth</label>
                <input
                  type="text"
                  value={
                    selectedXray?.tooth_number
                      ? `Tooth #${selectedXray.tooth_number}`
                      : "General record X-ray"
                  }
                  disabled
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeDeleteModal}
                >
                  Keep X-ray
                </button>

                <button
                  type="submit"
                  className="danger-button"
                  disabled={deletingId === selectedXray?.xray_id}
                >
                  {deletingId === selectedXray?.xray_id
                    ? "Deleting..."
                    : "Delete X-ray"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default DentistXrays;
