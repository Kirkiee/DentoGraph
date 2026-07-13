import React, { useEffect, useMemo, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import { useNavigate } from "react-router-dom";

function PatientXrays() {
  const navigate = useNavigate();

  const [records, setRecords] = useState([]);
  const [xrays, setXrays] = useState([]);

  const [selectedRecordId, setSelectedRecordId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [fileTypeFilter, setFileTypeFilter] = useState("All");

  const [loadingRecords, setLoadingRecords] = useState(true);
  const [loadingXrays, setLoadingXrays] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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

  const fetchRecords = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoadingRecords(true);
      }

      setError("");

      const response = await API.get(
        "/api/dental-records/patient/my-records/list",
        authHeaders,
      );

      const patientRecords = response.data.dental_records || [];
      setRecords(patientRecords);

      if (!selectedRecordId && patientRecords.length > 0) {
        setSelectedRecordId(patientRecords[0].record_id);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load dental records.");
    } finally {
      setLoadingRecords(false);
      setRefreshing(false);
    }
  };

  const fetchXraysByRecord = async (recordId, isRefresh = false) => {
    if (!recordId || recordId === "undefined") {
      setXrays([]);
      setError("Invalid dental record selected.");
      return;
    }

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoadingXrays(true);
      }

      setError("");

      const response = await API.get(
        `/api/xrays/record/${recordId}`,
        authHeaders,
      );

      const loadedXrays = response.data.xrays || [];
      setXrays(loadedXrays);

      console.log("PATIENT XRAYS LOADED:", loadedXrays);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to load X-rays.");
    } finally {
      setLoadingXrays(false);
      setRefreshing(false);
    }
  };

  const refreshPage = async () => {
    await fetchRecords(true);

    if (selectedRecordId) {
      await fetchXraysByRecord(selectedRecordId, true);
    }
  };

  const getApiHost = () => {
    if (process.env.REACT_APP_API_URL) {
      return process.env.REACT_APP_API_URL.replace(/\/$/, "");
    }

    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    return isLocalhost
      ? "http://localhost:5000"
      : "https://api.dentograph.site";
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

    const pathWithSlash = normalizedPath.startsWith("/")
      ? normalizedPath
      : `/${normalizedPath}`;

    return `${getApiHost()}${pathWithSlash}`;
  };

  const getFileName = (filePath) => {
    if (!filePath) return "No file name";
    return String(filePath).split("/").pop() || filePath;
  };

  const getFileType = (filePath) => {
    const cleanPath = String(filePath || "").toLowerCase();

    if (cleanPath.endsWith(".pdf")) return "PDF";
    if (cleanPath.endsWith(".png")) return "PNG";
    if (cleanPath.endsWith(".jpg") || cleanPath.endsWith(".jpeg")) return "JPG";

    return "File";
  };

  const isImageFile = (filePath) => {
    const cleanPath = String(filePath || "").toLowerCase();

    return (
      cleanPath.endsWith(".png") ||
      cleanPath.endsWith(".jpg") ||
      cleanPath.endsWith(".jpeg")
    );
  };

  const isPdfFile = (filePath) => {
    return String(filePath || "")
      .toLowerCase()
      .endsWith(".pdf");
  };

  const getXrayId = (xray) => {
    return xray?.xray_id || xray?.id || xray?.image_id || xray?.xray_image_id;
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
      const fileType = getFileType(xray.file_path);

      const matchesFileType =
        fileTypeFilter === "All" || fileType === fileTypeFilter;

      const searchableText = [
        getXrayId(xray),
        xray.record_id,
        xray.tooth_number,
        xray.file_path,
        getFileName(xray.file_path),
        fileType,
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
      image: xrays.filter((xray) => isImageFile(xray.file_path)).length,
      pdf: xrays.filter((xray) => isPdfFile(xray.file_path)).length,
      toothSpecific: xrays.filter((xray) => xray.tooth_number).length,
    };
  }, [xrays]);

  const renderLoadingState = () => {
    return (
      <div className="patient-xray-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="patient-xray-card loading-card" key={index}>
            <div className="patient-xray-preview-skeleton">
              <div className="loading-line loading-title"></div>
            </div>

            <div className="patient-xray-card-body">
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
    <DashboardLayout role="Patient">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>My X-rays</h2>
            <p>
              Select a dental record, review uploaded X-ray files, and open
              AI-assisted review for image files.
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

        {message && <div className="success-message">{message}</div>}

        {error && (
          <div className="error-message">
            <strong>X-ray notice</strong>
            <p>{error}</p>
          </div>
        )}

        <div className="info-message">
          AI-assisted X-ray findings are not final diagnoses. Results must be
          reviewed and confirmed by your dentist before they are treated as
          clinical findings.
        </div>

        <div className="patient-dashboard-summary-grid">
          <div className="patient-dashboard-card">
            <span>Total X-rays</span>
            <strong>{xraySummary.total}</strong>
            <p>Files connected to the selected record.</p>
          </div>

          <div className="patient-dashboard-card">
            <span>Image Files</span>
            <strong>{xraySummary.image}</strong>
            <p>Available for AI-assisted review.</p>
          </div>

          <div className="patient-dashboard-card">
            <span>PDF Files</span>
            <strong>{xraySummary.pdf}</strong>
            <p>Can be opened directly.</p>
          </div>

          <div className="patient-dashboard-card">
            <span>Tooth-Specific</span>
            <strong>{xraySummary.toothSpecific}</strong>
            <p>X-rays tagged to a tooth number.</p>
          </div>
        </div>

        <div className="patient-dashboard-section">
          <div className="appointments-header">
            <div>
              <h2>Search and Filter</h2>
              <p>Choose a record and filter X-ray files clearly.</p>
            </div>
          </div>

          <div className="patient-xray-control-panel">
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

            <div className="form-group">
              <label>Search X-rays</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search file, tooth, date, or X-ray ID"
              />
            </div>

            <div className="form-group">
              <label>File Type</label>
              <select
                value={fileTypeFilter}
                onChange={(e) => setFileTypeFilter(e.target.value)}
              >
                <option value="All">All File Types</option>
                <option value="PNG">PNG</option>
                <option value="JPG">JPG</option>
                <option value="PDF">PDF</option>
                <option value="File">Other Files</option>
              </select>
            </div>
          </div>
        </div>

        {selectedRecord && (
          <div className="patient-dashboard-section">
            <div className="appointment-item">
              <div className="appointment-info">
                <div className="appointment-title-row">
                  <h3>Selected Record #{selectedRecord.record_id}</h3>
                  <span className="status-badge status-scheduled">
                    {selectedRecord.status || "Active"}
                  </span>
                </div>

                <div className="patient-record-detail-grid">
                  <p>
                    <strong>Dentist:</strong>{" "}
                    {selectedRecord.dentist_name ||
                      `Dentist ID ${selectedRecord.dentist_id}`}
                  </p>

                  <p>
                    <strong>Clinic:</strong>{" "}
                    {selectedRecord.clinic_name || "No clinic listed"}
                  </p>

                  <p>
                    <strong>Date Created:</strong>{" "}
                    {formatDate(selectedRecord.date_created)}
                  </p>
                </div>
              </div>

              <div className="appointment-actions">
                <button
                  className="secondary-button"
                  onClick={() =>
                    navigate(`/patient/records/${selectedRecord.record_id}`)
                  }
                >
                  Open Record
                </button>

                <button
                  className="primary-button"
                  onClick={() =>
                    navigate(
                      `/patient/records/${selectedRecord.record_id}/3d-view`,
                    )
                  }
                >
                  3D Chart
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="patient-dashboard-section">
          <div className="appointments-header">
            <div>
              <h2>X-ray Files</h2>
              <p>
                {loadingXrays
                  ? "Loading X-rays..."
                  : `${filteredXrays.length} of ${xrays.length} files shown.`}
              </p>
            </div>
          </div>

          {loadingRecords || loadingXrays ? (
            renderLoadingState()
          ) : !selectedRecordId ? (
            <div className="empty-state">
              <h3>No dental record selected</h3>
              <p>Select a dental record to view its uploaded X-rays.</p>
            </div>
          ) : filteredXrays.length === 0 ? (
            <div className="empty-state">
              <h3>No X-rays found</h3>
              <p>
                No X-ray files match the selected record and filters. Try
                changing the search or file type filter.
              </p>
            </div>
          ) : (
            <div className="patient-xray-grid">
              {filteredXrays.map((xray, index) => {
                const xrayId = getXrayId(xray);
                const isPdf = isPdfFile(xray.file_path);
                const isImage = isImageFile(xray.file_path);

                return (
                  <div
                    className="patient-xray-card"
                    key={xrayId || `${xray.file_path}-${index}`}
                  >
                    <div className="patient-xray-preview">
                      {isImage ? (
                        <img
                          src={getFileUrl(xray.file_path)}
                          alt={`X-ray ${xrayId || index + 1}`}
                        />
                      ) : (
                        <div className="patient-xray-file-placeholder">
                          <strong>{getFileType(xray.file_path)}</strong>
                          <span>{getFileName(xray.file_path)}</span>
                        </div>
                      )}
                    </div>

                    <div className="patient-xray-card-body">
                      <div className="appointment-title-row">
                        <h3>X-ray #{xrayId || "Missing ID"}</h3>

                        <span className="status-badge status-scheduled">
                          {getFileType(xray.file_path)}
                        </span>
                      </div>

                      <div className="patient-xray-details">
                        <p>
                          <strong>Record:</strong> #
                          {xray.record_id || selectedRecordId}
                        </p>

                        <p>
                          <strong>Tooth:</strong>{" "}
                          {xray.tooth_number
                            ? `Tooth #${xray.tooth_number}`
                            : "General"}
                        </p>

                        <p>
                          <strong>Uploaded:</strong>{" "}
                          {formatDate(xray.upload_date)}
                        </p>

                        <p>
                          <strong>File:</strong> {getFileName(xray.file_path)}
                        </p>
                      </div>

                      <div className="patient-xray-actions">
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
                            disabled={!xrayId}
                            onClick={() => {
                              if (!xrayId) {
                                console.log("XRAY MISSING ID:", xray);
                                setError(
                                  "Unable to open AI review because this X-ray has no valid ID.",
                                );
                                return;
                              }

                              navigate(`/patient/xrays/${xrayId}/annotations`);
                            }}
                          >
                            AI Review
                          </button>
                        )}
                      </div>

                      {!xrayId && (
                        <div
                          className="error-message"
                          style={{ marginTop: "12px" }}
                        >
                          This X-ray has no valid ID from the server.
                        </div>
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
