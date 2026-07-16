import React, { useEffect, useMemo, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import { useNavigate, useParams } from "react-router-dom";

function PatientDentalRecordDetails() {
  const { record_id } = useParams();
  const navigate = useNavigate();

  const [record, setRecord] = useState(null);
  const [teeth, setTeeth] = useState([]);
  const [treatments, setTreatments] = useState([]);
  const [xrays, setXrays] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadingXrays, setLoadingXrays] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [toothStatusFilter, setToothStatusFilter] = useState("All");
  const [treatmentSearch, setTreatmentSearch] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const token = localStorage.getItem("token");

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  useEffect(() => {
    fetchRecordDetails();
    fetchXrays();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record_id]);

  const fetchRecordDetails = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const response = await API.get(
        `/api/dental-records/${record_id}`,
        authHeaders,
      );

      setRecord(response.data.dental_record || null);
      setTeeth(response.data.teeth || []);
      setTreatments(response.data.treatments || []);
    } catch (err) {
      setError(
        err.response?.data?.error || "Unable to load dental record details.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchXrays = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoadingXrays(true);
      }

      const response = await API.get(
        `/api/xrays/record/${record_id}`,
        authHeaders,
      );

      setXrays(response.data.xrays || []);
    } catch (err) {
      console.error("Fetch X-rays error:", err);
    } finally {
      setLoadingXrays(false);
      setRefreshing(false);
    }
  };

  const refreshPage = () => {
    fetchRecordDetails(true);
    fetchXrays(true);
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

  const getStatusClass = (status) => {
    switch (status) {
      case "Archived":
        return "status-badge status-cancelled";
      case "Inactive":
        return "status-badge status-pending";
      case "Active":
      default:
        return "status-badge status-scheduled";
    }
  };

  const getToothStatusClass = (status) => {
    switch (status) {
      case "Decayed":
      case "Missing":
        return "status-badge status-cancelled";
      case "Filled":
      case "Impacted":
        return "status-badge status-pending";
      case "Crowned":
        return "status-badge status-scheduled";
      case "Normal":
      default:
        return "status-badge status-completed";
    }
  };

  const getFileUrl = (filePath) => {
    if (!filePath) return "";

    if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
      return filePath;
    }

    const baseURL = process.env.REACT_APP_API_URL || "http://localhost:5000";
    const cleanBaseURL = baseURL.replace(/\/$/, "");
    const cleanPath = String(filePath).replace(/^\//, "");

    return `${cleanBaseURL}/${cleanPath}`;
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

  const toothStatusOptions = useMemo(() => {
    const statusSet = new Set();

    teeth.forEach((tooth) => {
      statusSet.add(tooth.tooth_status || "Normal");
    });

    return ["All", ...Array.from(statusSet).sort()];
  }, [teeth]);

  const filteredTeeth = useMemo(() => {
    if (toothStatusFilter === "All") return teeth;

    return teeth.filter(
      (tooth) => (tooth.tooth_status || "Normal") === toothStatusFilter,
    );
  }, [teeth, toothStatusFilter]);

  const filteredTreatments = useMemo(() => {
    const search = treatmentSearch.trim().toLowerCase();

    if (!search) return treatments;

    return treatments.filter((treatment) => {
      const searchableText = [
        treatment.treatment_id,
        treatment.procedure_type,
        treatment.description,
        treatment.tooth_number,
        treatment.treatment_date,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(search);
    });
  }, [treatments, treatmentSearch]);

  const summary = useMemo(() => {
    const problemTeeth = teeth.filter((tooth) => {
      const status = tooth.tooth_status || "Normal";
      return status !== "Normal";
    }).length;

    return {
      teeth: teeth.length,
      problemTeeth,
      treatments: treatments.length,
      xrays: xrays.length,
    };
  }, [teeth, treatments, xrays]);

  const renderLoadingState = () => {
    return (
      <div className="appointments-list">
        {Array.from({ length: 3 }).map((_, index) => (
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
    <DashboardLayout role="Patient">
      <div className="appointments-list-card">
        <div className="appointments-header">
          <div>
            <h2>Dental Record Details</h2>
            <p>
              Review your dental record summary, tooth status, treatment
              history, X-rays, and 3D dental chart.
            </p>
          </div>

          <div className="appointment-actions">
            <button
              className="secondary-button"
              onClick={() => navigate("/patient/records")}
            >
              Back to Records
            </button>

            <button
              className="primary-button"
              onClick={() => navigate(`/patient/records/${record_id}/3d-view`)}
            >
              3D Chart
            </button>

            <button
              className="secondary-button"
              onClick={refreshPage}
              disabled={loading || loadingXrays || refreshing}
            >
              {loading || loadingXrays || refreshing
                ? "Refreshing..."
                : "Refresh"}
            </button>
          </div>
        </div>

        {message && <div className="success-message">{message}</div>}

        {error && (
          <div className="error-message">
            <strong>Unable to load dental record.</strong>
            <p>{error}</p>
          </div>
        )}

        {loading ? (
          renderLoadingState()
        ) : !record ? (
          <div className="empty-state">
            <h3>Dental record not found</h3>
            <p>
              The selected dental record may not exist or may be unavailable.
            </p>
          </div>
        ) : (
          <>
            <div className="patient-dashboard-summary-grid">
              <div className="patient-dashboard-card">
                <span>Teeth Recorded</span>
                <strong>{summary.teeth}</strong>
                <p>Teeth with available status entries.</p>
              </div>

              <div className="patient-dashboard-card">
                <span>Needs Attention</span>
                <strong>{summary.problemTeeth}</strong>
                <p>Teeth not marked as normal.</p>
              </div>

              <div className="patient-dashboard-card">
                <span>Treatments</span>
                <strong>{summary.treatments}</strong>
                <p>Treatment entries linked to this record.</p>
              </div>

              <div className="patient-dashboard-card">
                <span>X-rays</span>
                <strong>{summary.xrays}</strong>
                <p>X-ray files uploaded for this record.</p>
              </div>
            </div>

            <div className="patient-dashboard-section">
              <div className="appointments-header">
                <div>
                  <h2>Record Summary</h2>
                  <p>Basic information connected to this dental record.</p>
                </div>
              </div>

              <div className="appointment-item">
                <div className="appointment-info">
                  <div className="appointment-title-row">
                    <h3>Record #{record.record_id}</h3>

                    <span className={getStatusClass(record.status)}>
                      {record.status || "Active"}
                    </span>
                  </div>

                  <div className="patient-record-detail-grid">
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
                      {formatDate(record.date_created)}
                    </p>

                    <p>
                      <strong>Last Updated:</strong>{" "}
                      {formatDate(record.last_updated)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="patient-dashboard-section">
              <div className="appointments-header">
                <div>
                  <h2>Teeth Overview</h2>
                  <p>
                    Filter tooth records by status. Open the 3D chart for a
                    visual dental view.
                  </p>
                </div>

                <button
                  className="primary-button"
                  onClick={() =>
                    navigate(`/patient/records/${record_id}/3d-view`)
                  }
                >
                  Open 3D Chart
                </button>
              </div>

              <div className="patient-detail-filter-panel">
                <div className="form-group">
                  <label>Tooth Status</label>
                  <select
                    value={toothStatusFilter}
                    onChange={(e) => setToothStatusFilter(e.target.value)}
                  >
                    {toothStatusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status === "All" ? "All Tooth Statuses" : status}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {teeth.length === 0 ? (
                <div className="empty-state">
                  <h3>No teeth added</h3>
                  <p>
                    Tooth records will appear here once added by your dentist.
                  </p>
                </div>
              ) : filteredTeeth.length === 0 ? (
                <div className="empty-state">
                  <h3>No matching teeth</h3>
                  <p>Try selecting another tooth status filter.</p>
                </div>
              ) : (
                <div className="patient-tooth-grid">
                  {filteredTeeth.map((tooth) => (
                    <div className="patient-tooth-card" key={tooth.tooth_id}>
                      <div className="appointment-title-row">
                        <h3>Tooth #{tooth.tooth_number}</h3>

                        <span
                          className={getToothStatusClass(
                            tooth.tooth_status || "Normal",
                          )}
                        >
                          {tooth.tooth_status || "Normal"}
                        </span>
                      </div>

                      <p>
                        <strong>Tooth ID:</strong> {tooth.tooth_id}
                      </p>

                      <p>
                        <strong>Status:</strong>{" "}
                        {tooth.tooth_status || "Normal"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="patient-dashboard-section">
              <div className="appointments-header">
                <div>
                  <h2>Treatment History</h2>
                  <p>
                    View the treatments and procedures recorded by your dentist.
                  </p>
                </div>
              </div>

              <div className="patient-detail-filter-panel">
                <div className="form-group">
                  <label>Search Treatments</label>
                  <input
                    type="text"
                    value={treatmentSearch}
                    onChange={(e) => setTreatmentSearch(e.target.value)}
                    placeholder="Search procedure, description, tooth, or date..."
                  />
                </div>
              </div>

              {treatments.length === 0 ? (
                <div className="empty-state">
                  <h3>No treatments recorded</h3>
                  <p>
                    Treatment history will appear here once added by your
                    dentist.
                  </p>
                </div>
              ) : filteredTreatments.length === 0 ? (
                <div className="empty-state">
                  <h3>No matching treatments</h3>
                  <p>Try changing your treatment search term.</p>
                </div>
              ) : (
                <div className="appointments-list">
                  {filteredTreatments.map((treatment) => (
                    <div
                      className="appointment-item"
                      key={treatment.treatment_id}
                    >
                      <div className="appointment-info">
                        <div className="appointment-title-row">
                          <h3>{treatment.procedure_type || "Treatment"}</h3>

                          <span className="status-badge status-scheduled">
                            Tooth #{treatment.tooth_number || "N/A"}
                          </span>
                        </div>

                        <div className="patient-record-detail-grid">
                          <p>
                            <strong>Treatment ID:</strong>{" "}
                            {treatment.treatment_id}
                          </p>

                          <p>
                            <strong>Treatment Date:</strong>{" "}
                            {formatDate(treatment.treatment_date)}
                          </p>

                          <p>
                            <strong>Description:</strong>{" "}
                            {treatment.description || "No description provided"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="patient-dashboard-section">
              <div className="appointments-header">
                <div>
                  <h2>X-ray Images</h2>
                  <p>View uploaded X-ray files connected to this record.</p>
                </div>

                <button
                  className="secondary-button"
                  onClick={() => navigate("/patient/xrays")}
                >
                  Open X-ray Page
                </button>
              </div>

              {loadingXrays ? (
                renderLoadingState()
              ) : xrays.length === 0 ? (
                <div className="empty-state">
                  <h3>No X-rays uploaded</h3>
                  <p>
                    X-ray files will appear here once uploaded by clinical
                    staff.
                  </p>
                </div>
              ) : (
                <div className="patient-xray-grid">
                  {xrays.map((xray) => (
                    <div className="patient-xray-card" key={xray.xray_id}>
                      <div className="patient-xray-card-body">
                        <div className="appointment-title-row">
                          <h3>X-ray #{xray.xray_id}</h3>

                          <span className="status-badge status-scheduled">
                            {getFileType(xray.file_path)}
                          </span>
                        </div>

                        <div className="patient-xray-details">
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
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

export default PatientDentalRecordDetails;
