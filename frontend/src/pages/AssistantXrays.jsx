import React, { useEffect, useMemo, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";

function AssistantXrays() {
  const [records, setRecords] = useState([]);
  const [xrays, setXrays] = useState([]);
  const [teeth, setTeeth] = useState([]);

  const [selectedRecordId, setSelectedRecordId] = useState("");
  const [selectedToothId, setSelectedToothId] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [fileTypeFilter, setFileTypeFilter] = useState("All");

  const [loadingRecords, setLoadingRecords] = useState(true);
  const [loadingXrays, setLoadingXrays] = useState(false);
  const [loadingTeeth, setLoadingTeeth] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingXrayId, setDeletingXrayId] = useState(null);

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

  useEffect(() => {
    if (showDeleteModal) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }

    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [showDeleteModal]);

  const fetchRecords = async () => {
    try {
      setLoadingRecords(true);
      setError("");

      const response = await API.get("/api/dental-records", authHeaders);
      const dentalRecords = response.data.dental_records || [];

      setRecords(dentalRecords);

      if (dentalRecords.length > 0 && !selectedRecordId) {
        setSelectedRecordId(String(dentalRecords[0].record_id));
      }
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load dental records.");
    } finally {
      setLoadingRecords(false);
    }
  };

  const fetchXraysByRecord = async (recordId) => {
    if (!recordId) return;

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
    if (!recordId) return;

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

  const refreshPage = async () => {
    try {
      setRefreshing(true);
      setError("");
      setMessage("");

      await fetchRecords();

      if (selectedRecordId) {
        await Promise.all([
          fetchXraysByRecord(selectedRecordId),
          fetchTeethByRecord(selectedRecordId),
        ]);
      }
    } finally {
      setRefreshing(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null;

    if (!file) {
      setSelectedFile(null);
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
      setSelectedFile(null);

      const fileInput = document.getElementById("assistant-xray-file-input");
      if (fileInput) fileInput.value = "";

      return;
    }

    setSelectedFile(file);
    setMessage("");
    setError("");
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

      const fileInput = document.getElementById("assistant-xray-file-input");
      if (fileInput) fileInput.value = "";

      fetchXraysByRecord(selectedRecordId);
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
    if (deletingXrayId) return;

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
      setDeletingXrayId(selectedXray.xray_id);
      setMessage("");
      setError("");

      await API.delete(`/api/xrays/${selectedXray.xray_id}`, authHeaders);

      setMessage("X-ray deleted successfully.");
      closeDeleteModal();
      fetchXraysByRecord(selectedRecordId);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to delete X-ray.");
    } finally {
      setDeletingXrayId(null);
    }
  };

  const getFileUrl = (filePath) => {
    if (!filePath) return "";

    const normalizedPath = String(filePath).replace(/\\/g, "/");

    if (
      normalizedPath.startsWith("http://") ||
      normalizedPath.startsWith("https://")
    ) {
      return normalizedPath;
    }

    const baseURL = process.env.REACT_APP_API_URL || "http://localhost:5000";
    const cleanPath = normalizedPath.startsWith("/")
      ? normalizedPath.slice(1)
      : normalizedPath;

    return `${baseURL}/${cleanPath}`;
  };

  const getFileName = (filePath) => {
    if (!filePath) return "Uploaded X-ray file";

    const normalizedPath = String(filePath).replace(/\\/g, "/");
    const parts = normalizedPath.split("/");

    return parts[parts.length - 1] || "Uploaded X-ray file";
  };

  const getFileType = (filePath) => {
    const fileName = getFileName(filePath).toLowerCase();

    if (fileName.endsWith(".pdf")) return "PDF";

    if (
      fileName.endsWith(".jpg") ||
      fileName.endsWith(".jpeg") ||
      fileName.endsWith(".png") ||
      fileName.endsWith(".webp") ||
      fileName.endsWith(".gif")
    ) {
      return "Image";
    }

    return "Other";
  };

  const isImageFile = (filePath) => {
    return getFileType(filePath) === "Image";
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return "N/A";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "N/A";
    }

    return date.toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const selectedRecord = records.find(
    (record) => Number(record.record_id) === Number(selectedRecordId),
  );

  const filteredXrays = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return xrays.filter((xray) => {
      const type = getFileType(xray.file_path);

      const matchesFileType =
        fileTypeFilter === "All" || type === fileTypeFilter;

      const searchableText = [
        xray.xray_id,
        xray.record_id,
        xray.tooth_number,
        xray.file_path,
        getFileName(xray.file_path),
        type,
        xray.upload_date,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !search || searchableText.includes(search);

      return matchesFileType && matchesSearch;
    });
  }, [xrays, searchTerm, fileTypeFilter]);

  const xraySummary = useMemo(() => {
    return {
      total: xrays.length,
      images: xrays.filter((xray) => getFileType(xray.file_path) === "Image")
        .length,
      pdfs: xrays.filter((xray) => getFileType(xray.file_path) === "PDF")
        .length,
      toothSpecific: xrays.filter((xray) => xray.tooth_number).length,
    };
  }, [xrays]);

  const clearFilters = () => {
    setSearchTerm("");
    setFileTypeFilter("All");
  };

  const renderLoadingState = () => {
    return (
      <div className="appointments-list">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="appointment-item loading-card" key={index}>
            <div className="appointment-info">
              <div className="loading-line loading-title"></div>
              <div className="loading-line loading-text"></div>
              <div className="loading-line loading-text"></div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <DashboardLayout role="Assistant">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>Assistant X-rays</h2>
            <p>
              Upload, review, filter, open, and manage X-ray files linked to
              clinic dental records.
            </p>
          </div>

          <div className="appointment-actions">
            <button
              className="secondary-button"
              onClick={refreshPage}
              disabled={loadingRecords || loadingXrays || refreshing}
            >
              {loadingRecords || loadingXrays || refreshing
                ? "Refreshing..."
                : "Refresh"}
            </button>
          </div>
        </div>

        <div className="info-message">
          <strong>Assistant Access:</strong>
          <br />
          Assistants may upload and manage clinic X-ray files for documentation.
          AI interpretation and final clinical review remain under the dentist
          workflow.
        </div>

        {message && <div className="success-message">{message}</div>}

        {error && (
          <div className="error-message">
            <strong>X-ray notice</strong>
            <p>{error}</p>
          </div>
        )}

        <div className="patient-dashboard-summary-grid">
          <div className="patient-dashboard-card">
            <span>Total X-rays</span>
            <strong>{xraySummary.total}</strong>
            <p>Files linked to the selected record.</p>
          </div>

          <div className="patient-dashboard-card">
            <span>Image Files</span>
            <strong>{xraySummary.images}</strong>
            <p>Image uploads linked to this record.</p>
          </div>

          <div className="patient-dashboard-card">
            <span>PDF Files</span>
            <strong>{xraySummary.pdfs}</strong>
            <p>PDF reference documents.</p>
          </div>

          <div className="patient-dashboard-card">
            <span>Tooth-specific</span>
            <strong>{xraySummary.toothSpecific}</strong>
            <p>X-rays attached to a tooth record.</p>
          </div>
        </div>

        <div className="patient-dashboard-section">
          <div className="appointments-header">
            <div>
              <h2>Upload X-ray</h2>
              <p>
                Select a dental record, optionally attach a tooth, then upload
                an image or PDF X-ray file.
              </p>
            </div>
          </div>

          <form
            className="dentist-xray-upload-form"
            onSubmit={handleUploadXray}
          >
            <div className="form-group">
              <label>Dental Record</label>
              <select
                value={selectedRecordId}
                onChange={(e) => {
                  setSelectedRecordId(e.target.value);
                  setSelectedToothId("");
                  setMessage("");
                  setError("");
                }}
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
              <label>Related Tooth Optional</label>
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

            <div className="form-group dentist-xray-file-field">
              <label>X-ray File</label>
              <input
                id="assistant-xray-file-input"
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.gif,.pdf"
                onChange={handleFileChange}
                required
              />

              {selectedFile && (
                <p className="dentist-xray-selected-file">
                  Selected file: <strong>{selectedFile.name}</strong>
                </p>
              )}
            </div>

            <div className="appointment-actions dentist-xray-upload-actions">
              <button
                type="submit"
                className="primary-button"
                disabled={uploading || !selectedRecordId || !selectedFile}
              >
                {uploading ? "Uploading..." : "Upload X-ray"}
              </button>
            </div>
          </form>
        </div>

        <div className="patient-dashboard-section">
          <div className="appointments-header">
            <div>
              <h2>Selected Record</h2>
              <p>
                Review the current patient record context before managing
                X-rays.
              </p>
            </div>
          </div>

          {selectedRecord ? (
            <div className="appointment-item dentist-xray-selected-record">
              <div className="appointment-info">
                <div className="appointment-title-row">
                  <h3>Record #{selectedRecord.record_id}</h3>
                  <span className="status-badge status-scheduled">
                    {selectedRecord.status || "Active"}
                  </span>
                </div>

                <div className="dentist-xray-record-grid">
                  <p>
                    <strong>Patient:</strong>{" "}
                    {selectedRecord.patient_name ||
                      `Patient ID ${selectedRecord.patient_id}`}
                  </p>

                  <p>
                    <strong>Clinic:</strong>{" "}
                    {selectedRecord.clinic_name || "No assigned clinic"}
                  </p>

                  <p>
                    <strong>Dentist:</strong>{" "}
                    {selectedRecord.dentist_name ||
                      `Dentist ID ${selectedRecord.dentist_id}`}
                  </p>

                  <p>
                    <strong>Status:</strong> {selectedRecord.status || "Active"}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <h3>No record selected</h3>
              <p>Select a dental record to view and upload X-rays.</p>
            </div>
          )}
        </div>

        <div className="patient-dashboard-section">
          <div className="appointments-header">
            <div>
              <h2>X-ray List</h2>
              <p>
                {loadingXrays
                  ? "Loading X-rays..."
                  : `${filteredXrays.length} of ${xrays.length} X-rays shown.`}
              </p>
            </div>

            {(searchTerm || fileTypeFilter !== "All") && (
              <button
                type="button"
                className="secondary-button"
                onClick={clearFilters}
              >
                Clear Filters
              </button>
            )}
          </div>

          <div className="dentist-xray-filter-panel">
            <div className="form-group">
              <label>Search X-rays</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search file name, tooth number, or X-ray ID"
                disabled={loadingXrays}
              />
            </div>

            <div className="form-group">
              <label>File Type</label>
              <select
                value={fileTypeFilter}
                onChange={(e) => setFileTypeFilter(e.target.value)}
                disabled={loadingXrays}
              >
                <option value="All">All File Types</option>
                <option value="Image">Images</option>
                <option value="PDF">PDF</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {loadingRecords ? (
            renderLoadingState()
          ) : records.length === 0 ? (
            <div className="empty-state">
              <h3>No dental records found</h3>
              <p>Create a dental record first before uploading X-ray images.</p>
            </div>
          ) : loadingXrays ? (
            renderLoadingState()
          ) : xrays.length === 0 ? (
            <div className="empty-state">
              <h3>No X-rays uploaded</h3>
              <p>X-rays for the selected record will appear here.</p>
            </div>
          ) : filteredXrays.length === 0 ? (
            <div className="empty-state">
              <h3>No matching X-rays</h3>
              <p>Try changing the search or file type filter.</p>
              <button
                type="button"
                className="secondary-button"
                onClick={clearFilters}
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="dentist-xray-grid">
              {filteredXrays.map((xray) => {
                const fileType = getFileType(xray.file_path);
                const fileUrl = getFileUrl(xray.file_path);

                return (
                  <div className="dentist-xray-card" key={xray.xray_id}>
                    <div className="dentist-xray-preview">
                      {isImageFile(xray.file_path) ? (
                        <img src={fileUrl} alt={`X-ray ${xray.xray_id}`} />
                      ) : (
                        <div className="dentist-xray-file-placeholder">
                          <strong>{fileType}</strong>
                          <span>{getFileName(xray.file_path)}</span>
                        </div>
                      )}
                    </div>

                    <div className="appointment-info">
                      <div className="appointment-title-row">
                        <h3>X-ray #{xray.xray_id}</h3>

                        <span className="status-badge status-scheduled">
                          {xray.tooth_number
                            ? `Tooth #${xray.tooth_number}`
                            : "General"}
                        </span>

                        <span className="status-badge status-pending">
                          {fileType}
                        </span>
                      </div>

                      <div className="dentist-xray-detail-grid">
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
                          <strong>File:</strong> {getFileName(xray.file_path)}
                        </p>
                      </div>

                      <div className="appointment-actions dentist-xray-card-actions">
                        <a
                          className="secondary-button"
                          href={fileUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open File
                        </a>

                        <button
                          className="danger-button"
                          onClick={() => openDeleteModal(xray)}
                          disabled={Boolean(deletingXrayId)}
                        >
                          {deletingXrayId === xray.xray_id
                            ? "Deleting..."
                            : "Delete"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
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
                disabled={Boolean(deletingXrayId)}
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

              <div className="error-message">
                This will remove the X-ray record and file from the system.
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeDeleteModal}
                  disabled={Boolean(deletingXrayId)}
                >
                  Keep X-ray
                </button>

                <button
                  type="submit"
                  className="danger-button"
                  disabled={deletingXrayId === selectedXray?.xray_id}
                >
                  {deletingXrayId === selectedXray?.xray_id
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

export default AssistantXrays;
